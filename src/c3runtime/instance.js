"use strict";
{
    const C3 = self.C3;

    C3.Plugins.Mikal_3DObject.Instance = class Object3DInstance extends C3.SDKWorldInstanceBase
    {
        constructor(inst, properties)
        {

            super(inst);
            this.sdkType = this.GetSdkType();
            this.runtime = inst.GetRuntime();
            this.renderer = this.runtime.GetCanvasManager().GetWebGLRenderer();
            this.uid = this.GetInstance().GetUID();
            this.loaded = false;
            this.animationTime = 0;
            this.drawVerts = [];
            this.drawUVs = [];
            this.drawIndices = [];
            this.animationIndex = 0;
            this.animationSpeed = 1;
            this.animationLastTime = 0;
            this.animationRate = 60;
            this.animationLoop = true;
            this.animationPlay = true;
            this.animationFinished = false;
            this.animationName = '';
            this.zScale = 1;
            this.debug = false;
            this.renderOnce = false;
            this.currentAnimationTime = 0;
            this.currentAnimationFrame = 0;
            this.drawVertsCache = [];
            this.drawUVsCache = [];
            this.minBB = [0,0,0]
            this.maxBB = [0,0,0]
            this.updateBbox = true
            this.gltfData = null;
            this.instanceModel = false
            this.texture = {};
            this.dataLoaded = false;
            this.drawMeshes = [];
            this.whiteTexture = null;
            this.instanceTexture = false;

            if (properties)
            {
                this.scale = properties[0];
                const wi = inst.GetWorldInfo();
                wi.SetZElevation(properties[1]);
                wi._UpdateZElevation();
                this.xAngle = properties[2];
                this.yAngle = properties[3];
                this.zAngle = properties[4];
                this.rotationOrder = properties[5];
                this.gltfPath = properties[6];
                this.debug = properties[7];
                this.animationBlend = properties[8];
                this.instanceModel = properties[9];
                this.instanceTexture = properties[10];
            }

            this.localCenter = [0,0,0]

            // Initialization, once per group of instances unless model data specified per instance
            if (this.instanceModel) {
                this.gltfData = new globalThis.GltfData(this.runtime, this);
                if (this.gltfPath != 'path' && this.gltfPath != '')
                {
                    this.gltfData.load(this.gltfPath, true, this.debug);
                } 
            } else {
                let sdkType = this.sdkType;
                if (sdkType.initOwner == -1)
                {
                    sdkType.initOwner = this.uid;
                    if (this.gltfPath != 'path' && this.gltfPath != '')
                    {
                        sdkType.gltfData.load(this.gltfPath, true, this.debug);
                    } 
                }
            }
            
            this._StartTicking();
            const wi = this.GetWorldInfo();
            wi.SetOriginY(1);
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
            this.runtime.UpdateRender();
            if (this.gltf.getAnimationNames().length > 0)
            {
                this.animationName = this.gltf.getAnimationNames()[0]
            }
            this.Trigger(C3.Plugins.Mikal_3DObject.Cnds.OnLoaded);
        }

        IsOnScreen() {
            const wi = this.GetWorldInfo();
            const layer = wi.GetLayer();
            if (layer.Has3DCamera())
                return wi.IsInViewport3D(layer._GetViewFrustum());
            else
                return wi.IsInViewport(layer.GetViewport(), wi.GetLayout().HasVanishingPointOutsideViewport(), wi.GetLayout().IsOrthographicProjection())
        }

        Tick()
        {
            const onScreen = this.IsOnScreen();

            if (!this.loaded)
            {
                if ((!this.instanceModel && this.sdkType.dataLoaded) || (this.instanceModel && this.dataLoaded))
                {
                    if (!this.doingInit) {
                        this.doingInit = true;
                        this.doInit()
                    }
                }
            }

            // Animate gltf model
            if (this.loaded && this.animationPlay)
            {
                if (this.gltf.gltfData.hasOwnProperty('animations'))
                {
                    this.animationTime += this._runtime.GetDt()*this.animationSpeed;
                    const deltaTime = this.animationTime - this.animationLastTime;
                    if ((deltaTime) >= (1/this.animationRate))
                    {
                        this.animationLastTime = this.animationTime;
                        this.drawVerts = [];
                        this.drawUVs = [];
                        this.drawIndices = [];
                        this.gltf.updateAnimation(this.animationIndex, this.animationTime, onScreen, deltaTime);
                        if (onScreen)
                        {
                            this.gltf.getPolygons();    
                            this.runtime.UpdateRender();    
                        }
                    }
                } else if (this.renderOnce)
                {
                    this.renderOnce = false;
                    this.drawVerts = [];
                    this.drawUVs = [];
                    this.drawIndices = [];
                    this.gltf.getPolygons();    
                    this.runtime.UpdateRender();
                }    
            }
        }

        Release()
        {
            super.Release();
        }

        RendersToOwnZPlane() {
            return false;
        }

        _setZHeight(h) {
            h = Math.max(h, 0);
            if (this._zHeight === h)
                return;
            this._zHeight = h;
            this.GetWorldInfo().SetDepth(h);
            this._runtime.UpdateRender()
        }

        Draw(renderer)
        {
            const imageInfo = this._objectClass.GetImageInfo();
            const texture = imageInfo.GetTexture();

            if (!texture) return; // dynamic texture load which hasn't completed yet; can't draw anything
            if (!this.loaded) return;

            const wi = this.GetWorldInfo();
            const x = wi.GetX();
            const y = wi.GetY();
            // z elevation handles offset on draw
            const z = 0;

            let textures = this.instanceModel ? this.texture : this.sdkType.texture
            let whiteTextureOwner = this.instanceModel ? this : this.sdkType
            let gltfData = this.instanceModel ? this.gltfData : this.sdkType.gltfData
            this.sdkType.LoadDynamicTextures(renderer, gltfData, textures, whiteTextureOwner, this.instanceModel);

            if (textures.length === 0 || this.instanceTexture) {
                renderer.SetTexture(texture);
            }

            const tempQuad = C3.New(C3.Quad);

            if (this.loaded && this.gltfPath != 'path')
            {
                this.gltf.render(renderer, x, y, z, tempQuad, whiteTextureOwner.whiteTexture, wi.GetPremultipliedColor(), textures, this.instanceTexture);
                wi.SetSize(this.maxBB[0]-this.minBB[0], this.maxBB[1]-this.minBB[1]);
                if (this.updateBbox)
                {
                    wi.SetBboxChanged()
                    this.updateBbox = false
                }
            } else
            {
                return
            }
        }

        SaveToJson()
        {
            return {
                // data to be saved for savegames
            };
        }

        LoadFromJson(o)
        {
            // load state for savegames
        }

        GetDebuggerProperties()
        {
            return [
            {
                title: "3DObject",
                properties: [
                    //{name: ".current-animation",	value: this._currentAnimation.GetName(),	onedit: v => this.CallAction(Acts.SetAnim, v, 0) },
                ]
            }];
        }

        // timeline support
        GetPropertyValueByIndex(index)
        {
            return 0;
        }

        SetPropertyValueByIndex(index, value)
        {
            //set property value here
        }

        Release()
        {
            if (this.texture.length > 0) {
                for (let i = 0; i < this.texture.length; i++) {
                    this.renderer.DeleteTexture(this.texture[i]);
                }
            }
            if (this.whiteTexture) {
                this.renderer.DeleteTexture(this.whiteTexture);
            }
            this.sdkType = null;
            this.runtime = null;
            this.renderer = null;
            this.uid = null;
            this.loaded = null;
            this.animationTime = null;
            this.drawVerts = null;
            this.drawUVs = null;
            this.drawIndices = null;
            this.animationIndex = null;
            this.animationSpeed = null;
            this.animationLastTime = null;
            this.animationRate = null;
            this.animationLoop = null;
            this.animationPlay = null;
            this.animationFinished = null;
            this.animationName = null;
            this.zScale = null;
            this.debug = null;
            this.renderOnce = null;
            this.currentAnimationTime = null;
            this.currentAnimationFrame = null;
            this.drawVertsCache = null;
            this.drawUVsCache = null;
            this.minBB = [0,0,0];
            this.maxBB = [0,0,0];
            this.updateBbox = null;
            this.gltfData = null;
            this.instanceModel = null;
            this.texture = null;
            this.dataLoaded = null;
            this.drawMeshes = null;
            this.whiteTexture = null;
            super.Release();
        }
    };
}