// @ts-check
'use strict';

class GltfData
{

    constructor(runtime, sdkType)
	{
		this._runtime = runtime;
        this._sdkType = sdkType;
        this.gltf = {};
	}

    /*
	Requests an url as a json file, then does some processing on that, and finally calls a js or c2 function.
	Expects an "embeded" gltf file.
    */
    async load(gltfPath, isRuntime, debug)
    {
        let runtime = this._runtime;
		let sdkType = this._sdkType;

		let gltfURI;
		if (isRuntime)
		{
			gltfURI = await runtime.GetAssetManager().GetProjectFileUrl(gltfPath);
		} else
		{
			// Get iProjectFiles
			gltfURI = await runtime.GetProjectFileByName(gltfPath);
		}

		let resultgltf = await this.loadGLTF(gltfURI, isRuntime, debug);
		
        if (resultgltf)
		{
			if (debug) console.info('[3DShape] modelData:', resultgltf);
			sdkType.loaded = true;
		} else
		{
			console.warn('[3DShape] Unable load to gltf files');
		}

        this.gltf = resultgltf;
        sdkType.loaded = true;
    }

/*
	Once the gltf file is loaded as a json this does a few things to it to make out lives easier.
	1. It converts the buffers from base64 to a typed array.
	2. The accessors are then made as typed views of the buffers.
	3. All the places where indexes are used are changed to look at those objects themselves.
	4. Adds some properties that are optionally in the gltf file.
	5. Adds a few properties that are utilized when getting data from skinning.
*/
    async loadGLTF(uri, isRuntime, debug)
    {
        let gltf;

		if (isRuntime)
		{
			try
			{
				let response = await fetch(uri);
                let text = await response.text();
				gltf = JSON.parse(text);
			} catch(err)
			{
				console.error('[3DShape], cannot fetch/parse gltf', uri);
				return false;
			}
		} else
		{
            try
            {
                let projectFile = await uri.GetBlob();
                if (!projectFile) return false;
                let text = await projectFile.text();
                if (!text) return false;
                gltf = JSON.parse(text);
                if (debug) console.log('gltf buffers:', gltf.buffers);
            } catch(err)
            {
                console.error('[3DShape], cannot fetch/parse gltf blob', uri);
				return false;
            }
		}
        if (!gltf) return false;

        if (debug) console.log('gltf:', gltf)

        //extra variable for a list of skinned meshes.  They need to be transformed after the rest.
        gltf.skinnedNodes = [];
        
        // buffers
        for(let i = 0; i < gltf.buffers.length; i++)  // convert to typed arrays.
        {
            let base64 = gltf.buffers[i].uri.slice(37)
            // @ts-ignore
            gltf.buffers[i] = Uint8Array.from(atob(base64), c=>c.charCodeAt(0)).buffer;
        }
        
        // accessors
        for(let i =0; i < gltf.accessors.length;i++)
        {
            let a = gltf.accessors[i];
            let buftype = null;
            switch(a.componentType)
            {
                case 5120: buftype=Int8Array; break;
                case 5121: buftype=Uint8Array; break;
                case 5122: buftype=Int16Array; break;
                case 5123: buftype=Uint16Array; break;
                case 5125: buftype=Uint32Array; break;
                case 5126: buftype=Float32Array; break;
                default: console.log("error: gltf, unhandled componentType");
            }
            let compcount = {"SCALAR":1, "VEC2":2, "VEC3":3, "VEC4":4, "MAT2":4, "MAT3":9, "MAT4":16}[a.type];
            let bufview = gltf.bufferViews[a.bufferView];
            a.data = new buftype(gltf.buffers[bufview.buffer], bufview.byteOffset, compcount*a.count);
        }
        
        // scene
        gltf.scene = gltf.scenes[gltf.scene];
        
        // scenes
        for(let i =0; i<gltf.scenes.length; i++)
        {
            let s = gltf.scenes[i];
            for(let j = 0; j < s.nodes.length; j++)
                s.nodes[j] = gltf.nodes[s.nodes[j]];
        }
        
        // nodes
        for(let i = 0; i < gltf.nodes.length; i++)
        {
            let n = gltf.nodes[i];
            
            if(n.translation == undefined)
                n.translation = [0,0,0];
            if(n.scale == undefined)
                n.scale = [1,1,1];
            if(n.rotation == undefined)
                n.rotation = [0,0,0,1];
            if(n.matrix == undefined)
                n.matrix = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
            
            if(n.mesh != undefined)
                n.mesh = gltf.meshes[n.mesh];
            if(n.skin != undefined)
            {
                n.skin = gltf.skins[n.skin];
                n.invMatrix = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
                gltf.skinnedNodes.push(n);
            }
            if(n.children != undefined)
                for(let j = 0; j < n.children.length; j++)
                    n.children[j] = gltf.nodes[n.children[j]];
        }
	
        // animations
        if (gltf.animations)
        {
            for(let i = 0; i < gltf.animations.length; i++)
            {
                let a = gltf.animations[i];
                
                for(let j = 0; j < a.channels.length; j++)
                {
                    let c = a.channels[j];
                    c.sampler = a.samplers[c.sampler];
                    c.target.node = gltf.nodes[c.target.node];
                }
                
                for(let j = 0; j < a.samplers.length; j++)
                {
                    let s = a.samplers[j];
                    s.input = gltf.accessors[s.input];
                    s.output = gltf.accessors[s.output];
                }
            }
        }

        //meshes
        for(let i = 0; i < gltf.meshes.length; i++)
        {
            let m = gltf.meshes[i];
            for(let j = 0; j < m.primitives.length; j++)
            {
                let p = m.primitives[j];
                
                p.indices = gltf.accessors[p.indices];
                p.material = gltf.materials[p.material];
                
                Object.keys(p.attributes).forEach(function(key){
                    p.attributes[key] = gltf.accessors[p.attributes[key]];
                });
            }
        }
        
        //skins
        if (gltf.skins)
        {
            for(let i = 0; i < gltf.skins.length; i++)
            {
                let s = gltf.skins[i];
                s.inverseBindMatrices = gltf.accessors[s.inverseBindMatrices];
                // for(let j in s.joints)
                for(let j=0;j<s.joints.length;j++)
                {
                    s.joints[j] = gltf.nodes[s.joints[j]];
                    s.joints[j].invBindMatrix = s.inverseBindMatrices.data.subarray(j*16, j*16+16);
                    s.joints[j].boneMatrix = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
                }
            }
        }

        return gltf
    }
}

// @ts-ignore
globalThis.GltfData = GltfData;