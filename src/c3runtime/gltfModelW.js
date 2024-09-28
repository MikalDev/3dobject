// @ts-check
"use strict"
// @ts-ignore
const BoneBufferW = globalThis.BoneBuffer
// @ts-ignore
const ObjectBufferW = globalThis.ObjectBuffer

class GltfModelWTop {
  constructor(runtime, sdkType, inst) {
    const mat4 = globalThis.glMatrix3D.mat4
    this._runtime = runtime
    this._sdkType = sdkType
    this.inst = inst
    this.gltfData = {}
    this._blendState = "init"
    this._lastTarget = []
    this._blendTarget = []
    this._blendTime = 0
    this._lastIndex = 0
    this.drawMeshes = []
    this.drawMeshesIndex = 0
    this.currentColor = [-1, -1, -1, -1]
    this.nodeMeshMap = {}
    this.modelRotate = mat4.create()
    this.normalMatrix = mat4.create()
    this.locANormalMatrix = null
    this.meshNames = new Map()
    this.msgPort = null
    this.arrayBufferIndex = 0
    this.buff = null
    this.verts = new Float32Array(0)
    this.bones = new Float32Array(0)
    this.updateDrawVerts = false
    this.activeNodes = []
    this.drawLights = new Uint32Array(0)
    this.drawLightsBufferViews = null
    this.drawLightsEnable = false
    this.workerReady = false
    this.boundingBoxInit = false
    this.maxBones = 50
    this.boneBufferViews = []
  }

  release() {
    if (this.msgPort) {
      this.msgPort.postMessage({ type: "release" })
      this.msgPort.onmessage = null
      this.msgPort.close()
    }
    this._runtime = null
    this._sdkType = null
    this.inst = null
    // @ts-ignore
    this.gltfData = null
    // @ts-ignore
    this._blendState = null
    // @ts-ignore
    this._lastTarget = null
    // @ts-ignore
    this._blendTarget = null
    // @ts-ignore
    this._blendTime = null
    // @ts-ignore
    this._lastIndex = null
    // @ts-ignore
    for (let ii = 0; ii < this.drawMeshes.length; ii++) {
      for (let jj = 0; jj < this.drawMeshes[ii].objectBuffers.length; jj++) {
        this.drawMeshes[ii].objectBuffers[jj].release()
      }
    }
    // @ts-ignore
    this.drawMeshes = null
    // @ts-ignore
    this.drawMeshesIndex = null
    // @ts-ignore
    this.currentColor = null
    // @ts-ignore
    this.nodeMeshMap = null
    this.modelRotate = null
    // @ts-ignore
    this.meshNames = null
    this.msgPort = null
    // @ts-ignore
    this.arrayBufferIndex = null
    this.buff = null
    // @ts-ignore
    this.verts = null
    // @ts-ignore
    this.updateDrawVerts = null
    // @ts-ignore
    this.activeNodes = null
  }

  createBoneBufferViews() {
    // Iterate through all nodes
    const MATRIX_SIZE = 16
    const boneBufferViews = this.boneBufferViews
    let bufferIndex = 0
    // Unskinned nodes with mesh
    for (let node of this.gltfData.nodes) {
      // Check if the node has a mesh and is not a skinned mesh
      if (node.mesh && !node.skin) {
        // Set the bufferView start to the current bufferCounter index
        boneBufferViews.push({ start: bufferIndex, length: MATRIX_SIZE })
        bufferIndex += MATRIX_SIZE
      }
    }
    // Iterate through all skinned nodes
    for (let skinnedNode of this.gltfData.skinnedNodes) {
      // Create a bufferView for each skinned node
      // Add additional matrix for rootNodeXform matrix
      boneBufferViews.push({ start: bufferIndex, length: (skinnedNode.skin.joints.length + 1) * MATRIX_SIZE })
      bufferIndex += (skinnedNode.skin.joints.length + 1) * MATRIX_SIZE
    }
  }

  async init() {
    // Deep copy
    // For instance version, may only need points, others remain stable, full copy for now
    this._sdkType.gltfData.gltf.buffers = null
    this.gltfData = await this.structuralClone(this._sdkType.gltfData.gltf)
    if ("buffers" in this.gltfData) {
      this.gltfData.buffers = null
    }
    if ("imageBitmap" in this.gltfData) {
      this.gltfData.imageBitmap = null
    }
    // Create node mesh map
    for (let ii = 0; ii < this.gltfData.nodes.length; ii++) {
      let node = this.gltfData.nodes[ii]
      if (!node.mesh) continue
      this.nodeMeshMap[node.name] = node.mesh.name
    }
    // Create dedicdated web worker for skinned mesh animation
    this.initDrawMeshes()
    this.drawMeshesMin = this.drawMeshes
    this.createBoneBufferViews()
    await this.createWorker(this._runtime)
    this.workerReady = true
    this.getPolygons(this.inst.gpuSkinning)
  }

  initDrawMeshes() {
    // For each mesh, create a drawMesh and initialize with UV, indices, name and material
    const gltf = this.gltfData
    this.drawMeshesIndex = -1
    // update all scene meshes, except skinned meshes
    for (let i = 0; i < gltf.scene.nodes.length; i++) {
      this.scanNode(gltf.scene.nodes[i], false)
    }
    // skinned nodes
    for (let ii = 0; ii < gltf.skinnedNodes.length; ii++) {
      this.scanNode(gltf.skinnedNodes[ii], true)
    }
  }

  transformDrawVerts(drawVerts, modelScaleRotate) {
    const vec3 = globalThis.glMatrix3D.vec3
    // Transform drawVerts in place
    const xformVerts = []
    const vOut = vec3.create()
    for (let i = 0; i < drawVerts.length; i++) {
      const v = drawVerts[i]
      const xform = []
      for (let j = 0; j < v.length; j += 3) {
        const x = v[j]
        const y = v[j + 1]
        const z = v[j + 2]
        vec3.set(vOut, x, y, z)

        vec3.transformMat4(vOut, vOut, modelScaleRotate)
        // v[j] = vOut[0];
        // v[j + 1] = vOut[1];
        // v[j + 2] = vOut[2];
        xform.push(vOut[0], vOut[1], vOut[2])
      }
      xformVerts.push(xform)
    }
    return xformVerts
  }

  scanNode(node, scanSkin, gpuSkinning) {
    gpuSkinning = true
    if ((node.mesh != undefined && node.skin == undefined) || scanSkin) {
      for (let i = 0; i < node.mesh.primitives.length; i++) {
        let posDataLength = node.mesh.primitives[i].attributes.POSITION.data.length
        this.drawMeshesIndex++
        if (!this.drawMeshes[this.drawMeshesIndex]) {
          this.drawMeshes.push({
            drawVerts: [],
            drawVertsOrig: [],
            bufferViews: [],
            drawUVs: [],
            drawIndices: [],
            drawColors: [],
            drawNormals: [],
            drawBones: [],
            drawJoints: [],
            drawWeights: [],
            disabled: false,
            objectBuffers: [],
          })
        }
        this.drawMeshes[this.drawMeshesIndex].node = node
        this.drawMeshes[this.drawMeshesIndex].bufferViews.push({ start: this.arrayBufferIndex, length: posDataLength })
        this.arrayBufferIndex += posDataLength
        this.meshNames.set(node.name, this.drawMeshesIndex)
        this.drawMeshes[this.drawMeshesIndex].disabled = node.disabled
        if (node.offsetUV) this.drawMeshes[this.drawMeshesIndex].offsetUV = node.offsetUV
        if ("material" in node.mesh.primitives[i]) {
          this.drawMeshes[this.drawMeshesIndex].material = node.mesh.primitives[i].material
        } else {
          this.drawMeshes[this.drawMeshesIndex].material = null
        }

        const drawUVs = this.drawMeshes[this.drawMeshesIndex].drawUVs
        const drawIndices = this.drawMeshes[this.drawMeshesIndex].drawIndices
        const drawColors = this.drawMeshes[this.drawMeshesIndex].drawColors
        const drawNormals = this.drawMeshes[this.drawMeshesIndex].drawNormals
        const drawJoints = this.drawMeshes[this.drawMeshesIndex].drawJoints
        const drawWeights = this.drawMeshes[this.drawMeshesIndex].drawWeights
        const drawVertsOrig = this.drawMeshes[this.drawMeshesIndex].drawVertsOrig

        if (drawUVs.length === 0 && "TEXCOORD_0" in node.mesh.primitives[i].attributes) {
          drawUVs.push(new Float32Array(node.mesh.primitives[i].attributes.TEXCOORD_0.data))
        }
        if (gpuSkinning && drawVertsOrig.length === 0 && "POSITION" in node.mesh.primitives[i].attributes) {
          drawVertsOrig.push(new Float32Array(node.mesh.primitives[i].attributes.POSITION.data))
        }
        if (drawColors.length === 0 && "COLOR_0" in node.mesh.primitives[i].attributes) {
          drawColors.push(new Float32Array(node.mesh.primitives[i].attributes.COLOR_0.data))
        }
        if (drawNormals.length === 0 && "NORMAL" in node.mesh.primitives[i].attributes) {
          drawNormals.push(new Float32Array(node.mesh.primitives[i].attributes.NORMAL.data))
        }
        if (gpuSkinning && drawJoints.length === 0 && "JOINTS_0" in node.mesh.primitives[i].attributes) {
          drawJoints.push(new Uint16Array(node.mesh.primitives[i].attributes.JOINTS_0.data))
        }
        if (gpuSkinning && drawWeights.length === 0 && "WEIGHTS_0" in node.mesh.primitives[i].attributes) {
          drawWeights.push(new Float32Array(node.mesh.primitives[i].attributes.WEIGHTS_0.data))
        }
        if (drawIndices.length === 0) drawIndices.push(new Uint16Array(node.mesh.primitives[i].indices.data))
      }
    }
    if (node.children) {
      for (let ii = 0; ii < node.children.length; ii++) {
        this.scanNode(node.children[ii])
      }
    }
  }

  async createWorker(runtime) {
    // Create the worker with the runtime.createWorker() method.
    // This must be awaited and resolves with a messagePort.
    let path = await runtime.GetAssetManager().GetProjectFileUrl("gltfWorker.js")
    this.msgPort = await runtime._iRuntime.createWorker(path)
    // Add an onmessage handler to receive message
    this.msgPort.onmessage = (e) => {
      if (!e.data.type) {
        this.activeNodes = e.data.activeNodes
        const gpuSkinning = this.inst.gpuSkinning
        if (!gpuSkinning) {
          this.buff = e.data.buff
          this.verts = new Float32Array(this.buff)
          if (e.data.lightUpdate) {
            this.buffLights = e.data.buffLights
            this.drawLights = new Uint32Array(this.buffLights)
            this.drawLightsBufferViews = e.data.drawLightsBufferViews
          }
          this.drawLightsEnable = e.data.drawLightsEnable
          this.setBBFromVerts(this.verts, this.inst.minBB, this.inst.maxBB)
          this.inst.updateBbox = true
          this.updateDrawVerts = true
          this.typedVertsToDrawVerts(this.inst.staticGeometry)
        } else {
          this.buff = e.data.buff
          this.buffBones = e.data.buffBones
          this.buffNodesMat = e.data.buffNodeMats
          this.nodesMat = new Float32Array(this.buffNodesMat)
          this.bones = new Float32Array(this.buffBones)
          // this.setBBFromVerts(this.verts, this.inst.minBB, this.inst.maxBB)
          const x = this.inst.isEditor ? this.inst._inst.GetX() : this.inst.GetWorldInfo().GetX()
          const y = this.inst.isEditor ? this.inst._inst.GetY() : this.inst.GetWorldInfo().GetY()
          const z = this.inst.isEditor ? this.inst._inst.GetZElevation() : this.inst.GetWorldInfo().GetZElevation()
          this.inst.minBB = [-10000 + x, -10000 + y, -10000 + z]
          this.inst.maxBB = [10000 + x, 10000 + y, 10000 + z]
          this.inst.updateBbox = true
          this.updateDrawVerts = true
          this.typedBonesToDrawBones()
        }
        this.workerReady = true
        if (!this.boundingBoxInit) {
          this.inst.initBoundingBox()
          this.boundingBoxInit = true
        }
      } else if (e.data.type === "status") {
        this.buff = e.data.buff
        if (e.data?.status?.workerReady) {
          this.workerReady = true
        }
      } else {
        if (this.inst.debug) console.debug("onMsg t:", runtime.GetTickCount(), e.data.type)
      }
    }
    // Send the gltfModel to the worker
    const bufferViews = this.drawMeshes[this.drawMeshes.length - 1].bufferViews
    const buffLength = bufferViews[bufferViews.length - 1].start + bufferViews[bufferViews.length - 1].length
    this.buff = new ArrayBuffer((buffLength + 7) * 4)
    const buffBonesLength =
      this.boneBufferViews[this.boneBufferViews.length - 1].start +
      this.boneBufferViews[this.boneBufferViews.length - 1].length
    this.msgPort.postMessage({
      type: "gltf",
      gltf: this.gltfData,
      buffLength: buffLength,
      drawMeshes: this.drawMeshes,
      buffBonesLength,
    })
    return { msgPort: this.msgPort }
  }

  enableNode(nodeName, enable) {
    this.msgPort.postMessage({ type: "enableNode", nodeName: nodeName, enable: enable })
  }

  setNodeMorphWeight(nodeName, index, weight) {
    this.msgPort.postMessage({ type: "setNodeMorphWeight", nodeName, index, weight })
  }

  deleteNodeMorphWeight(nodeName, index) {
    this.msgPort.postMessage({ type: "deleteNodeMorphWeight", nodeName, index })
  }

  setBBFromVerts(verts, minBBox, maxBBox) {
    let l = verts.length - 2
    maxBBox[2] = verts[l--]
    maxBBox[1] = verts[l--]
    maxBBox[0] = verts[l--]
    minBBox[2] = verts[l--]
    minBBox[1] = verts[l--]
    minBBox[0] = verts[l--]
  }

  structuralClone(obj) {
    return new Promise((resolve) => {
      const { port1, port2 } = new MessageChannel()
      port2.onmessage = (ev) => resolve(ev.data)
      port1.postMessage(obj)
    })
  }

  _ExtendQuadsBatch(renderer, numQuads) {
    let v = renderer._vertexPtr
    if (v + numQuads * 4 * 3 > renderer._lastVertexPtr) {
      renderer.EndBatch()
      v = 0
    }
    const totalIndices = numQuads * 6 // Each quad requires 6 indices (two tris)
    if (renderer._topOfBatch === 1) {
      renderer._batch[renderer._batchPtr - 1]._indexCount += totalIndices
    } else {
      const b = renderer.PushBatch()
      b.InitQuad(v, totalIndices)
      renderer._topOfBatch = 1
    }
  }

  _cullPoint(cameraPos, cameraDir, point) {
    const vec3 = globalThis.glMatrix3D.vec3
    const vec4 = globalThis.glMatrix3D.vec4
    const mat4 = globalThis.glMatrix3D.mat4
    const quat = globalThis.glMatrix3D.quat
    // Find angle between vector of camera pos to point and camera dir
    // Create a new vector for the result of the subtraction
    let direction = vec3.create()
    vec3.subtract(direction, point, cameraPos) // Subtract cameraPos from point, store in direction

    // Calculate the angle between cameraDir and the new direction vector
    const angle = vec3.angle(cameraDir, direction)
    if (angle > 90) return false
    // Find distance from camera pos to point
    const distance = vec3.distance(cameraPos, point)
    if (distance > 1000) return false
    return true
  }

  setVertexShaderModelRotate(renderer, modelRotate) {
    const gl = renderer._gl
    const batchState = renderer._batchState
    const shaderProgram = batchState.currentShader._shaderProgram
    const locUModelRotate = gl.getUniformLocation(shaderProgram, "uModelRotate")
    const locUModelRotateEnable = gl.getUniformLocation(shaderProgram, "uModelRotateEnable")
    gl.uniformMatrix4fv(locUModelRotate, false, modelRotate)
    gl.uniform1f(locUModelRotateEnable, 1)
  }

  disableVertexShaderModelRotate(renderer) {
    const gl = renderer._gl
    if (!this.locuModelRotateEnable) {
      const batchState = renderer._batchState
      const shaderProgram = batchState.currentShader._shaderProgram
      this.locuModelRotateEnable = gl.getUniformLocation(shaderProgram, "uModelRotateEnable")
    }
    gl.uniform1f(this.locuModelRotateEnable, 0)
  }

  _disableGPUSkinning(renderer) {
    const gl = renderer._gl
    const shaderProgram = renderer._batchState.currentShader._shaderProgram
    if (!this.locUSkinEnable) this.locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable")
    if (!this.locUNodeXformEnable) this.locUNodeXformEnable = gl.getUniformLocation(shaderProgram, "uNodeXformEnable")
    if (this.locUNodeXformEnable == -1 || this.locUSkinEnable == -1) {
      console.error("locUNodeXformEnable == -1", this.locUNodeXformEnable)
      console.error("locUSkinEnable == -1", this.locUSkinEnable)
    }
    gl.uniform1f(this.locUSkinEnable, 0.0)
    gl.uniform1f(this.locUNodeXformEnable, 0.0)
  }

  render(renderer, x, y, z, tempQuad, whiteTexture, instanceC3Color, textures, instanceTexture, opacity) {
    if (opacity === 0) return
    renderer.EndBatch()
    let currentColor = [-1, -1, -1, -1]
    let currentTexture = null
    const rendererVertexData = renderer._vertexData
    const rendererTexcoordData = renderer._texcoordData

    if (this.drawMeshes.length == 0) {
      console.warn("gltfModelW: No drawMeshes")
      return
    }

    const vec4 = globalThis.glMatrix3D.vec4
    const vec2 = globalThis.glMatrix3D.vec2
    const mat2 = globalThis.glMatrix3D.mat2
    const mat4 = globalThis.glMatrix3D.mat4
    const quat = globalThis.glMatrix3D.quat
    const vertexScale = this.inst.vertexScale
    let totalTriangles = 0
    let totalTrianglesCulled = 0

    let xWireframeWidth, yWireframeWidth, zWireframeWidth

    if (this.inst.wireframe) {
      const xScale = this.inst.scale / (this.inst.xScale == 0 ? 1 : this.inst.xScale)
      const yScale = this.inst.scale / (this.inst.yScale == 0 ? 1 : this.inst.yScale)
      const zScale = this.inst.scale / (this.inst.zScale == 0 ? 1 : this.inst.zScale)

      xWireframeWidth = this.inst.isEditor ? this.inst.xWireframeWidth : this.inst.xWireframeWidth / xScale
      yWireframeWidth = this.inst.isEditor ? this.inst.yWireframeWidth : this.inst.yWireframeWidth / yScale
      zWireframeWidth = this.inst.isEditor ? this.inst.zWireframeWidth : this.inst.zWireframeWidth / zScale
    }

    const instanceColor = [
      instanceC3Color.getR(),
      instanceC3Color.getG(),
      instanceC3Color.getB(),
      instanceC3Color.getA(),
    ]
    const finalColor = vec4.create()

    const tmpModelView = mat4.create()
    const tmpProjection = mat4.create()
    const modelRotate = mat4.create()
    if (!(this.inst.isEditor || this.inst.cpuXform)) {
      mat4.copy(tmpModelView, renderer._matMV)
      const xAngle = this.inst.xAngle
      const yAngle = this.inst.yAngle
      const zAngle = this.inst.zAngle
      const xScale = this.inst.scale / (this.inst.xScale == 0 ? 1 : this.inst.xScale)
      const yScale = this.inst.scale / (this.inst.yScale == 0 ? 1 : this.inst.yScale)
      const zScale = this.inst.scale / (this.inst.zScale == 0 ? 1 : this.inst.zScale)
      const rotate = quat.create()
      if (this.inst.cannonBody && this.inst.cannonSetRotation) {
        quat.set(
          rotate,
          this.inst.cannonBody.quaternion.x,
          this.inst.cannonBody.quaternion.y,
          this.inst.cannonBody.quaternion.z,
          this.inst.cannonBody.quaternion.w
        )
      } else if (this.inst.enableQuaternion) {
        quat.copy(rotate, this.inst.quaternion)
      } else {
        quat.fromEuler(rotate, xAngle, yAngle, zAngle)
      }
      mat4.fromRotationTranslationScale(modelRotate, rotate, [x, y, z], [xScale, -yScale, zScale])
      mat4.copy(this.modelRotate, modelRotate)
      // Create inverse transpose normal matrix from modelRotate
      if (this.inst.normalVertex) {
        mat4.invert(this.normalMatrix, modelRotate)
        mat4.transpose(this.normalMatrix, this.normalMatrix)
      }
      mat4.multiply(modelRotate, tmpModelView, modelRotate)
      renderer.SetModelViewMatrix(modelRotate)
      this.setVertexShaderModelRotate(renderer, this.modelRotate)
    }

    // Default color
    vec4.copy(currentColor, instanceColor)
    let baseColorChanged = false
    if (!vec4.equals(currentColor, [1, 1, 1, 1])) baseColorChanged = true

    if (this.updateDrawVerts) {
      this.updateDrawVerts = false
    }
    if (this.inst.staticGeometry) {
      renderer.EndBatch()
      renderer._vertexPtr = 0
      renderer._texPtr = 0
    }
    for (let j = 0; j <= this.drawMeshesIndex; j++) {
      let lightIndex, drawLightsBufferView
      if (this.drawLightsEnable) {
        drawLightsBufferView = this.drawLightsBufferViews[j]
        lightIndex = drawLightsBufferView.start
      }

      // Skip render if disabled
      if (this.drawMeshes[j].disabled) continue

      if (this.inst.gpuSkinning && !this.drawMeshes[j].boneBuffer) {
        this.drawMeshes[j].boneBuffer = this.drawMeshes[j].node.boneBuffer
      }

      const drawVerts = this.drawMeshes[j].drawVerts
      const drawUVs = this.drawMeshes[j].drawUVs
      const drawIndices = this.drawMeshes[j].drawIndices
      const material = this.drawMeshes[j].material
      const hasTexture =
        material && "pbrMetallicRoughness" in material && "baseColorTexture" in material.pbrMetallicRoughness
      const offsetUV = this.drawMeshes[j].offsetUV
      const materialsModify = this.inst.materialsModify
      const offsetMaterial = materialsModify.has(material?.name) && materialsModify.get(material?.name)?.offsetUV
      const rotateMaterial = materialsModify.has(material?.name) && materialsModify.get(material?.name)?.rotateUV

      let color
      if (material && "pbrMetallicRoughness" in material && "baseColorFactor" in material.pbrMetallicRoughness) {
        color = material.pbrMetallicRoughness.baseColorFactor
      } else {
        color = null
      }
      if (color && color.length == 4) {
        color[3] = 1
        vec4.multiply(finalColor, instanceColor, color)
        if (vec4.equals(finalColor, currentColor) == false) {
          vec4.copy(currentColor, finalColor)
          renderer.SetColorRgba(finalColor[0], finalColor[1], finalColor[2], finalColor[3])
          baseColorChanged = true
        }
      }

      if (!instanceTexture) {
        if (!hasTexture) {
          if (currentTexture != whiteTexture) {
            renderer.SetTexture(whiteTexture)
            currentTexture = whiteTexture
          }
        } else {
          const texture = textures[material.name]
          // If texture is not loaded, skip rendering
          if (!texture) continue
          if (texture != currentTexture) {
            renderer.SetTexture(texture)
            currentTexture = texture
          }
        }
      }

      let rotateMatrix

      if (rotateMaterial) {
        const rotateUV = materialsModify.get(material.name)?.rotateUV
        // Create rotate matrix
        rotateMatrix = mat2.create()
        mat2.fromRotation(rotateMatrix, rotateUV.angle)
      }

      let xVerts
      if (this.inst.fragLight && this.inst.isWebGPU) {
        xVerts = this.transformDrawVerts(drawVerts, this.modelRotate)
      } else {
        xVerts = drawVerts
      }

      if (this.inst.staticGeometry || this.inst.gpuSkinning) {
        const objectBuffers = this.drawMeshes[j].objectBuffers
        // Draw
        let boneBuffer
        for (let i = 0; i < objectBuffers.length; i++) {
          const nodeXform = this.drawMeshes[j]?.boneBuffer?.nodeXform
          if (nodeXform) {
            objectBuffers[i].setNodeXform(nodeXform)
          }
        }
        boneBuffer = this.drawMeshes[j]?.boneBuffer
        for (let i = 0; i < objectBuffers.length; i++) {
          boneBuffer = this.drawMeshes[j]?.boneBuffer
          this.setVertexShaderModelRotate(renderer, this.modelRotate)
          objectBuffers[i].draw(renderer, boneBuffer, rotateMaterial, offsetMaterial, this.inst.fragLightPhong)
          totalTriangles += objectBuffers[i].indexDataLength / 3
        }
        // XXX Perhaps too often, once per mesh, better to do once per model
        if (boneBuffer) {
          boneBuffer.disable(renderer)
        }
        continue
      }

      for (let ii = 0; ii < drawVerts.length; ii++) {
        let v = xVerts[ii]
        let uv = drawUVs[ii]
        let ind = drawIndices[ii]

        let triangleCount = ind.length / 3
        let center = [0, 0, 0]
        totalTriangles += triangleCount
        for (let i = 0; i < triangleCount; i++) {
          if (this.drawLightsEnable && this.inst.backFaceCull) {
            const c = this.unpackRGBA(this.drawLights[lightIndex])
            if (c[3] == 0) {
              lightIndex++
              totalTrianglesCulled++
              continue
            }
          }

          if (hasTexture) {
            if (offsetMaterial || rotateMaterial) {
              // create new arrays for the UVs
              const uvQuad = [
                [uv[ind[i * 3 + 0] * 2 + 0], uv[ind[i * 3 + 0] * 2 + 1]],
                [uv[ind[i * 3 + 1] * 2 + 0], uv[ind[i * 3 + 1] * 2 + 1]],
                [uv[ind[i * 3 + 2] * 2 + 0], uv[ind[i * 3 + 2] * 2 + 1]],
              ]
              if (rotateMaterial) {
                // Rotate UVs
                vec2.sub(uvQuad[0], uvQuad[0], [rotateMaterial.x, rotateMaterial.y])
                vec2.sub(uvQuad[1], uvQuad[1], [rotateMaterial.x, rotateMaterial.y])
                vec2.sub(uvQuad[2], uvQuad[2], [rotateMaterial.x, rotateMaterial.y])
                mat2.multiply(uvQuad[0], rotateMatrix, uvQuad[0])
                mat2.multiply(uvQuad[1], rotateMatrix, uvQuad[1])
                mat2.multiply(uvQuad[2], rotateMatrix, uvQuad[2])
                vec2.add(uvQuad[0], uvQuad[0], [rotateMaterial.x, rotateMaterial.y])
                vec2.add(uvQuad[1], uvQuad[1], [rotateMaterial.x, rotateMaterial.y])
                vec2.add(uvQuad[2], uvQuad[2], [rotateMaterial.x, rotateMaterial.y])
              }

              if (offsetMaterial) {
                const uOffset = offsetMaterial.u
                const vOffset = offsetMaterial.v
                // Offset UVs in uvQuad
                uvQuad[0][0] += uOffset
                uvQuad[0][1] += vOffset
                uvQuad[1][0] += uOffset
                uvQuad[1][1] += vOffset
                uvQuad[2][0] += uOffset
                uvQuad[2][1] += vOffset
              }
              // Set tempquad
              tempQuad.set(
                uvQuad[0][0],
                uvQuad[0][1],
                uvQuad[1][0],
                uvQuad[1][1],
                uvQuad[2][0],
                uvQuad[2][1],
                uvQuad[2][0],
                uvQuad[2][1]
              )
            } else if (offsetUV) {
              const uOffset = offsetUV.u
              const vOffset = offsetUV.v
              tempQuad.set(
                uv[ind[i * 3 + 0] * 2 + 0] + uOffset,
                uv[ind[i * 3 + 0] * 2 + 1] + vOffset,
                uv[ind[i * 3 + 1] * 2 + 0] + uOffset,
                uv[ind[i * 3 + 1] * 2 + 1] + vOffset,
                uv[ind[i * 3 + 2] * 2 + 0] + uOffset,
                uv[ind[i * 3 + 2] * 2 + 1] + vOffset,
                uv[ind[i * 3 + 2] * 2 + 0] + uOffset,
                uv[ind[i * 3 + 2] * 2 + 1] + vOffset
              )
            } else {
              tempQuad.set(
                uv[ind[i * 3 + 0] * 2 + 0],
                uv[ind[i * 3 + 0] * 2 + 1],
                uv[ind[i * 3 + 1] * 2 + 0],
                uv[ind[i * 3 + 1] * 2 + 1],
                uv[ind[i * 3 + 2] * 2 + 0],
                uv[ind[i * 3 + 2] * 2 + 1],
                uv[ind[i * 3 + 2] * 2 + 0],
                uv[ind[i * 3 + 2] * 2 + 1]
              )
            }
          } else {
            // Set face to color if possible
            tempQuad.set(0, 0, 1, 0, 0, 1, 0, 1)
          }

          let i3 = i * 3
          let x0, y0, z0, x1, y1, z1, x2, y2, z2

          x0 = v[ind[i3 + 0] * 3 + 0]
          y0 = v[ind[i3 + 0] * 3 + 1]
          z0 = v[ind[i3 + 0] * 3 + 2] - z
          x1 = v[ind[i3 + 1] * 3 + 0]
          y1 = v[ind[i3 + 1] * 3 + 1]
          z1 = v[ind[i3 + 1] * 3 + 2] - z
          x2 = v[ind[i3 + 2] * 3 + 0]
          y2 = v[ind[i3 + 2] * 3 + 1]
          z2 = v[ind[i3 + 2] * 3 + 2] - z

          if (vertexScale != 0) {
            const xScale = (this.inst.scale / (this.inst.xScale == 0 ? 1 : this.inst.xScale)) * vertexScale
            const yScale = (this.inst.scale / (this.inst.yScale == 0 ? 1 : this.inst.yScale)) * vertexScale
            const zScale = (this.inst.scale / (this.inst.zScale == 0 ? 1 : this.inst.zScale)) * vertexScale
            x0 = Math.round(x0 * xScale) / xScale
            y0 = Math.round(y0 * xScale) / yScale
            z0 = Math.round(z0 * xScale) / zScale
            x1 = Math.round(x1 * xScale) / xScale
            y1 = Math.round(y1 * xScale) / yScale
            z1 = Math.round(z1 * xScale) / zScale
            x2 = Math.round(x2 * xScale) / xScale
            y2 = Math.round(y2 * xScale) / yScale
            z2 = Math.round(z2 * xScale) / zScale
          }

          if (this.inst.wireframe) {
            this.drawWireFrame(
              renderer,
              whiteTexture,
              tempQuad,
              x0,
              y0,
              z0,
              x1,
              y1,
              z1,
              x2,
              y2,
              z2,
              xWireframeWidth,
              yWireframeWidth,
              zWireframeWidth
            )
          } else {
            if (this.drawLightsEnable) {
              const c = this.unpackRGBA(this.drawLights[lightIndex])
              lightIndex++
              if (baseColorChanged) vec4.mul(c, c, currentColor)
              renderer.SetColorRgba(c[0], c[1], c[2], 1)
            }
            renderer.Quad3D2(x0, y0, z0, x1, y1, z1, x2, y2, z2, x2, y2, z2, tempQuad)
          }
        }
      }
    }

    // Restore modelview matrix
    if (!(this.inst.isEditor || this.inst.cpuXform) && !(this.inst.fragLight && this.inst.isWebGPU)) {
      renderer.SetModelViewMatrix(tmpModelView)
      // if (this.inst.fragLight && !this.inst.isWebGPU) renderer.SetProjectionMatrix(tmpProjection)
    }
    this.inst.totalTriangles = totalTriangles
    this.inst.totalTrianglesCulled = totalTrianglesCulled
    // Restore renderer buffers
    renderer._vertexData = rendererVertexData
    renderer._texcoordData = rendererTexcoordData

    if (!this.inst.isEditor) {
      renderer.EndBatch()
      this.disableVertexShaderModelRotate(renderer)
      this._disableGPUSkinning(renderer)
    }
    // Restore attrib
    if (this.inst.staticGeometry) {
      // Restore for other C3 objects
      const gl = renderer._gl
      const batchState = renderer._batchState
      const shaderProgram = batchState.currentShader._shaderProgram
      if (!this.locAPos) this.locAPos = gl.getAttribLocation(shaderProgram, "aPos")
      if (!this.locATex) this.locATex = gl.getAttribLocation(shaderProgram, "aTex")
      gl.bindBuffer(gl.ARRAY_BUFFER, renderer._vertexBuffer)
      gl.vertexAttribPointer(this.locAPos, 3, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(this.locAPos)
      gl.bindBuffer(gl.ARRAY_BUFFER, renderer._texcoordBuffer)
      gl.vertexAttribPointer(this.locATex, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(this.locATex)
      // Restore index buffer
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderer._indexBuffer)
      renderer._vertexPtr = 0
      renderer._texPtr = 0
    }
  }

  typedBonesToDrawBones() {
    // Iterate through all nodes
    const MATRIX_SIZE = 16
    const boneBufferViews = this.boneBufferViews
    let bufferViewIndex = 0
    // Unskinned nodes with mesh
    const bones = this.bones
    for (let node of this.gltfData.nodes) {
      // Check if the node has a mesh and is not a skinned mesh
      if (node.mesh && !node.skin) {
        if (!node.hasOwnProperty("boneBuffer")) {
          const boneBuffer = new BoneBufferW(this.inst.renderer, this.maxBones, false)
          node.boneBuffer = boneBuffer
        }
        const start = boneBufferViews[bufferViewIndex].start
        node.boneBuffer.setNodeXform(bones.slice(start, start + MATRIX_SIZE))
        bufferViewIndex += 1
      }
    }

    // Iterate through all skinned nodes
    for (let skinnedNode of this.gltfData.skinnedNodes) {
      if (!skinnedNode.hasOwnProperty("boneBuffer")) {
        const boneBuffer = new BoneBufferW(this.inst.renderer, this.maxBones, true)
        skinnedNode.boneBuffer = boneBuffer
      }
      const length = boneBufferViews[bufferViewIndex].length
      const start = boneBufferViews[bufferViewIndex].start
      skinnedNode.boneBuffer.setBones(bones.slice(start, start + length - MATRIX_SIZE))
      skinnedNode.boneBuffer.setRootNodeXform(bones.slice(start + length - MATRIX_SIZE, start + length))
      bufferViewIndex += 1
    }
  }

  typedVertsToDrawVerts(staticGeometry) {
    for (let j = 0; j <= this.drawMeshesIndex; j++) {
      const drawVerts = this.drawMeshes[j].drawVerts
      const bufferViews = this.drawMeshes[j].bufferViews
      const objectBuffers = this.drawMeshes[j].objectBuffers
      drawVerts.length = 0
      if (!this.activeNodes.includes(j)) {
        drawVerts.push([])
        continue
      }
      for (let ii = 0; ii < bufferViews.length; ii++) {
        const bufferView = bufferViews[ii]
        let buffStart = bufferView.start

        // Convert typed array to regular array
        // to speed access to data, net win is 10-20%
        const v = new Float32Array(bufferView.length)
        for (let a = 0; a < bufferView.length; a++) {
          v[a] = this.verts[buffStart + a]
        }
        drawVerts.push(v)
        if (staticGeometry) {
          if (objectBuffers.length == 0) {
            objectBuffers.push(new ObjectBufferW(this.inst.renderer, this.drawMeshes[j], 0))
          } else {
            objectBuffers[0].updateVertexData(this.inst.renderer, this.drawMeshes[j], 0)
          }
        }
      }
    }
  }

  unpackRGBA(packedRGBA) {
    // Extract individual RGBA components from the packed value
    var red = (packedRGBA & 0xff) / 255
    var green = ((packedRGBA >> 8) & 0xff) / 255
    var blue = ((packedRGBA >> 16) & 0xff) / 255
    var alpha = ((packedRGBA >> 24) & 0xff) / 255
    const color = [red, green, blue, alpha]

    return color
  }

  /*
        Updates a node's matrix and all it's children nodes.
        After that it transforms unskinned mesh points and sends them to c2.
    */
  transformNode(node, staticGeometry, gpuSkinning) {
    const gltf = this.gltfData

    if (node.mesh != undefined && node.skin == undefined) {
      for (let i = 0; i < node.mesh.primitives.length; i++) {
        this.drawMeshesIndex++
        this.drawMeshes[this.drawMeshesIndex].disabled = node.disabled
        if (node.offsetUV) this.drawMeshes[this.drawMeshesIndex].offsetUV = node.offsetUV
        // Update material each time, in case an ACE changes it
        if ("material" in node.mesh.primitives[i]) {
          this.drawMeshes[this.drawMeshesIndex].material = node.mesh.primitives[i].material
        } else {
          this.drawMeshes[this.drawMeshesIndex].material = null
        }
        if (gpuSkinning) {
          const objectBuffers = this.drawMeshes[this.drawMeshesIndex].objectBuffers
          if (objectBuffers.length === 0)
            objectBuffers.push(
              new ObjectBufferW(this.inst.renderer, this.drawMeshes[this.drawMeshesIndex], 0, gpuSkinning)
            )
        }
      }
    }
    if (node.children != undefined)
      for (let i = 0; i < node.children.length; i++) this.transformNode(node.children[i], staticGeometry, gpuSkinning)
  }

  getPolygons(gpuSkinning) {
    if (!this.workerReady) return
    const editorData = this.getPolygonsPrep(gpuSkinning)
    const data = { editorData }
    this.workerReady = false
    this.msgPort.postMessage({ type: "getPolygons", data: data, buff: this.buff }, [this.buff])
  }

  getEditorData(isEditor, lightEnable, lightUpdate, gpuSkinning) {
    const tick = this._runtime.GetTickCount()
    let editorData = { tick: tick, isEditor: isEditor, gpuSkinning }
    if (isEditor) {
      const xAngle = this.inst.xAngle
      const yAngle = this.inst.yAngle
      const zAngle = this.inst.zAngle

      const x = this.inst._inst.GetX()
      const y = this.inst._inst.GetY()
      const z = this.inst._inst.GetZElevation()

      const xScale = this.inst.scale / (this.inst.xScale == 0 ? 1 : this.inst.xScale)
      const yScale = this.inst.scale / (this.inst.yScale == 0 ? 1 : this.inst.yScale)
      const zScale = this.inst.scale / (this.inst.zScale == 0 ? 1 : this.inst.zScale)

      const cullEnable = this.inst.backFaceCull

      // Send to worker with postMessage in case in editor
      editorData = {
        xScale,
        yScale,
        zScale,
        xAngle,
        yAngle,
        zAngle,
        x,
        y,
        z,
        tick,
        isEditor,
        lightEnable: false,
        cullEnable,
        gpuSkinning,
      }
    }

    if (lightEnable) {
      const wi = this.inst.GetWorldInfo()

      const xAngle = this.inst.xAngle
      const yAngle = this.inst.yAngle
      const zAngle = this.inst.zAngle

      const x = wi.GetX()
      const y = wi.GetY()
      const z = wi.GetZElevation()

      const xScale = this.inst.scale / (this.inst.xScale == 0 ? 1 : this.inst.xScale)
      const yScale = this.inst.scale / (this.inst.yScale == 0 ? 1 : this.inst.yScale)
      const zScale = this.inst.scale / (this.inst.zScale == 0 ? 1 : this.inst.zScale)

      const lights = this.inst.lights
      const ambientColor = this.inst.ambientColor
      const viewPos = this.inst.viewPos

      const cullEnable = this.inst.backFaceCull

      // Send to worker with postMessage in case in editor
      editorData = {
        xScale,
        yScale,
        zScale,
        xAngle,
        yAngle,
        zAngle,
        x,
        y,
        z,
        tick,
        isEditor,
        lights,
        ambientColor,
        viewPos,
        lightEnable: true,
        cullEnable,
        lightUpdate,
        gpuSkinning,
      }
    }
    return editorData
  }

  //	Updates scene graph, and as a second step sends transformed skinned mesh points to c2.
  getPolygonsPrep(staticGeometry, gpuSkinning = false) {
    const gltf = this.gltfData

    this.drawMeshesIndex = -1

    const editorData = this.getEditorData(this.inst.isEditor, this.inst.lightEnable, this.inst.lightUpdate, gpuSkinning)

    // update all scene matrixes.
    // only update drawMesh meta data, vertex data will be updated in the worker
    for (let i = 0; i < gltf.scene.nodes.length; i++) {
      this.transformNode(gltf.scene.nodes[i], staticGeometry, gpuSkinning)
    }

    for (let ii = 0; ii < gltf.skinnedNodes.length; ii++) {
      let node = gltf.skinnedNodes[ii]
      for (let i = 0; i < node.mesh.primitives.length; i++) {
        this.drawMeshesIndex++
        this.drawMeshes[this.drawMeshesIndex].disabled = node.disabled
        if (node.offsetUV) this.drawMeshes[this.drawMeshesIndex].offsetUV = node.offsetUV
        // Update material each time, in case an ACE changes it
        if ("material" in node.mesh.primitives[i]) {
          this.drawMeshes[this.drawMeshesIndex].material = node.mesh.primitives[i].material
        } else {
          this.drawMeshes[this.drawMeshesIndex].material = null
        }
        if (gpuSkinning) {
          const objectBuffers = this.drawMeshes[this.drawMeshesIndex].objectBuffers
          if (objectBuffers.length === 0)
            objectBuffers.push(
              new ObjectBufferW(this.inst.renderer, this.drawMeshes[this.drawMeshesIndex], 0, gpuSkinning)
            )
        }
      }
    }
    return editorData
  }

  // sends a list of animation names to c2.
  getAnimationNames() {
    const gltf = this.gltfData
    let names = []
    if (!gltf.animations) return names

    for (let i = 0; i < gltf.animations.length; i++) names.push(gltf.animations[i].name)

    return names
  }

  drawWireFrame(renderer, whiteTexture, tempQuad, x0, y0, z0, x1, y1, z1, x2, y2, z2, xWidth, yWidth, zWidth) {
    renderer.SetTexture(whiteTexture)
    tempQuad.set(0, 0, 1, 0, 0, 1, 0, 1)

    renderer.Quad3D2(
      x0,
      y0,
      z0,
      x0 + xWidth,
      y0 + yWidth,
      z0 + zWidth,
      x1,
      y1,
      z1,
      x1 + xWidth,
      y1 + yWidth,
      z1 + zWidth,
      tempQuad
    )
    renderer.Quad3D2(
      x1,
      y1,
      z1,
      x1 + xWidth,
      y1 + yWidth,
      z1 + zWidth,
      x2,
      y2,
      z2,
      x2 + xWidth,
      y2 + yWidth,
      z2 + zWidth,
      tempQuad
    )
    renderer.Quad3D2(
      x2,
      y2,
      z2,
      x2 + xWidth,
      y2 + yWidth,
      z2 + zWidth,
      x0,
      y0,
      z0,
      x0 + xWidth,
      y0 + yWidth,
      z0 + zWidth,
      tempQuad
    )
  }

  getLightData() {
    return this.inst.lights
  }

  updateAnimationPolygons(index, time, onScreen, deltaTime, staticGeometry, gpuSkinning = false) {
    if (!this.workerReady) return
    this.workerReady = false
    this.updateAnimation(index, time, onScreen, deltaTime)
    const animationBlend = this.inst.animationBlend
    const animationLoop = this.inst.animationLoop
    let animationData = { index, time, onScreen, deltaTime, animationBlend, animationLoop }
    let editorData = {}
    if (onScreen) {
      editorData = this.getPolygonsPrep(staticGeometry, gpuSkinning)
      this.inst.runtime.UpdateRender()
      this.inst.updateBbox = true
    }
    const data = { animationData, editorData }
    this.msgPort.postMessage({ type: "updateAnimationPolygons", data: data, buff: this.buff }, [this.buff])
  }

  updateModelRotate(x, y, z) {
    // @ts-ignore
    const vec3 = globalThis.glMatrix3D.vec3
    // @ts-ignore
    const mat4 = globalThis.glMatrix3D.mat4
    // @ts-ignore
    const quat = globalThis.glMatrix3D.quat

    const xAngle = this.inst.xAngle
    const yAngle = this.inst.yAngle
    const zAngle = this.inst.zAngle
    const xScale = this.inst.scale / (this.inst.xScale == 0 ? 1 : this.inst.xScale)
    const yScale = this.inst.scale / (this.inst.yScale == 0 ? 1 : this.inst.yScale)
    const zScale = this.inst.scale / (this.inst.zScale == 0 ? 1 : this.inst.zScale)
    const rotate = quat.create()
    if (this.inst.cannonBody && this.inst.cannonSetRotation) {
      quat.set(
        rotate,
        this.inst.cannonBody.quaternion.x,
        this.inst.cannonBody.quaternion.y,
        this.inst.cannonBody.quaternion.z,
        this.inst.cannonBody.quaternion.w
      )
    } else if (this.inst.enableQuaternion) {
      quat.copy(rotate, this.inst.quaternion)
    } else {
      quat.fromEuler(rotate, xAngle, yAngle, zAngle)
    }
    mat4.fromRotationTranslationScale(this.modelRotate, rotate, [x, y, z], [xScale, -yScale, zScale])
  }

  // Updates animation at index to be at time.  Is used to play animation.
  updateAnimation(index, time, onScreen, deltaTime) {
    const gltf = this.gltfData
    let anim = gltf.animations[index]
    for (let i = 0; i < anim.channels.length; i++) {
      let c = anim.channels[i]
      let timeValues = c.sampler.input

      if (this.inst.animationLoop) {
        time = ((time - timeValues.min[0]) % (timeValues.max[0] - timeValues.min[0])) + timeValues.min[0] // loop
      } else {
        if (time > timeValues.max[0]) {
          time = timeValues.max[0] - 0.01 // Stop on max time
          if (!this.inst.animationFinished) {
            this.inst.animationFinished = true
            this.inst.animationNameFinished = this.inst.animationName
            // @ts-ignore
            this.inst.Trigger(self.C3.Plugins.Mikal_3DObject.Cnds.OnAnimationFinished)
            // @ts-ignore
            this.inst.Trigger(self.C3.Plugins.Mikal_3DObject.Cnds.OnAnimationNameFinished)
          }
        }
      }
      this.inst.currentAnimationTime = time
    }
  }
}

// @ts-ignore
if (!globalThis.GltfModelW) {
  // @ts-ignore
  globalThis.GltfModelW = GltfModelWTop
}
