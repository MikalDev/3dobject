class BoneBufferTop {
  constructor(renderer, numBones, skinAnimation = false) {
    const gl = renderer._gl
    if (skinAnimation) {
      this.bones = new Float32Array(numBones * 16)
      this.nodeXform = null
      this.rootNodeXform = new Float32Array(16)
    } else {
      this.nodeXform = new Float32Array(16)
      this.bones = null
      this.rootNodeXform = null
    }
    this.skinAnimation = skinAnimation
    this.bonesLoaded = false
    this.locURotateMatrix = -1
    this.locURotateCenter = -1
    this.locUOffsetUV = -1
    this.locUVXformEnable = -1
    this.locABones = -1
    this.locUSkinEnable = -1
    this.locARootNodeXform = -1
    this.locUNodeXformEnable = -1
    this.locANodeXform = -1
  }

  setBone(jointIndex, matrix) {
    if (this.bones) {
      const offset = jointIndex * 16
      for (let i = 0; i < 16; i++) {
        this.bones[offset + i] = matrix[i]
      }
      this.bonesLoaded = true
    } else {
      console.warn("BoneBuffer: No bones array allocated")
    }
  }

  setBones(matrices) {
    if (this.bones) {
      this.bones.set(matrices)
    } else {
      console.warn("BoneBuffer: No bones array allocated")
    }
  }

  setRootNodeXform(matrix) {
    if (this.rootNodeXform) {
      this.rootNodeXform.set(matrix)
    } else {
      console.warn("BoneBuffer: No rootNodeXform array allocated")
    }
  }

  setNodeXform(matrix) {
    if (this.nodeXform) {
      this.nodeXform.set(matrix)
    } else {
      console.warn("BoneBuffer: No nodeXform array allocated")
    }
  }

  uploadUVXformUniforms(renderer, uvXform) {
    const gl = renderer._gl
    const shaderProgram = renderer._batchState.currentShader._shaderProgram
    if (uvXform.enable) {
      const rotateMatrix = uvXform.rotateMatrix
      const rotateCenter = uvXform.rotateCenter
      const offsetUV = uvXform.offsetUV
      if (this.locURotateMatrix == -1) this.locURotateMatrix = gl.getUniformLocation(shaderProgram, "uUVRotate")
      if (this.locURotateCenter == -1) this.locURotateCenter = gl.getUniformLocation(shaderProgram, "uUVRotateCenter")
      if (this.locUOffsetUV == -1) this.locUOffsetUV = gl.getUniformLocation(shaderProgram, "uUVOffset")
      if (this.locUVXformEnable == -1) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable")
      gl.uniformMatrix2fv(this.locURotateMatrix, false, rotateMatrix)
      gl.uniform2fv(this.locURotateCenter, rotateCenter)
      gl.uniform2fv(this.locUOffsetUV, offsetUV)
      gl.uniform1f(this.locUVXformEnable, 1.0)
    } else {
      this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable")
      gl.uniform1f(this.locUVXformEnable, 0.0)
    }
  }

  uploadUniforms(renderer, uvXform, phongEnable) {
    const gl = renderer._gl
    const shaderProgram = renderer._batchState.currentShader._shaderProgram
    if (this.locABones == -1) this.locABones = gl.getUniformLocation(shaderProgram, "uBones")
    if (this.locUSkinEnable == -1) this.locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable")
    if (this.locARootNodeXform == -1) this.locARootNodeXform = gl.getUniformLocation(shaderProgram, "uRootNodeXform")
    gl.uniformMatrix4fv(this.locABones, false, this.bones)
    gl.uniform1f(this.locUSkinEnable, 1.0)
    gl.uniformMatrix4fv(this.locARootNodeXform, false, this.rootNodeXform)
    this.uploadUVXformUniforms(renderer, uvXform)
    const locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable")
    gl.uniform1f(locUPhongEnable, phongEnable ? 1 : 0)
  }

  uploadUniformsNonSkin(renderer, uvXform, phongEnable) {
    const gl = renderer._gl
    const shaderProgram = renderer._batchState.currentShader._shaderProgram
    if (this.locUSkinEnable == -1) this.locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable")
    if (this.locUNodeXformEnable == -1)
      this.locUNodeXformEnable = gl.getUniformLocation(shaderProgram, "uNodeXformEnable")
    if (this.locANodeXform == -1) this.locANodeXform = gl.getUniformLocation(shaderProgram, "uNodeXform")
    gl.uniform1f(this.locUSkinEnable, 0.0)
    gl.uniform1f(this.locUNodeXformEnable, 1.0)
    gl.uniformMatrix4fv(this.locANodeXform, false, this.nodeXform)
    this.uploadUVXformUniforms(renderer, uvXform)
    const locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable")
    gl.uniform1f(locUPhongEnable, phongEnable ? 1 : 0)
  }

  disable(renderer) {
    const gl = renderer._gl
    const shaderProgram = renderer._batchState.currentShader._shaderProgram
    if (this.locUSkinEnable == -1) this.locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable")
    if (this.locUNodeXformEnable == -1)
      this.locUNodeXformEnable = gl.getUniformLocation(shaderProgram, "uNodeXformEnable")
    if (this.locUUVXformEnable == -1) this.locUUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable")
    if (this.locUPhongEnable == -1) this.locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable")
    if (this.locUNodeXformEnable == -1 || this.locUSkinEnable == -1) {
      console.error("locUNodeXformEnable == -1", this.locUNodeXformEnable)
      console.error("locUSkinEnable == -1", this.locUSkinEnable)
    }
    gl.uniform1f(this.locUSkinEnable, 0.0)
    gl.uniform1f(this.locUNodeXformEnable, 0.0)
    gl.uniform1f(this.locUUVXformEnable, 0.0)
    gl.uniform1f(this.locUPhongEnable, 0.0)
  }
}

// @ts-ignore
if (!globalThis.BoneBuffer) {
  globalThis.BoneBuffer = BoneBufferTop
}
