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

            if (false)
            {
                this._inst.ApplyBlendMode(iRenderer);
                iRenderer.SetTexture(texture);

                if (!this.scale) this.scale = this._inst.GetPropertyValue('scale');

                let sdkType = this.sdkType;
                if (sdkType.initOwner == -1)
                {
                    sdkType.initOwner = this.uid;
 
                    this.gltfPath = this._inst.GetPropertyValue('gtlf-path');
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
                        this.gltf.updateAnimation(0, 0);
    
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

                    iRenderer.SetTexture(texture);

                    const tempQuad = new SDK.Quad();

                    if (this.loaded && this.gtlfPath != 'path')
                    {
                        this.drawVerts = [];
                        this.drawUVs = [];
                        this.drawIndices = [];
                        this.gltf.getPolygons();
                        this.gltf.render(iRenderer, x, y, z, tempQuad);
                        
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
                else iRenderer.SetColorRgba(0, 0, 0.1, 0.1);

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
                    let x = this._inst.GetPropertyValue('angle-x');
                    let y = this._inst.GetPropertyValue('angle-y');
                    let z = this._inst.GetPropertyValue('angle-z');
                    let order = this._inst.GetPropertyValue('rotation-order');
                    if (this.model3D) this.model3D.rotateOrdered(x,y,z,order);
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'obj-path':
                    if (this.sdkType.initOwner = this.uid)
                    {
                        this.objPath = this._inst.GetPropertyValue('obj-path');
                        this.mtlPath = this._inst.GetPropertyValue('mtl-path');
                        this.sdkType.modelData.load(this.objPath, this.mtlPath, this.scale, false);
                    }
                    break
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