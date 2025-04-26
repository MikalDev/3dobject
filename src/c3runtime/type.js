"use strict";
{
    const C3 = self.C3;

    C3.Plugins.Mikal_3DObject.Type = class Object3DType extends C3.SDKTypeBase
    {
        constructor(objectClass)
        {
            super(objectClass);
        }

        Release()
        {
            super.Release();
        }

        OnCreate()
        {
            this.GetImageInfo().LoadAsset(this._runtime);
            this.initOwner = -1;
            this.dataLoaded = false;
            this.gltfData = new globalThis.GltfData(this._runtime, this);
            this.dynamicTexturesLoaded = false;
            this.texture = {};
        }

        async LoadDynamicTextures(renderer, gltfData, textures, whiteTextureOwner, instanceModel)
        {
            const gltf = gltfData.gltf;

            if (gltfData.dynamicTexturesLoaded === true || gltfData.dynamicTexturesLoaded === null) return;
            gltfData.dynamicTexturesLoaded = null;


            // White texture for solid color
            const width = gltfData.whiteImageBitmap.width;
            const height = gltfData.whiteImageBitmap.height;
            whiteTextureOwner.whiteTexture = renderer.CreateDynamicTexture(width, height);
            await renderer.UpdateTexture(gltfData.whiteImageBitmap, whiteTextureOwner.whiteTexture);
            if (typeof gltfData.whiteImageBitmap.close === "function") gltfData.whiteImageBitmap.close();

            if (!gltfData.imageBitmap || Object.keys(gltfData.imageBitmap).length === 0) {
                gltfData.dynamicTexturesLoaded = true;
                return;
            }

            for (const imageName in gltfData.imageBitmap) {
                const width = gltfData.imageBitmap[imageName].width;
                const height = gltfData.imageBitmap[imageName].height;
                const sampling = this._runtime.GetSampling();
                let options =  { sampling: sampling,
                    wrapX: gltfData.imageBitmap[imageName].wrapS,
                    wrapY: gltfData.imageBitmap[imageName].wrapT,
                };
    
                textures[imageName] = renderer.CreateDynamicTexture(width, height, options);
                await renderer.UpdateTexture(gltfData.imageBitmap[imageName], textures[imageName]);
                if (typeof gltfData.imageBitmap[imageName].close === "function") gltfData.imageBitmap[imageName].close();
            }

            gltfData.dynamicTexturesLoaded = true;
            if (instanceModel) {
                gltfData = null
            }
        }

        CreateBonesTexture(renderer) {
            const gl = renderer._gl;
            const NUM_TEXTURES = 3; // Triple buffering
            const MAX_BONES = 256; // Maximum bones anticipated across all models
            const PIXELS_PER_BONE = 4;
            const BONE_TEXTURE_WIDTH = MAX_BONES * PIXELS_PER_BONE; // Width = 1024 for MAX_BONES=256
            const BONE_TEXTURE_HEIGHT = 1; // Height is always 1

            // Check if the textures array already exists
            if (!globalThis.boneTextures) {
                console.log(`Creating ${NUM_TEXTURES} global bone textures (${BONE_TEXTURE_WIDTH}x${BONE_TEXTURE_HEIGHT} float)...`);

                if (!gl || !(gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext)) {
                   console.error("Invalid WebGL context provided for bone texture creation.");
                   return;
                }

                const textureType = gl.FLOAT;
                const internalFormat = gl.RGBA32F;
                
                globalThis.boneTextures = [];

                for (let i = 0; i < NUM_TEXTURES; ++i) {
                    const texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture);

                    gl.texImage2D(
                        gl.TEXTURE_2D,
                        0,
                        internalFormat,
                        BONE_TEXTURE_WIDTH,
                        BONE_TEXTURE_HEIGHT,
                        0,
                        gl.RGBA,
                        textureType,
                        null // Initialize with no data
                    );

                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    
                    globalThis.boneTextures.push(texture);
                }

                gl.bindTexture(gl.TEXTURE_2D, null); // Unbind after loop

                // Store dimensions and unit (same for all textures in the buffer)
                globalThis.boneTextureWidth = BONE_TEXTURE_WIDTH;
                globalThis.boneTextureHeight = BONE_TEXTURE_HEIGHT; // Will be 1
                globalThis.boneTextureUnit = 6; // Use the same unit for all
                globalThis.currentBoneTextureIndex = 0; // Start with the first texture

                 console.log(`3DObject: ${NUM_TEXTURES} Global bone textures created (${BONE_TEXTURE_WIDTH}x${BONE_TEXTURE_HEIGHT}) on unit ${globalThis.boneTextureUnit}`);

            }
        }

        LoadTextures(renderer)
        {
            return this.GetImageInfo().LoadStaticTexture(renderer, {
                sampling: this._runtime.GetSampling()
            });
        }

        ReleaseTextures()
        {
            this.GetImageInfo().ReleaseTexture();
        }
    };
}