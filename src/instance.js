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
            // this.runtime = inst.GetRuntime();
            // this.renderer = this.runtime.GetCanvasManager().GetWebGLRenderer();
            // this.uid = this.GetInstance().GetUID();
            this.loaded = false;
                // wi.SetZElevation(properties[3]);
                // wi._UpdateZElevation();
            this.localCenter = [0,0,0]
            /*
            // Initialization, once per group of instances
            let sdkType = this.sdkType;
            if (sdkType.initOwner == -1)
            {
                //sdkType.initOwner = this.uid;
                // sdkType.modelData.load(this.objPath, this.mtlPath, this.scale, false);
            }
            */
        }

        Release()
        {}

        OnCreate()
        {}

        OnPlacedInLayout()
        {
            // Initialise to size of image
            this.OnMakeOriginalSize();
        }

        Draw(iRenderer, iDrawParams)
        {
            const texture = this.GetTexture();

            if (texture)
            {
                this._inst.ApplyBlendMode(iRenderer);
                iRenderer.SetTexture(texture);
                // iRenderer.SetColor(this._inst.GetColor());
                // iRenderer.Quad3(this._inst.GetQuad(), this.GetTexRect());

                if (!this.scale) this.scale = this._inst.GetPropertyValue('scale');

                let sdkType = this.sdkType;
                if (sdkType.initOwner == -1)
                {
                    sdkType.initOwner = this.uid;
                    this.objPath = this._inst.GetPropertyValue('obj-path');
                    this.mtlPath = this._inst.GetPropertyValue('mtl-path');
                    sdkType.modelData.load(this.objPath, this.mtlPath, this.scale, false);
                }

                if (!this.loaded)
                {
                    if (this.sdkType.loaded)
                    {
                        // Create local version here
                        this.model3D = new globalThis.Model3D(this._runtime, this.sdkType, this);
                        this.loaded = true;
                        console.log('[3dObject] instance loaded');
                        console.log(this._inst);
                    }
                } else if (1)
                {
                    // 3D Model 
                    const data = this.model3D.data;
                    const p = data.obj.points;
                    const uv = data.obj.uvs;
                    const fs = data.obj.faces;
                    const n = data.obj.normals;
                    const mtls = data.mtls;

                    // const wi = this._inst.GetWorldInfo();
                    const x = this._inst.GetX();
                    const y = this._inst.GetY();
                    // z elevation handles offset on draw
                    const z = 0;

                    iRenderer.SetTexture(texture);

                    const tempQuad = new SDK.Quad();

                    // Create function, to share with editor
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
                        let center = this.localCenter;
                        // Could precalculate based on actions (e.g. scale, change localCenter)
                        iRenderer.Quad3D2(
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
        {}

        LoadC2Property(name, valueString)
        {
            return false; // not handled
        }
    };
}