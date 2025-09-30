"use strict";
{
    self.C3.Plugins.Mikal_3DObject.Exps = {
            AnimationNames() {
                return JSON.stringify(this.gltf.getAnimationNames());
            },
            ZElevation0() {
                return this.GetWorldInfo().GetZElevation();
            },
            CurrentAnimation() {
                return this.animationName;
            },
            CurrentAnimationTime() {
                return this.currentAnimationTime;
            },
            CurrentAnimationFrame() {
                return this.currentAnimationFrame;
            },
            Scale() {
                return this.scale;
            },
            XScale() {
                return this.xScale;
            },
            YScale() {
                return this.yScale;
            },
            ZScale() {
                return this.zScale;
            },
            XAngle() {
                return this.xAngle;
            },
            YAngle() {
                return this.yAngle;
            },
            ZAngle() {
                return this.zAngle;
            },
            XBBMin() {
                if (!this.xMinBB) return 0;
                return this.xMinBB[0];
            },
            YBBMin() {
                if (!this.xMinBB) return 0;
                return this.xMinBB[1];
            },
            ZBBMin() {
                if (!this.xMinBB) return 0;
                return this.xMinBB[2];
            },                        
            XBBMax() {
                if (!this.xMaxBB) return 0;
                return this.xMaxBB[0];
            },
            YBBMax() {
                if (!this.xMaxBB) return 0;
                return this.xMaxBB[1];
            },
            ZBBMax() {
                if (!this.xMaxBB) return 0;
                return this.xMaxBB[2];
            },               
            XWireframeWidth() {
                return this.xWireframeWidth;
            },               
            YWireframeWidth() {
                return this.yWireframeWidth;
            },               
            ZWireframeWidth() {
                return this.zWireframeWidth;
            },
            UOffset(nodeName) {
                if (!this.gltf) return 0;
                if (!this.gltf.gltfData) return 0;

                const node = this._findNode(nodeName);
                if (!node) return 0;
                if ('offsetUV' in node) return node?.offsetUV?.u;
                return 0;
            },
            VOffset(nodeName) {
                if (!this.gltf) return 0;
                if (!this.gltf.gltfData) return 0;

                const node = this._findNode(nodeName);
                if (!node) return 0;
                if ('offsetUV' in node) return node?.offsetUV?.v;
                return 0;
            },
            MaterialUOffset(materialName) {
                if (!this.gltf) return 0;
                if (!this.gltf.gltfData) return 0;

                const material = this.materialsModify.get(materialName)
                if (!material) return 0
                const offset = material.offsetUV
                if (!offset) return 0
                return offset.u
            },
            MaterialVOffset(materialName) {
                if (!this.gltf) return 0;
                if (!this.gltf.gltfData) return 0;

                const material = this.materialsModify.get(materialName)
                if (!material) return 0
                const offset = material.offsetUV
                if (!offset) return 0
                return offset.v
            },
            MaterialRotateAngle(materialName) {
                if (!this.gltf) return 0;
                if (!this.gltf.gltfData) return 0;

                const material = this.materialsModify.get(materialName)
                if (!material) return 0
                const rotateUV = material.rotateUV
                if (!rotateUV) return 0
                return rotateUV.angle * 180 / Math.PI
            },
            MaterialRotateX(materialName) {
                if (!this.gltf) return 0;
                if (!this.gltf.gltfData) return 0;

                const material = this.materialsModify.get(materialName)
                if (!material) return 0
                const rotateUV = material.rotateUV
                if (!rotateUV) return 0
                return rotateUV.x
            },
            MaterialRotateY(materialName) {
                if (!this.gltf) return 0;
                if (!this.gltf.gltfData) return 0;

                const material = this.materialsModify.get(materialName)
                if (!material) return 0
                const rotateUV = material.rotateUV
                if (!rotateUV) return 0
                return rotateUV.y
            },
            Materials() {
                let textures = this.instanceModel ? this.texture : this.sdkType.texture
                let materials = [];
                for (let textureName in textures) {
                    materials.push({name: textureName, path: textures[textureName].materialPath || textureName});
                }
                return JSON.stringify(materials);
            },
            NodePointPosition(nodeName, pointIndex) {
                const vec3 = globalThis.glMatrix3D.vec3
                let rotatedPoint = [0,0,0]
                if (!this.gltf) return JSON.stringify(rotatedPoint);
                if (!this.gltf.gltfData) return  JSON.stringify(rotatedPoint);
                if (!this.gltf.meshNames.has(nodeName)) return  JSON.stringify(rotatedPoint);
                if (!this.gltf.modelRotate) return JSON.stringify(rotatedPoint);
                const drawVerts = this.gltf.drawMeshes[this.gltf.meshNames.get(nodeName)].drawVerts[0]
                if (!drawVerts) return JSON.stringify(rotatedPoint);
                const point = vec3.fromValues(drawVerts[pointIndex*3], drawVerts[pointIndex*3+1], drawVerts[pointIndex*3+2])
                vec3.transformMat4(rotatedPoint, point, this.gltf.modelRotate)
                return `{"x": ${rotatedPoint[0]}, "y": ${rotatedPoint[1]}, "z": ${rotatedPoint[2]}}`
            },
            NodeVertexLength(nodeName) {
                if (!this.gltf) return 0;
                if (!this.gltf.gltfData) return 0;
                if (!this.gltf.meshNames.has(nodeName)) return 0;
                const drawVerts = this.gltf?.drawMeshes?.[this.gltf.meshNames.get(nodeName)]?.drawVerts?.[0]
                if (!drawVerts) return 0
                // x,y,z per vertex
                return drawVerts.length/3;
            },
            NodeWorldPosition(nodeName) {
                let worldPos = [0, 0, 0];
                if (this.gltf) {
                    const pos = this.gltf.getNodeWorldPosition(nodeName);
                    if (pos) {
                        worldPos = pos;
                    }
                }
                // Return as JSON string for consistency with NodePointPosition
                return `{"x": ${worldPos[0]}, "y": ${worldPos[1]}, "z": ${worldPos[2]}}`;
            },
            AnimationBlendTime() {
                return this.animationBlend;
            },
            LightColor(name) {
                if (!this.gltf) return 0
                if (!this.gltf.gltfData) return 0
                if (!(name in this.lights)) return 0
                const c = this.lights[name].color
                const packRGBA = this.packRGBAEx(c[0],c[1],c[2],c[3])
                return packRGBA
            },
            LightsData() {
                return JSON.stringify(this.lights)
            },
            AnimationSpeed(speed) {
                return this.animationSpeed
            },
            TotalTriangles() {
                return this.totalTriangles
            },             
            TotalTrianglesCulled() {
                return this.totalTrianglesCulled
            },
            NodeBoundingBox(nodeName) {
                if (!this.gltf) return JSON.stringify([0,0,0,0,0,0]);
                if (!this.gltf.gltfData) return JSON.stringify([0,0,0,0,0,0]);
                const meshIndex = this.gltf.meshNames.get(nodeName)
                if (!this.gltf.drawMeshes[meshIndex]) return JSON.stringify([0,0,0,0,0,0]);
                const drawVerts = this.gltf.drawMeshes[meshIndex].drawVerts
                const vec3 = globalThis.glMatrix3D.vec3
                const boundingBoxMin = vec3.fromValues(Infinity, Infinity, Infinity)
                const boundingBoxMax = vec3.fromValues(-Infinity, -Infinity, -Infinity)
                // calculate bounding box of all drawVerts in mesh and return it
                for (let i = 0; i < drawVerts.length; i++) {
                    const drawVert = drawVerts[i]
                    for (let j = 0; j < drawVert.length; j+=3) {
                        const point = vec3.fromValues(drawVert[j], drawVert[j+1], drawVert[j+2])
                        vec3.max(boundingBoxMax, boundingBoxMax, point)
                        vec3.min(boundingBoxMin, boundingBoxMin, point)
                    }
                }
                vec3.transformMat4(boundingBoxMax, boundingBoxMax, this.gltf.modelRotate);
                vec3.transformMat4(boundingBoxMin, boundingBoxMin, this.gltf.modelRotate);
                return JSON.stringify([boundingBoxMax[0], boundingBoxMax[1], boundingBoxMax[2], boundingBoxMin[0], boundingBoxMin[1], boundingBoxMin[2]])
            },
            GltfPath() {
                return this.gltfPath;
            }
        };
}