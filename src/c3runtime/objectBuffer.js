"use strict"
// @ts-check

// @ts-ignore
class ObjectBufferTop {
  constructor(renderer, mesh, primitiveIndex, gpuSkinning) {
    this.gl = renderer._gl
    const gl = this.gl
    this.vao = null
    this.nodeXform = new Float32Array(16)

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
    this.gl = null
    this.vao = null
    this.vertexData = null
    this.texcoordData = null
    this.indexData = null
    this.colorData = null
    this.normalData = null
    this.locAPos = null
    this.locATex = null
    this.locAColor = null
    this.locANormal = null
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
      this.locURotateMatrix = gl.getUniformLocation(shaderProgram, "uUVRotate")
      this.locURotateCenter = gl.getUniformLocation(shaderProgram, "uUVRotateCenter")
      this.locUOffsetUV = gl.getUniformLocation(shaderProgram, "uUVOffset")
      this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable")
      gl.uniformMatrix2fv(this.locURotateMatrix, false, rotateMatrix)
      gl.uniform2fv(this.locURotateCenter, rotateCenter)
      gl.uniform2fv(this.locUOffsetUV, offsetUV)
      gl.uniform1f(this.locUVXformEnable, 1.0)
    } else {
      this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable")
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
    const locUUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable")
    gl.uniform1f(locUUVXformEnable, 0.0)
  }

  draw(renderer, boneBuffer, rotateMaterial, offsetMaterial, phongEnable) {
    const gl = renderer._gl
    this._ExecuteBatch(renderer)
    if (this.vao === null) {
      this.vao = this.createVao(renderer)
    }
    gl.bindVertexArray(this.vao)
    const uvXform = this.createUVXform(rotateMaterial, offsetMaterial)
    // upload bones and enable skinning
    if (boneBuffer) {
      if (boneBuffer.skinAnimation) {
        boneBuffer.uploadUniforms(renderer, uvXform, phongEnable)
      } else {
        boneBuffer.uploadUniformsNonSkin(renderer, uvXform, phongEnable)
      }
    }
    if (uvXform.enable) {
      this.uploadUVXformUniforms(renderer, uvXform)
    }
    this.uploadNodeXformUniforms(renderer)
    gl.drawElements(gl.TRIANGLES, this.indexDataLength, gl.UNSIGNED_SHORT, 0)
    gl.bindVertexArray(null)
    if (uvXform.enable) {
      this.disableUVXformUniforms(renderer)
    }
  }
}

// @ts-ignore
if (!globalThis.ObjectBuffer) {
  globalThis.ObjectBuffer = ObjectBufferTop
}
