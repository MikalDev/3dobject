import { IGPUResourceCache } from './types';

export class GPUResourceCache implements IGPUResourceCache {
    private gl: WebGL2RenderingContext;

    private cachedState: {
        // Original 4 states
        vao: WebGLVertexArrayObject | null;
        textureBinding: WebGLTexture | null;
        shaderProgram: WebGLProgram | null;
        elementArrayBuffer: WebGLBuffer | null;
        // Additional critical states
        activeTexture: number;
        arrayBuffer: WebGLBuffer | null;
        uniformBufferBindings: (WebGLBuffer | null)[];
    } | null = null;

    // Track which UBO binding points we care about
    private static readonly TRACKED_UBO_BINDING_POINTS = [0, 1, 2, 3]; // Track first 4 binding points

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
    }

    cacheModelMode() {
        // console.log('[rendera] GPUResourceCache: cacheModelMode');
        // Get currently bound VAO
        const vao = this.gl.getParameter(this.gl.VERTEX_ARRAY_BINDING);
        
        // Get currently bound texture
        const textureBinding = this.gl.getParameter(this.gl.TEXTURE_BINDING_2D);
        
        // Get current shader program
        const shaderProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM);

        // Get current element array buffer
        const elementArrayBuffer = this.gl.getParameter(this.gl.ELEMENT_ARRAY_BUFFER_BINDING);
        
        // Get active texture unit
        const activeTexture = this.gl.getParameter(this.gl.ACTIVE_TEXTURE);
        
        // Get array buffer binding
        const arrayBuffer = this.gl.getParameter(this.gl.ARRAY_BUFFER_BINDING);
        
        // Get uniform buffer bindings for tracked binding points
        const uniformBufferBindings: (WebGLBuffer | null)[] = [];
        for (const bindingPoint of GPUResourceCache.TRACKED_UBO_BINDING_POINTS) {
            const buffer = this.gl.getIndexedParameter(this.gl.UNIFORM_BUFFER_BINDING, bindingPoint);
            uniformBufferBindings.push(buffer);
        }
        
        this.cachedState = {
            vao,
            textureBinding,
            shaderProgram,
            elementArrayBuffer,
            activeTexture,
            arrayBuffer,
            uniformBufferBindings
        };
        //console.log('[rendera] GPUResourceCache: cachedState', this.cachedState);
    }

    restoreModelMode() {
        // console.log('[rendera] GPUResourceCache: restoreModelMode');
        if (this.cachedState) {
            // console.log('[rendera] GPUResourceCache: restoreModelMode', this.cachedState);
            
            // First, clean up any texture bindings we might have created on units 1-17
            // This ensures C3 doesn't encounter unexpected textures
            this.cleanupTextureUnits();
            
            // Restore active texture unit first (before binding textures)
            this.gl.activeTexture(this.cachedState.activeTexture);
            
            // Restore original 4 states
            this.gl.bindVertexArray(this.cachedState.vao);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.cachedState.textureBinding);
            this.gl.useProgram(this.cachedState.shaderProgram);
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.cachedState.elementArrayBuffer);
            
            // Restore additional states
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.cachedState.arrayBuffer);
            
            // Restore uniform buffer bindings
            for (let i = 0; i < this.cachedState.uniformBufferBindings.length; i++) {
                const bindingPoint = GPUResourceCache.TRACKED_UBO_BINDING_POINTS[i];
                const buffer = this.cachedState.uniformBufferBindings[i];
                if (buffer !== undefined) {
                    this.gl.bindBufferBase(this.gl.UNIFORM_BUFFER, bindingPoint, buffer);
                }
            }
            
            // Clear cached state after restoration
            this.cachedState = null;
        }
    }

    /**
     * Clean up texture bindings on units we use (1-17) to avoid conflicts with C3
     * We skip unit 0 as it will be restored from cached state
     */
    private cleanupTextureUnits(): void {
        const currentActiveTexture = this.gl.getParameter(this.gl.ACTIVE_TEXTURE);
        
        // Clean material texture units (1-4)
        for (let unit = 1; unit <= 4; unit++) {
            this.gl.activeTexture(this.gl.TEXTURE0 + unit);
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        }
        
        // Clean shadow map texture units (10-17)
        for (let unit = 10; unit <= 17; unit++) {
            this.gl.activeTexture(this.gl.TEXTURE0 + unit);
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        }
        
        // Restore the active texture unit
        this.gl.activeTexture(currentActiveTexture);
    }

}

