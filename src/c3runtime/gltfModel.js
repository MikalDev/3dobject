// @ts-check
'use strict';

class GltfModel
{

    constructor(runtime, sdkType, inst)
	{
		this._runtime = runtime;
        this._sdkType = sdkType;
		// Deep copy
		// For instance version, may only need points, others remain stable, full copy for now
		this.gltf = JSON.parse(JSON.stringify(sdkType.gltfData.gltf));
		this.inst = inst;
        this.gltfData = sdkType.gltfData.gltf;
	}

    /*
        Updates a node's matrix and all it's children nodes.
        After that it transforms unskinned mesh points and sends them to c2.
    */
    transformNode(node, parentMat)
    {
        const mat4 = globalThis.glMatrix3D.mat4;       
        const quat = globalThis.glMatrix3D.quat;
        const vec3 = globalThis.glMatrix3D.vec3;
        const gltf = this.gltfData;
        let dummyMat4Out = mat4.create();


        if(parentMat != undefined)
            mat4.copy(node.matrix, parentMat);
            // mat4.set(parentMat, node.matrix);
        else
            mat4.identity(node.matrix);
        mat4.translate(node.matrix, node.matrix, node.translation);
        // mat4.translate(node.matrix, node.translation);
        mat4.multiply(node.matrix, node.matrix, mat4.fromQuat(dummyMat4Out, node.rotation));
        // mat4.multiply(node.matrix, quat4.toMat4(node.rotation));
        mat4.scale(node.matrix, node.matrix, node.scale);
        // mat4.scale(node.matrix, node.scale);
        
        if(node.skin != undefined)
            mat4.invert(node.invMatrix, node.matrix);
            // mat4.inverse(node.matrix, node.invMatrix);
        
        // unskinned meshes
        if(node.mesh != undefined && node.skin == undefined)  
        {
            let transformedVerts = [];
            
            for(let i in node.mesh.primitives)
            {
                transformedVerts.length = 0;
                let posData = node.mesh.primitives[i].attributes.POSITION.data;
                
                let v = [0,0,0];			
                for(let j=0; j<posData.length/3; j++)
                {
                    vec3.transformMat4(v, node.matrix, posData.subarray(j*3, j*3+3));
                    // mat4.multiplyVec3(node.matrix, posData.subarray(j*3, j*3+3), v);
                    transformedVerts.push(v[0],v[1],v[2]);
                }
                
                if(transformedVerts.length > 0)
                {
                    if(gltf.pointBatch != undefined)
                        for(let ii in transformedVerts)
                            gltf.pointBatch.push(transformedVerts[ii]);
                    else
                    {
                        console.log('us points', transformedVerts);
                        console.log('us texcoords', node.mesh.primitives[i].attributes.TEXCOORD_0.data);

                        // Push triangle data to draw
                        this.inst.drawVerts = this.inst.drawVerts.concat(transformedVerts);
                        this.inst.drawUVs = this.inst.drawUVs.concat(Array.from(node.mesh.primitives[i].attributes.TEXCOORD_0.data));
                        this.inst.drawIndices = this.inst.drawIndices.concat(node.mesh.primitives[i].indices.data);
                    }
                }
            }
        }
        
        if(node.children != undefined)
            for(let i in node.children)
                this.transformNode(node.children[i], node.matrix);
    }

    //	Updates scene graph, and as a second step sends transformed skinned mesh points to c2.
    getPolygons()
    {
        const vec3 = globalThis.glMatrix3D.vec3;
        const mat4 = globalThis.glMatrix3D.mat4;
        const gltf = this.gltfData;

        // update all scene matrixes.
        for(let i in gltf.scene.nodes)
        {
            this.transformNode(gltf.scene.nodes[i]);
        }
        
        //todo loop over skinned nodes.
        //todo: limit to ones in scene?
        for(let ii in gltf.skinnedNodes)
        {
            let node = gltf.skinnedNodes[ii];
            
            //update bone matrixes
            for(let jj in node.skin.joints)
            {
                let joint = node.skin.joints[jj];
                
                mat4.multiply(joint.boneMatrix, node.invMatrix, joint.matrix);
                // mat4.multiply(node.invMatrix, joint.matrix, joint.boneMatrix);
                mat4.multiply(joint.boneMatrix, joint.boneMatrix, joint.invBindMatrix);
                // mat4.multiply(joint.boneMatrix, joint.invBindMatrix);
            }
            
            let transformedVerts = [];
            
            for(let i in node.mesh.primitives)
            {
                transformedVerts.length=0;
                
                let posData = node.mesh.primitives[i].attributes.POSITION.data;
                let weights = node.mesh.primitives[i].attributes.WEIGHTS_0.data;
                let joints = node.mesh.primitives[i].attributes.JOINTS_0.data;
                
                console.log('i:', i, posData);

                for(let j=0; j<posData.length/3; j++)
                {
                    let w = weights.subarray(j*4, j*4+4);
                    let b = joints.subarray(j*4, j*4+4);
                    let vin = posData.subarray(j*3, j*3+3)
                    let v = [0,0,0], vsum = [0,0,0];
                    
                    for(let i=0; i<4; i++)
                    {
                        vec3.transformMat4(v, vin, node.skin.joints[b[i]].boneMatrix);
                        // mat4.multiplyVec3(node.skin.joints[b[i]].boneMatrix, vin, v);
                        vec3.scale(v, v, w[i]);
                        // vec3.scale(v, w[i]);
                        vec3.add(vsum, vsum, v);
                        // vec3.add(vsum, v);
                    }
                    
                    transformedVerts.push(vsum[0],vsum[1],vsum[2]);
                }
                
                if(transformedVerts.length > 0)
                {
                    if(gltf.pointBatch != undefined)
                        for(let ii in transformedVerts)
                            gltf.pointBatch.push(transformedVerts[ii]);
                    else
                    {
                        // console.log('points', transformedVerts);
                        // console.log('texcoords', node.mesh.primitives[i].attributes.TEXCOORD_0.data);

                        // Push triangle data to draw
                        // this.inst.drawVerts = this.inst.drawVerts.concat(transformedVerts);
                        // this.inst.drawUVs = this.inst.drawUVs.concat(Array.from(node.mesh.primitives[i].attributes.TEXCOORD_0.data));
                        // this.inst.drawIndices = this.inst.drawIndices.concat(Array.from(node.mesh.primitives[i].indices.data));
                        this.inst.drawVerts.push(transformedVerts);
                        this.inst.drawUVs.push(Array.from(node.mesh.primitives[i].attributes.TEXCOORD_0.data));
                        this.inst.drawIndices.push(Array.from(node.mesh.primitives[i].indices.data));
                    }
                }
            }
        }
    }

    // sends a list of animation names to c2.
    getAnimationNames()
    {
        const gltf = this.gltfData;
        let names = [];
        
        for(let i in gltf.animations)
            names.push(gltf.animations[i].name);

        return names;
    }

    // Updates animation at index to be at time.  Is used to play animation.  
    updateAnimation(index, time)
    {
        const vec3 = globalThis.glMatrix3D.vec3;
        const quat = globalThis.glMatrix3D.quat;
        const gltf = this.gltfData;
        
        let anim = gltf.animations[index];
        
        for(let i in anim.channels)
        {
            let c = anim.channels[i];
            let timeValues = c.sampler.input;
            let otherValues = c.sampler.output.data;
            let target = c.target;
            
            time = (time-timeValues.min[0])%(timeValues.max[0]-timeValues.min[0]) + timeValues.min[0]; // loop
            //time = Math.min(Math.max(time, timeValues.min[0]), timeValues.max[0]);  //clamp
            timeValues = timeValues.data;
            
            //find index in timeline
            let t0, t1;
            for(t0=0, t1=1; t0<timeValues.length-1; t0++, t1++)  
                if(time >= timeValues[t0] && time <= timeValues[t1])
                    break;
            let t = (time - timeValues[t0])/(timeValues[t1] - timeValues[t0]);
            
            if(target.path == "translation")
                vec3.lerp(target.node.translation, otherValues.subarray(t0*3,t0*3+3), otherValues.subarray(t1*3,t1*3+3), t);
                // vec3.lerp(otherValues.subarray(t0*3,t0*3+3), otherValues.subarray(t1*3,t1*3+3), t, target.node.translation);
            else if(target.path == "rotation")
                quat.slerp(target.node.rotation, otherValues.subarray(t0*4,t0*4+4), otherValues.subarray(t1*4,t1*4+4), t);
                // quat4.slerp(otherValues.subarray(t0*4,t0*4+4), otherValues.subarray(t1*4,t1*4+4), t, target.node.rotation);
            else if(target.path == "scale")
                vec3.lerp(target.node.scale, otherValues.subarray(t0*3,t0*3+3), otherValues.subarray(t1*3,t1*3+3), t);
                // vec3.lerp(otherValues.subarray(t0*3,t0*3+3), otherValues.subarray(t1*3,t1*3+3), t, target.node.scale);
        }
    }
}

// @ts-ignore
globalThis.GltfModel = GltfModel;