/* ========================================
   Sirah Maps - Three.js Renderer
   Simplified and working version
   ======================================== */

class MapRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.container = canvas.parentElement;

        // Three.js core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Animation
        this.clock = new THREE.Clock();
        this.mixers = [];
        this.animationFrameId = null;

        // Scene objects
        this.meshes = new Map();
        this.pointSprites = new Map();
        this.borders = new Map(); // Store border meshes

        this.grid = null;

        // Performance monitoring
        this.frameCount = 0;
        this.lastFPSUpdate = 0;
        this.fps = 60;

        // Point Marker Mesh (3D flag/indicator that moves between points)
        this.pointMarkerMesh = null;
        this.pointMarkerMixer = null;
        this.pointMarkerTargetPosition = null;
        this.pointMarkerAnimating = false;

        // Initialize
        this.init();
    }

    init() {
        console.log('🎬 Initializing MapRenderer...');

        // Check Three.js
        if (typeof THREE === 'undefined') {
            console.error('THREE.js not loaded!');
            return;
        }
        console.log('Three.js version:', THREE.REVISION);

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        console.log('Scene created');

        // Create camera
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000);
        this.camera.position.set(50, 50, 50);
        console.log('Camera created at:', this.camera.position.toArray());

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            logarithmicDepthBuffer: true // Fix z-fighting in Editor too
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        console.log('Renderer created, size:', width, 'x', height);

        // Create controls
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.canvas);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.1;
            this.controls.target.set(0, 0, 0);
            console.log('OrbitControls created');
        } else {
            console.error('OrbitControls not available!');
        }

        // Add lights
        this.setupLights();

        // Add grid
        this.setupGrid();

        // Setup transform controls for mesh manipulation
        this.setupTransformControls();

        // Add test cube to verify rendering works
        this.addTestCube();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Start render loop
        this.animate();

        // Listen for history events to sync scene
        if (window.State) {
            State.on('undo', (action) => this.onHistoryAction(action));
            State.on('redo', (action) => this.onHistoryAction(action));
        }

        console.log('✅ MapRenderer initialized');
    }

    setupTransformControls() {
        if (typeof THREE.TransformControls === 'undefined') {
            console.warn('TransformControls not available');
            return;
        }

        this.transformControls = new THREE.TransformControls(this.camera, this.canvas);
        this.transformControls.setSize(0.75);
        this.scene.add(this.transformControls);

        // Disable orbit controls while transforming and record history
        this.transformControls.addEventListener('dragging-changed', (event) => {
            if (this.controls) {
                this.controls.enabled = !event.value;
            }

            if (event.value) {
                // Drag start - capture initial state
                const object = this.transformControls.object;
                if (object && object.userData.id) {
                    const id = object.userData.id;
                    let item = State.findById('meshes', id);
                    let path = 'meshes';

                    if (!item) {
                        item = State.findById('points', id);
                        path = 'points';
                    }

                    if (item) {
                        // Deep clone the item to preserve initial state
                        this.dragStartItem = JSON.parse(JSON.stringify(item));
                        this.dragStartPath = path;
                        console.log('Drag start:', id, path);
                    }
                } else if (object && object.userData.type === 'border-point') {
                    // Start dragging border point
                    // We don't need to capture item here for history if updateBorderPoint handles it,
                    // but we might want to if we want standard history support.
                    // For now, let's just log.
                }
            } else {
                // Drag end - record history
                const object = this.transformControls.object;

                if (object && object.userData.type === 'border-point') {
                    this.updateBorderPoint(object.userData.borderId, object.userData.index, object.position);
                } else if (this.dragStartItem) {
                    const object = this.transformControls.object;
                    const id = this.dragStartItem.id;

                    // Get current item from State (which has been updated during drag)
                    const currentItem = State.findById(this.dragStartPath, id);

                    if (currentItem) {
                        // Capture the new values
                        const updates = {
                            position: JSON.parse(JSON.stringify(currentItem.position)),
                            rotation: currentItem.rotation ? JSON.parse(JSON.stringify(currentItem.rotation)) : undefined,
                            scale: currentItem.scale ? JSON.parse(JSON.stringify(currentItem.scale)) : undefined
                        };

                        // Record history via StateManager
                        if (typeof State.recordHistory === 'function') {
                            State.recordHistory({
                                type: 'update',
                                path: this.dragStartPath,
                                id: id,
                                oldItem: this.dragStartItem,
                                updates: updates
                            });
                            console.log('Recorded drag history');
                        }
                    }

                    this.dragStartItem = null;
                    this.dragStartPath = null;
                }
            }
        });

        // Update state when transform changes
        this.transformControls.addEventListener('objectChange', () => {
            const object = this.transformControls.object;
            if (object && object.userData.id) {
                const id = object.userData.id;

                // Check if mesh
                const meshData = State.findById('meshes', id);
                if (meshData) {
                    meshData.position = {
                        x: object.position.x,
                        y: object.position.y,
                        z: object.position.z
                    };
                    meshData.rotation = {
                        x: THREE.MathUtils.radToDeg(object.rotation.x),
                        y: THREE.MathUtils.radToDeg(object.rotation.y),
                        z: THREE.MathUtils.radToDeg(object.rotation.z)
                    };
                    meshData.scale = {
                        x: object.scale.x,
                        y: object.scale.y,
                        z: object.scale.z
                    };

                    // Update UI property inputs
                    UI.updatePropertiesPanel({ type: 'mesh', id: id });
                    return;
                }

                // Check if point
                const pointData = State.findById('points', id);
                if (pointData) {
                    let newY = object.position.y;

                    // Adjust for lift height if applicable to get ground position
                    if (pointData.lifted) {
                        newY -= (pointData.liftHeight || 5);
                    }

                    pointData.position = {
                        x: object.position.x,
                        y: newY,
                        z: object.position.z
                    };

                    // Update lift line if points manager exists
                    if (window.PointsManager && typeof PointsManager.update === 'function') {
                        PointsManager.update(id, pointData);
                    }

                    // Update UI property inputs
                    UI.updatePropertiesPanel({ type: 'point', id: id });
                }
            }
        });

        console.log('TransformControls created');
    }

    // Attach transform controls to a specific 3D object directly
    attachTransformControlsToObject(object) {
        if (!this.transformControls) return;
        this.transformControls.attach(object);
        this.transformControls.enabled = true;
    }

    // Attach transform controls to a mesh or point via ID
    attachTransformControls(id) {
        if (!this.transformControls) return;

        // Try to find mesh first
        const meshData = this.meshes.get(id);
        if (meshData && meshData.object) {
            this.transformControls.attach(meshData.object);
            console.log('Transform controls attached to mesh:', id);
            return;
        }

        // Try to find point sprite
        if (this.pointSprites && this.pointSprites.has(id)) {
            const sprite = this.pointSprites.get(id);
            this.transformControls.attach(sprite);
            console.log('Transform controls attached to point:', id);
            return;
        }

        console.warn('Could not find object to attach controls:', id);
    }

    // Detach transform controls
    detachTransformControls() {
        if (this.transformControls) {
            this.transformControls.detach();
        }
    }

    // Set transform mode (translate, rotate, scale)
    setTransformMode(mode) {
        if (this.transformControls) {
            this.transformControls.setMode(mode);
            console.log('Transform mode set to:', mode);
        }
    }

    setupLights() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        // Main directional light
        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(50, 100, 50);
        this.scene.add(directional);

        // Fill light from opposite side
        const fill = new THREE.DirectionalLight(0xffffff, 0.3);
        fill.position.set(-50, 50, -50);
        this.scene.add(fill);

        console.log('Lights added');
    }

    setupGrid() {
        this.grid = new THREE.GridHelper(100, 20, 0x444444, 0x333333);
        this.scene.add(this.grid);
        console.log('Grid added');
    }

    addTestCube() {
        // Add a small test cube to verify rendering is working
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({ color: 0x00C8FF });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 1, 0);
        cube.name = 'testCube';
        this.scene.add(cube);
        console.log('Test cube added - should see blue cube if rendering works');
    }

    removeTestCube() {
        const cube = this.scene.getObjectByName('testCube');
        if (cube) {
            this.scene.remove(cube);
            cube.geometry.dispose();
            cube.material.dispose();
        }
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update controls
        if (this.controls) {
            this.controls.update();
        }

        // Clamp camera to bounds
        this.clampCameraToBounds();

        // Update animations
        this.mixers.forEach(mixer => mixer.update(delta));

        // Update point marker animation if loaded
        if (this.pointMarkerMixer) {
            this.pointMarkerMixer.update(delta);
        }

        // Dynamic Scaling for Point Marker
        this.updatePointMarkerScale();

        // Render
        this.renderer.render(this.scene, this.camera);

        // FPS counter
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFPSUpdate >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFPSUpdate));
            this.frameCount = 0;
            this.lastFPSUpdate = now;

            const fpsEl = document.getElementById('fps-counter');
            if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;

            const memEl = document.getElementById('memory-usage');
            if (memEl && performance.memory) {
                const mb = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                memEl.textContent = `${mb} MB`;
            }


            // Distance from camera to grid (always visible, no selection needed)
            const distEl = document.getElementById('distance-display');
            if (distEl) {
                // Calculate distance from camera to grid center (0, 0, 0)
                const gridCenter = new THREE.Vector3(0, 0, 0);
                const distance = this.camera.position.distanceTo(gridCenter);

                // Get world unit settings for display
                const settings = window.State ? State.getProject('settings') : null;
                const scale = settings?.scale || { factor: 1, unit: 'meters' };
                const unitLabel = scale.unit === 'feet' ? 'ft' : 'm';

                // Calculate real distance using scale factor
                const realDistance = distance * scale.factor;

                distEl.textContent = `Dist: ${realDistance.toFixed(1)}${unitLabel}`;
                distEl.style.display = 'inline';
            }
        }
    }

    onResize() {
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // Load and add 3D model - SIMPLIFIED VERSION LIKE TEST FILE
    async loadAndAddModel(file, id, data) {
        console.log('📦 Loading model:', file.name);

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                console.log('File read complete, size:', e.target.result.byteLength, 'bytes');

                // Store the model data as base64 for preview/export
                const base64Data = this.arrayBufferToBase64(e.target.result);
                const blobUrl = URL.createObjectURL(new Blob([e.target.result], { type: 'model/gltf-binary' }));

                // Store in loadedModels map for preview access
                if (!this.loadedModels) this.loadedModels = new Map();
                this.loadedModels.set(data.filename || file.name, blobUrl);

                // Also store base64 in state for persistence
                const meshData = State.findById('meshes', id);
                if (meshData) {
                    meshData.modelData = base64Data;
                }

                const loader = new THREE.GLTFLoader();

                loader.parse(e.target.result, '',
                    (gltf) => {
                        console.log('✅ GLTF parsed successfully!');

                        const model = gltf.scene;

                        // Remove test cube when first model loads
                        this.removeTestCube();

                        // Count meshes and fix materials
                        let meshCount = 0;
                        model.traverse(child => {
                            if (child.isMesh) {
                                meshCount++;
                                if (child.material) {
                                    child.material.side = THREE.DoubleSide;
                                }
                            }
                        });
                        console.log('Model has', meshCount, 'meshes');

                        // Calculate bounding box
                        const box = new THREE.Box3().setFromObject(model);
                        const size = box.getSize(new THREE.Vector3());
                        const center = box.getCenter(new THREE.Vector3());

                        console.log('Model size:', size.x.toFixed(2), 'x', size.y.toFixed(2), 'x', size.z.toFixed(2));
                        console.log('Model center:', center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2));

                        // Apply saved transforms if they exist, otherwise center at origin
                        if (data.position) {
                            model.position.set(data.position.x, data.position.y, data.position.z);
                            console.log('Applied saved position:', data.position);
                        } else {
                            // Center the model at origin (first time import)
                            model.position.sub(center);
                            model.position.y += size.y / 2;
                        }

                        if (data.rotation) {
                            model.rotation.set(
                                THREE.MathUtils.degToRad(data.rotation.x || 0),
                                THREE.MathUtils.degToRad(data.rotation.y || 0),
                                THREE.MathUtils.degToRad(data.rotation.z || 0)
                            );
                            console.log('Applied saved rotation:', data.rotation);
                        }

                        if (data.scale) {
                            model.scale.set(data.scale.x || 1, data.scale.y || 1, data.scale.z || 1);
                            console.log('Applied saved scale:', data.scale);
                        }

                        // Store model data
                        model.userData.id = id;
                        model.userData.name = data.name;

                        // Add to scene
                        this.scene.add(model);
                        console.log('Model added to scene!');

                        // Store in meshes map
                        this.meshes.set(id, {
                            object: model,
                            data: data,
                            size: size,
                            center: center,
                            animations: gltf.animations || []
                        });

                        // Fit camera to see the model
                        this.fitCameraToModel(model, size);

                        // Update grid to match model size
                        this.updateGridSize(size);

                        // Setup animations if any
                        if (gltf.animations && gltf.animations.length > 0) {
                            console.log('Model has', gltf.animations.length, 'animations');
                            this.setupAnimations(id, model, gltf.animations);
                        }

                        resolve({
                            object: model,
                            animations: gltf.animations || [],
                            size: size,
                            // Return actual transforms used (important for first-time import)
                            position: {
                                x: model.position.x,
                                y: model.position.y,
                                z: model.position.z
                            },
                            rotation: {
                                x: THREE.MathUtils.radToDeg(model.rotation.x),
                                y: THREE.MathUtils.radToDeg(model.rotation.y),
                                z: THREE.MathUtils.radToDeg(model.rotation.z)
                            },
                            scale: {
                                x: model.scale.x,
                                y: model.scale.y,
                                z: model.scale.z
                            }
                        });
                    },
                    (error) => {
                        console.error('❌ GLTF parse error:', error);
                        reject(error);
                    }
                );
            };

            reader.onerror = (e) => {
                console.error('❌ File read error:', e);
                reject(e);
            };

            reader.readAsArrayBuffer(file);
        });
    }

    fitCameraToModel(model, size) {
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = maxDim * 2;

        this.camera.position.set(dist, dist, dist);
        this.controls.target.set(0, size.y / 2, 0);
        this.controls.update();

        console.log('Camera positioned at distance:', dist);
    }

    updateGridSize(size) {
        const maxDim = Math.max(size.x, size.z);
        const gridSize = Math.max(100, maxDim * 2);

        // Remove old grid
        if (this.grid) {
            this.scene.remove(this.grid);
            this.grid.geometry.dispose();
            this.grid.material.dispose();
        }

        // Create new grid
        this.grid = new THREE.GridHelper(gridSize, 20, 0x444444, 0x333333);
        this.scene.add(this.grid);
    }

    setupAnimations(id, model, animations) {
        const meshData = this.meshes.get(id);
        if (!meshData) return;

        const mixer = new THREE.AnimationMixer(model);
        meshData.mixer = mixer;
        meshData.actions = [];
        this.mixers.push(mixer);

        animations.forEach(clip => {
            const action = mixer.clipAction(clip);
            meshData.actions.push({
                name: clip.name,
                duration: clip.duration,
                action: action
            });
        });

        // Auto-play first animation
        if (meshData.actions.length > 0) {
            meshData.actions[0].action.play();
        }
    }

    // Remove mesh
    removeMesh(id) {
        const meshData = this.meshes.get(id);
        if (!meshData) return;

        // Stop animations
        if (meshData.mixer) {
            const index = this.mixers.indexOf(meshData.mixer);
            if (index !== -1) this.mixers.splice(index, 1);
        }

        // Remove from scene
        this.scene.remove(meshData.object);

        // Dispose
        meshData.object.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        this.meshes.delete(id);
    }

    // Get mesh Three.js object by ID
    getMeshObject(id) {
        const meshData = this.meshes.get(id);
        return meshData ? meshData.object : null;
    }

    // Apply brightness to mesh materials
    applyMeshBrightness(id, brightnessPercent) {
        const meshObj = this.getMeshObject(id);
        if (!meshObj) return;

        const intensity = brightnessPercent / 100;

        meshObj.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    // Store original color if not already stored
                    if (!mat.userData.originalColor) {
                        mat.userData.originalColor = mat.color.clone();
                    }
                    // Apply brightness
                    mat.color.copy(mat.userData.originalColor).multiplyScalar(intensity);

                    // Handle emissive for brightness > 100%
                    if (intensity > 1) {
                        const boost = (intensity - 1) * 0.5;
                        if (mat.emissive) {
                            mat.emissiveIntensity = boost;
                            if (mat.emissive.getHex() === 0) mat.emissive.setHex(0x222222);
                        }
                    } else if (mat.emissive) {
                        mat.emissiveIntensity = 0;
                    }
                });
            }
        });
    }

    // Add point sprite - delegates to PointsManager
    async addPoint(id, data) {
        // Use PointsManager for point creation
        const sprite = await PointsManager.add(id, data);

        // Also store in renderer's collection for compatibility
        this.pointSprites.set(id, sprite);

        return sprite;
    }

    // Update point
    updatePoint(id, data) {
        // Update via PointsManager
        PointsManager.update(id, data);

        // Update local reference
        const sprite = PointsManager.sprites.get(id);
        if (sprite) {
            this.pointSprites.set(id, sprite);
        }
    }

    // Remove point
    removePoint(id) {
        // Remove via PointsManager
        PointsManager.remove(id);

        // Remove from local collection
        this.pointSprites.delete(id);
    }

    // Get point at mouse position
    getPointAtMouse(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Use PointsManager sprites
        const sprites = Array.from(PointsManager.sprites.values());
        const intersects = raycaster.intersectObjects(sprites);

        if (intersects.length > 0) {
            return intersects[0].object.userData;
        }
        return null;
    }

    // Raycast helper
    raycast(event, objects) {
        const rect = this.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        return raycaster.intersectObjects(objects, true);
    }

    // Get mesh position at mouse
    getMeshPositionAtMouse(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Get all mesh objects
        const meshObjects = [];
        this.meshes.forEach((meshData, id) => {
            // Check State for measurementEnabled property
            const stateMesh = window.State ? State.findById('meshes', id) : null;
            const isEnabled = stateMesh ? (stateMesh.measurementEnabled !== false) : true;

            // Only include if object exists, is strictly visible, and measurement is enabled
            if (meshData.object && meshData.object.visible && isEnabled) {
                meshObjects.push(meshData.object);
            }
        });

        console.log('getMeshPositionAtMouse - meshes count:', meshObjects.length);

        if (meshObjects.length === 0) {
            console.warn('No meshes available for raycasting!');
            return null;
        }

        const intersects = raycaster.intersectObjects(meshObjects, true);
        console.log('Raycast intersects:', intersects.length);

        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    }

    // Animate camera to position
    animateCameraTo(position, target, duration = 1000) {
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const endPos = new THREE.Vector3(position.x, position.y, position.z);
        const endTarget = new THREE.Vector3(target.x, target.y, target.z);

        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);

            this.camera.position.lerpVectors(startPos, endPos, eased);
            this.controls.target.lerpVectors(startTarget, endTarget, eased);
            this.controls.update();

            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // Go to view
    goToView(view) {
        this.animateCameraTo(view.position, view.target);
    }

    // Reset camera
    resetCamera() {
        this.animateCameraTo({ x: 50, y: 50, z: 50 }, { x: 0, y: 0, z: 0 });
    }

    // Get camera state
    getCameraState() {
        return {
            position: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            },
            target: {
                x: this.controls.target.x,
                y: this.controls.target.y,
                z: this.controls.target.z
            },
            fov: this.camera.fov
        };
    }

    // Set background color
    setBackgroundColor(color) {
        this.scene.background = new THREE.Color(color);
    }

    // Fit camera to show all content
    fitCameraToScene() {
        const box = new THREE.Box3();

        // Include all meshes
        this.meshes.forEach(meshData => {
            box.expandByObject(meshData.object);
        });

        // Include all point sprites
        this.pointSprites.forEach(sprite => {
            box.expandByPoint(sprite.position);
        });

        if (box.isEmpty()) {
            // Default view if nothing in scene
            this.camera.position.set(50, 50, 50);
            this.controls.target.set(0, 0, 0);
        } else {
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 2;

            this.camera.position.set(
                center.x + distance * 0.5,
                center.y + distance * 0.5,
                center.z + distance * 0.5
            );
            this.controls.target.copy(center);
        }

        this.controls.update();
    }


    // Handle history actions (undo/redo)
    onHistoryAction(action) {
        // We need to update the 3D scene based on the action
        // 'set' -> reload everything might be safest
        // 'add' -> add/remove item
        // 'remove' -> add/remove item
        // 'update' -> update item transforms

        console.log('Syncing scene for history action:', action.type, action.path);

        if (action.path === 'meshes') {
            switch (action.type) {
                case 'add':
                case 'remove':
                case 'set':
                    // For structural changes, reloading is safest and handles parent/child relationships
                    this.reloadAllMeshes();
                    // If we removed the currently selected object, clear selection/gizmo
                    if (this.transformControls.object) {
                        const id = this.transformControls.object.userData.id;
                        if (!State.findById('meshes', id)) {
                            this.detachTransformControls();
                        }
                    }
                    if (State.state.selection.type === 'mesh' && !State.findById('meshes', State.state.selection.id)) {
                        State.clearSelection();
                    }
                    break;
                case 'update':
                    // Optimize updates - just update the transform
                    const meshData = State.findById('meshes', action.id);
                    if (meshData) {
                        const entry = this.meshes.get(action.id);
                        if (entry && entry.object) {
                            entry.object.position.set(
                                meshData.position.x,
                                meshData.position.y,
                                meshData.position.z
                            );
                            if (meshData.rotation) {
                                entry.object.rotation.set(
                                    THREE.MathUtils.degToRad(meshData.rotation.x),
                                    THREE.MathUtils.degToRad(meshData.rotation.y),
                                    THREE.MathUtils.degToRad(meshData.rotation.z)
                                );
                            }
                            if (meshData.scale) {
                                entry.object.scale.set(
                                    meshData.scale.x,
                                    meshData.scale.y,
                                    meshData.scale.z
                                );
                            }
                        }
                    }
                    break;
            }
        } else if (action.path === 'points') {
            // Relay to PointsManager
            if (window.PointsManager) {
                switch (action.type) {
                    case 'add':
                        // If we undid an add, it's a remove. If we redid an add, it's an add.
                        const point = State.findById('points', action.id);
                        if (point) {
                            PointsManager.add(action.id, point);
                        } else {
                            PointsManager.remove(action.id);
                        }
                        break;
                    case 'remove':
                        // Same logic: check if it exists in State now
                        const p = State.findById('points', action.id);
                        if (p) PointsManager.add(action.id, p);
                        else PointsManager.remove(action.id);
                        break;
                    case 'update':
                        const pt = State.findById('points', action.id);
                        if (pt) PointsManager.update(action.id, pt);
                        break;
                }
            }

            // Handle selection storage if point was removed
            if (this.transformControls.object) {
                const id = this.transformControls.object.userData.id;
                if (!State.findById('points', id)) {
                    this.detachTransformControls();
                }
            }
        }
    }

    // Take screenshot
    takeScreenshot() {
        this.renderer.render(this.scene, this.camera);
        return this.canvas.toDataURL('image/png');
    }

    // Get scene bounding box
    getSceneBounds() {
        const box = new THREE.Box3();
        let hasObjects = false;

        this.meshes.forEach(meshData => {
            if (meshData.object) {
                box.expandByObject(meshData.object);
                hasObjects = true;
            }
        });

        if (!hasObjects) return null;

        return {
            min: { x: box.min.x, y: box.min.y, z: box.min.z },
            max: { x: box.max.x, y: box.max.y, z: box.max.z }
        };
    }

    // Set camera bounds constraints
    setCameraBounds(bounds) {
        this.cameraBounds = bounds;

        if (bounds && bounds.enabled && this.controls) {
            // Set min/max distance
            this.controls.minDistance = bounds.minDistance || 5;
            this.controls.maxDistance = bounds.maxDistance || 200;
        }
    }

    // Toggle bounds helper visualization
    toggleBoundsHelper(bounds) {
        // Remove existing helper
        if (this.boundsHelper) {
            this.scene.remove(this.boundsHelper);
            this.boundsHelper.geometry.dispose();
            this.boundsHelper.material.dispose();
            this.boundsHelper = null;
            return;
        }

        // Create new helper
        const min = new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z);
        const max = new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z);
        const box = new THREE.Box3(min, max);

        this.boundsHelper = new THREE.Box3Helper(box, 0x00ff00);
        this.boundsHelper.material.linewidth = 2;
        this.boundsHelper.raycast = () => { }; // Disable raycasting on helper
        this.boundsHelper.userData.ignoreRaycast = true;
        this.scene.add(this.boundsHelper);
    }

    // Show/hide bounds helper
    showBoundsHelper(show) {
        if (this.boundsHelper) {
            this.boundsHelper.visible = show;
        }
    }

    // Clamp camera position to bounds (called in animation loop)
    clampCameraToBounds() {
        if (!this.cameraBounds || !this.cameraBounds.enabled) return;

        const bounds = this.cameraBounds;
        const pos = this.camera.position;

        // Clamp position to bounding box
        pos.x = Math.max(bounds.min.x, Math.min(bounds.max.x, pos.x));
        pos.y = Math.max(bounds.min.y, Math.min(bounds.max.y, pos.y));
        pos.z = Math.max(bounds.min.z, Math.min(bounds.max.z, pos.z));
    }

    // Reload all meshes from state
    async reloadAllMeshes() {
        const meshes = State.getProject('meshes');
        for (const mesh of meshes) {
            const existing = this.meshes.get(mesh.id);
            if (existing && existing.object) {
                // Update transforms
                existing.object.position.set(
                    mesh.position?.x || 0,
                    mesh.position?.y || 0,
                    mesh.position?.z || 0
                );
                existing.object.rotation.set(
                    (mesh.rotation?.x || 0) * Math.PI / 180,
                    (mesh.rotation?.y || 0) * Math.PI / 180,
                    (mesh.rotation?.z || 0) * Math.PI / 180
                );
                existing.object.scale.set(
                    mesh.scale?.x || 1,
                    mesh.scale?.y || 1,
                    mesh.scale?.z || 1
                );
            }
        }
    }

    // Refresh all point positions
    refreshAllPoints() {
        const points = State.getProject('points');
        points.forEach(point => {
            const sprite = this.pointSprites.get(point.id);
            if (sprite) {
                sprite.position.set(
                    point.position?.x || 0,
                    (point.position?.y || 0) + (point.lifted ? (point.liftHeight || 5) : 0),
                    point.position?.z || 0
                );
            }
        });
    }

    // Update point icons (recreate sprites with new icons)
    updatePointIcons() {
        const points = State.getProject('points');
        points.forEach(point => {
            const sprite = this.pointSprites.get(point.id);
            if (sprite) {
                // Update scale
                const scale = point.style?.scale || 1;
                sprite.scale.set(scale * 2, scale * 2, 1);

                // If custom icon, update material
                if (point.style?.iconType === 'custom' && point.style?.customIcon) {
                    const loader = new THREE.TextureLoader();
                    loader.load(point.style.customIcon, (texture) => {
                        sprite.material.map = texture;
                        sprite.material.needsUpdate = true;
                    });
                }
            }
        });
    }

    // Create ribbon geometry for flat borders
    createRibbonGeometry(curve, width, isLoop, smoothness) {
        const points = curve.getPoints(smoothness);
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];

        // For map borders, usually flat on ground, 'up' is Y.
        // Side vector = Cross(Tangent, Up).
        const up = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i < points.length; i++) {
            const p = points[i];

            // Calculate tangent
            let tangent;
            if (i < points.length - 1) {
                tangent = new THREE.Vector3().subVectors(points[i + 1], p).normalize();
            } else if (i > 0) {
                tangent = new THREE.Vector3().subVectors(p, points[i - 1]).normalize();
            } else {
                // Should be covered by i < length-1 unless 1 point
                tangent = new THREE.Vector3(1, 0, 0);
            }

            // Handle last point in loop calculation if needed, 
            // but curve.getPoints usually handles interpolation nicely.

            // Calculate side vector (perpendicular to path)
            const side = new THREE.Vector3().crossVectors(tangent, up).normalize().multiplyScalar(width / 2);

            // Left vertex
            vertices.push(p.x - side.x, p.y - side.y, p.z - side.z);
            // Right vertex
            vertices.push(p.x + side.x, p.y + side.y, p.z + side.z);
        }

        const segments = points.length - 1;
        for (let i = 0; i < segments; i++) {
            const current = i * 2;
            const next = (i + 1) * 2;

            // Triangle 1 (CurrentL, NextL, CurrentR)
            indices.push(current, next, current + 1);
            // Triangle 2 (CurrentR, NextL, NextR)
            indices.push(current + 1, next, next + 1);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    // Create box geometry with miter joints for sharp corners
    createMiterBoxGeometry(points, width, isLoop) {
        // 1. Validate inputs
        if (!points || points.length < 2) {
            console.warn('createMiterBoxGeometry: Insufficient points');
            return new THREE.BufferGeometry();
        }

        // 2. Clean up & Validate Points (Remove duplicates & NaNs)
        const cleanPoints = [];
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (isNaN(p.x) || isNaN(p.y) || isNaN(p.z)) continue;

            if (cleanPoints.length > 0) {
                const last = cleanPoints[cleanPoints.length - 1];
                if (p.distanceTo(last) < 0.0001) continue;
            }
            cleanPoints.push(p);
        }

        // Handle loop closure duplication
        if (isLoop && cleanPoints.length > 2) {
            const first = cleanPoints[0];
            const last = cleanPoints[cleanPoints.length - 1];
            if (first.distanceTo(last) < 0.0001) {
                cleanPoints.pop();
            }
        }

        if (cleanPoints.length < 2) {
            console.warn('createMiterBoxGeometry: Not enough valid points after cleanup');
            return new THREE.BufferGeometry();
        }

        const halfWidth = (parseFloat(width) || 0.5) / 2;
        const up = new THREE.Vector3(0, 1, 0); // Fixed UP vector ensures walls are vertical

        const count = cleanPoints.length;
        const sideVectors = []; // Side vector for each segment
        const segmentTangents = [];

        // 3. Calculate Segment data (Tangents and Sides)
        for (let i = 0; i < count; i++) {
            // Determine "next" for this segment. n-1 connects to 0 if loop
            let nextIdx = (i + 1);
            if (nextIdx >= count && !isLoop) break; // Last segment doesn't exist for open
            nextIdx = nextIdx % count;

            const curr = cleanPoints[i];
            const next = cleanPoints[nextIdx];

            const tangent = new THREE.Vector3().subVectors(next, curr).normalize();

            // Fallback for vertical segments where Cross(T, Up) is zero
            if (Math.abs(tangent.y) > 0.99) tangent.set(1, 0, 0); // Hacky but prevents crash

            // Side is always perpendicular to path and UP. Keeps box "Upright".
            const side = new THREE.Vector3().crossVectors(tangent, up).normalize();

            segmentTangents.push(tangent);
            sideVectors.push(side);
        }

        const vertices = [];
        const indices = [];

        // 4. Generate Vertices at each point
        // We need 'numPoints' vertices. For open string, N points. Loop, N points.
        const numPoints = count;

        for (let i = 0; i < numPoints; i++) {
            let prevSegIdx, nextSegIdx;

            if (isLoop) {
                prevSegIdx = (i - 1 + count) % count;
                nextSegIdx = i;
            } else {
                // Open path
                prevSegIdx = i - 1;
                nextSegIdx = i;

                // Endpoints: just use the single adjacent segment
                if (i === 0) prevSegIdx = 0;
                if (i === count - 1) nextSegIdx = count - 2;
            }

            const s1 = sideVectors[prevSegIdx];
            const s2 = sideVectors[nextSegIdx];

            // Average the side vectors to get the miter direction
            const miter = new THREE.Vector3().addVectors(s1, s2).normalize();

            // Scale correction for sharp corners (1 / dot(miter, s1))
            // If segments are parallel, dot is 1 -> scale 1.
            // If 90 deg turn, dot is 0.707 -> scale 1.414.
            let scale = 1;
            const dot = miter.dot(s1);
            if (Math.abs(dot) > 0.1) {
                scale = 1 / dot;
            }
            scale = Math.min(scale, 4.0); // Limit sharp spikes

            const offset = miter.clone().multiplyScalar(halfWidth * scale);

            const p = cleanPoints[i];

            // 4 Vertices: TL, TR, BR, BL
            // Note: Box height is 2 * halfWidth (Square profile)

            // Top Left
            vertices.push(p.x - offset.x, p.y + halfWidth, p.z - offset.z);
            // Top Right
            vertices.push(p.x + offset.x, p.y + halfWidth, p.z + offset.z);
            // Bottom Right
            vertices.push(p.x + offset.x, p.y - halfWidth, p.z + offset.z);
            // Bottom Left
            vertices.push(p.x - offset.x, p.y - halfWidth, p.z - offset.z);
        }

        // 5. Generate Indices
        const numSegments = isLoop ? count : count - 1;

        for (let i = 0; i < numSegments; i++) {
            const currBase = i * 4;
            const nextBase = ((i + 1) % count) * 4;

            // TL, TR, BR, BL order

            // Top Face (0-1) -> Tri 1: 0, 4, 5. Tri 2: 0, 5, 1 ??
            // Using standard quad logic:
            // curr0, next0, next1
            // curr0, next1, curr1

            // Top (0-1 side)
            indices.push(currBase + 0, nextBase + 0, nextBase + 1);
            indices.push(currBase + 0, nextBase + 1, currBase + 1);

            // Right (1-2 side)
            indices.push(currBase + 1, nextBase + 1, nextBase + 2);
            indices.push(currBase + 1, nextBase + 2, currBase + 2);

            // Bottom (2-3 side)
            indices.push(currBase + 2, nextBase + 2, nextBase + 3);
            indices.push(currBase + 2, nextBase + 3, currBase + 3);

            // Left (3-0 side)
            indices.push(currBase + 3, nextBase + 3, nextBase + 0);
            indices.push(currBase + 3, nextBase + 0, currBase + 0);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    // Add a border visualization with real thickness using TubeGeometry
    addBorder(borderData) {
        if (!borderData || !borderData.points || borderData.points.length < 2) return;

        // Remove existing if any
        if (this.borders.has(borderData.id)) {
            this.removeBorder(borderData.id);
        }

        const color = borderData.color || '#FFFF00';
        const thickness = (borderData.width || 50) / 100; // Scale down for 3D
        // Default height offset of 1.0 to prevent Z-fighting with mesh surface
        const yOffset = borderData.height !== undefined ? borderData.height : 1.0;
        const offset = borderData.offset || { x: 0, y: 0, z: 0 };
        const isLoop = borderData.loop !== false; // Default to closed loop
        const opacity = (borderData.opacity ?? 100) / 100;
        const fill = borderData.fill === true;

        // Create points array with offset
        const points = borderData.points.map(p =>
            new THREE.Vector3(
                p.x + offset.x,
                p.y + yOffset + offset.y,
                p.z + offset.z
            )
        );

        // Create a group to hold both border and fill
        const borderGroup = new THREE.Group();
        borderGroup.userData = {
            id: borderData.id,
            type: 'border',
            borderData: borderData
        };
        // Removed group renderOrder to let children control it
        // borderGroup.renderOrder = 1; 

        // Create the border outline (tube or plane)
        // Create curve based on Box Style setting
        let curve;
        const isBoxStyle = borderData.boxStyle === true;

        if (isBoxStyle) {
            // Linear path for sharp corners
            curve = new THREE.CurvePath();
            const count = points.length - (isLoop ? 0 : 1);
            for (let i = 0; i < count; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                curve.add(new THREE.LineCurve3(p1, p2));
            }
        } else {
            // Smooth spline path
            curve = new THREE.CatmullRomCurve3(points, isLoop, 'centripetal', 0);
        }

        // Use user-defined smoothness or calculate default
        // Fix: Allow 0 smoothness (or check for undefined explicitly)
        let smoothness = (borderData.smoothness !== undefined) ? parseInt(borderData.smoothness) : Math.max(points.length * 8, 32);

        // Ensure smoothness is at least 2 to prevent geometry errors
        if (smoothness < 2) smoothness = 2;

        let borderGeometry;
        const isPlane = borderData.borderType === 'plane';

        if (isPlane) {
            // Create flat ribbon geometry
            borderGeometry = this.createRibbonGeometry(curve, thickness, isLoop, smoothness);
        } else if (isBoxStyle) {
            // Use Miter Box Geometry for aligned 3D borders (Fixes tilted/twisted look)
            borderGeometry = this.createMiterBoxGeometry(points, thickness, isLoop);
        } else {
            // Tube Geometry for Round/Smooth borders
            const radialSegments = 8;
            const tubularSegments = smoothness;
            borderGeometry = new THREE.TubeGeometry(curve, tubularSegments, thickness, radialSegments, isLoop);
        }

        const borderMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthTest: true,  // Enable depth test so it respects terrain
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });

        const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
        borderMesh.renderOrder = 0; // Standard render order
        borderGroup.add(borderMesh);

        // Create fill if enabled and loop is closed
        if (fill && isLoop && points.length >= 3) {
            // Get interpolated points for smooth fill that matches the border curve
            const fillPoints = curve.getPoints(smoothness);

            // Use ShapeUtils for triangulation of arbitrary polygons (supports concave)
            // Project to XZ plane (assuming terrain borders roughly follow ground)
            const contour = fillPoints.map(p => new THREE.Vector2(p.x, p.z));

            // Triangulate
            // ShapeUtils.triangulateShape returns array of faces (arrays of 3 indices)
            const faces = THREE.ShapeUtils.triangulateShape(contour, []);

            const vertices = [];
            faces.forEach(face => {
                // face is [i, j, k] indices into contour (which matches fillPoints)
                for (let i = 0; i < 3; i++) {
                    const v = fillPoints[face[i]];
                    vertices.push(v.x, v.y, v.z);
                }
            });

            const fillGeometry = new THREE.BufferGeometry();
            fillGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            fillGeometry.computeVertexNormals();

            // Use separate fill opacity if defined
            const fillOp = borderData.fillOpacity !== undefined ? borderData.fillOpacity / 100 : opacity;
            const fillColor = borderData.fillColor || color;

            const fillMaterial = new THREE.MeshBasicMaterial({
                color: fillColor,
                transparent: true,
                opacity: fillOp,
                side: THREE.DoubleSide,
                depthTest: true,  // Enable depth test so it respects scene depth
                depthWrite: false, // Don't write to depth buffer
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });

            const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
            fillMesh.renderOrder = -100; // Very low priority - render first
            borderGroup.add(fillMesh);
        }

        this.scene.add(borderGroup);
        this.borders.set(borderData.id, borderGroup);

        // Note: visibleOnLoad only affects exported version, not editor viewport
        // Borders are always visible in editor for easier editing

        console.log('Border added:', borderData.name, 'thickness:', thickness, 'fill:', fill);



        return borderGroup;
    }

    // Update border visualization
    updateBorder(id, updates) {
        const borderMesh = this.borders.get(id);
        if (!borderMesh) return;

        // Get current data and merge updates
        const currentData = borderMesh.userData.borderData || {};
        const newData = { ...currentData, ...updates };

        // Recreate the border with new settings
        this.addBorder(newData);
    }

    // Remove a border
    removeBorder(id) {
        // Cleanup visuals
        this.hideBorderPoints(id);

        const borderObj = this.borders.get(id);
        if (borderObj) {
            this.scene.remove(borderObj);
            // Dispose all children (group may have multiple meshes)
            borderObj.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.borders.delete(id);
        }
    }

    // Get border mesh for transform controls
    getBorderMesh(id) {
        return this.borders.get(id);
    }

    // Show control points for a border
    showBorderPoints(id) {
        if (!this.pointGroups) this.pointGroups = new Map();

        const borderGroup = this.borders.get(id);
        if (!borderGroup) return;

        // Clean up any existing points (Scene or BorderGroup)
        this.hideBorderPoints(id);

        const data = borderGroup.userData.borderData;
        if (!data) return;

        // Global offset from State
        const stateSettings = State.state.project.settings || { offset: { x: 0, y: 0, z: 0 } };
        const offset = stateSettings.offset || { x: 0, y: 0, z: 0 };
        const yOffset = (data.height || 1.0) * 0.1; // Match addBorder logic
        const thickness = parseFloat(data.width) || 0.5;
        // Use a box that is sized relative to thickness
        const size = Math.max(5.0, thickness * 0.8);
        // Lift above tube: Tube Radius (thick/2) + Box Half Height (size/2) + Gap (2)
        const lift = (thickness * 0.5) + (size * 0.5) + 2.0;

        const pointsGroup = new THREE.Group();
        pointsGroup.name = `points-handles-${id}`;

        // Solid Red Cube for visibility
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            depthTest: false,
            depthWrite: false,
            transparent: false
        });

        console.log('BorderPoints:', id, 'Size', size, 'Lift', lift);

        data.points.forEach((p, index) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.renderOrder = 999999; // Very high
            mesh.frustumCulled = false;
            mesh.position.set(
                p.x + offset.x,
                p.y + yOffset + offset.y + lift,
                p.z + offset.z
            );
            mesh.userData = { type: 'border-point', borderId: id, index: index, originalPos: p };
            pointsGroup.add(mesh);
        });

        // Add to SCENE
        this.scene.add(pointsGroup);
        this.pointGroups.set(id, pointsGroup);

        // Mark as showing points in data so it persists on update
        data.showPoints = true;
    }

    hideBorderPoints(id) {
        if (!this.pointGroups) return;

        const group = this.pointGroups.get(id);
        if (group) {
            this.scene.remove(group);
            this.pointGroups.delete(id);
        }

        const borderGroup = this.borders.get(id);
        if (borderGroup && borderGroup.userData.borderData) {
            borderGroup.userData.borderData.showPoints = false;
        }
    }

    // Update a specific point position
    updateBorderPoint(id, index, position) {
        const borderGroup = this.borders.get(id);
        if (!borderGroup) return;

        const data = borderGroup.userData.borderData;
        if (!data || !data.points[index]) return;

        // Convert world position back to local (remove global offset)
        const stateSettings = State.state.project.settings || { offset: { x: 0, y: 0, z: 0 } };
        const offset = stateSettings.offset || { x: 0, y: 0, z: 0 };
        const yOffset = (data.height || 1.0) * 0.1;
        const thickness = parseFloat(data.width) || 0.5;
        const size = Math.max(5.0, thickness * 0.8);
        const lift = (thickness * 0.5) + (size * 0.5) + 2.0;

        // Calculate new local point
        const newLocal = {
            x: position.x - offset.x,
            y: position.y - yOffset - offset.y - lift, // Remove lift to get actual curve height
            z: position.z - offset.z
        };

        // Update data
        data.points[index] = newLocal;

        // Trigger full update
        State.updateInProject('borders', id, { points: data.points });
        this.addBorder(data); // Re-render
    }

    // ========== PATH RENDERING ==========



    // Toggle visibility for multiple meshes by IDs
    toggleMeshesVisibility(meshIds, show = true) {
        if (!meshIds || !Array.isArray(meshIds)) return;

        meshIds.forEach(meshId => {
            const meshData = this.meshes.get(meshId);
            if (meshData && meshData.object) {
                meshData.object.visible = show;
                console.log('Mesh visibility toggled:', meshId, show);
            }
        });
    }

    // Toggle visibility for multiple borders by IDs
    toggleBordersVisibility(borderIds, show = true) {
        if (!borderIds || !Array.isArray(borderIds)) return;

        borderIds.forEach(borderId => {
            const borderGroup = this.borders.get(borderId);
            if (borderGroup) {
                borderGroup.visible = show;
                // Keep the border visible flag in userData in sync if needed?
                // Usually logic relies on 'visible' prop.
                console.log('Border visibility toggled:', borderId, show);
            }
        });
    }

    // Toggle visibility for category meshes
    toggleCategoryMeshes(categoryId, show = true) {
        const category = State.findById('categories', categoryId);
        if (category && category.visibilityMeshes && category.visibilityMeshes.length > 0) {
            this.toggleMeshesVisibility(category.visibilityMeshes, show);
        }
    }

    // Convert ArrayBuffer to base64 string
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Convert base64 string to ArrayBuffer
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // ================================
    // Point Marker Mesh (3D indicator)
    // ================================

    // Load point marker mesh from settings
    async loadPointMarkerMesh() {
        const settings = State.getProject('settings') || {};
        const markerSettings = settings.pointMarkerMesh;

        if (!markerSettings || !markerSettings.data) {
            console.log('No point marker mesh configured');
            return null;
        }

        // Remove existing marker if any
        this.removePointMarkerMesh();

        try {
            const arrayBuffer = this.base64ToArrayBuffer(markerSettings.data);
            const loader = new THREE.GLTFLoader();

            return new Promise((resolve, reject) => {
                loader.parse(arrayBuffer, '',
                    (gltf) => {
                        console.log('✅ Point marker mesh loaded successfully');

                        const model = gltf.scene;

                        // Apply scale from settings
                        const scale = markerSettings.scale || { x: 1, y: 1, z: 1 };
                        model.scale.set(scale.x, scale.y, scale.z);

                        model.traverse(child => {
                            if (child.isMesh) {
                                child.renderOrder = 5000; // High priority (below points but above borders)
                                if (child.material) child.material.side = THREE.DoubleSide;
                            }
                        });

                        // Initially hidden
                        model.visible = false;
                        model.userData.isPointMarker = true;
                        model.renderOrder = 20; // Draw above borders(10)

                        this.scene.add(model);
                        this.pointMarkerMesh = model;

                        // Setup animations if any
                        if (gltf.animations && gltf.animations.length > 0) {
                            this.pointMarkerMixer = new THREE.AnimationMixer(model);
                            const action = this.pointMarkerMixer.clipAction(gltf.animations[0]);
                            action.play();
                        }

                        resolve(model);
                    },
                    (error) => {
                        console.error('❌ Failed to load point marker mesh:', error);
                        reject(error);
                    }
                );
            });
        } catch (err) {
            console.error('Error loading point marker mesh:', err);
            return null;
        }
    }

    // Remove point marker mesh
    removePointMarkerMesh() {
        if (this.pointMarkerMesh) {
            this.scene.remove(this.pointMarkerMesh);
            this.pointMarkerMesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.pointMarkerMesh = null;
        }
        if (this.pointMarkerMixer) {
            this.pointMarkerMixer = null;
        }
    }

    // Move point marker to a specific position with smooth animation
    movePointMarkerTo(position, instant = false) {
        if (!this.pointMarkerMesh) {
            console.log('Point marker mesh not loaded');
            return;
        }

        const settings = State.getProject('settings') || {};
        const markerSettings = settings.pointMarkerMesh || {};
        const offset = markerSettings.offset || { x: 0, y: 0, z: 0 };
        const duration = instant ? 0 : (markerSettings.animationDuration || 500);

        const targetPos = new THREE.Vector3(
            position.x + offset.x,
            position.y + offset.y,
            position.z + offset.z
        );

        // Make visible
        this.pointMarkerMesh.visible = true;
        // Store base scale for dynamic resizing
        const baseScale = markerSettings.scale || { x: 1, y: 1, z: 1 };
        // If pointScale is passed via argument we could use it, but for now use base
        // We'll store it so updatePointMarkerScale can use it
        if (!this.pointMarkerMesh.userData) this.pointMarkerMesh.userData = {};
        this.pointMarkerMesh.userData.targetScale = { ...baseScale };

        // Initial scale set
        this.updatePointMarkerScale();

        if (instant || duration === 0) {
            // Instant move
            this.pointMarkerMesh.position.copy(targetPos);
        } else {
            // Smooth animation
            const startPos = this.pointMarkerMesh.position.clone();
            const startTime = performance.now();

            const animateMarker = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function (ease-out cubic)
                const eased = 1 - Math.pow(1 - progress, 3);

                this.pointMarkerMesh.position.lerpVectors(startPos, targetPos, eased);

                if (progress < 1) {
                    requestAnimationFrame(animateMarker);
                }
            };

            requestAnimationFrame(animateMarker);
        }
    }

    // Hide point marker mesh
    hidePointMarker() {
        if (this.pointMarkerMesh) {
            this.pointMarkerMesh.visible = false;
        }
    }

    // Check if point marker is visible
    isPointMarkerVisible() {
        return this.pointMarkerMesh && this.pointMarkerMesh.visible;
    }

    // Dynamic Scale Update
    updatePointMarkerScale() {
        if (!this.pointMarkerMesh || !this.pointMarkerMesh.visible || !this.camera) return;

        const distance = this.camera.position.distanceTo(this.pointMarkerMesh.position);
        // Factor logic matching export.js: 1.0 scale at ~40 units distance
        const factor = Math.max(0.3, Math.min(50, distance / 40));

        const target = this.pointMarkerMesh.userData.targetScale || { x: 1, y: 1, z: 1 };

        this.pointMarkerMesh.scale.set(
            target.x * factor,
            target.y * factor,
            target.z * factor
        );
    }

    // Dispose
    dispose() {
        cancelAnimationFrame(this.animationFrameId);
        this.meshes.forEach((_, id) => this.removeMesh(id));
        this.pointSprites.forEach((_, id) => this.removePoint(id));
        this.removePointMarkerMesh();
        this.renderer.dispose();
        if (this.controls) this.controls.dispose();
        if (this.boundsHelper) {
            this.scene.remove(this.boundsHelper);
            this.boundsHelper.geometry.dispose();
            this.boundsHelper.material.dispose();
        }
    }
}

// Export
window.MapRenderer = MapRenderer;
