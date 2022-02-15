"use strict";
{
    const SDK = self.SDK;

    const PLUGIN_CLASS = SDK.Plugins.Mikal_3DObject;

    PLUGIN_CLASS.Type = class Object3DType extends SDK.ITypeBase
    {
        constructor(sdkPlugin, iObjectType)
        {
            super(sdkPlugin, iObjectType);
            this._project = iObjectType.GetProject();
            this.initOwner = -1;
            this.loaded = false;
            this.gltfData = new globalThis.GltfData(this._project, this);
            this.texture = {};
            this.dataLoaded = false;
        }

        async LoadDynamicTextures(renderer, gltfData, textures, whiteTextureOwner, instanceModel)
        {

            if (gltfData.dynamicTexturesLoaded === true || gltfData.dynamicTexturesLoaded === null) return;

            // White texture for solid color
            const width = gltfData.whiteImageBitmap.width;
            const height = gltfData.whiteImageBitmap.height;
            whiteTextureOwner.whiteTexture = renderer.CreateDynamicTexture(width, height);
            await renderer.UpdateTexture(gltfData.whiteImageBitmap, whiteTextureOwner.whiteTexture);
            gltfData.whiteImageBitmap.close();

            if (!gltfData.imageBitmap) {
                gltfData.dynamicTexturesLoaded = true;
                return;
            }
            gltfData.dynamicTexturesLoaded = null;
            gltfData.dynamicTexturesLoaded = null;
            for (const imageName in gltfData.imageBitmap) {
                const width = gltfData.imageBitmap[imageName].width;
                const height = gltfData.imageBitmap[imageName].height;
                let options =  {};
    
                textures[imageName] = renderer.CreateDynamicTexture(width, height, options);
                await renderer.UpdateTexture(gltfData.imageBitmap[imageName], textures[imageName]);
                if (typeof gltfData.imageBitmap[imageName].close === "function") gltfData.imageBitmap[imageName].close();
            }
            gltfData.dynamicTexturesLoaded = true;
            if (instanceModel) {
                // gltfData = null
            }
        }
    };
}