"use strict"

class UniformLocationCacheClass {
  constructor() {
    this.cache = new WeakMap()
  }

  getLocation(gl, shaderProgram, uniformName) {
    let programCache = this.cache.get(shaderProgram)
    if (!programCache) {
      programCache = new Map()
      this.cache.set(shaderProgram, programCache)
    }

    let location = programCache.get(uniformName)
    if (location === undefined) {
      location = gl.getUniformLocation(shaderProgram, uniformName)
      programCache.set(uniformName, location)
    }
    return location
  }

  getLocations(gl, shaderProgram, uniformNames) {
    const locations = {}
    for (const name of uniformNames) {
      locations[name] = this.getLocation(gl, shaderProgram, name)
    }
    return locations
  }

  clearProgram(shaderProgram) {
    this.cache.delete(shaderProgram)
  }

  getAttributeLocation(gl, shaderProgram, attributeName) {
    let programCache = this.cache.get(shaderProgram)
    if (!programCache) {
      programCache = new Map()
      this.cache.set(shaderProgram, programCache)
    }

    const attrKey = `__attr_${attributeName}`
    let location = programCache.get(attrKey)
    if (location === undefined) {
      location = gl.getAttribLocation(shaderProgram, attributeName)
      programCache.set(attrKey, location)
    }
    return location
  }

  getUniformBlockIndex(gl, shaderProgram, blockName) {
    let programCache = this.cache.get(shaderProgram)
    if (!programCache) {
      programCache = new Map()
      this.cache.set(shaderProgram, programCache)
    }

    const blockKey = `__block_${blockName}`
    let index = programCache.get(blockKey)
    if (index === undefined) {
      index = gl.getUniformBlockIndex(shaderProgram, blockName)
      programCache.set(blockKey, index)
    }
    return index
  }
}

if (!globalThis.UniformLocationCache) {
  globalThis.UniformLocationCache = UniformLocationCacheClass
  globalThis.uniformCache = new UniformLocationCacheClass()
}