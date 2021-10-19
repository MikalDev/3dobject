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
            this.zScale = 6;
            this.debug = false;
            this.renderOnce = false;

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
                this.gtlfPath = properties[6];
                this.debug = properties[7]
            }

            this.localCenter = [0,0,0]

            // Initialization, once per group of instances
            let sdkType = this.sdkType;
            if (sdkType.initOwner == -1)
            {
                sdkType.initOwner = this.uid;
                if (this.gtlfPath != 'path')
                {
                    sdkType.gltfData.load(this.gtlfPath, true, this.debug);
                } 
            }
            
            this._StartTicking();
        }

        async doInit() {
            this.gltf = new globalThis.GltfModel(this._runtime, this.sdkType, this);
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

        Tick()
        {
            if (!this.loaded)
            {
                if (this.sdkType.loaded)
                {
                    if (!this.doingInit) {
                        this.doingInit = true;
                        this.doInit()
                    }
                }
            }

            // Animate gltf model
            if (this.gtlfPath !== 'path' && this.sdkType.loaded && this.loaded && this.animationPlay && !this.animationFinished)
            {
                if (this.gltf.gltfData.hasOwnProperty('animations'))
                {
                    this.animationTime += this._runtime.GetDt()*this.animationSpeed;
                    if ((this.animationTime - this.animationLastTime) >= (1/this.animationRate))
                    {
                        this.animationLastTime = this.animationTime;
                        this.drawVerts = [];
                        this.drawUVs = [];
                        this.drawIndices = [];
                        this.gltf.updateAnimation(this.animationIndex, this.animationTime);
                        this.gltf.getPolygons();    
                        this.runtime.UpdateRender();
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

            renderer.SetTexture(texture);

            const tempQuad = C3.New(C3.Quad);

            if (this.loaded && this.gtlfPath != 'path')
            {
                this.gltf.render(renderer, x, y, z, tempQuad);
                
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
    };
}