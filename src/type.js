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
            this.modelData = new globalThis.ModelData3D(this._project, this, false);
            this.initOwner = -1;
            this.loaded = false;
        }
    };
}