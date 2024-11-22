"use strict"
{
  const C3 = self.C3

  C3.Plugins.Mikal_3DObject = class Object3DPlugin extends C3.SDKPluginBase {
    constructor(opts) {
      super(opts)
      const C3 = self.C3

      if (!globalThis.vertexShaderGPUSkinningEnabledXYZ) {
        globalThis.vertexShaderGPUSkinningEnabledXYZ = true

        function GetDefaultVertexShaderSource_WebGL2(useHighP) {
          const texPrecision = useHighP ? "highp" : "mediump"
          return [
            `#version 300 es`,
            `const int MAX_BONES = 50; // Adjust based on your needs`,

            `in highp vec3 aPos;`,
            `in highp vec2 aTex;`,
            `in highp vec3 aColor;`,
            `in highp vec3 aNormal;`,
            `out highp vec2 vTex;`,
            `out highp vec2 vNPTex;`,
            `out highp float vNPW;`,
            `out highp vec3 vColor;`,
            `out highp vec3 vNormal;`,
            `uniform highp mat4 matP;`,
            `uniform highp mat4 matMV;`,
            `in vec4 aWeights;`,
            `in vec4 aJoints;`,
            `out highp vec3 pos;`,
            `out highp vec3 norm;`,
            `uniform highp mat4 uModelRotate;`,
            `uniform mat4 uBones[MAX_BONES];`,
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
            `void main(void) {`,
            `    pos = aPos;`,
            `    vNormal = aNormal;`, // Default normal
            `    if (uSkinEnable > 0.5) {`,
            `        // Skinning is enabled`,
            `        highp vec4 skinVertex = vec4(0.0);`,
            `        highp vec3 skinnedNormal = vec3(0.0);`,
            `        for (int i = 0; i < 4; i++) {`,
            `            int joint = int(aJoints[i]);`,
            `            skinVertex += aWeights[i] * (uBones[joint] * vec4(aPos, 1.0));`,
            `            if (uPhongEnable > 0.5) {`,
            `                skinnedNormal += aWeights[i] * (mat3(uBones[joint]) * aNormal);`, // Apply skinning to normals
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
            `        pos = (uModelRotate * vec4(aPos, 1.0)).xyz;`,
            `        gl_Position = matP * matMV * vec4(aPos, 1.0);`,
            `        if (uPhongEnable > 0.5) {`,
            `            // mat4 comboXform = uModelRotate;`,
            `            mat4 comboXform = uModelRotate * uNodeXform;`,
            `            vNormal = mat3(transpose(inverse(comboXform))) * aNormal;`, // Adjust normal for model rotation
            `            vNormal.x = -vNormal.x;`,
            `        }`,
            `    } else {`,
            `    	    pos = aPos;`,
            `	        gl_Position = matP * matMV * vec4(aPos, 1.0);`,
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
            `    vColor = aColor;`,
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
            "in highp float vNPW;\nin mediump vec2 vTex;\nin highp vec3 pos;\nin highp vec3 vColor;\nin highp vec3 vNormal;\nuniform highp float uPhongEnable;\nin highp vec2 vNPTex;"
          )
          shader.glslWebGL2 = shader.glslWebGL2.replace("highp vec3 pos = vec3(0.0, 0.0, 0.0);", "")
          shader.glslWebGL2 = shader.glslWebGL2.replace("highp vec3 vColor = vec3(0.0, 1.0, 0.0);", "")
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
