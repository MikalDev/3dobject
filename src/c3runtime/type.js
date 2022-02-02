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
            this.loaded = false;
            this.gltfData = new globalThis.GltfData(this._runtime, this);
            this.dynamicTexturesLoaded = false;
        }

        async LoadDynamicTextures(renderer, imageNumber)
        {
            if (this.dynamicTexturesLoaded === true || this.dynamicTexturesLoaded === null) return;

            const gltf = this.gltfData.gltf;
            if (!gltf.imageBitmap) {
                this.dynamicTexturesLoaded = true;
                return;
            }
            this.dynamicTexturesLoaded = null;
            const width = gltf.imageBitmap[imageNumber].width;
            const height = gltf.imageBitmap[imageNumber].height;
            this.texture = renderer.CreateDynamicTexture(width, height);
            await renderer.UpdateTexture(gltf.imageBitmap[imageNumber], this.texture)
            this.dynamicTexturesLoaded = true;
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