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
            this.zScale = 1;
            this.debug = false;
            this.minBB = [0,0,0]
            this.maxBB = [0,0,0]
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
            const wi = this._inst;
            wi.SetOriginY(1);
        }

        OnPlacedInLayout()
        {
            // Initialise to size of image
            this.OnMakeOriginalSize();
        }

        RendersToOwnZPlane() {
            return false;
        }

        async doInit() {
            this.gltf = new globalThis.GltfModel(this._runtime, this.sdkType, this);
            await this.gltf.init();
            this.loaded = true;
            this.drawVerts = [];
            this.drawUVs = [];
            this.drawIndices = [];
            this.gltf.getPolygons();
            this.layoutView.Refresh();
        }

        async Draw(iRenderer, iDrawParams)
        {
            if (!this.layoutView) this.layoutView = iDrawParams.GetLayoutView();
            const texture = this.GetTexture();

            if (texture)
            {
                this._inst.ApplyBlendMode(iRenderer);
                if (this.sdkType.texture) {
                    iRenderer.SetTexture(this.sdkType.texture);
                } else {                    
                    iRenderer.SetTexture(texture);
                }
                iRenderer.SetColor(this._inst.GetColor());

                if (!this.scale) this.scale = this._inst.GetPropertyValue('scale');

                this.gltfPath = this._inst.GetPropertyValue('gtlf-path');

                const sdkType = this.sdkType;

                if (this.gltfPath != 'path' && sdkType.initOwner == -1)
                {
                    sdkType.initOwner = this.uid; 
                    await sdkType.gltfData.load(this.gltfPath, false)
                    console.log('gtlfData', sdkType.gltfData)
                    await sdkType.LoadDynamicTextures(iRenderer, 0);
                }

                if (!this.loaded)
                {
                    if (this.sdkType.loaded)
                    {
                        if (!this.doingInit) {
                            this.doingInit = true;
                            this.doInit()
                        }
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
                        // this.layoutView.Refresh();
                        const wi = this._inst;
                        wi.SetSize(this.maxBB[0]-this.minBB[0], this.maxBB[1]-this.minBB[1]);
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
                case 'gtlf-path':
                    /*
                    if (this.sdkType.initOwner = this.uid)
                    {
                        this.gltfPath = this._inst.GetPropertyValue('gtlf-path');
                        console.log('gltf-path changed', this.gltfPath)
                        this.sdkType.gltfData.load(this.gltfPath, false)
                        if (this.layoutView) this.layoutView.Refresh();
                    }
                    */
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