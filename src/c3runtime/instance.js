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

            if (properties)
            {
                this.objPath = properties[0];
                this.mtlPath = properties[1];
                this.scale = properties[2];
            }

            // Initialization, once per group of instances
            let sdkType = this.sdkType;
            if (sdkType.initOwner == -1)
            {
                sdkType.initOwner = this.uid;
                sdkType.modelData.load(this.objPath, this.mtlPath, this.scale);
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
                    this.model3D = new globalThis.Model3D(this._runtime, this.sdkType);
                    this.loaded = true;
                    console.log('[3dObject] instance loaded');
                }
            }
        }

        Release()
        {
            super.Release();
        }

        Draw(renderer)
        {
            const imageInfo = this._objectClass.GetImageInfo();
            const texture = imageInfo.GetTexture();

            debugger
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
            // Add z elevation offset
            const z = 0;

            renderer.SetTexture(texture);

            const tempQuad = C3.New(C3.Quad);


            let i=0;
            while(i < fs.length)
            {
                let f = fs[i].p;
                let mtl = fs[i].mtl

                if (mtls[mtl].textured)
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
                debugger    
                renderer.Quad3D2(
                    x+p[f[0].v][0]*this.scale, y-p[f[0].v][1]*this.scale, z+p[f[0].v][2]*this.scale/10,
                    x+p[f[1].v][0]*this.scale, y-p[f[1].v][1]*this.scale, z+p[f[1].v][2]*this.scale/10,
                    x+p[f[2].v][0]*this.scale, y-p[f[2].v][1]*this.scale, z+p[f[2].v][2]*this.scale/10,
                    x+p[f[3].v][0]*this.scale, y-p[f[3].v][1]*this.scale, z+p[f[3].v][2]*this.scale/10,
                    tempQuad
                    );                
                i++;
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