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
            this.xScale = 1;
            this.yScale = 1;
            this.zScale = 1;
            this.debug = false;
            this.minBB = [0,0,0]
            this.maxBB = [0,0,0]
            this._runtime = sdkType._project;
            this.dataLoaded = false;
            this.texture = [];
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
            this.debug = this._inst.GetPropertyValue('debug');
            this.instanceModel = this._inst.GetPropertyValue('instance-model');
            this.instanceTexture = this._inst.GetPropertyValue('image-texture');
            this.gltfData = null;
            this.xScale = this._inst.GetPropertyValue('x-scale');
            this.yScale = this._inst.GetPropertyValue('y-scale');
            this.zScale = this._inst.GetPropertyValue('z-scale');
            this.inEditor = true;

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
            if (this.instanceModel) {
                this.gltf = new globalThis.GltfModel(this._runtime, this, this);
            } else {
                this.gltf = new globalThis.GltfModel(this._runtime, this.sdkType, this);
            }
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
                if (this.sdkType.texture && !this.instanceTexture) {
                    // iRenderer.SetTexture(this.sdkType.texture);
                } else {                    
                    iRenderer.SetTexture(texture);
                }

                iRenderer.SetColor(this._inst.GetColor());

                if (!this.scale) this.scale = this._inst.GetPropertyValue('scale');

                this.gltfPath = this._inst.GetPropertyValue('gtlf-path');

                const sdkType = this.sdkType;

                // Initialization, once per group of instances unless model data specified per instance
                if (this.instanceModel && this.gltfData == null) {
                    this.gltfData = new globalThis.GltfData(this._runtime, this);
                }

                let textures = this.instanceModel ? this.texture : this.sdkType.texture
                let whiteTextureOwner = this.instanceModel ? this : this.sdkType
                let gltfData = this.instanceModel ? this.gltfData : this.sdkType.gltfData
    
                if (this.instanceModel && this.gltfPath != 'path' && this.gltfPath != '' && !this.gltfDataLoad)
                {
                    this.gltfDataLoad = true;
                    await gltfData.load(this.gltfPath, false, this.debug);
                    await this.sdkType.LoadDynamicTextures(iRenderer, gltfData, textures, whiteTextureOwner, this.instanceModel);
                } 


                if (!this.instanceModel && this.gltfPath != 'path' && this.gltfPath != '' && sdkType.initOwner == -1)
                {
                    sdkType.initOwner = this.uid; 
                    await gltfData.load(this.gltfPath, false, this.debug);
                    await this.sdkType.LoadDynamicTextures(iRenderer, gltfData, textures, whiteTextureOwner, this.instanceModel);
                }

                if (!this.loaded)
                {
                    if ((!this.instanceModel && this.sdkType.dataLoaded) || (this.instanceModel && this.dataLoaded))
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
                    if (textures.length === 0 || !this.instanceTexture) {
                        iRenderer.SetTexture(texture);
                    }
                    
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
                        this.gltf.render(iRenderer, x, y, z, tempQuad, whiteTextureOwner.whiteTexture, this._inst.GetColor(), textures, this.instanceTexture);
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
                case 'image-texture':
                    this.instanceTexture = this._inst.GetPropertyValue('image-texture');
                    break;
                case 'instance-model':
                    // this.instanceModel = this._inst.GetPropertyValue('instance-model');
                    break;
                case 'x-scale':
                    this.xScale = this._inst.GetPropertyValue('x-scale');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'y-scale':
                    this.yScale = this._inst.GetPropertyValue('y-scale');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'z-scale':
                    this.zScale = this._inst.GetPropertyValue('z-scale');
                    if (this.layoutView) this.layoutView.Refresh();
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