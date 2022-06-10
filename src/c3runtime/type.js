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
                    wrapX: 'repeat',
                    wrapY: 'repeat',};
    
                textures[imageName] = renderer.CreateDynamicTexture(width, height, options);
                await renderer.UpdateTexture(gltfData.imageBitmap[imageName], textures[imageName]);
                if (typeof gltfData.imageBitmap[imageName].close === "function") gltfData.imageBitmap[imageName].close();
            }

            gltfData.dynamicTexturesLoaded = true;
            if (instanceModel) {
                gltfData = null
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