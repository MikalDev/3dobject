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
            `out highp vec2 vTex;`,
            `uniform highp mat4 matP;`,
            `uniform highp mat4 matMV;`,
            `in vec4 aWeights;`,
            `in vec4 aJoints;`,
            `out highp vec3 pos;`,
            `uniform mat4 uBones[MAX_BONES];`,
            `uniform mat4 uRootNodeXform;`,
            `uniform mat4 uNodeXform;`,
            `uniform float uSkinEnable;`,
            `uniform float uNodeXformEnable;`,
            `void main(void) {`,
            `    pos = aPos;`,
            `    if (uSkinEnable != 0.0) {`,
            `        // Skinning is enabled`,
            `        highp vec4 skinVertex = vec4(0.0);`,
            `        for (int i = 0; i < 4; i++) {`,
            `            int joint = int(aJoints[i]);`,
            `            skinVertex += aWeights[i] * (uBones[joint] * vec4(aPos, 1.0));`,
            `        }`,
            `        highp vec4 position = matP * matMV * uRootNodeXform * skinVertex;`,
            `        gl_Position = position;`,
            `    } else if (uNodeXformEnable != 0.0) {`,
            `        // Apply simple animation using the new transformation matrix`,
            `        gl_Position = matP * matMV * uNodeXform * vec4(aPos, 1.0);`,
            `    } else {`,
            `        gl_Position = matP * matMV * vec4(aPos, 1.0);`,
            `    }`,
            `    vTex = aTex;`,
            `}`,
          ].join("\n")
        }
        console.info("[3DObject] allow gpu skinning")
        // Monkeypatch webgl_2 vertex shader
        C3.Gfx.WebGLShaderProgram.GetDefaultVertexShaderSource_WebGL2 = GetDefaultVertexShaderSource_WebGL2
      }
    }

    Release() {
      super.Release()
    }
  }
}
