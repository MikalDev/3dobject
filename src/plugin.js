"use strict"
{
  const SDK = self.SDK

  const PLUGIN_ID = "Mikal_3DObject"
  const PLUGIN_VERSION = "2.64.0"
  const PLUGIN_CATEGORY = "3d"

  const PLUGIN_CLASS = (SDK.Plugins.Mikal_3DObject = class Object3DPlugin extends SDK.IPluginBase {
    constructor() {
      super(PLUGIN_ID)

      SDK.Lang.PushContext("plugins." + PLUGIN_ID.toLowerCase())

      this._info.SetName(lang(".name"))
      this._info.SetDescription(lang(".description"))
      this._info.SetVersion(PLUGIN_VERSION)
      this._info.SetCategory(PLUGIN_CATEGORY)
      this._info.SetAuthor("Mikal")
      this._info.SetHelpUrl(lang(".help-url"))
      this._info.SetPluginType("world") // mark as world plugin, which can draw
      this._info.SetIsResizable(true) // allow to be resized
      this._info.SetIsRotatable(false) // allow to be rotated
      this._info.SetHasImage(true)
      this._info.SetSupportsEffects(true) // allow effects
      this._info.SetMustPreDraw(false)
      this._info.SetCanBeBundled(false)
      this._info.SetIs3D(true)
      this._info.SetSupportsColor(true)
      this._info.AddCommonPositionACEs()
      // this._info.AddCommonAngleACEs();
      this._info.AddCommonAppearanceACEs()
      this._info.AddCommonZOrderACEs()
      // this._info.AddCommonSizeACEs();
      this._info.AddCommonSceneGraphACEs()
      this._info.SetSupportsZElevation(true)

      this._info.SetSupportedRuntimes(["c3"])

      SDK.Lang.PushContext(".properties")

      this._info.SetProperties([
        new SDK.PluginProperty("text", "scale", "1"),
        new SDK.PluginProperty("float", "z-elevation", {
          interpolatable: false,
          initialValue: 0,
        }),
        new SDK.PluginProperty("float", "angle-x", {
          interpolatable: true,
          initialValue: 0,
        }),
        new SDK.PluginProperty("float", "angle-y", {
          interpolatable: true,
          initialValue: 0,
        }),
        new SDK.PluginProperty("float", "angle-z", {
          interpolatable: true,
          initialValue: 0,
        }),
        new SDK.PluginProperty("combo", "rotation-order", {
          initialValue: "xyz",
          items: ["xyz", "xzy", "yxz", "yzx", "zxy", "zyx"],
          interpolatable: false,
        }),
        new SDK.PluginProperty("link", "edit-image", {
          linkCallback: function (sdkType) {
            sdkType.GetObjectType().EditImage()
          },
          callbackType: "once-for-type",
        }),
        new SDK.PluginProperty("text", "gtlf-path", "", {
          interpolatable: false,
        }),
        new SDK.PluginProperty("check", "debug", false, {
          interpolatable: false,
        }),
        new SDK.PluginProperty("float", "animation-blend", 0, {
          interpolatable: false,
        }),
        new SDK.PluginProperty("check", "instance-model", false, {
          interpolatable: false,
        }),
        new SDK.PluginProperty("check", "image-texture", false, {
          interpolatable: false,
        }),
        new SDK.PluginProperty("float", "x-scale", {
          interpolatable: true,
          initialValue: 1,
        }),
        new SDK.PluginProperty("float", "y-scale", {
          interpolatable: true,
          initialValue: 1,
        }),
        new SDK.PluginProperty("float", "z-scale", {
          interpolatable: true,
          initialValue: 1,
        }),
        new SDK.PluginProperty("check", "wireframe", false, {
          interpolatable: false,
        }),
        new SDK.PluginProperty("check", "worker-animation", false, {
          interpolatable: false,
        }),
        new SDK.PluginProperty("check", "cpu-xform", false, {
          interpolatable: false,
        }),
      ])

      this._info.AddFileDependency({
        filename: "gl-matrix.js",
        type: "external-runtime-script",
      })
      this._info.AddFileDependency({
        filename: "c3runtime/gltfData.js",
        type: "external-runtime-script",
      })
      this._info.AddFileDependency({
        filename: "c3runtime/gltfModel.js",
        type: "external-runtime-script",
      })
      this._info.AddFileDependency({
        filename: "c3runtime/gltfModelW.js",
        type: "external-runtime-script",
      })
      this._info.AddFileDependency({
        filename: "c3runtime/gltfWorker.js",
        type: "copy-to-output",
        fileType: "text",
      })

      SDK.Lang.PopContext() //.properties
      SDK.Lang.PopContext()
    }
  })

  PLUGIN_CLASS.Register(PLUGIN_ID, PLUGIN_CLASS)
}
