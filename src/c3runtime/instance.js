"use strict"
{
  const C3 = self.C3

  C3.Plugins.Mikal_3DObject.Instance = class Object3DInstance extends C3.SDKWorldInstanceBase {
    constructor(inst, properties) {
      super(inst)
      this.sdkType = this.GetSdkType()
      this.runtime = inst.GetRuntime()
      this.renderer = this.runtime.GetCanvasManager().GetRenderer()
      this.isWebGPU = this.renderer.IsWebGPU()
      this.uid = this.GetInstance().GetUID()
      this.loaded = false
      this.animationTime = 0
      this.drawVerts = []
      this.drawUVs = []
      this.drawIndices = []
      this.animationIndex = 0
      this.animationSpeed = 1
      this.animationLastTime = 0
      this.animationRate = 60
      this.animationLoop = true
      this.animationPlay = true
      this.animationFinished = false
      this.animationName = ""
      this.xScale = 1
      this.yScale = 1
      this.zScale = 1
      this.debug = false
      this.renderOnce = false
      this.currentAnimationTime = 0
      this.currentAnimationFrame = 0
      this.drawVertsCache = []
      this.drawUVsCache = []
      this.minBB = [0, 0, 0]
      this.maxBB = [0, 0, 0]
      this.updateBbox = true
      this.gltfData = null
      this.instanceModel = false
      this.texture = {}
      this.dataLoaded = false
      this.drawMeshes = []
      this.whiteTexture = null
      this.instanceTexture = false
      this.wi = this.GetWorldInfo()
      this.cannonBody = null
      this.quaternion = null
      this.cannonSetRotation = false
      this.xMinBB = [0, 0, 0]
      this.xMaxBB = [0, 0, 0]
      this.bboxScale = 1
      this.wireframe = false
      this.xWireframeWidth = 2
      this.yWireframeWidth = 2
      this.zWireframeWidth = 2
      this.materialsModify = new Map()
      this.lightDir = [0, 0, 0]
      this.lightEnable = false
      this.lightUpdate = false
      this.lightColor = 0
      this.spotEnable = false
      this.spotDir = [0, 0, 0]
      this.spotCutoff = 0
      this.spotEdge = 0
      this.lights = {}
      this.viewPos = [0, 0, 0]
      this.ambientColor = [0, 0, 0, 0]
      this.animationNameFinished = ""
      this.cpuXform = false
      this.totalTriangles = 0
      this.totalTrianglesCulled = 0
      this.vertexScale = 0
      this.blendMode = 0
      this.quaternion = [0, 0, 0, 1]
      this.enableQuaternion = false
      this.spriteTextures = new Map()
      this.fragLight = false
      this.staticGeometry = false

      if (properties) {
        this.scale = properties[0]
        const wi = inst.GetWorldInfo()
        // wi.SetZElevation(properties[1]);
        // wi._UpdateZElevation();
        this.cpuXform = properties[1]
        this.xAngle = properties[2]
        this.yAngle = properties[3]
        this.zAngle = properties[4]
        this.rotationOrder = properties[5]
        this.gltfPath = properties[6]
        this.debug = properties[7]
        this.animationBlend = properties[8]
        this.instanceModel = properties[9]
        this.instanceTexture = properties[10]
        this.xScale = properties[11]
        this.yScale = properties[12]
        this.zScale = properties[13]
        this.wireframe = properties[14]
        this.workerAnimation = properties[15]
        this.backFaceCull = properties[16]
      }

      this.localCenter = [0, 0, 0]

      // Initialization, once per group of instances unless model data specified per instance
      if (this.instanceModel) {
        this.gltfData = new globalThis.GltfData(this.runtime, this)
        if (this.gltfPath != "path" && this.gltfPath != "") {
          this.gltfData.load(this.gltfPath, true, this.debug)
        }
      } else {
        let sdkType = this.sdkType
        if (sdkType.initOwner == -1) {
          sdkType.initOwner = this.uid
          if (this.gltfPath != "path" && this.gltfPath != "") {
            sdkType.gltfData.load(this.gltfPath, true, this.debug)
          }
        }
      }

      this._StartTicking()
      const wi = this.GetWorldInfo()
    }

    async doInit() {
      const wi = this.GetWorldInfo()
      if (this.instanceModel) {
        if (this.workerAnimation) {
          this.gltf = new globalThis.GltfModelW(this._runtime, this, this)
        } else {
          this.gltf = new globalThis.GltfModel(this._runtime, this, this)
        }
      } else {
        if (this.workerAnimation) {
          this.gltf = new globalThis.GltfModelW(this._runtime, this.sdkType, this)
        } else {
          this.gltf = new globalThis.GltfModel(this._runtime, this.sdkType, this)
        }
      }
      await this.gltf.init()

      // If needed load textures
      let textures = this.instanceModel ? this.texture : this.sdkType.texture
      let whiteTextureOwner = this.instanceModel ? this : this.sdkType
      let gltfData = this.instanceModel ? this.gltfData : this.sdkType.gltfData
      let renderer = this.renderer
      if (gltfData.dynamicTexturesLoaded !== true) {
        this.sdkType.LoadDynamicTextures(renderer, gltfData, textures, whiteTextureOwner, this.instanceModel)
      }

      this.loaded = true
      this.drawVerts = []
      this.drawUVs = []
      this.drawIndices = []
      this.renderOnce = true
      this.runtime.UpdateRender()
      if (this.gltf.getAnimationNames().length > 0) {
        this.animationName = this.gltf.getAnimationNames()[0]
      }
      this.gltf.updateModelRotate(wi.GetX(), wi.GetY(), wi.GetZElevation())
      this._updateBoundingBox(wi.GetX(), wi.GetY(), 0)
      this.Trigger(C3.Plugins.Mikal_3DObject.Cnds.OnLoaded)
    }

    IsOnScreen() {
      const wi = this.GetWorldInfo()
      const layer = wi.GetLayer()
      if (layer.Has3DCamera()) return wi.IsInViewport3D(layer._GetViewFrustum())
      else
        return wi.IsInViewport(
          layer.GetViewport(),
          wi.GetLayout().HasVanishingPointOutsideViewport(),
          wi.GetLayout().IsOrthographicProjection()
        )
    }

    Tick() {
      const onScreen = this.IsOnScreen()

      if (!this.loaded) {
        if ((!this.instanceModel && this.sdkType.dataLoaded) || (this.instanceModel && this.dataLoaded)) {
          if (!this.doingInit) {
            this.doingInit = true
            this.doInit()
          }
        }
      }

      // Animate gltf model
      if (this.loaded) {
        if (this.animationPlay && this.gltf.gltfData.hasOwnProperty("animations")) {
          this.animationTime += this._runtime.GetDt() * this.animationSpeed
          const deltaTime = this.animationTime - this.animationLastTime
          if (deltaTime >= 1 / this.animationRate) {
            this.animationLastTime = this.animationTime
            this.drawVerts = []
            this.drawUVs = []
            this.drawIndices = []
            this.gltf.updateAnimationPolygons(this.animationIndex, this.animationTime, onScreen, deltaTime)
          }
          // } else if (this.renderOnce || (this.workerAnimation))
        } else if (this.renderOnce || this.lightEnable) {
          this.renderOnce = false
          this.drawVerts = []
          this.drawUVs = []
          this.drawIndices = []
          this.gltf.getPolygons()
          this.runtime.UpdateRender()
          this.updateBbox = true
        }
      }
      if (this.cannonBody) {
        const wi = this.wi
        wi.SetXY(this.cannonBody.position.x, this.cannonBody.position.y)
        wi.SetZElevation(this.cannonBody.position.z)
        wi._UpdateZElevation()
        this.quaternion = this.cannonBody.quaternion
        this.runtime.UpdateRender()
        this.updateBbox = true
      }
    }

    RendersToOwnZPlane() {
      return false
    }

    _setZHeight(h) {
      h = Math.max(h, 0)
      if (this._zHeight === h) return
      this._zHeight = h
      this.GetWorldInfo().SetDepth(h)
      this._runtime.UpdateRender()
    }

    Draw(renderer) {
      const imageInfo = this._objectClass.GetImageInfo()
      const texture = imageInfo.GetTexture()

      if (!texture) return // dynamic texture load which hasn't completed yet; can't draw anything
      if (!this.loaded) return

      const wi = this.GetWorldInfo()
      const x = wi.GetX()
      const y = wi.GetY()
      // z elevation handles offset on draw
      const z = wi.GetZElevation()

      let textures = this.instanceModel ? this.texture : this.sdkType.texture
      let whiteTextureOwner = this.instanceModel ? this : this.sdkType
      let gltfData = this.instanceModel ? this.gltfData : this.sdkType.gltfData

      if (!gltfData) {
        // Source destoryed, destroy this instance
        this.runtime.DestroyInstance(this.GetInstance())
        return
      }

      if (gltfData.dynamicTexturesLoaded !== true) {
        this.sdkType.LoadDynamicTextures(renderer, gltfData, textures, whiteTextureOwner, this.instanceModel)
      }

      if (textures.length === 0 || this.instanceTexture) {
        renderer.SetTexture(texture)
      }

      const tempQuad = C3.New(C3.Quad)
      if (this.loaded && this.gltfPath != "path") {
        this.gltf.render(
          renderer,
          x,
          y,
          z,
          tempQuad,
          whiteTextureOwner.whiteTexture,
          wi.GetPremultipliedColor(),
          textures,
          this.instanceTexture
        )

        if (this.updateBbox) {
          if (this.cpuXform) {
            this._updateBoundingBoxCPU(x, y, z)
          } else {
            this._updateBoundingBox(x, y, z)
          }

          wi.SetBboxChanged()
          this.updateBbox = false
        }
      }
    }

    _updateBoundingBoxCPU(x, y, z) {
      const wi = this.GetWorldInfo()
      let width = this.maxBB[0] - this.minBB[0]
      let height = this.maxBB[1] - this.minBB[1]
      height = height == 0 ? 1 : height
      width = width == 0 ? 1 : width
      wi.SetSize(width, height)
      wi.SetOriginX(-(this.minBB[0] - x) / width)
      wi.SetOriginY(-(this.minBB[1] - y) / height)
    }

    initBoundingBox() {
      const wi = this.GetWorldInfo()
      const x = wi.GetX()
      const y = wi.GetY()
      // z elevation handles offset on draw
      const z = wi.GetZElevation()
      this._updateBoundingBox(x, y, z)
      wi.SetBboxChanged()
      this.boundingBoxInit = true
    }

    _updateBoundingBox(x, y, z) {
      const maxBB = this.maxBB
      const minBB = this.minBB
      const cube = [
        [minBB[0], minBB[1], minBB[2]],
        [maxBB[0], minBB[1], minBB[2]],
        [maxBB[0], maxBB[1], minBB[2]],
        [minBB[0], maxBB[1], minBB[2]],
        [minBB[0], minBB[1], maxBB[2]],
        [maxBB[0], minBB[1], maxBB[2]],
        [maxBB[0], maxBB[1], maxBB[2]],
        [minBB[0], maxBB[1], maxBB[2]],
      ]
      const modelRotate = this.gltf.modelRotate
      if (!modelRotate) return

      this.xMinBB = [100000, 100000, 100000]
      this.xMaxBB = [-100000, -100000, -100000]
      const xMinBB = this.xMinBB
      const xMaxBB = this.xMaxBB
      const vec3 = globalThis.glMatrix3D.vec3

      const rotatedPoint = vec3.create()
      for (let i = 0; i < cube.length; i++) {
        const cubePoint = cube[i]
        const point = vec3.fromValues(cubePoint[0], cubePoint[1], cubePoint[2])
        vec3.transformMat4(rotatedPoint, point, modelRotate)
        if (xMinBB[0] > rotatedPoint[0]) xMinBB[0] = rotatedPoint[0]
        if (xMinBB[1] > rotatedPoint[1]) xMinBB[1] = rotatedPoint[1]
        if (xMinBB[2] > rotatedPoint[2]) xMinBB[2] = rotatedPoint[2]
        if (xMaxBB[0] < rotatedPoint[0]) xMaxBB[0] = rotatedPoint[0]
        if (xMaxBB[1] < rotatedPoint[1]) xMaxBB[1] = rotatedPoint[1]
        if (xMaxBB[2] < rotatedPoint[2]) xMaxBB[2] = rotatedPoint[2]
      }

      if (
        this.maxBB[0] != Number.POSITIVE_INFINITY &&
        this.minBB[0] != Number.NEGATIVE_INFINITY &&
        this.maxBB[1] != Number.POSITIVE_INFINITY &&
        this.minBB[1] != Number.NEGATIVE_INFINITY
      ) {
        const wi = this.GetWorldInfo()
        let width = xMaxBB[0] - xMinBB[0]
        let height = xMaxBB[1] - xMinBB[1]
        height = height == 0 ? 1 : height
        width = width == 0 ? 1 : width
        wi.SetSize(width * this.bboxScale, height * this.bboxScale)
        wi.SetOriginX(-(xMinBB[0] - x) / width)
        wi.SetOriginY(-(xMinBB[1] - y) / height)
        this._setZHeight((xMaxBB[2] - xMinBB[2]) * this.bboxScale)
      }
    }

    SaveToJson() {
      return {
        // data to be saved for savegames
      }
    }

    LoadFromJson(o) {
      // load state for savegames
    }

    GetDebuggerProperties() {
      return [
        {
          title: "3DObject",
          properties: [
            //{name: ".current-animation",	value: this._currentAnimation.GetName(),	onedit: v => this.CallAction(Acts.SetAnim, v, 0) },
          ],
        },
      ]
    }

    // timeline support
    GetPropertyValueByIndex(index) {
      return 0
    }

    SetPropertyValueByIndex(index, value) {
      //set property value here
    }

    _findNode(nodeName) {
      for (let ii = 0; ii < this.gltf.gltfData.skinnedNodes.length; ii++) {
        let node = this.gltf.gltfData.skinnedNodes[ii]
        if (node.name == nodeName) {
          return node
        }
      }

      for (let ii = 0; ii < this.gltf.gltfData.nodes.length; ii++) {
        let node = this.gltf.gltfData.nodes[ii]
        if (node.name == nodeName) {
          return node
        }
      }
      return false
    }

    Release() {
      const textureNames = Object.keys(this.texture)
      if (textureNames.length > 0) {
        for (const textureName of textureNames) {
          this.renderer.DeleteTexture(this.texture[textureName])
        }
      }
      if (this.whiteTexture) {
        this.renderer.DeleteTexture(this.whiteTexture)
      }
      if (this.gltf) {
        this.gltf.release()
      }
      this.sdkType = null
      this.runtime = null
      this.renderer = null
      this.uid = null
      this.loaded = null
      this.animationTime = null
      this.drawVerts = null
      this.drawUVs = null
      this.drawIndices = null
      this.animationIndex = null
      this.animationSpeed = null
      this.animationLastTime = null
      this.animationRate = null
      this.animationLoop = null
      this.animationPlay = null
      this.animationFinished = null
      this.animationName = null
      this.xScale = null
      this.yScale = null
      this.zScale = null
      this.debug = null
      this.renderOnce = null
      this.currentAnimationTime = null
      this.currentAnimationFrame = null
      this.drawVertsCache = null
      this.drawUVsCache = null
      this.minBB = null
      this.maxBB = null
      this.updateBbox = null
      this.gltfData = null
      this.instanceModel = null
      this.texture = null
      this.dataLoaded = null
      this.drawMeshes = null
      this.whiteTexture = null
      this.cannonBody = null
      this.cannonSetRotation = null
      this.bboxScale = null
      this.maxBB = null
      this.minBB = null
      this.wireframe = null
      this.workerAnimation = null
      this.xWireframeWidth = null
      this.yWireframeWidth = null
      this.zWireframeWidth = null
      this.materialsModify = null
      this.gltf = null
      this.lightEnable = null
      this.lightColor = null
      this.spotEnable = null
      this.spotDir = null
      this.spotCutoff = null
      this.spotEdge = null
      this.ambientColor = null
      this.quaternion = null
      super.Release()
    }

    getRValue(rgb) {
      const ALPHAEX_SHIFT = 1024
      const RGBEX_SHIFT = 16384
      const RGBEX_MAX = 8191
      if (rgb >= 0) return (rgb & 255) / 255
      else {
        let v = Math.floor(-rgb / (RGBEX_SHIFT * RGBEX_SHIFT * ALPHAEX_SHIFT))
        if (v > RGBEX_MAX) v -= RGBEX_SHIFT
        return v / 1024
      }
    }

    getGValue(rgb) {
      const ALPHAEX_SHIFT = 1024
      const RGBEX_SHIFT = 16384
      const RGBEX_MAX = 8191
      if (rgb >= 0) return ((rgb & 65280) >> 8) / 255
      else {
        let v = Math.floor((-rgb % (RGBEX_SHIFT * RGBEX_SHIFT * ALPHAEX_SHIFT)) / (RGBEX_SHIFT * ALPHAEX_SHIFT))
        if (v > RGBEX_MAX) v -= RGBEX_SHIFT
        return v / 1024
      }
    }

    getBValue(rgb) {
      const ALPHAEX_SHIFT = 1024
      const RGBEX_SHIFT = 16384
      const RGBEX_MAX = 8191
      if (rgb >= 0) return ((rgb & 16711680) >> 16) / 255
      else {
        let v = Math.floor((-rgb % (RGBEX_SHIFT * ALPHAEX_SHIFT)) / ALPHAEX_SHIFT)
        if (v > RGBEX_MAX) v -= RGBEX_SHIFT
        return v / 1024
      }
    }

    getAValue(rgb) {
      const ALPHAEX_SHIFT = 1024
      const ALPHAEX_MAX = 1023
      if (rgb === 0 && 1 / rgb < 0) return 0
      else if (rgb >= 0) return 1
      else {
        const v = Math.floor(-rgb % ALPHAEX_SHIFT)
        return v / ALPHAEX_MAX
      }
    }

    packRGBAEx(red, green, blue, alpha) {
      const ALPHAEX_SHIFT = 1024
      const ALPHAEX_MAX = 1023
      const RGBEX_SHIFT = 16384
      const RGBEX_MAX = 8191
      const RGBEX_MIN = -8192
      red = C3.clamp(Math.floor(red * 1024), RGBEX_MIN, RGBEX_MAX)
      green = C3.clamp(Math.floor(green * 1024), RGBEX_MIN, RGBEX_MAX)
      blue = C3.clamp(Math.floor(blue * 1024), RGBEX_MIN, RGBEX_MAX)
      alpha = C3.clamp(Math.floor(alpha * ALPHAEX_MAX), 0, ALPHAEX_MAX)
      if (red < 0) red += RGBEX_SHIFT
      if (green < 0) green += RGBEX_SHIFT
      if (blue < 0) blue += RGBEX_SHIFT
      return -(
        red * RGBEX_SHIFT * RGBEX_SHIFT * ALPHAEX_SHIFT +
        green * RGBEX_SHIFT * ALPHAEX_SHIFT +
        blue * ALPHAEX_SHIFT +
        alpha
      )
    }

    GetPropertyValueByIndex(index) {
      switch (index) {
        case 0:
          return this.scale
        case 2: // x angle
          return this.xAngle
        case 3: // y angle
          return this.yAngle
        case 4: // z angle
          return this.zAngle
        case 11: // x scale
          return this.xScale
        case 12: // y scale
          return this.yScale
        case 13: // z scale
          return this.zScale
        default:
          return 0
      }
    }

    SetPropertyValueByIndex(index, value) {
      switch (index) {
        case 0:
          this.scale = value
          break
        case 2: // x angle
          this.xAngle = value
          break
        case 3: // y angle
          this.yAngle = value
          break
        case 4: // z angle
          this.zAngle = value
          break
        case 11: // x scale
          this.xScale = value
          break
        case 12: // y scale
          this.yScale = value
          break
        case 13: // z scale
          this.zScale = value
          break
        default:
          break
      }
      this.runtime.UpdateRender()
      this.updateBbox = true
    }

    _setCannonBody(body, setRotaion) {
      this.cannonBody = body
      this.cannonSetRotation = setRotaion
    }

    _removeCannonBody() {
      this.cannonBody = null
      this.cannonSetRotation = false
    }

    _setBBoxScale(scale) {
      this.bboxScale = scale
    }

    _getModel() {
      return this.gltf.gltfData
    }

    _setXAngle(angle) {
      this.xAngle = angle
      this.runtime.UpdateRender()
      this.updateBbox = true
    }

    _setYAngle(angle) {
      this.yAngle = angle
      this.runtime.UpdateRender()
      this.updateBbox = true
    }

    _setZAngle(angle) {
      this.zAngle = angle
      this.runtime.UpdateRender()
      this.updateBbox = true
    }

    _setXScale(scale) {
      this.xScale = scale
      this.runtime.UpdateRender()
      this.updateBbox = true
    }
    _setYScale(scale) {
      this.yScale = scale
      this.runtime.UpdateRender()
      this.updateBbox = true
    }
    _setZScale(scale) {
      this.zScale = scale
      this.runtime.UpdateRender()
      this.updateBbox = true
    }

    _setAnimationBlend(time) {
      this.animationBlend = time
    }

    _enableQuaternion(enable) {
      this.enableQuaternion = enable
      this.renderOnce = true
    }

    _enableFragLight(enable) {
      this.fragLight = enable
    }

    _setQuaternion(quaternion, x, y, z) {
      // try catch JSON parse string quaternion, if not a string, ignore, if not a valid quaternion, ignore with warning
      try {
        const newQuaternion = JSON.parse(quaternion)
        if (newQuaternion instanceof Array && newQuaternion.length == 4) {
          this.quaternion = newQuaternion
          this.renderOnce = true
        } else {
          console.warn("Set Quaternion - Invalid quaternion", quaternion)
        }
      } catch (err) {
        console.warn("Set Quaternion - Invalid quaternion", quaternion)
      }
      if (x !== 0 || y !== 0 || z !== 0) {
        const glMatrix3D = globalThis.glMatrix3D
        const quat = glMatrix3D.quat
        const rotateQuat = quat.create()
        quat.fromEuler(rotateQuat, x, y, z)
        quat.mul(this.quaternion, this.quaternion, rotateQuat)
      }
    }

    GetScriptInterfaceClass() {
      // @ts-ignore
      return self.I3DObjectInstance
    }
  }

  // Script interface. Use a WeakMap to safely hide the internal implementation details from the
  // caller using the script interface.
  const map = new WeakMap()
  // @ts-ignore
  self.I3DObjectInstance = class I3DObjectInstance extends self.IWorldInstance {
    constructor() {
      super()
      // Map by SDK instance
      // @ts-ignore
      map.set(this, self.IInstance._GetInitInst().GetSdkInstance())
      // @ts-ignore
    }

    setCannonBody(body, setRotaion = true) {
      map.get(this)._setCannonBody(body, setRotaion)
    }

    removeCannonBody() {
      map.get(this)._removeCannonBody()
    }

    get model() {
      return map.get(this)._getModel()
    }

    set xAngle(angle) {
      map.get(this)._setXAngle(angle)
    }
    set yAngle(angle) {
      map.get(this)._setYAngle(angle)
    }
    set zAngle(angle) {
      map.get(this)._setZAngle(angle)
    }

    get xAngle() {
      return map.get(this).xAngle
    }
    get yAngle() {
      return map.get(this).yAngle
    }
    get zAngle() {
      return map.get(this).zAngle
    }

    set xScale(scale) {
      map.get(this)._setXScale(scale)
    }
    set yScale(scale) {
      map.get(this)._setYScale(scale)
    }
    set zScale(scale) {
      map.get(this)._setZScale(scale)
    }

    get xScale() {
      return map.get(this).xScale
    }
    get yScale() {
      return map.get(this).yScale
    }
    get zScale() {
      return map.get(this).zScale
    }

    set animationBlend(time) {
      map.get(this)._setAnimationBlend(time)
    }
    get animationBlend() {
      return map.get(this).animationBlend
    }
  }
}
