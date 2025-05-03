// @ts-nocheck
const MAX_BONES = 256;
// REMOVED: const BONE_UBO_BINDING_POINT = 0;

class BoneBufferTop {
  // Static properties for shared resources
  static BONE_UBO_BINDING_POINT = 0;
  static dummyUBO = null;
  static _DUMMY_UBO_SIZE = 1 * 16 * 4; // Size for 1 matrix * 16 floats/matrix * 4 bytes/float

  // Static method to get or create the dummy UBO
  static _getOrCreateDummyUBO(gl) {
    if (!BoneBufferTop.dummyUBO) {
      console.log("Creating dummy Bone UBO");
      BoneBufferTop.dummyUBO = gl.createBuffer();
      const dummyData = new Float32Array(BoneBufferTop._DUMMY_UBO_SIZE / 4).fill(0);
      // Could fill with identity: const dummyData = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

      gl.bindBuffer(gl.UNIFORM_BUFFER, BoneBufferTop.dummyUBO);
      gl.bufferData(gl.UNIFORM_BUFFER, dummyData, gl.STATIC_DRAW);
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);

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

  constructor(renderer, numBones, skinAnimation = false) {
    const gl = renderer._gl;
    this.gl = gl; // Store gl context
    this.skinAnimation = skinAnimation;
    this.bonesLoaded = false;
    this.ubo = null; // Initialize UBO property
    this.blockIndex = -1; // Initialize block index cache
    this.boundProgram = null; // Track program for which block index is cached

    if (skinAnimation) {
      // Ensure bones array matches MAX_BONES for UBO compatibility
      this.bones = new Float32Array(MAX_BONES * 16);
      this.nodeXform = null;
      this.rootNodeXform = new Float32Array(16);

      // --- Create and initialize UBO ---
      this.ubo = gl.createBuffer();
      const uboSize = MAX_BONES * 16 * 4; // 256 matrices * 16 floats/matrix * 4 bytes/float
      gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
      // Allocate buffer storage
      gl.bufferData(gl.UNIFORM_BUFFER, uboSize, gl.DYNAMIC_DRAW);
      // Unbind buffer
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);
      // ---------------------------------

    } else {
      this.nodeXform = new Float32Array(16);
      this.bones = null;
      this.rootNodeXform = null;
    }

    // Removed texture-related uniform locations
    this.locURotateMatrix = -1;
    this.locURotateCenter = -1;
    this.locUOffsetUV = -1;
    this.locUVXformEnable = -1;
    // Removed locABones
    this.locUSkinEnable = -1;
    this.locARootNodeXform = -1;
    this.locUNodeXformEnable = -1;
    this.locANodeXform = -1;
  }

  release() {
    // Delete UBO if it exists
    if (this.ubo) {
      this.gl.deleteBuffer(this.ubo);
      this.ubo = null;
    }
    
    // Release typed arrays
    this.bones = null;
    this.nodeXform = null;
    this.rootNodeXform = null;
    
    // Reset shader locations (most removed, kept relevant ones)
    this.locURotateMatrix = null;
    this.locURotateCenter = null;
    this.locUOffsetUV = null;
    this.locUVXformEnable = null;
    this.locUSkinEnable = null;
    this.locARootNodeXform = null;
    this.locUNodeXformEnable = null;
    this.locANodeXform = null;
    
    // Reset state variables
    this.skinAnimation = null;
    this.bonesLoaded = null;
    this.gl = null;
    this.blockIndex = -1;
    this.boundProgram = null;
  }

  setBone(jointIndex, matrix) {
    if (this.bones && jointIndex < MAX_BONES) { // Check against MAX_BONES
      const offset = jointIndex * 16;
      this.bones.set(matrix, offset); // Use set for potential performance
      this.bonesLoaded = true;
    } else if (jointIndex >= MAX_BONES) {
        console.warn(`BoneBuffer: Joint index ${jointIndex} exceeds MAX_BONES (${MAX_BONES}).`);
    } else {
      console.warn("BoneBuffer: No bones array allocated or attempt to set bone without skinning enabled.");
    }
  }

  setBones(matrices) {
    if (this.bones) {
        // Ensure the input doesn't exceed the buffer size
        const numMatricesToCopy = Math.min(matrices.length / 16, MAX_BONES);
        if (numMatricesToCopy * 16 < matrices.length) {
            console.warn(`BoneBuffer: Input matrices count (${matrices.length / 16}) exceeds MAX_BONES (${MAX_BONES}). Truncating.`);
        }
        // Copy only up to MAX_BONES matrices
        this.bones.set(matrices.subarray(0, numMatricesToCopy * 16));
        this.bonesLoaded = true; // Assume loaded if setBones is called
    } else {
      console.warn("BoneBuffer: No bones array allocated.");
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
    const gl = renderer._gl;
    const shaderProgram = renderer._batchState.currentShader._shaderProgram;
    // Removed redundant check for uvXform.enable here as it's checked before calling
    const rotateMatrix = uvXform.rotateMatrix;
    const rotateCenter = uvXform.rotateCenter;
    const offsetUV = uvXform.offsetUV;
    // Cache uniform locations
    if (this.locURotateMatrix === -1) this.locURotateMatrix = gl.getUniformLocation(shaderProgram, "uUVRotate");
    if (this.locURotateCenter === -1) this.locURotateCenter = gl.getUniformLocation(shaderProgram, "uUVRotateCenter");
    if (this.locUOffsetUV === -1) this.locUOffsetUV = gl.getUniformLocation(shaderProgram, "uUVOffset");
    if (this.locUVXformEnable === -1) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");

    if (this.locURotateMatrix) gl.uniformMatrix2fv(this.locURotateMatrix, false, rotateMatrix);
    if (this.locURotateCenter) gl.uniform2fv(this.locURotateCenter, rotateCenter);
    if (this.locUOffsetUV) gl.uniform2fv(this.locUOffsetUV, offsetUV);
    if (this.locUVXformEnable) gl.uniform1f(this.locUVXformEnable, 1.0);
  }

  uploadUniforms(renderer, uvXform, phongEnable, maxJointIndexToUpload = -1) {
    const gl = renderer._gl;
    const shaderProgram = renderer._batchState.currentShader._shaderProgram;

    // --- UBO Handling ---
    if (!this.ubo) {
        console.error("BoneBuffer: UBO not initialized for skinning.");
        return; // Cannot proceed without UBO
    }

    // Get and cache block index if shader program changed
    if (this.boundProgram !== shaderProgram) {
        this.blockIndex = gl.getUniformBlockIndex(shaderProgram, "Bones");
        if (this.blockIndex === gl.INVALID_INDEX) {
            console.error("BoneBuffer: Could not find 'Bones' uniform block in shader.");
            this.blockIndex = -1; // Mark as invalid
        } else {
            // Associate the shader's uniform block with the binding point
            // This only needs to happen once per shader program
            // Use static binding point
            gl.uniformBlockBinding(shaderProgram, this.blockIndex, BoneBufferTop.BONE_UBO_BINDING_POINT);
        }
        this.boundProgram = shaderProgram; // Cache the program
    }
    
    if (this.blockIndex !== -1) { // Proceed only if block index is valid
        // Bind the UBO
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
        // Upload the bone data
        let dataToUpload = this.bones; // Default to full buffer
        if (maxJointIndexToUpload >= 0 && (maxJointIndexToUpload + 1) * 16 < this.bones.length) {
            // Calculate the number of matrices (bones) to upload
            const numMatricesToUpload = maxJointIndexToUpload + 1;
            // Ensure we don't try to upload more than MAX_BONES (safety check)
            if (numMatricesToUpload <= MAX_BONES) {
                 // Create a subarray view for the necessary part
                 dataToUpload = this.bones.subarray(0, numMatricesToUpload * 16);
            } else {
                console.warn(`BoneBuffer: maxJointIndexToUpload (${maxJointIndexToUpload}) exceeds MAX_BONES (${MAX_BONES}). Uploading full buffer.`);
            }
        }
        // Using bufferSubData allows updating parts, but here we upload the relevant section from the start.
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, dataToUpload);
        // Unbind the UBO from the general binding point
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);

        // Bind the UBO to the specific binding point for this draw call
        // Use static binding point
        gl.bindBufferBase(gl.UNIFORM_BUFFER, BoneBufferTop.BONE_UBO_BINDING_POINT, this.ubo);
    }
    // --- End UBO Handling ---

    // --- Other Uniforms ---
    // Cache locations
    if (this.locUSkinEnable === -1) this.locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable");
    if (this.locARootNodeXform === -1) this.locARootNodeXform = gl.getUniformLocation(shaderProgram, "uRootNodeXform");
    
    // Removed texture upload call
    
    if (this.locUSkinEnable) gl.uniform1f(this.locUSkinEnable, 1.0);
    if (this.locARootNodeXform) gl.uniformMatrix4fv(this.locARootNodeXform, false, this.rootNodeXform);

    if (uvXform.enable) { // Check if UV transform is actually needed
        this.uploadUVXformUniforms(renderer, uvXform);
    } else {
        // Ensure UV transform is disabled if not needed for this draw
        if (this.locUVXformEnable === -1) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");
        if (this.locUVXformEnable) gl.uniform1f(this.locUVXformEnable, 0.0);
    }
    
    const locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable"); // Less likely to be static, get each time?
    if (locUPhongEnable) gl.uniform1f(locUPhongEnable, phongEnable ? 1.0 : 0.0);
  }

  uploadUniformsNonSkin(renderer, uvXform, phongEnable) {
    const gl = renderer._gl;
    const shaderProgram = renderer._batchState.currentShader._shaderProgram;

    // --- Bind UBO if available and shader expects it, otherwise bind dummy --- //
    // Get and cache block index if shader program changed
    if (this.boundProgram !== shaderProgram) {
        this.blockIndex = gl.getUniformBlockIndex(shaderProgram, "Bones");
        if (this.blockIndex === gl.INVALID_INDEX) {
            this.blockIndex = -1; // Mark as invalid for this shader
        } else {
            // Associate the shader's uniform block with the binding point (idempotent)
            gl.uniformBlockBinding(shaderProgram, this.blockIndex, BoneBufferTop.BONE_UBO_BINDING_POINT);
        }
        this.boundProgram = shaderProgram; // Cache the program associated with the block index
    }

    // If the shader has the 'Bones' block, ensure *something* is bound
    if (this.blockIndex !== -1) {
        if (this.ubo) {
            // This instance has a real UBO, bind it
            gl.bindBufferBase(gl.UNIFORM_BUFFER, BoneBufferTop.BONE_UBO_BINDING_POINT, this.ubo);
        } else {
            // This instance does NOT have a real UBO, bind the dummy UBO
            const dummyUBO = BoneBufferTop._getOrCreateDummyUBO(gl);
            if (dummyUBO) {
               gl.bindBufferBase(gl.UNIFORM_BUFFER, BoneBufferTop.BONE_UBO_BINDING_POINT, dummyUBO);
            } else {
                console.error("BoneBuffer (NonSkin): Shader expects 'Bones' UBO, but dummy UBO creation failed.");
                // Avoid drawing?
            }
        }
    } else {
        // Shader does not have the 'Bones' block, no need to bind anything here.
        // We might want to explicitly unbind if a previous draw call bound something?
        // However, relying on the next bind in the correct path is usually sufficient.
        // gl.bindBufferBase(gl.UNIFORM_BUFFER, BoneBufferTop.BONE_UBO_BINDING_POINT, null); // Optional unbind
    }
    // --- End UBO Handling ---

    // Cache locations for other uniforms
    if (this.locUSkinEnable === -1) this.locUSkinEnable = gl.getUniformLocation(shaderProgram, "uSkinEnable");
    if (this.locUNodeXformEnable === -1) this.locUNodeXformEnable = gl.getUniformLocation(shaderProgram, "uNodeXformEnable");
    if (this.locANodeXform === -1) this.locANodeXform = gl.getUniformLocation(shaderProgram, "uNodeXform");

    if (this.locUSkinEnable) gl.uniform1f(this.locUSkinEnable, 0.0);
    if (this.locUNodeXformEnable) gl.uniform1f(this.locUNodeXformEnable, 1.0);
    if (this.locANodeXform) gl.uniformMatrix4fv(this.locANodeXform, false, this.nodeXform);

    if (uvXform.enable) { // Check if UV transform is actually needed
        this.uploadUVXformUniforms(renderer, uvXform);
    } else {
        // Ensure UV transform is disabled if not needed for this draw
        if (this.locUVXformEnable === -1) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");
        if (this.locUVXformEnable) gl.uniform1f(this.locUVXformEnable, 0.0);
    }

    const locUPhongEnable = gl.getUniformLocation(shaderProgram, "uPhongEnable"); // Less likely to be static
    if (locUPhongEnable) gl.uniform1f(locUPhongEnable, phongEnable ? 1.0 : 0.0);
  }

  disable(renderer) {
      // This method might not be necessary anymore if state is managed per draw.
      // If still needed, ensure it only disables uniforms relevant outside skinning/node paths.
       const gl = renderer._gl;
       const shaderProgram = renderer._batchState.currentShader._shaderProgram;
       // Example: Ensure UV XForm is off if this buffer is disabled generally
       if (this.locUVXformEnable === -1) this.locUVXformEnable = gl.getUniformLocation(shaderProgram, "uUVXformEnable");
       if (this.locUVXformEnable) gl.uniform1f(this.locUVXformEnable, 0.0);
  }
}

// @ts-ignore
if (!globalThis.BoneBuffer) {
  globalThis.BoneBuffer = BoneBufferTop;
}
