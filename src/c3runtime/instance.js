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

            if (properties)
            {
                this.objPath = properties[0];
                this.mtlPath = properties[1];
                this.scale = properties[2];
                const wi = inst.GetWorldInfo();
                wi.SetZElevation(properties[3]);
                wi._UpdateZElevation();
                this.xAngle = properties[4];
                this.yAngle = properties[5];
                this.zAngle = properties[6];
                this.rotationOrder = properties[7];
                this.gtlfPath = properties[8];
            }

            this.localCenter = [0,0,0]

            // Initialization, once per group of instances
            let sdkType = this.sdkType;
            if (sdkType.initOwner == -1)
            {
                sdkType.initOwner = this.uid;
                sdkType.modelData.load(this.objPath, this.mtlPath, this.scale, true);
                if (this.gtlfPath != 'path')
                {
                    sdkType.gltfData.load(this.gtlfPath, true);
                } 
            }
            
            this._StartTicking();
        }

        Tick()
        {
            if (!this.loaded)
            {
                if (this.sdkType.loaded)
                {
                    // Create local version here
                    this.model3D = new globalThis.Model3D(this._runtime, this.sdkType, this);
                    this.localCenter = this.model3D.data.obj.center;
                    console.log('[3DObject] localCenter', this.localCenter);
                    this.loaded = true;
                    this.Trigger(C3.Plugins.Mikal_3DObject.Cnds.OnLoaded);
                    console.log('[3dObject] instance loaded');
                    this.model3D.rotateOrdered(this.xAngle,this.yAngle,this.zAngle,this.rotationOrder);

                    // gtlf model
                    if (this.gtlfPath != 'path') this.gltf = new globalThis.GltfModel(this._runtime, this.sdkType, this);
                }
            }

            // Animate gltf model
            if (this.gtlfPath != 'path' && this.loaded && this.sdkType.gltfLoaded )
            {
                this.animationTime += this._runtime.GetDt();
                if ((this.animationTime - this.animationLastTime) >= (1/this.animationRate))
                {
                    this.animationLastTime = this.animationTime;
                    this.drawVerts = [];
                    this.drawUVs = [];
                    this.drawIndices = [];
                    this.gltf.updateAnimation(this.animationIndex, this.animationTime);
                    this.gltf.getPolygons();    
                }
            }
            this.runtime.UpdateRender();
        }

        Release()
        {
            super.Release();
        }

        RendersToOwnZPlane() {
            return false;
        }

        Draw(renderer)
        {
            const imageInfo = this._objectClass.GetImageInfo();
            const texture = imageInfo.GetTexture();

            if (!texture) return; // dynamic texture load which hasn't completed yet; can't draw anything
            if (!this.loaded) return;

            // 3D Model 
            const data = this.model3D.data;
            const p = data.obj.points;
            const uv = data.obj.uvs;
            const fs = data.obj.faces;
            const n = data.obj.normals;
            const mtls = data.mtls;

            const wi = this.GetWorldInfo();
            const quad = wi.GetBoundingQuad();
            const rcTex = imageInfo.GetTexRect();
            const x = wi.GetX();
            const y = wi.GetY();
            // z elevation handles offset on draw
            const z = 0;

            renderer.SetTexture(texture);

            const tempQuad = C3.New(C3.Quad);

            if (this.gtlfPath != 'path')
            {
                for (let ii=0;ii<this.drawVerts.length;ii++)
                {
                    let v = this.drawVerts[ii];
                    let uv = this.drawUVs[ii];
                    let ind = this.drawIndices[ii];

                    let triangleCount = ind.length/3;
                    let center = [0,0,0];

                    for(let i = 0; i<triangleCount; i++)
                    {
                        if (true)
                        {
                            tempQuad.set(
                            uv[ind[i*3+0]*2+0], uv[ind[i*3+0]*2+1],
                            uv[ind[i*3+1]*2+0], uv[ind[i*3+1]*2+1],
                            uv[ind[i*3+2]*2+0], uv[ind[i*3+2]*2+1],
                            uv[ind[i*3+2]*2+0], uv[ind[i*3+2]*2+1]
                            );
                        } else
                        {
                            // Set face to color if possible
                            tempQuad.set(0,0,1,0,0,1,0,1);
                        }
                        
                        let x0 = x+(v[ind[i*3+0]*3+0]-center[0])*this.scale;
                        let y0 = y-(v[ind[i*3+0]*3+1]-center[1])*this.scale;
                        let z0 = z+(v[ind[i*3+0]*3+2]-center[2])*this.scale/10;
                        let x1 = x+(v[ind[i*3+1]*3+0]-center[0])*this.scale;
                        let y1 = y-(v[ind[i*3+1]*3+1]-center[1])*this.scale;
                        let z1 = z+(v[ind[i*3+1]*3+2]-center[2])*this.scale/10;
                        let x2 = x+(v[ind[i*3+2]*3+0]-center[0])*this.scale;
                        let y2 = y-(v[ind[i*3+2]*3+1]-center[1])*this.scale;
                        let z2 = z+(v[ind[i*3+2]*3+2]-center[2])*this.scale/10;

                        renderer.Quad3D2(
                            x0, y0, z0,
                            x1, y1, z1,
                            x2, y2, z2,
                            x2, y2, z2,
                            tempQuad
                            ); 
                    }
                }
            } else

            // obj/mtl
            {
                // Create function, to share with editor
                let i=0;
                while(i < fs.length)
                {
                    let f = fs[i].p;
                    let mtl = fs[i].mtl

                    // if (mtls[mtl].textured)
                    // Assume texture exists, only one texture currently
                    if (true)
                    {
                        tempQuad.set(
                        uv[f[0].uv][0], 1-uv[f[0].uv][1],
                        uv[f[1].uv][0], 1-uv[f[1].uv][1],
                        uv[f[2].uv][0], 1-uv[f[2].uv][1],
                        uv[f[3].uv][0], 1-uv[f[3].uv][1]
                        );
                    } else
                    {
                        // Set face to color if possible
                        tempQuad.set(0,0,1,0,0,1,1,1);
                    }
                    let center = this.localCenter;
                    // Could precalculate based on actions (e.g. scale, change localCenter)
                    renderer.Quad3D2(
                        x+(p[f[0].v][0]-center[0])*this.scale, y-(p[f[0].v][1]-center[1])*this.scale, z+(p[f[0].v][2]-center[2])*this.scale/10,
                        x+(p[f[1].v][0]-center[0])*this.scale, y-(p[f[1].v][1]-center[1])*this.scale, z+(p[f[1].v][2]-center[2])*this.scale/10,
                        x+(p[f[2].v][0]-center[0])*this.scale, y-(p[f[2].v][1]-center[1])*this.scale, z+(p[f[2].v][2]-center[2])*this.scale/10,
                        x+(p[f[3].v][0]-center[0])*this.scale, y-(p[f[3].v][1]-center[1])*this.scale, z+(p[f[3].v][2]-center[2])*this.scale/10,
                        tempQuad
                        );                
                    i++;
                }
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