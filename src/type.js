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
            this.texture = null;
        }

        async LoadDynamicTextures(renderer, imageNumber)
        {
            const gltf = this.gltfData.gltf;
            if (!gltf.imageBitmap) return
            const width = gltf.imageBitmap[imageNumber].width;
            const height = gltf.imageBitmap[imageNumber].height;
            this.texture = renderer.CreateDynamicTexture(width, height);
            await renderer.UpdateTexture(gltf.imageBitmap[imageNumber], this.texture)
        }
    };
}