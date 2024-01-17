// @ts-check
"use strict";
{
    //@ts-ignorets-ignore
    self.C3.Plugins.Mikal_3DObject.Acts = {
        Rotate(angle, axis) {
            if (!this.loaded) return;
            this.model3D.rotate(angle, axis, false);
        },

        SetZElevation0(z) {
            const wi = this.GetWorldInfo();
            wi.SetZElevation(z);
            wi._UpdateZElevation();
            this.updateBbox = true
            this.updateBbox = true
        },

        SetLocalCenter(x,y,z) {
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
                console.log('gltfPath -ACE', gltfPath)
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

        async LoadMaterialFromSprite(materialUID, materialName) {
            if (!this.loaded) return;
            if (!materialName || !materialUID) return;
            this.spriteTextures.set(materialName, materialUID)
        },

        async UnloadMaterialFromSprite(materialName) {
            if (!this.loaded) return;
            if (!materialName) return;
            this.spriteTextures.delete(materialName)
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

        SetBlendMode(blendMode) {
            this.blendMode = blendMode;
            if (!this.loaded) return;
            const wi = this.GetWorldInfo();
            // wi.SetBlendMode(blendMode);
            // this.runtime.UpdateRender();
        },

        EnableNode(nodeName, enable) {
            if (!this.gltf) return;
            if (!this.gltf.gltfData) return;

            const node = this._findNode(nodeName);
            if (!node) return
            node.disabled = !enable;
            this.renderOnce = true;
            if (this.workerAnimation) {
                this.gltf.enableNode(nodeName, enable);
            }
        },

        SetNodeMorphWeight(nodeName, index, weight) {
            if (!this.gltf) return;
            if (!this.gltf.gltfData) return;

            const node = this._findNode(nodeName);
            if (!node) return
            if (!node.morphWeights) node.morphWeights = new Map();
            node.morphWeights.set(index, weight);
            this.renderOnce = true;
            if (this.workerAnimation) {
                this.gltf.setNodeMorphWeight(nodeName, index, weight);
            }
        },

        DeleteNodeMorphWeight(nodeName, index) {
            if (!this.gltf) return;
            if (!this.gltf.gltfData) return;

            const node = this._findNode(nodeName);
            if (!node) return
            if (!node.morphWeights) return;
            node.morphWeights.delete(index);
            this.renderOnce = true;
            if (this.workerAnimation) {
                this.gltf.deleteNodeMorphWeight(nodeName, index);
            }
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
        SetAnimationBlend(blendTime) {
            this.animationBlend = blendTime;
        },

        OffsetMaterialUV(materialName, u, v) {
            if (!this.gltf) return;
            if (!this.gltf.gltfData) return;

            if (this.materialsModify.has(materialName)) {
                const materialModify = this.materialsModify.get(materialName);
                materialModify.offsetUV = {u:u, v:v};
                this.materialsModify.set(materialName, materialModify);
            } else {
                this.materialsModify.set(materialName, {offsetUV:{u:u, v:v}});
            }
            this.renderOnce = true;
        },

        RotateMaterialUV(materialName, angle, x, y) {
            if (!this.gltf) return;
            if (!this.gltf.gltfData) return;

            // Change to angle radians
            angle = angle * Math.PI / 180;
            if (this.materialsModify.has(materialName)) {
                const materialModify = this.materialsModify.get(materialName);
                materialModify.rotateUV = {angle:angle, x:x, y:y};
                this.materialsModify.set(materialName, materialModify);
            } else {
                this.materialsModify.set(materialName, {rotateUV:{angle:angle, x:x, y:y}});
            }
            this.renderOnce = true;
        },
        SetLightDir(x, y, z) {
            if (!this.gltf) return
            if (!this.gltf.gltfData) return
            this.lightDir = [x,y,z]
        },
        SetViewPos(x, y, z) {
            if (!this.gltf) return
            if (!this.gltf.gltfData) return
            this.viewPos = [x,y,z]
        },        
        EnableLight (enable, color) {
            this.lightEnable = enable
            this.renderOnce = true
        },
        UpdateLight (enable) {
            this.lightUpdate = enable
        },
        EnableSpotLight (enable, x,y,z, cutoff, edge) {
            this.spotEnable = enable
            this.spotDir = [x,-y,z]
            this.spotCutoff = cutoff
            this.spotEdge = edge
        },
        AddLights(name, enable, colorWord, x, y, z, enableSpot, dirX, dirY, dirZ, cutoff, edge, attConstant, attLinear, attSquare, enableSpecular, specularAtt, specularPower) {
            const r = this.getRValue(colorWord)
            const g = this.getGValue(colorWord)
            const b = this.getBValue(colorWord)
            const a = this.getAValue(colorWord)
            const color = [r,g,b,a]
            const spotDir = [dirX, dirY, dirZ]
            const pos = [x,y,z]
            const cosTheta = Math.cos(cutoff/2 * Math.PI / 180)
            const cosThetaEdge = edge * cosTheta
            this.lights[name] = {
                enable,
                color,
                pos,
                enableSpot,
                spotDir,
                cutoff: cosTheta,
                edge: cosThetaEdge,
                attConstant,
                attLinear,
                attSquare,
                enableSpecular,
                specularAtt,
                specularPower
            }
        },
        DeleteLights(name){
            if (!(name in this.lights)) return
            delete this.lights[name]
        },
        EnableLights(name, enable){
            if (!(name in this.lights)) return
            this.lights[name].enable = enable
        },
        SetAmbientColor(colorWord){
            const r = this.getRValue(colorWord)
            const g = this.getGValue(colorWord)
            const b = this.getBValue(colorWord)
            const a = this.getAValue(colorWord)
            const color = [r,g,b,a]
            this.ambientColor = color
        },
        SetVertexRounding(round){
            this.vertexScale = round == 0 ? 0 : 1/round
        },

        SetQuaternion(quaternion,x,y,z) {
            this._setQuaternion(quaternion,x,y,z);
        },

        EnableQuaternion(enable) {
            this._enableQuaternion(enable);
        }
    }
}