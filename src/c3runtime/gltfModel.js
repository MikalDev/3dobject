// @ts-check
"use strict"
// @ts-ignore
const BoneBuffer = globalThis.BoneBuffer
// @ts-ignore
const ObjectBuffer = globalThis.ObjectBuffer

const MAX_BONES = 56

class GltfModelTop {
  constructor(runtime, sdkType, inst) {
    const mat4 = globalThis.glMatrix3D.mat4

    this._runtime = runtime
    this._sdkType = sdkType
    this.inst = inst
    this.gltfData = {}
    this._blendState = "init"
    this._lastTarget = new Array(2)
    this._lastTarget[0] = []
    this._lastTarget[1] = []
    this._lastTargetIndex = 0
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
    this.viewPos = [0, 0, 0]
    this.maxBones = MAX_BONES
  }

  

  async init() {
    this.gltfData = this.copyGltfData(this._sdkType.gltfData.gltf)
    await new Promise(resolve => setTimeout(resolve, 66));  // Allow time for texture initialization
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
    this.getPolygons(this.inst.staticGeometry, this.inst.gpuSkinning)
    if (!this.inst.isEditor) this.inst.initBoundingBox()
  }

  release() {
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
    this.normalMatrix = null
    // @ts-ignore
    this.meshNames = null
    // @ts-ignore
    this.verts = null
    // @ts-ignore
    this.bones = null
    // @ts-ignore
    this.updateDrawVerts = null
    // @ts-ignore
    this.activeNodes = null
    // @ts-ignore
    this.drawLights = null
    // @ts-ignore
    this.drawLightsBufferViews = null
    // @ts-ignore
    this.drawLightsEnable = null
    // @ts-ignore
    this.workerReady = null
    // @ts-ignore
    this.boundingBoxInit = null
    // @ts-ignore
    this.buffBones = null
    // @ts-ignore
    this.buffNodesMat = null
    // @ts-ignore
    this.nodesMat = null
    // @ts-ignore
    this.buffLights = null
    // @ts-ignore
    this.boneBufferViews = null
    // @ts-ignore
    this.locuModelRotateEnable = null
    // @ts-ignore
    this.locUSkinEnable = null
    // @ts-ignore
    this.locUNodeXformEnable = null
    // @ts-ignore
    this.locAPos = null
    // @ts-ignore
    this.locATex = null
    // @ts-ignore
    this.locANormalMatrix = null
    // @ts-ignore
    this.msgPort = null
  }

  copyGltfData(sourceGltf) {
    // Create completely new object (no direct references to source)
    const targetGltf = structuredClone(sourceGltf);
    return targetGltf;
  }

  _findNodeByName(nodeName) {
    const nodes = this.gltfData?.nodes;
    if (nodes) {
        for (let i = 0; i < nodes.length; i++) {
            // Nodes within skinned meshes are also in the main nodes list
            if (nodes[i].name === nodeName) {
                return nodes[i];
            }
        }
    }
    console.warn(`[GltfModel] Node not found: ${nodeName}`);
    return null;
 }

 getNodeWorldPosition(nodeName) {
    const mat4 = globalThis.glMatrix3D.mat4;
    const vec3 = globalThis.glMatrix3D.vec3;

    const node = this._findNodeByName(nodeName);

    if (!node) {
      // Warning already logged in _findNodeByName
      return null;
    }

    // Ensure the node's matrix and the model's world matrix are calculated and valid.
    // These matrices are typically updated during getPolygons() or render().
    // Calling this function before the model has been processed in a tick might result in null.
    if (!node.matrix) {
        console.warn(`[GltfModel] Node matrix not calculated yet for: ${nodeName}. Ensure getPolygons() or updateAnimation() has run.`);
        return null;
    }
    // this.modelRotate is updated in render() or updateModelRotate()
    if (!this.modelRotate) {
        console.warn(`[GltfModel] Model world rotation matrix (modelRotate) not calculated yet. Ensure the model has been rendered or updated.`);
        return null;
    }

    const nodeWorldMatrix = mat4.create();
    // node.matrix holds the transform relative to the model root after hierarchy and animation updates.
    // this.modelRotate transforms the model root to world space.
    mat4.multiply(nodeWorldMatrix, this.modelRotate, node.matrix);

    // Extract translation component (world position) from the combined matrix.
    const worldPos = vec3.fromValues(nodeWorldMatrix[12], nodeWorldMatrix[13], nodeWorldMatrix[14]);

    // Return as a plain array [x, y, z]
    return [worldPos[0], worldPos[1], worldPos[2]];
 }

  _smoothstep(min, max, value) {
    var x = Math.max(0, Math.min(1, (value - min) / (max - min)))
    return x * x * (3 - 2 * x)
  }

  _cullPoint(cameraPos, cameraDir, point, fov, cullDistance) {
    const vec3 = globalThis.glMatrix3D.vec3
    // Find angle between vector of camera pos to point and camera dir
    // Create a new vector for the result of the subtraction
    let direction = vec3.create()
    vec3.subtract(direction, point, cameraPos) // Subtract cameraPos from point, store in direction

    // Calculate the angle between cameraDir and the new direction vector
    const angle = vec3.angle(cameraDir, direction)
    if (angle > fov) return false
    // Find distance from camera pos to point
    const distance = vec3.distance(cameraPos, point)
    if (distance > cullDistance) return false
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
    const locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable")
    gl.uniform1f(locUPhongEnable, this.inst.fragLightPhong ? 1 : 0)
  }

  disableVertexShaderModelRotate(renderer) {
    const gl = renderer._gl
    const batchState = renderer._batchState
    const shaderProgram = batchState.currentShader._shaderProgram
    const locuModelRotateEnable = gl.getUniformLocation(shaderProgram, "uModelRotateEnable")
    gl.uniform1f(locuModelRotateEnable, 0)
    const locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable")
    gl.uniform1f(locUPhongEnable, 0)
  }

  _disableGPUSkinning(renderer) {
    const gl = renderer._gl
    const shaderProgram = renderer._batchState.currentShader._shaderProgram
    const locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable")
    const locUNodeXformEnable = gl.getUniformLocation(shaderProgram, "uNodeXformEnable")
    if (locUNodeXformEnable == -1 || locUSkinEnable == -1) {
      console.error("locUNodeXformEnable == -1", locUNodeXformEnable)
      console.error("locUSkinEnable == -1", locUSkinEnable)
    }
    gl.uniform1f(locUSkinEnable, 0.0)
    gl.uniform1f(locUNodeXformEnable, 0.0)
  }

  render(renderer, x, y, z, tempQuad, whiteTexture, instanceC3Color, textures, instanceTexture, opacity) {
    if (opacity === 0) return
    if (!this.inst.isEditor) renderer.EndBatch()

    let totalTriangles = 0
    let currentColor = [-1, -1, -1, -1]
    let currentTexture = null
    const lightEnable = this.inst.lightEnable
    const rendererVertexData = renderer._vertexData
    const rendererTexcoordData = renderer._texcoordData

    const vec4 = globalThis.glMatrix3D.vec4
    const vec3 = globalThis.glMatrix3D.vec3
    const mat4 = globalThis.glMatrix3D.mat4
    const quat = globalThis.glMatrix3D.quat

    let xWireframeWidth, yWireframeWidth, zWireframeWidth

    if (this.inst.wireframe) {
      const xScale = this.inst.scale / (this.inst.xScale == 0 ? 1 : this.inst.xScale)
      const yScale = this.inst.scale / (this.inst.yScale == 0 ? 1 : this.inst.yScale)
      const zScale = this.inst.scale / (this.inst.zScale == 0 ? 1 : this.inst.zScale)

      xWireframeWidth =
        this.inst.isEditor || this.inst.cpuXform ? this.inst.xWireframeWidth : this.inst.xWireframeWidth / xScale
      yWireframeWidth =
        this.inst.isEditor || this.inst.cpuXform ? this.inst.yWireframeWidth : this.inst.yWireframeWidth / yScale
      zWireframeWidth =
        this.inst.isEditor || this.inst.cpuXform ? this.inst.zWireframeWidth : this.inst.zWireframeWidth / zScale
    }

    const instanceColor = [
      instanceC3Color.getR(),
      instanceC3Color.getG(),
      instanceC3Color.getB(),
      instanceC3Color.getA(),
    ]
    const finalColor = vec4.create()

    const tmpModelView = mat4.create()
    // const tmpProjection = mat4.create()
    const modelRotate = mat4.create()
    if (!this.inst.isEditor) {
      mat4.copy(tmpModelView, renderer._matMV)
      // if (this.inst.fragLight && !this.inst.isWebGPU) mat4.copy(tmpProjection, renderer._matP)
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
      // XXX mat4.fromRotationTranslationScale(modelRotate, rotate, [x,y,z], [xScale,-yScale,zScale]);
      mat4.fromRotationTranslationScaleOrigin(
        modelRotate,
        rotate,
        [x, y, z],
        [xScale, -yScale, zScale],
        this.inst.localCenter
      )
      // from rotationtranslationscaleorigin
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
    renderer.SetColor(instanceC3Color)
    vec4.copy(currentColor, instanceColor)
    let baseColorChanged = false
    if (!vec4.equals(currentColor, [1, 1, 1, 1])) baseColorChanged = true

    // If vertexNormals used set the shader program uniform aNormalMatrix
    if (this.inst.normalMatrix) {
      renderer.SetUniformMatrix4fv(this.locANormalMatrix, this.normalMatrix)
    }

    for (let j = 0; j <= this.drawMeshesIndex; j++) {
      // Skip render if disabled
      if (this.drawMeshes[j].disabled) continue

      const drawVerts = this.drawMeshes[j].drawVerts

      const drawUVs = this.drawMeshes[j].drawUVs
      const drawIndices = this.drawMeshes[j].drawIndices
      const drawLights = this.drawMeshes[j].drawLights
      const material = this.drawMeshes[j].material
      const hasTexture =
        material && "pbrMetallicRoughness" in material && "baseColorTexture" in material.pbrMetallicRoughness
      const offsetUV = this.drawMeshes[j].offsetUV
      const materialsModify = this.inst.materialsModify
      const offsetMaterial = materialsModify.has(material?.name) && materialsModify.get(material?.name)?.offsetUV
      const rotateMaterial = materialsModify.has(material?.name) && materialsModify.get(material?.name)?.rotateUV
      const lightUpdate = this.inst.lightUpdate || drawLights.length == 0
      const vertexScale = this.inst.vertexScale
      let isSpriteTexture = false
      let rWidth = null
      let rHeight = null
      let rOffsetX = null
      let rOffsetY = null
      const imageInfo = !this.inst.instanceTexture
        ? null
        : this.inst.isEditor
        ? null
        : this.inst._objectClass.GetImageInfo()
      const textureRect = !this.inst.instanceTexture
        ? null
        : this.inst.isEditor
        ? this.inst.GetTexRect()
        : imageInfo.GetTexRect()
      if (this.inst.instanceTexture) {
        rWidth = textureRect.width()
        rHeight = textureRect.height()
        rOffsetX = textureRect.getLeft()
        rOffsetY = textureRect.getTop()
      }

      // Check if the map this.inst.materialsModify contains the key material.name
      // If it does, then we need to offset the UVs

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
          let texture = textures[material.name]
          if (this.inst.spriteTextures.has(material.name)) {
            const uid = this.inst.spriteTextures.get(material.name)
            const spriteInst = this._runtime.GetInstanceByUID(uid)
            if (spriteInst) {
              isSpriteTexture = true
              texture = spriteInst.GetSdkInstance().GetTexture()
              const texQuad = spriteInst.GetSdkInstance().GetTexQuad()
              rOffsetX = texQuad.getTlx()
              rOffsetY = texQuad.getTly()
              rWidth = texQuad.getTrx() - texQuad.getTlx()
              rHeight = texQuad.getBly() - texQuad.getTly()
            } else {
              console.warn("Sprite texture not found from uid, for 3Dobject uid", uid, this.inst.uid)
            }
          }
          // If texture is not loaded, skip rendering
          if (!texture) continue
          if (texture != currentTexture) {
            renderer.SetTexture(texture)
            currentTexture = texture
          }
        }
      }
      // Create const for mat2
      const mat2 = globalThis.glMatrix3D.mat2
      const vec2 = globalThis.glMatrix3D.vec2
      let rotateMatrix = null

      if (rotateMaterial) {
        const rotateUV = materialsModify.get(material.name)?.rotateUV
        // Create rotate matrix
        rotateMatrix = mat2.create()
        mat2.fromRotation(rotateMatrix, rotateUV.angle)
      }

      if (lightUpdate) {
        drawLights.length = 0
      }
      let xVerts
      if (this.inst.fragLight && this.inst.isWebGPU) {
        xVerts = this.transformDrawVerts(drawVerts, this.modelRotate)
      } else {
        xVerts = drawVerts
      }

      // Static geometry, draw from GPU buffers
      if (this.inst.staticGeometry) {
        const objectBuffers = this.drawMeshes[j].objectBuffers
        // Draw
        let boneBuffer
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
            if (this.inst.instanceTexture || isSpriteTexture) {
              tempQuad.setTlx(tempQuad.getTlx() * rWidth + rOffsetX)
              tempQuad.setTly(tempQuad.getTly() * rHeight + rOffsetY)
              tempQuad.setTrx(tempQuad.getTrx() * rWidth + rOffsetX)
              tempQuad.setTry(tempQuad.getTry() * rHeight + rOffsetY)
              tempQuad.setBlx(tempQuad.getBlx() * rWidth + rOffsetX)
              tempQuad.setBly(tempQuad.getBly() * rHeight + rOffsetY)
              tempQuad.setBrx(tempQuad.getBrx() * rWidth + rOffsetX)
              tempQuad.setBry(tempQuad.getBry() * rHeight + rOffsetY)
              /*
            const rcTex = imageInfo.GetTexRect();
            */
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

          let colorSum
          if (lightUpdate) colorSum = vec4.create()

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
            if (lightEnable && lightUpdate) {
              const normal = vec3.create()
              const viewDir = vec3.create()
              const v0 = vec3.fromValues(x0, y0, z0 + z)
              const v1 = vec3.fromValues(x1, y1, z1 + z)
              const v2 = vec3.fromValues(x2, y2, z2 + z)

              vec3.transformMat4(v0, v0, this.modelRotate)
              vec3.transformMat4(v1, v1, this.modelRotate)
              vec3.transformMat4(v2, v2, this.modelRotate)
              const c = vec3.clone(v0)
              vec3.add(c, c, v1)
              vec3.add(c, c, v2)
              vec3.div(c, c, [3, 3, 3])

              vec3.cross(
                normal,
                [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]],
                [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]]
              )
              vec3.normalize(normal, normal)

              for (const light of Object.values(this.inst.lights)) {
                if (!light.enable) continue
                const l = light.pos
                const enableSpot = light.enableSpot
                const enableSpecular = light.enableSpecular
                const spotDir = light.spotDir
                const cutoff = light.cutoff
                const edge = light.edge
                const color = light.color
                const lightDir = vec3.fromValues(c[0] - l[0], c[1] - l[1], c[2] - l[2])
                const distance = vec3.length(lightDir)
                const attConstant = light.attConstant
                const attLinear = light.attLinear
                const attSquare = light.attSquare
                vec3.normalize(lightDir, lightDir)
                let dot = vec3.dot(normal, lightDir) * 0.5 + 0.5
                let att = 1.0
                let specular = 0.0
                if (enableSpot) {
                  const spotDirN = vec3.clone(spotDir)
                  vec3.normalize(spotDirN, spotDir)
                  att = vec3.dot(spotDirN, lightDir)
                  if (att < cutoff) {
                    att = this._smoothstep(cutoff * (1 - edge), cutoff, att)
                  } else {
                    att = 1.0
                  }
                }
                if (enableSpecular) {
                  vec3.sub(viewDir, this.inst.viewPos, c)
                  vec3.normalize(viewDir, viewDir)
                  const reflectDir = vec3.create()
                  const dotNI = vec3.create()
                  vec3.dot(dotNI, normal, lightDir)
                  vec3.scale(dotNI, dotNI, 2.0)
                  vec3.mul(dotNI, dotNI, normal)
                  vec3.sub(reflectDir, dotNI, lightDir)
                  // I - 2.0 * dot(N, I) * N.
                  vec3.sub(reflectDir, lightDir, normal)
                  vec3.normalize(reflectDir, reflectDir)
                  const spec = Math.pow(Math.max(vec3.dot(reflectDir, viewDir), 0.0), light.specularPower)
                  specular = light.specularAtt * spec
                }
                att = att / (1.0 * attConstant + distance * attLinear + distance * distance * attSquare)
                att = att + specular
                dot = dot * dot * att
                vec4.add(colorSum, colorSum, [dot * color[0], dot * color[1], dot * color[2], dot * color[3]])
              }
              // Add ambient color to colorSum
              vec4.add(colorSum, colorSum, this.inst.ambientColor)
              // Clamp color
              colorSum[0] = colorSum[0] < 0.0 ? 0.0 : colorSum[0] > 1.0 ? 1.0 : colorSum[0]
              colorSum[1] = colorSum[1] < 0.0 ? 0.0 : colorSum[1] > 1.0 ? 1.0 : colorSum[1]
              colorSum[2] = colorSum[2] < 0.0 ? 0.0 : colorSum[2] > 1.0 ? 1.0 : colorSum[2]
              colorSum[3] = colorSum[3] < 0.0 ? 0.0 : colorSum[3] > 1.0 ? 1.0 : colorSum[3]

              drawLights.push(colorSum)
            }
            if (lightEnable) {
              const c = drawLights[i]
              if (baseColorChanged) vec4.mul(c, c, currentColor)
              renderer.SetColorRgba(c[0], c[1], c[2], 1)
            }
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
            renderer.Quad3D2(x0, y0, z0, x1, y1, z1, x2, y2, z2, x2, y2, z2, tempQuad, true)
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
      // XXX may no longer be needed with new  object buffer and separate vertex/texcoord buffers
      const gl = renderer._gl
      const batchState = renderer._batchState
      const shaderProgram = batchState.currentShader._shaderProgram
      const locAPos = gl.getAttribLocation(shaderProgram, "aPos")
      const locATex = gl.getAttribLocation(shaderProgram, "aTex")
      gl.bindBuffer(gl.ARRAY_BUFFER, renderer._vertexBuffer)
      gl.vertexAttribPointer(locAPos, 3, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(locAPos)
      gl.bindBuffer(gl.ARRAY_BUFFER, renderer._texcoordBuffer)
      gl.vertexAttribPointer(locATex, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(locATex)
      // Restore index buffer
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderer._indexBuffer)
      renderer._vertexPtr = 0
      renderer._texPtr = 0
    }
  }

  /*
        Updates a node's matrix and all it's children nodes.
        After that it transforms unskinned mesh points and sends them to c2.
    */
  transformNode(node, parentMat, modelScaleRotate, staticGeometry = false, gpuSkinning = false) {
    // @ts-ignore
    const mat4 = globalThis.glMatrix3D.mat4
    // @ts-ignore
    const quat = globalThis.glMatrix3D.quat
    // @ts-ignore
    const vec3 = globalThis.glMatrix3D.vec3
    const gltf = this.gltfData
    let dummyMat4Out = mat4.create()

    const scale = this.inst.scale
    const xScale = this.inst.scale / (this.inst.xScale == 0 ? 1 : this.inst.xScale)
    const yScale = this.inst.scale / (this.inst.yScale == 0 ? 1 : this.inst.yScale)
    const zScale = this.inst.scale / (this.inst.zScale == 0 ? 1 : this.inst.zScale)

    if (parentMat != undefined) mat4.copy(node.matrix, parentMat)
    // mat4.set(parentMat, node.matrix);
    else mat4.identity(node.matrix)
    mat4.translate(node.matrix, node.matrix, node.translation)
    // mat4.translate(node.matrix, node.translation);
    mat4.multiply(node.matrix, node.matrix, mat4.fromQuat(dummyMat4Out, node.rotation))
    // mat4.multiply(node.matrix, quat4.toMat4(node.rotation));
    mat4.scale(node.matrix, node.matrix, node.scale)
    // mat4.scale(node.matrix, node.scale);

    if (node.skin != undefined) mat4.invert(node.invMatrix, node.matrix)
    // mat4.inverse(node.matrix, node.invMatrix);

    // unskinned meshes
    if (node.mesh != undefined && node.skin == undefined) {
      if (gpuSkinning) {
        if (!node.hasOwnProperty("boneBuffer")) {
          const boneBuffer = new BoneBuffer(this.inst.renderer, this.maxBones, false)
          node.boneBuffer = boneBuffer
        }
        node.boneBuffer.setNodeXform(node.matrix)
      }

      for (let i = 0; i < node.mesh.primitives.length; i++) {
        let posData = node.mesh.primitives[i].attributes.POSITION.data
        let transformedVerts = new Float32Array(posData.length)
        const weights = node.mesh.weights

        let morphActive = false
        let morphTargets = null
        let morphWeights = null
        if (node.weights || node.morphWeights) {
          if (!node.weights) node.weights = new Float32Array(node.mesh.primitives[i].targets.length)
          morphActive = true
          morphTargets = node.mesh.primitives[i].targets
          morphWeights = [...node.weights]
          if (node.morphWeights) {
            for (let j = 0; j < morphWeights.length; j++) {
              if (node.morphWeights.has(j)) morphWeights[j] = node.morphWeights.get(j)
            }
          }
        }

        this.drawMeshesIndex++
        if (!this.drawMeshes[this.drawMeshesIndex]) {
          this.drawMeshes.push({
            drawVerts: [],
            drawVertsOrig: [],
            drawUVs: [],
            drawIndices: [],
            drawLights: [],
            drawColors: [],
            drawNormals: [],
            drawBones: [],
            drawJoints: [],
            drawWeights: [],
            disabled: false,
            morphWeights: null,
            objectBuffers: [],
          })
          this.meshNames.set(node.name, this.drawMeshesIndex)
        }

        if (gpuSkinning) this.drawMeshes[this.drawMeshesIndex].boneBuffer = node.boneBuffer

        this.drawMeshes[this.drawMeshesIndex].disabled = node.disabled
        if (node.offsetUV) this.drawMeshes[this.drawMeshesIndex].offsetUV = node.offsetUV

        // Update material each time, in case an ACE changes it
        if ("material" in node.mesh.primitives[i]) {
          this.drawMeshes[this.drawMeshesIndex].material = node.mesh.primitives[i].material
        } else {
          this.drawMeshes[this.drawMeshesIndex].material = null
        }

        const drawVerts = this.drawMeshes[this.drawMeshesIndex].drawVerts
        const drawUVs = this.drawMeshes[this.drawMeshesIndex].drawUVs
        const drawIndices = this.drawMeshes[this.drawMeshesIndex].drawIndices
        const drawColors = this.drawMeshes[this.drawMeshesIndex].drawColors
        const drawNormals = this.drawMeshes[this.drawMeshesIndex].drawNormals
        const objectBuffers = this.drawMeshes[this.drawMeshesIndex].objectBuffers
        const drawVertsOrig = this.drawMeshes[this.drawMeshesIndex].drawVertsOrig

        // reset draw array for new values
        drawVerts.length = 0

        let v = [0, 0, 0]

        for (let j = 0; j < posData.length / 3; j++) {
          if (gpuSkinning) continue
          let vin = posData.subarray(j * 3, j * 3 + 3)
          if (morphActive) {
            vin = this.morphTargets(vin, j, morphWeights, morphTargets)
          }

          vec3.transformMat4(v, vin, node.matrix)

          // vec3.transformMat4(v, vv, node.matrix);
          // mat4.multiplyVec3(node.matrix, posData.subarray(j*3, j*3+3), v);

          if (this.inst.isEditor || this.inst.cpuXform) {
            vec3.transformMat4(v, v, modelScaleRotate)
          }

          const x = v[0]
          const y = v[1]
          const z = v[2]

          if (this.inst.minBB[0] > x) this.inst.minBB[0] = x
          if (this.inst.minBB[1] > y) this.inst.minBB[1] = y
          if (this.inst.minBB[2] > z) this.inst.minBB[2] = z
          if (this.inst.maxBB[0] < x) this.inst.maxBB[0] = x
          if (this.inst.maxBB[1] < y) this.inst.maxBB[1] = y
          if (this.inst.maxBB[2] < z) this.inst.maxBB[2] = z

          transformedVerts[j * 3] = x
          transformedVerts[j * 3 + 1] = y
          transformedVerts[j * 3 + 2] = z
        }

        if (transformedVerts.length > 0 || staticGeometry || gpuSkinning) {
          if (gltf.pointBatch != undefined)
            for (let ii = 0; ii < transformedVerts.length; ii++) gltf.pointBatch.push(transformedVerts[ii])
          else {
            if (transformedVerts.length > 0) drawVerts.push(transformedVerts)
            // Only need to set once for all the below
            if (drawUVs.length === 0 && "TEXCOORD_0" in node.mesh.primitives[i].attributes) {
              drawUVs.push(new Float32Array(node.mesh.primitives[i].attributes.TEXCOORD_0.data))
            }
            if (gpuSkinning && drawVertsOrig.length === 0 && "POSITION" in node.mesh.primitives[i].attributes) {
              drawVertsOrig.push(new Float32Array(posData))
            }
            if (drawColors.length === 0 && "COLOR_0" in node.mesh.primitives[i].attributes) {
              drawColors.push(new Float32Array(node.mesh.primitives[i].attributes.COLOR_0.data))
            }
            if (drawNormals.length === 0 && "NORMAL" in node.mesh.primitives[i].attributes) {
              drawNormals.push(new Float32Array(node.mesh.primitives[i].attributes.NORMAL.data))
            }

            if (drawIndices.length === 0) drawIndices.push(new Uint16Array(node.mesh.primitives[i].indices.data))
            if (staticGeometry) {
              if (objectBuffers.length == 0) {
                objectBuffers.push(
                  new ObjectBuffer(this.inst.renderer, this.drawMeshes[this.drawMeshesIndex], 0, gpuSkinning)
                )
              } else if (!gpuSkinning) {
                objectBuffers[0].updateVertexData(this.inst.renderer, this.drawMeshes[this.drawMeshesIndex], 0)
              }
              objectBuffers[0].setNodeXform(node.matrix)
            }
          }
        }
      }
    }

    if (node.children != undefined)
      for (let i = 0; i < node.children.length; i++)
        this.transformNode(node.children[i], node.matrix, modelScaleRotate, staticGeometry, gpuSkinning)
  }

  morphTargets(vin, index, weights, targets) {
    const vec3 = globalThis.glMatrix3D.vec3
    const vout = vec3.create()
    vec3.copy(vout, vin)
    for (let i = 0; i < targets.length; i++) {
      const w = weights[i]
      if (w == 0) continue
      const v = targets[i].POSITION.data.subarray(index * 3, index * 3 + 3)
      vec3.scaleAndAdd(vout, vout, v, w)
    }
    return vout
  }
  //	Updates scene graph, and as a second step sends transformed skinned mesh points to c2.
  getPolygons(staticGeometry = false, gpuSkinning = false) {
    // @ts-ignore
    const vec3 = globalThis.glMatrix3D.vec3
    // @ts-ignore
    const mat4 = globalThis.glMatrix3D.mat4
    // @ts-ignore
    const quat = globalThis.glMatrix3D.quat
    const gltf = this.gltfData
    const scale = this.inst.scale
    const xScale = this.inst.scale / (this.inst.xScale == 0 ? 1 : this.inst.xScale)
    const yScale = this.inst.scale / (this.inst.yScale == 0 ? 1 : this.inst.yScale)
    const zScale = this.inst.scale / (this.inst.zScale == 0 ? 1 : this.inst.zScale)
    this.drawMeshesIndex = -1

    const modelScaleRotate = mat4.create()

    if (this.inst.isEditor || this.inst.cpuXform) {
      const xAngle = this.inst.xAngle
      const yAngle = this.inst.yAngle
      const zAngle = this.inst.zAngle

      const x = this.inst.isEditor ? this.inst._inst.GetX() : this.inst.GetWorldInfo().GetX()
      const y = this.inst.isEditor ? this.inst._inst.GetY() : this.inst.GetWorldInfo().GetY()
      const z = this.inst.isEditor ? this.inst._inst.GetZElevation() : this.inst.GetWorldInfo().GetZElevation()

      const rotate = quat.create()
      quat.fromEuler(rotate, xAngle, yAngle, zAngle)
      mat4.fromRotationTranslationScale(modelScaleRotate, rotate, [x, y, z], [xScale, -yScale, zScale])
      if (globalThis.mikal3deditor?.enable) {
        const viewRotate = globalThis.mikal3deditor.viewRotate
        mat4.multiply(modelScaleRotate, viewRotate, modelScaleRotate)
      }
    }

    let rotationQuat = quat.create()
    let parentMatrix = mat4.create()

    quat.fromEuler(rotationQuat, 0, 0, 0)

    mat4.fromRotationTranslation(parentMatrix, rotationQuat, [0, 0, 0])

    this.inst.minBB = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
    this.inst.maxBB = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]

    // update all scene matrixes.
    for (let i = 0; i < gltf.scene.nodes.length; i++) {
      this.transformNode(gltf.scene.nodes[i], parentMatrix, modelScaleRotate, staticGeometry, gpuSkinning)
    }

    quat.fromEuler(rotationQuat, 0, 0, 0)

    // Check if the gltf scene root node has a rotation, translation or scale
    const rootNode = gltf?.scene?.nodes[0]
    let rootNodeXform = false

    if (rootNode && (rootNode.rotation || rootNode.translation || rootNode.scale)) {
      if (!rootNode.rotation) rootNode.rotation = quat.create()
      if (!rootNode.translation) rootNode.translation = vec3.create()
      if (!rootNode.scale) rootNode.scale = vec3.fromValues(1, 1, 1)

      mat4.fromRotationTranslationScale(parentMatrix, rootNode.rotation, rootNode.translation, rootNode.scale)
      rootNodeXform = true
    }

    for (let ii = 0; ii < gltf.skinnedNodes.length; ii++) {
      let node = gltf.skinnedNodes[ii]

      //update bone matrixes
      if (gpuSkinning) {
        if (!node.hasOwnProperty("boneBuffer")) {
          const boneBuffer = new BoneBuffer(this.inst.renderer, this.maxBones, true)
          node.boneBuffer = boneBuffer
        }
        node.boneBuffer.setRootNodeXform(parentMatrix)
      }

      for (let jj = 0; jj < node.skin.joints.length; jj++) {
        if (node.disabled) continue
        let joint = node.skin.joints[jj]

        mat4.multiply(joint.boneMatrix, node.invMatrix, joint.matrix)
        // mat4.multiply(node.invMatrix, joint.matrix, joint.boneMatrix);
        mat4.multiply(joint.boneMatrix, joint.boneMatrix, joint.invBindMatrix)
        // mat4.multiply(joint.boneMatrix, joint.invBindMatrix);
        if (gpuSkinning) node.boneBuffer.setBone(jj, joint.boneMatrix)
      }

      for (let i = 0; i < node.mesh.primitives.length; i++) {
        this.drawMeshesIndex++
        if (!this.drawMeshes[this.drawMeshesIndex]) {
          this.drawMeshes.push({
            drawVerts: [],
            drawUVs: [],
            drawIndices: [],
            drawColors: [],
            drawNormals: [],
            drawLights: [],
            drawJoints: [],
            drawWeights: [],
            drawBones: [],
            drawVertsOrig: [],
            disabled: true,
            objectBuffers: [],
          })
          this.meshNames.set(node.name, this.drawMeshesIndex)
        }
        if (gpuSkinning) this.drawMeshes[this.drawMeshesIndex].boneBuffer = node.boneBuffer

        this.drawMeshes[this.drawMeshesIndex].disabled = node.disabled
        if (node.offsetUV) this.drawMeshes[this.drawMeshesIndex].offsetUV = node.offsetUV
        if (node.disabled) continue

        let morphActive = false
        let morphTargets = null
        let morphWeights = null

        if (node.weights || node.morphWeights) {
          if (!node.weights) node.weights = new Float32Array(node.mesh.primitives[i].targets.length)
          morphActive = true
          morphTargets = node.mesh.primitives[i].targets
          morphWeights = [...node.weights]
          if (node.morphWeights)
            for (let j = 0; j < morphWeights.length; j++) {
              if (node.morphWeights.has(j)) morphWeights[j] = node.morphWeights.get(j)
            }
        }

        // Update material each time, in case an ACE changes it
        if ("material" in node.mesh.primitives[i]) {
          this.drawMeshes[this.drawMeshesIndex].material = node.mesh.primitives[i].material
        } else {
          this.drawMeshes[this.drawMeshesIndex].material = null
        }

        const drawVerts = this.drawMeshes[this.drawMeshesIndex].drawVerts
        const drawUVs = this.drawMeshes[this.drawMeshesIndex].drawUVs
        const drawIndices = this.drawMeshes[this.drawMeshesIndex].drawIndices
        const drawColors = this.drawMeshes[this.drawMeshesIndex].drawColors
        const drawNormals = this.drawMeshes[this.drawMeshesIndex].drawNormals
        const drawJoints = this.drawMeshes[this.drawMeshesIndex].drawJoints
        const drawWeights = this.drawMeshes[this.drawMeshesIndex].drawWeights
        const drawBones = this.drawMeshes[this.drawMeshesIndex].drawBones
        const objectBuffers = this.drawMeshes[this.drawMeshesIndex].objectBuffers
        const drawVertsOrig = this.drawMeshes[this.drawMeshesIndex].drawVertsOrig

        // reset draw array for new values
        drawVerts.length = 0
        if (gpuSkinning) drawBones.length = 0

        let posData = node.mesh.primitives[i].attributes.POSITION.data
        let weights = node.mesh.primitives[i].attributes.WEIGHTS_0.data
        let joints = node.mesh.primitives[i].attributes.JOINTS_0.data
        let transformedVerts = new Float32Array(posData.length)

        for (let j = 0; j < posData.length / 3; j++) {
          if (gpuSkinning) continue
          let w = weights.subarray(j * 4, j * 4 + 4)
          let b = joints.subarray(j * 4, j * 4 + 4)
          let vin = posData.subarray(j * 3, j * 3 + 3)
          let v = [0, 0, 0],
            vsum = [0, 0, 0]

          if (morphActive) {
            vin = this.morphTargets(vin, j, morphWeights, morphTargets)
          }

          for (let i = 0; i < 4; i++) {
            vec3.transformMat4(v, vin, node.skin.joints[b[i]].boneMatrix)
            // mat4.multiplyVec3(node.skin.joints[b[i]].boneMatrix, vin, v);
            vec3.scale(v, v, w[i])
            // vec3.scale(v, w[i]);
            vec3.add(vsum, vsum, v)
            // vec3.add(vsum, v);
          }

          if (rootNodeXform) {
            // vec3.mul(vsum, vsum, rootNode.scale);
            vec3.transformMat4(vsum, vsum, parentMatrix)
            if (j == 0) {
            }
          }

          if (this.inst.isEditor || this.inst.cpuXform) {
            vec3.transformMat4(vsum, vsum, modelScaleRotate)
          }

          const x = vsum[0]
          const y = vsum[1]
          const z = vsum[2]

          if (this.inst.minBB[0] > x) this.inst.minBB[0] = x
          if (this.inst.minBB[1] > y) this.inst.minBB[1] = y
          if (this.inst.minBB[2] > z) this.inst.minBB[2] = z
          if (this.inst.maxBB[0] < x) this.inst.maxBB[0] = x
          if (this.inst.maxBB[1] < y) this.inst.maxBB[1] = y
          if (this.inst.maxBB[2] < z) this.inst.maxBB[2] = z

          transformedVerts[j * 3] = x
          transformedVerts[j * 3 + 1] = y
          transformedVerts[j * 3 + 2] = z
        }

        if (transformedVerts.length > 0 || staticGeometry || gpuSkinning) {
          if (gltf.pointBatch != undefined)
            for (let ii = 0; ii < transformedVerts.length; ii++) gltf.pointBatch.push(transformedVerts[ii])
          else {
            if (transformedVerts.length > 0) drawVerts.push(transformedVerts)
            // Only need to set once
            if (drawUVs.length === 0 && "TEXCOORD_0" in node.mesh.primitives[i].attributes) {
              drawUVs.push(new Float32Array(node.mesh.primitives[i].attributes.TEXCOORD_0.data))
            }
            if (gpuSkinning && drawVertsOrig.length === 0 && "POSITION" in node.mesh.primitives[i].attributes) {
              drawVertsOrig.push(new Float32Array(posData))
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
            if (staticGeometry) {
              if (objectBuffers.length == 0) {
                objectBuffers.push(
                  new ObjectBuffer(this.inst.renderer, this.drawMeshes[this.drawMeshesIndex], 0, gpuSkinning)
                )
              } else if (!gpuSkinning) {
                objectBuffers[0].updateVertexData(this.inst.renderer, this.drawMeshes[this.drawMeshesIndex], 0)
              }
            }
          }
        }
      }
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
        xform.push(vOut[0], vOut[1], vOut[2])
      }
      xformVerts.push(xform)
    }
    return xformVerts
  }

  // sends a list of animation names
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
      tempQuad,
      true
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
      tempQuad,
      true
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
      tempQuad,
      true
    )
  }

  updateAnimationPolygons(index, time, onScreen, deltaTime, staticGeometry, gpuSkinning) {
    this.updateAnimation(index, time, onScreen, deltaTime)
    if (onScreen) {
      this.getPolygons(staticGeometry, gpuSkinning)
      this.inst.runtime.UpdateRender()
      this.inst.updateBbox = true
    }
  }

  lerp(a, b, alpha) {
    const value = a + alpha * (b - a)
    return value
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
    // @ts-ignore
    const vec3 = globalThis.glMatrix3D.vec3
    // @ts-ignore
    const quat = globalThis.glMatrix3D.quat
    const gltf = this.gltfData
    const animationBlend = this.inst.animationBlend

    let anim = gltf.animations[index]

    // Blend state machine
    switch (this._blendState) {
      case "init":
        if (animationBlend != 0 && this._lastIndex != index) {
          this._blendState = "blend"
          this._blendTime = 0
          this._blendTarget = this._lastTarget[this._lastTargetIndex]
          if (this._lastTargetIndex == 0) {
            this._lastTargetIndex = 1
          } else {
            this._lastTargetIndex = 0
          }
          this._lastIndex = index
        }
        break
      case "blend":
        if (this._lastIndex != index) {
          this._blendState = "blend"
          this._blendTime = 0
          this._blendTarget = this._lastTarget[this._lastTargetIndex]
          if (this._lastTargetIndex == 0) {
            this._lastTargetIndex = 1
          } else {
            this._lastTargetIndex = 0
          }
          this._lastIndex = index
          break
        }
        if (this._blendTime > animationBlend) {
          this._blendState = "idle"
          break
        }
        this._blendTime += deltaTime
        break
      case "idle":
        if (this._lastIndex != index) {
          this._blendState = "blend"
          this._blendTime = 0
          this._blendTarget = this._lastTarget[this._lastTargetIndex]
          if (this._lastTargetIndex == 0) {
            this._lastTargetIndex = 1
          } else {
            this._lastTargetIndex = 0
          }
          this._lastIndex = index
        }
        break
      default:
        console.warn("[3DObject] bad blend state:", this._blendState)
    }

    this._lastTarget[this._lastTargetIndex] = []
    for (let i = 0; i < anim.channels.length; i++) {
      let c = anim.channels[i]
      let timeValues = c.sampler.input
      let otherValues = c.sampler.output.data
      let target = c.target

      if (timeValues.max[0] == timeValues.min[0]) {
        continue
      }

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

      // If not on screen no more animation required.
      if (!onScreen) continue

      //time = Math.min(Math.max(time, timeValues.min[0]), timeValues.max[0]);  //clamp
      timeValues = timeValues.data

      //find index in timeline
      let t0, t1
      for (t0 = 0, t1 = 1; t0 < timeValues.length - 1; t0++, t1++)
        if (time >= timeValues[t0] && time <= timeValues[t1]) break

      this.inst.currentAnimationFrame = t0

      let t = (time - timeValues[t0]) / (timeValues[t1] - timeValues[t0])

      this.inst.currentAnimationFrame = Math.round(t0 + t)

      // Check if invalid state, if so, skip animation
      // TODO: Change how change animation vs tick is handled to make sure this case does not happen
      if (timeValues[t1] == null) continue

      if (target.path == "translation")
        vec3.lerp(
          target.node.translation,
          otherValues.subarray(t0 * 3, t0 * 3 + 3),
          otherValues.subarray(t1 * 3, t1 * 3 + 3),
          t
        )
      else if (target.path == "rotation")
        quat.slerp(
          target.node.rotation,
          otherValues.subarray(t0 * 4, t0 * 4 + 4),
          otherValues.subarray(t1 * 4, t1 * 4 + 4),
          t
        )
      else if (target.path == "scale")
        vec3.lerp(
          target.node.scale,
          otherValues.subarray(t0 * 3, t0 * 3 + 3),
          otherValues.subarray(t1 * 3, t1 * 3 + 3),
          t
        )
      else if (target.path == "weights") {
        // Apply gltf morph target weights to node weights using lerp between two targets
        const node = target.node
        node.weights = new Float32Array(node.mesh.primitives[0].targets.length)
        const weights = node.weights
        const stride = weights.length
        for (let j = 0; j < stride; j++) {
          weights[j] = this.lerp(otherValues[t0 * stride + j], otherValues[t1 * stride + j], t)
        }
      }

      // Blend to last animation if during blend
      if (this._blendState == "blend") {
        const blend = this._blendTime == 0 ? 0 : this._blendTime / animationBlend
        const blendTarget = this._blendTarget[i]
        if (blendTarget != null) {
          if (target.path == "translation" && blendTarget.path == "translation")
            vec3.lerp(target.node.translation, blendTarget.node.translation, target.node.translation, blend)
          else if (target.path == "rotation" && blendTarget.path == "rotation")
            quat.slerp(target.node.rotation, blendTarget.node.rotation, target.node.rotation, blend)
          else if (target.path == "scale" && blendTarget.path == "scale")
            vec3.lerp(target.node.scale, blendTarget.node.scale, target.node.scale, blend)
        }
      }

      if (animationBlend != 0) {
        const lastTarget = {}
        lastTarget.node = {}
        if (target.path == "translation") {
          lastTarget.path = target.path
          lastTarget.node.translation = vec3.clone(target.node.translation)
        } else if (target.path == "rotation") {
          lastTarget.path = target.path
          lastTarget.node.rotation = quat.clone(target.node.rotation)
        } else if (target.path == "scale") {
          lastTarget.path = target.path
          lastTarget.node.scale = vec3.clone(target.node.scale)
        }
        this._lastTarget[this._lastTargetIndex].push(lastTarget)
      }
    }
  }
}

// @ts-ignore
if (!globalThis.GltfModel) {
  // @ts-ignore
  globalThis.GltfModel = GltfModelTop
}
