"use strict";
{
    const SDK = self.SDK;
    const PLUGIN_CLASS = SDK.Plugins.Mikal_3DObject;

    PLUGIN_CLASS.Instance = class Object3DInstance extends SDK.IWorldInstanceBase
    {
        constructor(sdkType, inst)
        {
            super(sdkType, inst);
            this.sdkType = sdkType;
            this.loaded = false;
            this.localCenter = [0,0,0]
            this.uid = inst.GetUID();
            this.layout = inst.GetLayout();
            this.zScale = 6;
            this.debug = false;
        }

        Release()
        {}

        OnCreate()
        {
            this.xAngle = this._inst.GetPropertyValue('angle-x');
            this.yAngle = this._inst.GetPropertyValue('angle-y');
            this.zAngle = this._inst.GetPropertyValue('angle-z');
            this.rotationOrder = this._inst.GetPropertyValue('rotation-order');
            this.scale = this._inst.GetPropertyValue('scale');
            this.zElevation =  this._inst.GetPropertyValue('z-elevation');
            this.debug = this._inst.GetPropertyValue('debug')
        }

        OnPlacedInLayout()
        {
            // Initialise to size of image
            this.OnMakeOriginalSize();
        }

        RendersToOwnZPlane() {
            return false;
        }

        Draw(iRenderer, iDrawParams)
        {
            if (!this.layoutView) this.layoutView = iDrawParams.GetLayoutView();
            const texture = this.GetTexture();

            if (texture)
            {
                this._inst.ApplyBlendMode(iRenderer);
                iRenderer.SetTexture(texture);

                if (!this.scale) this.scale = this._inst.GetPropertyValue('scale');

                this.gltfPath = this._inst.GetPropertyValue('gtlf-path');

                let sdkType = this.sdkType;

                if (this.gltfPath != 'path' && sdkType.initOwner == -1)
                {
                    sdkType.initOwner = this.uid; 
                    sdkType.gltfData.load(this.gltfPath, false)
                }

                if (!this.loaded)
                {
                    if (this.sdkType.loaded)
                    {
                        this.gltf = new globalThis.GltfModel(this._runtime, this.sdkType, this);
                        this.drawVerts = [];
                        this.drawUVs = [];
                        this.drawIndices = [];
                        // this.gltf.updateAnimation(0, 0);
    
                        this.gltf.getPolygons();
                        this.loaded = true;
                        this.layoutView.Refresh();
                    }
                    this.layoutView.Refresh();        
                }
                if (this.loaded)
                {
                    // 3D Model 
                    const x = this._inst.GetX();
                    const y = this._inst.GetY();
                    const z = this.zElevation;

                    const tempQuad = new SDK.Quad();

                    if (this.loaded && this.gtlfPath != 'path')
                    {
                        this.drawVerts = [];
                        this.drawUVs = [];
                        this.drawIndices = [];
                        this.gltf.getPolygons();
                        this.gltf.render(iRenderer, x, y, z, tempQuad);
                        this.layoutView.Refresh();
                    } else
                    {
                        return
                    }
                }
            }
            else
            {
                // render placeholder
                iRenderer.SetAlphaBlend();
                iRenderer.SetColorFillMode();

                if (this.HadTextureError()) iRenderer.SetColorRgba(0.25, 0, 0, 0.25);
                else iRenderer.SetColorRgba(0, 0, 0.5, 0.5);

                iRenderer.Quad(this._inst.GetQuad());
            }
        }

        GetTexture()
        {
            const image = this.GetObjectType().GetImage();
            return super.GetTexture(image);
        }

        IsOriginalSizeKnown()
        {
            return true;
        }

        GetOriginalWidth()
        {
            return this.GetObjectType().GetImage().GetWidth();
        }

        GetOriginalHeight()
        {
            return this.GetObjectType().GetImage().GetHeight();
        }

        OnMakeOriginalSize()
        {
            const image = this.GetObjectType().GetImage();
            this._inst.SetSize(image.GetWidth(), image.GetHeight());
        }

        HasDoubleTapHandler()
        {
            return true;
        }

        OnDoubleTap()
        {
            this.GetObjectType().EditImage();
        }

        OnPropertyChanged(id, value)
        {
            switch(id)
            {
                case 'scale':
                    this.scale = value;
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'z-elevation':
                    this.zElevation = value;
                    if (this.layoutView) this.layoutView.Refresh();
                    break;   
                case 'angle-x':
                case 'angle-y':
                case 'angle-z':
                case 'rotation-order':
                    this.xAngle = this._inst.GetPropertyValue('angle-x');
                    this.yAngle = this._inst.GetPropertyValue('angle-y');
                    this.zAngle = this._inst.GetPropertyValue('angle-z');
                    let order = this._inst.GetPropertyValue('rotation-order');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'gltf-path':
                    if (this.sdkType.initOwner = this.uid)
                    {
                        this.gltfPath = this._inst.GetPropertyValue('gltf-path');
                        sdkType.gltfData.load(this.gltfPath, false)
                        if (this.layoutView) this.layoutView.Refresh();
                    }
                    break
                case 'debug':
                    this.debug = this._inst.GetPropertyValue('debug');
                    break;
                default:
                    break;
            }
        }

        LoadC2Property(name, valueString)
        {
            return false; // not handled
        }
    };
}