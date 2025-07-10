// @ts-nocheck
const MAX_BONES = 256;
// REMOVED: const BONE_UBO_BINDING_POINT = 0;

class BoneBufferTop {
  // Static properties for shared resources
  static BONE_UBO_BINDING_POINT = 0;
  static dummyUBO = null;
  static _DUMMY_UBO_SIZE = MAX_BONES * 16 * 4; // Size for MAX_BONES matrices * 16 floats/matrix * 4 bytes/float

  // Static method to get or create the dummy UBO
  static _getOrCreateDummyUBO(gl) {
    if (!BoneBufferTop.dummyUBO) {
      console.log(`Creating dummy Bone UBO (Size: ${BoneBufferTop._DUMMY_UBO_SIZE} bytes for ${MAX_BONES} bones)`);
      BoneBufferTop.dummyUBO = gl.createBuffer();
      // Create dummy data array large enough for the full UBO size
      const dummyData = new Float32Array(BoneBufferTop._DUMMY_UBO_SIZE / 4).fill(0);
      // Optionally fill the first matrix with identity if needed for non-skinned defaults
      // const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
      // dummyData.set(identity, 0);

      gl.bindBuffer(gl.UNIFORM_BUFFER, BoneBufferTop.dummyUBO);
      // Allocate storage and initialize with zeros
      gl.bufferData(gl.UNIFORM_BUFFER, dummyData, gl.STATIC_DRAW);
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);
      
      // Bind the newly created dummy UBO to the designated binding point immediately
      console.log(`Binding newly created dummy UBO to binding point ${BoneBufferTop.BONE_UBO_BINDING_POINT}`);
      gl.bindBufferBase(gl.UNIFORM_BUFFER, BoneBufferTop.BONE_UBO_BINDING_POINT, BoneBufferTop.dummyUBO);

      if (!BoneBufferTop.dummyUBO) {
         console.error("Failed to create dummy Bone UBO!");
         return null; // Explicitly return null on failure
      }
    }
    return BoneBufferTop.dummyUBO;
  }

  // Static method to release shared resources (call on context loss/shutdown)
  static releaseSharedResources(gl) {
      if (BoneBufferTop.dummyUBO) {
          console.log("Deleting dummy Bone UBO");
          gl.deleteBuffer(BoneBufferTop.dummyUBO);
          BoneBufferTop.dummyUBO = null;
      }
  }

  constructor(renderer, bonesInThisModel, skinAnimation = false) {
    this.gl = renderer._gl;
    this.rendererForShaderAccess = renderer; // For _batchState access
    this.skinAnimation = skinAnimation;
    this.bonesLoaded = false;
    this.blockIndex = -1;

    if (skinAnimation) {
      this.bonesPerModelAsset = bonesInThisModel > 0 ? bonesInThisModel : 1; // Ensure at least 1 to avoid zero-size array if bonesInThisModel is 0
      this.bones = new Float32Array(this.bonesPerModelAsset * 16);
      this.nodeXform = null;
      this.rootNodeXform = new Float32Array(16);
      this.ubo = null; // Does NOT create its own UBO for skinning path anymore
    } else {
      this.bonesPerModelAsset = 0;
      this.nodeXform = new Float32Array(16);
      this.bones = null;
      this.rootNodeXform = null;
      this.ubo = null; // Does not have a UBO in non-skinning path either
    }

    // Uniform locations
    this.locURotateMatrix = null;
    this.locURotateCenter = null;
    this.locUOffsetUV = null;
    this.locUVXformEnable = null;
    this.locUSkinEnable = null;
    this.locARootNodeXform = null;
    this.locUNodeXformEnable = null;
    this.locANodeXform = null;
    this.locUPhongEnable = null;
  }

  release() {
    // No UBO to delete here, as it doesn't own one for skinning.
    // The shared UBO is managed by gltfData.
    
    this.bones = null;
    this.nodeXform = null;
    this.rootNodeXform = null;
    this.gl = null;
    this.rendererForShaderAccess = null;
    // Reset other properties as before
    this.locURotateMatrix = null;
    this.locURotateCenter = null;
    this.locUOffsetUV = null;
    this.locUVXformEnable = null;
    this.locUSkinEnable = null;
    this.locARootNodeXform = null;
    this.locUNodeXformEnable = null;
    this.locANodeXform = null;
    this.locUPhongEnable = null;
    this.skinAnimation = null;
    this.bonesLoaded = null;
    this.blockIndex = -1;
  }

  _updateShader(shaderProgram) {
    if (this.boundProgram === shaderProgram) return;

    this.boundProgram = shaderProgram;
    const gl = this.gl;

    if (this.locURotateMatrix === null || true) {
      this.locURotateMatrix = gl.getUniformLocation(shaderProgram, "uUVRotate");
      this.locURotateCenter = gl.getUniformLocation(shaderProgram, "uUVRotateCenter");
      this.locUOffsetUV = gl.getUniformLocation(shaderProgram, "uUVOffset");
      this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");
    }

    this.locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable");
    this.locARootNodeXform = gl.getUniformLocation(shaderProgram, "uRootNodeXform");
    this.locUNodeXformEnable = gl.getUniformLocation(shaderProgram, "uNodeXformEnable");
    this.locANodeXform = gl.getUniformLocation(shaderProgram, "uNodeXform");
    this.locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable");

    this.blockIndex = gl.getUniformBlockIndex(shaderProgram, "Bones");
    if (this.blockIndex === gl.INVALID_INDEX) {
        this.blockIndex = -1;
    } else {
        gl.uniformBlockBinding(shaderProgram, this.blockIndex, BoneBufferTop.BONE_UBO_BINDING_POINT);
    }
  }

  setBone(jointIndex, matrix) {
    if (this.bones && jointIndex < this.bonesPerModelAsset) { 
      const offset = jointIndex * 16;
      this.bones.set(matrix, offset); 
      this.bonesLoaded = true;
    } else if (this.skinAnimation && jointIndex >= this.bonesPerModelAsset) {
        console.warn(`BoneBuffer: Joint index ${jointIndex} exceeds bonesPerModelAsset (${this.bonesPerModelAsset}).`);
    } else if (this.skinAnimation) {
      console.warn("BoneBuffer: Attempt to set bone, but no bones array allocated or not skinning.");
    }
  }

  setBones(matrices) {
    if (this.bones && this.skinAnimation) {
        const numMatricesToCopy = Math.min(matrices.length / 16, this.bonesPerModelAsset);
        if (numMatricesToCopy * 16 < matrices.length) {
            // console.warn(`BoneBuffer: Input matrices count (${matrices.length / 16}) exceeds bonesPerModelAsset (${this.bonesPerModelAsset}). Truncating.`);
        }
        this.bones.set(matrices.subarray(0, numMatricesToCopy * 16));
        this.bonesLoaded = true; 
    } else if (this.skinAnimation) {
      console.warn("BoneBuffer: Attempt to set bones, but no bones array allocated or not skinning.");
    }
  }

  setRootNodeXform(matrix) {
    if (this.rootNodeXform) {
      this.rootNodeXform.set(matrix)
    } else {
      // console.warn("BoneBuffer: No rootNodeXform array allocated") // Can be noisy if called for non-skinned
    }
  }

  setNodeXform(matrix) {
    if (this.nodeXform) {
      this.nodeXform.set(matrix)
    } else {
      // console.warn("BoneBuffer: No nodeXform array allocated") // Can be noisy if called for skinned
    }
  }

  uploadUVXformUniforms(renderer, uvXform) {
    const gl = renderer._gl; // Use passed renderer consistently
    const shaderProgram = renderer._batchState.currentShader._shaderProgram;
    const rotateMatrix = uvXform.rotateMatrix;
    const rotateCenter = uvXform.rotateCenter;
    const offsetUV = uvXform.offsetUV;
    
    this._updateShader(shaderProgram);

    if (this.locURotateMatrix === null || true) {
      this.locURotateMatrix = gl.getUniformLocation(shaderProgram, "uUVRotate");
      this.locURotateCenter = gl.getUniformLocation(shaderProgram, "uUVRotateCenter");
      this.locUOffsetUV = gl.getUniformLocation(shaderProgram, "uUVOffset");
      this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");
    }

    if (this.locURotateMatrix) gl.uniformMatrix2fv(this.locURotateMatrix, false, rotateMatrix);
    if (this.locURotateCenter) gl.uniform2fv(this.locURotateCenter, rotateCenter);
    if (this.locUOffsetUV) gl.uniform2fv(this.locUOffsetUV, offsetUV);
    if (this.locUVXformEnable) gl.uniform1f(this.locUVXformEnable, 1.0);
  }

  uploadUniforms(targetSharedGpuUbo, uvXform, phongEnable) {
    const gl = this.gl;
    const shaderProgram = this.rendererForShaderAccess._batchState.currentShader._shaderProgram;

    this._updateShader(shaderProgram);

    // --- UBO Handling --- 
    // This BoneBuffer instance does not own the UBO. It uploads to the targetSharedGpuUbo.
    if (!this.skinAnimation) {
        console.error("BoneBuffer: uploadUniforms called but skinAnimation is false. This should go via uploadUniformsNonSkin.");
        this.uploadUniformsNonSkin(this.rendererForShaderAccess, uvXform, phongEnable); // Redirect to be safe
        return;
    }

    // Get and cache block index if shader program changed
    if (this.blockIndex === -1) {
        this.blockIndex = gl.getUniformBlockIndex(shaderProgram, "Bones");
        if (this.blockIndex === gl.INVALID_INDEX) {
            console.warn("BoneBuffer: Could not find 'Bones' uniform block in shader. Skinning may not work.");
        } else if (this.blockIndex !== null) {
            gl.uniformBlockBinding(shaderProgram, this.blockIndex, BoneBufferTop.BONE_UBO_BINDING_POINT);
        }
    }
    
    if (this.blockIndex !== -1 && this.blockIndex !== null) { // Proceed only if block index is valid for skinning shader
        if (targetSharedGpuUbo && this.bones) {
            gl.bindBuffer(gl.UNIFORM_BUFFER, targetSharedGpuUbo);
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.bones); // Upload the entire instance-specific bone data
            gl.bindBuffer(gl.UNIFORM_BUFFER, null); // Unbind from the general binding point

            // Bind the UBO to the specific binding point for this draw call
            gl.bindBufferBase(gl.UNIFORM_BUFFER, BoneBufferTop.BONE_UBO_BINDING_POINT, targetSharedGpuUbo);
        } else if (!targetSharedGpuUbo) {
            console.warn("BoneBuffer (Skinned Path): Shader expects 'Bones' UBO, but no targetSharedGpuUbo provided. Binding dummy.");
            const dummyUBO = BoneBufferTop._getOrCreateDummyUBO(gl);
            if (dummyUBO) {
               gl.bindBufferBase(gl.UNIFORM_BUFFER, BoneBufferTop.BONE_UBO_BINDING_POINT, dummyUBO);
            }
        } else if (!this.bones) {
             console.warn("BoneBuffer (Skinned Path): targetSharedGpuUbo provided, but this.bones is null.");
        }
    } else {
        // Shader does not have 'Bones' block, but we are in skinning path. This is unusual.
        // console.warn("BoneBuffer (Skinned Path): Shader does not have 'Bones' UBO block. No UBO bound.");
    }
    // --- End UBO Handling ---

    // --- Other Uniforms (Instance Specific) ---
    if (this.locUSkinEnable === null || true) {
      this.locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable");
      this.locARootNodeXform = gl.getUniformLocation(shaderProgram, "uRootNodeXform");
      this.locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable");
    }
    
    if (this.locUSkinEnable) gl.uniform1f(this.locUSkinEnable, 1.0); // Enable skinning
    if (this.locARootNodeXform && this.rootNodeXform) gl.uniformMatrix4fv(this.locARootNodeXform, false, this.rootNodeXform);

    if (uvXform.enable) { 
        this.uploadUVXformUniforms(this.rendererForShaderAccess, uvXform);
    } else {
        if (this.locUVXformEnable === null || true) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");
        if (this.locUVXformEnable) gl.uniform1f(this.locUVXformEnable, 0.0);
    }
    
    if (this.locUPhongEnable) gl.uniform1f(this.locUPhongEnable, phongEnable ? 1.0 : 0.0);
  }

  uploadUniformsNonSkin(renderer, uvXform, phongEnable) {
    const gl = renderer._gl; // Use passed renderer
    const shaderProgram = renderer._batchState.currentShader._shaderProgram;

    // --- Bind Dummy UBO if shader expects 'Bones' block --- //
    if (this.blockIndex === -1) { // Check/update block index cache
        this.blockIndex = gl.getUniformBlockIndex(shaderProgram, "Bones");
        if (this.blockIndex !== gl.INVALID_INDEX && this.blockIndex !== null) {
             // Associate the shader's uniform block with the binding point if it exists.
            gl.uniformBlockBinding(shaderProgram, this.blockIndex, BoneBufferTop.BONE_UBO_BINDING_POINT);
        }
    }

    if (this.blockIndex !== -1 && this.blockIndex !== null) { // Shader has the 'Bones' block
        const dummyUBO = BoneBufferTop._getOrCreateDummyUBO(gl);
        if (dummyUBO) {
           gl.bindBufferBase(gl.UNIFORM_BUFFER, BoneBufferTop.BONE_UBO_BINDING_POINT, dummyUBO);
        } else {
            console.error("BoneBuffer (NonSkin): Shader expects 'Bones' UBO, but dummy UBO creation failed.");
        }
    } else {
        // Shader does not have the 'Bones' block, no need to bind anything to that point.
    }
    // --- End Dummy UBO Handling ---

    // --- Other Uniforms for Non-Skinned Path ---
    if (this.locUSkinEnable === null || true) {
      this.locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable");
      this.locUNodeXformEnable = gl.getUniformLocation(shaderProgram, "uNodeXformEnable");
      this.locANodeXform = gl.getUniformLocation(shaderProgram, "uNodeXform");
      this.locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable");
    }

    if (this.locUSkinEnable) gl.uniform1f(this.locUSkinEnable, 0.0); // Disable skinning
    if (this.locUNodeXformEnable) gl.uniform1f(this.locUNodeXformEnable, 1.0); // Enable node transform
    if (this.locANodeXform && this.nodeXform) gl.uniformMatrix4fv(this.locANodeXform, false, this.nodeXform);

    if (uvXform.enable) { 
        this.uploadUVXformUniforms(renderer, uvXform); // Pass renderer
    } else {
        if (this.locUVXformEnable === null || true) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");
        if (this.locUVXformEnable) gl.uniform1f(this.locUVXformEnable, 0.0);
    }

    if (this.locUPhongEnable) gl.uniform1f(this.locUPhongEnable, phongEnable ? 1.0 : 0.0);
  }

  disable(renderer) {
       const gl = renderer._gl;
       const shaderProgram = renderer._batchState.currentShader._shaderProgram;
       if (this.locUVXformEnable === null || true) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");
       if (this.locUVXformEnable) gl.uniform1f(this.locUVXformEnable, 0.0);
       // Potentially disable other things if this method is still used broadly.
       // If skinning was active and this instance is being disabled, ensure skinning uniform is off.
       // if (this.locUSkinEnable) gl.uniform1f(this.locUSkinEnable, 0.0);
  }
}

// @ts-ignore
if (!globalThis.BoneBuffer) {
  globalThis.BoneBuffer = BoneBufferTop;
}
