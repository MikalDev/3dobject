// @ts-check
'use strict';
class GltfModelW
{ 
    constructor(runtime, sdkType, inst)
	{
        const mat4 = globalThis.glMatrix3D.mat4;

		this._runtime = runtime;
        this._sdkType = sdkType;
		this.inst = inst;
        this.gltfData = {};
        this._blendState = 'init';
        this._lastTarget = [];
        this._blendTarget = [];
        this._blendTime = 0;
        this._lastIndex = 0;
        this.drawMeshes = [];
        this.drawMeshesIndex = 0;
        this.currentColor = [-1,-1,-1,-1];
        this.nodeMeshMap = {};
        this.modelRotate = mat4.create();
        this.meshNames = new Map()
        this.msgPort = null;
        this.arrayBufferIndex = 0;
        this.buff = null;
        this.verts = new Float32Array(0);
        this.updateDrawVerts = false;
        this.activeNodes = [];
    }

    release() {
        if (this.msgPort) {
            this.msgPort.postMessage({type: 'release'});
            this.msgPort.onmessage = null;
            this.msgPort.close();
        }
        this._runtime = null;
        this._sdkType = null;
		this.inst = null;
        // @ts-ignore
        this.gltfData = null;
        // @ts-ignore
        this._blendState = null;
        // @ts-ignore
        this._lastTarget = null;
        // @ts-ignore
        this._blendTarget = null;
        // @ts-ignore
        this._blendTime = null;
        // @ts-ignore
        this._lastIndex = null;
        // @ts-ignore
        this.drawMeshes = null;
        // @ts-ignore
        this.drawMeshesIndex = null;
        // @ts-ignore
        this.currentColor = null;
        // @ts-ignore
        this.nodeMeshMap = null;
        this.modelRotate = null;
        // @ts-ignore
        this.meshNames = null
        this.msgPort = null;
        // @ts-ignore
        this.arrayBufferIndex = null;
        this.buff = null;
        // @ts-ignore
        this.verts = null;
        // @ts-ignore
        this.updateDrawVerts = null;
        // @ts-ignore
        this.activeNodes = null;
    }


    async init() {
		// Deep copy
		// For instance version, may only need points, others remain stable, full copy for now
        this._sdkType.gltfData.gltf.buffers = null;
        this.gltfData = await this.structuralClone(this._sdkType.gltfData.gltf)
        if ('buffers' in this.gltfData) {
            this.gltfData.buffers = null
        }
        if ('imageBitmap' in this.gltfData) {
            this.gltfData.imageBitmap = null
        }
        // Create node mesh map
        for (let ii=0; ii<this.gltfData.nodes.length; ii++) {
            let node = this.gltfData.nodes[ii];
            if (!node.mesh) continue;
            this.nodeMeshMap[node.name] = node.mesh.name;
        }
        // Create dedicdated web worker for skinned mesh animation
        this.initDrawMeshes();
        this.drawMeshesMin = this.drawMeshes
        await this.createWorker(this._runtime)
    }

    initDrawMeshes() {
        // For each mesh, create a drawMesh and initialize with UV, indices, name and material
        const gltf = this.gltfData
        this.drawMeshesIndex = -1;
        // update all scene meshes, except skinned meshes
        for(let i = 0; i < gltf.scene.nodes.length; i++) {
            this.scanNode(gltf.scene.nodes[i], false);
        }
        // skinned nodes
        for(let ii = 0; ii < gltf.skinnedNodes.length; ii++) {
            this.scanNode(gltf.skinnedNodes[ii], true);
        }
    }

    scanNode(node, scanSkin) {
        if(node.mesh != undefined && node.skin == undefined || scanSkin)  
        {
            for(let i = 0; i < node.mesh.primitives.length; i++)
            {
                let posDataLength = node.mesh.primitives[i].attributes.POSITION.data.length;
                this.drawMeshesIndex++;
                if (!this.drawMeshes[this.drawMeshesIndex]) {
                    this.drawMeshes.push(
                        {
                            drawVerts: [],
                            bufferViews: [],
                            drawUVs: [],
                            drawIndices: [],
                            disabled: false,
                        }
                    )
                }
                this.drawMeshes[this.drawMeshesIndex].bufferViews.push({start: this.arrayBufferIndex, length: posDataLength})
                this.arrayBufferIndex += posDataLength;
                this.meshNames.set(node.name, this.drawMeshesIndex)
                this.drawMeshes[this.drawMeshesIndex].disabled = node.disabled;
                if (node.offsetUV) this.drawMeshes[this.drawMeshesIndex].offsetUV = node.offsetUV;
                if ('material' in node.mesh.primitives[i]) {
                    this.drawMeshes[this.drawMeshesIndex].material = node.mesh.primitives[i].material;
                } else {
                    this.drawMeshes[this.drawMeshesIndex].material = null;
                }

                const drawUVs = this.drawMeshes[this.drawMeshesIndex].drawUVs;
                const drawIndices = this.drawMeshes[this.drawMeshesIndex].drawIndices;

                if (drawUVs.length === 0 && ('TEXCOORD_0' in node.mesh.primitives[i].attributes)) {
                    drawUVs.push(Array.from(node.mesh.primitives[i].attributes.TEXCOORD_0.data));
                }
                if (drawIndices.length === 0) { 
                    drawIndices.push(Array.from(node.mesh.primitives[i].indices.data));
                }
            }
        }
        if (node.children) {
            for (let ii=0; ii<node.children.length; ii++) {
                this.scanNode(node.children[ii]);
            }
        }
    }


    async createWorker(runtime)
    {
        // Create the worker with the runtime.createWorker() method.
        // This must be awaited and resolves with a messagePort.
        let path = await runtime.GetAssetManager().GetProjectFileUrl("gltfWorker.js")
        this.msgPort = await runtime._iRuntime.createWorker(path);
        // Add an onmessage handler to receive message
        this.msgPort.onmessage = ((e) =>
        {
            if (!e.data.type) {
                this.buff = e.data.buff;
                this.activeNodes = e.data.activeNodes;
                this.verts = new Float32Array(this.buff);
                this.setBBFromVerts(this.verts, this.inst.minBB, this.inst.maxBB);
                this.inst.updateBbox = true;
                this.updateDrawVerts = true;
                
                // if (this.inst.debug) console.log('onMsg t:',runtime.GetTickCount(), this.verts[this.verts.length-1], typeof e.data)
            } else
            {
                if (this.inst.debug) console.log('onMsg t:',runtime.GetTickCount(), e.data.type)
            }
        });
        // Send the gltfModel to the worker
        const bufferViews = this.drawMeshes[this.drawMeshes.length-1].bufferViews;
        const buffLength = bufferViews[bufferViews.length-1].start + bufferViews[bufferViews.length-1].length;
        this.msgPort.postMessage({type: 'gltf', gltf: this.gltfData, buffLength: buffLength, drawMeshes: this.drawMeshes});
        // Now messages can be posted to the worker with:
        // messagePort.postMessage(...);
        // this.msgPort.postMessage({type: 'init'});
        return { msgPort: this.msgPort }
    }

    enableNode(nodeName, enable) {
        this.msgPort.postMessage({type: 'enableNode', nodeName: nodeName, enable: enable});
    }

    setNodeMorphWeight(nodeName, index, weight) {
        this.msgPort.postMessage({type: 'setNodeMorphWeight', nodeName, index, weight});
    }

    deleteNodeMorphWeight(nodeName, index) {
        this.msgPort.postMessage({type: 'deleteNodeMorphWeight', nodeName, index});
    }

    setBBFromVerts(verts, minBBox, maxBBox) {
        let l = verts.length-2
        maxBBox[2] =  verts[l--]
        maxBBox[1] =  verts[l--]
        maxBBox[0] =  verts[l--]
        minBBox[2] =  verts[l--]
        minBBox[1] =  verts[l--]
        minBBox[0] =  verts[l--]
    }
    
    
    structuralClone(obj) {
        return new Promise(resolve => {
          const {port1, port2} = new MessageChannel();
          port2.onmessage = ev => resolve(ev.data);
          port1.postMessage(obj);
        });
    }

    render(renderer, x, y, z, tempQuad, whiteTexture, instanceC3Color, textures, instanceTexture)
    {
        let totalTriangles = 0;
        let currentColor = [-1,-1,-1,-1];
        let currentTexture = null;

        const vec4 = globalThis.glMatrix3D.vec4;
        const vec2 = globalThis.glMatrix3D.vec2;
        const mat2 = globalThis.glMatrix3D.mat2;
        const mat4 = globalThis.glMatrix3D.mat4;
        const quat = globalThis.glMatrix3D.quat;

        let xWireframeWidth, yWireframeWidth, zWireframeWidth;

        if (this.inst.wireframe) {
            const xScale = this.inst.scale/(this.inst.xScale == 0 ? 1 : this.inst.xScale);
            const yScale = this.inst.scale/(this.inst.yScale == 0 ? 1 : this.inst.yScale);        
            const zScale = this.inst.scale/(this.inst.zScale == 0 ? 1 : this.inst.zScale);

            xWireframeWidth = this.inst.isEditor ? this.inst.xWireframeWidth : this.inst.xWireframeWidth/xScale;
            yWireframeWidth = this.inst.isEditor ? this.inst.yWireframeWidth : this.inst.yWireframeWidth/yScale;
            zWireframeWidth = this.inst.isEditor ? this.inst.zWireframeWidth : this.inst.zWireframeWidth/zScale;
        }


        const instanceColor = [instanceC3Color.getR(), instanceC3Color.getG(), instanceC3Color.getB(), instanceC3Color.getA()];
        const finalColor = vec4.create();

        const tmpModelView = mat4.create();
        const modelRotate = mat4.create();
        if (!(this.inst.isEditor || this.inst.cpuXform)) {
            mat4.copy(tmpModelView, renderer._matMV);
            const xAngle = this.inst.xAngle;
            const yAngle = this.inst.yAngle;
            const zAngle = this.inst.zAngle;
            const xScale = this.inst.scale/(this.inst.xScale == 0 ? 1 : this.inst.xScale);
            const yScale = this.inst.scale/(this.inst.yScale == 0 ? 1 : this.inst.yScale);        
            const zScale = this.inst.scale/(this.inst.zScale == 0 ? 1 : this.inst.zScale);
            const rotate = quat.create();
            if (this.inst.cannonBody && this.inst.cannonSetRotation) {
                quat.set(rotate, this.inst.cannonBody.quaternion.x, this.inst.cannonBody.quaternion.y, this.inst.cannonBody.quaternion.z, this.inst.cannonBody.quaternion.w);
            } else {
                quat.fromEuler(rotate, xAngle, yAngle, zAngle);
            }
            mat4.fromRotationTranslationScale(modelRotate, rotate, [x,y,z], [xScale,-yScale,zScale]);
            mat4.copy(this.modelRotate, modelRotate);
            mat4.multiply(modelRotate, tmpModelView, modelRotate);
            renderer.SetModelViewMatrix(modelRotate);
        } else {
            z = 0;
        }

        // Default color
        renderer.SetColor(instanceC3Color);

        // if (this.inst.debug) console.log('draw t:',this._runtime.GetTickCount(), this.verts[this.verts.length-1])

        if (this.updateDrawVerts) {
            this.updateDrawVerts = false;
            this.typedVertsToDrawVerts()
        }

        for (let j=0; j<= this.drawMeshesIndex; j++)
        {
            // Skip render if disabled
            if (this.drawMeshes[j].disabled) continue;

            const drawVerts = this.drawMeshes[j].drawVerts;
            const drawUVs = this.drawMeshes[j].drawUVs;
            const drawIndices = this.drawMeshes[j].drawIndices;
            const material = this.drawMeshes[j].material;
            const hasTexture = (material && 'pbrMetallicRoughness' in material && 'baseColorTexture' in material.pbrMetallicRoughness);
            const offsetUV = this.drawMeshes[j].offsetUV;
            const materialsModify = this.inst.materialsModify;
            const offsetMaterial = materialsModify.has(material?.name) && materialsModify.get(material?.name)?.offsetUV;
            const rotateMaterial = materialsModify.has(material?.name) && materialsModify.get(material?.name)?.rotateUV;

            let color;
            if (material && 'pbrMetallicRoughness' in material && 'baseColorFactor' in material.pbrMetallicRoughness) {
                color = material.pbrMetallicRoughness.baseColorFactor
            } else {
                color = null;
            }
            if (color && color.length == 4) {
                color[3] = 1;
                vec4.multiply(finalColor, instanceColor, color);
                if (vec4.equals(finalColor, currentColor) == false) {
                    vec4.copy(currentColor, finalColor);
                    renderer.SetColorRgba(finalColor[0], finalColor[1], finalColor[2], finalColor[3]);
                }
            }

            if (!instanceTexture) {
                if (!hasTexture) {
                    if (currentTexture != whiteTexture) {
                        renderer.SetTexture(whiteTexture);
                        currentTexture = whiteTexture;
                    }
                } else {
                    const texture = textures[material.name];
                    // If texture is not loaded, skip rendering
                    if (!texture) continue;
                    if (texture != currentTexture) {
                        renderer.SetTexture(texture);
                        currentTexture = texture;
                    }
                }
            }

            let rotateMatrix;

            if (rotateMaterial) {
                const rotateUV = materialsModify.get(material.name)?.rotateUV;
                // Create rotate matrix
                rotateMatrix = mat2.create();
                mat2.fromRotation(rotateMatrix, rotateUV.angle);
            }

            for (let ii=0; ii<drawVerts.length; ii++)
            {
                // Convert typed array to regular array
                // to speed access to data, net win is 10-20%
                // const v = new Array(bufferView.length);
                // for (let a=0; a<bufferView.length; a++) {
                //    v[a] = this.verts[buffStart+a];
                // }
                let v = drawVerts[ii];
                let uv = drawUVs[ii];
                let ind = drawIndices[ii];

                let triangleCount = ind.length/3;
                let center = [0,0,0];
                totalTriangles += triangleCount;
                for(let i = 0; i<triangleCount; i++)
                {
                    if (hasTexture)
                    {
                        if (offsetMaterial || rotateMaterial) {
                            // create new arrays for the UVs
                            const uvQuad = [
                                [uv[ind[i*3+0]*2+0], uv[ind[i*3+0]*2+1]],
                                [uv[ind[i*3+1]*2+0], uv[ind[i*3+1]*2+1]],
                                [uv[ind[i*3+2]*2+0], uv[ind[i*3+2]*2+1]]
                            ];
                            if (rotateMaterial) {
                                // Rotate UVs
                                vec2.sub(uvQuad[0], uvQuad[0], [rotateMaterial.x, rotateMaterial.y]);
                                vec2.sub(uvQuad[1], uvQuad[1], [rotateMaterial.x, rotateMaterial.y]);
                                vec2.sub(uvQuad[2], uvQuad[2], [rotateMaterial.x, rotateMaterial.y]);
                                mat2.multiply(uvQuad[0], rotateMatrix, uvQuad[0]);
                                mat2.multiply(uvQuad[1], rotateMatrix, uvQuad[1]);
                                mat2.multiply(uvQuad[2], rotateMatrix, uvQuad[2]);
                                vec2.add(uvQuad[0], uvQuad[0], [rotateMaterial.x, rotateMaterial.y]);
                                vec2.add(uvQuad[1], uvQuad[1], [rotateMaterial.x, rotateMaterial.y]);
                                vec2.add(uvQuad[2], uvQuad[2], [rotateMaterial.x, rotateMaterial.y]);
                            }

                            if (offsetMaterial) {
                                const uOffset = offsetMaterial.u;
                                const vOffset = offsetMaterial.v;
                                // Offset UVs in uvQuad
                                uvQuad[0][0] += uOffset;
                                uvQuad[0][1] += vOffset;
                                uvQuad[1][0] += uOffset;
                                uvQuad[1][1] += vOffset;
                                uvQuad[2][0] += uOffset;
                                uvQuad[2][1] += vOffset;
                            }
                            // Set tempquad
                            tempQuad.set(
                                uvQuad[0][0], uvQuad[0][1],
                                uvQuad[1][0], uvQuad[1][1],
                                uvQuad[2][0], uvQuad[2][1],
                                uvQuad[2][0], uvQuad[2][1]
                                );                  
                        }   
                        else if (offsetUV) {
                            const uOffset = offsetUV.u;
                            const vOffset = offsetUV.v;
                            tempQuad.set(
                            uv[ind[i*3+0]*2+0]+uOffset, uv[ind[i*3+0]*2+1]+vOffset,
                            uv[ind[i*3+1]*2+0]+uOffset, uv[ind[i*3+1]*2+1]+vOffset,
                            uv[ind[i*3+2]*2+0]+uOffset, uv[ind[i*3+2]*2+1]+vOffset,
                            uv[ind[i*3+2]*2+0]+uOffset, uv[ind[i*3+2]*2+1]+vOffset
                            );
                        } else {
                            tempQuad.set(
                                uv[ind[i*3+0]*2+0], uv[ind[i*3+0]*2+1],
                                uv[ind[i*3+1]*2+0], uv[ind[i*3+1]*2+1],
                                uv[ind[i*3+2]*2+0], uv[ind[i*3+2]*2+1],
                                uv[ind[i*3+2]*2+0], uv[ind[i*3+2]*2+1]
                                );
                        }    
                    } else
                    {
                        // Set face to color if possible
                        tempQuad.set(0,0,1,0,0,1,0,1);
                    }
                    
                    let i3 = i*3;
                    let x0, y0, z0, x1, y1, z1, x2, y2, z2;

                    x0 = (v[ind[i3+0]*3+0]);
                    y0 = (v[ind[i3+0]*3+1]);
                    z0 = (v[ind[i3+0]*3+2])-z;
                    x1 = (v[ind[i3+1]*3+0]);
                    y1 = (v[ind[i3+1]*3+1]);
                    z1 = (v[ind[i3+1]*3+2])-z;
                    x2 = (v[ind[i3+2]*3+0]);
                    y2 = (v[ind[i3+2]*3+1]);
                    z2 = (v[ind[i3+2]*3+2])-z;

                    if (this.inst.wireframe) {
                        this.drawWireFrame(renderer, whiteTexture, tempQuad, x0, y0, z0, x1, y1, z1, x2, y2, z2, xWireframeWidth, yWireframeWidth, zWireframeWidth);
                    } else {
                        renderer.Quad3D2(
                            x0, y0, z0,
                            x1, y1, z1,
                            x2, y2, z2,
                            x2, y2, z2,
                            tempQuad
                            );
                    }
                }
            }
        }
        // Restore modelview matrix
        if (!(this.inst.isEditor || this.inst.cpuXform)) {
            renderer.SetModelViewMatrix(tmpModelView);
        }
    }

    typedVertsToDrawVerts() {
        for (let j=0; j<= this.drawMeshesIndex; j++) {
            const drawVerts = this.drawMeshes[j].drawVerts;
            const bufferViews = this.drawMeshes[j].bufferViews;
            drawVerts.length = 0
            if (!this.activeNodes.includes(j)) {
                drawVerts.push([]);
                continue;
            }
            for (let ii=0; ii<bufferViews.length; ii++)
            {
                const bufferView = bufferViews[ii];
                let buffStart = bufferView.start;
                
                // Convert typed array to regular array
                // to speed access to data, net win is 10-20%
                const v = new Array(bufferView.length);
                for (let a=0; a<bufferView.length; a++) {
                    v[a] = this.verts[buffStart+a];
                }
                drawVerts.push(v);
            }
        }
    }

    /*
        Updates a node's matrix and all it's children nodes.
        After that it transforms unskinned mesh points and sends them to c2.
    */
    transformNode(node)
    {
        const gltf = this.gltfData;
                
        if(node.mesh != undefined && node.skin == undefined)  
        {
            
            for(let i = 0; i < node.mesh.primitives.length; i++)
            {
                this.drawMeshesIndex++;
                this.drawMeshes[this.drawMeshesIndex].disabled = node.disabled;
                if (node.offsetUV) this.drawMeshes[this.drawMeshesIndex].offsetUV = node.offsetUV;
                // Update material each time, in case an ACE changes it
                if ('material' in node.mesh.primitives[i]) {
                    this.drawMeshes[this.drawMeshesIndex].material = node.mesh.primitives[i].material;
                } else {
                    this.drawMeshes[this.drawMeshesIndex].material = null;
                }            }
        }
        if(node.children != undefined)
            for(let i = 0; i < node.children.length; i++)
                this.transformNode(node.children[i]);
    }

    getPolygons() {
        const editorData = this.getPolygonsPrep();
        const data = {editorData}
        this.msgPort.postMessage({type: "getPolygons", data: data});
    }

    getEditorData(isEditor, lightEnable)
    {
        const tick = this._runtime.GetTickCount();
        let editorData = {tick: tick, isEditor: isEditor}        
        if (isEditor) {
            const xAngle = this.inst.xAngle;
            const yAngle = this.inst.yAngle;
            const zAngle = this.inst.zAngle;

            const x = this.inst._inst.GetX();
            const y = this.inst._inst.GetY();
            const z = this.inst.zElevation;

            const xScale = this.inst.scale/(this.inst.xScale == 0 ? 1 : this.inst.xScale);
            const yScale = this.inst.scale/(this.inst.yScale == 0 ? 1 : this.inst.yScale);        
            const zScale = this.inst.scale/(this.inst.zScale == 0 ? 1 : this.inst.zScale);    

            // Send to worker with postMessage in case in editor
            editorData = {
                xScale,
                yScale,
                zScale,
                xAngle,
                yAngle,
                zAngle,
                x,
                y,
                z,
                tick,
                isEditor,
            }
        }

        if (lightEnable) {
            const wi = this.inst.GetWorldInfo()

            const xAngle = this.inst.xAngle;
            const yAngle = this.inst.yAngle;
            const zAngle = this.inst.zAngle;

            const x = wi.GetX();
            const y = wi.GetY();
            const z = this.inst.zElevation;

            const xScale = this.inst.scale/(this.inst.xScale == 0 ? 1 : this.inst.xScale);
            const yScale = this.inst.scale/(this.inst.yScale == 0 ? 1 : this.inst.yScale);        
            const zScale = this.inst.scale/(this.inst.zScale == 0 ? 1 : this.inst.zScale);
    
            // Send to worker with postMessage in case in editor
            editorData = {
                xScale,
                yScale,
                zScale,
                xAngle,
                yAngle,
                zAngle,
                x,
                y,
                z,
                tick,
                isEditor,
            }
        }
        return editorData
    }

    //	Updates scene graph, and as a second step sends transformed skinned mesh points to c2.
    getPolygonsPrep()
    {
        const gltf = this.gltfData;

        this.drawMeshesIndex = -1;

        const editorData = this.getEditorData(this.inst.isEditor, this.inst.lightEnable)

        // update all scene matrixes.
        // only update drawMesh meta data, vertex data will be updated in the worker
        for(let i = 0; i < gltf.scene.nodes.length; i++)
        {
            this.transformNode(gltf.scene.nodes[i]);
        }
        
        for(let ii = 0; ii < gltf.skinnedNodes.length; ii++)
        {
            let node = gltf.skinnedNodes[ii];
            for(let i = 0; i < node.mesh.primitives.length; i++)
            {
                this.drawMeshesIndex++;
                this.drawMeshes[this.drawMeshesIndex].disabled = node.disabled;
                if (node.offsetUV) this.drawMeshes[this.drawMeshesIndex].offsetUV = node.offsetUV;
                // Update material each time, in case an ACE changes it
                if ('material' in node.mesh.primitives[i]) {
                    this.drawMeshes[this.drawMeshesIndex].material = node.mesh.primitives[i].material;
                } else {
                    this.drawMeshes[this.drawMeshesIndex].material = null;
                }

            }
        }
        return editorData;
    }

    // sends a list of animation names to c2.
    getAnimationNames()
    {
        const gltf = this.gltfData;
        let names = [];
        if (!gltf.animations) return names;
        
        for(let i = 0; i <gltf.animations.length; i++)
            names.push(gltf.animations[i].name);

        return names;
    }

    drawWireFrame(renderer, whiteTexture, tempQuad, x0,y0,z0,x1,y1,z1, x2, y2,z2, xWidth, yWidth, zWidth ){
        renderer.SetTexture(whiteTexture);
        tempQuad.set(0,0,1,0,0,1,0,1);

        renderer.Quad3D2(
            x0, y0, z0,
            x0+xWidth, y0+yWidth, z0+zWidth,
            x1, y1, z1,
            x1+xWidth, y1+yWidth, z1+zWidth,
            tempQuad
        );
        renderer.Quad3D2(
            x1, y1, z1,
            x1+xWidth, y1+yWidth, z1+zWidth,
            x2, y2, z2,
            x2+xWidth, y2+yWidth, z2+zWidth,
            tempQuad
        );
        renderer.Quad3D2(
            x2, y2, z2,
            x2+xWidth, y2+yWidth, z2+zWidth,
            x0, y0, z0,
            x0+xWidth, y0+yWidth, z0+zWidth,
            tempQuad
        );   
    }

    getLightData() {
        const lightData = {
            lightPos : this.inst.lightDir,
            lightEnable: this.inst.lightEnable,
            lightUpdate: this.inst.lightUpdate,
            lightColoir: this.inst.lightColor,
            spotEnable: this.inst.spotEnable,
            spotDir: this.inst.spotDir,
            spotCutoff: this.inst.spotCutoff,
            spotEdge: this.inst.spotEdge
        }
        return lightData
    }

    updateAnimationPolygons(index, time, onScreen, deltaTime) {
        this.updateAnimation(index, time, onScreen, deltaTime);
        const animationBlend = this.inst.animationBlend;
        const animationLoop = this.inst.animationLoop;
        let lightData 
        let animationData = { index, time, onScreen, deltaTime, animationBlend, animationLoop };
        let editorData = {}
        if (onScreen)
        {
            editorData = this.getPolygonsPrep();
            lightData = this.getLightData()
            this.inst.runtime.UpdateRender();
            this.inst.updateBbox = true
        }
        const data = {animationData, editorData, lightData};
        this.msgPort.postMessage({type: "updateAnimationPolygons", data: data});
        // if (this.inst.debug) console.log('postMsg t:',this.inst.runtime.GetTickCount())
    }

    updateModelRotate(x,y,z)
    {
        // @ts-ignore
        const vec3 = globalThis.glMatrix3D.vec3;
        // @ts-ignore
        const mat4 = globalThis.glMatrix3D.mat4;
        // @ts-ignore
        const quat = globalThis.glMatrix3D.quat;
        
        const xAngle = this.inst.xAngle;
        const yAngle = this.inst.yAngle;
        const zAngle = this.inst.zAngle;
        const xScale = this.inst.scale/(this.inst.xScale == 0 ? 1 : this.inst.xScale);
        const yScale = this.inst.scale/(this.inst.yScale == 0 ? 1 : this.inst.yScale);        
        const zScale = this.inst.scale/(this.inst.zScale == 0 ? 1 : this.inst.zScale);
        const rotate = quat.create();
        if (this.inst.cannonBody && this.inst.cannonSetRotation) {
            quat.set(rotate, this.inst.cannonBody.quaternion.x, this.inst.cannonBody.quaternion.y, this.inst.cannonBody.quaternion.z, this.inst.cannonBody.quaternion.w);
        } else {
            quat.fromEuler(rotate, xAngle, yAngle, zAngle);
        }
        mat4.fromRotationTranslationScale(this.modelRotate, rotate, [x,y,z], [xScale,-yScale,zScale]);
    }

    // Updates animation at index to be at time.  Is used to play animation.  
    updateAnimation(index, time, onScreen, deltaTime)
    {
        const gltf = this.gltfData;        
        let anim = gltf.animations[index];
        for(let i = 0; i < anim.channels.length; i++)
        {
            let c = anim.channels[i];
            let timeValues = c.sampler.input;
            
            if (this.inst.animationLoop)
            {
                time = (time-timeValues.min[0])%(timeValues.max[0]-timeValues.min[0]) + timeValues.min[0]; // loop
            } else
            {
                if (time > timeValues.max[0])
                {
                    time = timeValues.max[0]-0.01; // Stop on max time
                    if (!this.inst.animationFinished)
                    {
                        this.inst.animationFinished = true;
                        this.inst.animationNameFinished = this.inst.animationName;
                        // @ts-ignore
                        this.inst.Trigger(self.C3.Plugins.Mikal_3DObject.Cnds.OnAnimationFinished);
                        // @ts-ignore
                        this.inst.Trigger(self.C3.Plugins.Mikal_3DObject.Cnds.OnAnimationNameFinished);

                    }
                }
            }            
            this.inst.currentAnimationTime = time;
        }
    }
}

// @ts-ignore
globalThis.GltfModelW = GltfModelW;