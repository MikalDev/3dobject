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
            `out highp vec2 vTex;`,
            `out highp vec3 vColor;`,
            `uniform highp mat4 matP;`,
            `uniform highp mat4 matMV;`,
            `in vec4 aWeights;`,
            `in vec4 aJoints;`,
            `out highp vec3 pos;`,
            `uniform highp mat4 uModelRotate;`,
            `uniform mat4 uBones[MAX_BONES];`,
            `uniform mat4 uRootNodeXform;`,
            `uniform mat4 uNodeXform;`,
            `uniform float uSkinEnable;`,
            `uniform float uNodeXformEnable;`,
            `uniform float uModelRotateEnable;`,
            `void main(void) {`,
            `    pos = aPos;`,
            `    if (uSkinEnable > 0.5) {`,
            `        // Skinning is enabled`,
            `        highp vec4 skinVertex = vec4(0.0);`,
            `        for (int i = 0; i < 4; i++) {`,
            `            int joint = int(aJoints[i]);`,
            `            skinVertex += aWeights[i] * (uBones[joint] * vec4(aPos, 1.0));`,
            `        }`,
            `        highp vec4 position = matP * matMV * uRootNodeXform * skinVertex;`,
            `        pos = (uModelRotate * uRootNodeXform * skinVertex).xyz;`,
            `        gl_Position = position;`,
            `    } else if (uNodeXformEnable > 0.5) {`,
            `        // Apply simple animation using the new transformation matrix`,
            `        pos = (uModelRotate * uNodeXform * vec4(aPos, 1.0)).xyz;`,
            `        gl_Position = matP * matMV * uNodeXform * vec4(aPos, 1.0) * 10.0;`,
            `    } else if (uModelRotateEnable > 0.5) {`,
            `        // Apply simple animation using the new transformation matrix`,
            `        pos = (uModelRotate * vec4(aPos, 1.0)).xyz;`,
            `        gl_Position = matP * matMV * vec4(aPos, 1.0);`,
            `    } else {`,
            `    	    pos = aPos;`,
            `	        gl_Position = matP * matMV * vec4(aPos, 1.0);`,
            `    }`,
            `    vTex = aTex;`,
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
            "in mediump vec2 vTex;\nin highp vec3 pos;\nin highp vec3 vColor;"
          )
          shader.glslWebGL2 = shader.glslWebGL2.replace("highp vec3 pos = vec3(0.0, 0.0, 0.0);", "")
          shader.glslWebGL2 = shader.glslWebGL2.replace("highp vec3 vColor = vec3(0.0, 1.0, 0.0);", "")
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
