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
            this.minBB = [0,0,0];
            this.maxBB = [0,0,0];
            this._runtime = sdkType._project;
            this.dataLoaded = false;
            this.texture = [];
            this.loadFailed = false;
            this.materialsModify = new Map();
            this.lightEnable = false;
            this.lightUpdate = false;
            this.lightColor = 0;
            this.spotEnable = false;
            this.spotDir = [0,0,0];
            this.spotCutoff = 0;
            this.spotEdge = 0;
            this.vertexScale = 0;

            this.xAngle = 0;
            this.yAngle = 0;
            this.zAngle = 0;
            this.rotationOrder = 'xyz';
            this.scale = '1';
            this.instanceModel = null;
            this.instanceTexture = null;
            this.gltfData = null;
            this.wireframe = null;
            this.isEditor = true;
            this.xWireframeWidth = 1;
            this.yWireframeWidth = 1;
            this.zWireframeWidth = 1;
            this.gltf = null;

            this.drawVerts = null;
            this.drawUVs = null;
            this.drawIndices = null;
            this.layoutView = null;
            this.doingInit = false;
            this.gltfPath = '';
            this.gltfDataLoad = true;
            this.spriteTextures = new Map();
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
            // this._inst.SetZElevation(this._inst.GetPropertyValue('z-elevation'));
            // this._inst._UpdateZElevation();
            this.debug = this._inst.GetPropertyValue('debug');
            this.instanceModel = this._inst.GetPropertyValue('instance-model');
            this.instanceTexture = this._inst.GetPropertyValue('image-texture');
            this.gltfData = null;
            this.xScale = this._inst.GetPropertyValue('x-scale');
            this.yScale = this._inst.GetPropertyValue('y-scale');
            this.zScale = this._inst.GetPropertyValue('z-scale');
            this.wireframe = this._inst.GetPropertyValue('wireframe');
            this.isEditor = true;
            this.xWireframeWidth = 1;
            this.yWireframeWidth = 1;
            this.zWireframeWidth = 1;

            const wi = this._inst;
            wi.SetOriginY(0.5);
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
            if (this.loadFailed) return;

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
                    const result = await gltfData.load(this.gltfPath, false, this.debug);
                    if (!result) {
                        this.loadFailed = true;
                        this.gltfDataLoad = false;
                        return;
                    }
                    await this.sdkType.LoadDynamicTextures(iRenderer, gltfData, textures, whiteTextureOwner, this.instanceModel);
                } 


                if (!this.instanceModel && this.gltfPath != 'path' && this.gltfPath != '' && sdkType.initOwner == -1)
                {
                    sdkType.initOwner = this.uid; 
                    const result = await gltfData.load(this.gltfPath, false, this.debug);
                    if (!result) {
                        sdkType.initOwner = -1; 
                        this.loadFailed = true;
                        return;
                    }
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
                    const z = this._inst.GetZElevation();

                    const tempQuad = new SDK.Quad();

                    if (this.loaded && this.gtlfPath != 'path')
                    {
                        this.drawVerts = [];
                        this.drawUVs = [];
                        this.drawIndices = [];
                        this.gltf.getPolygons();
                        this.gltf.render(iRenderer, x, y, z, tempQuad, whiteTextureOwner.whiteTexture, this._inst.GetColor(), textures, this.instanceTexture);
                        // this.layoutView.Refresh();
                        if ( this.maxBB[0] != Number.POSITIVE_INFINITY &&
                             this.minBB[0] != Number.NEGATIVE_INFINITY &&
                             this.maxBB[1] != Number.POSITIVE_INFINITY &&
                             this.minBB[1] != Number.NEGATIVE_INFINITY) {
                            const wi = this._inst;
                            let width = this.maxBB[0]-this.minBB[0];
                            let height = this.maxBB[1]-this.minBB[1];
                            height = height == 0 ? 1 : height;
                            width = width == 0 ? 1 : width;
                            wi.SetSize(width, height);
                            wi.SetOriginX(-(this.minBB[0]-x)/(width));
                            wi.SetOriginY(-(this.minBB[1]-y)/(height));
                        }
                        // wi.SetOriginX((0-this.minBB[0])/(this.maxBB[0]-this.minBB[0]));
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
                    // this._inst.SetZElevation(value);
                    // this._inst.UpdateZElevation();
                    // if (this.layoutView) this.layoutView.Refresh();
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
                    this.loadFailed = false;
                    break
                case 'debug':
                    this.debug = this._inst.GetPropertyValue('debug');
                    break;
                case 'image-texture':
                    this.instanceTexture = this._inst.GetPropertyValue('image-texture');
                    if (this.layoutView) this.layoutView.Refresh();
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
                case 'wireframe':
                    this.wireframe = this._inst.GetPropertyValue('wireframe');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                default:
                    break;
            }
        }

        OnTimelinePropertyChanged(id, value, detail)
        {
            switch(id)
            {
                case 'angle-x':
                    this.xAngle = this._inst.GetTimelinePropertyValue('angle-x');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'angle-y':
                    this.yAngle = this._inst.GetTimelinePropertyValue('angle-y');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'angle-z':
                    this.zAngle = this._inst.GetTimelinePropertyValue('angle-z');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'x-scale':
                    this.xScale = this._inst.GetTimelinePropertyValue('x-scale');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'y-scale':
                    this.yScale = this._inst.GetTimelinePropertyValue('y-scale');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
                case 'z-scale':
                    this.zScale = this._inst.GetTimelinePropertyValue('z-scale');
                    if (this.layoutView) this.layoutView.Refresh();
                    break;
            }
        }

        OnExitTimelineEditMode()
        {
            this.xAngle = this._inst.GetPropertyValue('angle-x');
            this.yAngle = this._inst.GetPropertyValue('angle-y');
            this.zAngle = this._inst.GetPropertyValue('angle-z');
            this.xScale = this._inst.GetPropertyValue('x-scale');
            this.yScale = this._inst.GetPropertyValue('y-scale');
            this.zScale = this._inst.GetPropertyValue('z-scale');
            
            if (this.layoutView) this.layoutView.Refresh();
        }

        LoadC2Property(name, valueString)
        {
            return false; // not handled
        }
    };
}