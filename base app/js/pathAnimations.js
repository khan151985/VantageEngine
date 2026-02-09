/**
 * Path Animation Module for Sirah Maps Admin Dashboard
 * Handles creation, editing, and preview of path-based animations
 */

const PathAnimations = {
    // State
    paths: [],
    selectedPathId: null,
    selectedPointIndex: null,
    isEditingPath: false,
    isAddingPoints: false,
    previewActive: false,

    // Three.js objects
    pathGroup: null,
    pointMeshes: [],
    pathLines: [],
    gizmo: null,
    previewMeshes: [],
    previewAnimationId: null,

    // Audio
    audioContext: null,
    testAudio: null,

    // Constants
    POINT_COLORS: {
        start: 0xFFA500,    // Orange
        waypoint: 0x00FF00, // Green
        end: 0xFF0000,      // Red
        selected: 0x00FFFF, // Cyan
        hover: 0xFFFF00     // Yellow
    },
    POINT_SIZE: 0.8,
    LINE_COLOR: 0xFFFFFF,
    SNAP_DISTANCE: 1.0,

    /**
     * Initialize the Path Animation system
     */
    init() {
        console.log('PathAnimations: Initializing...');

        // Create container group for all path visualizations
        this.pathGroup = new THREE.Group();
        this.pathGroup.name = 'PathAnimationsGroup';

        // Add to scene if Renderer is ready
        if (window.Renderer && Renderer.scene) {
            Renderer.scene.add(this.pathGroup);
            console.log('PathAnimations: Added to scene');
        } else {
            console.warn('PathAnimations: Renderer not ready, will retry');
            // Retry after a delay
            setTimeout(() => {
                if (window.Renderer && Renderer.scene && !this.pathGroup.parent) {
                    Renderer.scene.add(this.pathGroup);
                    console.log('PathAnimations: Added to scene (delayed)');
                }
            }, 1000);
        }

        // Initialize TransformControls (gizmo) - may not be available
        this.initGizmo();

        // Setup event listeners
        this.setupEventListeners();

        // Load existing paths from state
        this.loadFromState();

        console.log('PathAnimations: Initialized');
    },

    /**
     * Initialize the transform gizmo
     */
    initGizmo() {
        if (!window.Renderer || !Renderer.camera || !Renderer.renderer) {
            console.warn('PathAnimations: Renderer not ready for gizmo');
            return;
        }

        // Check if TransformControls is available
        if (typeof THREE.TransformControls === 'undefined') {
            console.warn('PathAnimations: TransformControls not available');
            return;
        }

        try {
            // Create TransformControls
            this.gizmo = new THREE.TransformControls(Renderer.camera, Renderer.renderer.domElement);
            this.gizmo.setMode('translate');
            this.gizmo.setSize(0.8);

            // Add to scene
            Renderer.scene.add(this.gizmo);

            // Handle gizmo dragging - disable orbit controls
            this.gizmo.addEventListener('dragging-changed', (event) => {
                if (Renderer.controls) {
                    Renderer.controls.enabled = !event.value;
                }
            });

            // Handle gizmo changes
            this.gizmo.addEventListener('change', () => {
                if (this.selectedPathId !== null && this.selectedPointIndex !== null) {
                    this.updateSelectedPointPosition();
                }
            });

            // Initially hidden
            this.gizmo.visible = false;
            console.log('PathAnimations: Gizmo initialized');
        } catch (err) {
            console.warn('PathAnimations: Could not create gizmo:', err);
        }
    },

    /**
     * Setup event listeners for path editing
     */
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.isEditingPath) return;

            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    if (this.selectedPointIndex !== null) {
                        e.preventDefault();
                        this.deleteSelectedPoint();
                    }
                    break;
                case 'Escape':
                    this.deselectPoint();
                    break;
                case 'w':
                case 'W':
                    if (this.gizmo) this.gizmo.setMode('translate');
                    break;
            }
        });

        // Listen for project load event to reload paths
        if (window.State) {
            State.on('projectLoad', () => {
                console.log('PathAnimations: Project loaded, reloading paths...');
                this.loadFromState();
            });

            State.on('projectNew', () => {
                console.log('PathAnimations: New project, clearing paths...');
                this.paths = [];
                this.clearAllPathVisualization();
            });
        }
    },

    /**
     * Load paths from project state
     */
    loadFromState() {
        // Clear any existing path visualizations first
        this.clearAllPathVisualization();

        const project = State.getProject();
        if (project && project.pathAnimations && project.pathAnimations.length > 0) {
            // Migrate old project data - add default values for new properties
            this.paths = project.pathAnimations.map(path => {
                // Ensure all required properties exist with defaults
                return {
                    id: path.id,
                    name: path.name || 'Path',
                    enabled: path.enabled !== false,
                    points: path.points || [],
                    pathType: path.pathType || 'bezier',
                    curveTension: path.curveTension ?? 0.5,
                    isLooping: path.isLooping || false,
                    snapDistance: path.snapDistance ?? this.SNAP_DISTANCE,

                    // NEW: Point placement options (for old projects)
                    targetSurfaceId: path.targetSurfaceId || null,
                    forceYHeight: path.forceYHeight, // Can be undefined

                    mesh: {
                        id: path.mesh?.id || null,
                        filename: path.mesh?.filename || null,
                        orientToPath: path.mesh?.orientToPath !== false,
                        rotationOffset: path.mesh?.rotationOffset || { x: 0, y: 90, z: 0 },
                        spread: path.mesh?.spread || 0
                    },
                    motion: {
                        speed: path.motion?.speed ?? 2.5
                    },
                    spawning: {
                        maxOnScreen: path.spawning?.maxOnScreen ?? 1,
                        spawnDelay: path.spawning?.spawnDelay ?? 5,
                        initialDelay: path.spawning?.initialDelay ?? 0
                    },
                    pathSound: path.pathSound || {
                        enabled: false,
                        url: null,
                        volume: 0.5,
                        range: 10
                    },
                    trigger: path.trigger || {
                        type: 'startup',
                        targetId: null
                    }
                };
            });

            console.log('PathAnimations: Loaded', this.paths.length, 'paths from project state');
            this.renderAllPaths();
        } else {
            console.log('PathAnimations: No paths in project state');
            this.paths = [];
        }
    },

    /**
     * Clear all path visualizations from the scene
     */
    clearAllPathVisualization() {
        // Remove all children from pathGroup
        while (this.pathGroup.children.length > 0) {
            const child = this.pathGroup.children[0];
            this.pathGroup.remove(child);
            // Dispose geometry and materials
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
        console.log('PathAnimations: Cleared all path visualizations');
    },

    /**
     * Save paths to project state
     */
    saveToState() {
        State.setProject('pathAnimations', this.paths);
    },

    /**
     * Create a new path
     */
    createPath(name = 'New Path') {
        const path = {
            id: 'path_' + Date.now(),
            name: name,
            enabled: true,
            points: [],
            pathType: 'bezier',        // 'bezier' | 'linear'
            curveTension: 0.5,
            isLooping: false,
            snapDistance: this.SNAP_DISTANCE,
            mesh: {
                id: null,
                filename: null,
                orientToPath: true,
                rotationOffset: { x: 0, y: 90, z: 0 }
            },
            motion: {
                speed: 2.5
            },
            spawning: {
                maxOnScreen: 1,
                spawnDelay: 5,
                initialDelay: 0
            },
            pathSound: {
                enabled: false,
                source: 'url',
                url: '',
                data: null,
                volume: 0.7,
                range: 20,
                loop: true
            },
            trigger: {
                type: 'startup',
                targetId: null
            }
        };

        this.paths.push(path);
        this.saveToState();

        // Update UI list first so the item exists
        if (window.UI) UI.updatePathList();

        this.selectPath(path.id);

        return path;
    },

    /**
     * Delete a path
     */
    deletePath(pathId) {
        const index = this.paths.findIndex(p => p.id === pathId);
        if (index !== -1) {
            // Clear visualization
            this.clearPathVisualization(pathId);

            // Remove from array
            this.paths.splice(index, 1);
            this.saveToState();

            // Deselect if it was selected
            if (this.selectedPathId === pathId) {
                this.selectedPathId = null;
                this.selectedPointIndex = null;
                this.isEditingPath = false;
            }

            // Update UI
            UI.updatePathList();
        }
    },

    /**
     * Select a path for editing
     */
    selectPath(pathId) {
        this.selectedPathId = pathId;
        this.selectedPointIndex = null;
        this.isEditingPath = true;

        // Highlight selected path
        this.renderAllPaths();

        // Update UI
        UI.showPathProperties(pathId);
    },

    /**
     * Get selected path
     */
    getSelectedPath() {
        if (!this.selectedPathId) return null;
        return this.paths.find(p => p.id === this.selectedPathId);
    },

    /**
     * Start adding points mode
     */
    startAddingPoints() {
        if (!this.selectedPathId) return;

        this.isAddingPoints = true;
        document.body.style.cursor = 'crosshair';

        // Setup canvas click handler
        const canvas = Renderer.renderer.domElement;
        this._addPointHandler = (e) => this.handleCanvasClickForPoint(e);
        canvas.addEventListener('click', this._addPointHandler);

        UI.showToast('info', 'Click on the 3D canvas to add path points. Press ESC to finish.');
    },

    /**
     * Stop adding points mode
     */
    stopAddingPoints() {
        this.isAddingPoints = false;
        document.body.style.cursor = 'default';

        // Remove click handler
        const canvas = Renderer.renderer.domElement;
        if (this._addPointHandler) {
            canvas.removeEventListener('click', this._addPointHandler);
            this._addPointHandler = null;
        }

        // Check for loop
        this.checkForLoop();
    },

    /**
     * Handle canvas click to add a point
     */
    handleCanvasClickForPoint(event) {
        console.log('handleCanvasClickForPoint called', {
            isAddingPoints: this.isAddingPoints,
            selectedPathId: this.selectedPathId
        });

        if (!this.isAddingPoints || !this.selectedPathId) {
            console.log('Not in add points mode or no path selected');
            return;
        }

        const path = this.getSelectedPath();
        if (!path) {
            console.warn('Selected path not found');
            return;
        }

        // Raycast to find position
        const canvas = Renderer.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, Renderer.camera);

        // Check if a specific target surface is selected
        const targetSurfaceId = path.targetSurfaceId;
        let meshes = [];

        if (targetSurfaceId) {
            // Use ONLY the selected target surface mesh
            console.log('Using target surface mesh:', targetSurfaceId);
            const targetMeshData = Renderer.meshes?.get(targetSurfaceId);
            if (targetMeshData && targetMeshData.object) {
                // Add the target mesh and all its children
                targetMeshData.object.traverse(child => {
                    if (child.isMesh) {
                        meshes.push(child);
                    }
                });
                console.log('Target mesh has', meshes.length, 'child meshes');
            } else {
                console.warn('Target surface mesh not found in renderer!');
            }
        } else {
            // Fall back to finding visible meshes (original behavior)
            Renderer.scene.traverse((child) => {
                // Skip non-mesh objects
                if (!child.isMesh) return;

                // Skip invisible objects
                if (!child.visible) return;

                // Skip path visualization objects
                if (child.name === 'PathPoint' ||
                    child.name.startsWith('PathLine') ||
                    child.name.startsWith('PathInstance')) return;

                // Skip helper objects (camera bounds, grid, etc.)
                if (child.userData?.isHelper ||
                    child.userData?.boundsHelper ||
                    child.userData?.measureMarker ||
                    child.userData?.measureLine) return;

                // Skip objects with helper-like names
                if (child.name.includes('Helper') ||
                    child.name.includes('Bounds') ||
                    child.name.includes('Grid') ||
                    child.name === 'CameraBoundsHelper') return;

                // Skip Line objects (like Box3Helper edges)
                if (child.isLine || child.isLineSegments) return;

                // Check if any parent is hidden
                let isParentVisible = true;
                let parent = child.parent;
                while (parent) {
                    if (parent.visible === false) {
                        isParentVisible = false;
                        break;
                    }
                    // Also skip if parent is a helper
                    if (parent.userData?.isHelper || parent.userData?.boundsHelper) {
                        isParentVisible = false;
                        break;
                    }
                    parent = parent.parent;
                }

                if (isParentVisible) {
                    meshes.push(child);
                }
            });
        }

        // Now do the raycast with whatever meshes we collected
        console.log('Raycasting against', meshes.length, 'meshes');

        let intersects = raycaster.intersectObjects(meshes, true);

        // If no mesh hit, try raycasting against a virtual ground plane at Y=0
        if (intersects.length === 0) {
            console.log('No mesh hit, trying ground plane at Y=0...');

            // Create virtual ground plane for raycasting
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();

            if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
                console.log('Ground plane hit at', intersection);
                // Apply forceYHeight if set
                if (path.forceYHeight !== undefined) {
                    intersection.y = path.forceYHeight;
                }
                this.addPoint(path.id, intersection);
                return;
            }
        }

        if (intersects.length > 0) {
            const point = intersects[0].point.clone();
            console.log('Hit mesh at', point);

            // Apply forceYHeight if set
            if (path.forceYHeight !== undefined) {
                point.y = path.forceYHeight;
                console.log('Forced Y to', path.forceYHeight);
            }

            this.addPoint(path.id, point);
        } else {
            console.log('No intersection found');
            // Show a helpful message
            if (window.UI) {
                UI.showToast('warning', 'No Surface Detected', 'Select a Target Surface mesh or enable Force Y Height');
            }
        }
    },

    /**
     * Add a point to a path
     */
    addPoint(pathId, position, index = -1) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path) {
            console.warn('PathAnimations: Path not found:', pathId);
            return;
        }

        console.log('PathAnimations: Adding point to path', pathId, 'at', position);

        const point = {
            id: 'pt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            sound: null
        };

        if (index === -1) {
            path.points.push(point);
        } else {
            path.points.splice(index, 0, point);
        }

        this.saveToState();
        this.renderPath(pathId);
        this.checkForLoop();

        // Update UI - points list and path list item
        if (window.UI) {
            // Force update with slight delay to ensure state and DOM are ready
            setTimeout(() => {
                UI.updatePathPointsList(pathId);
                UI.updatePathList();
            }, 10);
        }

        console.log('PathAnimations: Point added, total points:', path.points.length);

        return point;
    },

    /**
     * Delete a point from a path
     */
    deletePoint(pathId, pointIndex) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path || pointIndex < 0 || pointIndex >= path.points.length) return;

        path.points.splice(pointIndex, 1);

        // Deselect if this was selected
        if (this.selectedPointIndex === pointIndex) {
            this.deselectPoint();
        } else if (this.selectedPointIndex > pointIndex) {
            this.selectedPointIndex--;
        }

        this.saveToState();
        this.renderPath(pathId);
        this.checkForLoop();

        // Update UI
        UI.updatePathPointsList(pathId);
    },

    /**
     * Delete currently selected point
     */
    deleteSelectedPoint() {
        if (this.selectedPathId && this.selectedPointIndex !== null) {
            this.deletePoint(this.selectedPathId, this.selectedPointIndex);
        }
    },

    /**
     * Select a point for editing
     */
    selectPoint(pathId, pointIndex) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path || pointIndex < 0 || pointIndex >= path.points.length) return;

        this.selectedPathId = pathId;
        this.selectedPointIndex = pointIndex;

        // Attach gizmo to point mesh
        const pointMesh = this.pointMeshes.find(pm =>
            pm.userData.pathId === pathId && pm.userData.pointIndex === pointIndex
        );

        // Initialize gizmo if missing/failed previously
        if (!this.gizmo) {
            this.initGizmo();
        }

        if (pointMesh && this.gizmo) {
            this.gizmo.attach(pointMesh);
            this.gizmo.visible = true;
        }

        // Update visualization
        this.renderPath(pathId);

        // Update UI
        UI.showPointProperties(pathId, pointIndex);
    },

    /**
     * Deselect current point
     */
    deselectPoint() {
        this.selectedPointIndex = null;

        if (this.gizmo) {
            this.gizmo.detach();
            this.gizmo.visible = false;
        }

        // Update visualization
        if (this.selectedPathId) {
            this.renderPath(this.selectedPathId);
        }

        // Hide point edit panel directly (avoid circular call with UI.hidePointProperties)
        const panel = document.getElementById('point-edit-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    },

    /**
     * Update selected point position from gizmo
     */
    updateSelectedPointPosition() {
        if (!this.selectedPathId || this.selectedPointIndex === null) return;

        const path = this.getSelectedPath();
        if (!path) return;

        const pointMesh = this.pointMeshes.find(pm =>
            pm.userData.pathId === this.selectedPathId &&
            pm.userData.pointIndex === this.selectedPointIndex
        );

        if (pointMesh) {
            const point = path.points[this.selectedPointIndex];
            point.position.x = pointMesh.position.x;
            point.position.y = pointMesh.position.y;
            point.position.z = pointMesh.position.z;

            this.saveToState();
            this.renderPath(this.selectedPathId);

            // Update UI position fields
            UI.updatePointPositionFields(point.position);
        }
    },

    /**
     * Update point position from UI input
     */
    updatePointPosition(pathId, pointIndex, axis, value) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path || pointIndex < 0 || pointIndex >= path.points.length) return;

        path.points[pointIndex].position[axis] = parseFloat(value) || 0;

        this.saveToState();
        this.renderPath(pathId);
        this.checkForLoop();
    },

    /**
     * Move point up in order
     */
    movePointUp(pathId, pointIndex) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path || pointIndex <= 0) return;

        const temp = path.points[pointIndex];
        path.points[pointIndex] = path.points[pointIndex - 1];
        path.points[pointIndex - 1] = temp;

        if (this.selectedPointIndex === pointIndex) {
            this.selectedPointIndex--;
        }

        this.saveToState();
        this.renderPath(pathId);
        UI.updatePathPointsList(pathId);
    },

    /**
     * Move point down in order
     */
    movePointDown(pathId, pointIndex) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path || pointIndex >= path.points.length - 1) return;

        const temp = path.points[pointIndex];
        path.points[pointIndex] = path.points[pointIndex + 1];
        path.points[pointIndex + 1] = temp;

        if (this.selectedPointIndex === pointIndex) {
            this.selectedPointIndex++;
        }

        this.saveToState();
        this.renderPath(pathId);
        UI.updatePathPointsList(pathId);
    },

    /**
     * Check if path should be looping (first and last points close)
     */
    checkForLoop() {
        const path = this.getSelectedPath();
        if (!path || path.points.length < 3) {
            if (path) path.isLooping = false;
            return;
        }

        const first = path.points[0].position;
        const last = path.points[path.points.length - 1].position;

        const distance = Math.sqrt(
            Math.pow(first.x - last.x, 2) +
            Math.pow(first.y - last.y, 2) +
            Math.pow(first.z - last.z, 2)
        );

        path.isLooping = distance <= path.snapDistance;

        this.saveToState();
        UI.updateLoopStatus(path.isLooping);
    },

    /**
     * Update path property
     */
    updatePathProperty(pathId, property, value) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path) return;

        // Handle nested properties like 'motion.speed'
        const parts = property.split('.');
        let obj = path;
        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;

        this.saveToState();

        // Re-render if path type changed
        if (property === 'pathType' || property === 'curveTension') {
            this.renderPath(pathId);
        }
    },

    /**
     * Render all paths
     */
    renderAllPaths() {
        // Clear existing
        this.clearAllVisualizations();

        // Render each path
        this.paths.forEach(path => {
            this.renderPath(path.id);
        });
    },

    /**
     * Render a single path
     */
    renderPath(pathId) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path) {
            console.warn('renderPath: path not found', pathId);
            return;
        }

        console.log('renderPath:', pathId, 'points:', path.points.length);

        // Ensure pathGroup is in scene
        if (this.pathGroup && !this.pathGroup.parent && window.Renderer && Renderer.scene) {
            Renderer.scene.add(this.pathGroup);
            console.log('renderPath: Added pathGroup to scene');
        }

        // Clear existing visualization for this path
        this.clearPathVisualization(pathId);

        if (path.points.length === 0) return;

        // Create point meshes
        path.points.forEach((point, index) => {
            const isStart = index === 0;
            const isEnd = index === path.points.length - 1 && !path.isLooping;
            const isSelected = this.selectedPathId === pathId && this.selectedPointIndex === index;

            let color = this.POINT_COLORS.waypoint;
            if (isStart) color = this.POINT_COLORS.start;
            else if (isEnd) color = this.POINT_COLORS.end;
            if (isSelected) color = this.POINT_COLORS.selected;

            const geometry = new THREE.SphereGeometry(this.POINT_SIZE, 16, 16);
            const material = new THREE.MeshBasicMaterial({ color: color, depthTest: false, transparent: true });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(point.position.x, point.position.y, point.position.z);
            mesh.renderOrder = 9999; // Always on top
            mesh.name = 'PathPoint';
            mesh.userData = { pathId: pathId, pointIndex: index, pointId: point.id };

            this.pathGroup.add(mesh);
            this.pointMeshes.push(mesh);
        });

        console.log('renderPath: Created', path.points.length, 'point meshes');

        // Create path line
        if (path.points.length >= 2) {
            const linePoints = this.calculatePathPoints(path);
            const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
            const material = new THREE.LineBasicMaterial({
                color: this.LINE_COLOR,
                linewidth: 2,
                depthTest: false,
                transparent: true
            });
            const line = new THREE.Line(geometry, material);
            line.renderOrder = 9998; // Just below points
            line.name = 'PathLine_' + pathId;
            line.userData = { pathId: pathId };

            this.pathGroup.add(line);
            this.pathLines.push(line);
            console.log('renderPath: Created path line');
        }
    },

    /**
     * Calculate interpolated path points for visualization
     */
    calculatePathPoints(path, segments = 50) {
        if (path.points.length < 2) return [];

        const positions = path.points.map(p =>
            new THREE.Vector3(p.position.x, p.position.y, p.position.z)
        );

        if (path.pathType === 'linear') {
            return positions;
        }

        // Bezier/Catmull-Rom spline
        let curvePoints = [...positions];

        // If looping, add first point at end for smooth loop
        if (path.isLooping && curvePoints.length >= 3) {
            curvePoints.push(curvePoints[0].clone());
        }

        const curve = new THREE.CatmullRomCurve3(curvePoints, path.isLooping, 'catmullrom', path.curveTension);

        return curve.getPoints(segments);
    },

    /**
     * Clear visualization for a specific path
     */
    clearPathVisualization(pathId) {
        // Remove point meshes
        this.pointMeshes = this.pointMeshes.filter(mesh => {
            if (mesh.userData.pathId === pathId) {
                this.pathGroup.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                return false;
            }
            return true;
        });

        // Remove path lines
        this.pathLines = this.pathLines.filter(line => {
            if (line.userData.pathId === pathId) {
                this.pathGroup.remove(line);
                line.geometry.dispose();
                line.material.dispose();
                return false;
            }
            return true;
        });
    },

    /**
     * Clear all visualizations
     */
    clearAllVisualizations() {
        this.pointMeshes.forEach(mesh => {
            this.pathGroup.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.pointMeshes = [];

        this.pathLines.forEach(line => {
            this.pathGroup.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        });
        this.pathLines = [];
    },

    /**
     * Handle point mesh click in 3D view
     */
    handlePointClick(pathId, pointIndex) {
        if (this.isAddingPoints) return;

        this.selectPath(pathId);
        this.selectPoint(pathId, pointIndex);
    },

    /**
     * Snap point to ground/mesh surface
     */
    snapPointToGround(pathId, pointIndex) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path || pointIndex < 0 || pointIndex >= path.points.length) return;

        const point = path.points[pointIndex];
        const position = new THREE.Vector3(point.position.x, point.position.y + 100, point.position.z);

        const raycaster = new THREE.Raycaster();
        raycaster.set(position, new THREE.Vector3(0, -1, 0));

        const meshes = [];
        Renderer.scene.traverse((child) => {
            if (child.isMesh && child.name !== 'PathPoint' && !child.name.startsWith('PathLine')) {
                meshes.push(child);
            }
        });

        const intersects = raycaster.intersectObjects(meshes, true);

        if (intersects.length > 0) {
            point.position.y = intersects[0].point.y + 0.1; // Slight offset above surface
            this.saveToState();
            this.renderPath(pathId);
            UI.updatePointPositionFields(point.position);
        }
    },

    /**
     * Set point sound
     */
    setPointSound(pathId, pointIndex, soundData) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path || pointIndex < 0 || pointIndex >= path.points.length) return;

        path.points[pointIndex].sound = soundData;
        this.saveToState();
    },

    /**
     * Set path sound
     */
    setPathSound(pathId, soundData) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path) return;

        path.pathSound = { ...path.pathSound, ...soundData };
        this.saveToState();
    },

    /**
     * Test/preview a sound
     */
    testSound(soundData) {
        if (!soundData) return;

        if (this.testAudio) {
            this.testAudio.pause();
            this.testAudio = null;
        }

        let src = '';
        if (soundData.source === 'url' && soundData.url) {
            src = soundData.url;
        } else if (soundData.data) {
            src = soundData.data;
        }

        if (src) {
            this.testAudio = new Audio(src);
            this.testAudio.volume = soundData.volume || 0.7;
            this.testAudio.play().catch(err => console.log('Sound test failed:', err));
        }
    },

    /**
     * Preview animation
     */
    startPreview(pathId) {
        console.log('=== START PREVIEW ===');
        console.log('pathId:', pathId);

        const path = this.paths.find(p => p.id === pathId);
        console.log('path found:', !!path);

        if (!path || path.points.length < 2) {
            UI.showToast('error', 'Path needs at least 2 points');
            console.log('Error: Not enough points, have:', path?.points?.length);
            return;
        }
        console.log('Points count:', path.points.length);

        if (!path.mesh.id) {
            UI.showToast('error', 'Please assign a mesh to this path');
            console.log('Error: No mesh assigned');
            return;
        }
        console.log('Mesh ID:', path.mesh.id);

        this.stopPreview();
        this.previewActive = true;

        // Find the mesh in the scene
        const meshTemplate = Renderer.meshes.get(path.mesh.id);
        console.log('Mesh template found:', !!meshTemplate);

        if (!meshTemplate) {
            UI.showToast('error', 'Mesh not found in scene');
            console.log('Error: Mesh not in Renderer.meshes');
            console.log('Available meshes:', Array.from(Renderer.meshes.keys()));
            return;
        }

        // Clone mesh for preview (fix: access .object property)
        if (!meshTemplate.object) {
            UI.showToast('error', 'Mesh object is invalid');
            console.log('Error: meshTemplate.object is null/undefined');
            return;
        }

        // Get density (number of instances)
        const density = path.spawning?.maxOnScreen || 1;
        const spread = path.mesh?.spread || 0;
        console.log('Creating', density, 'mesh instances with spread', spread);

        // Create multiple mesh instances based on density
        for (let i = 0; i < density; i++) {
            const previewMesh = meshTemplate.object.clone();
            previewMesh.visible = true;
            // Force all children to be visible
            previewMesh.traverse(child => {
                child.visible = true;
            });
            previewMesh.name = 'PreviewMesh_' + i;
            Renderer.scene.add(previewMesh);

            // Stagger starting positions evenly along the path
            const startProgress = i / density;

            // Random lateral offset for spread (left/right deviation)
            const lateralOffset = spread > 0 ? (Math.random() - 0.5) * 2 * spread : 0;

            this.previewMeshes.push({
                mesh: previewMesh,
                progress: startProgress,
                path: path,
                lateralOffset: lateralOffset  // Store the offset for this instance
            });
        }

        console.log('Preview meshes added to scene:', this.previewMeshes.length);

        // Start animation loop
        this.animatePreview();

        UI.showToast('success', `Preview started with ${density} instances`);
        console.log('=== PREVIEW STARTED ===');
    },

    /**
     * Animation loop for preview
     */
    animatePreview() {
        if (!this.previewActive) return;

        this.previewMeshes.forEach(pm => {
            const path = pm.path;
            const positions = path.points.map(p =>
                new THREE.Vector3(p.position.x, p.position.y, p.position.z)
            );

            if (positions.length < 2) return;

            // Calculate curve
            let pos, tangent;
            if (path.pathType === 'linear') {
                // For linear, we need to manually interpolate
                const totalLength = this.calculateLinearLength(positions);
                const targetDistance = pm.progress * totalLength;
                pos = this.getLinearPosition(positions, targetDistance);
                tangent = this.getLinearDirection(positions, targetDistance);
            } else {
                // Bezier curve
                let curvePoints = [...positions];
                if (path.isLooping) {
                    curvePoints.push(curvePoints[0].clone());
                }
                const curve = new THREE.CatmullRomCurve3(curvePoints, path.isLooping, 'catmullrom', path.curveTension);
                pos = curve.getPointAt(pm.progress);
                tangent = curve.getTangentAt(pm.progress);
            }

            // Apply lateral offset (perpendicular to path direction)
            if (pm.lateralOffset && pm.lateralOffset !== 0 && tangent) {
                // Get perpendicular vector (cross product with up vector)
                const up = new THREE.Vector3(0, 1, 0);
                const perpendicular = new THREE.Vector3().crossVectors(tangent, up).normalize();
                pos.add(perpendicular.multiplyScalar(pm.lateralOffset));
            }

            pm.mesh.position.copy(pos);

            // Orient to path
            if (path.mesh.orientToPath && tangent) {
                pm.mesh.lookAt(pos.clone().add(tangent));
                pm.mesh.rotateY(THREE.MathUtils.degToRad(path.mesh.rotationOffset?.y || 0));
            }

            // Update progress
            const speed = Math.max(0.1, path.motion.speed || 1);
            const pathLength = path.pathType === 'linear'
                ? this.calculateLinearLength(positions)
                : new THREE.CatmullRomCurve3(positions).getLength();

            pm.progress += (speed / pathLength) * 0.016; // Assuming 60fps

            // Handle loop or end
            if (pm.progress >= 1) {
                if (path.isLooping) {
                    pm.progress = 0;
                } else {
                    pm.progress = 0; // Restart for preview
                }
            }
        });

        this.previewAnimationId = requestAnimationFrame(() => this.animatePreview());
    },

    /**
     * Calculate total length of linear path
     */
    calculateLinearLength(positions) {
        let length = 0;
        for (let i = 1; i < positions.length; i++) {
            length += positions[i].distanceTo(positions[i - 1]);
        }
        return length;
    },

    /**
     * Get position along linear path
     */
    getLinearPosition(positions, targetDistance) {
        let accumulated = 0;
        for (let i = 1; i < positions.length; i++) {
            const segmentLength = positions[i].distanceTo(positions[i - 1]);
            if (accumulated + segmentLength >= targetDistance) {
                const t = (targetDistance - accumulated) / segmentLength;
                return positions[i - 1].clone().lerp(positions[i], t);
            }
            accumulated += segmentLength;
        }
        return positions[positions.length - 1].clone();
    },

    /**
     * Get direction along linear path
     */
    getLinearDirection(positions, targetDistance) {
        let accumulated = 0;
        for (let i = 1; i < positions.length; i++) {
            const segmentLength = positions[i].distanceTo(positions[i - 1]);
            if (accumulated + segmentLength >= targetDistance) {
                return positions[i].clone().sub(positions[i - 1]).normalize();
            }
            accumulated += segmentLength;
        }
        if (positions.length >= 2) {
            return positions[positions.length - 1].clone().sub(positions[positions.length - 2]).normalize();
        }
        return new THREE.Vector3(0, 0, 1);
    },

    /**
     * Stop preview animation
     */
    stopPreview() {
        this.previewActive = false;

        if (this.previewAnimationId) {
            cancelAnimationFrame(this.previewAnimationId);
            this.previewAnimationId = null;
        }

        // Remove preview meshes
        this.previewMeshes.forEach(pm => {
            Renderer.scene.remove(pm.mesh);
        });
        this.previewMeshes = [];
    },

    /**
     * Duplicate a path
     */
    duplicatePath(pathId) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path) return;

        const newPath = JSON.parse(JSON.stringify(path));
        newPath.id = 'path_' + Date.now();
        newPath.name = path.name + ' (Copy)';

        // Generate new point IDs
        newPath.points.forEach(p => {
            p.id = 'pt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        });

        this.paths.push(newPath);
        this.saveToState();
        this.renderPath(newPath.id);

        return newPath;
    },

    /**
     * Show/hide path visualization
     */
    setPathVisibility(visible) {
        if (this.pathGroup) {
            this.pathGroup.visible = visible;
        }
    },

    /**
     * Get all paths for export
     */
    getPathsForExport() {
        return this.paths.map(path => ({
            ...path,
            // Remove any editor-only data
        }));
    },

    /**
     * Cleanup
     */
    dispose() {
        this.stopPreview();
        this.clearAllVisualizations();

        if (this.gizmo) {
            Renderer.scene.remove(this.gizmo);
            this.gizmo.dispose();
        }

        if (this.pathGroup) {
            Renderer.scene.remove(this.pathGroup);
        }
    }
};

// Make globally available
window.PathAnimations = PathAnimations;
