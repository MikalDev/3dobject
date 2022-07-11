"use strict";
{
    self.C3.Plugins.Mikal_3DObject.Cnds = {
        OnLoaded() {
            return true;
        },
        IsLoaded() {
            return this.loaded;
        },
        OnAnimationFinished() {
            return true;
        },
        IsAnimationFinished() {
            return this.IsAnimationFinished;
        },
        IsWireframeEnabled() {
            return this.wireframe;
        }
    };
}