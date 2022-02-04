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

        async LoadDynamicTextures(renderer, gltfData, textures, instanceModel)
        {
            const gltf = gltfData.gltf;

            if (gltfData.dynamicTexturesLoaded === true || gltfData.dynamicTexturesLoaded === null) return;

            if (!gltf.imageBitmap) {
                gltfData.dynamicTexturesLoaded = true;
                return;
            }
            gltfData.dynamicTexturesLoaded = null;
            for (let i=0;i<gltf.imageBitmap.length;i++) {
                const width = gltf.imageBitmap[i].width;
                const height = gltf.imageBitmap[i].height;
                textures.push(renderer.CreateDynamicTexture(width, height));
                await renderer.UpdateTexture(gltf.imageBitmap[i], textures[i])
            }
            gltfData.dynamicTexturesLoaded = true;
            if (instanceModel) {
                // gltfData = null
            }
        }
    };
}