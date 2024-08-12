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
        OnAnimationNameFinished(name) {
            return (this.animationNameFinished == name);
        },
        IsAnimationFinished() {
            return this.IsAnimationFinished;
        },
        IsWireframeEnabled() {
            return this.wireframe;
        },
        IsPlaying(animation) {
            return (this.animationName == animation);
        }

    };
}