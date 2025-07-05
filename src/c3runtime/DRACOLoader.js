// Construct 3 uyumlu Draco Decoder
// Three.js bağımlılıkları kaldırılmıştır

const _taskCache = new WeakMap();

class DRACODecoder {

	constructor(runtime = null) {
		this.runtime = runtime;
		this.decoderPath = '';
		this.decoderConfig = {};
		this.decoderBinary = null;
		this.decoderPending = null;

		this.workerLimit = 4;
		this.workerPool = [];
		this.workerNextTaskID = 1;
		this.workerSourceURL = '';

		this.defaultAttributeIDs = {
			position: 'POSITION',
			normal: 'NORMAL',
			color: 'COLOR',
			uv: 'TEX_COORD'
		};
		this.defaultAttributeTypes = {
			position: 'Float32Array',
			normal: 'Float32Array',
			color: 'Float32Array',
			uv: 'Float32Array'
		};
	}

	setDecoderPath( path ) {
		this.decoderPath = path;
		return this;
	}

	setDecoderConfig( config ) {
		this.decoderConfig = config;
		return this;
	}

	setWorkerLimit( workerLimit ) {
		this.workerLimit = workerLimit;
		return this;
	}

	// Ana decode fonksiyonu - GLTF primitive'ini decode eder
	async decodePrimitive( buffer, attributeIDs = null, attributeTypes = null ) {
		const taskConfig = {
			attributeIDs: attributeIDs || this.defaultAttributeIDs,
			attributeTypes: attributeTypes || this.defaultAttributeTypes,
			useUniqueIDs: !! attributeIDs,
		};

		try {
			const geometryData = await this.decodeGeometry( buffer, taskConfig );
			return this._convertGeometryData( geometryData );
		} catch ( error ) {
			console.error( 'Draco decode error:', error );
			throw error;
		}
	}

	decodeGeometry( buffer, taskConfig ) {
		const taskKey = JSON.stringify( taskConfig );

		// Check for an existing task using this buffer
		if ( _taskCache.has( buffer ) ) {
			const cachedTask = _taskCache.get( buffer );
			if ( cachedTask.key === taskKey ) {
				return cachedTask.promise;
			} else if ( buffer.byteLength === 0 ) {
				throw new Error(
					'DRACODecoder: Unable to re-decode a buffer with different settings. Buffer has already been transferred.'
				);
			}
		}

		let worker;
		const taskID = this.workerNextTaskID ++;
		const taskCost = buffer.byteLength;

		// Obtain a worker and assign a task
		const geometryPending = this._getWorker( taskID, taskCost )
			.then( ( _worker ) => {
				worker = _worker;
				return new Promise( ( resolve, reject ) => {
					worker._callbacks[ taskID ] = { resolve, reject };
					
					// Create a proper transferable buffer
					let transferableBuffer;
					if (buffer instanceof Uint8Array) {
						transferableBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
					} else if (buffer instanceof ArrayBuffer) {
						transferableBuffer = buffer.slice();
					} else {
						// Convert to Uint8Array if it's not already
						const uint8Buffer = new Uint8Array(buffer);
						transferableBuffer = uint8Buffer.buffer.slice(uint8Buffer.byteOffset, uint8Buffer.byteOffset + uint8Buffer.byteLength);
					}
					
					worker.postMessage( { 
						type: 'decode', 
						id: taskID, 
						taskConfig, 
						buffer: transferableBuffer 
					}, [ transferableBuffer ] );
				} );
			} )
			.then( ( message ) => message.geometry );

		// Remove task from the task list
		geometryPending
			.catch( () => true )
			.then( () => {
				if ( worker && taskID ) {
					this._releaseTask( worker, taskID );
				}
			} );

		// Cache the task result
		_taskCache.set( buffer, {
			key: taskKey,
			promise: geometryPending
		} );

		return geometryPending;
	}

	// Geometry data'yı GLTF primitive formatına çevirir
	_convertGeometryData( geometryData ) {
		const result = {
			attributes: {},
			indices: null
		};

		// İndices
		if ( geometryData.index ) {
			result.indices = {
				data: geometryData.index.array,
				componentType: this._getComponentType( geometryData.index.array ),
				count: geometryData.index.array.length
			};
		}

		// Attributes
		for ( let i = 0; i < geometryData.attributes.length; i ++ ) {
			const attribute = geometryData.attributes[ i ];
			const name = attribute.name || 'UNKNOWN';
			
			result.attributes[ name ] = {
				data: attribute.array,
				componentType: this._getComponentType( attribute.array ),
				type: this._getAttributeType( attribute.itemSize ),
				count: attribute.count,
				itemSize: attribute.itemSize,
				normalized: attribute.normalized || false
			};
		}

		return result;
	}

	_getComponentType( array ) {
		if ( array instanceof Int8Array ) return 5120;
		if ( array instanceof Uint8Array ) return 5121;
		if ( array instanceof Int16Array ) return 5122;
		if ( array instanceof Uint16Array ) return 5123;
		if ( array instanceof Uint32Array ) return 5125;
		if ( array instanceof Float32Array ) return 5126;
		return 5126; // Default to FLOAT
	}

	_getAttributeType( itemSize ) {
		switch ( itemSize ) {
			case 1: return 'SCALAR';
			case 2: return 'VEC2';
			case 3: return 'VEC3';
			case 4: return 'VEC4';
			case 9: return 'MAT3';
			case 16: return 'MAT4';
			default: return 'SCALAR';
		}
	}

	_loadLibrary( url, responseType ) {
		const loader = new Promise( async ( resolve, reject ) => {
			try {
				console.log('🔥 DRACOLoader: Loading library with CORS mode:', responseType);
				
				// Use CORS mode fetch like gltfData.js does
				const response = await fetch(url, { mode: "cors" });
				
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				
				let result;
				if (responseType === 'arraybuffer') {
					result = await response.arrayBuffer();
				} else if (responseType === 'text') {
					result = await response.text();
				} else {
					result = await response.blob();
				}
				
				console.log('🔥 DRACOLoader: Library loaded successfully');
				resolve(result);
			} catch (error) {
				console.error('🔥 DRACOLoader: Failed to load library:', error);
				reject(new Error('Failed to load: ' + url));
			}
		});

		return loader;
	}

	preload() {
		if ( this.decoderPending ) return this.decoderPending;
		this.decoderPending = this._initDecoder();
		return this.decoderPending;
	}

	async _initDecoder() {
		const scope = this;
		
		console.log('🔥 DRACOLoader: Initializing decoder with runtime:', !!this.runtime);
		
		// Use GetProjectFileUrl method like gltfWorker.min.js
		let wasmURL, jsURL;
		
		if (this.runtime && this.runtime.GetAssetManager) {
			console.log('🔥 DRACOLoader: Using Construct 3 asset manager (same as gltfWorker)');
			// Use GetProjectFileUrl to avoid CORS issues - same method as gltfWorker.min.js
			wasmURL = await this.runtime.GetAssetManager().GetProjectFileUrl("draco_decoder.wasm");
			jsURL = await this.runtime.GetAssetManager().GetProjectFileUrl("draco_wasm_wrapper.js");
			console.log('🔥 DRACOLoader: Asset URLs resolved successfully');
		} else {
			console.error('🔥 DRACOLoader: Runtime not available - cannot load DRACO files');
			throw new Error('DRACOLoader: Runtime not available - cannot load DRACO files');
		}
		
		const wasmLoader = this._loadLibrary( wasmURL, 'arraybuffer' )
			.catch( () => {
				// Fallback to JavaScript version if WASM fails
				return this._loadLibrary( jsURL, 'text' );
			} );

		const jsLoader = this._loadLibrary( jsURL, 'text' );

		return Promise.all( [ wasmLoader, jsLoader ] ).then( function ( libraries ) {
			const wasmBinary = libraries[ 0 ];
			const jsContent = libraries[ 1 ];

			if ( typeof wasmBinary === 'string' ) {
				// JavaScript fallback
				scope.decoderConfig.type = 'js';
			} else {
				// WASM support
				scope.decoderConfig.type = 'wasm';
				scope.decoderBinary = wasmBinary;
				scope.wasmURL = wasmURL; // URL'yi sakla
			}

			// Create worker source with embedded Draco module and worker code
			const fn = DRACOWorker.toString();
			const body = [
				'/* draco decoder */',
				jsContent,
				'',
				'/* worker */',
				fn.substring( fn.indexOf( '{' ) + 1, fn.lastIndexOf( '}' ) )
			].join( '\n' );

			scope.workerSourceURL = URL.createObjectURL( new Blob( [ body ], { type: 'application/javascript' } ) );
		} );
	}

	_getWorker( taskID, taskCost ) {
		return this._initDecoder().then( () => {
			if ( this.workerPool.length < this.workerLimit ) {
				const worker = new Worker( this.workerSourceURL );
				worker._callbacks = {};
				worker._taskCosts = {};
				worker._taskLoad = 0;

				// WASM binary'yi Worker'a gönder (clone yaparak, transfer etmeyerek)
				let configToSend = { ...this.decoderConfig };
				
				if (this.decoderBinary && this.decoderBinary instanceof ArrayBuffer) {
					// WASM binary'yi config'e ekle (clone edilecek)
					configToSend.wasmBinary = this.decoderBinary.slice();
				}
				
				worker.postMessage( {
					type: 'init',
					decoderConfig: configToSend,
					decoderBinary: this.decoderBinary
				} );

				worker.onmessage = function( e ) {
					const message = e.data;
					switch ( message.type ) {
						case 'decode':
							worker._callbacks[ message.id ].resolve( message );
							break;
						case 'error':
							worker._callbacks[ message.id ].reject( message );
							break;
						default:
							console.error( 'THREE.DRACOLoader: Unexpected message, "' + message.type + '"' );
					}
				};

				this.workerPool.push( worker );
			} else {
				this.workerPool.sort( function( a, b ) {
					return a._taskLoad > b._taskLoad ? -1 : 1;
				} );
			}

			const worker = this.workerPool[ this.workerPool.length - 1 ];
			worker._taskCosts[ taskID ] = taskCost;
			worker._taskLoad += taskCost;
			return worker;
		} );
	}

	_releaseTask( worker, taskID ) {
		worker._taskLoad -= worker._taskCosts[ taskID ];
		delete worker._callbacks[ taskID ];
		delete worker._taskCosts[ taskID ];
	}

	debug() {
		console.log( 'THREE.DRACOLoader: Debug' );
		console.log( this.workerPool );
	}

	dispose() {
		for ( let i = 0, il = this.workerPool.length; i < il; i ++ ) {
			this.workerPool[ i ].terminate();
		}
		this.workerPool.length = 0;

		if ( this.workerSourceURL !== '' ) {
			URL.revokeObjectURL( this.workerSourceURL );
		}
		return this;
	}
}

/* WEB WORKER */
function DRACOWorker() {
	let decoderConfig;
	let decoderPending;

	onmessage = function ( e ) {
		const message = e.data;

		switch ( message.type ) {
			case 'init':
				decoderConfig = message.decoderConfig;
				
				// WASM binary doğrudan gelirse blob URL yaratıp kullan
				if (decoderConfig.wasmBinary) {
					console.log('🔥 Worker: Creating blob URL for WASM binary');
					const wasmBlob = new Blob([decoderConfig.wasmBinary], { type: 'application/wasm' });
					const wasmBlobURL = URL.createObjectURL(wasmBlob);
					
					decoderConfig.locateFile = function(path) {
						console.log('🔥 Worker: locateFile called with:', path);
						if (path.endsWith('.wasm') || path === 'draco_decoder.wasm') {
							console.log('🔥 Worker: Returning blob URL for WASM');
							return wasmBlobURL;
						}
						return path;
					};
					
					// wasmBinary'yi temizle, locateFile ile blob URL kullanılacak
					delete decoderConfig.wasmBinary;
				}
				
				decoderPending = new Promise( function ( resolve ) {
					decoderConfig.onModuleLoaded = function ( draco ) {
						resolve( { draco: draco } );
					};
					DracoDecoderModule( decoderConfig );
				} );
				break;

			case 'decode':
				const buffer = message.buffer;
				const taskConfig = message.taskConfig;
				decoderPending.then( ( module ) => {
					const draco = module.draco;
					const decoder = new draco.Decoder();

					try {
						const geometry = decodeGeometry( draco, decoder, new Uint8Array( buffer ), taskConfig );
						const buffers = geometry.attributes.map( ( attr ) => attr.array.buffer );
						if ( geometry.index ) buffers.push( geometry.index.array.buffer );
						self.postMessage( { type: 'decode', id: message.id, geometry }, buffers );
					} catch ( error ) {
						console.error( error );
						self.postMessage( { type: 'error', id: message.id, error: error.message } );
					} finally {
						draco.destroy( decoder );
					}
				} );
				break;
		}
	};

	function decodeGeometry( draco, decoder, array, taskConfig ) {
		const attributeIDs = taskConfig.attributeIDs;
		const attributeTypes = taskConfig.attributeTypes;

		let dracoGeometry;
		let decodingStatus;

		const geometryType = decoder.GetEncodedGeometryType( array );

		if ( geometryType === draco.TRIANGULAR_MESH ) {
			dracoGeometry = new draco.Mesh();
			decodingStatus = decoder.DecodeArrayToMesh( array, array.byteLength, dracoGeometry );
		} else if ( geometryType === draco.POINT_CLOUD ) {
			dracoGeometry = new draco.PointCloud();
			decodingStatus = decoder.DecodeArrayToPointCloud( array, array.byteLength, dracoGeometry );
		} else {
			throw new Error( 'DRACODecoder: Unexpected geometry type.' );
		}

		if ( ! decodingStatus.ok() || dracoGeometry.ptr === 0 ) {
			throw new Error( 'DRACODecoder: Decoding failed: ' + decodingStatus.error_msg() );
		}

		const geometry = { index: null, attributes: [] };

		// Gather all vertex attributes
		for ( const attributeName in attributeIDs ) {
			const attributeType = self[ attributeTypes[ attributeName ] ];
			let attribute;
			let attributeID;

			if ( taskConfig.useUniqueIDs ) {
				attributeID = attributeIDs[ attributeName ];
				attribute = decoder.GetAttributeByUniqueId( dracoGeometry, attributeID );
			} else {
				attributeID = decoder.GetAttributeId( dracoGeometry, draco[ attributeIDs[ attributeName ] ] );
				if ( attributeID === - 1 ) continue;
				attribute = decoder.GetAttribute( dracoGeometry, attributeID );
			}

			const attributeResult = decodeAttribute( draco, decoder, dracoGeometry, attributeName, attributeType, attribute );
			geometry.attributes.push( attributeResult );
		}

		// Add index
		if ( geometryType === draco.TRIANGULAR_MESH ) {
			geometry.index = decodeIndex( draco, decoder, dracoGeometry );
		}

		draco.destroy( dracoGeometry );
		return geometry;
	}

	function decodeIndex( draco, decoder, dracoGeometry ) {
		const numFaces = dracoGeometry.num_faces();
		const numIndices = numFaces * 3;
		const byteLength = numIndices * 4;

		const ptr = draco._malloc( byteLength );
		decoder.GetTrianglesUInt32Array( dracoGeometry, byteLength, ptr );
		const index = new Uint32Array( draco.HEAPF32.buffer, ptr, numIndices ).slice();
		draco._free( ptr );

		return { array: index, itemSize: 1 };
	}

	function decodeAttribute( draco, decoder, dracoGeometry, attributeName, attributeType, attribute ) {
		const numComponents = attribute.num_components();
		const numPoints = dracoGeometry.num_points();
		const numValues = numPoints * numComponents;
		const byteLength = numValues * attributeType.BYTES_PER_ELEMENT;
		const dataType = getDracoDataType( draco, attributeType );

		const ptr = draco._malloc( byteLength );
		decoder.GetAttributeDataArrayForAllPoints( dracoGeometry, attribute, dataType, byteLength, ptr );
		const array = new attributeType( draco.HEAPF32.buffer, ptr, numValues ).slice();
		draco._free( ptr );

		return {
			name: attributeName,
			array: array,
			itemSize: numComponents,
			count: numPoints,
			normalized: false
		};
	}

	function getDracoDataType( draco, attributeType ) {
		switch ( attributeType ) {
			case Float32Array: return draco.DT_FLOAT32;
			case Int8Array: return draco.DT_INT8;
			case Int16Array: return draco.DT_INT16;
			case Int32Array: return draco.DT_INT32;
			case Uint8Array: return draco.DT_UINT8;
			case Uint16Array: return draco.DT_UINT16;
			case Uint32Array: return draco.DT_UINT32;
		}
	}
}

// Global instance
if (!globalThis.DRACODecoder) {
	globalThis.DRACODecoder = DRACODecoder;
}
