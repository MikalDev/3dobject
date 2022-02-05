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
            this.texture = [];
        }

        async LoadDynamicTextures(renderer, gltfData, textures, instanceModel)
        {
            const gltf = gltfData.gltf;

            if (gltfData.dynamicTexturesLoaded === true || gltfData.dynamicTexturesLoaded === null) return;

            // const gltf = this.gltfData.gltf;
            if (!gltfData.imageBitmap) {
                gltfData.dynamicTexturesLoaded = true;
                return;
            }
            gltfData.dynamicTexturesLoaded = null;
            for (let i=0;i<gltfData.imageBitmap.length;i++) {
                const width = gltfData.imageBitmap[i].width;
                const height = gltfData.imageBitmap[i].height;
                textures.push(renderer.CreateDynamicTexture(width, height));
                await renderer.UpdateTexture(gltfData.imageBitmap[i], textures[i])
            }
            gltfData.dynamicTexturesLoaded = true;
            if (instanceModel) {
                gltfData = null
            }
        }

        LoadTextures(renderer)
        {
            return this.GetImageInfo().LoadStaticTexture(renderer,
            {
                linearSampling: this._runtime.IsLinearSampling()
            });
        }

        ReleaseTextures()
        {
            this.GetImageInfo().ReleaseTexture();
        }
    };
}