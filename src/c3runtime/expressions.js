"use strict";
{
    self.C3.Plugins.Mikal_3DObject.Exps = {
            AnimationNames() {
                return JSON.stringify(this.gltf.getAnimationNames());
            },
            ZElevation() {
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
            }
        };
}