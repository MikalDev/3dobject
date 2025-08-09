"use strict"
{
  const C3 = self.C3

  C3.Plugins.Mikal_3DObject = class Object3DPlugin extends C3.SDKPluginBase {
    constructor(opts) {
      super(opts)
      console.log("opts", opts)
      const C3 = self.C3
      const runtime = opts.runtime
      const MAX_BONES = 256
      const _DUMMY_UBO_SIZE = MAX_BONES * 16 * 4

      if (!globalThis.vertexShaderGPUSkinningEnabledXYZ) {
        globalThis.vertexShaderGPUSkinningEnabledXYZ = true
        // Choose a binding point for the bones UBO. Using a high number
        // to reduce potential conflicts with C3's internal bindings.
        globalThis.bonesBindingPoint = 0
        globalThis.dummyBonesUboBuffer = null

        // In the C3 runtime, we can get the renderer from the runtime instance.
        // However, the plugin instance isn't available here. We can listen for
        // the "afterfirstlayoutstart" event to get the runtime and renderer.
        runtime._iRuntime.addEventListener("afterprojectstart", () => {
          const renderer = runtime.GetCanvasManager().GetRenderer()
          const gl = renderer._gl

          if (gl && !globalThis.dummyBonesUboBuffer) {
            // Create a dummy UBO buffer once and bind it.
            // This buffer will be used by default for any shader program
            // that has the "Bones" uniform block.
            const dummyData = new Float32Array(_DUMMY_UBO_SIZE) // A single mat4 is enough.
            const uboBuffer = gl.createBuffer()
            gl.bindBuffer(gl.UNIFORM_BUFFER, uboBuffer)
            gl.bufferData(gl.UNIFORM_BUFFER, dummyData, gl.STATIC_DRAW)
            gl.bindBuffer(gl.UNIFORM_BUFFER, null)

            globalThis.dummyBonesUboBuffer = uboBuffer

            // Bind the dummy buffer to the chosen binding point.
            // This binding will persist until another buffer is bound to this point.
            gl.bindBufferBase(gl.UNIFORM_BUFFER, globalThis.bonesBindingPoint, globalThis.dummyBonesUboBuffer)
            console.info("[3DObject] Dummy UBO for bones created and bound.")
          }

          // Proactively start creating the shader once the renderer is available
          // so the first draw will likely have it ready
          try {
            // Fire-and-forget; store promise so draws can check readiness
            globalThis.cached3DObjectShaderPromise = globalThis.get3DObjectShaderProgram(
              runtime.GetCanvasManager().GetRenderer()
            )
          } catch (e) {
            // ignore
          }
        })

        function GetDefaultVertexShaderSource_WebGL2(useHighP) {
          const texPrecision = useHighP ? "highp" : "mediump"
          return [
            `#version 300 es`,
            `// Increased max bones for UBO`,
            `const int MAX_BONES = 256;`,

            `in highp vec3 aPos;`,
            `in highp vec2 aTex;`,
            `in lowp vec4 aColor;`,
            `in highp vec3 aNormal;`,
            `out highp vec2 vTex;`,
            `out highp vec2 vNPTex;`,
            `out highp float vNPW;`,
            `out lowp vec4 vColor;`,
            `out highp vec3 vNormal;`,
            `uniform highp mat4 matP;`,
            `uniform highp mat4 matMV;`,
            `in vec4 aWeights;`,
            `in vec4 aJoints;`,
            `out highp vec3 pos;`,
            `out highp vec3 norm;`,
            `uniform highp mat4 uModelRotate;`,
            `uniform mat4 uRootNodeXform;`,
            `uniform mat4 uNodeXform;`,
            `uniform float uSkinEnable;`,
            `uniform float uNodeXformEnable;`,
            `uniform float uModelRotateEnable;`,
            `uniform float uUVXformEnable;`,
            `uniform vec2 uUVOffset;`,
            `uniform mat2 uUVRotate;`,
            `uniform vec2 uUVRotateCenter;`,
            `uniform float uPhongEnable;`,
            `uniform float uNPUVEnable;`,
            `uniform highp mat4 uNormalMatrix;`,
            `uniform float uHasVertexColors;`,
            `uniform float uUseUniformColor;`,
            `uniform lowp vec4 uObjectColor;`,

            `// --- Uniform Block for Bone Matrices ---`,
            `layout(std140) uniform Bones {`,
            `    mat4 uBones[MAX_BONES];`,
            `};`,
            `// --- End Uniform Block ---`,

            `// --- REMOVED Bone Texture Uniforms & Function ---`,

            `void main(void) {`,
            `    pos = aPos;`,
            `    vNormal = aNormal;`, // Default normal
            `    if (uSkinEnable > 0.5) {`,
            `        // Skinning is enabled`,
            `        highp vec4 skinVertex = vec4(0.0);`,
            `        highp vec3 skinnedNormal = vec3(0.0);`,
            `        for (int i = 0; i < 4; i++) {`,
            `            int joint = int(aJoints[i]);`,
            `            // Access bone matrix directly from UBO`,
            `            mat4 boneMatrix = uBones[joint];`,
            `            skinVertex += aWeights[i] * (boneMatrix * vec4(aPos, 1.0));`,
            `            if (uPhongEnable > 0.5) {`,
            `                skinnedNormal += aWeights[i] * (mat3(boneMatrix) * aNormal);`, // Apply skinning to normals
            `            }`,
            `        }`,
            `        highp vec4 position = matP * matMV * uRootNodeXform * skinVertex;`,
            `        pos = (uModelRotate * uRootNodeXform * skinVertex).xyz;`,
            `        gl_Position = position;`,
            `        if (uPhongEnable > 0.5) {`,
            `            mat3 modelRotate = mat3(uModelRotate);`,
            `            mat3 rootNodeXform = mat3(uRootNodeXform);`,
            `            vNormal = mat3(transpose(inverse(uModelRotate * uRootNodeXform))) * skinnedNormal;`, // Use skinned normal
            `            vNormal.x = -vNormal.x;`,
            `        }`,
            `    } else if (uNodeXformEnable > 0.5) {`,
            `        // Apply simple animation using the new transformation matrix`,
            `        pos = (uModelRotate * uNodeXform * vec4(aPos, 1.0)).xyz;`,
            `        gl_Position = matP * matMV * uNodeXform * vec4(aPos, 1.0);`,
            `        if (uPhongEnable > 0.5) {`,
            `            mat3 modelRotate = mat3(uModelRotate);`,
            `            mat3 nodeXform = mat3(uNodeXform);`,
            `            vNormal = mat3(transpose(inverse(modelRotate * nodeXform))) * aNormal;`, // Adjust normal for node transform
            `            vNormal.x = -vNormal.x;`,
            `        }`,
            `    } else if (uModelRotateEnable > 0.5) {`,
            `        // Apply simple animation using the new transformation matrix`,
            `        highp vec4 rotatedPos = uModelRotate * vec4(aPos, 1.0);`,
            `        pos = rotatedPos.xyz;`,
            `        gl_Position = matP * matMV * vec4(aPos, 1.0);`,
            `        if (uPhongEnable > 0.5) {`,
            `            vNormal = mat3(uNormalMatrix) * aNormal;`, // Adjust normal for model rotation
            `            vNormal.x = -vNormal.x;`,
            `        }`,
            `    } else {`,
            `    	    pos = aPos;`,
            `	        gl_Position = matP * matMV * vec4(aPos, 1.0);`,
            `          if (uPhongEnable > 0.5) {`,
            `              vNormal = aNormal;`, // Default normal
            `          }`,
            `    }`,
            `    if (uUVXformEnable > 0.5) {`,
            `        vec2 uv = aTex;`,
            `        vec2 uvCentered = uv - uUVRotateCenter;`,
            `        vec2 rotatedUV = uUVRotate * uvCentered;`,
            `        rotatedUV = rotatedUV + uUVRotateCenter;`,
            `        rotatedUV.x = rotatedUV.x + uUVOffset.x;`,
            `        rotatedUV.y = rotatedUV.y + uUVOffset.y;`,
            `        vTex = rotatedUV;`,
            `        vNPTex = aTex * gl_Position.w;`,
            `        vNPW = gl_Position.w;`,
            `    } else {`,
            `        vTex = aTex;`,
            `        vNPTex = aTex * gl_Position.w;`,
            `        vNPW = gl_Position.w;`,
            `    }`,
            `    // Enhanced vertex color handling for 3DObject compatibility`,
            `    if (uUseUniformColor > 0.5) {`,
            `        // 3DObject mode: combine model colors with instance tint`,
            `        if (uHasVertexColors > 0.5) {`,
            `            vColor = aColor * uObjectColor;  // Model colors × instance tint`,
            `        } else {`,
            `            vColor = uObjectColor;           // No model colors, use tint only`,
            `        }`,
            `    } else {`,
            `        // Standard C3 mode: use vertex buffer colors`,
            `        // Default to using vertex colors, only disable when explicitly set to 0`,
            `        vColor = aColor;  // Always use vertex colors in standard C3 mode`,
            `    }`,
            `}`,
          ].join("\n")
        }
        console.info("[3DObject] allow gpu skinning")
        // Do NOT monkeypatch global shader - create a dedicated shader program for 3DObject
        // Keep a reference to the original in case other systems need it
        globalThis.original_GetDefaultVertexShaderSource_WebGL2 =
          C3.Gfx.WebGLShaderProgram.GetDefaultVertexShaderSource_WebGL2
        globalThis.get3DObjectShaderSource = GetDefaultVertexShaderSource_WebGL2

        // Create or return a cached dedicated shader program for 3DObject
        globalThis.get3DObjectShaderProgram = async function (renderer) {
          if (!globalThis.cached3DObjectShader) {
            const shaderData = {
              src: `#version 300 es\n
                precision mediump float;\n
                in mediump vec2 vTex;\n
                in lowp vec4 vColor;\n
                out lowp vec4 outColor;\n
                uniform lowp sampler2D samplerFront;\n
                void main(void) {\n
                    outColor = texture(samplerFront, vTex) * vColor;\n
                }`,
              vertexSrc: GetDefaultVertexShaderSource_WebGL2(true),
              name: "3DObject-GPU-Skinning",
            }
            globalThis.cached3DObjectShaderPromise = renderer.CreateShaderProgram(shaderData)
            globalThis.cached3DObjectShader = await globalThis.cached3DObjectShaderPromise
            console.log("[3DObject] Created dedicated 3D shader program")
          }
          return globalThis.cached3DObjectShader
        }

        // Cleanup helper
        globalThis.cleanup3DObjectShader = function () {
          globalThis.cached3DObjectShader = null
          globalThis.cached3DObjectShaderPromise = null
        }
      }
    }

    Release() {
      super.Release()
      if (globalThis.cleanup3DObjectShader) {
        globalThis.cleanup3DObjectShader()
      }
    }
  }
}
