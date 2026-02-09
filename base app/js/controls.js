/* ========================================
   Sirah Maps - Controls & Interaction
   ======================================== */

class InteractionController {
    constructor(renderer) {
        this.renderer = renderer;
        this.canvas = renderer.canvas;

        // Interaction state
        this.isDragging = false;
        this.isRotating = false;
        this.dragStart = { x: 0, y: 0 };

        // Touch state
        this.touches = [];
        this.lastTouchDistance = 0;
        this.lastTouchAngle = 0;

        // Point placement mode
        this.placingPoint = false;

        // Measurement mode
        this.measuring = false;
        this.measurePoints = [];

        this.currentMeasurement = null;
        this.autoSelectEnabled = true;

        // Gizmo mode cycling: translate → scale → rotate
        this.gizmoModes = ['translate', 'scale', 'rotate'];
        this.currentGizmoModeIndex = 0;
        this.snapEnabled = false;

        // Initialize
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

        // Listen to tool changes
        State.on('toolChange', (tool) => this.onToolChange(tool));
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const key = e.key.toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;

            // File operations
            if (ctrl && key === 'n') {
                e.preventDefault();
                UI.newProject();
            }
            if (ctrl && key === 'o') {
                e.preventDefault();
                UI.openProject();
            }
            if (ctrl && key === 's') {
                e.preventDefault();
                if (shift) {
                    UI.saveProjectAs();
                } else {
                    UI.saveProject();
                }
            }
            if (ctrl && key === 'e') {
                e.preventDefault();
                UI.showExportModal();
            }

            // Undo/Redo
            if (ctrl && key === 'z') {
                e.preventDefault();
                if (shift) {
                    State.redo();
                } else {
                    State.undo();
                }
            }
            if (ctrl && key === 'y') {
                e.preventDefault();
                State.redo();
            }
            // Tools - V cycles through gizmo modes
            if (key === 'v') {
                this.cycleGizmoMode();
            }

            // Direct Gizmo Mode Shortcuts (Blender-style)
            if (key === 'g') {
                this.setGizmoMode('translate');
            }
            if (key === 's' && !ctrl) {
                this.setGizmoMode('scale');
            }
            if (key === 'r') {
                this.setGizmoMode('rotate');
            }

            // Axis Constraints (X, Y, Z)
            if (key === 'x') {
                this.setGizmoAxis('X');
            }
            if (key === 'y') {
                this.setGizmoAxis('Y');
            }
            if (key === 'z') {
                this.setGizmoAxis('Z');
            }

            if (key === 'p') State.setTool('add-point');
            if (key === 'u') State.setTool('measure');
            if (key === 'm') UI.showAddMeshModal();
            if (key === 't') UI.showAddTextboxModal();

            // View
            if (key === 'home') {
                e.preventDefault();
                this.renderer.resetCamera();
            }

            // Delete
            if (key === 'delete' || key === 'backspace') {
                if (State.state.selected.id) {
                    UI.deleteSelected();
                }
            }

            // Escape
            if (key === 'escape') {
                this.cancelCurrentAction();
                State.clearSelection();
                UI.closeAllModals();
            }

            // Fullscreen
            if (key === 'f11' || (key === 'f' && !ctrl)) {
                e.preventDefault();
                UI.toggleFullscreen();
            }

            // Ctrl key enables snap while held
            if (e.key === 'Control' && !this.snapEnabled) {
                this.snapEnabled = true;
                this.setGizmoSnap(true);
            }
        });

        // Keyup for snap release
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control' && this.snapEnabled) {
                this.snapEnabled = false;
                this.setGizmoSnap(false);
            }
        });
    }

    onMouseDown(e) {
        this.dragStart = { x: e.clientX, y: e.clientY };

        if (e.button === 0) { // Left button
            this.isDragging = true;
        } else if (e.button === 1) { // Middle button
            this.isRotating = true;

            // Set pivot point to clicked position on mesh
            const position = this.renderer.getMeshPositionAtMouse(e);
            if (position) {
                this.renderer.setPivotPoint(position);
            }
        }
    }

    onMouseMove(e) {
        // Update tooltip for point placement
        if (State.state.activeTool === 'add-point') {
            const tooltip = document.getElementById('point-tooltip');
            const position = this.renderer.getMeshPositionAtMouse(e);

            if (position) {
                tooltip.classList.remove('hidden');
                tooltip.style.left = `${e.clientX}px`;
                tooltip.style.top = `${e.clientY}px`;
            } else {
                tooltip.classList.add('hidden');
            }
        }

        // Hover effects
        if (!this.isDragging && !this.isRotating) {
            this.updateHover(e);
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.isRotating = false;
    }

    onClick(e) {
        const tool = State.state.activeTool;

        // Handle tool-specific clicks
        if (tool === 'add-point') {
            const position = this.renderer.getMeshPositionAtMouse(e);
            if (position) {
                this.placePoint(position);
            }
            return;
        }

        if (tool === 'measure') {
            const position = this.renderer.getMeshPositionAtMouse(e);
            console.log('Measure click - position:', position);
            if (position) {
                this.addMeasurePoint(position);
            } else {
                UI.showToast('warning', 'Miss', 'Click directly on a 3D mesh');
            }
            return;
        }

        if (tool === 'draw-border') {
            const position = this.renderer.getMeshPositionAtMouse(e);
            if (position) {
                this.addBorderPoint(position);
            }
            return;
        }



        // Check for path point click first (if PathAnimations is in editing mode)
        if (window.PathAnimations && PathAnimations.isEditingPath && !PathAnimations.isAddingPoints) {
            const pathPointData = this.checkPathPointClick(e);
            if (pathPointData) {
                PathAnimations.handlePointClick(pathPointData.pathId, pathPointData.pointIndex);
                return;
            }
        }

        // Check for point click
        const pointData = this.renderer.getPointAtMouse(e);
        if (pointData) {
            this.onPointClick(pointData);
            return;
        }

        // Check for border control point click
        const borderPoint = this.checkBorderPointClick(e);
        if (borderPoint) {
            this.renderer.setTransformMode('translate');
            this.renderer.attachTransformControlsToObject(borderPoint);
            return;
        }

        // Check for border click
        const borderData = this.checkBorderClick(e);
        if (borderData) {
            State.select('border', borderData.id);
            // Attach transform controls to the border
            const borderMesh = this.renderer.getBorderMesh(borderData.id);
            if (borderMesh) {
                this.renderer.setTransformMode('translate');
                this.renderer.attachTransformControls(borderMesh);
            }
            return;
        }



        // Select mode - check for mesh click
        if (tool === 'select') {
            // Check Auto-Select flag
            if (!this.autoSelectEnabled) return;

            const meshes = Array.from(this.renderer.meshes.values()).map(m => m.object);
            const intersects = this.renderer.raycast(e, meshes);

            if (intersects.length > 0) {
                // Find which mesh was clicked
                let clickedMesh = intersects[0].object;
                while (clickedMesh.parent && !this.renderer.meshes.has(clickedMesh.userData.id)) {
                    clickedMesh = clickedMesh.parent;
                }

                if (clickedMesh.userData.id) {
                    State.select('mesh', clickedMesh.userData.id);
                }
            } else {
                // Clicked on empty space
                State.clearSelection();
            }
        }
    }

    // Check if a border control point was clicked
    checkBorderPointClick(e) {
        if (!this.renderer.pointGroups) return null;

        const pointMeshes = [];
        this.renderer.pointGroups.forEach(group => {
            pointMeshes.push(...group.children);
        });

        if (pointMeshes.length === 0) return null;

        const intersects = this.renderer.raycast(e, pointMeshes);
        if (intersects.length > 0) {
            return intersects[0].object;
        }
        return null;
    }

    // Check if a border was clicked
    checkBorderClick(e) {
        if (!this.renderer.borders || this.renderer.borders.size === 0) return null;

        const borderMeshes = [];
        this.renderer.borders.forEach((borderObj, id) => {
            // Handle both group and single mesh
            if (borderObj.isGroup) {
                borderObj.traverse(child => {
                    if (child.isMesh) {
                        child.userData.borderId = id;
                        borderMeshes.push(child);
                    }
                });
            } else if (borderObj.isMesh) {
                borderObj.userData.borderId = id;
                borderMeshes.push(borderObj);
            }
        });

        if (borderMeshes.length === 0) return null;

        const intersects = this.renderer.raycast(e, borderMeshes);
        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const borderId = clickedMesh.userData.borderId || clickedMesh.userData.id;
            if (borderId) {
                return { id: borderId };
            }
        }

        return null;
    }



    // Check if a path point was clicked
    checkPathPointClick(e) {
        if (!window.PathAnimations || !PathAnimations.pointMeshes) return null;

        const rect = this.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.renderer.camera);

        const intersects = raycaster.intersectObjects(PathAnimations.pointMeshes);

        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            return {
                pathId: mesh.userData.pathId,
                pointIndex: mesh.userData.pointIndex
            };
        }

        return null;
    }

    onDoubleClick(e) {
        if (State.state.activeTool === 'draw-border') {
            this.finishBorderDrawing(true); // Save on double click
            State.setTool('select');
            return;
        }

        // Focus on clicked point
        const pointData = this.renderer.getPointAtMouse(e);
        if (pointData) {
            this.focusOnPoint(pointData.id);
            return;
        }

        // Focus on clicked position
        const position = this.renderer.getMeshPositionAtMouse(e);
        if (position) {
            this.renderer.animateCameraTo(
                {
                    x: position.x + 20,
                    y: position.y + 20,
                    z: position.z + 20
                },
                position
            );
        }
    }

    onContextMenu(e) {
        // Disable right-click context menu
        e.preventDefault();
        e.stopPropagation();
        // No custom menu shown - just block default browser menu
    }

    onWheel(e) {
        // Zoom is handled by OrbitControls
    }

    // Touch handlers
    onTouchStart(e) {
        e.preventDefault();

        this.touches = Array.from(e.touches);

        if (this.touches.length === 2) {
            this.lastTouchDistance = this.getTouchDistance();
            this.lastTouchAngle = this.getTouchAngle();
        }
    }

    onTouchMove(e) {
        e.preventDefault();

        const currentTouches = Array.from(e.touches);

        if (currentTouches.length === 2) {
            // Pinch zoom
            const distance = this.getTouchDistance(currentTouches);
            const scale = distance / this.lastTouchDistance;
            this.renderer.camera.position.multiplyScalar(1 / scale);
            this.lastTouchDistance = distance;

            // Two-finger rotation
            const angle = this.getTouchAngle(currentTouches);
            const deltaAngle = angle - this.lastTouchAngle;
            // Apply rotation...
            this.lastTouchAngle = angle;
        }

        this.touches = currentTouches;
    }

    onTouchEnd(e) {
        if (e.touches.length === 0) {
            // Check for tap
            if (this.touches.length === 1 && !this.isDragging) {
                const touch = this.touches[0];
                const fakeEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                };
                this.onClick(fakeEvent);
            }
        }

        this.touches = Array.from(e.touches);
    }

    getTouchDistance(touches = this.touches) {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getTouchAngle(touches = this.touches) {
        if (touches.length < 2) return 0;
        return Math.atan2(
            touches[1].clientY - touches[0].clientY,
            touches[1].clientX - touches[0].clientX
        );
    }

    onToolChange(tool) {
        // Update cursor
        this.canvas.style.cursor =
            tool === 'add-point' ? 'crosshair' :
                tool === 'move' ? 'move' :
                    tool === 'measure' ? 'crosshair' :
                        'default';

        // Hide point tooltip if not in add-point mode
        if (tool !== 'add-point') {
            document.getElementById('point-tooltip').classList.add('hidden');
        }

        // Clear measurement if switching away
        if (tool !== 'measure') {
            this.clearMeasurement();
        }

        // Clear border drawing if switching away
        if (tool !== 'draw-border' && this.currentBorder) {
            this._removeTempBorderVisual();
            this.currentBorder = null;
        }

        // Update toolbar UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }

    updateHover(e) {
        // Check for point hover
        const pointData = this.renderer.getPointAtMouse(e);

        if (pointData) {
            this.canvas.style.cursor = 'pointer';
        } else if (State.state.activeTool === 'select') {
            this.canvas.style.cursor = 'default';
        }
    }

    onPointClick(pointData) {
        console.log('Point clicked:', pointData);

        const point = State.findById('points', pointData.id);
        if (!point) return;

        // Handle 3D marker mesh movement (works in both admin and preview modes)
        this.handlePointMarkerMesh(point);

        if (State.state.mode === 'admin') {
            // Select point in admin mode
            State.select('point', pointData.id);
        } else {
            // Open content in preview mode
            console.log('Opening content for point:', pointData.id);

            // Check if clicking same point again (toggle off)
            if (State.state.activePointId === pointData.id) {
                // Hide meshes and clear active point
                if (point.visibilityMeshes && point.visibilityMeshes.length > 0) {
                    this.renderer.toggleMeshesVisibility(point.visibilityMeshes, false);
                }
                if (point.visibilityBorders && point.visibilityBorders.length > 0) {
                    this.renderer.toggleBordersVisibility(point.visibilityBorders, false);
                }
                // Hide the point marker mesh
                this.renderer.hidePointMarker();
                State.state.activePointId = null;
                return;
            }

            // Hide previous point's meshes if any
            if (State.state.activePointId) {
                const prevPoint = State.findById('points', State.state.activePointId);
                if (prevPoint?.visibilityMeshes?.length > 0) {
                    this.renderer.toggleMeshesVisibility(prevPoint.visibilityMeshes, false);
                }
                if (prevPoint?.visibilityBorders?.length > 0) {
                    this.renderer.toggleBordersVisibility(prevPoint.visibilityBorders, false);
                }
            }

            // Show this point's meshes
            if (point.visibilityMeshes && point.visibilityMeshes.length > 0) {
                this.renderer.toggleMeshesVisibility(point.visibilityMeshes, true);
            }
            if (point.visibilityBorders && point.visibilityBorders.length > 0) {
                this.renderer.toggleBordersVisibility(point.visibilityBorders, true);
            }
            State.state.activePointId = pointData.id;

            // Focus camera if point has a camera view
            if (point.cameraView) {
                this.renderer.goToView(point.cameraView);
            }

            // Open content
            if (point.contentId) {
                ContentManager.openContent(pointData.id);
            } else {
                UI.showToast('info', point.name, 'No content assigned to this point');
            }
        }
    }

    // Handle 3D point marker mesh movement
    handlePointMarkerMesh(point) {
        const settings = State.getProject('settings') || {};
        const markerSettings = settings.pointMarkerMesh || {};

        // Check if point marker feature is globally enabled
        if (!markerSettings.enabled) {
            return;
        }

        // Check if this specific point should show the 3D mesh (default: true)
        if (point.show3DMesh === false) {
            return;
        }

        // Get point-specific scale multiplier (default: 1)
        const pointScale = point.meshScale || 1;
        const baseScale = markerSettings.scale || { x: 1, y: 1, z: 1 };

        // Check if marker mesh is loaded
        if (!this.renderer.pointMarkerMesh && markerSettings.data) {
            // Load the mesh first, then move to position
            this.renderer.loadPointMarkerMesh().then(() => {
                // Apply point-specific scale
                if (this.renderer.pointMarkerMesh) {
                    this.renderer.pointMarkerMesh.scale.set(
                        baseScale.x * pointScale,
                        baseScale.y * pointScale,
                        baseScale.z * pointScale
                    );

                    // Apply rotation
                    const pointRotation = point.meshRotation || 0;
                    const baseRotY = markerSettings.rotation?.y || 0;
                    this.renderer.pointMarkerMesh.rotation.y = (baseRotY + pointRotation) * (Math.PI / 180);
                }

                const pos = point.position;
                const liftedY = point.lifted ? (point.liftHeight || 5) : 0;
                this.renderer.movePointMarkerTo({
                    x: pos.x,
                    y: pos.y + liftedY,
                    z: pos.z
                }, true); // Instant for first appearance
            });
        } else if (this.renderer.pointMarkerMesh) {
            // Apply point-specific scale
            this.renderer.pointMarkerMesh.scale.set(
                baseScale.x * pointScale,
                baseScale.y * pointScale,
                baseScale.z * pointScale
            );

            // Apply rotation
            const pointRotation = point.meshRotation || 0;
            const baseRotY = markerSettings.rotation?.y || 0;
            this.renderer.pointMarkerMesh.rotation.y = (baseRotY + pointRotation) * (Math.PI / 180);

            // Move existing mesh to new position with animation
            const pos = point.position;
            const liftedY = point.lifted ? (point.liftHeight || 5) : 0;
            this.renderer.movePointMarkerTo({
                x: pos.x,
                y: pos.y + liftedY,
                z: pos.z
            }, false); // Animate
        }
    }


    focusOnPoint(pointId) {
        const point = State.findById('points', pointId);
        if (!point) return;

        // Use saved camera view if available
        if (point.cameraView) {
            this.renderer.goToView(point.cameraView);
        } else {
            // Animate to point position
            const pos = point.position;
            this.renderer.animateCameraTo(
                { x: pos.x + 15, y: pos.y + 15, z: pos.z + 15 },
                pos
            );
        }
    }

    async placePoint(position) {
        const point = {
            id: Utils.generateId('point'),
            name: `Point ${State.getProject('points').length + 1}`,
            categoryId: null,
            contentId: null,
            contentType: null,
            position: { x: position.x, y: position.y, z: position.z },
            type: '2d',
            lifted: false,
            liftHeight: 5,
            cameraView: null,
            show3DMesh: true,  // Default: show 3D marker mesh on this point
            meshScale: 1,      // Default: use base scale from Project Settings
            style: {
                icon: 'default',
                color: '#00C8FF',
                scale: 1
            }
        };

        State.addToProject('points', point);
        await this.renderer.addPoint(point.id, point);

        // Select the new point
        State.select('point', point.id);

        // Auto-create linked text box with default name
        if (window.UI && UI.syncPointContentName) {
            UI.syncPointContentName(point.id, 'en', point.name);
        }

        // Show toast
        UI.showToast('success', 'Point Added', `"${point.name}" has been placed`);

        // Switch back to select tool
        State.setTool('select');
    }

    addMeasurePoint(position) {
        if (!position) {
            UI.showToast('warning', 'Click on Mesh', 'Please click on the 3D model to place measurement points');
            return;
        }

        // Initialize measurements array if needed
        if (!this.measurements) {
            this.measurements = [];
        }

        // Start new measurement or add to current
        if (!this.currentMeasurement) {
            this.currentMeasurement = {
                id: Utils.generateId('measure'),
                points: [],
                markers: [],
                line: null,
                label: null
            };
        }

        this.currentMeasurement.points.push(position.clone());

        // Create 3D marker
        this.createMeasureMarker3D(position, this.currentMeasurement);

        if (this.currentMeasurement.points.length === 2) {
            // Calculate 3D distance
            const p1 = this.currentMeasurement.points[0];
            const p2 = this.currentMeasurement.points[1];
            const distance3D = p1.distanceTo(p2);

            // Get scale settings
            const settings = State.getProject('settings') || {};
            const scale = settings.scale || { factor: 1, unit: 'meters' };

            // Apply scale factor: internal distance * factor = real distance
            const realDistance = distance3D * scale.factor;
            const unit = scale.unit || 'meters';

            // Draw 3D line and label
            this.drawMeasureLine3D(this.currentMeasurement, realDistance, unit);

            // Store completed measurement
            this.measurements.push(this.currentMeasurement);

            // Show toast
            UI.showToast('info', 'Measurement', `Distance: ${realDistance.toFixed(2)} ${unit}`);

            // Ready for next measurement - reset current but stay in measure mode
            this.currentMeasurement = null;

            // Don't auto-switch to select - stay in measure mode for multiple measurements
            // User can press Escape or click select tool to exit measure mode
        }
    }

    // Create 3D marker on mesh surface
    createMeasureMarker3D(position, measurement) {
        const geometry = new THREE.SphereGeometry(1.5, 16, 16); // Increased from 0.3 to 1.5
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Changed to green for better visibility
            depthTest: false
        });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);
        marker.renderOrder = 1000;
        marker.userData.isMeasureMarker = true;
        marker.userData.measurementId = measurement.id;

        measurement.markers.push(marker);
        this.renderer.scene.add(marker);
    }

    // Draw 3D line between measurement points with label
    drawMeasureLine3D(measurement, distance, unit) {
        const p1 = measurement.points[0];
        const p2 = measurement.points[1];

        // Create line
        const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00, // Green for better visibility
            linewidth: 3,
            depthTest: false
        });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 999;
        line.userData.isMeasureLine = true;
        line.userData.measurementId = measurement.id;

        measurement.line = line;
        this.renderer.scene.add(line);

        // Create 3D text label at midpoint
        const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const labelText = `${distance.toFixed(2)} ${unit}`;

        // Create sprite label
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.roundRect(0, 0, 256, 64, 8);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(midpoint);
        sprite.position.y += 1; // Slightly above line
        sprite.scale.set(8, 2, 1);
        sprite.renderOrder = 1001;
        sprite.userData.isMeasureLabel = true;
        sprite.userData.measurementId = measurement.id;

        measurement.label = sprite;
        this.renderer.scene.add(sprite);
    }

    // Clear all measurements
    clearAllMeasurements() {
        if (!this.measurements) this.measurements = [];

        // Remove all measurement objects from scene
        this.measurements.forEach(m => {
            m.markers.forEach(marker => {
                this.renderer.scene.remove(marker);
                marker.geometry.dispose();
                marker.material.dispose();
            });
            if (m.line) {
                this.renderer.scene.remove(m.line);
                m.line.geometry.dispose();
                m.line.material.dispose();
            }
            if (m.label) {
                this.renderer.scene.remove(m.label);
                m.label.material.map.dispose();
                m.label.material.dispose();
            }
        });

        this.measurements = [];

        // Also clear current incomplete measurement
        this.clearCurrentMeasurement();

        UI.showToast('info', 'Cleared', 'All measurements removed');
    }

    // Clear only the current incomplete measurement (one with just 1 point)
    clearCurrentMeasurement() {
        if (this.currentMeasurement) {
            // Remove markers from scene
            this.currentMeasurement.markers.forEach(marker => {
                this.renderer.scene.remove(marker);
                marker.geometry?.dispose();
                marker.material?.dispose();
            });
            this.currentMeasurement = null;
        }
    }

    // Called when switching away from measure tool - only clears incomplete measurement
    clearMeasurement() {
        this.clearCurrentMeasurement();
    }

    worldToScreen(position) {
        const vector = position.clone();
        vector.project(this.renderer.camera);

        const canvas = this.canvas;
        return {
            x: (vector.x * 0.5 + 0.5) * canvas.clientWidth,
            y: (-vector.y * 0.5 + 0.5) * canvas.clientHeight
        };
    }

    cancelCurrentAction() {
        if (State.state.activeTool === 'add-point') {
            State.setTool('select');
        }

        if (State.state.activeTool === 'measure') {
            this.currentMeasurement = null;
            State.setTool('select');
        }

        if (State.state.activeTool === 'draw-border') {
            this.finishBorderDrawing(false); // Cancel
            State.setTool('select');
            this.renderer.canvas.style.cursor = 'default';
        }

        document.getElementById('point-tooltip').classList.add('hidden');
    }

    // ------------------------------------------------------------------
    // BORDER DRAWING
    // ------------------------------------------------------------------

    startBorderDrawing(name, color = '#FFFF00', width = 3) {
        this.currentBorder = {
            id: Utils.generateId('border'),
            name: name,
            points: [],
            color: color,
            width: width,
            visibleOnLoad: false  // New borders hidden by default
        };
        this.renderer.canvas.style.cursor = 'crosshair';
        UI.showToast('info', 'Drawing Started', 'Click to add points. Press Save when done.');
    }

    addBorderPoint(position) {
        if (!this.currentBorder) return;

        this.currentBorder.points.push({ x: position.x, y: position.y, z: position.z });

        // Update visual
        this._updateTempBorderVisual();

        // Update point counter in toolbar
        const counter = document.getElementById('bdt-point-count');
        if (counter) {
            counter.textContent = `${this.currentBorder.points.length} points`;
        }

        // Enable save button if enough points
        const saveBtn = document.getElementById('bdt-save-btn');
        if (saveBtn) {
            saveBtn.disabled = this.currentBorder.points.length < 3;
        }
    }

    finishBorderDrawing(save = true) {
        if (!this.currentBorder) return;

        if (save && this.currentBorder.points.length >= 3) {
            State.addToProject('borders', this.currentBorder);

            // Create permanent visual via Renderer
            this.renderer.addBorder(this.currentBorder);

            UI.showToast('success', 'Border Saved');
            UI.updateBordersList();
        } else if (save) {
            UI.showToast('warning', 'Cancelled', 'Need at least 3 points for a border');
        }

        this._removeTempBorderVisual();
        this.currentBorder = null;

        // Hide drawing toolbar
        document.getElementById('border-drawing-toolbar')?.classList.add('hidden');
        this.renderer.canvas.style.cursor = 'default';
    }

    _updateTempBorderVisual() {
        const color = this.currentBorder?.color || '#FFFF00';

        if (!this.tempBorderLine) {
            const material = new THREE.LineBasicMaterial({ color: color });
            const geometry = new THREE.BufferGeometry();
            this.tempBorderLine = new THREE.Line(geometry, material);
            this.renderer.scene.add(this.tempBorderLine);
        } else {
            // Update color if changed
            this.tempBorderLine.material.color.set(color);
        }

        const vertices = [];
        this.currentBorder.points.forEach(p => vertices.push(p.x, p.y, p.z));
        this.tempBorderLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    }

    _removeTempBorderVisual() {
        if (this.tempBorderLine) {
            this.renderer.scene.remove(this.tempBorderLine);
            this.tempBorderLine.geometry.dispose();
            this.tempBorderLine.material.dispose();
            this.tempBorderLine = null;
        }
    }

    // Cycle through gizmo modes: translate → scale → rotate
    cycleGizmoMode() {
        const wasSelect = State.state.activeTool === 'select';

        // Set to select tool first
        State.setTool('select');

        if (wasSelect) {
            // Cycle to next mode
            this.currentGizmoModeIndex = (this.currentGizmoModeIndex + 1) % this.gizmoModes.length;
        } else {
            // Reset to Move mode when switching from another tool
            this.currentGizmoModeIndex = 0;
        }

        const newMode = this.gizmoModes[this.currentGizmoModeIndex];

        // Set the transform mode on renderer
        this.renderer.setTransformMode(newMode);

        // If a mesh is already selected, make sure transform controls are attached
        const selected = State.state.selected;
        if (selected.type === 'mesh' && selected.id) {
            this.renderer.attachTransformControls(selected.id);
        }

        // Update toolbar button to show current mode
        this.updateGizmoToolbarButton(newMode);

        // Show toast with current mode
        const modeNames = {
            'translate': 'Move',
            'scale': 'Scale',
            'rotate': 'Rotate'
        };
        UI.showToast('info', 'Gizmo Mode', `${modeNames[newMode]} (Press V to cycle)`);
    }

    // Update toolbar button visual to reflect current gizmo mode
    updateGizmoToolbarButton(mode) {
        const selectBtn = document.querySelector('.tool-btn[data-tool="select"]');
        if (!selectBtn) return;

        // Update button title
        const modeNames = {
            'translate': 'Move Mode (V)',
            'scale': 'Scale Mode (V)',
            'rotate': 'Rotate Mode (V)'
        };
        selectBtn.title = modeNames[mode] || 'Select (V)';

        // Update icon based on mode
        const icons = {
            'translate': `<svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M13 6v5h5V7.75L22.25 12 18 16.25V13h-5v5h3.25L12 22.25 7.75 18H11v-5H6v3.25L1.75 12 6 7.75V11h5V6H7.75L12 1.75 16.25 6H13z"/>
            </svg>`,
            'scale': `<svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/>
            </svg>`,
            'rotate': `<svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            </svg>`
        };

        selectBtn.innerHTML = icons[mode] || icons['translate'];
        selectBtn.classList.add('active');
    }

    // Set gizmo mode directly (G=translate, S=scale, R=rotate)
    setGizmoMode(mode) {
        // Set to select tool first
        State.setTool('select');

        // Update index to match mode
        const modeIndex = this.gizmoModes.indexOf(mode);
        if (modeIndex !== -1) {
            this.currentGizmoModeIndex = modeIndex;
        }

        // Set the transform mode on renderer
        this.renderer.setTransformMode(mode);

        // If a mesh is already selected, make sure transform controls are attached
        const selected = State.state.selected;
        if (selected.type === 'mesh' && selected.id) {
            this.renderer.attachTransformControls(selected.id);
        }

        // Update toolbar button
        this.updateGizmoToolbarButton(mode);

        // Show toast
        const modeNames = {
            'translate': 'Move (G)',
            'scale': 'Scale (S)',
            'rotate': 'Rotate (R)'
        };
        UI.showToast('info', 'Gizmo Mode', modeNames[mode]);
    }

    // Set gizmo axis constraint (X, Y, Z)
    setGizmoAxis(axis) {
        if (!this.renderer.transformControls) return;

        const tc = this.renderer.transformControls;
        const currentAxis = tc.axis;

        // Toggle: if same axis pressed again, show all axes
        if (currentAxis === axis) {
            tc.showX = true;
            tc.showY = true;
            tc.showZ = true;
            UI.showToast('info', 'Axis', 'All Axes');
        } else {
            // Constrain to specific axis
            tc.showX = (axis === 'X');
            tc.showY = (axis === 'Y');
            tc.showZ = (axis === 'Z');

            const axisColors = {
                'X': '🔴 X-Axis (Red)',
                'Y': '🟢 Y-Axis (Green)',
                'Z': '🔵 Z-Axis (Blue)'
            };
            UI.showToast('info', 'Axis Locked', axisColors[axis]);
        }
    }

    // Enable/disable snap to grid
    setGizmoSnap(enabled, snapValue = 1) {
        if (!this.renderer.transformControls) return;

        const tc = this.renderer.transformControls;
        if (enabled) {
            tc.setTranslationSnap(snapValue);
            tc.setRotationSnap(THREE.MathUtils.degToRad(15)); // 15 degree snap
            tc.setScaleSnap(0.1);
            UI.showToast('info', 'Snap', 'Grid Snap ON');
        } else {
            tc.setTranslationSnap(null);
            tc.setRotationSnap(null);
            tc.setScaleSnap(null);
            UI.showToast('info', 'Snap', 'Grid Snap OFF');
        }
    }

}

// Export
window.InteractionController = InteractionController;
