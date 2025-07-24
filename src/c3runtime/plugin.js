"use strict"
{
  const C3 = self.C3

  C3.Plugins.Mikal_3DObject = class Object3DPlugin extends C3.SDKPluginBase {
    constructor(opts) {
      super(opts)
      console.log("opts", opts)
      const C3 = self.C3
      const runtime = opts.runtime
      const MAX_BONES = 256;
      const _DUMMY_UBO_SIZE = MAX_BONES * 16 * 4;

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
              gl.bindBufferBase(
                gl.UNIFORM_BUFFER,
                globalThis.bonesBindingPoint,
                globalThis.dummyBonesUboBuffer
              )
              console.info("[3DObject] Dummy UBO for bones created and bound.")
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
            `        if (uHasVertexColors > 0.5) {`,
            `            vColor = aColor;`,
            `        } else {`,
            `            vColor = vec4(1.0, 1.0, 1.0, 1.0);`,
            `        }`,
            `    }`,
            `}`,
          ].join("\n")
        }
        console.info("[3DObject] allow gpu skinning")
        // Monkeypatch webgl_2 vertex shader
        C3.Gfx.WebGLShaderProgram.GetDefaultVertexShaderSource_WebGL2 = GetDefaultVertexShaderSource_WebGL2
        // Temp monkeypatch user shader during runtime for pos support (does not work in editor)
        const shader = globalThis["C3_Shaders"]["mikal_frag_light-8"]
        if (shader) {
          shader.glslWebGL2 = shader.glslWebGL2.replace(
            "in mediump vec2 vTex;",
            "in highp float vNPW;\nin mediump vec2 vTex;\nin highp vec3 pos;\nin lowp vec4 vColor;\nin highp vec3 vNormal;\nuniform highp float uPhongEnable;\nin highp vec2 vNPTex;"
          )
          shader.glslWebGL2 = shader.glslWebGL2.replace("highp vec3 pos = vec3(0.0, 0.0, 0.0);", "")
          shader.glslWebGL2 = shader.glslWebGL2.replace("lowp vec4 vColor = vec4(0.0, 0.0, 0.0, 1.0);", "")
          shader.glslWebGL2 = shader.glslWebGL2.replace("highp vec3 vNormal = vec3(0.0, 0.0, 0.0);", "")
          shader.glslWebGL2 = shader.glslWebGL2.replace("highp float uPhongEnable = 0.0;", "")
          shader.glslWebGL2 = shader.glslWebGL2.replace("highp vec2 vNPTex = vec2(0.0, 0.0);", "")
          shader.glslWebGL2 = shader.glslWebGL2.replace("highp float vNPW = 0.0;", "")
        } else {
          console.warn("[3DObject] shader mikal_frag_light-8 not found")
        }
      }
    }

    Release() {
      super.Release()
    }
  }
}
