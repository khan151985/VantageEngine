/* ========================================
   Sirah Maps - Points Manager
   ======================================== */

const PointsManager = {
    // Point sprites collection
    sprites: new Map(),
    liftLines: new Map(),

    // Initialize
    init(renderer) {
        this.renderer = renderer;
        this.scene = renderer.scene;
        this.camera = renderer.camera;
    },

    // Create point sprite texture
    createPointTexture(color = '#00C8FF', size = 64) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Clear
        ctx.clearRect(0, 0, size, size);

        // Outer circle with border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner circle (white)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 4, 0, Math.PI * 2);
        ctx.fill();

        return new THREE.CanvasTexture(canvas);
    },

    // Create texture from custom image
    createCustomIconTexture(imageSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');

                // Draw circular clipped image
                ctx.beginPath();
                ctx.arc(32, 32, 30, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();

                // Draw image scaled to fit
                ctx.drawImage(img, 0, 0, 64, 64);

                // Add border
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(32, 32, 30, 0, Math.PI * 2);
                ctx.stroke();

                resolve(new THREE.CanvasTexture(canvas));
            };
            img.onerror = () => {
                // Fallback to default
                resolve(this.createPointTexture('#00C8FF'));
            };
            img.src = imageSrc;
        });
    },

    // Add a point
    async add(id, data) {
        const color = data.style?.color || '#00C8FF';

        // Create texture - custom or default
        let texture;
        if (data.style?.iconType === 'custom' && data.style?.customIcon) {
            texture = await this.createCustomIconTexture(data.style.customIcon);
        } else {
            texture = this.createPointTexture(color);
        }

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            sizeAttenuation: true
        });

        const sprite = new THREE.Sprite(material);
        const scale = 4 * (data.style?.scale || 1);
        sprite.scale.set(scale, scale, 1);

        // Position
        const pos = data.position || { x: 0, y: 0, z: 0 };
        let y = pos.y;
        if (data.lifted) {
            y += data.liftHeight || 5;
        }
        sprite.position.set(pos.x, y, pos.z);

        // Store data
        sprite.userData = { id, type: 'point', data };
        sprite.renderOrder = 10000; // Render on top (Priority High)

        // Force sprite to always render on top by clearing depth before rendering
        sprite.onBeforeRender = function (renderer) {
            renderer.clearDepth();
        };

        this.sprites.set(id, sprite);
        this.scene.add(sprite);

        // Add connecting line for lifted points
        if (data.lifted) {
            this.addLiftLine(id, pos, y, color);
        }

        // Set initial visibility based on category
        this.updatePointVisibility(id, data);

        return sprite;
    },

    // Add lift line for elevated points
    addLiftLine(pointId, groundPos, elevatedY, color) {
        // Remove existing line if any
        this.removeLiftLine(pointId);

        const points = [
            new THREE.Vector3(groundPos.x, groundPos.y, groundPos.z),
            new THREE.Vector3(groundPos.x, elevatedY, groundPos.z)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const material = new THREE.LineBasicMaterial({
            color: color,
            opacity: 0.8,
            transparent: true,
            linewidth: 2
        });

        const line = new THREE.Line(geometry, material);
        line.userData = { pointId, type: 'liftLine' };
        line.renderOrder = 998;

        this.liftLines.set(pointId, line);
        this.scene.add(line);

        console.log('Lift line added for point:', pointId, 'from', groundPos.y, 'to', elevatedY);
    },

    // Remove lift line
    removeLiftLine(pointId) {
        const line = this.liftLines.get(pointId);
        if (line) {
            this.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
            this.liftLines.delete(pointId);
        }
    },

    // Update point
    update(id, data) {
        const sprite = this.sprites.get(id);
        if (!sprite) return;

        // Update position
        const pos = data.position || sprite.position;
        let y = pos.y;
        if (data.lifted) {
            y += data.liftHeight || 5;
        }
        sprite.position.set(pos.x, y, pos.z);

        // Update scale
        if (data.style?.scale !== undefined) {
            const scale = 4 * data.style.scale;
            sprite.scale.set(scale, scale, 1);
        }

        // Update color if changed
        const color = data.style?.color || '#00C8FF';
        if (data.style?.color) {
            sprite.material.map.dispose();
            sprite.material.map = this.createPointTexture(color);
            sprite.material.needsUpdate = true;
        }

        // Handle lift line
        if (data.lifted) {
            this.addLiftLine(id, pos, y, color);
        } else {
            this.removeLiftLine(id);
        }

        sprite.userData.data = { ...sprite.userData.data, ...data };

        // Update visibility
        this.updatePointVisibility(id, data);
    },

    // Update point visibility based on category selection
    updatePointVisibility(id, data) {
        const sprite = this.sprites.get(id);
        const line = this.liftLines.get(id);
        if (!sprite) return;

        // Check if point should be visible
        const visibleCategories = State.state.ui?.visibleCategories || [];
        const showAllPoints = State.state.ui?.showAllPoints || false;

        let visible = true;

        if (!showAllPoints) {
            if (data.categoryId) {
                // Point has category - show only if category is selected
                visible = visibleCategories.includes(data.categoryId);
            }
            // Points without category always visible (unless hide all)
        }

        sprite.visible = visible;
        if (line) line.visible = visible;
    },

    // Remove point
    remove(id) {
        const sprite = this.sprites.get(id);
        if (!sprite) return;

        this.scene.remove(sprite);
        sprite.material.map.dispose();
        sprite.material.dispose();
        this.sprites.delete(id);

        // Remove lift line
        this.removeLiftLine(id);
    },

    // Set all points visibility
    setAllVisibility(visible) {
        this.sprites.forEach((sprite, id) => {
            sprite.visible = visible;
            const line = this.liftLines.get(id);
            if (line) line.visible = visible;
        });
    },

    // Show points by category
    showByCategory(categoryId) {
        this.sprites.forEach((sprite, id) => {
            const data = sprite.userData.data;
            const visible = !categoryId || data.categoryId === categoryId || !data.categoryId;
            sprite.visible = visible;
            const line = this.liftLines.get(id);
            if (line) line.visible = visible;
        });
    },

    // Toggle category visibility
    toggleCategoryVisibility(categoryId, visible) {
        this.sprites.forEach((sprite, id) => {
            const data = sprite.userData.data;
            if (data.categoryId === categoryId) {
                sprite.visible = visible;
                const line = this.liftLines.get(id);
                if (line) line.visible = visible;
            }
        });
    },

    // Get point at screen position
    getAtPosition(mouseX, mouseY, camera, canvas) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const rect = canvas.getBoundingClientRect();
        mouse.x = ((mouseX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((mouseY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const sprites = Array.from(this.sprites.values());
        const intersects = raycaster.intersectObjects(sprites);

        if (intersects.length > 0) {
            return intersects[0].object.userData;
        }
        return null;
    },

    // Update all sprites to face camera (called in render loop)
    updateBillboards(camera) {
        this.sprites.forEach(sprite => {
            sprite.quaternion.copy(camera.quaternion);
        });
    },

    // Clear all points
    clear() {
        this.sprites.forEach((sprite, id) => this.remove(id));
    }
};

// Export
window.PointsManager = PointsManager;
