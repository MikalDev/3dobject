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
		this.modelData = sdkType.modelData.data;
	}

	rotateZXY(x,y,z)
	{
		// Rotate from original position Z,X,Y rotation order (Unity standard)
		let obj = this.data.obj;
		let ps = obj.points;
		let psOriginal = this.modelData.obj.points;
		let center = this.inst.localCenter;
		const g = globalThis.glMatrix3D;
		let origin = g.vec3.fromValues(center[0],center[1],center[2]);
		let i = 0;

		let rotateQuat = g.quat.create();
		let point = g.vec3.create()

		g.quat.fromEuler(rotateQuat, x,y,z);
		
		while(i < ps.length)
		{
			g.vec3.set(point, psOriginal[i][0],psOriginal[i][1],psOriginal[i][2]);
			g.vec3.subtract(point,point,origin);
			g.vec3.transformQuat(point, point, rotateQuat)
			g.vec3.add(point,point,origin);

			// g.vec3.rotateZ(ps[i], psOriginal[i], origin, g.glMatrix.toRadian(z));
			// g.vec3.rotateX(ps[i], ps[i], origin, g.glMatrix.toRadian(x));
			// g.vec3.rotateY(ps[i], ps[i], origin, g.glMatrix.toRadian(y));
			ps[i][0] = point[0];
			ps[i][1] = point[1];
			ps[i][2] = point[2];
			i++;
		}
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