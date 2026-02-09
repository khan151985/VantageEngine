/* ========================================
   Sirah Maps - Asset Loaders
   ======================================== */

class AssetLoader {
    constructor() {
        this.loadingManager = new THREE.LoadingManager();
        
        // Setup loading manager callbacks
        this.loadingManager.onStart = (url, loaded, total) => {
            State.state.loading.mesh = true;
            UI.showLoading('Loading model...');
        };
        
        this.loadingManager.onProgress = (url, loaded, total) => {
            const progress = (loaded / total) * 100;
            UI.updateLoadingProgress(progress);
        };
        
        this.loadingManager.onLoad = () => {
            State.state.loading.mesh = false;
            UI.hideLoading();
        };
        
        this.loadingManager.onError = (url) => {
            State.state.loading.mesh = false;
            UI.hideLoading();
            UI.showToast('error', 'Load Error', `Failed to load: ${url}`);
        };
        
        // Initialize loaders
        this.gltfLoader = new THREE.GLTFLoader(this.loadingManager);
        this.fbxLoader = null; // Will be loaded if needed
        this.objLoader = null; // Will be loaded if needed
        
        // Texture loader
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    }
    
    // Load 3D model from file
    async loadModel(file) {
        const extension = Utils.getFileExtension(file.name);
        const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
        
        switch (extension) {
            case 'glb':
            case 'gltf':
                return this.loadGLTF(arrayBuffer, file.name);
            case 'fbx':
                return this.loadFBX(arrayBuffer, file.name);
            case 'obj':
                return this.loadOBJ(arrayBuffer, file.name);
            default:
                throw new Error(`Unsupported format: ${extension}`);
        }
    }
    
    // Load GLTF/GLB model
    loadGLTF(arrayBuffer, filename) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.parse(arrayBuffer, '', (gltf) => {
                const model = gltf.scene;
                model.userData.filename = filename;
                model.userData.animations = gltf.animations || [];
                
                // Copy animations to model
                model.animations = gltf.animations || [];
                
                // Log model info for debugging
                console.log('GLTF loaded:', {
                    filename,
                    animations: gltf.animations?.length || 0,
                    children: model.children.length
                });
                
                // Traverse and log meshes
                let meshCount = 0;
                model.traverse(child => {
                    if (child.isMesh) {
                        meshCount++;
                        console.log('Mesh found:', child.name, 'geometry:', child.geometry?.attributes?.position?.count, 'vertices');
                    }
                });
                console.log('Total meshes:', meshCount);
                
                resolve({
                    object: model,
                    animations: gltf.animations || [],
                    filename
                });
            }, (error) => {
                console.error('GLTF parse error:', error);
                reject(error);
            });
        });
    }
    
    // Load FBX model
    async loadFBX(arrayBuffer, filename) {
        // Dynamically load FBX loader if not loaded
        if (!this.fbxLoader) {
            await this.loadFBXLoader();
        }
        
        return new Promise((resolve, reject) => {
            try {
                const loader = new THREE.FBXLoader(this.loadingManager);
                const model = loader.parse(arrayBuffer);
                model.userData.filename = filename;
                
                resolve({
                    object: model,
                    animations: model.animations || [],
                    filename
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // Load OBJ model
    async loadOBJ(arrayBuffer, filename) {
        if (!this.objLoader) {
            await this.loadOBJLoader();
        }
        
        return new Promise((resolve, reject) => {
            try {
                const loader = new THREE.OBJLoader(this.loadingManager);
                const text = new TextDecoder().decode(arrayBuffer);
                const model = loader.parse(text);
                model.userData.filename = filename;
                
                // Apply default material if none
                model.traverse(child => {
                    if (child.isMesh && !child.material) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0xcccccc,
                            roughness: 0.8,
                            metalness: 0.2
                        });
                    }
                });
                
                resolve({
                    object: model,
                    animations: [],
                    filename
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // Load FBX loader script
    loadFBXLoader() {
        return new Promise((resolve, reject) => {
            // FBX loader should already be loaded via script tag
            if (THREE.FBXLoader) {
                this.fbxLoader = true;
                resolve();
            } else {
                reject(new Error('FBXLoader not available'));
            }
        });
    }
    
    // Load OBJ loader script
    loadOBJLoader() {
        return new Promise((resolve, reject) => {
            if (THREE.OBJLoader) {
                this.objLoader = true;
                resolve();
            } else {
                reject(new Error('OBJLoader not available'));
            }
        });
    }
    
    // Load texture from file
    async loadTexture(file) {
        const dataUrl = await Utils.readFileAsDataURL(file);
        return new Promise((resolve, reject) => {
            this.textureLoader.load(dataUrl, resolve, undefined, reject);
        });
    }
    
    // Load image as data URL
    async loadImage(file) {
        return Utils.readFileAsDataURL(file);
    }
    
    // Load video as data URL (persists in save files)
    async loadVideo(file) {
        return Utils.readFileAsDataURL(file);
    }
    
    // Load audio as data URL (persists in save files)
    async loadAudio(file) {
        return Utils.readFileAsDataURL(file);
    }
    
    // Convert model to base64 for storage
    async modelToBase64(file) {
        const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
    }
    
    // Convert base64 back to array buffer
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    // Load model from base64 data
    async loadModelFromBase64(base64, filename) {
        const arrayBuffer = this.base64ToArrayBuffer(base64);
        const extension = Utils.getFileExtension(filename);
        
        switch (extension) {
            case 'glb':
            case 'gltf':
                return this.loadGLTF(arrayBuffer, filename);
            case 'fbx':
                return this.loadFBX(arrayBuffer, filename);
            case 'obj':
                return this.loadOBJ(arrayBuffer, filename);
            default:
                throw new Error(`Unsupported format: ${extension}`);
        }
    }
    
    // Get model info without fully loading
    async getModelInfo(file) {
        const extension = Utils.getFileExtension(file.name);
        
        return {
            name: file.name.replace(/\.[^/.]+$/, ''),
            filename: file.name,
            format: extension.toUpperCase(),
            size: file.size,
            sizeFormatted: Utils.formatFileSize(file.size)
        };
    }
    
    // Check if format is supported
    isFormatSupported(filename) {
        const supported = ['glb', 'gltf', 'fbx', 'obj'];
        const ext = Utils.getFileExtension(filename);
        return supported.includes(ext);
    }
    
    // Optimize model (reduce memory footprint)
    optimizeModel(model) {
        model.traverse(child => {
            if (child.isMesh) {
                // Dispose of unnecessary attributes
                if (child.geometry.attributes.uv2) {
                    child.geometry.deleteAttribute('uv2');
                }
                
                // Compress geometry
                if (child.geometry.index === null) {
                    // Generate indices to reduce memory
                    const positionAttribute = child.geometry.attributes.position;
                    const indices = [];
                    for (let i = 0; i < positionAttribute.count; i++) {
                        indices.push(i);
                    }
                    child.geometry.setIndex(indices);
                }
                
                // Enable frustum culling
                child.frustumCulled = true;
            }
        });
        
        return model;
    }
    
    // Estimate memory usage of model
    estimateModelMemory(model) {
        let bytes = 0;
        
        model.traverse(child => {
            if (child.isMesh) {
                // Geometry
                const geometry = child.geometry;
                for (const name in geometry.attributes) {
                    const attribute = geometry.attributes[name];
                    bytes += attribute.array.byteLength;
                }
                if (geometry.index) {
                    bytes += geometry.index.array.byteLength;
                }
                
                // Textures
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        if (mat.map) bytes += this.estimateTextureMemory(mat.map);
                        if (mat.normalMap) bytes += this.estimateTextureMemory(mat.normalMap);
                        if (mat.roughnessMap) bytes += this.estimateTextureMemory(mat.roughnessMap);
                        if (mat.metalnessMap) bytes += this.estimateTextureMemory(mat.metalnessMap);
                    });
                }
            }
        });
        
        return bytes;
    }
    
    estimateTextureMemory(texture) {
        if (!texture.image) return 0;
        const { width, height } = texture.image;
        // Assume 4 bytes per pixel (RGBA)
        return width * height * 4;
    }
}

// Create global instance
const Loader = new AssetLoader();

// Export
window.AssetLoader = AssetLoader;
window.Loader = Loader;
