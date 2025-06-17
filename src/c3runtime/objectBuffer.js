"use strict"
// @ts-check

// @ts-ignore
class ObjectBufferTop {
  constructor(renderer, mesh, primitiveIndex, gpuSkinning) {
    this.gl = renderer._gl
    const gl = this.gl
    this.vao = null
    this.nodeXform = new Float32Array(16)
    this.maxJointIndexUsed = mesh.maxJointIndexUsed ?? -1; // Store max index used by this mesh primitive

    let vertexData, texcoordData, indexData, colorData, normalData, weightsData, jointsData
    if (gpuSkinning) {
      vertexData = mesh.drawVertsOrig[primitiveIndex]
    } else {
      vertexData = mesh.drawVerts[primitiveIndex]
    }
    texcoordData = mesh.drawUVs[primitiveIndex]
    if (!texcoordData || texcoordData.length == 0) {
      texcoordData = this.createDefaultTexcoordData(vertexData.length)
    }
    indexData = mesh.drawIndices[primitiveIndex]
    colorData = mesh.drawColors[primitiveIndex]
    normalData = mesh.drawNormals ? mesh.drawNormals[primitiveIndex] : null
    weightsData = mesh.drawWeights ? mesh.drawWeights[primitiveIndex] : null
    jointsData = mesh.drawJoints ? mesh.drawJoints[primitiveIndex] : null
    this.indexDataLength = indexData.length
    this.vertexData = vertexData
    this.texcoordData = texcoordData
    this.indexData = indexData
    this.colorData = colorData
    this.normalData = normalData
    this.weightsData = weightsData
    // Change jointsData to float32ARRAY FROM UINT16ARRAY
    // C3 Shader uniforms must be cast as float instead of int, unknown why
    // If non C3 shader program is used, it will not be required
    if (jointsData) {
      this.jointsData = new Float32Array(jointsData.length)
      this.jointsData.set(jointsData)
    }

    this.vertexBuffer = gl.createBuffer()
    this.texcoordBuffer = gl.createBuffer()
    this.indexBuffer = gl.createBuffer()
    if (colorData != null) {
      this.colorBuffer = gl.createBuffer()
    }
    if (normalData != null) {
      this.normalBuffer = gl.createBuffer()
    }
    if (weightsData != null) {
      this.weightsBuffer = gl.createBuffer()
    }
    if (jointsData != null) {
      this.jointsBuffer = gl.createBuffer()
    }
    // Fill all buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer)
    if (!this.texcoordData || this.texcoordData.length == 0) {
    }
    gl.bufferData(gl.ARRAY_BUFFER, this.texcoordData, gl.STATIC_DRAW)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData, gl.STATIC_DRAW)

    if (colorData != null) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.colorData, gl.STATIC_DRAW)
    }
    if (normalData != null) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.normalData, gl.STATIC_DRAW)
    }
    if (weightsData != null) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.weightsBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.weightsData, gl.STATIC_DRAW)
    }
    if (jointsData != null) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.jointsBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.jointsData, gl.STATIC_DRAW)
    }

    // vao created at draw time to insure the correct shader is used
    this.locURotateMatrix = null;
    this.locURotateCenter = null;
    this.locUOffsetUV = null;
    this.locUVXformEnable = null;
  }

  _ExecuteBatch(renderer) {
    if (renderer._batchPtr === 0) {
      return
    }
    if (renderer.IsContextLost()) return
    // renderer._WriteBuffers()
    renderer._ExecuteBatch()
    renderer._batchPtr = 0
    renderer._vertexPtr = 0
    renderer._texPtr = 0
    renderer._pointPtr = 0
    renderer._topOfBatch = 0
  }

  _updateShader(shaderProgram) {
    if (this.boundProgram === shaderProgram) return;

    this.boundProgram = shaderProgram;
    const gl = this.gl;
    this.locURotateMatrix = gl.getUniformLocation(shaderProgram, "uUVRotate");
    this.locURotateCenter = gl.getUniformLocation(shaderProgram, "uUVRotateCenter");
    this.locUOffsetUV = gl.getUniformLocation(shaderProgram, "uUVOffset");
    this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");
  }

  createVao(renderer) {
    const gl = renderer._gl
    const batchState = renderer._batchState
    const shaderProgram = batchState.currentShader._shaderProgram
    this.locAPos = gl.getAttribLocation(shaderProgram, "aPos")
    this.locATex = gl.getAttribLocation(shaderProgram, "aTex")
    this.locAColor = gl.getAttribLocation(shaderProgram, "aColor")
    this.locANormal = gl.getAttribLocation(shaderProgram, "aNormal")
    this.locAWeights = gl.getAttribLocation(shaderProgram, "aWeights")
    this.locAJoints = gl.getAttribLocation(shaderProgram, "aJoints")

    const locAPos = this.locAPos
    const locATex = this.locATex
    const locAColor = this.locAColor
    const locANormal = this.locANormal
    const locAWeights = this.locAWeights
    const locAJoints = this.locAJoints
    const vB = this.vertexBuffer
    const tB = this.texcoordBuffer
    const cB = this.colorBuffer
    const nB = this.normalBuffer
    const jB = this.jointsBuffer
    const wB = this.weightsBuffer

    if (locAJoints == -1) {
      console.error("locAJoints == -1")
    }

    if (locAWeights == -1) {
      console.error("locAWeights == -1")
    }
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    gl.bindBuffer(gl.ARRAY_BUFFER, vB)
    gl.vertexAttribPointer(locAPos, 3, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(locAPos)
    gl.bindBuffer(gl.ARRAY_BUFFER, tB)
    gl.vertexAttribPointer(locATex, 2, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(locATex)
    if (cB != null && locAColor != -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, cB)
      gl.vertexAttribPointer(locAColor, 3, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(locAColor)
    }
    if (nB != null && locANormal != -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, nB)
      gl.vertexAttribPointer(locANormal, 3, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(locANormal)
    }
    if (wB != null && locAWeights != -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, wB)
      gl.vertexAttribPointer(locAWeights, 4, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(locAWeights)
    }
    if (jB != null && locAJoints != -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, jB)
      gl.vertexAttribPointer(locAJoints, 4, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(locAJoints)
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)

    gl.bindVertexArray(null)

    return vao
  }

  createUVXform(rotateMaterial, offsetMaterial) {
    if (!rotateMaterial && !offsetMaterial) {
      return { enable: false }
    }
    const mat2 = globalThis.glMatrix3D.mat2
    const vec2 = globalThis.glMatrix3D.vec2
    let effectiveRotateMaterial = rotateMaterial ? { ...rotateMaterial } : { angle: 0, centerX: 0, centerY: 0 }
    let effectiveOffsetMaterial = offsetMaterial ? { ...offsetMaterial } : { u: 0, v: 0 }

    const rotateMatrix = mat2.create()
    mat2.fromRotation(rotateMatrix, effectiveRotateMaterial.angle)
    const rotateCenter = vec2.fromValues(effectiveRotateMaterial.x, effectiveRotateMaterial.y)
    const offsetUV = vec2.fromValues(effectiveOffsetMaterial.u, effectiveOffsetMaterial.v)
    const uvXform = {
      enable: true,
      rotateMatrix,
      rotateCenter,
      offsetUV,
    }
    return uvXform
  }

  uploadUVXformUniforms(renderer, uvXform) {
    const gl = renderer._gl
    const shaderProgram = renderer._batchState.currentShader._shaderProgram
    if (uvXform.enable) {
      const rotateMatrix = uvXform.rotateMatrix
      const rotateCenter = uvXform.rotateCenter
      const offsetUV = uvXform.offsetUV
      if (this.locURotateMatrix === null) {
        this.locURotateMatrix = gl.getUniformLocation(shaderProgram, "uUVRotate")
        this.locURotateCenter = gl.getUniformLocation(shaderProgram, "uUVRotateCenter")
        this.locUOffsetUV = gl.getUniformLocation(shaderProgram, "uUVOffset")
        this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable")
      }
      gl.uniformMatrix2fv(this.locURotateMatrix, false, rotateMatrix)
      gl.uniform2fv(this.locURotateCenter, rotateCenter)
      gl.uniform2fv(this.locUOffsetUV, offsetUV)
      gl.uniform1f(this.locUVXformEnable, 1.0)
    } else {
      if (this.locUVXformEnable === null) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable")
      gl.uniform1f(this.locUVXformEnable, 0.0)
    }
  }

  uploadNodeXformUniforms(renderer) {
    const gl = renderer._gl
    const shaderProgram = renderer._batchState.currentShader._shaderProgram
    const locUNodeXform = gl.getUniformLocation(shaderProgram, "uNodeXform")
    gl.uniformMatrix4fv(locUNodeXform, false, this.nodeXform)
    // const locUNodeXformEnable = gl.getUniformLocation(shaderProgram, "uNodeXformEnable")
    // gl.uniform1f(locUNodeXformEnable, 1.0)
  }

  disableUVXformUniforms(renderer) {
    const gl = renderer._gl
    const shaderProgram = renderer._batchState.currentShader._shaderProgram
    if (this.locUVXformEnable === null) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable")
    gl.uniform1f(this.locUVXformEnable, 0.0)
  }

  draw(renderer, instanceBoneBuffer, modelGltfData, rotateMaterial, offsetMaterial, phongEnable) {
    const gl = renderer._gl;
    this._ExecuteBatch(renderer); // Flushes any pending C2 draw calls
    if (this.vao === null) {
      this.vao = this.createVao(renderer);
    }
    gl.bindVertexArray(this.vao);
    const uvXform = this.createUVXform(rotateMaterial, offsetMaterial);

    if (instanceBoneBuffer && instanceBoneBuffer.skinAnimation) {
        // --- Skinning Path --- 
        const sharedModelUbo = modelGltfData ? modelGltfData.getOrCreateModelBoneUbo(renderer) : null;
        // instanceBoneBuffer.uploadUniforms handles UBO, skin flags, rootNodeXform, UV xform, and dummy fallback
        instanceBoneBuffer.uploadUniforms(sharedModelUbo, uvXform, phongEnable);
        // Note: NodeXform from ObjectBuffer is not used in the skinning path; uRootNodeXform from BoneBuffer is used.

    } else {
        // --- Non-Skinning Path (or no specific instanceBoneBuffer for skinning) ---
        let nodeXformUploadedByBoneBuffer = false;
        if (instanceBoneBuffer) { // E.g., a BoneBuffer present but skinAnimation is false
            instanceBoneBuffer.uploadUniformsNonSkin(renderer, uvXform, phongEnable);
            // uploadUniformsNonSkin handles dummy UBO, skin disable, UV xform, and also uploads BoneBuffer.nodeXform if present.
            if (instanceBoneBuffer.nodeXform) {
                 nodeXformUploadedByBoneBuffer = true; // Assume BoneBuffer handled nodeXform if it has one
            }
        } else {
            // No BoneBuffer instance provided at all.
            // ObjectBuffer must handle UV transforms and potentially dummy UBO for "Bones" block.
            this._disableGPUSkinning(renderer);
            if (uvXform.enable) {
                this.uploadUVXformUniforms(renderer, uvXform);
            } else {
                this.disableUVXformUniforms(renderer);
            }

            // Manually handle dummy UBO binding if shader expects "Bones" and no BoneBuffer did it.
            const shaderProgram = renderer._batchState.currentShader._shaderProgram;
            // Check if globalThis.BoneBuffer (the class) exists before accessing its static members
            if (globalThis.BoneBuffer) { // Check if BoneBuffer class is available
                const blockIndex = gl.getUniformBlockIndex(shaderProgram, "Bones");
                if (blockIndex !== gl.INVALID_INDEX && blockIndex !== -1) { // Shader expects the Bones UBO
                    gl.uniformBlockBinding(shaderProgram, blockIndex, globalThis.BoneBuffer.BONE_UBO_BINDING_POINT);
                    const dummyUBO = globalThis.BoneBuffer._getOrCreateDummyUBO(gl);
                    if (dummyUBO) {
                        gl.bindBufferBase(gl.UNIFORM_BUFFER, globalThis.BoneBuffer.BONE_UBO_BINDING_POINT, dummyUBO);
                    }
                    // Ensure uSkinEnable is off if we bound a dummy here.
                    // This might be redundant if the shader properly defaults or if uSkinEnable is always set.
                    const locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable");
                    if (locUSkinEnable) gl.uniform1f(locUSkinEnable, 0.0);
                } else {
                    // Shader does not expect "Bones" block, do nothing for UBO.
                }
            } else {
                 // BoneBuffer class not globally available, cannot manage dummy UBO here.
                 // Check if shader expects it and warn if so, as it might lead to issues.
                 const blockIndex = gl.getUniformBlockIndex(shaderProgram, "Bones");
                 if (blockIndex !== gl.INVALID_INDEX && blockIndex !== -1) {
                    console.warn("ObjectBuffer: globalThis.BoneBuffer not found, cannot bind dummy UBO even though shader expects 'Bones' block.");
                 }
            }
            // Phong enable still needs to be set in this path if not handled by a BoneBuffer
            const locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable");
            if (locUPhongEnable) gl.uniform1f(locUPhongEnable, phongEnable ? 1.0 : 0.0);
        }

        // Upload node transform if not handled by a BoneBuffer instance (non-skinned path)
        if (!nodeXformUploadedByBoneBuffer) {
            this.uploadNodeXformUniforms(renderer);
        }
    }

    // --- Draw Call (Common for all paths) ---
    gl.drawElements(gl.TRIANGLES, this.indexDataLength, gl.UNSIGNED_SHORT, 0);

    // Unbind VAO once after all drawing paths
    gl.bindVertexArray(null);
    // Note: UBO unbinding from the binding point (BoneBufferTop.BONE_UBO_BINDING_POINT)
    // is implicitly handled by the next bindBufferBase or if nothing else binds to it.
    // No explicit unbind is strictly necessary here for bindBufferBase.
  }

  _disableGPUSkinning(renderer) {
    const gl = renderer._gl;
    const shaderProgram = renderer._batchState.currentShader._shaderProgram;
    const locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable");
    const locUNodeXformEnable = gl.getUniformLocation(shaderProgram, "uNodeXformEnable");
    if (locUSkinEnable) gl.uniform1f(locUSkinEnable, 0.0);
    if (locUNodeXformEnable) gl.uniform1f(locUNodeXformEnable, 0.0);
  }

  createDefaultTexcoordData(length) {
    const texcoordData = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      texcoordData[i] = 0.5
    }
    return texcoordData
  }

  setNodeXform(nodeXform) {
    this.nodeXform = nodeXform
  }

  updateVertexData(renderer, mesh, primitiveIndex) {
    const gl = renderer._gl
    const vertexData = mesh.drawVerts[primitiveIndex]

    // Fill only vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW)
  }

  release() {
    const gl = this.gl
    if (this.vertexBuffer) {
      gl.deleteBuffer(this.vertexBuffer)
      this.vertexBuffer = null
    }
    if (this.texcoordBuffer) {
      gl.deleteBuffer(this.texcoordBuffer)
      this.texcoordBuffer = null
    }
    if (this.indexBuffer) {
      gl.deleteBuffer(this.indexBuffer)
      this.indexBuffer = null
    }
    if (this.vao) {
      gl.deleteVertexArray(this.vao)
      this.vao = null
    }
    if (this.colorBuffer) {
      gl.deleteBuffer(this.colorBuffer)
      this.colorBuffer = null
    }
    if (this.normalBuffer) {
      gl.deleteBuffer(this.normalBuffer)
      this.normalBuffer = null
    }
    if (this.weightsBuffer) {
      gl.deleteBuffer(this.weightsBuffer)
      this.weightsBuffer = null
    }
    if (this.jointsBuffer) {
      gl.deleteBuffer(this.jointsBuffer)
      this.jointsBuffer = null
    }
    this.gl = null
    this.vertexData = null
    this.texcoordData = null
    this.indexData = null
    this.colorData = null
    this.normalData = null
    this.weightsData = null
    this.jointsData = null
    this.locAPos = null
    this.locATex = null
    this.locAColor = null
    this.locANormal = null
    this.locAWeights = null
    this.locAJoints = null
    this.nodeXform = null
    this.vao = null
    this.locURotateMatrix = null;
    this.locURotateCenter = null;
    this.locUOffsetUV = null;
    this.locUVXformEnable = null;
  }
}

// @ts-ignore
if (!globalThis.ObjectBuffer) {
  globalThis.ObjectBuffer = ObjectBufferTop
}
