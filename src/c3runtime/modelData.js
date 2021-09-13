'use strict';

class ModelData
{
	constructor(runtime, sdkType, isRuntime)
	{
		this.data = {	obj: {points: [], faces: [], uvs: [], normals: [], scale:1, center: [0,0,0]},
						mtls: {}
					};
		this._runtime = runtime;
		this._sdkType = sdkType;
	}

	async load(objPath, mtlPath, scale, isRuntime)
	{
		let runtime = this._runtime;
		let sdkType = this._sdkType;
		let objURI, mtlURI;
		if (isRuntime)
		{
			objURI = await runtime.GetAssetManager().GetProjectFileUrl(objPath);
			mtlURI = await runtime.GetAssetManager().GetProjectFileUrl(mtlPath);
		} else
		{
			// Get iProjectFiles
			objURI = await runtime.GetProjectFileByName(objPath);
			mtlURI = await runtime.GetProjectFileByName(mtlPath);
		}
		let resultMtl = await this.loadMtl(mtlURI, isRuntime);
		let resultObj = await this.loadObj(objURI, isRuntime);
		if (resultMtl && resultObj)
		{
			console.info('[3DShape] modelData:', this.data);
			sdkType.loaded = true;
		} else
		{
			console.warn('[3DShape] Unable load to obj/mtl files');
		}
	}

	async loadObj(uri, isRuntime)
	{
		if (!uri) return false;
		let minPoints = {x:0, y:0, z:0};
		let maxPoints = {x:0, y:0, z:0};

		let fileData;
		if (isRuntime)
		{
			try
			{
				let response = await fetch(uri);
				fileData = await response.text();
			} catch(err)
			{
				console.error('[3DShape], cannot fetch obj', uri);
				return false;
			}
		} else
		{
			let projectFile = await uri.GetBlob();
			if (!projectFile) return false;
			fileData = await projectFile.text();
			if (!fileData) return false;
		}

		// Parse obj file
		const lines = fileData.split("\n");

		let data = this.data.obj;
					
		let i=0;
		let materialCurrent = "";
		let numFaces = 0;
		
		// Parse all lines
		while(i < lines.length) {
			// do stuff
			let line = lines[i].trim();
			line = line.replace(/\s{2,}/g,' ');
			const words = line.split(" ");
			switch (words[0])
			{
				case "usemtl":
					materialCurrent = words[1].trim();
					break;
				case "v":
					let x = parseFloat(words[1]);
					let y = parseFloat(words[2]);
					let z = parseFloat(words[3]);
					data.points.push([x, y, z]);
					minPoints.x = x < minPoints.x ? x : minPoints.x;
					minPoints.y = y < minPoints.y ? y : minPoints.y;
					minPoints.z = z < minPoints.z ? z : minPoints.z;
					maxPoints.x = x > maxPoints.x ? x : maxPoints.x;
					maxPoints.y = y > maxPoints.y ? y : maxPoints.y;
					maxPoints.z = z > maxPoints.z ? z : maxPoints.z;
					break;
				case "n":
					data.normals.push([parseFloat(words[1]), parseFloat(words[2]), parseFloat(words[3])]);
					break;
				case "vt":
					data.uvs.push([parseFloat(words[1]), parseFloat(words[2])]);
					break;
				case "f":
					numFaces++;
					let face = {};
					let elm = [];
					for (let i=0;i<words.length-1;i++)
					{
						let values = words[i+1].split("/");
						if (words.length == 1)
						{
							elm.push({v: parseInt(values[0])-1});				
						} else
						{
							elm.push({v: parseInt(values[0])-1, uv: parseInt(values[1])-1, n:parseInt(values[2])-1});								
						}
					}
					if (elm.length == 3)
					{
						if (elm[2].uv === undefined)
						{
							elm.push({v: elm[2].v});
						} else
						{
							elm.push({v: elm[2].v, uv: elm[2].uv, n:elm[2].n});
						}
					}
					face.p = elm;
					face.mtl = materialCurrent;
					data.faces.push(face);
				default:
			}
			i++;
		}
		// Create local center based on obj x,y,z ranges
		this.data.obj.center[0] = (minPoints.x+maxPoints.x)/2;
		this.data.obj.center[1] = (minPoints.y+maxPoints.y)/2;
		this.data.obj.center[2] = (minPoints.z+maxPoints.z)/2;
		return numFaces;
	}

	async loadMtl(uri, isRuntime)
	{
		if (!uri) return false;

		let fileData;
		if (isRuntime)
		{
			try
			{
				let response = await fetch(uri);
				fileData = await response.text();
			} catch(err)
			{
				console.error('[3DShape], cannot fetch obj', uri);
				return false;
			}
		} else
		{
			let projectFile = await uri.GetBlob();
			if (!projectFile) return false;
			fileData = await projectFile.text();
			if (!fileData) return false;
		}

		let data = this.data.mtls;

		// Parse mtl file
		const lines = fileData.split("\n");

		let materialCurrent = "";
		let i=0;
		// Parse all lines
		while(i < lines.length) {
			// parse, remove whitespace
			let line = lines[i].trim();
			line = line.replace(/\s{2,}/g,' ');
			const words = line.split(" ");
			switch (words[0])
			{
				case "newmtl":
					let materialName = words[1].trim();
					data[materialName] = {};
					materialCurrent = materialName;
					// XXX Only textured files work currently
					// Change to false if non-textured files accepted
					// e.g. Kd color
					data[materialName].textured = true;
					break;
				case "Kd":
					data[materialCurrent].r = parseFloat(words[1]);
					data[materialCurrent].g = parseFloat(words[2]);
					data[materialCurrent].b = parseFloat(words[3]);
					break;
				case "map_Kd":
					let p = words[1].split("/");
					let map = p[p.length-1].trim();
					data[materialCurrent].map = map;
					// load texture into current available frame
					data[materialCurrent].textured = true;
					break;
				default:
			}
			i++;
		}
		return true;
	}
}

globalThis.ModelData3D = ModelData