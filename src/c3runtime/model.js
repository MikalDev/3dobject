'use strict';

class Model
{
	constructor(runtime, sdkType, inst)
	{
		this._runtime = runtime;
		// Deep copy
		// For instance version, may only need points, others remain stable, full copy for now
		this.data = JSON.parse(JSON.stringify(sdkType.modelData.data));
		this.inst = inst;
	}

	rotate(angle, axis)
	{
		let obj = this.data.obj;
		let ps = obj.points;
		let center = this.inst.localCenter;
		const g = globalThis.glMatrix3D;
		let angleRad = g.glMatrix.toRadian(angle);
		let origin = g.vec3.fromValues(center[0],center[1],center[2]);
		let i = 0;
		
		switch (axis)
		{
			case 0: 
				while(i < ps.length)
				{
					g.vec3.rotateX(ps[i], ps[i], origin, angleRad);
					i++;
				}
				g.vec3.rotateX(center, center, origin, angleRad);
				break;
			case 1: 
				while(i < ps.length)
				{
					g.vec3.rotateY(ps[i], ps[i], origin, angleRad);
					i++;
				}
				g.vec3.rotateY(center, center, origin, angleRad);
				break;
			case 2: 
				while(i < ps.length)
				{
					g.vec3.rotateZ(ps[i], ps[i], origin, angleRad);
					i++;
				}
				g.vec3.rotateZ(center, center, origin, angleRad);
				break;
			default: console.log('[3DObject] rotate bad axis name index:', axis)
		}
	}

	scale(x,y,z)
	{
		
	}
}

globalThis.Model3D = Model;