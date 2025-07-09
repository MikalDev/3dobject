// @ts-check
"use strict"

const SHADER_MAX_BONES = 256; // Maximum bones supported by the shader's UBO definition

class GltfData {
  constructor(runtime, sdkType) {
    this._runtime = runtime
    this._sdkType = sdkType
    this.gltf = {}
    this.dynamicTexturesLoaded = false
    this.imageBitmap = {}
    this.sharedModelBoneUbo = null; // For the shared UBO containing bone matrices for this model asset
    this.bonesPerModelAsset = 0; // Actual number of bones in this model asset
    this.rendererForUbo = null; // Store renderer for UBO release
  }

  release() {
    // Release gltf data structure contents
    if (this.gltf) {
      // Release buffers
      if (this.gltf.buffers) {
        this.gltf.buffers = null
      }

      // Release boneBuffers in each node
      if (this.gltf.nodes) {
        for (let i = 0; i < this.gltf.nodes.length; i++) {
          if (this.gltf.nodes[i]) {
            if (this.gltf.nodes[i].boneBuffer && typeof this.gltf.nodes[i].boneBuffer.release === 'function') {
              this.gltf.nodes[i].boneBuffer.release()
            }
          }
        }
      }

      // Release accessors data
      if (this.gltf.accessors) {
        for (let i = 0; i < this.gltf.accessors.length; i++) {
          if (this.gltf.accessors[i]) {
            this.gltf.accessors[i].data = null
          }
        }
      }

      // Release skinned nodes
      if (this.gltf.skinnedNodes) {
        for (let i = 0; i < this.gltf.skinnedNodes.length; i++) {
          if (this.gltf.skinnedNodes[i]) {
            this.gltf.skinnedNodes[i].invMatrix = null
            this.gltf.skinnedNodes[i].boneMatrix = null
          }
        }
      }

      // Release matrices
      if (this.gltf.skins) {
        for (let i = 0; i < this.gltf.skins.length; i++) {
          const skin = this.gltf.skins[i]
          if (skin) {
            skin.inverseBindMatrices = null
            if (skin.joints) {
              for (let j = 0; j < skin.joints.length; j++) {
                if (skin.joints[j]) {
                  skin.joints[j].invBindMatrix = null
                  skin.joints[j].boneMatrix = null
                }
              }
            }
          }
        }
      }
    }

    // Release image bitmaps
    for (const key in this.imageBitmap) {
      if (this.imageBitmap[key]) {
        if (typeof this.imageBitmap[key].close === 'function') {
          this.imageBitmap[key].close();
        }
        this.imageBitmap[key] = null;
      }
    }

    // Release white image bitmap
    if (this.whiteImageBitmap) {
      if (typeof this.whiteImageBitmap.close === 'function') {
        this.whiteImageBitmap.close();
      }
      this.whiteImageBitmap = null;
    }

    // Release references
    // @ts-ignore
    this.gltf = null
    // @ts-ignore
    this.imageBitmap = null
    this._runtime = null
    this._sdkType = null
    // @ts-ignore
    this.dynamicTexturesLoaded = null

    // Release shared UBO if it exists
    if (this.sharedModelBoneUbo && this.rendererForUbo) {
      const gl = this.rendererForUbo._gl;
      if (gl) {
        console.log("Deleting shared Bone UBO for model asset");
        gl.deleteBuffer(this.sharedModelBoneUbo);
      }
      this.sharedModelBoneUbo = null;
    }
    this.rendererForUbo = null;
  }

  /*
	Requests an url as a json file, then does some processing on that, and finally calls a js or c2 function.
	Expects an "embeded" gltf file.
    */
  async load(gltfPath, isRuntime, debug) {
    let runtime = this._runtime
    let sdkType = this._sdkType
    
    if (isRuntime) {
      this.rendererForUbo = runtime.GetCanvasManager().GetWebGLRenderer(); // Store renderer for UBO management only in runtime
    } else {
      this.rendererForUbo = null; // Ensure it's null in edittime
    }

    if (debug) console.info("load gltfPath", gltfPath)

    let gltfURI
    if (isRuntime) {
      gltfURI = await runtime.GetAssetManager().GetProjectFileUrl(gltfPath)
    } else {
      if (gltfPath.includes("http")) {
        // Can't load from URL in editor
        alert("Cannot load from URL in editor")
        return false
      } else {
        // Get iProjectFiles
        gltfURI = await runtime.GetProjectFileByExportPath(gltfPath)
      }
    }

    if (gltfURI === null) {
      alert("gltfPath not found: " + gltfPath)
      console.warn("glfPath not found:", gltfPath)
      return false
    }

    const isBinary = gltfPath.includes(".glb") || gltfPath.includes("ext=glb")

    let resultgltf

    // resultgltf = await this.loadGLTF(gltfURI, isRuntime, debug, isBinary)

    // Don't crash on loading error
    try {
      resultgltf = await this.loadGLTF(gltfURI, isRuntime, debug, isBinary)
    } catch (err) {
      alert("Error loading GLTF:" + err)
      console.error("Error loading GLTF:", err)
      return false
    }

    if (resultgltf) {
      if (debug) console.info("[3DObject] modelData:", resultgltf)
      sdkType.dataLoaded = true
    } else {
      console.warn("[3DObject] Unable to load gltf files")
      alert("Unable to load gltf files")
      return false
    }

    this.gltf = resultgltf

    // Determine bonesPerModelAsset after gltf is fully processed
    this._calculateBonesPerModelAsset();

    return true
  }

  /*
	Once the gltf file is loaded as a json this does a few things to it to make out lives easier.
	1. It converts the buffers from base64 to a typed array.
	2. The accessors are then made as typed views of the buffers.
	3. All the places where indexes are used are changed to look at those objects themselves.
	4. Adds some properties that are optionally in the gltf file.
	5. Adds a few properties that are utilized when getting data from skinning.
*/
  async loadGLTF(uri, isRuntime, debug, isBinary) {
    let gltf
    let binBuffer

    if (debug) console.info("loadGLTF", uri)
    console.debug("loadGLTF", uri)

    if (isRuntime) {
      if (isBinary) {
        let response = await fetch(uri, { mode: "cors" })
        let buffer = await response.arrayBuffer()
        const magic = new DataView(buffer.slice(0, 4)).getUint32(0, true)
        const version = new DataView(buffer.slice(4, 8)).getUint32(0, true)
        const jsonBufSize = new DataView(buffer.slice(12, 16)).getUint32(0, true)

        let utf8decoder = new TextDecoder()
        let jsonString = utf8decoder.decode(buffer.slice(20, 20 + jsonBufSize))
        gltf = JSON.parse(jsonString)
        binBuffer = buffer.slice(jsonBufSize + 28)
      } else {
        try {
          let response = await fetch(uri)
          let text = await response.text()
          gltf = JSON.parse(text)
        } catch (err) {
          console.error("[3DShape], cannot fetch/parse gltf", uri)
          return false
        }
      }
    } else {
      if (isBinary) {
        try {
          let projectFile = await uri.GetBlob()
          if (!projectFile) return false
          let buffer = await projectFile.arrayBuffer()
          // if (!buffer) return false;
          const magic = new DataView(buffer.slice(0, 4)).getUint32(0, true)
          const version = new DataView(buffer.slice(4, 8)).getUint32(0, true)
          const jsonBufSize = new DataView(buffer.slice(12, 16)).getUint32(0, true)

          let utf8decoder = new TextDecoder()
          let jsonString = utf8decoder.decode(buffer.slice(20, 20 + jsonBufSize))

          gltf = JSON.parse(jsonString)
          binBuffer = buffer.slice(jsonBufSize + 28)
        } catch (err) {
          console.error("[3DShape], cannot fetch/parse gltf blob", err)
          return false
        }
      } else {
        try {
          let projectFile = await uri.GetBlob()
          if (!projectFile) return false
          let text = await projectFile.text()
          if (!text) return false
          gltf = JSON.parse(text)
        } catch (err) {
          console.error("[3DShape], cannot fetch/parse gltf blob", uri)
          return false
        }
      }
    }

    if (!gltf) return false

    // Debug GLTF file structure
    console.log('[DEBUG] GLTF file structure:', {
      asset: gltf.asset,
      extensionsUsed: gltf.extensionsUsed,
      extensionsRequired: gltf.extensionsRequired,
      hasBuffers: !!gltf.buffers,
      bufferCount: gltf.buffers?.length,
      hasBufferViews: !!gltf.bufferViews,
      bufferViewCount: gltf.bufferViews?.length,
      hasAccessors: !!gltf.accessors,
      accessorCount: gltf.accessors?.length,
      hasMeshes: !!gltf.meshes,
      meshCount: gltf.meshes?.length
    })

    // ⚠️ EDITOR BYPASS: Check if we're in editor environment
    const isEditorEnvironment = !isRuntime
    
    // Check for Draco in extensions
    let hasDracoCompression = false
    if (gltf.extensionsUsed && gltf.extensionsUsed.includes('KHR_draco_mesh_compression')) {
      hasDracoCompression = true
      if (isEditorEnvironment) {
        console.warn('⚠️ EDITOR MODE: Draco compression detected but will be bypassed in editor environment to prevent crashes')
        console.warn('⚠️ Draco models will display correctly in preview/runtime')
      } else {
        console.log('🔥 GLTF file declares Draco compression in extensionsUsed')
      }
    } else {
      console.log('📄 GLTF file does not declare Draco compression in extensionsUsed')
    }

    //extra variable for a list of skinned meshes.  They need to be transformed after the rest.
    gltf.skinnedNodes = []

    // buffers
    for (
      let i = 0;
      i < gltf.buffers.length;
      i++ // convert to typed arrays.
    ) {
      if (isBinary) {
        gltf.buffers[i] = new Uint8Array(binBuffer).buffer
      } else {
        let base64 = gltf.buffers[i].uri.slice(37)
        // @ts-ignore
        gltf.buffers[i] = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer
      }
    }

    // Store runtime mode for use in other methods
    this._isRuntime = isRuntime;
    
    // Process meshes - handle Draco in both editor and runtime environments  
    if (isEditorEnvironment && hasDracoCompression) {
      console.log('🔥 EDITOR MODE: Initializing Draco with JavaScript decoder for editor compatibility')
      // Initialize Draco decoder with JS code for editor mode
      await this._initEditorDracoDecoder()
      // Process meshes with Draco support enabled
      await this._processMeshes(gltf)
      // Now process remaining accessors (non-Draco ones)
      await this._processAccessors(gltf)
    } else {
      // Process meshes first to handle Draco compression, then process accessors
      await this._processMeshes(gltf)
      // Now process remaining accessors (non-Draco ones)
      await this._processAccessors(gltf)
    }

    // scene
    if (typeof gltf.scene === "undefined") gltf.scene = 0
    gltf.scene = gltf.scenes[gltf.scene]

    // scenes
    for (let i = 0; i < gltf.scenes.length; i++) {
      let s = gltf.scenes[i]
      for (let j = 0; j < s.nodes.length; j++) s.nodes[j] = gltf.nodes[s.nodes[j]]
    }

    // nodes
    for (let i = 0; i < gltf.nodes.length; i++) {
      let n = gltf.nodes[i]

      if (n.translation == undefined) n.translation = [0, 0, 0]
      if (n.scale == undefined) n.scale = [1, 1, 1]
      if (n.rotation == undefined) n.rotation = [0, 0, 0, 1]
      if (n.matrix == undefined) n.matrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

      if (n.mesh != undefined) n.mesh = gltf.meshes[n.mesh]
      if (n.skin != undefined) {
        n.skin = gltf.skins[n.skin]
        n.invMatrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        gltf.skinnedNodes.push(n)
      }
      if (n.children != undefined) for (let j = 0; j < n.children.length; j++) n.children[j] = gltf.nodes[n.children[j]]
    }

    // animations
    if (gltf.animations) {
      for (let i = 0; i < gltf.animations.length; i++) {
        let a = gltf.animations[i]

        for (let j = 0; j < a.channels.length; j++) {
          let c = a.channels[j]
          c.sampler = a.samplers[c.sampler]
          c.target.node = gltf.nodes[c.target.node]
        }

        for (let j = 0; j < a.samplers.length; j++) {
          let s = a.samplers[j]
          s.input = gltf.accessors[s.input]
          s.output = gltf.accessors[s.output]
        }
      }
    }

    // images
    if ("images" in gltf && gltf.images.length > 0) {
      for (let ii = 0; ii < gltf.textures.length; ii++) {
        let t = gltf.textures[ii]
        t.wrapS = "repeat"
        t.wrapT = "repeat"
        // webp support
        if (t?.extensions?.EXT_texture_webp?.source != undefined) {
          t.source = t.extensions.EXT_texture_webp.source
        }
        if (t.source != undefined && gltf.samplers != undefined && t.sampler != undefined) {
          const sampler = gltf.samplers[t.sampler]
          const wrapS = sampler.wrapS
          const wrapT = sampler.wrapT
          switch (wrapS) {
            case 33071:
              t.wrapS = "clamp-to-edge"
              break
            case 33648:
              t.wrapS = "mirror-repeat"
              break
            case 10497:
              t.wrapS = "repeat"
              break
            default:
              t.wrapS = "repeat"
          }
          switch (wrapT) {
            case 33071:
              t.wrapT = "clamp-to-edge"
              break
            case 33648:
              t.wrapT = "mirror-repeat"
              break
            case 10497:
              t.wrapT = "repeat"
              break
            default:
              t.wrapT = "repeat"
          }
        }
      }
      for (let i = 0; i < gltf.images.length; i++) {
        // If image has no name, set it to the index.
        if (!("name" in gltf.images[i])) gltf.images[i].name = "image-index-" + i
        const image = gltf.images[i]
        let blob
        try {
          if ("bufferView" in image) {
            const bufview = gltf.bufferViews[image.bufferView]
            let imageBuffer
            if (binBuffer) {
              imageBuffer = binBuffer.slice(bufview.byteOffset, bufview.byteOffset + bufview.byteLength)
            } else {
              imageBuffer = gltf.buffers[0].slice(bufview.byteOffset, bufview.byteOffset + bufview.byteLength)
            }
            blob = await new Blob([imageBuffer])
          } else {
            let uri = image.uri
            if (!uri.includes("data:") && !isRuntime) {
              uri = this._runtime.GetProjectFileByExportPath(uri)
              blob = await uri.GetBlob()
            } else {
              blob = await (await fetch(uri)).blob()
            }
          }
        } catch (err) {
          console.error("Error loading image:", err)
          alert("Error loading image: " + err)
          blob = null
          return
        }
        let imageBitmap
        // @ts-ignore
        if (globalThis.createImageBitmap) {
          imageBitmap = await createImageBitmap(blob)
        } else {
          imageBitmap = await this.createImageBitmap(blob)
        }
        // this.imageBitmap.push(imageBitmap)
        this.imageBitmap[image.name] = imageBitmap
        const texture = gltf.textures.find((t) => t.source == i)
        this.imageBitmap[image.name].wrapS = texture.wrapS
        this.imageBitmap[image.name].wrapT = texture.wrapT
      }
    }

    // Standard GLTF processing for non-Draco primitives (after Draco has been handled)
    await this._processStandardPrimitives(gltf)

    //skins
    if (gltf.skins) {
      for (let i = 0; i < gltf.skins.length; i++) {
        let s = gltf.skins[i]
        s.inverseBindMatrices = gltf.accessors[s.inverseBindMatrices]
        // for(let j in s.joints)
        for (let j = 0; j < s.joints.length; j++) {
          s.joints[j] = gltf.nodes[s.joints[j]]
          s.joints[j].invBindMatrix = s.inverseBindMatrices.data.subarray(j * 16, j * 16 + 16)
          s.joints[j].boneMatrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }
      }
    }
    // Create white texture
    const whitePNGURI =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAFElEQVR42mP8/58BL2AcVTCSFAAA0rYf8R32RV0AAAAASUVORK5CYII="
    const blob = await (await fetch(whitePNGURI)).blob()
    // @ts-ignore
    if (globalThis.createImageBitmap) {
      this.whiteImageBitmap = await createImageBitmap(blob)
    } else {
      this.whiteImageBitmap = await this.createImageBitmap(blob)
    }

    let min = [Infinity, Infinity, Infinity]
    let max = [-Infinity, -Infinity, -Infinity]

    gltf.meshes.forEach((mesh) => {
      mesh.primitives.forEach((primitive) => {
        const positionAccessor = primitive.attributes.POSITION
        if (positionAccessor) {
          const minVals = positionAccessor.min
          const maxVals = positionAccessor.max
          min = min.map((val, idx) => Math.min(val, minVals[idx]))
          max = max.map((val, idx) => Math.max(val, maxVals[idx]))
        }
      })
    })

    gltf.boundingBox = { min, max }

    return gltf
  }

  /* Safari and Edge polyfill for createImageBitmap
   * https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/createImageBitmap
   */
  async createImageBitmap(blob) {
    return new Promise((resolve, reject) => {
      let img = document.createElement("img")
      img.addEventListener("load", function () {
        resolve(this)
      })
      img.src = URL.createObjectURL(blob)
    })
  }

  _calculateBonesPerModelAsset() {
    if (!this.gltf || !this.gltf.skins) {
      this.bonesPerModelAsset = 0;
      return;
    }
    let maxJointIndex = -1;
    for (const skin of this.gltf.skins) {
      for (const jointNode of skin.joints) {
        // Assuming jointNode objects are the actual node objects after parsing
        // and gltf.nodes is an array of all nodes.
        // We need the index of the jointNode in the overall gltf.nodes list if joint indices are global.
        // However, glTF skin.joints usually contains indices into gltf.nodes.
        // The actual joint index for skinning often comes from JOINTS_0 attribute.
        // For UBO sizing, we are interested in the highest joint index referenced by any skin.
        // Let's assume skin.joints are direct references to node objects and their 'originalIndex' or similar holds the key.
        // More robustly: iterate through accessors for JOINTS_0 and find max value if available.
        // For now, using skin.joints directly assuming they contain relevant indices or can be mapped.

        // Simpler approach: rely on inverseBindMatrices accessor related to the skin.
        // The number of inverseBindMatrices is the number of joints for that skin.
        // Or, if 'skeleton' root implies a set of joints, that's another way.
        // The most direct way from spec: "The number of joints is given by the count property of the accessor referenced by inverseBindMatrices."
        if (skin.inverseBindMatrices && skin.inverseBindMatrices.count) {
            // A skin defines a set of joints. The UBO for this model must accommodate the largest such set if skins are independent
            // OR if joints are shared, the max index used across all skins.
            // Let's assume for now that we need enough space for any single skin's joint set if they are drawn independently.
            // Or, more likely, joint indices in JOINTS_0 are global for the model.
            // The crucial part is that 'bonesPerModelAsset' should be the size of the bone array for the shader.
            // This is typically max_joint_index_in_attributes + 1.
            // This requires checking all mesh primitives using this skin.
            // For now, let's assume gltf.accessors[skin.inverseBindMatrices].count is a good proxy for a single skin.
            // A more accurate calculation would iterate all skinned meshes, check JOINTS_0 attributes, find max index.
        }
      }
    }

    // A common way to define skeleton size is by the number of entries in the IBM accessor for the most complex skin
    // or the total number of nodes that are joints if there's a global joint list for the model.
    // For simplicity, let's find the skin with the most joints based on its IBM.
    if (this.gltf.skins.length > 0) {
        for (const skin of this.gltf.skins) {
            if (skin.inverseBindMatrices && skin.inverseBindMatrices.data) {
                 // skin.inverseBindMatrices.data is a Float32Array of size N*16 for N joints.
                const jointCountForThisSkin = skin.inverseBindMatrices.data.length / 16;
                if (jointCountForThisSkin > maxJointIndex) {
                    // This isn't maxJointIndex, it's maxJoint *Count* for a skin.
                    // We need the max *index value* from JOINTS_0 attributes across all meshes.
                    // This calculation is complex here. For now, placeholder.
                }
            }
        }
    }
    
    // Placeholder: This needs to be correctly calculated by inspecting all JOINTS_0 attributes of meshes.
    // For now, if there are skins, assume a default or parse from a custom property if available.
    // A robust solution needs to iterate mesh primitive attributes.
    // Let's find it from existing objectBuffer: mesh.maxJointIndexUsed
    let modelMaxJointIndex = -1;
    if (this.gltf.meshes) {
        for(const mesh of this.gltf.meshes) {
            // Placeholder for where maxJointIndexUsed might be stored after processing all its primitives
            // This property isn't standard in gltf.meshes, it would be calculated and stored during initial processing.
            // For now, we'll defer this calculation until we know how maxJointIndexUsed per mesh is populated.
            // If each mesh primitive already calculates its maxJointIndexUsed (as in ObjectBuffer), we can aggregate it here.
            
            // Iterate primitives to find the true max index from JOINTS_0 accessors
            for (const primitive of mesh.primitives) {
                if (primitive.attributes.JOINTS_0) {
                    const jointAccessor = primitive.attributes.JOINTS_0;
                    const jointData = jointAccessor.data; // This is Uint16Array or Uint8Array
                    for (let k=0; k < jointData.length; k++) {
                        if (jointData[k] > modelMaxJointIndex) {
                            modelMaxJointIndex = jointData[k];
                        }
                    }
                }
            }
        }
    }

    if (modelMaxJointIndex > -1) {
        this.bonesPerModelAsset = modelMaxJointIndex + 1;
    } else if (this.gltf.skins && this.gltf.skins.length > 0) {
        // Fallback if JOINTS_0 isn't found or empty, use IBM count of largest skin
        // This is less accurate for UBO sizing if joint indices are sparse.
        let maxSkinJoints = 0;
        for (const skin of this.gltf.skins) {
            if (skin.inverseBindMatrices && skin.inverseBindMatrices.data) {
                const jointCountForThisSkin = skin.inverseBindMatrices.data.length / 16;
                if (jointCountForThisSkin > maxSkinJoints) {
                    maxSkinJoints = jointCountForThisSkin;
                }
            }
        }
        this.bonesPerModelAsset = maxSkinJoints;
    } else {
        this.bonesPerModelAsset = 0; // No skins, no bones needed for skinning UBO
    }

    if (this.bonesPerModelAsset > 0) {
        console.log(`Calculated bonesPerModelAsset: ${this.bonesPerModelAsset} for ${this.gltf?.asset?.extras?.originalFileName || 'Unknown Model'}`);
    }
  }

  // Initialize Draco decoder for editor mode with embedded JavaScript decoder
  async _initEditorDracoDecoder() {
    if (this._dracoDecoder) {
      return // Already initialized
    }

    try {
      console.log('🔥 Initializing Draco decoder for editor mode with embedded JS decoder...')
      
      // Create DRACODecoder instance for editor mode
      // Uses embedded JS decoder string from globalThis.dracoDecoderGltfString
      this._dracoDecoder = new DRACODecoder(this._runtime, true)
      
      await this._dracoDecoder.preload()
      console.log('🔥 Successfully initialized Draco decoder for editor mode')
      
    } catch (error) {
      console.error('❌ Failed to initialize editor Draco decoder:', error)
      throw error
    }
  }

  // Process Draco compressed primitive
  async _processDracoPrimitive(primitive, gltf) {
    console.log('[DEBUG] Starting Draco primitive processing...')
    
    const dracoExtension = primitive.extensions.KHR_draco_mesh_compression
    console.log('[DEBUG] Draco extension data:', dracoExtension)
    
    try {
      // Initialize Draco decoder if not already done
      if (!this._dracoDecoder) {
        // Determine if we're in editor mode using stored runtime state
        const isEditorMode = !this._isRuntime
        
        if (isEditorMode) {
          console.warn('⚠️ Draco decoder not initialized in editor mode, creating editor-mode decoder')
          this._dracoDecoder = new DRACODecoder(this._runtime, true)
        } else {
          console.warn('⚠️ Draco decoder not initialized in runtime mode, creating runtime-mode decoder')
          this._dracoDecoder = new DRACODecoder(this._runtime)
          this._dracoDecoder.setDecoderPath('') // Path is handled by our wrapper
        }
        await this._dracoDecoder.preload()
      }

      // Get compressed buffer data
      const bufferView = gltf.bufferViews[dracoExtension.bufferView]
      const buffer = gltf.buffers[bufferView.buffer]
      const byteOffset = bufferView.byteOffset || 0
      const byteLength = bufferView.byteLength
      
      const compressedBuffer = new Uint8Array(buffer, byteOffset, byteLength)
      
      // Map GLTF attribute names to Draco attribute IDs
      const attributeIDs = {}
      const attributeTypes = {}
      
      for (const [gltfAttr, dracoId] of Object.entries(dracoExtension.attributes)) {
        attributeIDs[gltfAttr] = dracoId
        // Set appropriate attribute types
        switch (gltfAttr) {
          case 'POSITION':
          case 'NORMAL':
          case 'TEXCOORD_0':
          case 'TEXCOORD_1':
            attributeTypes[gltfAttr] = 'Float32Array'
            break
          case 'COLOR_0':
            attributeTypes[gltfAttr] = 'Float32Array'
            break
          case 'JOINTS_0':
            attributeTypes[gltfAttr] = 'Uint16Array'
            break
          case 'WEIGHTS_0':
            attributeTypes[gltfAttr] = 'Float32Array'
            break
          default:
            attributeTypes[gltfAttr] = 'Float32Array'
        }
      }

      // Decode the geometry
      const decodedGeometry = await this._dracoDecoder.decodePrimitive(
        compressedBuffer, attributeIDs, attributeTypes
      )

      // Create GLTF-compatible accessors from decoded data
      let nextAccessorIndex = gltf.accessors.length

      // Process indices
      if (decodedGeometry.indices) {
        const indicesAccessor = {
          componentType: decodedGeometry.indices.componentType,
          count: decodedGeometry.indices.count,
          type: 'SCALAR',
          data: decodedGeometry.indices.data,
          min: [Math.min(...decodedGeometry.indices.data)],
          max: [Math.max(...decodedGeometry.indices.data)],
          _dracoDecoded: true // Mark as Draco decoded
        }
        
        gltf.accessors[nextAccessorIndex] = indicesAccessor
        primitive.indices = indicesAccessor
        nextAccessorIndex++
      }

      // Process attributes
      primitive.attributes = {}
      for (const [attrName, attrData] of Object.entries(decodedGeometry.attributes)) {
        const accessor = {
          componentType: attrData.componentType,
          count: attrData.count,
          type: attrData.type,
          data: attrData.data,
          normalized: attrData.normalized,
          _dracoDecoded: true // Mark as Draco decoded
        }

        // Calculate min/max for position attributes
        if (attrName === 'POSITION' && attrData.itemSize === 3) {
          const data = attrData.data
          let min = [Infinity, Infinity, Infinity]
          let max = [-Infinity, -Infinity, -Infinity]
          
          for (let i = 0; i < data.length; i += 3) {
            min[0] = Math.min(min[0], data[i])
            min[1] = Math.min(min[1], data[i + 1])
            min[2] = Math.min(min[2], data[i + 2])
            max[0] = Math.max(max[0], data[i])
            max[1] = Math.max(max[1], data[i + 1])
            max[2] = Math.max(max[2], data[i + 2])
          }
          
          accessor.min = min
          accessor.max = max
        }

        gltf.accessors[nextAccessorIndex] = accessor
        primitive.attributes[attrName] = accessor
        nextAccessorIndex++
      }

      // Mark primitive as Draco processed
      primitive._dracoProcessed = true

      // Remove Draco extension after processing
      delete primitive.extensions.KHR_draco_mesh_compression
      if (Object.keys(primitive.extensions).length === 0) {
        delete primitive.extensions
      }

      console.log('Successfully decoded Draco primitive with', Object.keys(decodedGeometry.attributes).length, 'attributes')
      
    } catch (error) {
      console.error('Failed to decode Draco primitive:', error)
      throw error
    }
  }

  async _processMeshes(gltf) {
    // console.log(`[DEBUG] Processing ${gltf.meshes.length} meshes for Draco compression`)
    
    for (let i = 0; i < gltf.meshes.length; i++) {
      const mesh = gltf.meshes[i]
      console.log(`[DEBUG] Processing mesh ${i} with ${mesh.primitives.length} primitives`)
      
      for (let j = 0; j < mesh.primitives.length; j++) {
        const primitive = mesh.primitives[j]
        
        // Check for Draco extension
        if (primitive.extensions && primitive.extensions['KHR_draco_mesh_compression']) {
          console.log(`🔥 Found Draco primitive in mesh ${i}, primitive ${j}`)
          
          const dracoExt = primitive.extensions['KHR_draco_mesh_compression']
          console.log(`🔥 Draco extension data:`, dracoExt)
          
          try {
                         // Process Draco compression
             await this._processDracoPrimitive(primitive, gltf)
             console.log(`✅ Successfully processed Draco primitive ${i}.${j}`)
             
             // Material processing will be done later in _processStandardPrimitives
             // after images are loaded
             
           } catch (error) {
             console.error(`❌ Failed to process Draco primitive ${i}.${j}:`, error)
             return false
           }
        } else {
          console.log(`📄 Normal primitive in mesh ${i}, primitive ${j}`)
        }
      }
    }
    
    return true
  }

  async _processAccessors(gltf) {
    console.log(`[DEBUG] Processing ${gltf.accessors.length} accessors`)
    
    for (let i = 0; i < gltf.accessors.length; i++) {
      let a = gltf.accessors[i]
      /*console.log(`[DEBUG] Processing accessor ${i}:`, {
        componentType: a.componentType,
        type: a.type,
        count: a.count,
        hasBufferView: a.hasOwnProperty('bufferView'),
        bufferView: a.bufferView,
        hasSparse: !!a.sparse,
        isDracoDecoded: !!a._dracoDecoded
      })*/
      
      let buftype = null
      switch (a.componentType) {
        case 5120:
          buftype = Int8Array
          break
        case 5121:
          buftype = Uint8Array
          break
        case 5122:
          buftype = Int16Array
          break
        case 5123:
          buftype = Uint16Array
          break
        case 5125:
          buftype = Uint32Array
          break
        case 5126:
          buftype = Float32Array
          break
        default:
          console.error("error: gltf, unhandled componentType: " + a.componentType + " for accessor " + i);
          return false; // Stop execution if componentType is unhandled
      }
      let compcount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[a.type]
      
      // Handle sparse accessors
      if (a.sparse) {
        // Create base data array if no bufferView
        if (a.bufferView === undefined || a.bufferView === null) {
          // @ts-ignore
          a.data = new buftype(compcount * a.count);
          // Fill with zeros or default values if specified
          // if (a.normalized) { // Normalization is applied on read, not by zero-filling different types
          // a.data.fill(0);
          // }
        } else {
          // Load base data as normal
          let bufview = gltf.bufferViews[a.bufferView];
          if (!bufview) {
            console.error("error: gltf, missing bufferView for base accessor data in sparse accessor");
            return false; // Critical error
          }
          const byteOffset = (bufview.byteOffset || 0) + (a.byteOffset || 0);
          const elementSize = buftype.BYTES_PER_ELEMENT;
          const length = compcount * a.count;
          // @ts-ignore
          a.data = new buftype(gltf.buffers[bufview.buffer], byteOffset, length);
        }

        // Process sparse values
        const sparse = a.sparse;
        const indicesBufferView = gltf.bufferViews[sparse.indices.bufferView];
        const valuesBufferView = gltf.bufferViews[sparse.values.bufferView];
        
        let indicesComponentType = sparse.indices.componentType;
        let indicesType = null;
        switch (indicesComponentType) {
          case 5121: indicesType = Uint8Array; break;
          case 5123: indicesType = Uint16Array; break;
          case 5125: indicesType = Uint32Array; break;
          default: console.error("Unsupported sparse indices componentType: " + indicesComponentType + " for accessor " + i); return false;
        }

        if (!indicesType) {
            console.error("Critical error: indicesType is null after switch, should not happen. Accessor " + i);
            return false; // Should be unreachable if switch default returns false
        }
        
        const indicesByteOffset = (indicesBufferView.byteOffset || 0) + (sparse.indices.byteOffset || 0);
        const indicesLength = sparse.count;
        const indices = new indicesType(
          gltf.buffers[indicesBufferView.buffer],
          indicesByteOffset,
          indicesLength
        );

        // Get values
        const valuesByteOffset = (valuesBufferView.byteOffset || 0) + (sparse.values.byteOffset || 0);
        const valuesLength = sparse.count * compcount;
        // @ts-ignore
        const values = new buftype(
          gltf.buffers[valuesBufferView.buffer],
          valuesByteOffset,
          valuesLength
        );

        // Apply sparse values
        for (let j = 0; j < sparse.count; j++) {
          const targetIndex = indices[j];
          for (let k = 0; k < compcount; k++) {
            a.data[targetIndex * compcount + k] = values[j * compcount + k];
          }
        }
        
        continue; // Skip normal accessor processing
      }

      // Skip buffer processing for Draco decoded accessors (they already have data)
      if (a._dracoDecoded) {
        console.log(`✅ Skipping Draco decoded accessor ${i}`)
        continue;
      }

      // Check if bufferView exists
      if (a.bufferView === undefined || a.bufferView === null) {
        console.log(`⚠️ Accessor ${i} has no bufferView, assuming it will be populated by Draco or is unused`)
        continue; // Skip rather than error - will be handled by Draco or is unused
      }

      let bufview = gltf.bufferViews[a.bufferView];
      if (!bufview) {
        console.error(`[ERROR] BufferView ${a.bufferView} not found for accessor ${i}:`, a)
        alert("error: gltf, unhandled bufferView for non-sparse accessor. Accessor index: " + i)
        console.error("error: gltf, unhandled bufferView for non-sparse accessor", a)
        return false; // Critical error
      }

      // Check for case where there is no byteOffset prop, which means byteOffset is 0.
      if (!("byteOffset" in bufview)) bufview.byteOffset = 0
      const accessorByteOffset = a.byteOffset || 0;

      if ("byteStride" in bufview) {
        const stride = bufview.byteStride
        const view = new DataView(gltf.buffers[bufview.buffer])
        // @ts-ignore
        a.data = new buftype(compcount * a.count)
        for (let j = 0; j < a.count; j++) {
          for (let k = 0; k < compcount; k++) {
            // Assuming componentType 5126 (Float32Array) for view.getFloat32
            // Need to handle other types if necessary, though typically vertex data is float.
            // The 'buftype' determines how a.data stores it, but reading from ArrayBuffer needs specific get methods.
            // For simplicity, assuming float for now. If other types are used for positions/normals/etc. this needs adjustment.
            if (buftype === Float32Array) {
              a.data[j * compcount + k] = view.getFloat32(bufview.byteOffset + stride * j + accessorByteOffset + k * Float32Array.BYTES_PER_ELEMENT, true);
            } else if (buftype === Uint16Array) {
               a.data[j * compcount + k] = view.getUint16(bufview.byteOffset + stride * j + accessorByteOffset + k * Uint16Array.BYTES_PER_ELEMENT, true);
            } else if (buftype === Uint8Array) {
               a.data[j * compcount + k] = view.getUint8(bufview.byteOffset + stride * j + accessorByteOffset + k * Uint8Array.BYTES_PER_ELEMENT);
            } else if (buftype === Uint32Array) {
              a.data[j * compcount + k] = view.getUint32(bufview.byteOffset + stride * j + accessorByteOffset + k * Uint32Array.BYTES_PER_ELEMENT, true);
            }
            // Add other types as necessary (Int8, Int16, Int32)
            else {
              console.error("Unsupported buftype in strided accessor:", buftype);
              // Fallback or error
            }
          }
        }
      } else {
        const finalByteOffset = bufview.byteOffset + accessorByteOffset;
        const length = compcount * a.count;
        // @ts-ignore
        a.data = new buftype(gltf.buffers[bufview.buffer], finalByteOffset, length);
      }
    }
    
    return true
  }

  async _processStandardPrimitives(gltf) {
    console.log(`[DEBUG] Processing all primitives (standard + Draco) for material setup`)
    
    for (let i = 0; i < gltf.meshes.length; i++) {
      let m = gltf.meshes[i]
      
      for (let j = 0; j < m.primitives.length; j++) {
        let p = m.primitives[j]
        
        const isDracoPrimitive = !!(p.extensions && p.extensions.KHR_draco_mesh_compression) || p._dracoProcessed
        
        if (isDracoPrimitive) {
          console.log(`🔥 Processing Draco primitive ${i}.${j} for materials`)
          console.log(`🔥 Draco primitive attributes:`, Object.keys(p.attributes))
          console.log(`🔥 Draco primitive indices:`, !!p.indices)
          // Draco primitives already have their geometry decoded, just process materials
          // Their attributes are already accessor objects, not indices
        } else {
          console.log(`📄 Processing standard primitive ${i}.${j}`)
          
          // Standard GLTF primitive processing
          if (p.indices !== undefined) {
            p.indices = gltf.accessors[p.indices]
          }
          
          Object.keys(p.attributes).forEach(function (key) {
            p.attributes[key] = gltf.accessors[p.attributes[key]]
          })

          // For ease of use point directly to the accessor data
          if ("targets" in p) {
            for (let k = 0; k < p.targets.length; k++) {
              Object.keys(p.targets[k]).forEach(function (key) {
                p.targets[k][key] = gltf.accessors[p.targets[k][key]]
              })
            }
          }
        }
        
        // Material processing (common for both Draco and standard)
        if (typeof p.material != "undefined" && p.material != null) {
          p.material = gltf.materials[p.material]
          
          // Set material name to image name with safety checks
          if (p.material.pbrMetallicRoughness && p.material.pbrMetallicRoughness.baseColorTexture) {
            const textureIndex = p.material.pbrMetallicRoughness.baseColorTexture.index
            if (gltf.textures && gltf.textures[textureIndex]) {
              const imageIndex = gltf.textures[textureIndex].source
              if (gltf.images && gltf.images[imageIndex] && gltf.images[imageIndex].name) {
                p.material.name = gltf.images[imageIndex].name
                console.log(`✅ Set material name: ${p.material.name} for primitive ${i}.${j}`)
              } else {
                console.log(`⚠️ Image not found for material, using default name for primitive ${i}.${j}`)
                p.material.name = `material_${i}_${j}`
              }
            } else {
              console.log(`⚠️ Texture not found for material, using default name for primitive ${i}.${j}`) 
              p.material.name = `material_${i}_${j}`
            }
          } else {
            console.log(`⚠️ No baseColorTexture for material, using default name for primitive ${i}.${j}`)
            p.material.name = `material_${i}_${j}`
          }
        }
      }
    }
    
    return true
  }

  // 🎯 EDITOR BYPASS: Process all primitives as standard GLTF (ignore Draco extensions)
  async _processStandardPrimitivesOnly(gltf) {
    console.warn('🚨 EDITOR BYPASS: Processing all primitives as standard GLTF, ignoring Draco extensions')
    
    // First, process ALL accessors (no Draco bypass)
    console.log(`[EDITOR BYPASS] Processing ${gltf.accessors.length} accessors`)
    
    for (let i = 0; i < gltf.accessors.length; i++) {
      let a = gltf.accessors[i]
      
      let buftype = null
      switch (a.componentType) {
        case 5120:
          buftype = Int8Array
          break
        case 5121:
          buftype = Uint8Array
          break
        case 5122:
          buftype = Int16Array
          break
        case 5123:
          buftype = Uint16Array
          break
        case 5125:
          buftype = Uint32Array
          break
        case 5126:
          buftype = Float32Array
          break
        default:
          console.error("error: gltf, unhandled componentType: " + a.componentType + " for accessor " + i);
          return false;
      }
      let compcount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[a.type]
      
      // Handle sparse accessors (copied from _processAccessors)
      if (a.sparse) {
        if (a.bufferView === undefined || a.bufferView === null) {
          a.data = new buftype(compcount * a.count);
        } else {
          let bufview = gltf.bufferViews[a.bufferView];
          if (!bufview) {
            console.error("error: gltf, missing bufferView for base accessor data in sparse accessor");
            return false;
          }
          const byteOffset = (bufview.byteOffset || 0) + (a.byteOffset || 0);
          const elementSize = buftype.BYTES_PER_ELEMENT;
          const length = compcount * a.count;
          a.data = new buftype(gltf.buffers[bufview.buffer], byteOffset, length);
        }

        const sparse = a.sparse;
        const indicesBufferView = gltf.bufferViews[sparse.indices.bufferView];
        const valuesBufferView = gltf.bufferViews[sparse.values.bufferView];
        
        let indicesComponentType = sparse.indices.componentType;
        let indicesType = null;
        switch (indicesComponentType) {
          case 5121: indicesType = Uint8Array; break;
          case 5123: indicesType = Uint16Array; break;
          case 5125: indicesType = Uint32Array; break;
          default: console.error("Unsupported sparse indices componentType: " + indicesComponentType + " for accessor " + i); return false;
        }

        if (!indicesType) {
            console.error("Critical error: indicesType is null after switch, should not happen. Accessor " + i);
            return false;
        }
        
        const indicesByteOffset = (indicesBufferView.byteOffset || 0) + (sparse.indices.byteOffset || 0);
        const indicesLength = sparse.count;
        const indices = new indicesType(
          gltf.buffers[indicesBufferView.buffer],
          indicesByteOffset,
          indicesLength
        );

        const valuesByteOffset = (valuesBufferView.byteOffset || 0) + (sparse.values.byteOffset || 0);
        const valuesLength = sparse.count * compcount;
        const values = new buftype(
          gltf.buffers[valuesBufferView.buffer],
          valuesByteOffset,
          valuesLength
        );

        for (let j = 0; j < sparse.count; j++) {
          const targetIndex = indices[j];
          for (let k = 0; k < compcount; k++) {
            a.data[targetIndex * compcount + k] = values[j * compcount + k];
          }
        }
        
        continue;
      }

      // Check if bufferView exists
      if (a.bufferView === undefined || a.bufferView === null) {
        console.warn(`⚠️ [EDITOR BYPASS] Accessor ${i} has no bufferView, skipping`)
        continue;
      }

      let bufview = gltf.bufferViews[a.bufferView];
      if (!bufview) {
        console.error(`[EDITOR BYPASS ERROR] BufferView ${a.bufferView} not found for accessor ${i}`)
        return false;
      }

      if (!("byteOffset" in bufview)) bufview.byteOffset = 0
      const accessorByteOffset = a.byteOffset || 0;

      if ("byteStride" in bufview) {
        const stride = bufview.byteStride
        const view = new DataView(gltf.buffers[bufview.buffer])
        a.data = new buftype(compcount * a.count)
        for (let j = 0; j < a.count; j++) {
          for (let k = 0; k < compcount; k++) {
            if (buftype === Float32Array) {
              a.data[j * compcount + k] = view.getFloat32(bufview.byteOffset + stride * j + accessorByteOffset + k * Float32Array.BYTES_PER_ELEMENT, true);
            } else if (buftype === Uint16Array) {
               a.data[j * compcount + k] = view.getUint16(bufview.byteOffset + stride * j + accessorByteOffset + k * Uint16Array.BYTES_PER_ELEMENT, true);
            } else if (buftype === Uint8Array) {
               a.data[j * compcount + k] = view.getUint8(bufview.byteOffset + stride * j + accessorByteOffset + k * Uint8Array.BYTES_PER_ELEMENT);
            } else if (buftype === Uint32Array) {
              a.data[j * compcount + k] = view.getUint32(bufview.byteOffset + stride * j + accessorByteOffset + k * Uint32Array.BYTES_PER_ELEMENT, true);
            }
          }
        }
      } else {
        const finalByteOffset = bufview.byteOffset + accessorByteOffset;
        const length = compcount * a.count;
        a.data = new buftype(gltf.buffers[bufview.buffer], finalByteOffset, length);
      }
    }
    
    // Now process ALL primitives as standard GLTF (ignore Draco extensions)
    console.warn(`[EDITOR BYPASS] Processing ${gltf.meshes.length} meshes with standard GLTF processing`)
    
    for (let i = 0; i < gltf.meshes.length; i++) {
      let m = gltf.meshes[i]
      
      for (let j = 0; j < m.primitives.length; j++) {
        let p = m.primitives[j]
        
        // Remove Draco extension if it exists (force standard processing)
        if (p.extensions && p.extensions.KHR_draco_mesh_compression) {
          console.warn(`🚨 [EDITOR BYPASS] Removing Draco extension from primitive ${i}.${j}, forcing standard GLTF processing`)
          delete p.extensions.KHR_draco_mesh_compression
          if (Object.keys(p.extensions).length === 0) {
            delete p.extensions
          }
        }
        
        // Standard GLTF primitive processing
        if (p.indices !== undefined) {
          p.indices = gltf.accessors[p.indices]
        }
        
        Object.keys(p.attributes).forEach(function (key) {
          p.attributes[key] = gltf.accessors[p.attributes[key]]
        })

        if ("targets" in p) {
          for (let k = 0; k < p.targets.length; k++) {
            Object.keys(p.targets[k]).forEach(function (key) {
              p.targets[k][key] = gltf.accessors[p.targets[k][key]]
            })
          }
        }
        
        // Material processing
        if (typeof p.material != "undefined" && p.material != null) {
          p.material = gltf.materials[p.material]
          
          if (p.material.pbrMetallicRoughness && p.material.pbrMetallicRoughness.baseColorTexture) {
            const textureIndex = p.material.pbrMetallicRoughness.baseColorTexture.index
            if (gltf.textures && gltf.textures[textureIndex]) {
              const imageIndex = gltf.textures[textureIndex].source
              if (gltf.images && gltf.images[imageIndex] && gltf.images[imageIndex].name) {
                p.material.name = gltf.images[imageIndex].name
              } else {
                p.material.name = `material_${i}_${j}`
              }
            } else {
              p.material.name = `material_${i}_${j}`
            }
          } else {
            p.material.name = `material_${i}_${j}`
          }
        }
        
        console.log(`✅ [EDITOR BYPASS] Processed primitive ${i}.${j} as standard GLTF`)
      }
    }
    
    console.warn('✅ EDITOR BYPASS: Successfully processed all primitives as standard GLTF')
    return true
  }

  getOrCreateModelBoneUbo(renderer) {
    if (!this.bonesPerModelAsset) {
        return null;
    }

    const effectiveRenderer = renderer || this.rendererForUbo;

    if (!effectiveRenderer) {
        return null; 
    }
    
    const gl = effectiveRenderer._gl;
    if (!gl) {
        return null; 
    }

    if (!this.sharedModelBoneUbo) {
        const uboSize = SHADER_MAX_BONES * 16 * 4; // Use defined constant for UBO size

        this.sharedModelBoneUbo = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.sharedModelBoneUbo);
        gl.bufferData(gl.UNIFORM_BUFFER, uboSize, gl.DYNAMIC_DRAW); 
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        console.log(`Created shared Bone UBO for model: ${this.gltf?.asset?.extras?.originalFileName || 'Unknown Model'}, Shader Max Bones: ${SHADER_MAX_BONES}, Size: ${uboSize} bytes, Actual Model Bones: ${this.bonesPerModelAsset}`);
    }
    return this.sharedModelBoneUbo;
  }
}

// @ts-ignore
if (!globalThis.GltfData) {
  // @ts-ignore
  globalThis.GltfData = GltfData
}
