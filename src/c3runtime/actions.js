// @ts-check
"use strict";
{
    //@ts-ignorets-ignore
    self.C3.Plugins.Mikal_3DObject.Acts = {
        Rotate(angle, axis) {
            if (!this.loaded) return;
            this.model3D.rotate(angle, axis, false);
        },

        SetZElevation(z) {
            const wi = this.GetWorldInfo();
            wi.SetZElevation(z);
            wi._UpdateZElevation();
            this.updateBbox = true
        },

        SetLocalCenter(x,y,z) {
            const wi = this.GetWorldInfo();
            wi.SetOriginX(x);
            wi.SetOriginY(y);
            this.localCenter[0] = x;
            this.localCenter[1] = y;
            this.localCenter[2] = z;
        },

        SetScale(scale) {
            this.scale = scale;
            this.runtime.UpdateRender();
            this.updateBbox = true
        },
        
        SetRotationZXY(x,y,z) {
            // Order of rotation based on Unity's procedure: Z,X,Y
            if (!this.loaded) return;
            this.model3D.rotateZXY(x,y,z);
            this.updateBbox = true
        },
        
        SetRotationOrdered(x,y,z,order) {
            if (!this.loaded) return;
            this.xAngle = x;
            this.yAngle = y;
            this.zAngle = z;
            this.runtime.UpdateRender();
            this.updateBbox = true
        },

        PlayAnimation(animation, loop) {
            if (!this.loaded) return;
            let names = this.gltf.getAnimationNames();
            if (!names) return;
            let newAnimationIndex = -1;
            names.forEach((name, index) => {
                if (animation == name) {
                    newAnimationIndex = index;
                } 
            });
            if (newAnimationIndex >= 0)
            {
                this.animationName = animation;
                this.animationTime = 0;
                this.animationLastTime = 0;
                this.animationIndex = newAnimationIndex;
                this.animationLoop = loop;
                this.animationPlay = true;
                this.animationFinished = false;
            }
            this.updateBbox = true
        },
        SetAnimationRate(rate) {
            this.animationRate = rate;
        },
        SetZHeight(h) {
            this._setZHeight(h);
            this.updateBbox = true
        },
        SetAnimationSpeed(speed) {
            this.animationSpeed = speed;
        },
        StopAnimation() {
            this.animationPlay = false;
        },
        UnpauseAnimation() {
            this.animationPlay = true;
        },
        SetXScale(xScale) {
            this.xScale = xScale;
            this.runtime.UpdateRender();
            this.updateBbox = true
        },
        SetYScale(yScale) {
            this.yScale = yScale;
            this.runtime.UpdateRender();
            this.updateBbox = true
        },
        SetZScale(zScale) {
            this.zScale = zScale;
            this.runtime.UpdateRender();
            this.updateBbox = true
        },
        UpdateBbox() {
            this.updateBbox = true
        },
        LoadModel(gltfPath) {
            if (!gltfPath || gltfPath == '' || gltfPath == 'path') return
            if (this.instanceModel&&this.dataLoaded) return
            if (!this.instanceModel&&this.sdkType.dataLoaded) return

            if (this.instanceModel) {
                //@ts-ignore
                this.gltfData = new globalThis.GltfData(this.runtime, this);
                this.gltfData.load(gltfPath, true, this.debug);
                this.gltfData.dynamicTexturesLoaded = false;
                this.doingInit = false;
                this.loaded = false;    
            } else {
                let sdkType = this.sdkType;
                sdkType.initOwner = this.uid;
                sdkType.gltfData.load(gltfPath, true, this.debug);
                sdkType.gltfData.dynamicTexturesLoaded = false;
                this.doingInit = false;
                this.loaded = false;        
            }
            this.runtime.UpdateRender();
            this.updateBbox = true
        },

        async LoadMaterial(materialPath, materialName) {
            if (!this.loaded) return;
            const textures = this.instanceModel ? this.texture : this.sdkType.texture;

            if (!textures) return;
            if (!materialName || !materialPath) return;
            const renderer = this.renderer;
            let textureURI = await this.runtime.GetAssetManager().GetProjectFileUrl(materialPath);
            let response = await fetch(textureURI, {mode:'cors'});
            let blob = await response.blob()
            let imageBitmap;
            if (typeof globalThis.createImageBitmap === 'function') {
                imageBitmap = await createImageBitmap(blob);
            } else {
                //@ts-ignore
                imageBitmap = await globalThis.GltfData.createImageBitmap(blob);
            }

            if (!imageBitmap) return;

            const width = imageBitmap.width;
            const height = imageBitmap.height;
            const sampling = this.runtime.GetSampling();
            let options =  { sampling: sampling }
            
            textures[materialName] = renderer.CreateDynamicTexture(width, height, options);
            await renderer.UpdateTexture(imageBitmap, textures[materialName]);
            textures[materialName].materialPath = materialPath;
            if (typeof imageBitmap.close === "function") imageBitmap.close();
        },

        SetMeshMaterial(nodeName, materialName) {
            const meshName = this.gltf.nodeMeshMap[nodeName];
            if (!meshName) {
                if (this.debug) console.warn('[3DObject] SetMeshMaterial node not found', nodeName);
                return;
            }

            const textures = this.instanceModel ? this.texture : this.sdkType.texture;
            if (!(materialName in textures)) {
                if (this.debug) console.warn('[3DObject] SetMeshMaterial material not found', materialName);
                return;
            }
            for(let ii = 0; ii < this.gltf.gltfData.skinnedNodes.length; ii++) {
                let node = this.gltf.gltfData.skinnedNodes[ii];
                let mesh = node.mesh;
                if (!mesh) continue;
                if (mesh.name === meshName) {
                    for (let jj = 0; jj < mesh.primitives.length; jj++) {
                        let primitive = mesh.primitives[jj];
                        if ('material' in primitive) primitive.material =
                            {   name: materialName,
                                pbrMetallicRoughness:{baseColorTexture:{index:0}}};
                    }
                }
            }

            for(let ii = 0; ii < this.gltf.gltfData.nodes.length; ii++) {
                let node = this.gltf.gltfData.nodes[ii];
                let mesh = node.mesh;
                if (!mesh) continue;
                if (mesh.name === meshName) {
                    for (let jj = 0; jj < mesh.primitives.length; jj++) {
                        let primitive = mesh.primitives[jj];
                        if (!primitive) continue;
                        if ('material' in primitive) primitive.material = 
                        {   name: materialName,
                            pbrMetallicRoughness:{baseColorTexture:{index:0}}};
                        }
                }
            }
            this.renderOnce = true;
        },

        EnableNode(nodeName, enable) {
            if (!this.gltf) return;
            if (!this.gltf.gltfData) return;

            const node = this._findNode(nodeName);
            if (!node) return
            node.disabled = !enable;
            this.renderOnce = true;
        },
        
        OffsetNodeUV(nodeName, u, v) {
            if (!this.gltf) return;
            if (!this.gltf.gltfData) return;

            const node = this._findNode(nodeName);
            if (!node) return
            node.offsetUV = {u:u, v:v};
            this.renderOnce = true;
        },

        DeleteMaterial(materialName) {
            const renderer = this.renderer
            const textures = this.instanceModel ? this.texture : this.sdkType.texture;
            if ((materialName in textures)) {
                renderer.DeleteTexture(textures[materialName]);
                delete textures[materialName];
            }
        },

        SetOriginX(xOrigin) {
            const wi = this.GetWorldInfo();
            wi.SetOriginX(xOrigin);
            wi.SetBboxChanged();
        },

        SetOriginY(yOrigin) {
            const wi = this.GetWorldInfo();
            wi.SetOriginY(yOrigin);
            wi.SetBboxChanged();
        },

        SetBBoxScale(scale) {
            this._setBBoxScale(scale);
        },

        EnableWireframe(enable) {
            this.wireframe = enable;
        },

        SetWireframeWidths(x, y, z) {
            this.xWireframeWidth = x;
            this.yWireframeWidth = y;
            this.zWireframeWidth = z;
        },

        LoadModelFromTemplate(uid) {
            if (!this.instanceModel) {
                console.warn('LoadModelFromTemplate only works on instance models');
                return;
            }
            const template = this.runtime.GetInstanceByUID(uid);
            if (!template) {
                console.warn('LoadModelFromTemplate template uid not found', uid);
                return;
            }
            const objectName = this.GetObjectClass().GetName();
            const templateObjectName = template.GetObjectClass().GetName();
            if (objectName !== templateObjectName) {
                console.warn('LoadModelFromTemplate: template object type does not match, instance uid, template uid', this.uid, uid);
                return;
            }
            const templateInst = template.GetSdkInstance();
            if (!templateInst.loaded) {
                console.warn('LoadModelFromTemplate: template not loaded, instance uid, template uid', this.uid, uid);
                return;
            }
            this.sdkType = templateInst;
            this.sdkType.dataLoaded = true;
            this.instanceModel = false;
        },

    }
}