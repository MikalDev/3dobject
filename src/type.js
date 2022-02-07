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
            this.texture = [];
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

            if (!gltfData.imageBitmap) {
                gltfData.dynamicTexturesLoaded = true;
                return;
            }
            gltfData.dynamicTexturesLoaded = null;
            for (let i=0;i<gltfData.imageBitmap.length;i++) {
                const width = gltfData.imageBitmap[i].width;
                const height = gltfData.imageBitmap[i].height;

                // XXX Once we know how to get sampling in editor, set this to the correct value
                let options =  {}

                textures.push(renderer.CreateDynamicTexture(width, height, options));
                await renderer.UpdateTexture(gltfData.imageBitmap[i], textures[i])
            }
            gltfData.dynamicTexturesLoaded = true;
            if (instanceModel) {
                // gltfData = null
            }
        }
    };
}