// @ts-check
"use strict"

class GltfData {
  constructor(runtime, sdkType) {
    this._runtime = runtime
    this._sdkType = sdkType
    this.gltf = {}
    this.dynamicTexturesLoaded = false
    this.imageBitmap = {}
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
  }

  /*
	Requests an url as a json file, then does some processing on that, and finally calls a js or c2 function.
	Expects an "embeded" gltf file.
    */
  async load(gltfPath, isRuntime, debug) {
    let runtime = this._runtime
    let sdkType = this._sdkType

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

    // accessors
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
          console.error("error: gltf, unhandled componentType")
      }
      let compcount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[a.type]
      
      // Handle sparse accessors
      if (a.sparse) {
        // Create base data array if no bufferView
        if (!a.bufferView) {
          // @ts-ignore
          a.data = new buftype(compcount * a.count);
          // Fill with zeros or default values if specified
          if (a.normalized) {
            a.data.fill(0);
          }
        } else {
          // Load base data as normal
          let bufview = gltf.bufferViews[a.bufferView];
          if (!bufview) {
            console.error("error: gltf, missing bufferView for base accessor data");
            return;
          }
          // @ts-ignore
          a.data = new buftype(gltf.buffers[bufview.buffer], 
            (bufview.byteOffset || 0) + (a.byteOffset || 0), 
            compcount * a.count);
        }

        // Process sparse values
        const sparse = a.sparse;
        const indicesBufferView = gltf.bufferViews[sparse.indices.bufferView];
        const valuesBufferView = gltf.bufferViews[sparse.values.bufferView];
        
        // Get indices
        let indicesType = null;
        switch (sparse.indices.componentType) {
          case 5121: indicesType = Uint8Array; break;
          case 5123: indicesType = Uint16Array; break;
          case 5125: indicesType = Uint32Array; break;
          default: console.error("Unsupported sparse indices type"); return;
        }
        
        const indices = new indicesType(
          gltf.buffers[indicesBufferView.buffer],
          (indicesBufferView.byteOffset || 0) + (sparse.indices.byteOffset || 0),
          sparse.count
        );

        // Get values
        // @ts-ignore
        const values = new buftype(
          gltf.buffers[valuesBufferView.buffer],
          (valuesBufferView.byteOffset || 0) + (sparse.values.byteOffset || 0),
          sparse.count * compcount
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

      let bufview = gltf.bufferViews[a.bufferView];
      if (!bufview) {
        alert("error: gltf, unhandled bufferView, try exporting gltf without using sparse accessors")
        console.error("error: gltf, unhandled bufferView", a)
        return
      }

      // Check for case where there is no byteOffset prop, which means byteOffset is 0.
      if (!("byteOffset" in bufview)) bufview.byteOffset = 0

      if ("byteStride" in bufview) {
        const stride = bufview.byteStride
        const offset = a.byteOffset || 0
        const view = new DataView(gltf.buffers[bufview.buffer])
        // @ts-ignore
        a.data = new buftype(compcount * a.count)
        for (let j = 0; j < a.count; j++) {
          for (let k = 0; k < compcount; k++) {
            a.data[j * compcount + k] = view.getFloat32(bufview.byteOffset + stride * j + offset + k * 4, true)
          }
        }
      } else {
        // @ts-ignore
        a.data = new buftype(gltf.buffers[bufview.buffer], bufview.byteOffset, compcount * a.count)
      }
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

    //meshes
    for (let i = 0; i < gltf.meshes.length; i++) {
      let m = gltf.meshes[i]
      for (let j = 0; j < m.primitives.length; j++) {
        let p = m.primitives[j]

        p.indices = gltf.accessors[p.indices]
        if (typeof p.material != "undefined" && p.material != null) {
          p.material = gltf.materials[p.material]
          // Set material name to image name
          // Might be redundant, but it's a good idea to have a name for the material
          const hasTexture = "baseColorTexture" in p.material.pbrMetallicRoughness
          if (hasTexture) {
            const textureIndex = p.material.pbrMetallicRoughness.baseColorTexture.index
            const imageIndex = gltf.textures[textureIndex].source
            p.material.name = gltf.images[imageIndex].name
          }
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
    }

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
}

// @ts-ignore
if (!globalThis.GltfData) {
  // @ts-ignore
  globalThis.GltfData = GltfData
}
