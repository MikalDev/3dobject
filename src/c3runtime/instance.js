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
            this.xScale = 1;
            this.yScale = 1;
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
            this.wi = this.GetWorldInfo();
            this.cannonBody = null;
            this.quaternion = null;
            this.cannonSetRotation = false;

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
                this.xScale = properties[11];
                this.yScale = properties[12];
                this.zScale = properties[13];
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
            if (this.loaded)
            {
                if (this.animationPlay && this.gltf.gltfData.hasOwnProperty('animations'))
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
                            this.updateBbox = true
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
                    this.updateBbox = true
                }    
            }
            if (this.cannonBody) {
                const wi = this.wi;
                wi.SetXY(this.cannonBody.position.x, this.cannonBody.position.y);
                wi.SetZElevation(this.cannonBody.position.z);
                wi._UpdateZElevation();
                this.quaternion = this.cannonBody.quaternion;
                this.runtime.UpdateRender();
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
            const z = wi.GetZElevation();

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

                const xScale = this.scale/(this.xScale == 0 ? 1 : this.xScale);
                const yScale = this.scale/(this.yScale == 0 ? 1 : this.yScale);        
                const zScale = this.scale/(this.zScale == 0 ? 1 : this.zScale);
        
                if (this.updateBbox)
                {
                    this._updateBoundingBox(x,y,z);
                    // wi.SetOriginY(this.maxBB[1]/Math.abs(this.maxBB[1]-this.minBB[1]));
                    wi.SetBboxChanged()
                    this.updateBbox = false
                }
            }
        }

        _updateBoundingBox(x, y, z) {
            const maxBB = this.maxBB
            const minBB = this.minBB
            const cube = [
                [minBB[0], minBB[1], minBB[2]],
                [maxBB[0], minBB[1], minBB[2]],
                [maxBB[0], maxBB[1], minBB[2]],
                [minBB[0], maxBB[1], minBB[2]],
                [minBB[0], minBB[1], maxBB[2]],
                [maxBB[0], minBB[1], maxBB[2]],
                [maxBB[0], maxBB[1], maxBB[2]],
                [minBB[0], maxBB[1], maxBB[2]]   
            ];
            const modelRotate = this.gltf.modelRotate;
            if (!modelRotate) return;

            const xMinBB = [100000, 100000, 100000];
            const xMaxBB = [-100000, -100000, -100000];
            const vec3 = globalThis.glMatrix3D.vec3;

            const rotatedPoint = vec3.create();
            for (let i = 0; i < cube.length; i++) {
                const cubePoint = cube[i];
                const point = vec3.fromValues(cubePoint[0], cubePoint[1], cubePoint[2]);
                vec3.transformMat4(rotatedPoint, point, modelRotate);
                if (xMinBB[0] > rotatedPoint[0]) xMinBB[0] = rotatedPoint[0]
                if (xMinBB[1] > rotatedPoint[1]) xMinBB[1] = rotatedPoint[1]
                if (xMinBB[2] > rotatedPoint[2]) xMinBB[2] = rotatedPoint[2]
                if (xMaxBB[0] < rotatedPoint[0]) xMaxBB[0] = rotatedPoint[0]
                if (xMaxBB[1] < rotatedPoint[1]) xMaxBB[1] = rotatedPoint[1]
                if (xMaxBB[2] < rotatedPoint[2]) xMaxBB[2] = rotatedPoint[2]
            }

            const wi = this.GetWorldInfo();
            let width = xMaxBB[0]-xMinBB[0];
            let height = xMaxBB[1]-xMinBB[1];
            height = height == 0 ? 1 : height;
            width = width == 0 ? 1 : width;
            wi.SetSize(width, height);
            wi.SetOriginX(-(xMinBB[0]-x)/(width));
            wi.SetOriginY(-(xMinBB[1]-y)/(height));
            this._setZHeight((xMaxBB[2]-xMinBB[2]));
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
            this.xScale = null;
            this.yScale = null;
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

        _setCannonBody(body, setRotaion) {
            this.cannonBody = body;
            this.cannonSetRotation = setRotaion;
        }

        GetScriptInterfaceClass()
		{
            // @ts-ignore
			return self.I3DObjectInstance;
		}
    };

    // Script interface. Use a WeakMap to safely hide the internal implementation details from the
	// caller using the script interface.
	const map = new WeakMap();
    // @ts-ignore
    self.I3DObjectInstance = class I3DObjectInstance extends self.IWorldInstance {
		constructor()
		{
			super();
            // Map by SDK instance
            // @ts-ignore
			map.set(this, self.IInstance._GetInitInst().GetSdkInstance());
            // @ts-ignore
		}

        setCannonBody(body, setRotaion = true)
        {
            map.get(this)._setCannonBody(body, setRotaion);
        }
    };
}