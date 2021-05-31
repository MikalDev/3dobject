'use strict';

class Model
{
	constructor(runtime, sdkType)
	{
		this._runtime = runtime;
		this.data = JSON.parse(JSON.stringify(sdkType.modelData.data));
	}

	rotate(axis, angle)
	{

	}

	scale(x,y,z)
	{
		
	}
}

globalThis.Model3D = Model;