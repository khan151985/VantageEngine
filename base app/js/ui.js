/* ========================================
   Sirah Maps - UI Management
   ======================================== */

const UI = {
    // Toast container
    toastContainer: null,

    // Context menu
    contextMenu: null,

    // Current modal
    activeModal: null,

    // Initialize UI
    init() {
        this.createToastContainer();
        this.createContextMenu();
        this.setupMenuListeners();
        this.setupPanelListeners();
        this.setupPropertyListeners();
        this.setupModalListeners();
        this.setupKeyboardDelete();

        // Listen to state changes
        State.on('selectionChange', (selection) => {
            this.updatePropertiesPanel(selection);
            this.handleTransformControls(selection);
            this.updateTreeSelection(selection); // Update hierarchy highlight
        });
        State.on('projectChange', (change) => this.updateHierarchy(change));

        State.on('historyChange', () => this.updateUndoRedoButtons());
    },

    // Handle transform controls based on selection
    handleTransformControls(selection) {
        if (!Renderer || !Renderer.transformControls) return;

        if ((selection.type === 'mesh' || selection.type === 'point') && selection.id) {
            Renderer.attachTransformControls(selection.id);
        } else {
            Renderer.detachTransformControls();
        }
    },

    // Setup keyboard delete handler
    setupKeyboardDelete() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Undo/Redo shortcuts
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    this.performUndo();
                    return;
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    this.performRedo();
                    return;
                }
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const selection = State.state.selected;
                if (selection.type && selection.id) {
                    this.deleteSelected();
                }
            }

            // Transform mode shortcuts when mesh selected
            if (State.state.selected.type === 'mesh') {
                if (e.key === 'g' || e.key === 'w') {
                    Renderer.setTransformMode('translate');
                } else if (e.key === 'r') {
                    Renderer.setTransformMode('rotate');
                } else if (e.key === 's' && !e.ctrlKey) {
                    Renderer.setTransformMode('scale');
                }
            }
        });
    },

    // Perform undo operation
    performUndo() {
        if (State.canUndo()) {
            State.undo();
            this.showToast('info', 'Undo');
            this.refreshUI();
        }
    },

    // Perform redo operation
    performRedo() {
        if (State.canRedo()) {
            State.redo();
            this.showToast('info', 'Redo');
            this.refreshUI();
        }
    },

    // Perform full refresh of all elements
    async performRefresh() {
        // Show refresh modal
        this.showModal(`
            <div class="modal modal-sm">
                <div class="modal-body" style="text-align: center; padding: 30px;">
                    <div class="refresh-spinner">🔄</div>
                    <h3 style="margin: 16px 0 20px;">Refreshing...</h3>
                    <div id="refresh-status" style="text-align: left; font-size: 13px; color: var(--text-secondary);">
                        <div id="refresh-step-models">⏳ Reloading 3D models...</div>
                        <div id="refresh-step-points">⏳ Updating point positions...</div>
                        <div id="refresh-step-icons">⏳ Updating point icons...</div>
                        <div id="refresh-step-categories">⏳ Refreshing category list...</div>
                        <div id="refresh-step-meshes">⏳ Refreshing mesh list...</div>
                        <div id="refresh-step-ui">⏳ Refreshing UI lists...</div>
                        <div id="refresh-step-sync">⏳ Syncing state...</div>
                    </div>
                </div>
            </div>
        `);

        // Add CSS animation for spinner
        const style = document.createElement('style');
        style.textContent = `
            .refresh-spinner { 
                font-size: 48px; 
                animation: spin 1s linear infinite; 
                display: inline-block;
            }
            @keyframes spin { 
                from { transform: rotate(0deg); } 
                to { transform: rotate(360deg); } 
            }
        `;
        document.head.appendChild(style);

        const updateStep = (id, done) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = (done ? '✅' : '⏳') + el.innerHTML.substring(1);
        };

        try {
            // Step 1: Reload 3D models
            await new Promise(r => setTimeout(r, 100));
            if (Renderer && Renderer.reloadAllMeshes) {
                await Renderer.reloadAllMeshes();
            }
            updateStep('refresh-step-models', true);

            // Step 2: Update point positions
            await new Promise(r => setTimeout(r, 100));
            if (Renderer && Renderer.refreshAllPoints) {
                Renderer.refreshAllPoints();
            }
            updateStep('refresh-step-points', true);

            // Step 3: Update point icons
            await new Promise(r => setTimeout(r, 100));
            if (Renderer && Renderer.updatePointIcons) {
                Renderer.updatePointIcons();
            }
            updateStep('refresh-step-icons', true);

            // Step 4: Refresh category list
            await new Promise(r => setTimeout(r, 100));
            this.updateCategoryList();
            updateStep('refresh-step-categories', true);

            // Step 5: Refresh mesh list
            await new Promise(r => setTimeout(r, 100));
            this.updateMeshList();
            updateStep('refresh-step-meshes', true);

            // Step 6: Refresh UI lists
            await new Promise(r => setTimeout(r, 100));
            this.updatePointsList();
            this.updateTextboxList();
            this.updateActionButtonsList();
            this.updateLanguageList();
            this.updateLibrary();
            updateStep('refresh-step-ui', true);

            // Step 7: Sync state
            await new Promise(r => setTimeout(r, 100));
            this.updatePropertiesPanel();
            State.emit('projectChange', { action: 'refresh' });
            updateStep('refresh-step-sync', true);

            // Close modal and show success
            await new Promise(r => setTimeout(r, 300));
            this.closeModal();
            this.showToast('success', 'Refresh Complete', 'All elements updated');

        } catch (error) {
            console.error('Refresh error:', error);
            this.closeModal();
            this.showToast('error', 'Refresh Failed', error.message);
        }

        // Remove temporary style
        style.remove();
    },

    // Refresh UI after undo/redo
    refreshUI() {
        this.updateMeshList();
        this.updateCategoryList();
        this.updatePointsList();
        this.updateTextboxList();
        this.updatePropertiesPanel();
    },

    // Update undo/redo button states
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.disabled = !State.canUndo();
        if (redoBtn) redoBtn.disabled = !State.canRedo();
    },

    // Delete selected item
    deleteSelected() {
        const selection = State.state.selected;
        if (!selection.type || !selection.id) return;

        const type = selection.type;
        const id = selection.id;
        let itemName = '';

        // Get item name
        if (type === 'mesh') {
            const mesh = State.findById('meshes', id);
            itemName = mesh?.name || 'Mesh';
        } else if (type === 'point') {
            const point = State.findById('points', id);
            itemName = point?.name || 'Point';
        } else if (type === 'textbox') {
            const textbox = State.findById('textboxes', id);
            itemName = textbox?.content?.en?.heading || 'Text Box';
        } else if (type === 'category') {
            const cat = State.findById('categories', id);
            itemName = cat?.names?.en || cat?.name || 'Category';
        } else if (type === 'border') {
            const border = State.findById('borders', id);
            itemName = border?.name || 'Border';
        }

        // For category, use native confirm since custom modal has issues
        if (type === 'category') {
            if (confirm(`Delete "${itemName}"?\n\nThis cannot be undone. Points in this category will become uncategorized.`)) {
                this.performDelete(type, id);
            }
            return;
        }

        this.showConfirm(
            `Delete ${type}?`,
            `Are you sure you want to delete "${itemName}"? This cannot be undone.`,
            () => {
                this.performDelete(type, id);
            }
        );
    },

    // Actually perform the delete
    performDelete(type, id) {
        switch (type) {
            case 'mesh':
                Renderer.detachTransformControls();
                Renderer.removeMesh(id);
                State.removeFromProject('meshes', id);
                break;
            case 'point':
                Renderer.removePoint(id);
                State.removeFromProject('points', id);
                break;
            case 'textbox':
                State.removeFromProject('textboxes', id);
                break;
            case 'category':
                // Remove category from points first
                const points = State.getProject('points') || [];
                points.forEach(p => {
                    if (p.categoryId === id) {
                        State.updateInProject('points', p.id, { categoryId: null });
                    }
                });
                // Then remove the category
                State.removeFromProject('categories', id);
                break;
            case 'border':
                if (Renderer.removeBorder) {
                    Renderer.removeBorder(id);
                }
                State.removeFromProject('borders', id);
                this.updateBordersList();
                break;
        }

        State.clearSelection();
        this.updateHierarchy();
        this.showToast('success', 'Deleted', `${type} has been removed`);
    },

    // Helper: Convert file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // Helper: Convert file to ArrayBuffer then base64 (for binary files)
    fileToBinaryBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const arrayBuffer = reader.result;
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                resolve(btoa(binary));
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    // Helper: Base64 to Blob
    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64.split(',')[1] || base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    },

    // Helper: Base64 to File
    base64ToFile(base64, filename, mimeType) {
        const blob = this.base64ToBlob(base64, mimeType);
        return new File([blob], filename, { type: mimeType });
    },

    // Create toast container
    createToastContainer() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
    },

    // Create context menu
    createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'context-menu hidden';
        document.body.appendChild(this.contextMenu);

        // Close on click outside
        document.addEventListener('click', () => {
            this.contextMenu.classList.add('hidden');
        });
    },

    /**
     * Convert file to Base64 (Utility)
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    /**
     * Show toast notification
     */
    showToast(type, title, message, duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close">×</button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });

        this.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => this.removeToast(toast), duration);
    },

    removeToast(toast) {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    },

    // Show loading overlay
    showLoading(message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            `;
            document.getElementById('viewport').appendChild(overlay);
        }
        overlay.querySelector('.loading-text').textContent = message;
    },

    updateLoadingProgress(percent) {
        // Could update a progress bar here
    },

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.remove();
    },

    // Show context menu
    showContextMenu(x, y, type, id = null) {
        const items = this.getContextMenuItems(type, id);

        this.contextMenu.innerHTML = items.map(item => {
            if (item.divider) return '<div class="context-divider"></div>';
            return `
                <div class="context-item ${item.danger ? 'danger' : ''}" data-action="${item.action}" data-id="${id || ''}">
                    <span class="context-icon">${item.icon}</span>
                    <span>${item.label}</span>
                </div>
            `;
        }).join('');

        // Position menu
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.remove('hidden');

        // Adjust if off screen
        const rect = this.contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.contextMenu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.contextMenu.style.top = `${y - rect.height}px`;
        }

        // Add click handlers
        this.contextMenu.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleContextAction(item.dataset.action, item.dataset.id);
                this.contextMenu.classList.add('hidden');
            });
        });
    },

    getContextMenuItems(type, id) {
        switch (type) {
            case 'point':
                return [
                    { icon: '✏️', label: 'Edit Point', action: 'edit-point' },
                    { icon: '📷', label: 'Set Camera View', action: 'set-camera-view' },
                    { icon: '👁', label: 'Focus', action: 'focus-point' },
                    { divider: true },
                    { icon: '📋', label: 'Duplicate', action: 'duplicate-point' },
                    { icon: '🗑', label: 'Delete', action: 'delete-point', danger: true }
                ];
            case 'mesh':
                return [
                    { icon: '✏️', label: 'Edit Mesh', action: 'edit-mesh' },
                    { icon: '📐', label: 'Reset Transform', action: 'reset-transform' },
                    { divider: true },
                    { icon: '🗑', label: 'Delete', action: 'delete-mesh', danger: true }
                ];
            case 'category':
                return [
                    { icon: '✏️', label: 'Edit Category', action: 'edit-category' },
                    { divider: true },
                    { icon: '🗑', label: 'Delete', action: 'delete-category', danger: true }
                ];
            case 'viewport':
                return [
                    { icon: '📍', label: 'Add Point Here', action: 'add-point' },
                    { icon: '📷', label: 'Save View', action: 'save-view' },
                    { divider: true },
                    { icon: '🏠', label: 'Reset Camera', action: 'reset-camera' }
                ];
            default:
                return [];
        }
    },

    handleContextAction(action, id) {
        switch (action) {
            case 'edit-point':
            case 'edit-mesh':
                State.select(action.split('-')[1], id);
                break;
            case 'edit-category':
                this.showEditCategoryModal(id);
                break;
            case 'delete-category':
                this.deleteCategory(id);
                break;
            case 'focus-point':
                Controls.focusOnPoint(id);
                break;
            case 'set-camera-view':
                this.setPointCameraView(id);
                break;
            case 'duplicate-point':
                this.duplicatePoint(id);
                break;
            case 'delete-point':
                this.deletePoint(id);
                break;
            case 'delete-mesh':
                this.deleteMesh(id);
                break;
            case 'reset-camera':
                Renderer.resetCamera();
                break;
            case 'save-view':
                this.showSaveViewModal();
                break;
        }
    },

    // Setup menu listeners
    setupMenuListeners() {
        // File menu actions (exclude .section-add-btn as they have their own handler)
        document.querySelectorAll('[data-action]:not(.section-add-btn):not(.sidebar-btn)').forEach(el => {
            el.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleMenuAction(action);
            });
        });

        // Toolbar tools
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                if (tool === 'select') {
                    // Cycle through gizmo modes when transform button clicked
                    if (window.Controls) {
                        Controls.cycleGizmoMode();
                    }
                } else {
                    State.setTool(tool);
                }
            });
        });
    },

    handleMenuAction(action) {
        // Play button click sound
        SoundManager.play('buttonClick');

        switch (action) {
            // Undo/Redo
            case 'undo':
                this.performUndo();
                break;
            case 'redo':
                this.performRedo();
                break;
            case 'refresh':
                this.performRefresh();
                break;

            // File
            case 'new-project':
                this.newProject();
                break;
            case 'open-project':
                this.openProject();
                break;
            case 'save-project':
                this.saveProject();
                break;
            case 'save-as':
                this.saveProjectAs();
                break;
            case 'import-data':
                this.importData();
                break;
            case 'export-data':
                this.exportData();
                break;
            case 'export-web':
                this.showExportModal();
                break;
            case 'export-windows':
                this.showExportWindowsModal();
                break;

                // Add
                break;
            case 'add-mesh':
                this.showAddMeshModal();
                break;
            case 'draw-border':
                this.startBorderDrawing();
                break;

            case 'add-point':
                State.setTool('add-point');
                break;
            case 'add-textbox':
                this.showAddTextboxModal();
                break;
            case 'add-media':
                this.showAddMediaModal();
                break;
            case 'add-panorama':
                this.showAddPanoramaModal();
                break;
            case 'add-menu-button':
                this.showAddCategoryModal();
                break;
            case 'add-action-button':
                this.createActionButton();
                break;
            case 'add-language':
                this.showAddLanguageModal();
                break;

            // Folders
            case 'add-mesh-folder':
                this.createFolder('meshFolders', 'mesh-list');
                break;
            case 'add-point-folder':
                this.createFolder('pointFolders', 'points-list');
                break;
            case 'add-textbox-folder':
                this.createFolder('textboxFolders', 'textbox-list');
                break;
            case 'add-border-folder':
                this.createFolder('borderFolders', 'borders-list');
                break;

            // View
            case 'toggle-grid':
                State.toggleUI('showGrid');
                break;
            case 'toggle-points':
                State.toggleUI('showPoints');
                break;
            case 'toggle-gizmos':
                State.toggleUI('showGizmos');
                break;
            case 'reset-camera':
                Renderer.resetCamera();
                break;

            // Settings
            case 'project-settings':
                this.showProjectSettingsModal();
                break;
            case 'api-settings':
                this.showAPISettingsModal();
                break;
            case 'theme-light':
                State.setTheme('light');
                break;
            case 'theme-dark':
                State.setTheme('dark');
                break;

            // Animations
            case 'path-animations':
                this.showPathAnimationsPanel();
                break;
            case 'toggle-path-visibility':
                if (window.PathAnimations) {
                    const visible = PathAnimations.pathGroup?.visible ?? true;
                    PathAnimations.setPathVisibility(!visible);
                    this.showToast('info', visible ? 'Paths hidden' : 'Paths visible');
                }
                break;

                // Preview
                // Removed Preview
                break;

            // Sidebar tools
            case 'measure':
                State.setTool('measure');
                this.showToast('info', 'Measurement Mode', 'Click two points on the map to measure distance');
                break;
            case 'distance':
                State.setTool('measure');
                this.showToast('info', '3D Distance', 'Click two points to measure 3D distance');
                break;
            case 'clear-measurements':
                Controls.clearAllMeasurements();
                break;
            case 'fullscreen':
                this.toggleFullscreen();
                break;
            case 'toggle-sidebar':
                this.toggleUserSidebar();
                break;
            case 'toggle-audio':
                this.toggleGlobalAudio();
                break;
            case 'show-info':
                this.showInfoModal();
                break;
            case 'show-all':
                this.toggleAllPoints();
                break;
            case 'change-language':
                this.showLanguagePopup();
                break;
        }
    },

    // Start border drawing mode
    startBorderDrawing() {
        const name = prompt('Enter name for the new border:', 'New Border');
        if (!name) return;

        State.setTool('draw-border');

        // Get color and width from toolbar
        const color = document.getElementById('bdt-color')?.value || '#FFFF00';
        const width = parseInt(document.getElementById('bdt-width')?.value) || 100;

        // Notify Controls to initialize drawing state
        if (window.Controls && Controls.startBorderDrawing) {
            Controls.startBorderDrawing(name, color, width);
        } else {
            console.warn('Controls.startBorderDrawing not implemented');
            State.state.drawingBorderName = name;
        }

        // Show drawing toolbar
        const toolbar = document.getElementById('border-drawing-toolbar');
        if (toolbar) {
            toolbar.classList.remove('hidden');
            document.getElementById('bdt-point-count').textContent = '0 points';
        }
    },



    // Show language selection popup near the language button
    showLanguagePopup() {
        // Remove existing popup
        document.querySelector('.language-popup')?.remove();

        const languages = State.getProject('languages');
        const currentLang = ContentManager.activeLanguage || 'en';

        const popup = document.createElement('div');
        popup.className = 'language-popup';
        popup.innerHTML = `
            ${languages.map(lang => `
                <div class="language-popup-item ${lang.code === currentLang ? 'active' : ''}" data-lang="${lang.code}">
                    <span class="flag">${this.getLanguageFlag(lang.code)}</span>
                    <span class="name">${lang.name}</span>
                    <span class="check">✓</span>
                </div>
            `).join('')}
        `;

        // Position near the language button
        const langBtn = document.querySelector('.language-btn');
        const sidebar = document.getElementById('user-sidebar');
        if (sidebar) {
            sidebar.appendChild(popup);
        }

        // Handle language selection
        popup.querySelectorAll('.language-popup-item').forEach(item => {
            item.addEventListener('click', () => {
                const lang = item.dataset.lang;
                ContentManager.setLanguage(lang);
                popup.remove();
                this.showToast('info', 'Language Changed', `Switched to ${lang.toUpperCase()}`);
            });
        });

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target) && !e.target.closest('.language-btn')) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            });
        }, 100);
    },

    getLanguageFlag(code) {
        const flags = {
            'en': '🇬🇧', 'ar': '🇸🇦', 'ur': '🇵🇰', 'fr': '🇫🇷',
            'de': '🇩🇪', 'es': '🇪🇸', 'tr': '🇹🇷', 'id': '🇮🇩',
            'ms': '🇲🇾', 'bn': '🇧🇩', 'hi': '🇮🇳', 'zh': '🇨🇳',
            'ja': '🇯🇵', 'ko': '🇰🇷', 'pt': '🇵🇹', 'ru': '🇷🇺'
        };
        return flags[code] || '🌐';
    },

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                this.showToast('error', 'Fullscreen Error', err.message);
            });
        } else {
            document.exitFullscreen();
        }
    },

    toggleUserSidebar() {
        const sidebar = document.getElementById('user-sidebar');
        sidebar.classList.toggle('collapsed');
    },

    toggleGlobalAudio() {
        // Toggle background audio if any
        const btn = document.querySelector('[data-action="toggle-audio"]');
        btn?.classList.toggle('active');
    },

    showInfoModal() {
        const meta = State.getProject('meta');
        this.showModal(`
            <div class="modal modal-sm">
                <div class="modal-header">
                    <h3 class="modal-title">About</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <h2>${meta.name}</h2>
                    <p style="color: var(--text-secondary);">${meta.subtitle || ''}</p>
                    <p style="margin-top: 16px; font-size: 12px; color: var(--text-tertiary);">
                        Version ${meta.version}<br>
                        Created with Sirah Maps
                    </p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="UI.closeModal()">Close</button>
                </div>
            </div>
        `);
    },

    showAllPoints() {
        State.state.ui.showAllPoints = true;
        const points = State.getProject('points');
        points.forEach(p => {
            PointsManager.sprites.get(p.id)?.visible && (PointsManager.sprites.get(p.id).visible = true);
            const line = PointsManager.liftLines.get(p.id);
            if (line) line.visible = true;
        });
        PointsManager.setAllVisibility(true);

        // Update button state
        document.getElementById('show-all-btn')?.classList.add('active');
        this.showToast('info', 'Showing All', `${points.length} points visible`);
    },

    hideAllPoints() {
        State.state.ui.showAllPoints = false;
        PointsManager.setAllVisibility(false);

        // Show only uncategorized points
        const points = State.getProject('points');
        points.forEach(p => {
            if (!p.categoryId) {
                const sprite = PointsManager.sprites.get(p.id);
                if (sprite) sprite.visible = true;
                const line = PointsManager.liftLines.get(p.id);
                if (line) line.visible = true;
            }
        });

        document.getElementById('show-all-btn')?.classList.remove('active');
        this.showToast('info', 'Hiding Points', 'Only uncategorized points visible');
    },

    toggleAllPoints() {
        if (State.state.ui.showAllPoints) {
            this.hideAllPoints();
        } else {
            this.showAllPoints();
        }
    },

    // Toggle category visibility and show/hide its points
    toggleCategoryPoints(categoryId) {
        const visibleCategories = State.state.ui.visibleCategories;
        const index = visibleCategories.indexOf(categoryId);

        if (index === -1) {
            // Show category points
            visibleCategories.push(categoryId);
            PointsManager.toggleCategoryVisibility(categoryId, true);
        } else {
            // Hide category points
            visibleCategories.splice(index, 1);
            PointsManager.toggleCategoryVisibility(categoryId, false);
        }

        // Don't show all points anymore since user is selecting categories
        State.state.ui.showAllPoints = false;
    },

    // Setup panel listeners
    setupPanelListeners() {
        // Panel tabs
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // Update tab buttons
                document.querySelectorAll('.panel-tab').forEach(t => {
                    t.classList.toggle('active', t.dataset.tab === tabName);
                });

                // Show correct content
                document.querySelectorAll('.panel-content').forEach(content => {
                    content.classList.toggle('hidden', content.id !== `${tabName}-tab`);
                });

                State.state.ui.leftPanelTab = tabName;
            });
        });

        // Section add buttons
        document.querySelectorAll('.section-add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleMenuAction(btn.dataset.action);
            });
        });

        // Translate all button
        document.getElementById('translate-all-btn')?.addEventListener('click', () => {
            this.translateAllContent();
        });

        // Sidebar buttons (for preview mode)
        document.querySelectorAll('.sidebar-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleMenuAction(btn.dataset.action);
            });
        });

        // Collapsible groups
        document.querySelectorAll('.prop-group-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.collapse-btn') || e.target.closest('.section-add-btn')) {
                    e.currentTarget.parentElement.classList.toggle('collapsed');
                }
            });
        });
    },

    // Setup property input listeners
    setupPropertyListeners() {
        // Model properties
        document.getElementById('model-name')?.addEventListener('change', (e) => {
            this.updateSelectedMesh({ name: e.target.value });
        });

        // Transform inputs
        ['pos', 'rot', 'scale'].forEach(type => {
            ['x', 'y', 'z'].forEach(axis => {
                document.getElementById(`model-${type}-${axis}`)?.addEventListener('change', (e) => {
                    this.updateSelectedMeshTransform(type, axis, parseFloat(e.target.value));
                });
            });
        });

        // Mesh visibility options
        document.getElementById('mesh-visible-on-load')?.addEventListener('change', (e) => {
            this.updateSelectedMesh({ visibleOnLoad: e.target.checked });
        });

        // Platform specific loading
        ['pc', 'android', 'ios'].forEach(platform => {
            document.getElementById(`mesh-load-${platform}`)?.addEventListener('change', (e) => {
                const mesh = State.findById('meshes', State.state.selected.id);
                const platforms = { ...(mesh.platforms || { pc: true, android: true, ios: true }) };
                platforms[platform] = e.target.checked;
                this.updateSelectedMesh({ platforms: platforms });
            });
        });

        document.getElementById('mesh-visibility-trigger')?.addEventListener('change', (e) => {
            const type = e.target.value;
            this.updateMeshVisibilityTriggerOptions(type, null);
            this.updateSelectedMesh({
                visibilityTrigger: { type: type, targetId: null }
            });
        });

        document.getElementById('mesh-visibility-target')?.addEventListener('change', (e) => {
            const currentMesh = State.findById('meshes', State.state.selected.id);
            if (currentMesh) {
                this.updateSelectedMesh({
                    visibilityTrigger: {
                        type: currentMesh.visibilityTrigger?.type || 'none',
                        targetId: e.target.value || null
                    }
                });
            }
        });

        // Mesh Toggle Button - assign mesh to sidebar toggle button
        document.getElementById('mesh-toggle-button-enabled')?.addEventListener('change', (e) => {
            this.updateSelectedMesh({ toggleButtonEnabled: e.target.checked });
            // Show/hide options
            const options = document.getElementById('mesh-toggle-options');
            if (options) options.style.display = e.target.checked ? '' : 'none';
        });

        // Toggle Button Icon Upload
        document.getElementById('mesh-toggle-icon-file')?.addEventListener('change', async (e) => {
            console.log('Icon upload triggered');
            const file = e.target.files[0];
            if (file) {
                console.log('File selected:', file.name, file.type, file.size);
                try {
                    const base64 = await this.fileToBase64(file);
                    console.log('Base64 conversion successful, length:', base64.length);

                    const preview = document.getElementById('mesh-toggle-icon-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${base64}" alt="icon">`;
                        console.log('Preview updated');
                    } else {
                        console.error('Preview element not found!');
                    }

                    document.getElementById('mesh-toggle-icon-actions')?.classList.remove('hidden');

                    this.updateSelectedMesh({ toggleIcon: base64 });
                    console.log('Mesh updated with new icon');
                } catch (err) {
                    console.error('Error converting file to base64:', err);
                    alert('Error uploading icon: ' + err.message);
                }
            } else {
                console.log('No file selected');
            }
        });

        // Trigger file input when clicking the preview box
        document.getElementById('mesh-toggle-icon-preview')?.addEventListener('click', () => {
            console.log('Preview box clicked, triggering input');
            document.getElementById('mesh-toggle-icon-file')?.click();
        });

        document.getElementById('change-mesh-toggle-icon')?.addEventListener('click', () => {
            document.getElementById('mesh-toggle-icon-file')?.click();
        });

        document.getElementById('remove-mesh-toggle-icon')?.addEventListener('click', () => {
            const preview = document.getElementById('mesh-toggle-icon-preview');
            preview.innerHTML = '<span class="upload-placeholder">🖼️</span>';
            document.getElementById('mesh-toggle-icon-actions')?.classList.add('hidden');
            document.getElementById('mesh-toggle-icon-file').value = ''; // clear input

            this.updateSelectedMesh({ toggleIcon: null });
        });

        // Toggle Button Tooltip
        document.getElementById('mesh-toggle-tooltip')?.addEventListener('change', (e) => {
            this.updateSelectedMesh({ toggleTooltip: e.target.value });
        });

        // Measurement enabled toggle
        document.getElementById('mesh-measurement-enabled')?.addEventListener('change', (e) => {
            this.updateSelectedMesh({ measurementEnabled: e.target.checked });
        });

        // -----------------------------------------------------
        // TEXTURE VARIANT LISTENERS
        // -----------------------------------------------------

        // Toggle Enable
        document.getElementById('mesh-texture-variant-enabled')?.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            const mesh = State.findById('meshes', State.state.selected.id);
            const current = mesh?.textureVariant || {};
            this.updateSelectedMesh({ textureVariant: { ...current, enabled } });

            const options = document.getElementById('mesh-texture-variant-options');
            const hint = document.getElementById('mesh-texture-variant-hint');
            if (options) options.style.display = enabled ? '' : 'none';
            if (hint) hint.style.display = enabled ? '' : 'none';
        });

        // Brightness Slider (Real-time Preview)
        document.getElementById('mesh-texture-variant-brightness')?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const display = document.getElementById('mesh-texture-variant-brightness-val');
            if (display) display.textContent = val + '%';

            // Real-time preview on selected mesh
            if (State.state.selected.type === 'mesh' && Renderer) {
                Renderer.applyMeshBrightness(State.state.selected.id, val);
            }
        });

        // Brightness Change (Save)
        document.getElementById('mesh-texture-variant-brightness')?.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            const mesh = State.findById('meshes', State.state.selected.id);
            const current = mesh?.textureVariant || {};
            this.updateSelectedMesh({ textureVariant: { ...current, brightness: val } });
        });

        // Tooltip
        document.getElementById('mesh-texture-variant-tooltip')?.addEventListener('change', (e) => {
            const mesh = State.findById('meshes', State.state.selected.id);
            const current = mesh?.textureVariant || {};
            this.updateSelectedMesh({ textureVariant: { ...current, tooltip: e.target.value } });
        });

        // Icon Upload
        document.getElementById('mesh-texture-variant-icon-file')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const base64 = await this.fileToBase64(file);
                    const preview = document.getElementById('mesh-texture-variant-icon-preview');
                    if (preview) preview.innerHTML = `<img src="${base64}" alt="icon">`;

                    document.getElementById('mesh-texture-variant-icon-actions')?.classList.remove('hidden');

                    const mesh = State.findById('meshes', State.state.selected.id);
                    const current = mesh?.textureVariant || {};
                    this.updateSelectedMesh({ textureVariant: { ...current, icon: base64 } });
                } catch (err) {
                    alert('Error uploading icon: ' + err.message);
                }
            }
        });

        // Icon Actions
        document.getElementById('mesh-texture-variant-icon-preview')?.addEventListener('click', () => {
            document.getElementById('mesh-texture-variant-icon-file')?.click();
        });
        document.getElementById('change-mesh-texture-variant-icon')?.addEventListener('click', () => {
            document.getElementById('mesh-texture-variant-icon-file')?.click();
        });
        document.getElementById('remove-mesh-texture-variant-icon')?.addEventListener('click', () => {
            const preview = document.getElementById('mesh-texture-variant-icon-preview');
            if (preview) preview.innerHTML = '<span class="upload-placeholder">🖼️</span>';
            document.getElementById('mesh-texture-variant-icon-actions')?.classList.add('hidden');

            const mesh = State.findById('meshes', State.state.selected.id);
            const current = mesh?.textureVariant || {};
            this.updateSelectedMesh({ textureVariant: { ...current, icon: null } });
        });

        // Point properties
        document.getElementById('point-name')?.addEventListener('change', (e) => {
            this.updateSelectedPoint({ name: e.target.value });
            this.syncPointContentName(State.state.selected.id, 'en', e.target.value);
        });

        document.getElementById('point-category')?.addEventListener('change', (e) => {
            this.updateSelectedPoint({ categoryId: e.target.value || null });
        });

        document.getElementById('point-content')?.addEventListener('change', (e) => {
            const select = e.target;
            const selectedOption = select.options[select.selectedIndex];
            const type = selectedOption.getAttribute('data-type') || 'textbox';

            this.updateSelectedPoint({
                contentId: select.value || null,
                contentType: select.value ? type : null
            });
        });

        // Point Content Search
        document.getElementById('point-content-search')?.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const select = document.getElementById('point-content');
            const currentPointId = State.state.selected.id;
            const point = State.findById('points', currentPointId);
            const currentContentId = point ? point.contentId : select.value;

            // Get all options
            const textboxOptions = ContentManager.getTextboxOptions();
            const panoramaOptions = ContentManager.getMediaOptions('panorama');

            // Filter
            const filteredTextboxes = textboxOptions.filter(tb => tb.name.toLowerCase().includes(searchTerm));
            const filteredPanoramas = panoramaOptions.filter(p => p.name.toLowerCase().includes(searchTerm));

            // Re-render
            let html = '<option value="">None</option>';

            if (filteredTextboxes.length > 0) {
                html += `<optgroup label="Text Boxes">
                    ${filteredTextboxes.map(tb => `<option value="${tb.id}" data-type="textbox" ${tb.id === currentContentId ? 'selected' : ''}>${tb.name}</option>`).join('')}
                </optgroup>`;
            }

            if (filteredPanoramas.length > 0) {
                html += `<optgroup label="360 Panoramas">
                    ${filteredPanoramas.map(pan => `<option value="${pan.id}" data-type="panorama" ${pan.id === currentContentId ? 'selected' : ''}>${pan.name}</option>`).join('')}
                </optgroup>`;
            }

            select.innerHTML = html;
        });

        // Auto-Select Toggle
        document.getElementById('viewport-auto-select')?.addEventListener('change', (e) => {
            if (window.Controls) {
                window.Controls.autoSelectEnabled = e.target.checked;
            }
        });

        // Clear Measurements Button
        document.getElementById('btn-clear-measurements')?.addEventListener('click', () => {
            if (window.Controls) {
                window.Controls.clearAllMeasurements();
            }
        });

        // Section Search Filtering
        document.querySelectorAll('.section-search-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const targetId = e.target.dataset.target;
                const list = document.getElementById(targetId);
                if (!list) return;

                // Filter Leaf Items
                list.querySelectorAll('.tree-item').forEach(item => {
                    const text = item.textContent.toLowerCase();
                    const matches = text.includes(term);
                    item.style.display = matches ? '' : 'none';

                    // Note: If item is inside a folder, we handle folder visibility next
                });

                // Handle Folders
                list.querySelectorAll('.tree-folder').forEach(folder => {
                    const folderNameKey = folder.querySelector('.tree-folder-name')?.textContent.toLowerCase() || '';
                    const folderMatches = folderNameKey.includes(term);

                    // Check if any children are visible
                    let hasVisibleChildren = false;
                    folder.querySelectorAll('.tree-item').forEach(child => {
                        if (child.style.display !== 'none') hasVisibleChildren = true;
                    });

                    // Show folder if name matches OR it has visible children
                    // If name matches, should we show ALL children? 
                    // Usually yes, but let's keep it simple: Show folder header, children are filtered strictly.
                    // If you want to show all children if folder matches:
                    if (folderMatches) {
                        folder.style.display = '';
                        folder.querySelectorAll('.tree-item').forEach(child => child.style.display = '');
                    } else {
                        folder.style.display = hasVisibleChildren ? '' : 'none';
                    }
                });
            });
        });

        document.getElementById('point-lifted')?.addEventListener('change', (e) => {
            this.updateSelectedPoint({ lifted: e.target.checked });
            document.getElementById('lift-height-row').style.display = e.target.checked ? '' : 'none';
        });

        document.getElementById('point-lift-height')?.addEventListener('change', (e) => {
            this.updateSelectedPoint({ liftHeight: parseFloat(e.target.value) });
        });

        // Point show 3D mesh toggle (for point marker mesh feature)
        document.getElementById('point-show-3d-mesh')?.addEventListener('change', (e) => {
            this.updateSelectedPoint({ show3DMesh: e.target.checked });
        });

        // Point mesh scale slider
        document.getElementById('point-mesh-scale')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('point-mesh-scale-value').textContent = value + 'x';
        });

        document.getElementById('point-mesh-scale')?.addEventListener('change', (e) => {
            const scale = parseFloat(e.target.value);
            const applyAll = document.getElementById('point-mesh-scale-apply-all')?.checked;

            if (applyAll) {
                // Apply to all points
                const points = State.getProject('points') || [];
                points.forEach(point => {
                    State.updateInProject('points', point.id, { meshScale: scale });
                });
                this.showToast('success', 'Applied to All', `Mesh scale ${scale}x applied to ${points.length} points`);
            } else {
                // Apply to current point only
                this.updateSelectedPoint({ meshScale: scale });
            }
        });

        // Point mesh rotation slider
        document.getElementById('point-mesh-rotation')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('point-mesh-rotation-value').textContent = value + '°';
        });

        document.getElementById('point-mesh-rotation')?.addEventListener('change', (e) => {
            const rotation = parseInt(e.target.value);
            const applyAll = document.getElementById('point-mesh-rotation-apply-all')?.checked;

            if (applyAll) {
                // Apply to all points
                const points = State.getProject('points') || [];
                points.forEach(point => {
                    State.updateInProject('points', point.id, { meshRotation: rotation });
                });
                this.showToast('success', 'Applied to All', `Mesh rotation ${rotation}° applied to ${points.length} points`);
            } else {
                // Apply to current point only
                this.updateSelectedPoint({ meshRotation: rotation });
            }
        });

        // Preview 3D marker button
        document.getElementById('preview-3d-marker')?.addEventListener('click', async () => {
            const settings = State.getProject('settings') || {};
            const markerSettings = settings.pointMarkerMesh || {};

            if (!markerSettings.data) {
                this.showToast('warning', 'No Model', 'Please upload a 3D marker model in Project Settings first');
                return;
            }

            const pointId = State.state.selected.id;
            const point = State.findById('points', pointId);
            if (!point) return;

            // Load mesh if not loaded
            if (!Renderer.pointMarkerMesh) {
                this.showLoading('Loading 3D marker...');
                await Renderer.loadPointMarkerMesh();
                this.hideLoading();
            }

            // Apply point-specific scale
            const pointScale = point.meshScale || 1;
            const baseScale = markerSettings.scale || { x: 1, y: 1, z: 1 };
            if (Renderer.pointMarkerMesh) {
                Renderer.pointMarkerMesh.scale.set(
                    baseScale.x * pointScale,
                    baseScale.y * pointScale,
                    baseScale.z * pointScale
                );

                // Apply rotation (Base + Point)
                const pointRotation = point.meshRotation || 0;
                const baseRotY = markerSettings.rotation?.y || 0;
                Renderer.pointMarkerMesh.rotation.y = (baseRotY + pointRotation) * (Math.PI / 180);
            }

            // Move to point position
            const pos = point.position;
            const liftedY = point.lifted ? (point.liftHeight || 5) : 0;
            Renderer.movePointMarkerTo({
                x: pos.x,
                y: pos.y + liftedY,
                z: pos.z
            }, true);

            this.showToast('info', 'Preview', '3D marker shown at point location');
        });

        // Point icon dropdown
        document.getElementById('point-icon')?.addEventListener('change', (e) => {
            const value = e.target.value;
            const customRow = document.getElementById('custom-icon-row');

            if (value === 'custom') {
                customRow?.classList.remove('hidden');
            } else {
                customRow?.classList.add('hidden');
                this.updateSelectedPoint({ style: { iconType: 'default', customIcon: null } });
            }
        });

        // Custom icon upload click
        document.getElementById('point-icon-preview')?.addEventListener('click', () => {
            document.getElementById('point-icon-file')?.click();
        });

        // Custom icon file selection
        document.getElementById('point-icon-file')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const base64 = await this.fileToBase64(file);
                const preview = document.getElementById('point-icon-preview');
                preview.innerHTML = `<img src="${base64}" alt="icon">`;
                document.getElementById('point-icon-actions')?.classList.remove('hidden');

                this.updateSelectedPoint({ style: { iconType: 'custom', customIcon: base64 } });
            }
        });

        // Change icon button
        document.getElementById('change-point-icon')?.addEventListener('click', () => {
            document.getElementById('point-icon-file')?.click();
        });

        // Remove icon button
        document.getElementById('remove-point-icon')?.addEventListener('click', () => {
            const preview = document.getElementById('point-icon-preview');
            preview.innerHTML = '<span class="upload-placeholder">🖼️ Click to upload</span>';
            document.getElementById('point-icon-actions')?.classList.add('hidden');
            document.getElementById('point-icon').value = 'default';
            document.getElementById('custom-icon-row')?.classList.add('hidden');
            this.updateSelectedPoint({ style: { iconType: 'default', customIcon: null } });
        });

        // Action Button properties
        document.getElementById('action-btn-name')?.addEventListener('change', (e) => {
            this.updateSelectedActionButton({ name: e.target.value });
        });

        document.getElementById('action-btn-icon')?.addEventListener('change', (e) => {
            this.updateSelectedActionButton({ icon: e.target.value });
        });

        document.getElementById('action-btn-placement')?.addEventListener('change', (e) => {
            const placement = e.target.value;
            document.getElementById('action-btn-category-row').style.display =
                placement === 'category' ? '' : 'none';
            this.updateSelectedActionButton({ placement: placement });
        });

        document.getElementById('action-btn-category')?.addEventListener('change', (e) => {
            this.updateSelectedActionButton({ categoryId: e.target.value || null });
        });

        // Action checkboxes
        ['show-image', 'play-video', 'play-audio', 'toggle-mesh'].forEach(action => {
            const checkbox = document.getElementById(`action-${action}`);
            const optionsDiv = document.getElementById(`action-${action.split('-').pop()}-options`);

            checkbox?.addEventListener('change', (e) => {
                if (optionsDiv) optionsDiv.style.display = e.target.checked ? '' : 'none';

                const btn = State.findById('actionButtons', State.state.selected.id);
                if (!btn) return;

                const actionKey = action === 'show-image' ? 'showImage' :
                    action === 'play-video' ? 'playVideo' :
                        action === 'play-audio' ? 'playAudio' : 'toggleMesh';

                const actions = { ...btn.actions };
                actions[actionKey] = { ...actions[actionKey], enabled: e.target.checked };
                this.updateSelectedActionButton({ actions });
            });
        });

        document.getElementById('action-mesh-select')?.addEventListener('change', (e) => {
            const btn = State.findById('actionButtons', State.state.selected.id);
            if (!btn) return;
            const actions = { ...btn.actions };
            actions.toggleMesh = { ...actions.toggleMesh, meshId: e.target.value || null };
            this.updateSelectedActionButton({ actions });
        });

        document.getElementById('delete-action-btn')?.addEventListener('click', () => {
            const id = State.state.selected.id;
            if (id && State.state.selected.type === 'actionButton') {
                State.removeFromProject('actionButtons', id);
                State.clearSelection();
                this.showToast('success', 'Action Button Deleted');
            }
        });

        document.getElementById('point-color')?.addEventListener('change', (e) => {
            this.updateSelectedPoint({ style: { color: e.target.value } });
        });

        document.getElementById('point-scale')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            e.target.nextElementSibling.textContent = `${value}x`;
            this.updateSelectedPoint({ style: { scale: value } });
        });

        // Show icon in menu toggle
        document.getElementById('point-show-icon-in-menu')?.addEventListener('change', (e) => {
            this.updateSelectedPoint({ showIconInMenu: e.target.checked });
            // Show hint if enabled but no custom icon
            const point = State.findById('points', State.state.selected.id);
            const menuIconHint = document.getElementById('menu-icon-hint');
            if (menuIconHint && point) {
                const hasCustomIcon = point.style?.iconType === 'custom' && point.style?.customIcon;
                menuIconHint.style.display = (e.target.checked && !hasCustomIcon) ? '' : 'none';
            }
        });

        // Point click sound
        document.getElementById('point-click-sound-source')?.addEventListener('change', (e) => {
            const isUrl = e.target.value === 'url';
            document.getElementById('point-sound-url-section').classList.toggle('hidden', !isUrl);
            this.updateSelectedPoint({ clickSound: { source: e.target.value, url: '' } });
        });

        document.getElementById('point-click-sound-url')?.addEventListener('change', (e) => {
            const source = document.getElementById('point-click-sound-source').value;
            this.updateSelectedPoint({ clickSound: { source: source, url: e.target.value } });
        });

        document.getElementById('preview-point-sound')?.addEventListener('click', () => {
            const url = document.getElementById('point-click-sound-url').value;
            if (url) {
                const audio = new Audio(url);
                audio.play().catch(err => this.showToast('error', 'Failed to play sound'));
            } else {
                this.showToast('warning', 'No sound URL specified');
            }
        });

        // Category click sound
        document.getElementById('category-click-sound-source')?.addEventListener('change', (e) => {
            const isUrl = e.target.value === 'url';
            document.getElementById('category-sound-url-section').classList.toggle('hidden', !isUrl);
            this.updateSelectedCategory({ clickSound: { source: e.target.value, url: '' } });
        });

        document.getElementById('category-click-sound-url')?.addEventListener('change', (e) => {
            const source = document.getElementById('category-click-sound-source').value;
            this.updateSelectedCategory({ clickSound: { source: source, url: e.target.value } });
        });

        document.getElementById('preview-category-sound')?.addEventListener('click', () => {
            const url = document.getElementById('category-click-sound-url').value;
            if (url) {
                const audio = new Audio(url);
                audio.play().catch(err => this.showToast('error', 'Failed to play sound'));
            } else {
                this.showToast('warning', 'No sound URL specified');
            }
        });

        // Camera settings
        document.getElementById('camera-fov')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            e.target.nextElementSibling.textContent = `${value}°`;
            Renderer.setFOV(value);
        });

        // Set camera view button
        document.getElementById('set-camera-view')?.addEventListener('click', () => {
            this.setPointCameraView(State.state.selected.id);
        });

        // Preview camera view button
        document.getElementById('preview-camera-view')?.addEventListener('click', () => {
            this.previewPointCameraView(State.state.selected.id);
        });

        // Textbox properties
        document.getElementById('textbox-heading')?.addEventListener('change', (e) => {
            this.updateSelectedTextbox({ heading: e.target.value });
        });

        document.getElementById('textbox-body')?.addEventListener('change', (e) => {
            this.updateSelectedTextbox({ body: e.target.value });
        });

        // AI buttons
        document.getElementById('ai-translate')?.addEventListener('click', () => {
            this.aiTranslateTextbox();
        });

        document.getElementById('ai-enhance')?.addEventListener('click', () => {
            this.aiEnhanceContent();
        });

        document.getElementById('ai-translate-action-btn')?.addEventListener('click', () => {
            this.aiTranslateActionButton();
        });

        // Textbox styling
        document.getElementById('textbox-header-color')?.addEventListener('change', (e) => {
            this.updateSelectedTextbox({ style: { headerColor: e.target.value } });
        });

        document.getElementById('textbox-header-text-color')?.addEventListener('change', (e) => {
            this.updateSelectedTextbox({ style: { headerTextColor: e.target.value } });
        });

        document.getElementById('textbox-font-family')?.addEventListener('change', (e) => {
            this.updateSelectedTextbox({ style: { fontFamily: e.target.value } });
        });

        document.getElementById('textbox-font-size')?.addEventListener('change', (e) => {
            const value = e.target.value || null; // null means use global setting
            this.updateSelectedTextbox({ style: { fontSize: value } });
        });

        document.getElementById('textbox-line-height')?.addEventListener('change', (e) => {
            this.updateSelectedTextbox({ style: { lineHeight: e.target.value } });
        });

        // Point mesh visibility select/deselect all
        document.getElementById('point-mesh-select-all')?.addEventListener('click', () => {
            document.querySelectorAll('#point-mesh-list input[type="checkbox"]').forEach(cb => cb.checked = true);
            this.updateMeshVisibilitySelection('point');
        });
        document.getElementById('point-mesh-deselect-all')?.addEventListener('click', () => {
            document.querySelectorAll('#point-mesh-list input[type="checkbox"]').forEach(cb => cb.checked = false);
            this.updateMeshVisibilitySelection('point');
        });

        // Category mesh visibility select/deselect all
        document.getElementById('category-mesh-select-all')?.addEventListener('click', () => {
            document.querySelectorAll('#category-mesh-list input[type="checkbox"]').forEach(cb => cb.checked = true);
            this.updateMeshVisibilitySelection('category');
        });
        document.getElementById('category-mesh-deselect-all')?.addEventListener('click', () => {
            document.querySelectorAll('#category-mesh-list input[type="checkbox"]').forEach(cb => cb.checked = false);
            this.updateMeshVisibilitySelection('category');
        });

        // Delete buttons
        document.getElementById('delete-mesh-btn')?.addEventListener('click', () => {
            this.deleteSelected();
        });

        document.getElementById('delete-point-btn')?.addEventListener('click', () => {
            this.deleteSelected();
        });

        // Border property listeners
        document.getElementById('border-name')?.addEventListener('change', (e) => {
            this.updateSelectedBorder({ name: e.target.value });
        });

        document.getElementById('border-type')?.addEventListener('change', (e) => {
            this.updateBorderProperty('borderType', e.target.value);
        });

        document.getElementById('border-color')?.addEventListener('input', (e) => {
            this.updateBorderProperty('color', e.target.value);
        });

        document.getElementById('border-fill-color')?.addEventListener('input', (e) => {
            this.updateBorderProperty('fillColor', e.target.value);
        });

        // Thickness slider and number input sync
        document.getElementById('border-thickness')?.addEventListener('input', (e) => {
            document.getElementById('border-thickness-num').value = e.target.value;
        });

        document.getElementById('border-thickness')?.addEventListener('change', (e) => {
            this.updateBorderProperty('width', parseInt(e.target.value));
        });

        document.getElementById('border-thickness-num')?.addEventListener('input', (e) => {
            const val = Math.min(10000, Math.max(1, parseInt(e.target.value) || 1));
            document.getElementById('border-thickness').value = val;
        });

        document.getElementById('border-thickness-num')?.addEventListener('change', (e) => {
            const val = Math.min(10000, Math.max(1, parseInt(e.target.value) || 1));
            e.target.value = val;
            document.getElementById('border-thickness').value = val;
            this.updateBorderProperty('width', val);
        });

        document.getElementById('border-opacity')?.addEventListener('input', (e) => {
            document.getElementById('border-opacity-val').textContent = e.target.value + '%';
            this.updateBorderProperty('opacity', parseInt(e.target.value));
        });

        document.getElementById('border-loop')?.addEventListener('change', (e) => {
            this.updateBorderProperty('loop', e.target.checked);
        });

        document.getElementById('border-box-style')?.addEventListener('change', (e) => {
            this.updateBorderProperty('boxStyle', e.target.checked);
        });

        document.getElementById('border-fill')?.addEventListener('change', (e) => {
            this.updateBorderProperty('fill', e.target.checked);
        });

        document.getElementById('border-fill-opacity')?.addEventListener('input', (e) => {
            document.getElementById('border-fill-opacity-val').textContent = e.target.value + '%';
        });

        document.getElementById('border-fill-opacity')?.addEventListener('change', (e) => {
            this.updateBorderProperty('fillOpacity', parseInt(e.target.value));
        });

        document.getElementById('border-custom-settings')?.addEventListener('change', (e) => {
            if (State.state.selected.type === 'border' && State.state.selected.id) {
                State.updateInProject('borders', State.state.selected.id, { customSettings: e.target.checked });
            }
        });

        document.getElementById('border-smoothness')?.addEventListener('input', (e) => {
            document.getElementById('border-smoothness-val').textContent = e.target.value;
        });

        document.getElementById('border-smoothness')?.addEventListener('change', (e) => {
            this.updateBorderProperty('smoothness', parseInt(e.target.value));
        });

        document.getElementById('border-edit-points')?.addEventListener('change', (e) => {
            this.updateBorderProperty('showPoints', e.target.checked);
        });

        document.getElementById('border-height')?.addEventListener('input', (e) => {
            document.getElementById('border-height-val').textContent = e.target.value;
        });

        document.getElementById('border-height')?.addEventListener('change', (e) => {
            this.updateBorderProperty('height', parseFloat(e.target.value));
        });

        // Offset controls
        ['x', 'y', 'z'].forEach(axis => {
            document.getElementById(`border-offset-${axis}`)?.addEventListener('change', (e) => {
                const border = State.findById('borders', State.state.selected.id);
                if (!border) return;
                const offset = { ...(border.offset || { x: 0, y: 0, z: 0 }) };
                offset[axis] = parseFloat(e.target.value) || 0;
                this.updateBorderProperty('offset', offset);
            });
        });

        // Border Visibility
        document.getElementById('border-visible-on-load')?.addEventListener('change', (e) => {
            this.updateBorderProperty('visibleOnLoad', e.target.checked);
        });

        // Apply to All Borders button
        document.getElementById('apply-to-all-borders-btn')?.addEventListener('click', () => {
            this.applySettingsToAllBorders();
        });

        document.getElementById('delete-border-btn')?.addEventListener('click', () => {
            this.deleteSelected();
        });



        // Border Drawing Toolbar listeners
        document.getElementById('bdt-save-btn')?.addEventListener('click', () => {
            if (window.Controls && Controls.finishBorderDrawing) {
                Controls.finishBorderDrawing(true);
                State.setTool('select');
            }
            document.getElementById('border-drawing-toolbar')?.classList.add('hidden');
            this.updateBordersList();
        });

        document.getElementById('bdt-cancel-btn')?.addEventListener('click', () => {
            if (window.Controls && Controls.finishBorderDrawing) {
                Controls.finishBorderDrawing(false);
                State.setTool('select');
            }
            document.getElementById('border-drawing-toolbar')?.classList.add('hidden');
        });

        document.getElementById('bdt-color')?.addEventListener('input', (e) => {
            if (window.Controls && Controls.currentBorder) {
                Controls.currentBorder.color = e.target.value;
                Controls._updateTempBorderVisual();
            }
        });

        document.getElementById('bdt-width')?.addEventListener('change', (e) => {
            if (window.Controls && Controls.currentBorder) {
                Controls.currentBorder.width = parseInt(e.target.value);
            }
        });

        // Duplicate buttons
        document.getElementById('duplicate-point-btn')?.addEventListener('click', () => {
            const id = State.state.selected.id;
            if (id) this.duplicatePoint(id);
        });

        document.getElementById('duplicate-mesh-btn')?.addEventListener('click', () => {
            const id = State.state.selected.id;
            if (id) this.duplicateMesh(id);
        });

        document.getElementById('duplicate-textbox-btn')?.addEventListener('click', () => {
            const id = State.state.selected.id;
            if (id) this.duplicateTextbox(id);
        });

        // Gizmo mode buttons
        document.querySelectorAll('.gizmo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                Renderer.setTransformMode(mode);

                // Update active state
                document.querySelectorAll('.gizmo-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Media remove buttons
        document.querySelectorAll('.media-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const mediaType = btn.dataset.media;
                this.removeTextboxMedia(mediaType);
            });
        });

        // Video source toggle
        document.querySelectorAll('input[name="video-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('video-upload-section').classList.toggle('hidden', isUrl);
                document.getElementById('video-url-section').classList.toggle('hidden', !isUrl);
            });
        });

        // Audio source toggle
        document.querySelectorAll('input[name="audio-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('audio-upload-section').classList.toggle('hidden', isUrl);
                document.getElementById('audio-url-section').classList.toggle('hidden', !isUrl);
            });
        });

        // Video URL input
        document.getElementById('textbox-video-url')?.addEventListener('change', (e) => {
            const url = e.target.value.trim();
            if (url) {
                this.setTextboxMediaUrl('video', url);
            }
        });

        // Audio URL input
        document.getElementById('textbox-audio-url')?.addEventListener('change', (e) => {
            const url = e.target.value.trim();
            if (url) {
                this.setTextboxMediaUrl('audio', url);
            }
        });

        // Preview audio button
        document.getElementById('preview-audio')?.addEventListener('click', () => {
            this.previewTextboxAudio();
        });

        // Default view buttons (Desktop)
        document.getElementById('set-default-view')?.addEventListener('click', () => {
            this.setDefaultCameraView();
        });

        document.getElementById('preview-default-view')?.addEventListener('click', () => {
            this.previewDefaultCameraView();
        });

        // Default view buttons (Mobile)
        document.getElementById('set-default-view-mobile')?.addEventListener('click', () => {
            this.setDefaultCameraViewMobile();
        });

        document.getElementById('preview-default-view-mobile')?.addEventListener('click', () => {
            this.previewDefaultCameraViewMobile();
        });

        // Recenter button
        document.getElementById('recenter-btn')?.addEventListener('click', () => {
            this.goToDefaultView();
        });

        // Global search
        this.setupGlobalSearch();
    },

    // Remove media from textbox
    removeTextboxMedia(mediaType) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'textbox') return;

        const textbox = State.findById('textboxes', id);
        if (!textbox) return;

        if (!textbox.media) textbox.media = {};

        if (mediaType === 'image') {
            delete textbox.media.image;
            document.getElementById('textbox-image-preview')?.classList.add('hidden');
        } else if (mediaType === 'video') {
            delete textbox.media.video;
            document.getElementById('textbox-video-preview')?.classList.add('hidden');
        } else if (mediaType === 'audio') {
            delete textbox.media.audio;
            document.getElementById('textbox-audio-preview')?.classList.add('hidden');
        }

        State.emit('projectChange', { path: 'textboxes', action: 'update', id });
        this.showToast('success', 'Media Removed');
    },

    // Update per-language image preview
    updateLangImagePreview(lang) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'textbox') return;

        const textbox = State.findById('textboxes', id);
        if (!textbox?.media?.images?.[lang]) return;

        const preview = document.querySelector(`.lang-image-preview[data-lang="${lang}"]`);
        if (preview) {
            preview.querySelector('img').src = textbox.media.images[lang];
            preview.classList.remove('hidden');
        }
    },

    // Remove per-language image
    removeLangImage(lang) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'textbox') return;

        const textbox = State.findById('textboxes', id);
        if (!textbox) return;

        if (textbox.media?.images?.[lang]) {
            delete textbox.media.images[lang];
        }

        // Hide the preview
        const preview = document.querySelector(`.lang-image-preview[data-lang="${lang}"]`);
        if (preview) {
            preview.classList.add('hidden');
            preview.querySelector('img').src = '';
        }

        State.emit('projectChange', { path: 'textboxes', action: 'update', id });
        this.showToast('success', `Image Removed (${lang.toUpperCase()})`);
    },

    // Load all per-language image previews for a textbox
    loadLangImagePreviews(textbox) {
        // Reset all previews first
        document.querySelectorAll('.lang-image-preview').forEach(preview => {
            preview.classList.add('hidden');
            preview.querySelector('img').src = '';
        });

        if (!textbox?.media?.images) return;

        // Show previews for images that exist
        Object.keys(textbox.media.images).forEach(lang => {
            const preview = document.querySelector(`.lang-image-preview[data-lang="${lang}"]`);
            if (preview && textbox.media.images[lang]) {
                preview.querySelector('img').src = textbox.media.images[lang];
                preview.classList.remove('hidden');
            }
        });
    },

    // Set media URL for textbox
    setTextboxMediaUrl(mediaType, url) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'textbox') return;

        const textbox = State.findById('textboxes', id);
        if (!textbox) return;

        if (!textbox.media) textbox.media = {};

        if (mediaType === 'video') {
            textbox.media.video = url;
            document.getElementById('textbox-video-preview')?.classList.remove('hidden');
            document.querySelector('#textbox-video-preview .media-name').textContent = 'Video URL';
        } else if (mediaType === 'audio') {
            // Store URL in audio object (using 'url' key for URL-based audio)
            textbox.media.audio = { url: url };
            document.getElementById('textbox-audio-preview')?.classList.remove('hidden');
            document.querySelector('#textbox-audio-preview .media-name').textContent = 'Audio URL';
        }

        State.emit('projectChange', { path: 'textboxes', action: 'update', id });
        this.showToast('success', `${mediaType === 'video' ? 'Video' : 'Audio'} URL saved`);
    },

    // Preview textbox audio
    previewTextboxAudio() {
        const id = State.state.selected.id;
        if (!id) return;

        const textbox = State.findById('textboxes', id);
        if (!textbox?.media?.audio) return;

        const audioSrc = textbox.media.audio['en'] || Object.values(textbox.media.audio)[0];
        if (!audioSrc) return;

        // Use ContentManager's audio player
        if (ContentManager.audioPlayer.paused) {
            ContentManager.audioPlayer.src = audioSrc;
            ContentManager.audioPlayer.play();
            document.getElementById('preview-audio').textContent = '⏸';
        } else {
            ContentManager.audioPlayer.pause();
            document.getElementById('preview-audio').textContent = '▶';
        }
    },

    // Setup global search functionality
    setupGlobalSearch() {
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');
        const searchResults = document.getElementById('search-results');

        if (!searchInput) return;

        // Search as user types
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();

            if (query.length === 0) {
                searchResults.classList.add('hidden');
                searchClear.classList.add('hidden');
                return;
            }

            searchClear.classList.remove('hidden');
            this.performSearch(query);
        });

        // Clear button
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchResults.classList.add('hidden');
            searchClear.classList.add('hidden');
        });

        // Close results on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.global-search')) {
                searchResults.classList.add('hidden');
            }
        });

        // Focus input to show results
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length > 0) {
                this.performSearch(searchInput.value.trim().toLowerCase());
            }
        });
    },

    // Perform search
    performSearch(query) {
        const searchResults = document.getElementById('search-results');
        const points = State.getProject('points');
        const categories = State.getProject('categories');
        const currentLang = ContentManager.activeLanguage || 'en';

        // Search points
        const results = points.filter(point => {
            // Search in all language names
            const names = Object.values(point.names || {}).join(' ').toLowerCase();
            const defaultName = (point.name || '').toLowerCase();

            // Get category name
            const category = categories.find(c => c.id === point.categoryId);
            const catNames = category ? Object.values(category.names || {}).join(' ').toLowerCase() : '';
            const catDefault = category ? (category.name || '').toLowerCase() : '';

            return names.includes(query) ||
                defaultName.includes(query) ||
                catNames.includes(query) ||
                catDefault.includes(query);
        });

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No points found</div>';
            searchResults.classList.remove('hidden');
            return;
        }

        // Render results
        searchResults.innerHTML = results.slice(0, 8).map(point => {
            const pointName = point.names?.[currentLang] || point.names?.['en'] || point.name;
            const category = categories.find(c => c.id === point.categoryId);
            const catName = category ? (category.names?.[currentLang] || category.names?.['en'] || category.name) : 'Uncategorized';

            return `
                <div class="search-result-item" data-point-id="${point.id}">
                    <span class="search-result-icon">📍</span>
                    <div class="search-result-info">
                        <div class="search-result-name">${pointName}</div>
                        <div class="search-result-category">${catName}</div>
                    </div>
                </div>
            `;
        }).join('');

        searchResults.classList.remove('hidden');

        // Click handlers
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const pointId = item.dataset.pointId;
                this.focusAndOpenPoint(pointId);

                // Clear search
                document.getElementById('search-input').value = '';
                searchResults.classList.add('hidden');
                document.getElementById('search-clear').classList.add('hidden');
            });
        });
    },

    // Set current camera position as default view
    setDefaultCameraView() {
        const camera = Renderer.camera;
        const controls = Renderer.controls;

        const defaultView = {
            position: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            },
            target: {
                x: controls.target.x,
                y: controls.target.y,
                z: controls.target.z
            }
        };

        State.setProject('settings.defaultView', defaultView);
        this.updateDefaultViewStatus(true);
        this.showToast('success', 'Default View Set', 'This will be the starting position');
    },

    // Preview the default view
    previewDefaultCameraView() {
        const defaultView = State.getProject('settings').defaultView;

        if (!defaultView) {
            this.showToast('warning', 'No Default View', 'Set a default view first');
            return;
        }

        Renderer.goToView(defaultView);
    },

    // Go to default view (recenter)
    goToDefaultView() {
        const defaultView = State.getProject('settings')?.defaultView;

        if (defaultView) {
            Renderer.goToView(defaultView);
        } else {
            // Fallback to initial camera position
            Renderer.animateCameraTo(
                { x: 50, y: 50, z: 50 },
                { x: 0, y: 0, z: 0 }
            );
        }
    },

    // Update default view status display
    updateDefaultViewStatus(isSet, isMobile = false) {
        const statusId = isMobile ? 'default-view-status-mobile' : 'default-view-status';
        const status = document.getElementById(statusId);
        if (!status) return;

        if (isSet) {
            status.classList.add('set');
            const label = isMobile ? 'Mobile view saved' : 'Desktop view saved';
            status.innerHTML = `
                <span class="status-icon">✓</span>
                <span class="status-text">${label}</span>
            `;
        } else {
            status.classList.remove('set');
            const label = isMobile ? 'No mobile view set (will use desktop view)' : 'No desktop view set';
            status.innerHTML = `
                <span class="status-icon">⚠️</span>
                <span class="status-text">${label}</span>
            `;
        }
    },

    // Set current camera position as mobile default view
    setDefaultCameraViewMobile() {
        const camera = Renderer.camera;
        const controls = Renderer.controls;

        const mobileView = {
            position: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            },
            target: {
                x: controls.target.x,
                y: controls.target.y,
                z: controls.target.z
            }
        };

        State.setProject('settings.defaultViewMobile', mobileView);
        this.updateDefaultViewStatus(true, true);
        this.showToast('success', 'Mobile View Set', 'This will be used on mobile devices');
    },

    // Preview the mobile default view
    previewDefaultCameraViewMobile() {
        const mobileView = State.getProject('settings').defaultViewMobile;

        if (!mobileView) {
            this.showToast('warning', 'No Mobile View', 'Set a mobile view first');
            return;
        }

        Renderer.goToView(mobileView);
    },

    // Setup modal listeners
    setupModalListeners() {
        // Close modal on overlay click
        document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                this.closeModal();
            }
        });
    },

    // Update properties panel based on selection
    updatePropertiesPanel(selection = State.state.selected) {
        // Hide all property sections
        document.querySelectorAll('.properties-section').forEach(section => {
            section.classList.add('hidden');
        });

        if (!selection.id) {
            document.getElementById('props-empty').classList.remove('hidden');
            return;
        }

        document.getElementById('props-empty').classList.add('hidden');

        switch (selection.type) {
            case 'mesh':
                this.showMeshProperties(selection.id);
                break;
            case 'point':
                this.showPointProperties(selection.id);
                break;
            case 'textbox':
                this.showTextboxProperties(selection.id);
                break;
            case 'actionButton':
                this.showActionButtonProperties(selection.id);
                break;
            case 'category':
                this.showCategoryProperties(selection.id);
                break;
            case 'camera':
                document.getElementById('props-camera').classList.remove('hidden');
                // Update default view status
                const hasDefaultView = !!State.getProject('settings')?.defaultView;
                this.updateDefaultViewStatus(hasDefaultView);
                break;
            case 'border':
                this.showBorderProperties(selection.id);
                break;
        }
    },

    // Show border properties
    showBorderProperties(id) {
        const border = State.findById('borders', id);
        if (!border) return;

        document.getElementById('props-border').classList.remove('hidden');

        // Populate fields
        document.getElementById('border-name').value = border.name || '';
        document.getElementById('border-type').value = border.borderType || 'tube';
        document.getElementById('border-color').value = border.color || '#FFFF00';
        document.getElementById('border-fill-color').value = border.fillColor || border.color || '#FFFF00';

        const visibleOnLoad = document.getElementById('border-visible-on-load');
        if (visibleOnLoad) visibleOnLoad.checked = border.visibleOnLoad !== false;
        document.getElementById('border-thickness').value = border.width || 50;
        document.getElementById('border-thickness-num').value = border.width || 50;
        document.getElementById('border-opacity').value = border.opacity ?? 100;
        document.getElementById('border-opacity-val').textContent = (border.opacity ?? 100) + '%';

        document.getElementById('border-fill-opacity').value = border.fillOpacity ?? border.opacity ?? 100;
        document.getElementById('border-fill-opacity-val').textContent = (border.fillOpacity ?? border.opacity ?? 100) + '%';

        document.getElementById('border-smoothness').value = border.smoothness ?? 50;
        document.getElementById('border-smoothness-val').textContent = border.smoothness ?? 50;

        // Toggles
        const loopCheckbox = document.getElementById('border-loop');
        if (loopCheckbox) loopCheckbox.checked = border.loop !== false;

        const boxStyleCheckbox = document.getElementById('border-box-style');
        if (boxStyleCheckbox) boxStyleCheckbox.checked = border.boxStyle === true;

        const fillCheckbox = document.getElementById('border-fill');
        if (fillCheckbox) fillCheckbox.checked = border.fill === true;

        const customCheckbox = document.getElementById('border-custom-settings');
        if (customCheckbox) customCheckbox.checked = border.customSettings !== false; // Default ON

        const editPointsCheckbox = document.getElementById('border-edit-points');
        if (editPointsCheckbox) editPointsCheckbox.checked = border.showPoints === true;

        // Height (default 1.0 to prevent flickering)
        const height = border.height !== undefined ? border.height : 1.0;
        document.getElementById('border-height').value = height;
        document.getElementById('border-height-val').textContent = height;

        // Offset
        const offset = border.offset || { x: 0, y: 0, z: 0 };
        document.getElementById('border-offset-x').value = offset.x || 0;
        document.getElementById('border-offset-y').value = offset.y || 0;
        document.getElementById('border-offset-z').value = offset.z || 0;
    },

    // Update border property - respects custom settings toggle
    updateBorderProperty(property, value) {
        const customSettings = document.getElementById('border-custom-settings')?.checked;
        const selectedId = State.state.selected.id;

        if (State.state.selected.type !== 'border' || !selectedId) return;

        if (customSettings) {
            // Only update this border
            State.updateInProject('borders', selectedId, { [property]: value });
            this.refreshBorder(selectedId);
        } else {
            // Update all borders (except those with customSettings enabled)
            const borders = State.getProject('borders') || [];
            borders.forEach(border => {
                // If another border has custom settings, don't overwrite it
                if (border.id !== selectedId && border.customSettings) return;

                State.updateInProject('borders', border.id, { [property]: value });
                this.refreshBorder(border.id);
            });
        }
        this.updateBordersList();
    },

    // Apply current border settings to all borders
    applySettingsToAllBorders() {
        const selectedId = State.state.selected.id;
        if (State.state.selected.type !== 'border' || !selectedId) return;

        const sourceBorder = State.findById('borders', selectedId);
        if (!sourceBorder) return;

        // Properties to copy (excluding name, id, points)
        const propsToCopy = ['color', 'width', 'widthScale', 'opacity', 'loop', 'fill', 'height', 'offset'];

        const borders = State.getProject('borders') || [];
        borders.forEach(border => {
            if (border.id !== selectedId) {
                const updates = {};
                propsToCopy.forEach(prop => {
                    if (sourceBorder[prop] !== undefined) {
                        updates[prop] = sourceBorder[prop];
                    }
                });
                State.updateInProject('borders', border.id, updates);
                this.refreshBorder(border.id);
            }
        });

        this.updateBordersList();
        this.showToast('success', 'Settings Applied', `Applied to ${borders.length - 1} other borders`);
    },

    // Refresh a specific border
    refreshBorder(id) {
        const border = State.findById('borders', id);
        if (border && Renderer.addBorder) {
            Renderer.addBorder(border);
        }
    },

    // Refresh/regenerate the selected border visual
    refreshSelectedBorder() {
        if (State.state.selected.type !== 'border') return;
        this.refreshBorder(State.state.selected.id);
    },



    showMeshProperties(id) {
        const mesh = State.findById('meshes', id);
        if (!mesh) return;

        document.getElementById('props-model').classList.remove('hidden');

        document.getElementById('model-filename').textContent = mesh.filename;
        document.getElementById('model-name').value = mesh.name;
        document.getElementById('model-subtitle').value = mesh.subtitle || '';

        // Transform - display actual values, default to proper values if not set
        document.getElementById('model-pos-x').value = mesh.position?.x ?? 0;
        document.getElementById('model-pos-y').value = mesh.position?.y ?? 0;
        document.getElementById('model-pos-z').value = mesh.position?.z ?? 0;
        document.getElementById('model-rot-x').value = mesh.rotation?.x ?? 0;
        document.getElementById('model-rot-y').value = mesh.rotation?.y ?? 0;
        document.getElementById('model-rot-z').value = mesh.rotation?.z ?? 0;

        // Scale should default to 1, not 100
        const scaleX = mesh.scale?.x ?? 1;
        const scaleY = mesh.scale?.y ?? 1;
        const scaleZ = mesh.scale?.z ?? 1;
        document.getElementById('model-scale-x').value = scaleX;
        document.getElementById('model-scale-y').value = scaleY;
        document.getElementById('model-scale-z').value = scaleZ;

        // Visibility options
        const visibleOnLoad = document.getElementById('mesh-visible-on-load');
        if (visibleOnLoad) {
            visibleOnLoad.checked = mesh.visibleOnLoad !== false;
        }

        // Platform loading options
        ['pc', 'android', 'ios'].forEach(platform => {
            const cb = document.getElementById(`mesh-load-${platform}`);
            if (cb) {
                cb.checked = mesh.platforms ? mesh.platforms[platform] !== false : true;
            }
        });

        const triggerType = document.getElementById('mesh-visibility-trigger');
        if (triggerType) {
            triggerType.value = mesh.visibilityTrigger?.type || 'none';
            this.updateMeshVisibilityTriggerOptions(mesh.visibilityTrigger?.type || 'none', mesh.visibilityTrigger?.targetId);
        }

        // Toggle Button (sidebar mesh toggle) checkbox & options
        // Toggle Button POPULATION
        const toggleBtnCheckbox = document.getElementById('mesh-toggle-button-enabled');
        const toggleOptions = document.getElementById('mesh-toggle-options');
        const toggleTooltipInput = document.getElementById('mesh-toggle-tooltip');

        if (toggleBtnCheckbox) toggleBtnCheckbox.checked = mesh.toggleButtonEnabled === true;
        if (toggleOptions) toggleOptions.style.display = mesh.toggleButtonEnabled ? '' : 'none';
        if (toggleTooltipInput) toggleTooltipInput.value = mesh.toggleTooltip || '';

        // Custom Icon Preview for Toggle
        const iconPreview = document.getElementById('mesh-toggle-icon-preview');
        const iconActions = document.getElementById('mesh-toggle-icon-actions');
        if (iconPreview) {
            if (mesh.toggleIcon) {
                iconPreview.innerHTML = `<img src="${mesh.toggleIcon}" alt="icon">`;
                iconActions?.classList.remove('hidden');
            } else {
                iconPreview.innerHTML = '<span class="upload-placeholder">🖼️</span>';
                iconActions?.classList.add('hidden');
            }
        }

        // Texture Variant POPULATION
        const tv = mesh.textureVariant || {};
        const tvEnabled = document.getElementById('mesh-texture-variant-enabled');
        const tvOptions = document.getElementById('mesh-texture-variant-options');
        const tvHint = document.getElementById('mesh-texture-variant-hint');
        const tvBrightness = document.getElementById('mesh-texture-variant-brightness');
        const tvBrightnessVal = document.getElementById('mesh-texture-variant-brightness-val');
        const tvTooltip = document.getElementById('mesh-texture-variant-tooltip');
        const tvIconPreview = document.getElementById('mesh-texture-variant-icon-preview');
        const tvIconActions = document.getElementById('mesh-texture-variant-icon-actions');

        if (tvEnabled) tvEnabled.checked = tv.enabled === true;
        if (tvOptions) tvOptions.style.display = tv.enabled ? '' : 'none';
        if (tvHint) tvHint.style.display = tv.enabled ? '' : 'none';

        if (tvBrightness) tvBrightness.value = (typeof tv.brightness === 'number') ? tv.brightness : 100;
        if (tvBrightnessVal) tvBrightnessVal.textContent = ((typeof tv.brightness === 'number') ? tv.brightness : 100) + '%';
        if (tvTooltip) tvTooltip.value = tv.tooltip || '';

        if (tvIconPreview) {
            if (tv.icon) {
                tvIconPreview.innerHTML = `<img src="${tv.icon}" alt="icon">`;
                tvIconActions?.classList.remove('hidden');
            } else {
                tvIconPreview.innerHTML = '<span class="upload-placeholder">🖼️</span>';
                tvIconActions?.classList.add('hidden');
            }
        }
        // End Texture Variant Population

        // Tooltip
        if (toggleTooltipInput) {
            toggleTooltipInput.value = mesh.toggleTooltip || '';
        }

        // Measurement enabled (default true if not set)
        const measurementCheckbox = document.getElementById('mesh-measurement-enabled');
        if (measurementCheckbox) {
            measurementCheckbox.checked = mesh.measurementEnabled !== false; // Default true
        }

        // World unit settings
        const worldUnit = document.getElementById('world-unit');
        const worldUnitType = document.getElementById('world-unit-type');
        if (worldUnit) worldUnit.value = State.getProject('settings.worldUnit') || 100;
        if (worldUnitType) worldUnitType.value = State.getProject('settings.worldUnitType') || 'meters';

        // Animations
        if (mesh.animations && mesh.animations.length > 0) {
            document.getElementById('animation-settings').style.display = '';
            const clipSelect = document.getElementById('anim-clip');
            clipSelect.innerHTML = mesh.animations.map((anim, i) =>
                `<option value="${i}">${anim.name || `Animation ${i + 1}`}</option>`
            ).join('');

            // Show animation panel in viewport
            document.getElementById('animation-panel')?.classList.remove('hidden');
        } else {
            document.getElementById('animation-settings').style.display = 'none';
            document.getElementById('animation-panel')?.classList.add('hidden');
        }
    },

    // Update mesh visibility trigger target options
    updateMeshVisibilityTriggerOptions(type, currentTargetId) {
        const targetRow = document.getElementById('mesh-visibility-target-row');
        const targetSelect = document.getElementById('mesh-visibility-target');

        if (!targetRow || !targetSelect) return;

        if (type === 'none') {
            targetRow.style.display = 'none';
            return;
        }

        targetRow.style.display = '';
        let options = '<option value="">Select...</option>';

        if (type === 'category') {
            const categories = State.getProject('categories') || [];
            options += categories.map(cat =>
                `<option value="${cat.id}" ${currentTargetId === cat.id ? 'selected' : ''}>${cat.icon || ''} ${cat.names?.en || cat.name || 'Unnamed'}</option>`
            ).join('');
        } else if (type === 'point') {
            const points = State.getProject('points') || [];
            options += points.map(p =>
                `<option value="${p.id}" ${currentTargetId === p.id ? 'selected' : ''}>${p.name || 'Unnamed Point'}</option>`
            ).join('');
        } else if (type === 'actionButton') {
            const actionButtons = State.getProject('actionButtons') || [];
            options += actionButtons.map(btn =>
                `<option value="${btn.id}" ${currentTargetId === btn.id ? 'selected' : ''}>${btn.icon || ''} ${btn.name || 'Unnamed Button'}</option>`
            ).join('');
        }

        targetSelect.innerHTML = options;
    },

    showPointProperties(id) {
        const point = State.findById('points', id);
        if (!point) return;

        document.getElementById('props-point').classList.remove('hidden');

        document.getElementById('point-name').value = point.name;

        // Update category dropdown
        const categorySelect = document.getElementById('point-category');
        categorySelect.innerHTML = '<option value="">None</option>' +
            State.getProject('categories').map(cat =>
                `<option value="${cat.id}" ${cat.id === point.categoryId ? 'selected' : ''}>${cat.name}</option>`
            ).join('');

        // Update content dropdown
        const contentSelect = document.getElementById('point-content');
        const searchInput = document.getElementById('point-content-search');
        if (searchInput) searchInput.value = ''; // Clear search on new selection

        const textboxOptions = ContentManager.getTextboxOptions();
        const panoramaOptions = ContentManager.getMediaOptions('panorama');

        let contentHtml = '<option value="">None</option>';

        if (textboxOptions.length > 0) {
            contentHtml += `<optgroup label="Text Boxes">
                ${textboxOptions.map(tb => `<option value="${tb.id}" data-type="textbox" ${tb.id === point.contentId ? 'selected' : ''}>${tb.name}</option>`).join('')}
            </optgroup>`;
        }

        if (panoramaOptions.length > 0) {
            contentHtml += `<optgroup label="360 Panoramas">
                ${panoramaOptions.map(pan => `<option value="${pan.id}" data-type="panorama" ${pan.id === point.contentId ? 'selected' : ''}>${pan.name}</option>`).join('')}
            </optgroup>`;
        }

        contentSelect.innerHTML = contentHtml;

        // Point type toggle
        document.querySelectorAll('#props-point .toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === point.type);
        });

        // Populate multilingual names
        const namesContainer = document.getElementById('point-names-container');
        const languages = State.getProject('languages');
        if (!point.names) point.names = { en: point.name };

        namesContainer.innerHTML = languages.map(lang => `
            <div class="prop-row">
                <label class="lang-label">${lang.code.toUpperCase()}</label>
                <input type="text" class="point-name-lang" data-lang="${lang.code}"
                       value="${point.names[lang.code] || ''}"
                       placeholder="Name in ${lang.name}"
                       dir="${['ar', 'he', 'fa', 'ur'].includes(lang.code) ? 'rtl' : 'ltr'}">
            </div>
        `).join('');

        // Add change handlers for multilingual names
        namesContainer.querySelectorAll('.point-name-lang').forEach(input => {
            input.addEventListener('change', () => {
                const lang = input.dataset.lang;
                if (!point.names) point.names = {};
                point.names[lang] = input.value;

                // Update default name if English changed
                if (lang === 'en') {
                    point.name = input.value;
                    document.getElementById('point-name').value = input.value;
                }

                State.emit('projectChange', { path: 'points', action: 'update', id });
                this.syncPointContentName(id, lang, input.value);
            });
        });

        // Position
        document.getElementById('point-pos-x').value = point.position?.x || 0;
        document.getElementById('point-pos-y').value = point.position?.y || 0;
        document.getElementById('point-pos-z').value = point.position?.z || 0;

        // Lifted
        document.getElementById('point-lifted').checked = point.lifted;
        document.getElementById('lift-height-row').style.display = point.lifted ? '' : 'none';
        document.getElementById('point-lift-height').value = point.liftHeight || 5;

        // Style
        document.getElementById('point-color').value = point.style?.color || '#00C8FF';
        document.getElementById('point-scale').value = point.style?.scale || 1;
        document.querySelector('#props-point .range-value').textContent = `${point.style?.scale || 1}x`;

        // Icon type
        const iconType = point.style?.iconType || 'default';
        document.getElementById('point-icon').value = iconType === 'custom' ? 'custom' : 'default';

        const customRow = document.getElementById('custom-icon-row');
        const preview = document.getElementById('point-icon-preview');
        const actions = document.getElementById('point-icon-actions');

        if (iconType === 'custom' && point.style?.customIcon) {
            customRow?.classList.remove('hidden');
            preview.innerHTML = `<img src="${point.style.customIcon}" alt="icon">`;
            actions?.classList.remove('hidden');
        } else {
            customRow?.classList.add('hidden');
            preview.innerHTML = '<span class="upload-placeholder">🖼️ Click to upload</span>';
            actions?.classList.add('hidden');
        }

        // Show icon in menu toggle
        const showIconToggle = document.getElementById('point-show-icon-in-menu');
        const menuIconHint = document.getElementById('menu-icon-hint');
        if (showIconToggle) {
            showIconToggle.checked = point.showIconInMenu === true;
            // Show hint if enabled but no custom icon
            if (menuIconHint) {
                menuIconHint.style.display = (point.showIconInMenu && iconType !== 'custom') ? '' : 'none';
            }
        }

        // Click sound
        const clickSound = point.clickSound || { source: 'none', url: '' };
        document.getElementById('point-click-sound-source').value = clickSound.source || 'none';
        document.getElementById('point-sound-url-section').classList.toggle('hidden', clickSound.source !== 'url');
        document.getElementById('point-click-sound-url').value = clickSound.url || '';

        // Mesh visibility checkboxes
        this.populateMeshCheckboxes('point', point.visibilityMeshes || []);

        // Border visibility checkboxes
        this.populateBorderCheckboxes('point', point.visibilityBorders || []);

        // Show 3D Mesh toggle (for point marker mesh feature)
        const show3DMeshToggle = document.getElementById('point-show-3d-mesh');
        if (show3DMeshToggle) {
            // Default to true if not set
            show3DMeshToggle.checked = point.show3DMesh !== false;
        }

        // Mesh scale for 3D marker
        const meshScaleSlider = document.getElementById('point-mesh-scale');
        const meshScaleValue = document.getElementById('point-mesh-scale-value');
        if (meshScaleSlider) {
            const scale = point.meshScale || 1;
            meshScaleSlider.value = scale;
            if (meshScaleValue) meshScaleValue.textContent = scale + 'x';
        }

        // Apply to all points checkbox
        const applyAllCheckbox = document.getElementById('point-mesh-scale-apply-all');
        if (applyAllCheckbox) {
            applyAllCheckbox.checked = false; // Always start unchecked (user must explicitly choose to apply all)
        }
    },

    // Populate mesh checkboxes for point or category
    populateMeshCheckboxes(type, selectedMeshes) {
        const container = document.getElementById(`${type}-mesh-list`);
        if (!container) return;

        const meshes = State.getProject('meshes') || [];

        if (meshes.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); font-size: 12px; padding: 8px;">No meshes uploaded yet.</p>';
            return;
        }

        container.innerHTML = meshes.map(mesh => `
            <div class="mesh-checkbox-item">
                <input type="checkbox" 
                       id="${type}-mesh-${mesh.id}" 
                       data-mesh-id="${mesh.id}"
                       ${selectedMeshes.includes(mesh.id) ? 'checked' : ''}>
                <label for="${type}-mesh-${mesh.id}">
                    <div>${mesh.name}</div>
                    <div class="mesh-filename">${mesh.filename}</div>
                </label>
            </div>
        `).join('');

        // Add change listeners
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateMeshVisibilitySelection(type);
            });
        });
    },

    // Update mesh visibility selection for point or category
    updateMeshVisibilitySelection(type) {
        const container = document.getElementById(`${type}-mesh-list`);
        if (!container) return;

        const selectedMeshes = [];
        container.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedMeshes.push(checkbox.dataset.meshId);
        });

        if (type === 'point') {
            this.updateSelectedPoint({ visibilityMeshes: selectedMeshes });
        } else if (type === 'category') {
            this.updateSelectedCategory({ visibilityMeshes: selectedMeshes });
        }
    },

    // Populate border checkboxes
    populateBorderCheckboxes(type, selectedBorders) {
        const container = document.getElementById(`${type}-border-list`);
        if (!container) return;

        const borders = State.getProject('borders') || [];

        if (borders.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); font-size: 12px; padding: 8px;">No borders drawn.</p>';
            return;
        }

        container.innerHTML = borders.map(border => `
            <div class="mesh-checkbox-item">
                <input type="checkbox" 
                       id="${type}-border-${border.id}" 
                       data-border-id="${border.id}"
                       ${selectedBorders.includes(border.id) ? 'checked' : ''}>
                <label for="${type}-border-${border.id}">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="color: ${border.color || '#FFFF00'}; font-size: 12px;">▢</span>
                        ${border.name || 'Unnamed Border'}
                    </div>
                </label>
            </div>
        `).join('');

        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateBorderVisibilitySelection(type);
            });
        });

        const selectAllBtn = document.getElementById(`${type}-border-select-all`);
        const deselectAllBtn = document.getElementById(`${type}-border-deselect-all`);

        if (selectAllBtn) {
            selectAllBtn.onclick = () => {
                container.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = true);
                this.updateBorderVisibilitySelection(type);
            };
        }
        if (deselectAllBtn) {
            deselectAllBtn.onclick = () => {
                container.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
                this.updateBorderVisibilitySelection(type);
            };
        }
    },

    updateBorderVisibilitySelection(type) {
        const container = document.getElementById(`${type}-border-list`);
        if (!container) return;
        const selectedBorders = [];
        container.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedBorders.push(checkbox.dataset.borderId);
        });
        if (type === 'point') this.updateSelectedPoint({ visibilityBorders: selectedBorders });
    },

    showTextboxProperties(id) {
        const textbox = State.findById('textboxes', id);
        if (!textbox) return;

        document.getElementById('props-textbox').classList.remove('hidden');

        document.getElementById('textbox-id').value = id;

        // Language selector
        const langSelect = document.getElementById('textbox-language');
        langSelect.innerHTML = State.getProject('languages').map(lang =>
            `<option value="${lang.code}">${lang.name}</option>`
        ).join('');

        // Load content for current language
        const lang = langSelect.value || 'en';
        const content = textbox.content[lang] || {};

        document.getElementById('textbox-heading').value = content.heading || '';
        document.getElementById('textbox-body').value = content.body || '';

        // Load styling values
        const style = textbox.style || {};
        document.getElementById('textbox-header-color').value = style.headerColor || '#00C8FF';
        document.getElementById('textbox-header-text-color').value = style.headerTextColor || '#FFFFFF';
        document.getElementById('textbox-font-family').value = style.fontFamily || 'Calibri';
        document.getElementById('textbox-font-size').value = style.fontSize || '';
        document.getElementById('textbox-line-height').value = style.lineHeight || '1.8';

        // Update media previews
        this.updateTextboxMediaPreviews(textbox);

        // Build per-language audio inputs
        this.buildTextboxAudioInputs(textbox);

        // Load Google Maps URL
        const mapUrlInput = document.getElementById('textbox-map-url');
        mapUrlInput.value = textbox.media?.mapUrl || '';
        mapUrlInput.onchange = (e) => {
            if (!textbox.media) textbox.media = {};
            const url = e.target.value.trim();
            if (url) {
                textbox.media.mapUrl = url;
            } else {
                delete textbox.media.mapUrl;
            }
            State.markDirty();
            this.showToast('success', url ? 'Map URL saved' : 'Map URL removed');
        };

        // Language change handler
        langSelect.onchange = () => {
            const newLang = langSelect.value;
            const newContent = textbox.content[newLang] || {};
            document.getElementById('textbox-heading').value = newContent.heading || '';
            document.getElementById('textbox-body').value = newContent.body || '';
        };
    },

    // Build per-language audio input rows
    buildTextboxAudioInputs(textbox) {
        const container = document.getElementById('textbox-audio-languages');
        if (!container) return;

        const languages = State.getProject('languages') || [];
        const audioData = textbox.media?.audio || {};

        let html = '';
        languages.forEach(lang => {
            const audioUrl = audioData[lang.code] || '';
            const hasAudio = audioUrl ? 'has-audio' : '';

            html += `
                <div class="audio-lang-row" data-lang="${lang.code}">
                    <span class="lang-code">${lang.code}</span>
                    <input type="text" 
                           class="audio-url-input ${hasAudio}" 
                           data-lang="${lang.code}" 
                           value="${audioUrl}" 
                           placeholder="Audio URL for ${lang.name}...">
                    <button class="audio-btn audio-btn-upload" data-lang="${lang.code}" title="Upload">📁</button>
                    <button class="audio-btn audio-btn-play ${audioUrl ? '' : 'hidden'}" data-lang="${lang.code}" title="Preview">▶</button>
                    <button class="audio-btn audio-btn-clear ${audioUrl ? '' : 'hidden'}" data-lang="${lang.code}" title="Clear">✕</button>
                </div>
            `;
        });

        container.innerHTML = html;

        // Attach event handlers
        this.attachTextboxAudioHandlers(textbox);
    },

    // Attach event handlers for per-language audio inputs
    attachTextboxAudioHandlers(textbox) {
        const container = document.getElementById('textbox-audio-languages');
        if (!container) return;

        // URL input change handlers
        container.querySelectorAll('.audio-url-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const lang = e.target.dataset.lang;
                const url = e.target.value.trim();

                if (!textbox.media) textbox.media = {};
                if (!textbox.media.audio) textbox.media.audio = {};

                if (url) {
                    textbox.media.audio[lang] = url;
                    e.target.classList.add('has-audio');
                    e.target.closest('.audio-lang-row').querySelector('.audio-btn-play').classList.remove('hidden');
                    e.target.closest('.audio-lang-row').querySelector('.audio-btn-clear').classList.remove('hidden');
                } else {
                    delete textbox.media.audio[lang];
                    e.target.classList.remove('has-audio');
                    e.target.closest('.audio-lang-row').querySelector('.audio-btn-play').classList.add('hidden');
                    e.target.closest('.audio-lang-row').querySelector('.audio-btn-clear').classList.add('hidden');
                }

                State.markDirty();
                this.showToast('success', `Audio ${url ? 'saved' : 'removed'} for ${lang.toUpperCase()}`);
            });
        });

        // Upload button handlers
        container.querySelectorAll('.audio-btn-upload').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                this.uploadTextboxAudioForLang(textbox, lang);
            });
        });

        // Play/Preview button handlers
        container.querySelectorAll('.audio-btn-play').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                this.previewTextboxAudioForLang(textbox, lang, btn);
            });
        });

        // Clear button handlers
        container.querySelectorAll('.audio-btn-clear').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                this.clearTextboxAudioForLang(textbox, lang);
            });
        });
    },

    // Upload audio for specific language
    uploadTextboxAudioForLang(textbox, langCode) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                if (!textbox.media) textbox.media = {};
                if (!textbox.media.audio) textbox.media.audio = {};

                textbox.media.audio[langCode] = e.target.result;
                State.markDirty();

                // Update the UI
                const row = document.querySelector(`.audio-lang-row[data-lang="${langCode}"]`);
                if (row) {
                    const urlInput = row.querySelector('.audio-url-input');
                    urlInput.value = file.name;
                    urlInput.classList.add('has-audio');
                    row.querySelector('.audio-btn-play').classList.remove('hidden');
                    row.querySelector('.audio-btn-clear').classList.remove('hidden');
                }

                this.showToast('success', `Audio uploaded for ${langCode.toUpperCase()}`);
            };
            reader.readAsDataURL(file);
        };

        input.click();
    },

    // Preview audio for specific language
    previewTextboxAudioForLang(textbox, langCode, btn) {
        const audioSrc = textbox.media?.audio?.[langCode];
        if (!audioSrc) return;

        // Stop any playing audio
        if (ContentManager.audioPlayer && !ContentManager.audioPlayer.paused) {
            ContentManager.audioPlayer.pause();
            document.querySelectorAll('.audio-btn-play.playing').forEach(b => {
                b.classList.remove('playing');
                b.textContent = '▶';
            });

            // If same button, just stop
            if (btn.classList.contains('playing')) {
                return;
            }
        }

        // Play this audio
        if (!ContentManager.audioPlayer) {
            ContentManager.audioPlayer = new Audio();
        }

        ContentManager.audioPlayer.src = audioSrc;
        ContentManager.audioPlayer.play();
        btn.classList.add('playing');
        btn.textContent = '⏸';

        ContentManager.audioPlayer.onended = () => {
            btn.classList.remove('playing');
            btn.textContent = '▶';
        };
    },

    // Clear audio for specific language
    clearTextboxAudioForLang(textbox, langCode) {
        if (textbox.media?.audio) {
            delete textbox.media.audio[langCode];
            State.markDirty();

            // Update the UI
            const row = document.querySelector(`.audio-lang-row[data-lang="${langCode}"]`);
            if (row) {
                const urlInput = row.querySelector('.audio-url-input');
                urlInput.value = '';
                urlInput.classList.remove('has-audio');
                row.querySelector('.audio-btn-play').classList.add('hidden');
                row.querySelector('.audio-btn-clear').classList.add('hidden');
            }

            this.showToast('info', `Audio removed for ${langCode.toUpperCase()}`);
        }
    },

    // Update media previews for textbox
    updateTextboxMediaPreviews(textbox) {
        const media = textbox.media || {};

        // Per-language image previews
        this.loadLangImagePreviews(textbox);

        // Video preview
        const videoPreview = document.getElementById('textbox-video-preview');
        if (media.video) {
            videoPreview.classList.remove('hidden');
            const isUrl = media.video.startsWith('http');
            videoPreview.querySelector('.media-name').textContent = isUrl ? 'Video URL' : 'video.mp4';
        } else {
            videoPreview.classList.add('hidden');
        }

        // Audio is now handled by per-language inputs in buildTextboxAudioInputs()
    },

    // Update hierarchy lists
    updateHierarchy(change) {
        this.updateMeshList();
        this.updatePointsList();
        this.updateTextboxList();
        this.updateCategoryList();
        this.updateActionButtonsList();
        this.updateLanguageList();
        this.updateLibrary();
        this.updateBordersList();
    },

    // Update borders list in hierarchy
    updateBordersList() {
        const container = document.getElementById('borders-list');
        if (!container) return;

        const borders = State.getProject('borders') || [];
        const folders = State.getProject('borderFolders') || [];

        if (borders.length === 0 && folders.length === 0) {
            container.innerHTML = '<div class="tree-empty">No borders drawn</div>';
            return;
        }

        let html = '';

        // Get all borders that are in folders
        const bordersInFolders = new Set();
        folders.forEach(folder => {
            folder.itemIds.forEach(id => bordersInFolders.add(id));
        });

        // Render folders first
        folders.forEach(folder => {
            const folderBorders = folder.itemIds
                .map(id => borders.find(b => b.id === id))
                .filter(Boolean);

            const allVisible = folderBorders.every(b => Renderer.borders?.get(b.id)?.visible !== false);

            html += `
                <div class="tree-folder ${folder.expanded ? 'expanded' : ''}" data-folder-id="${folder.id}">
                    <div class="tree-folder-header" 
                         onclick="UI.toggleFolder('${folder.id}', 'borderFolders')"
                         oncontextmenu="UI.showFolderContextMenu(event, '${folder.id}', 'borderFolders')">
                        <span class="tree-folder-toggle">▶</span>
                        <span class="tree-folder-icon">📁</span>
                        <span class="tree-folder-name">${folder.name}</span>
                        <span class="tree-folder-count">${folderBorders.length}</span>
                        <button class="tree-item-visibility ${allVisible ? '' : 'visibility-off'}" 
                                onclick="event.stopPropagation(); UI.toggleFolderBordersVisibility('${folder.id}')" 
                                title="Toggle All Borders in Folder">
                            ${allVisible ? '👁' : '🚫'}
                        </button>
                    </div>
                    <div class="tree-folder-children">
                        ${folderBorders.map(border => {
                const isVisible = Renderer.borders?.get(border.id)?.visible !== false;
                return `
                            <div class="tree-item ${State.state.selected.id === border.id ? 'selected' : ''}" 
                                 data-type="border" data-id="${border.id}" draggable="true">
                                <span class="tree-icon" style="color: ${border.color || '#FFFF00'}">▢</span>
                                <span class="tree-item-name">${border.name || 'Unnamed Border'}</span>
                                <button class="tree-item-visibility ${isVisible ? '' : 'visibility-off'}" 
                                        onclick="event.stopPropagation(); UI.toggleBorderVisibility('${border.id}')" 
                                        title="Toggle Visibility">
                                    ${isVisible ? '👁' : '🚫'}
                                </button>
                            </div>
                        `;
            }).join('')}
                    </div>
                </div>
            `;
        });

        // Render unfiled borders
        borders.filter(b => !bordersInFolders.has(b.id)).forEach(border => {
            const isVisible = Renderer.borders?.get(border.id)?.visible !== false;
            html += `
                <div class="tree-item ${State.state.selected.id === border.id ? 'selected' : ''}" 
                     data-type="border" data-id="${border.id}" draggable="true">
                    <span class="tree-icon" style="color: ${border.color || '#FFFF00'}">▢</span>
                    <span class="tree-item-name">${border.name || 'Unnamed Border'}</span>
                    <button class="tree-item-visibility ${isVisible ? '' : 'visibility-off'}" 
                            onclick="event.stopPropagation(); UI.toggleBorderVisibility('${border.id}')" 
                            title="Toggle Visibility">
                        ${isVisible ? '👁' : '🚫'}
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
        this.setupTreeItemListeners(container);
        this.setupFolderDragDrop(container, 'borderFolders');
    },



    // Update action buttons list
    updateActionButtonsList() {
        const container = document.getElementById('action-buttons-list');
        if (!container) return;

        const actionButtons = State.getProject('actionButtons') || [];

        if (actionButtons.length === 0) {
            container.innerHTML = '<div class="tree-empty">No action buttons added</div>';
            return;
        }

        container.innerHTML = actionButtons.map(btn => `
            <div class="tree-item ${State.state.selected.id === btn.id ? 'selected' : ''}" 
                 data-type="actionButton" data-id="${btn.id}">
                <span class="tree-icon">${btn.icon || '▶'}</span>
                <span class="tree-name">${btn.name}</span>
                ${btn.placement === 'standalone' ? '<span class="tree-badge">Menu</span>' : ''}
            </div>
        `).join('');

        // Add click listeners
        container.querySelectorAll('.tree-item').forEach(item => {
            item.addEventListener('click', () => {
                State.select('actionButton', item.dataset.id);
            });
        });
    },

    // Update library tab
    updateLibrary() {
        this.updateLibraryModels();
        this.updateLibraryImages();
        this.updateLibraryVideos();
        this.updateLibraryAudio();
        this.updateLibraryPanoramas();
    },

    updateLibraryModels() {
        const container = document.getElementById('library-models');
        if (!container) return;

        const meshes = State.getProject('meshes');

        if (meshes.length === 0) {
            container.innerHTML = '<div class="tree-empty">No models uploaded</div>';
            return;
        }

        container.innerHTML = meshes.map(mesh => `
            <div class="library-item" data-type="mesh" data-id="${mesh.id}">
                <div class="library-item-icon">📦</div>
                <span class="library-item-name">${mesh.name}</span>
                <span class="library-item-badge">${mesh.filename.split('.').pop().toUpperCase()}</span>
                <button class="library-item-delete" data-action="delete" data-id="${mesh.id}">&times;</button>
            </div>
        `).join('');

        this.setupLibraryItemListeners(container);
    },

    updateLibraryImages() {
        const container = document.getElementById('library-images');
        if (!container) return;

        const textboxes = State.getProject('textboxes');
        const images = [];

        textboxes.forEach(tb => {
            if (tb.media?.image) {
                images.push({ id: tb.id, name: tb.content?.en?.heading || 'Image', data: tb.media.image });
            }
        });

        if (images.length === 0) {
            container.innerHTML = '<div class="tree-empty">No images uploaded</div>';
            return;
        }

        container.innerHTML = images.map(img => `
            <div class="library-item" data-type="image" data-id="${img.id}">
                <img class="library-item-preview" src="${img.data}" alt="${img.name}">
                <span class="library-item-name">${img.name}</span>
            </div>
        `).join('');
    },

    updateLibraryVideos() {
        const container = document.getElementById('library-videos');
        if (!container) return;

        const media = State.getProject('media').filter(m => m.type === 'video');

        if (media.length === 0) {
            container.innerHTML = '<div class="tree-empty">No videos uploaded</div>';
            return;
        }

        container.innerHTML = media.map(vid => `
            <div class="library-item" data-type="video" data-id="${vid.id}">
                <div class="library-item-icon">🎬</div>
                <span class="library-item-name">${vid.name}</span>
            </div>
        `).join('');
    },

    updateLibraryAudio() {
        const container = document.getElementById('library-audio');
        if (!container) return;

        const media = State.getProject('media').filter(m => m.type === 'audio');

        if (media.length === 0) {
            container.innerHTML = '<div class="tree-empty">No audio uploaded</div>';
            return;
        }

        container.innerHTML = media.map(aud => `
            <div class="library-item" data-type="audio" data-id="${aud.id}">
                <div class="library-item-icon">🔊</div>
                <span class="library-item-name">${aud.name}</span>
            </div>
        `).join('');
    },

    updateLibraryPanoramas() {
        const container = document.getElementById('library-panoramas');
        if (!container) return;

        const media = State.getProject('media').filter(m => m.type === 'panorama');

        if (media.length === 0) {
            container.innerHTML = '<div class="tree-empty">No panoramas uploaded</div>';
            return;
        }

        container.innerHTML = media.map(pan => `
            <div class="library-item" data-type="panorama" data-id="${pan.id}" style="position: relative;">
                <img class="library-item-preview" src="${pan.data}" alt="${pan.name}">
                <span class="library-item-name">${pan.name}</span>
                <span class="library-item-badge">360°</span>
                <button class="delete-library-item" title="Delete" style="position: absolute; top: 5px; right: 5px; background: rgba(255, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; z-index: 10;">×</button>
            </div>
        `).join('');

        // Add delete handlers
        container.querySelectorAll('.delete-library-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this panorama?')) {
                    const item = btn.closest('.library-item');
                    State.removeFromProject('media', item.dataset.id);
                    this.updateLibraryPanoramas();
                }
            });
        });
    },

    setupLibraryItemListeners(container) {
        container.querySelectorAll('.library-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.dataset.action === 'delete') {
                    return;
                }
                State.select(item.dataset.type, item.dataset.id);
            });
        });

        container.querySelectorAll('.library-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.showConfirm('Delete Item?', 'This cannot be undone.', () => {
                    State.removeFromProject('meshes', id);
                    Renderer.removeMesh(id);
                    this.updateHierarchy();
                    this.showToast('success', 'Item Deleted');
                });
            });
        });
    },

    // Refresh all hierarchy lists (meshes, points, textboxes, etc.)
    refreshHierarchy() {
        this.updateMeshList();
        this.updatePointsList();
        this.updateTextboxList();
        this.updateCategoryList();
        this.updateActionButtonsList();
    },

    // Toggle visibility of a single mesh in real-time
    toggleMeshVisibility(meshId) {
        const meshData = Renderer.meshes?.get(meshId);
        if (meshData && meshData.object) {
            // Just toggle the root object. Three.js handles child visibility automatically.
            // This preserves the internal visibility state of model components (e.g. hidden collision meshes).
            const newVisibility = !meshData.object.visible;
            meshData.object.visible = newVisibility;

            // Update the button icon
            const btn = document.querySelector(`.tree-item[data-id="${meshId}"] .tree-item-visibility`);
            if (btn) {
                btn.textContent = newVisibility ? '👁' : '🚫';
                btn.classList.toggle('visibility-off', !newVisibility);
            }

            console.log('Mesh visibility toggled:', meshId, newVisibility);
        }
    },

    // Toggle visibility of all meshes in a folder
    toggleFolderMeshesVisibility(folderId) {
        const folders = State.getProject('meshFolders') || [];
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return;

        // Check if any mesh in folder is visible
        const anyVisible = folder.itemIds.some(id => {
            const meshData = Renderer.meshes?.get(id);
            return meshData?.object?.visible !== false;
        });

        // Toggle: if any visible, hide all. If all hidden, show all.
        const newVisibility = !anyVisible;

        folder.itemIds.forEach(meshId => {
            const meshData = Renderer.meshes?.get(meshId);
            if (meshData && meshData.object) {
                // Set visibility on root object only
                meshData.object.visible = newVisibility;
                // No traversal needed

                // Update individual mesh buttons
                const btn = document.querySelector(`.tree-item[data-id="${meshId}"] .tree-item-visibility`);
                if (btn) {
                    btn.textContent = newVisibility ? '👁' : '🚫';
                    btn.classList.toggle('visibility-off', !newVisibility);
                }
            }
        });

        // Update folder button
        const folderBtn = document.querySelector(`.tree-folder[data-folder-id="${folderId}"] .tree-folder-header .tree-item-visibility`);
        if (folderBtn) {
            folderBtn.textContent = newVisibility ? '👁' : '🚫';
            folderBtn.classList.toggle('visibility-off', !newVisibility);
        }

        console.log('Folder meshes visibility toggled:', folderId, newVisibility);
    },

    // --- POINTS VISIBILITY ---

    togglePointVisibility(pointId) {
        const sprite = Renderer.pointSprites?.get(pointId);
        if (sprite) {
            const newVisibility = !sprite.visible;
            sprite.visible = newVisibility;

            // Toggle lift line if it exists
            if (window.PointsManager && PointsManager.liftLines) {
                const line = PointsManager.liftLines.get(pointId);
                if (line) {
                    line.visible = newVisibility;
                }
            }

            // Update UI
            const btn = document.querySelector(`.tree-item[data-id="${pointId}"] .tree-item-visibility`);
            if (btn) {
                btn.textContent = newVisibility ? '👁' : '🚫';
                btn.classList.toggle('visibility-off', !newVisibility);
            }
            console.log('Point visibility toggled:', pointId, newVisibility);
        }
    },

    toggleFolderPointsVisibility(folderId) {
        const folders = State.getProject('pointFolders') || [];
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return;

        // Check if any point in folder is visible
        const anyVisible = folder.itemIds.some(id => {
            const sprite = Renderer.pointSprites?.get(id);
            return sprite?.visible !== false;
        });

        const newVisibility = !anyVisible;

        folder.itemIds.forEach(id => {
            const sprite = Renderer.pointSprites?.get(id);
            if (sprite) {
                sprite.visible = newVisibility;

                // Toggle lift line if it exists
                if (window.PointsManager && PointsManager.liftLines) {
                    const line = PointsManager.liftLines.get(id);
                    if (line) {
                        line.visible = newVisibility;
                    }
                }

                // Update individual buttons
                const btn = document.querySelector(`.tree-item[data-id="${id}"] .tree-item-visibility`);
                if (btn) {
                    btn.textContent = newVisibility ? '👁' : '🚫';
                    btn.classList.toggle('visibility-off', !newVisibility);
                }
            }
        });

        // Update folder button
        const folderBtn = document.querySelector(`.tree-folder[data-folder-id="${folderId}"] .tree-folder-header .tree-item-visibility`);
        if (folderBtn) {
            folderBtn.textContent = newVisibility ? '👁' : '🚫';
            folderBtn.classList.toggle('visibility-off', !newVisibility);
        }
    },

    // --- BORDERS VISIBILITY ---

    toggleBorderVisibility(borderId) {
        const borderGroup = Renderer.borders?.get(borderId);
        if (borderGroup) {
            const newVisibility = !borderGroup.visible;
            borderGroup.visible = newVisibility;

            // Update UI
            const btn = document.querySelector(`.tree-item[data-id="${borderId}"] .tree-item-visibility`);
            if (btn) {
                btn.textContent = newVisibility ? '👁' : '🚫';
                btn.classList.toggle('visibility-off', !newVisibility);
            }
        }
    },

    toggleFolderBordersVisibility(folderId) {
        const folders = State.getProject('borderFolders') || [];
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return;

        const anyVisible = folder.itemIds.some(id => {
            const borderGroup = Renderer.borders?.get(id);
            return borderGroup?.visible !== false;
        });

        const newVisibility = !anyVisible;

        folder.itemIds.forEach(id => {
            const borderGroup = Renderer.borders?.get(id);
            if (borderGroup) {
                borderGroup.visible = newVisibility;

                // Update individual buttons
                const btn = document.querySelector(`.tree-item[data-id="${id}"] .tree-item-visibility`);
                if (btn) {
                    btn.textContent = newVisibility ? '👁' : '🚫';
                    btn.classList.toggle('visibility-off', !newVisibility);
                }
            }
        });

        // Update folder button
        const folderBtn = document.querySelector(`.tree-folder[data-folder-id="${folderId}"] .tree-folder-header .tree-item-visibility`);
        if (folderBtn) {
            folderBtn.textContent = newVisibility ? '👁' : '🚫';
            folderBtn.classList.toggle('visibility-off', !newVisibility);
        }
    },

    updateMeshList() {
        const list = document.getElementById('mesh-list');
        const meshes = State.getProject('meshes') || [];
        const folders = State.getProject('meshFolders') || [];

        if (meshes.length === 0 && folders.length === 0) {
            list.innerHTML = '<div class="tree-empty">No meshes added</div>';
            return;
        }

        let html = '';

        // Get all meshs that are in folders
        const meshesInFolders = new Set();
        folders.forEach(folder => {
            folder.itemIds.forEach(id => meshesInFolders.add(id));
        });

        // Render folders first
        folders.forEach(folder => {
            const folderMeshes = folder.itemIds
                .map(id => meshes.find(m => m.id === id))
                .filter(Boolean);
            // Check if all meshes in folder are visible
            const allVisible = folderMeshes.every(m => Renderer.meshes?.get(m.id)?.object?.visible !== false);
            const anyVisible = folderMeshes.some(m => Renderer.meshes?.get(m.id)?.object?.visible !== false);

            html += `
                <div class="tree-folder ${folder.expanded ? 'expanded' : ''}" data-folder-id="${folder.id}">
                    <div class="tree-folder-header" 
                         onclick="UI.toggleFolder('${folder.id}', 'meshFolders')"
                         oncontextmenu="UI.showFolderContextMenu(event, '${folder.id}', 'meshFolders')">
                        <span class="tree-folder-toggle">▶</span>
                        <span class="tree-folder-icon">📁</span>
                        <span class="tree-folder-name">${folder.name}</span>
                        <span class="tree-folder-count">${folderMeshes.length}</span>
                        <button class="tree-item-visibility ${allVisible ? '' : 'visibility-off'}" 
                                onclick="event.stopPropagation(); UI.toggleFolderMeshesVisibility('${folder.id}')" 
                                title="Toggle All Meshes in Folder">
                            ${allVisible ? '👁' : '🚫'}
                        </button>
                    </div>
                    <div class="tree-folder-children">
                        ${folderMeshes.map(mesh => {
                const isVisible = Renderer.meshes?.get(mesh.id)?.object?.visible !== false;
                return `
                            <div class="tree-item ${State.state.selected.id === mesh.id ? 'selected' : ''}" 
                                 data-type="mesh" data-id="${mesh.id}" draggable="true">
                                <span class="tree-icon">🎲</span>
                                <span class="tree-item-name">${mesh.name}</span>
                                <button class="tree-item-visibility ${isVisible ? '' : 'visibility-off'}" 
                                        onclick="event.stopPropagation(); UI.toggleMeshVisibility('${mesh.id}')" 
                                        title="Toggle Visibility">
                                    ${isVisible ? '👁' : '🚫'}
                                </button>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
        });

        // Render unfiled meshes
        meshes.filter(m => !meshesInFolders.has(m.id)).forEach(mesh => {
            const isVisible = Renderer.meshes?.get(mesh.id)?.object?.visible !== false;
            html += `
                <div class="tree-item ${State.state.selected.id === mesh.id ? 'selected' : ''}" 
                     data-type="mesh" data-id="${mesh.id}" draggable="true">
                    <span class="tree-icon">🎲</span>
                    <span class="tree-item-name">${mesh.name}</span>
                    <button class="tree-item-visibility ${isVisible ? '' : 'visibility-off'}" 
                            onclick="event.stopPropagation(); UI.toggleMeshVisibility('${mesh.id}')" 
                            title="Toggle Visibility">
                        ${isVisible ? '👁' : '🚫'}
                    </button>
                </div>
            `;
        });

        list.innerHTML = html;
        this.setupTreeItemListeners(list);
        this.setupFolderDragDrop(list, 'meshFolders');
    },

    updatePointsList() {
        const list = document.getElementById('points-list');
        const points = State.getProject('points') || [];
        const folders = State.getProject('pointFolders') || [];

        if (points.length === 0 && folders.length === 0) {
            list.innerHTML = '<div class="tree-empty">No points added</div>';
            return;
        }

        let html = '';

        // Get all points that are in folders
        const pointsInFolders = new Set();
        folders.forEach(folder => {
            folder.itemIds.forEach(id => pointsInFolders.add(id));
        });

        // Render folders first
        folders.forEach(folder => {
            const folderPoints = folder.itemIds
                .map(id => points.find(p => p.id === id))
                .filter(Boolean);

            html += `
                <div class="tree-folder ${folder.expanded ? 'expanded' : ''}" data-folder-id="${folder.id}">
                    <div class="tree-folder-header" 
                         onclick="UI.toggleFolder('${folder.id}', 'pointFolders')"
                         oncontextmenu="UI.showFolderContextMenu(event, '${folder.id}', 'pointFolders')">
                        <span class="tree-folder-toggle">▶</span>
                        <span class="tree-folder-icon">📁</span>
                        <span class="tree-folder-name">${folder.name}</span>
                        <span class="tree-folder-count">${folderPoints.length}</span>
                        <button class="tree-item-visibility" 
                                onclick="event.stopPropagation(); UI.toggleFolderPointsVisibility('${folder.id}')" 
                                title="Toggle All Points in Folder">
                            👁
                        </button>
                    </div>
                    <div class="tree-folder-children">
                        ${folderPoints.map(point => `
                            <div class="tree-item ${State.state.selected.id === point.id ? 'selected' : ''}" 
                                 data-type="point" data-id="${point.id}" draggable="true">
                                <span class="tree-icon">📍</span>
                                <span class="tree-item-name">${point.name}</span>
                                <button class="tree-item-visibility ${Renderer.pointSprites?.get(point.id)?.visible !== false ? '' : 'visibility-off'}" 
                                        onclick="event.stopPropagation(); UI.togglePointVisibility('${point.id}')" 
                                        title="Toggle Visibility">
                                    ${Renderer.pointSprites?.get(point.id)?.visible !== false ? '👁' : '🚫'}
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        // Render unfiled points
        points.filter(p => !pointsInFolders.has(p.id)).forEach(point => {
            html += `
                <div class="tree-item ${State.state.selected.id === point.id ? 'selected' : ''}" 
                     data-type="point" data-id="${point.id}" draggable="true">
                    <span class="tree-icon">📍</span>
                    <span class="tree-item-name">${point.name}</span>
                    <button class="tree-item-visibility ${Renderer.pointSprites?.get(point.id)?.visible !== false ? '' : 'visibility-off'}" 
                            onclick="event.stopPropagation(); UI.togglePointVisibility('${point.id}')" 
                            title="Toggle Visibility">
                        ${Renderer.pointSprites?.get(point.id)?.visible !== false ? '👁' : '🚫'}
                    </button>
                </div>
            `;
        });

        list.innerHTML = html;
        this.setupTreeItemListeners(list);
        this.setupFolderDragDrop(list, 'pointFolders');
    },

    updateTextboxList() {
        const list = document.getElementById('textbox-list');
        const textboxes = State.getProject('textboxes') || [];
        const folders = State.getProject('textboxFolders') || [];

        if (textboxes.length === 0 && folders.length === 0) {
            list.innerHTML = '<div class="tree-empty">No text boxes added</div>';
            return;
        }

        let html = '';

        // Get all textboxes that are in folders
        const textboxesInFolders = new Set();
        folders.forEach(folder => {
            folder.itemIds.forEach(id => textboxesInFolders.add(id));
        });

        // Render folders first
        folders.forEach(folder => {
            const folderTextboxes = folder.itemIds
                .map(id => textboxes.find(tb => tb.id === id))
                .filter(Boolean);

            html += `
                <div class="tree-folder ${folder.expanded ? 'expanded' : ''}" data-folder-id="${folder.id}">
                    <div class="tree-folder-header" 
                         onclick="UI.toggleFolder('${folder.id}', 'textboxFolders')"
                         oncontextmenu="UI.showFolderContextMenu(event, '${folder.id}', 'textboxFolders')">
                        <span class="tree-folder-toggle">▶</span>
                        <span class="tree-folder-icon">📁</span>
                        <span class="tree-folder-name">${folder.name}</span>
                        <span class="tree-folder-count">${folderTextboxes.length}</span>
                    </div>
                    <div class="tree-folder-children">
                        ${folderTextboxes.map(tb => {
                const name = tb.content['en']?.heading || 'Untitled';
                return `
                                <div class="tree-item ${State.state.selected.id === tb.id ? 'selected' : ''}" 
                                     data-type="textbox" data-id="${tb.id}" draggable="true">
                                    <span class="tree-icon">📝</span>
                                    <span>${name}</span>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        });

        // Render unfiled textboxes
        textboxes.filter(tb => !textboxesInFolders.has(tb.id)).forEach(tb => {
            const name = tb.content['en']?.heading || 'Untitled';
            html += `
                <div class="tree-item ${State.state.selected.id === tb.id ? 'selected' : ''}" 
                     data-type="textbox" data-id="${tb.id}" draggable="true">
                    <span class="tree-icon">📝</span>
                    <span>${name}</span>
                </div>
            `;
        });

        list.innerHTML = html;
        this.setupTreeItemListeners(list);
        this.setupFolderDragDrop(list, 'textboxFolders');
    },

    updateCategoryList() {
        const list = document.getElementById('menu-list');
        const categories = State.getProject('categories');

        if (categories.length === 0) {
            list.innerHTML = '<div class="tree-empty">No categories added</div>';
            return;
        }

        list.innerHTML = categories.map(cat => {
            // Check if icon is image URL/data or emoji
            const isImage = cat.icon && (cat.icon.startsWith('data:') || cat.icon.startsWith('http'));
            const customImage = cat.customIcon;
            const iconHTML = customImage
                ? `<img src="${customImage}" class="tree-icon-img" style="width: 18px; height: 18px; object-fit: contain; border-radius: 3px;">`
                : isImage
                    ? `<img src="${cat.icon}" class="tree-icon-img" style="width: 18px; height: 18px; object-fit: contain; border-radius: 3px;">`
                    : `<span class="tree-icon">${cat.icon || '📁'}</span>`;

            return `
                <div class="tree-item" data-type="category" data-id="${cat.id}">
                    ${iconHTML}
                    <span>${cat.names?.en || cat.name}</span>
                </div>
            `;
        }).join('');

        this.setupTreeItemListeners(list);
    },

    updateLanguageList() {
        const list = document.getElementById('language-list');
        const languages = State.getProject('languages');

        list.innerHTML = languages.map(lang => `
            <div class="tree-item" data-type="language" data-id="${lang.code}">
                <span class="tree-icon">🌍</span>
                <span>${lang.name} (${lang.code.toUpperCase()})</span>
                ${lang.isDefault ? '<span class="tree-badge default">Default</span>' : ''}
            </div>
        `).join('');
    },

    // Track last clicked item for shift-selection
    _lastClickedId: null,
    _multiSelectedIds: [],

    setupTreeItemListeners(list) {
        const allItems = Array.from(list.querySelectorAll('.tree-item'));

        allItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const type = item.dataset.type;
                const id = item.dataset.id;

                if (e.shiftKey && this._lastClickedId) {
                    // Shift+Click: Select range between last clicked and current
                    const lastClickedItem = allItems.find(i => i.dataset.id === this._lastClickedId);
                    const lastIndex = lastClickedItem ? allItems.indexOf(lastClickedItem) : -1;
                    const currentIndex = allItems.indexOf(item);

                    if (lastIndex !== -1 && currentIndex !== -1) {
                        const startIndex = Math.min(lastIndex, currentIndex);
                        const endIndex = Math.max(lastIndex, currentIndex);

                        // Clear previous multi-selection
                        this.clearMultiSelection(list);

                        // Select all items in range
                        this._multiSelectedIds = [];
                        for (let i = startIndex; i <= endIndex; i++) {
                            const rangeItem = allItems[i];
                            rangeItem.classList.add('multi-selected');
                            this._multiSelectedIds.push(rangeItem.dataset.id);
                        }

                        console.log('Shift-select: Selected', this._multiSelectedIds.length, 'items:', this._multiSelectedIds);

                        // Also select the last one normally
                        State.select(type, id);
                    }
                } else {
                    // Check if this item is already part of a multi-selection
                    const isMultiSelected = this._multiSelectedIds.length > 1 && this._multiSelectedIds.includes(id);

                    if (isMultiSelected) {
                        // Clicking on multi-selected item - keep selection, just update main selection
                        State.select(type, id);
                        console.log('Clicked on multi-selected item, keeping', this._multiSelectedIds.length, 'items selected');
                    } else {
                        // Normal click: Clear multi-selection and select single item
                        this.clearMultiSelection(list);
                        this._multiSelectedIds = [id];
                        State.select(type, id);
                        this._lastClickedId = id; // Store ID for shift-select
                    }
                }
            });

            item.addEventListener('dblclick', () => {
                if (item.dataset.type === 'point') {
                    Controls?.focusOnPoint(item.dataset.id);
                }
                if (item.dataset.type === 'category') {
                    this.showEditCategoryModal(item.dataset.id);
                }
            });

            // Right-click context menu
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const type = item.dataset.type;
                const id = item.dataset.id;

                if (['point', 'mesh', 'category'].includes(type)) {
                    State.select(type, id);
                    this.showContextMenu(e.clientX, e.clientY, type, id);
                }
            });
        });
    },

    clearMultiSelection(list) {
        if (list) {
            list.querySelectorAll('.multi-selected').forEach(el => {
                el.classList.remove('multi-selected');
            });
        }
        // Also clear from all lists
        document.querySelectorAll('.tree-item.multi-selected').forEach(el => {
            el.classList.remove('multi-selected');
        });
    },

    getMultiSelectedIds() {
        return this._multiSelectedIds || [];
    },

    // Update visual selection highlight in tree
    updateTreeSelection(selection) {
        // Remove 'selected' class from all tree items
        document.querySelectorAll('.tree-item.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Add 'selected' class to the newly selected item
        if (selection && selection.id) {
            const selectedItem = document.querySelector(`.tree-item[data-id="${selection.id}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
                // Also scroll into view if needed
                selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    },

    // Setup drag and drop for folders
    setupFolderDragDrop(list, folderPath) {
        let draggedItem = null;

        // Setup draggable items
        list.querySelectorAll('.tree-item[draggable="true"]').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');

                // Store all multi-selected IDs, or just this one
                const selectedIds = this.getMultiSelectedIds();
                let idsToTransfer;

                if (selectedIds.length > 1 && selectedIds.includes(item.dataset.id)) {
                    idsToTransfer = selectedIds;
                } else {
                    idsToTransfer = [item.dataset.id];
                }

                console.log('Drag start:', idsToTransfer.length, 'items:', idsToTransfer);
                e.dataTransfer.setData('text/plain', JSON.stringify(idsToTransfer));
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                // Remove all drag-over classes
                list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            });
        });

        // Setup folder drop targets
        list.querySelectorAll('.tree-folder-header').forEach(header => {
            header.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                header.classList.add('drag-over');
            });

            header.addEventListener('dragleave', () => {
                header.classList.remove('drag-over');
            });

            header.addEventListener('drop', (e) => {
                e.preventDefault();
                header.classList.remove('drag-over');

                const dataStr = e.dataTransfer.getData('text/plain');
                const folderId = header.closest('.tree-folder').dataset.folderId;

                console.log('Drop event - dataStr:', dataStr, 'folderId:', folderId);

                if (dataStr && folderId) {
                    try {
                        // Parse JSON array of IDs
                        const itemIds = JSON.parse(dataStr);
                        console.log('Parsed itemIds:', itemIds, 'count:', itemIds.length);
                        if (Array.isArray(itemIds) && itemIds.length > 0) {
                            console.log('Adding', itemIds.length, 'items to folder');
                            // Use batch add to avoid multiple refreshes
                            this.addItemsToFolder(itemIds, folderId, folderPath);
                        }
                    } catch (err) {
                        console.log('JSON parse failed, using raw string:', dataStr);
                        // Fallback: single ID (old format)
                        this.addItemToFolder(dataStr, folderId, folderPath);
                    }
                }
            });
        });

        // Also allow dropping on tree-list (to unfile items)
        list.addEventListener('dragover', (e) => {
            // Only if dragging over the list itself (not a folder)
            if (e.target === list || e.target.classList.contains('tree-empty')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        });

        list.addEventListener('drop', (e) => {
            if (e.target === list || e.target.classList.contains('tree-empty')) {
                e.preventDefault();
                const itemId = e.dataTransfer.getData('text/plain');
                if (itemId) {
                    this.removeItemFromAllFolders(itemId, folderPath);
                    this.refreshHierarchy();
                }
            }
        });
    },

    // Update selected items
    updateSelectedMesh(updates) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'mesh') return;

        State.updateInProject('meshes', id, updates);
    },

    // Update selected border
    updateSelectedBorder(updates) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'border') return;

        State.updateInProject('borders', id, updates);
        this.updateBordersList();
    },

    updateSelectedMeshTransform(type, axis, value) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'mesh') return;

        const mesh = State.findById('meshes', id);
        if (!mesh) return;

        // Validate value - prevent NaN
        if (isNaN(value) || value === null || value === undefined) {
            console.warn('Invalid transform value:', value);
            return;
        }

        // Prevent scale of 0 which would make mesh invisible
        if (type === 'scale' && value === 0) {
            console.warn('Scale cannot be 0');
            return;
        }

        const propName = type === 'pos' ? 'position' : type === 'rot' ? 'rotation' : 'scale';
        const newTransform = { ...mesh[propName], [axis]: value };

        console.log('Updating mesh transform:', propName, axis, value, newTransform);

        State.updateInProject('meshes', id, { [propName]: newTransform });

        // Update 3D object
        const meshData = Renderer.meshes.get(id);
        if (meshData) {
            if (propName === 'position') {
                meshData.object.position.set(newTransform.x, newTransform.y, newTransform.z);
            } else if (propName === 'rotation') {
                meshData.object.rotation.set(
                    Utils.degToRad(newTransform.x),
                    Utils.degToRad(newTransform.y),
                    Utils.degToRad(newTransform.z)
                );
            } else if (propName === 'scale') {
                meshData.object.scale.set(newTransform.x, newTransform.y, newTransform.z);
            }
            console.log('3D object updated');
        } else {
            console.warn('Mesh data not found in renderer for id:', id);
        }
    },

    // Sync point name with content heading (Auto-creation of content)
    syncPointContentName(pointId, lang, name) {
        if (!name) return;

        const point = State.findById('points', pointId);
        if (!point) return;

        // If no content linked, create new one
        if (!point.contentId) {
            // Create new content
            const contentOptions = { heading: name };
            const newTextbox = ContentManager.createTextbox(contentOptions);

            // If lang is not EN, ensure specific lang entry
            if (lang !== 'en') {
                if (!newTextbox.content[lang]) newTextbox.content[lang] = {};
                newTextbox.content[lang].heading = name;
            }

            // Link to point
            this.updateSelectedPoint({ contentId: newTextbox.id, contentType: 'textbox' });

            // Update dropdown UI if currently viewing this point properties
            if (State.state.selected.id === pointId) {
                const contentSelect = document.getElementById('point-content');
                if (contentSelect) {
                    // Add option and select it
                    const opt = document.createElement('option');
                    opt.value = newTextbox.id;
                    opt.textContent = name;
                    contentSelect.appendChild(opt);
                    contentSelect.value = newTextbox.id;
                }

                this.showToast('success', 'Content Created', 'Text Box created with name: ' + name);
            }
        } else {
            // Update existing content
            const textbox = State.findById('textboxes', point.contentId);
            if (textbox) {
                if (!textbox.content[lang]) textbox.content[lang] = {};
                textbox.content[lang].heading = name;
                State.emit('projectChange', { path: 'textboxes', action: 'update', id: textbox.id });
            }
        }
    },

    updateSelectedPoint(updates) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'point') return;

        const point = State.findById('points', id);
        if (!point) return;

        // Merge style updates
        if (updates.style) {
            updates.style = { ...point.style, ...updates.style };
        }

        State.updateInProject('points', id, updates);

        // Update 3D sprite
        Renderer.updatePoint(id, { ...point, ...updates });
    },

    updateSelectedTextbox(updates) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'textbox') return;

        const textbox = State.findById('textboxes', id);
        if (!textbox) return;

        // If updating style, merge with existing style
        if (updates.style) {
            const existingStyle = textbox.style || {};
            const newStyle = { ...existingStyle, ...updates.style };
            State.updateInProject('textboxes', id, { style: newStyle });
        } else {
            // Content update
            const lang = document.getElementById('textbox-language')?.value || 'en';
            ContentManager.updateTextbox(id, lang, updates);
        }
    },

    setPointCameraView(pointId) {
        const cameraState = Renderer.getCameraState();
        State.updateInProject('points', pointId, { cameraView: cameraState });
        this.showToast('success', 'Camera View Saved', 'Point will focus to this view when clicked');
    },

    previewPointCameraView(pointId) {
        const point = State.getProject('points').find(p => p.id === pointId);
        if (point && point.cameraView) {
            Renderer.animateCameraTo(
                point.cameraView.position,
                point.cameraView.target
            );
            this.showToast('info', 'Previewing View');
        } else {
            this.showToast('warning', 'No View Set', 'Set a camera view for this point first');
        }
    },

    // Modal helpers
    showModal(content, options = {}) {
        const overlay = document.getElementById('modal-overlay');
        overlay.innerHTML = content;
        overlay.classList.remove('hidden');
        this.activeModal = overlay.firstElementChild;

        // Play popup open sound
        SoundManager.play('popupOpen');

        // Focus first input
        const firstInput = this.activeModal.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.getElementById('modal-overlay').innerHTML = '';
        this.activeModal = null;

        // Play popup close sound
        SoundManager.play('popupClose');
    },

    closeAllModals() {
        this.closeModal();
        ContentManager.closePopup();
        ContentManager.closeVideo();
        ContentManager.closePanorama();
    },

    // File operations
    newProject() {
        this.showConfirm(
            'Create New Project?',
            'Any unsaved changes will be lost.',
            () => {
                State.newProject();
                Renderer.meshes.forEach((_, id) => Renderer.removeMesh(id));
                Renderer.pointSprites.forEach((_, id) => Renderer.removePoint(id));
                this.updateHierarchy();
                // Show language selection for new project
                this.showNewProjectLanguageModal();
            }
        );
    },

    // New project language selection modal
    showNewProjectLanguageModal() {
        const allLanguages = [
            { code: 'en', name: 'English', flag: '🇬🇧', default: true },
            { code: 'ar', name: 'العربية (Arabic)', flag: '🇸🇦' },
            { code: 'ur', name: 'اردو (Urdu)', flag: '🇵🇰' },
            { code: 'fr', name: 'Français', flag: '🇫🇷' },
            { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
            { code: 'es', name: 'Español', flag: '🇪🇸' },
            { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
            { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
            { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
            { code: 'bn', name: 'বাংলা (Bengali)', flag: '🇧🇩' },
            { code: 'hi', name: 'हिन्दी (Hindi)', flag: '🇮🇳' },
            { code: 'zh', name: '中文 (Chinese)', flag: '🇨🇳' },
            { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵' },
            { code: 'ko', name: '한국어 (Korean)', flag: '🇰🇷' },
            { code: 'pt', name: 'Português', flag: '🇵🇹' },
            { code: 'ru', name: 'Русский', flag: '🇷🇺' }
        ];

        this.showModal(`
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">🌍 Select Project Languages</h3>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 16px; color: var(--text-secondary);">
                        Select all languages you want to support in this project. English is always included as the default.
                    </p>
                    <div class="language-grid" id="language-selection">
                        ${allLanguages.map(lang => `
                            <label class="language-checkbox ${lang.default ? 'selected disabled' : ''}">
                                <input type="checkbox" value="${lang.code}" ${lang.default ? 'checked disabled' : ''}>
                                <span class="lang-flag">${lang.flag}</span>
                                <span class="lang-name">${lang.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="confirm-languages">Continue</button>
                </div>
            </div>
        `);

        // Toggle selection
        document.querySelectorAll('.language-checkbox:not(.disabled)').forEach(label => {
            label.addEventListener('click', () => {
                const checkbox = label.querySelector('input');
                checkbox.checked = !checkbox.checked;
                label.classList.toggle('selected', checkbox.checked);
            });
        });

        document.getElementById('confirm-languages').onclick = () => {
            const selected = [];
            document.querySelectorAll('#language-selection input:checked').forEach(input => {
                const lang = allLanguages.find(l => l.code === input.value);
                if (lang) {
                    selected.push({
                        code: lang.code,
                        name: lang.name.split(' (')[0],
                        isDefault: lang.code === 'en',
                        isRTL: ['ar', 'ur', 'he', 'fa'].includes(lang.code)
                    });
                }
            });

            State.setProject('languages', selected);
            this.closeModal();
            this.updateHierarchy();
            this.showToast('success', 'New Project', `Created with ${selected.length} language(s)`);
        };
    },

    openProject() {
        document.getElementById('file-project').click();
        document.getElementById('file-project').onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await Utils.readFileAsText(file);
                const data = JSON.parse(text);
                State.loadProject(data);
                this.showToast('success', 'Project Loaded', file.name);
            } catch (err) {
                this.showToast('error', 'Load Error', err.message);
            }
        };
    },

    saveProject() {
        const data = State.exportProject();
        Utils.downloadJSON(data, `${data.meta.name}.sirah`);
        this.showToast('success', 'Project Saved', `${data.meta.name}.sirah`);
    },

    saveProjectAs() {
        const name = prompt('Project name:', State.getProject('meta.name'));
        if (!name) return;

        State.setProject('meta.name', name);
        this.saveProject();
    },

    importData() {
        document.getElementById('file-project').click();
    },

    exportData() {
        const data = State.exportProject();
        Utils.downloadJSON(data, `${data.meta.name}-data.json`);
    },

    // Show confirm dialog
    showConfirm(title, message, onConfirm, onCancel = null) {
        // Store callbacks globally so they can be accessed from onclick
        window._confirmCallback = onConfirm;
        window._cancelCallback = onCancel;

        this.showModal(`
            <div class="modal confirm-dialog">
                <div class="modal-body" style="padding: 30px;">
                    <div class="confirm-icon warning">⚠️</div>
                    <h3 class="confirm-title">${title}</h3>
                    <p class="confirm-message">${message}</p>
                    <div class="confirm-actions">
                        <button class="confirm-cancel" onclick="UI.closeModal(); if(window._cancelCallback) window._cancelCallback();">Cancel</button>
                        <button class="confirm-action" onclick="UI.closeModal(); if(window._confirmCallback) window._confirmCallback();">Confirm</button>
                    </div>
                </div>
            </div>
        `);
    },

    updateUserMenu() {
        const container = document.getElementById('menu-categories');
        const categories = State.getProject('categories');
        const points = State.getProject('points');
        const actionButtons = State.getProject('actionButtons') || [];
        const currentLang = ContentManager.activeLanguage || 'en';

        console.log('Updating user menu. Categories:', categories.length, 'Points:', points.length, 'Action Buttons:', actionButtons.length);

        // Build category HTML with their points and action buttons
        let menuHTML = '';

        categories.forEach(cat => {
            const categoryPoints = points.filter(p => p.categoryId === cat.id);
            const categoryActionBtns = actionButtons.filter(b => b.placement === 'category' && b.categoryId === cat.id);

            // Get translated name or fallback to default
            const categoryName = cat.names?.[currentLang] || cat.names?.['en'] || cat.name;

            // Get icon (custom image or emoji)
            const iconHTML = cat.customIcon
                ? `<img src="${cat.customIcon}" alt="" class="category-custom-icon">`
                : `<span class="category-icon">${cat.icon || '📍'}</span>`;

            const hasSubmenuItems = categoryPoints.length > 0 || categoryActionBtns.length > 0;

            menuHTML += `
                <div class="menu-category" data-id="${cat.id}">
                    ${iconHTML}
                    <span>${categoryName}</span>
                    ${hasSubmenuItems ? `
                        <div class="category-submenu">
                            ${categoryPoints.map(p => {
                const pointName = p.names?.[currentLang] || p.names?.['en'] || p.name;
                return `
                                    <button class="submenu-item submenu-btn" data-point-id="${p.id}">
                                        <span class="submenu-icon">📍</span>
                                        <span>${pointName}</span>
                                    </button>
                                `;
            }).join('')}
                            ${categoryActionBtns.map(btn => {
                const btnName = btn.names?.[currentLang] || btn.names?.['en'] || btn.name;
                return `
                                    <button class="submenu-item action-btn-trigger" data-action-id="${btn.id}">
                                        <span class="submenu-icon">${btn.icon || '▶'}</span>
                                        <span>${btnName}</span>
                                    </button>
                                `;
            }).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        // Add standalone action buttons
        const standaloneActionBtns = actionButtons.filter(b => b.placement === 'standalone');
        standaloneActionBtns.forEach(btn => {
            const btnName = btn.names?.[currentLang] || btn.names?.['en'] || btn.name;
            menuHTML += `
                <div class="menu-category action-btn-standalone" data-action-id="${btn.id}">
                    <span class="category-icon">${btn.icon || '▶'}</span>
                    <span>${btnName}</span>
                </div>
            `;
        });

        // Add uncategorized points
        const uncategorizedPoints = points.filter(p => !p.categoryId);
        if (uncategorizedPoints.length > 0) {
            menuHTML += `
                <div class="menu-category" data-id="uncategorized">
                    <span class="category-icon">📍</span>
                    <span>Points</span>
                    <div class="category-submenu">
                        ${uncategorizedPoints.map(p => {
                const pointName = p.names?.[currentLang] || p.names?.['en'] || p.name;
                return `
                                <button class="submenu-item submenu-btn" data-point-id="${p.id}">
                                    <span class="submenu-icon">📍</span>
                                    <span>${pointName}</span>
                                </button>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = menuHTML;

        // Apply mesh visibility on load settings
        this.applyMeshVisibilityOnLoad();
        this.applyBorderVisibilityOnLoad();

        // Initially hide all category points
        this.hideAllCategoryPoints();

        // Add click handlers for submenu buttons (points)
        container.querySelectorAll('.submenu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const pointId = btn.dataset.pointId;
                console.log('Submenu button clicked, pointId:', pointId);
                if (pointId) {
                    // Check if clicking same point again (toggle off)
                    if (State.state.activePointId === pointId) {
                        const point = State.findById('points', pointId);
                        if (point?.visibilityMeshes?.length > 0) {
                            this.handleMeshVisibilityTrigger('point', pointId, false);
                        }
                        State.state.activePointId = null;
                        ContentManager.closePopup && ContentManager.closePopup();
                        SoundManager.play('menuClose');
                        return;
                    }

                    // Hide previous point's meshes if any
                    if (State.state.activePointId) {
                        this.handleMeshVisibilityTrigger('point', State.state.activePointId, false);
                    }

                    // Show this point's meshes and track it
                    State.state.activePointId = pointId;
                    this.focusAndOpenPoint(pointId);
                    this.handleMeshVisibilityTrigger('point', pointId, true);
                    SoundManager.play('pointSelect');
                }
            });
        });

        // Add click handlers for action buttons in submenus
        container.querySelectorAll('.action-btn-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const actionId = btn.dataset.actionId;
                if (actionId) {
                    this.executeActionButton(actionId);
                    SoundManager.play('buttonClick');
                }
            });
        });

        // Add click handlers for standalone action buttons
        container.querySelectorAll('.action-btn-standalone').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionId = btn.dataset.actionId;
                if (actionId) {
                    this.executeActionButton(actionId);
                    SoundManager.play('buttonClick');
                }
            });
        });

        // Category click: toggle point visibility and submenu
        container.querySelectorAll('.menu-category:not(.action-btn-standalone)').forEach(catEl => {
            catEl.addEventListener('click', (e) => {
                // Don't trigger if clicking on submenu item
                if (e.target.closest('.submenu-btn') || e.target.closest('.action-btn-trigger')) return;

                e.stopPropagation();
                const catId = catEl.dataset.id;
                const submenu = catEl.querySelector('.category-submenu');
                const isActive = catEl.classList.contains('active');

                // Play sound
                SoundManager.play(isActive ? 'menuClose' : 'menuOpen');

                if (isActive) {
                    // Hide points and close submenu
                    catEl.classList.remove('active');
                    if (submenu) submenu.classList.remove('open');
                    if (catId && catId !== 'uncategorized') {
                        this.setCategoryPointsVisible(catId, false);
                    }
                    // Handle mesh visibility trigger on category close
                    this.handleMeshVisibilityTrigger('category', catId, false);
                } else {
                    // Show points and open submenu
                    catEl.classList.add('active');
                    if (submenu) {
                        submenu.classList.add('open');
                        // Adjust submenu position if it goes off screen
                        this.adjustSubmenuPosition(submenu);
                    }
                    if (catId && catId !== 'uncategorized') {
                        this.setCategoryPointsVisible(catId, true);
                    }
                    // Handle mesh visibility trigger on category open
                    this.handleMeshVisibilityTrigger('category', catId, true);
                }
            });
        });
    },

    // Adjust submenu position to stay within viewport
    adjustSubmenuPosition(submenu) {
        if (!submenu) return;

        // Reset alignment first
        submenu.classList.remove('align-right');

        // Wait for DOM update then check position
        requestAnimationFrame(() => {
            const rect = submenu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            // If submenu goes off right edge, align to right
            if (rect.right > viewportWidth - 10) {
                submenu.classList.add('align-right');
            }

            // If it still goes off left edge after alignment, reset
            const newRect = submenu.getBoundingClientRect();
            if (newRect.left < 10) {
                submenu.classList.remove('align-right');
            }
        });
    },

    // Apply mesh visibility on load settings
    applyMeshVisibilityOnLoad() {
        const meshes = State.getProject('meshes') || [];
        meshes.forEach(mesh => {
            const meshData = Renderer.meshes.get(mesh.id);
            if (meshData && mesh.visibleOnLoad === false) {
                meshData.object.visible = false;
            }
        });
    },

    // Handle mesh visibility triggers (both legacy and new visibilityMeshes array)
    handleMeshVisibilityTrigger(triggerType, triggerId, show = null) {
        // Handle new visibilityMeshes array approach
        if (triggerType === 'category') {
            const category = State.findById('categories', triggerId);
            if (category && category.visibilityMeshes && category.visibilityMeshes.length > 0) {
                const isActive = show !== null ? show : document.querySelector(`.menu-category[data-id="${triggerId}"]`)?.classList.contains('active');
                Renderer.toggleMeshesVisibility && Renderer.toggleMeshesVisibility(category.visibilityMeshes, isActive);
            }
        } else if (triggerType === 'point') {
            const point = State.findById('points', triggerId);
            if (point && point.visibilityMeshes && point.visibilityMeshes.length > 0) {
                Renderer.toggleMeshesVisibility && Renderer.toggleMeshesVisibility(point.visibilityMeshes, show !== null ? show : true);
            }
        }

        // Also handle legacy single-mesh visibility trigger on meshes
        const meshes = State.getProject('meshes') || [];
        meshes.forEach(mesh => {
            if (mesh.visibilityTrigger?.type === triggerType && mesh.visibilityTrigger?.targetId === triggerId) {
                const meshData = Renderer.meshes.get(mesh.id);
                if (meshData) {
                    meshData.object.visible = !meshData.object.visible;
                    console.log(`Toggled mesh ${mesh.name} visibility to ${meshData.object.visible}`);
                }
            }
        });
    },

    // Execute action button
    executeActionButton(actionId) {
        const btn = State.findById('actionButtons', actionId);
        if (!btn) return;

        console.log('Executing action button:', btn.name, btn.actions);

        // Handle mesh visibility trigger
        this.handleMeshVisibilityTrigger('actionButton', actionId);

        // Execute each enabled action
        if (btn.actions?.showImage?.enabled && btn.actions.showImage.imageData) {
            ContentManager.showImagePopup(btn.actions.showImage.imageData);
        }

        if (btn.actions?.playVideo?.enabled && btn.actions.playVideo.videoData) {
            ContentManager.showVideo(btn.actions.playVideo.videoData, btn.actions.playVideo.autoplay);
        }

        if (btn.actions?.playAudio?.enabled && btn.actions.playAudio.audioData) {
            ContentManager.playAudio(btn.actions.playAudio.audioData);
        }

        if (btn.actions?.toggleMesh?.enabled && btn.actions.toggleMesh.meshId) {
            const meshData = Renderer.meshes.get(btn.actions.toggleMesh.meshId);
            if (meshData) {
                meshData.object.visible = !meshData.object.visible;
                console.log(`Toggled mesh visibility to ${meshData.object.visible}`);
            }
        }
    },

    // Hide all points that have categories
    hideAllCategoryPoints() {
        const points = State.getProject('points');
        points.forEach(p => {
            if (p.categoryId) {
                const sprite = PointsManager.sprites.get(p.id);
                if (sprite) sprite.visible = false;
                const line = PointsManager.liftLines?.get(p.id);
                if (line) line.visible = false;
            }
        });
    },

    // Set visibility for all points in a category
    setCategoryPointsVisible(categoryId, visible) {
        const points = State.getProject('points');
        points.forEach(p => {
            if (p.categoryId === categoryId) {
                const sprite = PointsManager.sprites.get(p.id);
                if (sprite) sprite.visible = visible;
                const line = PointsManager.liftLines?.get(p.id);
                if (line) line.visible = visible;
            }
        });
    },

    // Focus on point and open its content
    focusAndOpenPoint(pointId) {
        console.log('Focusing on point:', pointId);
        const point = State.findById('points', pointId);
        if (!point) {
            console.error('Point not found:', pointId);
            return;
        }

        // Make sure the point is visible
        const sprite = PointsManager.sprites.get(pointId);
        if (sprite) {
            sprite.visible = true;
            const line = PointsManager.liftLines?.get(pointId);
            if (line) line.visible = true;
        }

        // Focus camera on point
        if (point.cameraView) {
            Renderer.goToView(point.cameraView);
        } else if (point.position) {
            const pos = point.position;
            Renderer.animateCameraTo(
                { x: pos.x + 15, y: pos.y + 15, z: pos.z + 15 },
                pos
            );
        }

        // Open content if point has content
        if (point.contentId && point.contentType) {
            setTimeout(() => {
                ContentManager.openContent(pointId);
            }, 500);
        } else {
            // Show a simple popup with point name
            this.showToast('info', point.names?.[ContentManager.activeLanguage] || point.name);
        }
    },

    toggleFullscreen() {
        if (Utils.isFullscreen()) {
            Utils.exitFullscreen();
        } else {
            Utils.requestFullscreen(document.documentElement);
        }
    },

    // Delete operations
    deleteSelected() {
        const { type, id } = State.state.selected;
        if (!id) return;

        this.showConfirm(
            `Delete ${type}?`,
            'This action cannot be undone.',
            () => {
                if (type === 'point') this.deletePoint(id);
                else if (type === 'mesh') this.deleteMesh(id);
                else if (type === 'textbox') this.deleteTextbox(id);
                else if (type === 'border') this.deleteBorder(id);
            }
        );
    },

    deletePoint(id) {
        Renderer.removePoint(id);
        State.removeFromProject('points', id);
        State.clearSelection();
        this.showToast('success', 'Point Deleted');
    },

    deleteMesh(id) {
        Renderer.removeMesh(id);
        State.removeFromProject('meshes', id);
        State.clearSelection();
        this.showToast('success', 'Mesh Deleted');
    },

    deleteTextbox(id) {
        State.removeFromProject('textboxes', id);
        State.clearSelection();
        this.showToast('success', 'Text Box Deleted');
    },

    deleteBorder(id) {
        if (Renderer.removeBorder) {
            Renderer.removeBorder(id);
        }
        State.removeFromProject('borders', id);
        State.clearSelection();
        this.updateBordersList();
        this.showToast('success', 'Border Deleted');
    },

    deleteCategory(id) {
        console.log('=== deleteCategory START ===');
        console.log('id:', id);
        const category = State.findById('categories', id);
        console.log('category found:', category);
        if (!category) {
            console.log('No category found, returning early');
            return;
        }

        // Use native confirm dialog to test if logic works
        const categoryName = category.names?.en || category.name || 'Category';
        const confirmed = confirm(`Delete "${categoryName}"?\n\nPoints in this category will become uncategorized.`);

        if (!confirmed) {
            console.log('User cancelled');
            return;
        }

        console.log('User confirmed, deleting...');

        // Remove category from points
        const points = State.getProject('points') || [];
        console.log('Points count:', points.length);
        points.forEach(p => {
            if (p.categoryId === id) {
                console.log('Updating point:', p.id);
                State.updateInProject('points', p.id, { categoryId: null });
            }
        });

        console.log('Calling State.removeFromProject...');
        const result = State.removeFromProject('categories', id);
        console.log('removeFromProject result:', result);

        console.log('Calling State.clearSelection...');
        State.clearSelection();

        console.log('Calling updateHierarchy...');
        this.updateHierarchy();

        console.log('Showing toast...');
        this.showToast('success', 'Category Deleted');
        console.log('=== deleteCategory COMPLETE ===');
    },

    async duplicatePoint(id) {
        const point = State.findById('points', id);
        if (!point) return;

        const newPoint = Utils.deepClone(point);
        newPoint.id = Utils.generateId('point');
        newPoint.name = `${point.name} (Copy)`;
        newPoint.position = {
            x: point.position.x + 2,
            y: point.position.y,
            z: point.position.z + 2
        };

        State.addToProject('points', newPoint);
        await Renderer.addPoint(newPoint.id, newPoint);
        State.select('point', newPoint.id);

        this.showToast('success', 'Point Duplicated');
    },

    // AI operations
    async aiTranslateTextbox() {
        const id = State.state.selected.id;
        if (!id) return;

        const textbox = State.findById('textboxes', id);
        if (!textbox) return;

        const languages = State.getProject('languages');
        const sourceContent = textbox.content['en'];

        if (!sourceContent) {
            this.showToast('error', 'No Source Content', 'Please add English content first');
            return;
        }

        this.showLoading('Translating...');

        try {
            for (const lang of languages) {
                if (lang.code === 'en') continue;

                const translated = await AI.translateText(
                    `${sourceContent.heading}\n---\n${sourceContent.body}`,
                    lang.code
                );

                const [heading, ...bodyParts] = translated.split('\n---\n');

                textbox.content[lang.code] = {
                    heading: heading.trim(),
                    body: bodyParts.join('\n---\n').trim()
                };
            }

            State.emit('projectChange', { path: 'textboxes', action: 'update', id });
            this.showToast('success', 'Translation Complete', `Translated to ${languages.length - 1} languages`);
        } catch (err) {
            this.showToast('error', 'Translation Error', err.message);
        } finally {
            this.hideLoading();
        }
    },

    // Global translate all content
    async translateAllContent() {
        const languages = State.getProject('languages');
        if (languages.length <= 1) {
            this.showToast('warning', 'Add Languages', 'Add more languages to translate to');
            return;
        }

        const textboxes = State.getProject('textboxes');
        const categories = State.getProject('categories');
        const points = State.getProject('points');
        const actionButtons = State.getProject('actionButtons') || [];

        const totalItems = textboxes.length + categories.length + points.length + actionButtons.length;
        if (totalItems === 0) {
            this.showToast('warning', 'No Content', 'No content to translate');
            return;
        }

        this.showLoading(`Translating ${totalItems} items...`);

        let translated = 0;

        try {
            // Translate textboxes
            for (const textbox of textboxes) {
                const source = textbox.content['en'];
                if (!source?.heading && !source?.body) continue;

                for (const lang of languages) {
                    if (lang.code === 'en') continue;

                    // Skip if both heading and body are already translated
                    const existing = textbox.content[lang.code];
                    if (existing?.heading && existing?.body) continue;

                    const result = await AI.translateText(
                        `HEADING: ${source.heading || ''}\n---BODY---\n${source.body || ''}`,
                        lang.code
                    );

                    // Parse the result
                    const headingMatch = result.match(/HEADING:\s*(.*?)(?=\n---BODY---|$)/s);
                    const bodyMatch = result.match(/---BODY---\s*(.*)/s);

                    textbox.content[lang.code] = {
                        heading: headingMatch ? headingMatch[1].trim() : (existing?.heading || ''),
                        body: bodyMatch ? bodyMatch[1].trim() : (existing?.body || '')
                    };
                }
                translated++;
                this.updateLoadingText(`Translating... ${translated}/${totalItems}`);
            }

            // Translate categories
            for (const category of categories) {
                if (!category.name) continue;
                if (!category.names) category.names = { en: category.name };

                for (const lang of languages) {
                    if (lang.code === 'en') continue;
                    if (category.names[lang.code]) continue;

                    category.names[lang.code] = await AI.translateText(category.name, lang.code);
                }
                translated++;
                this.updateLoadingText(`Translating... ${translated}/${totalItems}`);
            }

            // Translate point names
            for (const point of points) {
                if (!point.name) continue;
                if (!point.names) point.names = { en: point.name };

                for (const lang of languages) {
                    if (lang.code === 'en') continue;
                    if (point.names[lang.code]) continue;

                    point.names[lang.code] = await AI.translateText(point.name, lang.code);
                }
                translated++;
                this.updateLoadingText(`Translating... ${translated}/${totalItems}`);
            }

            // Translate action button names
            const actionButtons = State.getProject('actionButtons') || [];
            for (const btn of actionButtons) {
                if (!btn.name) continue;
                if (!btn.names) btn.names = { en: btn.name };

                for (const lang of languages) {
                    if (lang.code === 'en') continue;
                    if (btn.names[lang.code]) continue;

                    btn.names[lang.code] = await AI.translateText(btn.name, lang.code);
                }
                translated++;
                this.updateLoadingText(`Translating... ${translated}/${totalItems}`);
            }

            State.emit('projectChange', { path: 'all', action: 'update' });
            this.showToast('success', 'Translation Complete', `Translated ${translated} items`);
        } catch (err) {
            this.showToast('error', 'Translation Error', err.message);
        } finally {
            this.hideLoading();
        }
    },

    // Translate action button to all languages
    async aiTranslateActionButton() {
        const id = State.state.selected.id;
        if (!id) return;

        const btn = State.findById('actionButtons', id);
        if (!btn) return;

        const languages = State.getProject('languages');
        const sourceName = btn.names?.en || btn.name;

        if (!sourceName) {
            this.showToast('error', 'No Source Name', 'Please add English name first');
            return;
        }

        this.showLoading('Translating...');

        try {
            const names = { en: sourceName };

            for (const lang of languages) {
                if (lang.code === 'en') continue;
                names[lang.code] = await AI.translateText(sourceName, lang.code);
            }

            State.updateInProject('actionButtons', id, { names });
            this.showActionButtonProperties(id); // Refresh
            this.showToast('success', 'Translation Complete', `Translated to ${languages.length - 1} languages`);
        } catch (err) {
            this.showToast('error', 'Translation Error', err.message);
        } finally {
            this.hideLoading();
        }
    },

    updateLoadingText(text) {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = text;
    },

    // Duplicate functions
    duplicateTextbox(id) {
        const original = State.findById('textboxes', id);
        if (!original) return;

        const duplicate = JSON.parse(JSON.stringify(original));
        duplicate.id = Utils.generateId('textbox');

        // Update names
        for (const lang in duplicate.content) {
            if (duplicate.content[lang].heading) {
                duplicate.content[lang].heading += ' (Copy)';
            }
        }

        State.addToProject('textboxes', duplicate);
        State.select('textbox', duplicate.id);
        this.showToast('success', 'Duplicated', 'Text box duplicated');
    },

    duplicateMesh(id) {
        const original = State.findById('meshes', id);
        if (!original) return;

        const duplicate = JSON.parse(JSON.stringify(original));
        duplicate.id = Utils.generateId('mesh');
        duplicate.name += ' (Copy)';

        // Offset position slightly
        duplicate.position.x += 5;

        State.addToProject('meshes', duplicate);

        // Load the 3D model copy
        if (duplicate.fileData) {
            const file = this.base64ToFile(duplicate.fileData, duplicate.filename, 'model/gltf-binary');
            Renderer.loadAndAddModel(file, duplicate.id, duplicate);
        }

        State.select('mesh', duplicate.id);
        this.showToast('success', 'Duplicated', 'Mesh duplicated');
    },

    duplicateCategory(id) {
        const original = State.findById('categories', id);
        if (!original) return;

        const duplicate = JSON.parse(JSON.stringify(original));
        duplicate.id = Utils.generateId('cat');
        duplicate.name += ' (Copy)';
        if (duplicate.names) {
            for (const lang in duplicate.names) {
                duplicate.names[lang] += ' (Copy)';
            }
        }

        State.addToProject('categories', duplicate);
        this.showToast('success', 'Duplicated', 'Category duplicated');
    },

    duplicatePoint(id) {
        const original = State.findById('points', id);
        if (!original) return;

        const duplicate = JSON.parse(JSON.stringify(original));
        duplicate.id = Utils.generateId('point');
        duplicate.name += ' (Copy)';
        if (duplicate.names) {
            for (const lang in duplicate.names) {
                duplicate.names[lang] += ' (Copy)';
            }
        }

        // Offset position
        duplicate.position.x += 2;
        duplicate.position.z += 2;

        State.addToProject('points', duplicate);
        Renderer.addPoint(duplicate.id, duplicate);
        State.select('point', duplicate.id);
        this.showToast('success', 'Duplicated', 'Point duplicated');
    },

    async aiEnhanceContent() {
        const id = State.state.selected.id;
        if (!id) return;

        const textbox = State.findById('textboxes', id);
        if (!textbox) return;

        const lang = document.getElementById('textbox-language')?.value || 'en';
        const content = textbox.content[lang];

        if (!content?.body) {
            this.showToast('error', 'No Content', 'Please add content first');
            return;
        }

        this.showLoading('Enhancing...');

        try {
            const enhanced = await AI.enhanceContent(content.body);
            textbox.content[lang].body = enhanced;

            document.getElementById('textbox-body').value = enhanced;

            State.emit('projectChange', { path: 'textboxes', action: 'update', id });
            this.showToast('success', 'Content Enhanced');
        } catch (err) {
            this.showToast('error', 'Enhancement Error', err.message);
        } finally {
            this.hideLoading();
        }
    },

    // Placeholder modal methods (will be expanded)
    showAddMeshModal() {
        this.showModal(`
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">Add 3D Mesh</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="mesh-dropzone" id="mesh-dropzone">
                        <div class="mesh-dropzone-icon">📦</div>
                        <div class="mesh-dropzone-text">
                            <h4>Drop 3D model here</h4>
                            <p>or click to browse</p>
                        </div>
                        <div class="mesh-formats">
                            <span class="format-badge">GLB</span>
                            <span class="format-badge">GLTF</span>
                        </div>
                    </div>
                </div>
            </div>
        `);

        const dropzone = document.getElementById('mesh-dropzone');
        const fileInput = document.getElementById('file-mesh');

        // Store reference to handle function so we can remove it later
        const handleFileSelect = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.loadMeshFile(file);
            }
            // Reset input value to allow selecting same file again
            e.target.value = '';
            // Remove this handler to prevent duplicate calls
            fileInput.removeEventListener('change', handleFileSelect);
        };

        dropzone.addEventListener('click', () => {
            // Clear any existing handler and add new one
            fileInput.onchange = null;
            fileInput.addEventListener('change', handleFileSelect, { once: true });
            fileInput.click();
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) await this.loadMeshFile(file);
        });
    },

    async loadMeshFile(file) {
        console.log('📂 UI.loadMeshFile called with:', file.name);

        if (!file.name.match(/\.(glb|gltf)$/i)) {
            this.showToast('error', 'Unsupported Format', 'Please use GLB or GLTF');
            return;
        }

        this.closeModal();
        this.showLoading('Loading 3D model...');

        try {
            const id = Utils.generateId('mesh');

            // Convert file to base64 for storage
            const base64Data = await this.fileToBase64(file);

            const meshData = {
                id: id,
                name: file.name.replace(/\.[^/.]+$/, ''),
                filename: file.name,
                fileData: base64Data, // Store the actual file data
                fileSize: file.size,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                animations: [],
                animationSettings: {
                    clip: 0,
                    mode: 'loop',
                    autoPlay: true,
                    speed: 1
                }
            };

            // Use the new simplified loader that works like test.html
            const result = await Renderer.loadAndAddModel(file, id, meshData);

            // Update mesh data with actual transforms used (especially important for first import)
            if (result.position) {
                meshData.position = result.position;
            }
            if (result.rotation) {
                meshData.rotation = result.rotation;
            }
            if (result.scale) {
                meshData.scale = result.scale;
            }

            // Update mesh data with animation info
            if (result.animations && result.animations.length > 0) {
                meshData.animations = result.animations.map(a => ({
                    name: a.name || 'Animation',
                    duration: a.duration
                }));
            }

            // Add to state
            State.addToProject('meshes', meshData);

            // Select the mesh
            State.select('mesh', id);

            this.hideLoading();
            this.showToast('success', 'Mesh Added', meshData.name);

            console.log('✅ Mesh loaded successfully:', meshData.name);

        } catch (err) {
            this.hideLoading();
            console.error('❌ Mesh load error:', err);
            this.showToast('error', 'Load Error', err.message);
        }
    },

    showAddTextboxModal() {
        const textbox = ContentManager.createTextbox();
        State.select('textbox', textbox.id);
        this.showToast('success', 'Text Box Created');
    },

    // ================================
    // Folder Management
    // ================================

    _lastFolderCreateTime: 0, // Debounce using timestamp

    createFolder(folderPath, listId) {
        // Prevent double creation within 500ms
        const now = Date.now();
        if (now - this._lastFolderCreateTime < 500) {
            console.log('createFolder: debouncing duplicate call');
            return;
        }
        this._lastFolderCreateTime = now;

        console.log('createFolder called:', folderPath, listId);

        const folderId = Utils.generateId('folder');
        const folder = {
            id: folderId,
            name: 'New Folder',
            expanded: true,
            itemIds: []
        };

        State.addToProject(folderPath, folder);
        this.refreshHierarchy();
        this.showToast('success', 'Folder Created');

        // Trigger rename immediately
        setTimeout(() => {
            this.startFolderRename(folderId, folderPath);
        }, 100);
    },

    deleteFolder(folderId, folderPath) {
        const folder = State.findById(folderPath, folderId);
        if (!folder) return;

        // Remove folder but keep items (they become unfiled)
        State.removeFromProject(folderPath, folderId);
        this.refreshHierarchy();
        this.showToast('info', 'Folder Deleted', 'Items have been unfiled');
    },

    renameFolder(folderId, folderPath, newName) {
        State.updateInProject(folderPath, folderId, { name: newName });
        this.refreshHierarchy();
    },

    startFolderRename(folderId, folderPath) {
        const folderEl = document.querySelector(`[data-folder-id="${folderId}"]`);
        if (!folderEl) return;

        const nameEl = folderEl.querySelector('.tree-folder-name');
        if (!nameEl) return;

        const currentName = nameEl.textContent;
        nameEl.contentEditable = true;
        nameEl.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(nameEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const saveRename = () => {
            nameEl.contentEditable = false;
            const newName = nameEl.textContent.trim() || currentName;
            this.renameFolder(folderId, folderPath, newName);
        };

        nameEl.addEventListener('blur', saveRename, { once: true });
        nameEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameEl.blur();
            } else if (e.key === 'Escape') {
                nameEl.textContent = currentName;
                nameEl.blur();
            }
        });
    },

    toggleFolder(folderId, folderPath) {
        console.log('toggleFolder called:', folderId, folderPath);
        const folder = State.findById(folderPath, folderId);
        if (!folder) {
            console.warn('Folder not found:', folderId, 'in', folderPath);
            return;
        }
        console.log('Toggling folder:', folder.name, 'from', folder.expanded, 'to', !folder.expanded);
        State.updateInProject(folderPath, folderId, { expanded: !folder.expanded }, false);
        this.refreshHierarchy();
    },

    addItemToFolder(itemId, folderId, folderPath) {
        const folder = State.findById(folderPath, folderId);
        if (!folder) return;

        // First remove from any other folder
        this.removeItemFromAllFolders(itemId, folderPath);

        // Add to this folder
        const itemIds = [...folder.itemIds, itemId];
        State.updateInProject(folderPath, folderId, { itemIds });
        this.refreshHierarchy();
    },

    // Batch add multiple items to folder (for multi-select drag)
    addItemsToFolder(itemIdsToAdd, folderId, folderPath) {
        const folder = State.findById(folderPath, folderId);
        if (!folder) {
            console.warn('addItemsToFolder: folder not found', folderId);
            return;
        }

        console.log('Batch adding', itemIdsToAdd.length, 'items to folder:', folderId, 'folderPath:', folderPath);

        // First remove all items from any other folders
        itemIdsToAdd.forEach(itemId => {
            this.removeItemFromAllFolders(itemId, folderPath);
        });

        // Re-get folder after removing (in case it was modified)
        const updatedFolder = State.findById(folderPath, folderId);
        if (!updatedFolder) {
            console.warn('addItemsToFolder: folder disappeared after remove operation');
            return;
        }

        // Add all items to this folder at once (handle undefined itemIds)
        const existingItems = updatedFolder.itemIds || [];
        const newItemIds = [...existingItems, ...itemIdsToAdd];
        // Remove duplicates
        const uniqueItemIds = [...new Set(newItemIds)];

        State.updateInProject(folderPath, folderId, { itemIds: uniqueItemIds });

        console.log('Folder now has', uniqueItemIds.length, 'items:', uniqueItemIds);

        // Only refresh once at the end
        this.refreshHierarchy();
    },

    removeItemFromFolder(itemId, folderId, folderPath) {
        const folder = State.findById(folderPath, folderId);
        if (!folder) return;

        const itemIds = folder.itemIds.filter(id => id !== itemId);
        State.updateInProject(folderPath, folderId, { itemIds });
        this.refreshHierarchy();
    },

    removeItemFromAllFolders(itemId, folderPath) {
        const folders = State.getProject(folderPath) || [];
        folders.forEach(folder => {
            if (folder.itemIds.includes(itemId)) {
                const itemIds = folder.itemIds.filter(id => id !== itemId);
                State.updateInProject(folderPath, folder.id, { itemIds }, false);
            }
        });
    },

    ungroupAllFromFolder(folderId, folderPath) {
        const folder = State.findById(folderPath, folderId);
        if (!folder) return;

        State.updateInProject(folderPath, folderId, { itemIds: [] });
        this.refreshHierarchy();
        this.showToast('info', 'All items ungrouped');
    },

    showFolderContextMenu(e, folderId, folderPath) {
        e.preventDefault();
        e.stopPropagation();

        // Remove existing context menu
        document.querySelector('.folder-context-menu')?.remove();

        const menu = document.createElement('div');
        menu.className = 'folder-context-menu';
        menu.innerHTML = `
            <button data-action="rename"><span class="menu-icon">✏️</span> Rename</button>
            <button data-action="delete"><span class="menu-icon">🗑️</span> Delete Folder</button>
            <button data-action="ungroup"><span class="menu-icon">📤</span> Ungroup All Items</button>
        `;

        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        document.body.appendChild(menu);

        menu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                menu.remove();

                switch (action) {
                    case 'rename':
                        this.startFolderRename(folderId, folderPath);
                        break;
                    case 'delete':
                        this.deleteFolder(folderId, folderPath);
                        break;
                    case 'ungroup':
                        this.ungroupAllFromFolder(folderId, folderPath);
                        break;
                }
            });
        });

        // Close on outside click
        const closeMenu = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    },


    showAddCategoryModal() {
        const languages = State.getProject('languages');

        this.showModal(`
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">Add Category</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="category-form">
                        <div class="prop-row">
                            <label>Icon</label>
                            <div class="category-icon-upload">
                                <div class="category-icon-preview" id="cat-icon-preview">📍</div>
                                <div class="icon-picker-mini">
                                    ${['🏠', '🕌', '⛲', '🏛️', '🛣️', '🌳', '⭐', '📍', '🎯', '🏰', '⛪', '🕋'].map(icon =>
            `<button class="icon-option-mini" data-icon="${icon}">${icon}</button>`
        ).join('')}
                                </div>
                                <span class="or-divider">or</span>
                                <button class="btn btn-secondary btn-sm" id="upload-cat-icon">Upload Image</button>
                                <input type="file" id="cat-icon-file" accept="image/*" hidden>
                            </div>
                        </div>
                        
                        <div class="prop-row">
                            <label>Names (by language)</label>
                        </div>
                        
                        ${languages.map(lang => `
                            <div class="prop-row">
                                <label class="lang-label">${lang.code.toUpperCase()}</label>
                                <input type="text" id="cat-name-${lang.code}" 
                                       placeholder="Category name in ${lang.name}"
                                       dir="${['ar', 'he', 'fa', 'ur'].includes(lang.code) ? 'rtl' : 'ltr'}">
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="add-cat-btn">Add Category</button>
                </div>
            </div>
        `);

        let selectedIcon = '📍';
        let customIconData = null;

        // Emoji icon selection
        document.querySelectorAll('.icon-option-mini').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.icon-option-mini').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedIcon = btn.dataset.icon;
                customIconData = null;
                document.getElementById('cat-icon-preview').innerHTML = selectedIcon;
            });
        });

        // Custom icon upload
        document.getElementById('upload-cat-icon').addEventListener('click', () => {
            document.getElementById('cat-icon-file').click();
        });

        document.getElementById('cat-icon-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                customIconData = await this.fileToBase64(file);
                document.getElementById('cat-icon-preview').innerHTML = `<img src="${customIconData}" alt="icon">`;
                document.querySelectorAll('.icon-option-mini').forEach(b => b.classList.remove('selected'));
            }
        });

        document.getElementById('add-cat-btn').onclick = () => {
            const names = {};
            let hasName = false;

            languages.forEach(lang => {
                const nameInput = document.getElementById(`cat-name-${lang.code}`);
                if (nameInput && nameInput.value.trim()) {
                    names[lang.code] = nameInput.value.trim();
                    hasName = true;
                }
            });

            if (!hasName) {
                this.showToast('error', 'Name Required', 'Enter at least one language name');
                return;
            }

            // Use English name as default, or first available
            const defaultName = names['en'] || Object.values(names)[0];

            const category = {
                id: Utils.generateId('cat'),
                name: defaultName,
                names: names, // Multilingual names
                icon: customIconData ? null : selectedIcon,
                customIcon: customIconData, // Custom uploaded icon
                color: '#00C8FF',
                order: State.getProject('categories').length
            };

            State.addToProject('categories', category);
            this.closeModal();
            this.showToast('success', 'Category Added', defaultName);
        };
    },

    // Show category properties panel
    showCategoryProperties(id) {
        const category = State.findById('categories', id);
        if (!category) return;

        // Hide other property panels
        document.querySelectorAll('.properties-section').forEach(s => s.classList.add('hidden'));
        document.getElementById('props-category')?.classList.remove('hidden');

        const languages = State.getProject('languages') || [];

        // Update icon preview
        const iconPreview = document.getElementById('cat-props-icon-preview');
        if (iconPreview) {
            const isImage = category.icon && (category.icon.startsWith('data:') || category.icon.startsWith('http'));
            iconPreview.innerHTML = isImage
                ? `<img src="${category.icon}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px;">`
                : `<span style="font-size: 24px;">${category.icon || '📁'}</span>`;
        }

        // Populate multilingual names
        const namesContainer = document.getElementById('cat-props-names');
        if (namesContainer) {
            namesContainer.innerHTML = languages.map(lang => `
                <div class="prop-row">
                    <label style="width: 40px;">${lang.code.toUpperCase()}</label>
                    <input type="text" 
                           class="cat-name-input" 
                           data-lang="${lang.code}" 
                           value="${category.names?.[lang.code] || ''}" 
                           placeholder="Name in ${lang.name}"
                           dir="${['ar', 'he', 'fa', 'ur'].includes(lang.code) ? 'rtl' : 'ltr'}">
                </div>
            `).join('');

            // Add change listeners
            namesContainer.querySelectorAll('.cat-name-input').forEach(input => {
                input.addEventListener('change', () => {
                    const names = { ...(category.names || {}) };
                    names[input.dataset.lang] = input.value.trim();
                    const defaultName = names['en'] || Object.values(names).find(n => n) || '';
                    State.updateInProject('categories', id, { names, name: defaultName });
                    this.updateHierarchy();
                });
            });
        }

        // Click sound
        const clickSound = category.clickSound || { source: 'none', url: '' };
        document.getElementById('category-click-sound-source').value = clickSound.source || 'none';
        document.getElementById('category-sound-url-section').classList.toggle('hidden', clickSound.source !== 'url');
        document.getElementById('category-click-sound-url').value = clickSound.url || '';

        // Mesh visibility checkboxes
        this.populateMeshCheckboxes('category', category.visibilityMeshes || []);
    },

    // Update selected category
    updateSelectedCategory(updates) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'category') return;

        const category = State.findById('categories', id);
        if (!category) return;

        // Deep merge updates
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'object' && updates[key] !== null) {
                category[key] = { ...(category[key] || {}), ...updates[key] };
            } else {
                category[key] = updates[key];
            }
        });

        State.emit('projectChange', { path: 'categories', action: 'update', id });
    },

    // Show action button properties (simplified)
    showActionButtonProperties(id) {
        const btn = (State.getProject('actionButtons') || []).find(b => b.id === id);
        if (!btn) return;

        // Hide other property panels
        document.querySelectorAll('.properties-section').forEach(s => s.classList.add('hidden'));
        document.getElementById('props-action-button')?.classList.remove('hidden');

        // Populate basic fields
        const nameEl = document.getElementById('action-btn-name');
        const iconEl = document.getElementById('action-btn-icon');
        if (nameEl) nameEl.value = btn.name || '';
        if (iconEl) iconEl.value = btn.icon || '';

        // Show content type info
        const contentInfo = document.getElementById('action-btn-content-info');
        if (contentInfo) {
            contentInfo.innerHTML = `
                <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: var(--text-secondary);">Content Type: <strong>${btn.contentType || 'None'}</strong></p>
                    ${btn.contentType === 'textbox' ? `<p style="margin: 0; font-size: 12px;">Linked to textbox: ${btn.contentId || 'None'}</p>` : ''}
                    ${btn.contentType === 'link' ? `<p style="margin: 0; font-size: 12px;">URL: ${btn.content?.link || 'None'}</p>` : ''}
                </div>
            `;
        }
    },

    // Update action button
    updateSelectedActionButton(updates) {
        const id = State.state.selected.id;
        if (!id || State.state.selected.type !== 'actionButton') return;

        const actionButtons = State.getProject('actionButtons') || [];
        const index = actionButtons.findIndex(b => b.id === id);
        if (index >= 0) {
            actionButtons[index] = { ...actionButtons[index], ...updates };
            State.setProject('actionButtons', actionButtons);
        }
    },

    // Edit existing category
    showEditCategoryModal(categoryId) {
        const category = State.findById('categories', categoryId);
        if (!category) return;

        const languages = State.getProject('languages');

        this.showModal(`
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">Edit Category</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="category-form">
                        <div class="prop-row">
                            <label>Icon</label>
                            <div class="category-icon-upload">
                                <div class="category-icon-preview" id="cat-icon-preview">
                                    ${category.customIcon
                ? `<img src="${category.customIcon}" alt="icon">`
                : category.icon || '📍'}
                                </div>
                                <div class="icon-picker-mini">
                                    ${['🏠', '🕌', '⛲', '🏛️', '🛣️', '🌳', '⭐', '📍', '🎯', '🏰', '⛪', '🕋'].map(icon =>
                    `<button class="icon-option-mini ${icon === category.icon ? 'selected' : ''}" data-icon="${icon}">${icon}</button>`
                ).join('')}
                                </div>
                                <span class="or-divider">or</span>
                                <button class="btn btn-secondary btn-sm" id="upload-cat-icon">Upload Image</button>
                                <input type="file" id="cat-icon-file" accept="image/*" hidden>
                            </div>
                        </div>
                        
                        <div class="prop-row">
                            <label>Names (by language)</label>
                        </div>
                        
                        ${languages.map(lang => `
                            <div class="prop-row">
                                <label class="lang-label">${lang.code.toUpperCase()}</label>
                                <input type="text" id="cat-name-${lang.code}" 
                                       value="${category.names?.[lang.code] || ''}"
                                       placeholder="Category name in ${lang.name}"
                                       dir="${['ar', 'he', 'fa', 'ur'].includes(lang.code) ? 'rtl' : 'ltr'}">
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger" id="delete-cat-btn">Delete</button>
                    <div style="flex: 1;"></div>
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="save-cat-btn">Save Changes</button>
                </div>
            </div>
        `);

        let selectedIcon = category.icon || '📍';
        let customIconData = category.customIcon || null;

        // Emoji icon selection
        document.querySelectorAll('.icon-option-mini').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.icon-option-mini').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedIcon = btn.dataset.icon;
                customIconData = null;
                document.getElementById('cat-icon-preview').innerHTML = selectedIcon;
            });
        });

        // Custom icon upload
        document.getElementById('upload-cat-icon').addEventListener('click', () => {
            document.getElementById('cat-icon-file').click();
        });

        document.getElementById('cat-icon-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                customIconData = await this.fileToBase64(file);
                document.getElementById('cat-icon-preview').innerHTML = `<img src="${customIconData}" alt="icon">`;
                document.querySelectorAll('.icon-option-mini').forEach(b => b.classList.remove('selected'));
            }
        });

        // Delete button
        document.getElementById('delete-cat-btn').onclick = () => {
            this.showConfirm('Delete Category?', `Are you sure you want to delete "${category.name}"?`, () => {
                // Remove category from points
                const points = State.getProject('points');
                points.forEach(p => {
                    if (p.categoryId === categoryId) {
                        p.categoryId = null;
                    }
                });

                State.removeFromProject('categories', categoryId);
                this.closeModal();
                this.showToast('success', 'Deleted', 'Category removed');
            });
        };

        // Save button
        document.getElementById('save-cat-btn').onclick = () => {
            const names = {};
            let hasName = false;

            languages.forEach(lang => {
                const nameInput = document.getElementById(`cat-name-${lang.code}`);
                if (nameInput && nameInput.value.trim()) {
                    names[lang.code] = nameInput.value.trim();
                    hasName = true;
                }
            });

            if (!hasName) {
                this.showToast('error', 'Name Required', 'Enter at least one language name');
                return;
            }

            const defaultName = names['en'] || Object.values(names)[0];

            State.updateInProject('categories', categoryId, {
                name: defaultName,
                names: names,
                icon: customIconData ? null : selectedIcon,
                customIcon: customIconData
            });

            this.closeModal();
            this.showToast('success', 'Category Updated', defaultName);
        };
    },

    showAddLanguageModal() {
        const languageOptions = [
            { code: 'ar', name: 'العربية', flag: '🇸🇦' },
            { code: 'ur', name: 'اردو', flag: '🇵🇰' },
            { code: 'fr', name: 'Français', flag: '🇫🇷' },
            { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
            { code: 'es', name: 'Español', flag: '🇪🇸' },
            { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
            { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
            { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
            { code: 'bn', name: 'বাংলা', flag: '🇧🇩' }
        ];

        const existingCodes = State.getProject('languages').map(l => l.code);
        const available = languageOptions.filter(l => !existingCodes.includes(l.code));

        this.showModal(`
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">Add Language</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="language-grid">
                        ${available.map(lang => `
                            <div class="language-option" data-code="${lang.code}" data-name="${lang.name}">
                                <span class="language-flag">${lang.flag}</span>
                                <div class="language-info">
                                    <div class="language-name">${lang.name}</div>
                                    <div class="language-code">${lang.code}</div>
                                </div>
                                <div class="language-check">✓</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="add-lang-btn">Add Selected</button>
                </div>
            </div>
        `);

        const selected = new Set();

        document.querySelectorAll('.language-option').forEach(opt => {
            opt.addEventListener('click', () => {
                opt.classList.toggle('selected');
                if (opt.classList.contains('selected')) {
                    selected.add({ code: opt.dataset.code, name: opt.dataset.name });
                } else {
                    selected.forEach(s => {
                        if (s.code === opt.dataset.code) selected.delete(s);
                    });
                }
            });
        });

        document.getElementById('add-lang-btn').onclick = () => {
            if (selected.size === 0) {
                this.showToast('error', 'Select at least one language');
                return;
            }

            selected.forEach(lang => {
                State.addToProject('languages', {
                    code: lang.code,
                    name: lang.name,
                    isDefault: false
                });
            });

            this.closeModal();
            this.showToast('success', 'Languages Added', `Added ${selected.size} language(s)`);
        };
    },

    showAddMediaModal() {
        document.getElementById('file-video').click();
        document.getElementById('file-video').onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await ContentManager.addMedia(file, 'video');
                this.showToast('success', 'Video Added', file.name);
            }
        };
    },

    showAddPanoramaModal() {
        document.getElementById('file-panorama').click();
        document.getElementById('file-panorama').onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await ContentManager.addMedia(file, 'panorama');
                this.showToast('success', 'Panorama Added', file.name);
            }
        };
    },

    showExportWindowsModal() {
        this.showModal(`
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">Export Windows Executable</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="export-options">
                        <label class="export-option selected">
                            <input type="radio" name="export-type-win" value="full" checked>
                            <div class="export-option-content">
                                <h4>Windows Application</h4>
                                <p>Standalone executable package calling the system browser in App Mode. Lightweight and fast.</p>
                            </div>
                        </label>
                    </div>
                    <div class="alert-box info" style="margin-top: 15px; background: rgba(0, 200, 255, 0.1); padding: 10px; border-radius: 6px; font-size: 13px;">
                        ℹ️ This will create a ZIP file containing your project and a <code>launcher.bat</code> file. Extract the ZIP and double-click the launcher to run.
                    </div>
                    <div class="export-progress" id="export-win-progress">
                        <div class="export-progress-bar">
                            <div class="export-progress-fill" id="export-win-progress-fill"></div>
                        </div>
                        <div class="export-progress-text">
                            <span id="export-win-status">Preparing...</span>
                            <span id="export-win-percent">0%</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="start-export-win-btn">Export Exe</button>
                </div>
            </div>
        `);

        document.getElementById('start-export-win-btn').onclick = async () => {
            const btn = document.getElementById('start-export-win-btn');
            const progress = document.getElementById('export-win-progress');

            if (progress) progress.classList.add('active');
            if (btn) btn.disabled = true;

            try {
                // Ensure Exporter has the new method
                if (!window.Exporter || !Exporter.exportWindowsPackage) {
                    throw new Error("Windows export implementation missing. Please refresh the page.");
                }

                await Exporter.exportWindowsPackage((pct, status) => {
                    const fill = document.getElementById('export-win-progress-fill');
                    const pctEl = document.getElementById('export-win-percent');
                    const statusEl = document.getElementById('export-win-status');

                    if (fill) fill.style.width = `${pct}%`;
                    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
                    if (statusEl) statusEl.textContent = status;
                });

                this.closeModal();
                this.showToast('success', 'Export Complete', 'Windows package downloaded');
            } catch (err) {
                console.error(err);
                this.showToast('error', 'Export Failed', err.message || 'Unknown error');
                if (btn) btn.disabled = false;
                if (progress) progress.classList.remove('active');
                alert("Export Failed: " + (err.message || "Unknown error"));
            }
        };
    },

    showExportModal() {
        this.showModal(`
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">Export Web Package</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="export-options">
                        <label class="export-option selected">
                            <input type="radio" name="export-type" value="full" checked>
                            <div class="export-option-content">
                                <h4>Full Web Package</h4>
                                <p>Complete HTML, CSS, JS and assets ready to deploy on any web server</p>
                            </div>
                        </label>
                        <label class="export-option">
                            <input type="radio" name="export-type" value="embed">
                            <div class="export-option-content">
                                <h4>Embed Code</h4>
                                <p>iframe code to embed in existing website</p>
                            </div>
                        </label>
                    </div>
                    <div class="export-progress" id="export-progress">
                        <div class="export-progress-bar">
                            <div class="export-progress-fill" id="export-progress-fill"></div>
                        </div>
                        <div class="export-progress-text">
                            <span id="export-status">Preparing...</span>
                            <span id="export-percent">0%</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="start-export-btn">Export</button>
                </div>
            </div>
        `);

        document.querySelectorAll('.export-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.export-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });

        document.getElementById('start-export-btn').onclick = async () => {
            try {
                const typeEl = document.querySelector('input[name="export-type"]:checked');
                // const type = typeEl ? typeEl.value : 'full'; // Not used in current logic but kept for future

                const btn = document.getElementById('start-export-btn');
                const progress = document.getElementById('export-progress');

                if (progress) progress.classList.add('active');
                if (btn) btn.disabled = true;

                if (!window.Exporter || !Exporter.exportWebPackage) {
                    throw new Error("Export implementation missing. Please refresh.");
                }

                await Exporter.exportWebPackage((pct, status) => {
                    const fill = document.getElementById('export-progress-fill');
                    const pctEl = document.getElementById('export-percent');
                    const statusEl = document.getElementById('export-status');

                    if (fill) fill.style.width = `${pct}%`;
                    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
                    if (statusEl) statusEl.textContent = status;
                });

                this.closeModal();
                this.showToast('success', 'Export Complete', 'Web package downloaded');
            } catch (err) {
                console.error(err);
                this.showToast('error', 'Export Failed', err.message);
                const btn = document.getElementById('start-export-btn');
                if (btn) btn.disabled = false;
                alert("Export Failed: " + (err.message || "Unknown error"));
            }
        };
    },

    showProjectSettingsModal() {
        const meta = State.getProject('meta');
        const settings = State.getProject('settings') || {};
        const uiSounds = settings.uiSounds || { enabled: true, volume: 0.5, assignments: {} };
        const assignments = uiSounds.assignments || {};
        const scale = settings.scale || { factor: 1, unit: 'meters' };
        const defaultView = settings.defaultView;
        const cameraBounds = settings.cameraBounds || {
            enabled: false,
            min: { x: -50, y: -10, z: -50 },
            max: { x: 50, y: 50, z: 50 },
            minDistance: 5,
            maxDistance: 200
        };

        // Generate sound dropdown options
        const soundRow = (label, key, current) => `
            <div class="sound-assign-row">
                <span>${label}</span>
                <select data-sound-key="${key}">
                    ${SoundManager.availableSounds.map(s =>
            `<option value="${s.id}" ${(current || SoundManager.assignments[key]) === s.id ? 'selected' : ''}>${s.name}</option>`
        ).join('')}
                </select>
            </div>
        `;

        this.showModal(`
            <div class="modal modal-lg">
                <div class="modal-header">
                    <h3 class="modal-title">Project Settings</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    
                    <h4 style="margin: 0 0 12px; color: var(--accent-primary);">📋 General</h4>
                    <div class="prop-row">
                        <label>Project Name</label>
                        <input type="text" id="proj-name" value="${meta.name}">
                    </div>
                    <div class="prop-row">
                        <label>Subtitle</label>
                        <input type="text" id="proj-subtitle" value="${meta.subtitle || ''}">
                    </div>
                    <div class="prop-row">
                        <label>Google Analytics ID</label>
                        <input type="text" id="proj-analytics-id" value="${meta.analyticsId || 'G-X4DWVN7B51'}" placeholder="G-XXXXXXXXXX">
                    </div>
                    <p class="field-hint" style="margin-top: -8px; margin-bottom: 8px;">Enter your GA4 Measurement ID to track clicks and views.</p>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">🖥️ Desktop Start View</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Camera position for PC/Desktop when the map loads.</p>
                    <div class="prop-row">
                        <label>Status</label>
                        <span style="color: ${defaultView ? 'var(--success)' : 'var(--text-tertiary)'};">
                            ${defaultView ? '✓ Desktop view is set' : 'Not set'}
                        </span>
                    </div>
                    <div class="prop-row">
                        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.setStartView();">
                            📷 Set Current View as Desktop Start
                        </button>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">📱 Mobile Start View</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Camera position for Mobile devices. Set a different angle for better mobile viewing.</p>
                    <div class="prop-row">
                        <label>Status</label>
                        <span style="color: ${settings.defaultViewMobile ? 'var(--success)' : 'var(--text-tertiary)'};">
                            ${settings.defaultViewMobile ? '✓ Mobile view is set' : 'Not set (will use desktop view)'}
                        </span>
                    </div>
                    <div class="prop-row">
                        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.setStartViewMobile();">
                            📷 Set Current View as Mobile Start
                        </button>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">📏 Scale & Measurement</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Current: 1 unit = ${scale.factor} ${scale.unit}</p>
                    <div class="prop-row">
                        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.showScaleSettingsModal();">
                            📏 Open Scale Settings
                        </button>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">🎨 Global Styles</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Typography, colors, and default styling for all elements.</p>
                    <div class="prop-row">
                        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.showGlobalStylesModal();">
                            🎨 Open Style Settings
                        </button>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">🏢 Branding</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Company logo shown in the viewer (top-left corner).</p>
                    <div class="prop-row">
                        <label>Company Logo</label>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div id="company-logo-preview" style="width: 60px; height: 40px; background: var(--bg-tertiary); border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                ${settings.companyLogo ? `<img src="${settings.companyLogo}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : '<span style="color: var(--text-tertiary); font-size: 10px;">No logo</span>'}
                            </div>
                            <button class="btn btn-secondary btn-sm" id="upload-company-logo">Upload</button>
                            <button class="btn btn-secondary btn-sm" id="remove-company-logo" ${settings.companyLogo ? '' : 'disabled'}>Remove</button>
                            <input type="file" id="company-logo-file" accept="image/*" hidden>
                        </div>
                    </div>
                    <div class="prop-row">
                        <label>Loading Screen Logo</label>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div id="loading-logo-preview" style="width: 60px; height: 40px; background: var(--bg-tertiary); border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                ${settings.loadingLogo ? `<img src="${settings.loadingLogo}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : '<span style="color: var(--text-tertiary); font-size: 10px;">No logo</span>'}
                            </div>
                            <button class="btn btn-secondary btn-sm" id="upload-loading-logo">Upload</button>
                            <button class="btn btn-secondary btn-sm" id="remove-loading-logo" ${settings.loadingLogo ? '' : 'disabled'}>Remove</button>
                            <input type="file" id="loading-logo-file" accept="image/*" hidden>
                        </div>
                    </div>
                    <div class="prop-row">
                        <label>Camera Lock Icon</label>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div id="camera-lock-icon-preview" style="width: 40px; height: 40px; background: var(--bg-tertiary); border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                ${settings.cameraLockIcon ? `<img src="${settings.cameraLockIcon}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : '<span style="color: var(--text-tertiary); font-size: 10px;">Default</span>'}
                            </div>
                            <button class="btn btn-secondary btn-sm" id="upload-camera-lock-icon">Upload</button>
                            <button class="btn btn-secondary btn-sm" id="remove-camera-lock-icon" ${settings.cameraLockIcon ? '' : 'disabled'}>Remove</button>
                            <input type="file" id="camera-lock-icon-file" accept="image/*" hidden>
                        </div>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">🚩 Point Marker 3D Mesh</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">A 3D model (like a flag/banner) that appears at clicked point locations and smoothly moves between points.</p>
                    <div class="prop-row">
                        <label>Enable Point Marker</label>
                        <label class="toggle">
                            <input type="checkbox" id="point-marker-enabled" ${(settings.pointMarkerMesh?.enabled !== false) ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div id="point-marker-settings" style="display: ${(settings.pointMarkerMesh?.enabled !== false) ? 'block' : 'none'};">
                        <div class="prop-row">
                            <label>3D Model (GLB)</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <button class="btn btn-secondary btn-sm" id="upload-point-marker">📦 Upload Model</button>
                                <input type="file" id="point-marker-file" accept=".glb,.gltf" hidden>
                                <span id="point-marker-filename" style="font-size: 12px; color: var(--text-secondary);">
                                    ${settings.pointMarkerMesh?.filename ? '✓ ' + settings.pointMarkerMesh.filename : 'No model uploaded'}
                                </span>
                            </div>
                        </div>
                        <div class="prop-row" style="margin-top: 8px;">
                            <button class="btn btn-secondary btn-sm" id="remove-point-marker" ${settings.pointMarkerMesh?.data ? '' : 'disabled'}>🗑️ Remove Model</button>
                        </div>
                        <div class="prop-row triple" style="margin-top: 12px;">
                            <label>Scale</label>
                            <input type="number" id="point-marker-scale-x" value="${settings.pointMarkerMesh?.scale?.x || 1}" step="0.1" min="0.1" placeholder="X">
                            <input type="number" id="point-marker-scale-y" value="${settings.pointMarkerMesh?.scale?.y || 1}" step="0.1" min="0.1" placeholder="Y">
                            <input type="number" id="point-marker-scale-z" value="${settings.pointMarkerMesh?.scale?.z || 1}" step="0.1" min="0.1" placeholder="Z">
                        </div>
                        <div class="prop-row triple">
                            <label>Offset</label>
                            <input type="number" id="point-marker-offset-x" value="${settings.pointMarkerMesh?.offset?.x || 0}" step="0.5" placeholder="X">
                            <input type="number" id="point-marker-offset-y" value="${settings.pointMarkerMesh?.offset?.y || 0}" step="0.5" placeholder="Y">
                            <input type="number" id="point-marker-offset-z" value="${settings.pointMarkerMesh?.offset?.z || 0}" step="0.5" placeholder="Z">
                        </div>
                        <p class="field-hint">Offset adjusts the mesh position relative to the point (useful for positioning flags above points).</p>
                        <div class="prop-row" style="margin-top: 8px;">
                            <label>Animation Duration (ms)</label>
                            <input type="number" id="point-marker-duration" value="${settings.pointMarkerMesh?.animationDuration || 500}" min="0" max="3000" step="100" style="width: 100px;">
                        </div>
                        <p class="field-hint">How fast the mesh moves between points. 0 = instant, 500 = smooth.</p>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">🔊 UI Sounds</h4>
                    <div class="prop-row">
                        <label>Enable Sound Effects</label>
                        <label class="toggle">
                            <input type="checkbox" id="sounds-enabled" ${uiSounds.enabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="prop-row">
                        <label>Volume</label>
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                            <input type="range" id="sounds-volume" min="0" max="1" step="0.1" value="${uiSounds.volume || 0.5}" style="flex: 1;">
                            <span id="volume-display">${Math.round((uiSounds.volume || 0.5) * 100)}%</span>
                        </div>
                    </div>
                    
                    <div id="sound-assignments" style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-top: 8px;">
                        <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">Assign sounds to actions:</p>
                        ${soundRow('Button Clicks', 'buttonClick', assignments.buttonClick)}
                        ${soundRow('Menu Open', 'menuOpen', assignments.menuOpen)}
                        ${soundRow('Menu Close', 'menuClose', assignments.menuClose)}
                        ${soundRow('Point Selection', 'pointSelect', assignments.pointSelect)}
                        ${soundRow('Popup Open', 'popupOpen', assignments.popupOpen)}
                        ${soundRow('Popup Close', 'popupClose', assignments.popupClose)}
                        ${soundRow('Toggle Switches', 'toggleSwitch', assignments.toggleSwitch)}
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">🎵 Background Music</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Ambient music that plays when the viewer loads.</p>
                    <div class="prop-row">
                        <label>Enable Background Music</label>
                        <label class="toggle">
                            <input type="checkbox" id="bg-music-enabled" ${settings.backgroundMusic?.enabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div id="bg-music-settings" style="display: ${settings.backgroundMusic?.enabled ? 'block' : 'none'};">
                        <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-top: 8px;">
                            <div class="prop-row" style="margin-bottom: 10px;">
                                <label>Source</label>
                                <div class="source-toggle">
                                    <label class="radio-label">
                                        <input type="radio" name="bg-music-source" value="upload" ${settings.backgroundMusic?.source !== 'url' ? 'checked' : ''}> Upload
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="bg-music-source" value="url" ${settings.backgroundMusic?.source === 'url' ? 'checked' : ''}> URL
                                    </label>
                                </div>
                            </div>
                            <div id="bg-music-upload-section" style="display: ${settings.backgroundMusic?.source === 'url' ? 'none' : 'block'};">
                                <button class="btn btn-secondary btn-sm" id="upload-bg-music">🎵 Upload Audio File</button>
                                <input type="file" id="bg-music-file" accept="audio/*" hidden>
                                <span id="bg-music-filename" style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">
                                    ${settings.backgroundMusic?.data ? '✓ Audio uploaded' : 'No file selected'}
                                </span>
                            </div>
                            <div id="bg-music-url-section" style="display: ${settings.backgroundMusic?.source === 'url' ? 'block' : 'none'};">
                                <input type="text" id="bg-music-url" placeholder="https://example.com/music.mp3" value="${settings.backgroundMusic?.url || ''}" style="width: 100%;">
                                <p class="field-hint">ℹ️ Paste any direct audio link (MP3, OGG, WAV)</p>
                            </div>
                            <div class="prop-row" style="margin-top: 12px;">
                                <label>Volume</label>
                                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                                    <input type="range" id="bg-music-volume" min="0" max="1" step="0.1" value="${settings.backgroundMusic?.volume || 0.3}" style="flex: 1;">
                                    <span id="bg-music-volume-display">${Math.round((settings.backgroundMusic?.volume || 0.3) * 100)}%</span>
                                </div>
                            </div>
                            <div class="prop-row">
                                <label style="flex: 1;">
                                    <input type="checkbox" id="bg-music-loop" ${settings.backgroundMusic?.loop !== false ? 'checked' : ''}> Loop
                                </label>
                                <label style="flex: 1;">
                                    <input type="checkbox" id="bg-music-autoplay" ${settings.backgroundMusic?.autoplay !== false ? 'checked' : ''}> Autoplay
                                </label>
                            </div>
                            <button class="btn btn-secondary btn-sm" id="preview-bg-music" style="margin-top: 8px;">▶ Preview</button>
                        </div>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">🔔 Startup Sound</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Sound that plays once when the app finishes loading.</p>
                    <div class="prop-row">
                        <label>Enable Startup Sound</label>
                        <label class="toggle">
                            <input type="checkbox" id="startup-sound-enabled" ${settings.startupSound?.enabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div id="startup-sound-settings" style="display: ${settings.startupSound?.enabled ? 'block' : 'none'};">
                        <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-top: 8px;">
                            <div class="prop-row" style="margin-bottom: 10px;">
                                <label>Source</label>
                                <div class="source-toggle">
                                    <label class="radio-label">
                                        <input type="radio" name="startup-sound-source" value="upload" ${settings.startupSound?.source !== 'url' ? 'checked' : ''}> Upload
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="startup-sound-source" value="url" ${settings.startupSound?.source === 'url' ? 'checked' : ''}> URL
                                    </label>
                                </div>
                            </div>
                            <div id="startup-sound-upload-section" style="display: ${settings.startupSound?.source === 'url' ? 'none' : 'block'};">
                                <button class="btn btn-secondary btn-sm" id="upload-startup-sound">🔔 Upload Audio File</button>
                                <input type="file" id="startup-sound-file" accept="audio/*" hidden>
                                <span id="startup-sound-filename" style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">
                                    ${settings.startupSound?.data ? '✓ Audio uploaded' : 'No file selected'}
                                </span>
                            </div>
                            <div id="startup-sound-url-section" style="display: ${settings.startupSound?.source === 'url' ? 'block' : 'none'};">
                                <input type="text" id="startup-sound-url" placeholder="https://example.com/startup.mp3" value="${settings.startupSound?.url || ''}" style="width: 100%;">
                                <p class="field-hint">ℹ️ Paste any direct audio link (MP3, OGG, WAV)</p>
                            </div>
                            <div class="prop-row" style="margin-top: 12px;">
                                <label>Volume</label>
                                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                                    <input type="range" id="startup-sound-volume" min="0" max="1" step="0.1" value="${settings.startupSound?.volume || 0.5}" style="flex: 1;">
                                    <span id="startup-sound-volume-display">${Math.round((settings.startupSound?.volume || 0.5) * 100)}%</span>
                                </div>
                            </div>
                            <button class="btn btn-secondary btn-sm" id="preview-startup-sound" style="margin-top: 8px;">▶ Preview</button>
                        </div>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">📺 Auto Fullscreen</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Automatically enter fullscreen when the app loads.</p>
                    <div class="prop-row">
                        <label>Enable Auto Fullscreen</label>
                        <label class="toggle">
                            <input type="checkbox" id="auto-fullscreen-enabled" ${settings.autoFullscreen?.enabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <p class="field-hint" style="margin-top: 4px;">Note: User will need to click once to enter fullscreen (browser security requirement).</p>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">🎬 Startup Media (Optional)</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Show an intro video or image before the 3D map.</p>
                    <div class="prop-row">
                        <label>Enable Startup Media</label>
                        <label class="toggle">
                            <input type="checkbox" id="startup-media-enabled" ${settings.startupMedia?.enabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div id="startup-media-settings" style="display: ${settings.startupMedia?.enabled ? 'block' : 'none'};">
                        <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-top: 8px;">
                            
                            <!-- Language Selection Option -->
                            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">
                                <div class="prop-row" style="margin-bottom: 10px;">
                                    <label style="font-weight: 600; color: var(--accent-primary);">🌐 Language Selection at Startup</label>
                                    <label class="toggle">
                                        <input type="checkbox" id="startup-language-selection-enabled" ${settings.startupMedia?.languageSelection?.enabled ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                <p class="field-hint" style="margin-bottom: 0;">Show language selection screen after fullscreen prompt. User chooses English or Arabic, then sees the corresponding intro video.</p>
                            </div>
                            
                            <!-- Default Media (when language selection is OFF) -->
                            <div id="default-media-section" style="display: ${settings.startupMedia?.languageSelection?.enabled ? 'none' : 'block'};">
                                <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px;">Media Type</p>
                                <div class="media-type-toggle" style="display: flex; gap: 10px; margin-bottom: 16px;">
                                    <label class="media-type-option" style="flex: 1; padding: 12px; background: var(--bg-secondary); border: 2px solid ${settings.startupMedia?.type !== 'image' ? 'var(--accent-primary)' : 'transparent'}; border-radius: 8px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="startup-media-type" value="video" ${settings.startupMedia?.type !== 'image' ? 'checked' : ''} style="display: none;">
                                        <span style="font-size: 20px;">🎬</span><br>
                                        <span style="font-size: 12px;">Video</span>
                                    </label>
                                    <label class="media-type-option" style="flex: 1; padding: 12px; background: var(--bg-secondary); border: 2px solid ${settings.startupMedia?.type === 'image' ? 'var(--accent-primary)' : 'transparent'}; border-radius: 8px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="startup-media-type" value="image" ${settings.startupMedia?.type === 'image' ? 'checked' : ''} style="display: none;">
                                        <span style="font-size: 20px;">🖼️</span><br>
                                        <span style="font-size: 12px;">Image</span>
                                    </label>
                                </div>
                                
                                <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px;">🖥️ Desktop</p>
                                <div class="radio-group" style="margin-bottom: 8px;">
                                    <label class="radio-label">
                                        <input type="radio" name="startup-media-desktop-source" value="file" ${settings.startupMedia?.desktop?.source !== 'url' ? 'checked' : ''}> Upload File
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="startup-media-desktop-source" value="url" ${settings.startupMedia?.desktop?.source === 'url' ? 'checked' : ''}> URL
                                    </label>
                                </div>
                                <div id="startup-media-desktop-upload" style="display: ${settings.startupMedia?.desktop?.source === 'url' ? 'none' : 'block'};">
                                    <button class="btn btn-secondary btn-sm" id="upload-startup-media-desktop">📁 Upload File</button>
                                    <input type="file" id="startup-media-desktop-file" accept="video/*,image/*" hidden>
                                    <span id="startup-media-desktop-filename" style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">
                                        ${settings.startupMedia?.desktop?.data ? '✓ File uploaded' : 'No file'}
                                    </span>
                                </div>
                                <div id="startup-media-desktop-url" style="display: ${settings.startupMedia?.desktop?.source === 'url' ? 'block' : 'none'};">
                                    <input type="text" id="startup-media-desktop-url-input" placeholder="https://example.com/intro.mp4" value="${settings.startupMedia?.desktop?.url || ''}" style="width: 100%;">
                                </div>
                                
                                <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 16px 0 10px;">📱 Mobile</p>
                                <p class="field-hint" style="margin-bottom: 8px;">Optionally use a different file for mobile. Leave empty to use desktop.</p>
                                <div class="radio-group" style="margin-bottom: 8px;">
                                    <label class="radio-label">
                                        <input type="radio" name="startup-media-mobile-source" value="file" ${settings.startupMedia?.mobile?.source !== 'url' ? 'checked' : ''}> Upload File
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="startup-media-mobile-source" value="url" ${settings.startupMedia?.mobile?.source === 'url' ? 'checked' : ''}> URL
                                    </label>
                                </div>
                                <div id="startup-media-mobile-upload" style="display: ${settings.startupMedia?.mobile?.source === 'url' ? 'none' : 'block'};">
                                    <button class="btn btn-secondary btn-sm" id="upload-startup-media-mobile">📁 Upload File</button>
                                    <input type="file" id="startup-media-mobile-file" accept="video/*,image/*" hidden>
                                    <span id="startup-media-mobile-filename" style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">
                                        ${settings.startupMedia?.mobile?.data ? '✓ File uploaded' : 'No file (uses desktop)'}
                                    </span>
                                </div>
                                <div id="startup-media-mobile-url" style="display: ${settings.startupMedia?.mobile?.source === 'url' ? 'block' : 'none'};">
                                    <input type="text" id="startup-media-mobile-url-input" placeholder="https://example.com/intro-mobile.mp4" value="${settings.startupMedia?.mobile?.url || ''}" style="width: 100%;">
                                </div>
                            </div>
                            
                            <!-- Language-specific Media (when language selection is ON) -->
                            <div id="language-media-section" style="display: ${settings.startupMedia?.languageSelection?.enabled ? 'block' : 'none'};">
                                
                                <!-- English Video Section -->
                                <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                                    <p style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">🇬🇧 English Intro Video</p>
                                    
                                    <p style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 8px;">🖥️ Desktop</p>
                                    <div class="radio-group" style="margin-bottom: 8px;">
                                        <label class="radio-label">
                                            <input type="radio" name="startup-media-en-desktop-source" value="file" ${settings.startupMedia?.english?.desktop?.source !== 'url' ? 'checked' : ''}> Upload
                                        </label>
                                        <label class="radio-label">
                                            <input type="radio" name="startup-media-en-desktop-source" value="url" ${settings.startupMedia?.english?.desktop?.source === 'url' ? 'checked' : ''}> URL
                                        </label>
                                    </div>
                                    <div id="startup-media-en-desktop-upload" style="display: ${settings.startupMedia?.english?.desktop?.source === 'url' ? 'none' : 'flex'}; align-items: center; gap: 8px;">
                                        <button class="btn btn-secondary btn-sm" id="upload-startup-media-en-desktop">📁 Upload</button>
                                        <input type="file" id="startup-media-en-desktop-file" accept="video/*" hidden>
                                        <span id="startup-media-en-desktop-filename" style="font-size: 11px; color: var(--text-secondary);">
                                            ${settings.startupMedia?.english?.desktop?.data ? '✓ Uploaded' : 'No file'}
                                        </span>
                                    </div>
                                    <div id="startup-media-en-desktop-url" style="display: ${settings.startupMedia?.english?.desktop?.source === 'url' ? 'block' : 'none'};">
                                        <input type="text" id="startup-media-en-desktop-url-input" placeholder="https://example.com/intro-en.mp4" value="${settings.startupMedia?.english?.desktop?.url || ''}" style="width: 100%;">
                                    </div>
                                    
                                    <p style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin: 12px 0 8px;">📱 Mobile (optional)</p>
                                    <div class="radio-group" style="margin-bottom: 8px;">
                                        <label class="radio-label">
                                            <input type="radio" name="startup-media-en-mobile-source" value="file" ${settings.startupMedia?.english?.mobile?.source !== 'url' ? 'checked' : ''}> Upload
                                        </label>
                                        <label class="radio-label">
                                            <input type="radio" name="startup-media-en-mobile-source" value="url" ${settings.startupMedia?.english?.mobile?.source === 'url' ? 'checked' : ''}> URL
                                        </label>
                                    </div>
                                    <div id="startup-media-en-mobile-upload" style="display: ${settings.startupMedia?.english?.mobile?.source === 'url' ? 'none' : 'flex'}; align-items: center; gap: 8px;">
                                        <button class="btn btn-secondary btn-sm" id="upload-startup-media-en-mobile">📁 Upload</button>
                                        <input type="file" id="startup-media-en-mobile-file" accept="video/*" hidden>
                                        <span id="startup-media-en-mobile-filename" style="font-size: 11px; color: var(--text-secondary);">
                                            ${settings.startupMedia?.english?.mobile?.data ? '✓ Uploaded' : 'Uses desktop'}
                                        </span>
                                    </div>
                                    <div id="startup-media-en-mobile-url" style="display: ${settings.startupMedia?.english?.mobile?.source === 'url' ? 'block' : 'none'};">
                                        <input type="text" id="startup-media-en-mobile-url-input" placeholder="https://example.com/intro-en-mobile.mp4" value="${settings.startupMedia?.english?.mobile?.url || ''}" style="width: 100%;">
                                    </div>
                                </div>
                                
                                <!-- Arabic Video Section -->
                                <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                                    <p style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">🇸🇦 Arabic Intro Video</p>
                                    
                                    <p style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 8px;">🖥️ Desktop</p>
                                    <div class="radio-group" style="margin-bottom: 8px;">
                                        <label class="radio-label">
                                            <input type="radio" name="startup-media-ar-desktop-source" value="file" ${settings.startupMedia?.arabic?.desktop?.source !== 'url' ? 'checked' : ''}> Upload
                                        </label>
                                        <label class="radio-label">
                                            <input type="radio" name="startup-media-ar-desktop-source" value="url" ${settings.startupMedia?.arabic?.desktop?.source === 'url' ? 'checked' : ''}> URL
                                        </label>
                                    </div>
                                    <div id="startup-media-ar-desktop-upload" style="display: ${settings.startupMedia?.arabic?.desktop?.source === 'url' ? 'none' : 'flex'}; align-items: center; gap: 8px;">
                                        <button class="btn btn-secondary btn-sm" id="upload-startup-media-ar-desktop">📁 Upload</button>
                                        <input type="file" id="startup-media-ar-desktop-file" accept="video/*" hidden>
                                        <span id="startup-media-ar-desktop-filename" style="font-size: 11px; color: var(--text-secondary);">
                                            ${settings.startupMedia?.arabic?.desktop?.data ? '✓ Uploaded' : 'No file'}
                                        </span>
                                    </div>
                                    <div id="startup-media-ar-desktop-url" style="display: ${settings.startupMedia?.arabic?.desktop?.source === 'url' ? 'block' : 'none'};">
                                        <input type="text" id="startup-media-ar-desktop-url-input" placeholder="https://example.com/intro-ar.mp4" value="${settings.startupMedia?.arabic?.desktop?.url || ''}" style="width: 100%;">
                                    </div>
                                    
                                    <p style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin: 12px 0 8px;">📱 Mobile (optional)</p>
                                    <div class="radio-group" style="margin-bottom: 8px;">
                                        <label class="radio-label">
                                            <input type="radio" name="startup-media-ar-mobile-source" value="file" ${settings.startupMedia?.arabic?.mobile?.source !== 'url' ? 'checked' : ''}> Upload
                                        </label>
                                        <label class="radio-label">
                                            <input type="radio" name="startup-media-ar-mobile-source" value="url" ${settings.startupMedia?.arabic?.mobile?.source === 'url' ? 'checked' : ''}> URL
                                        </label>
                                    </div>
                                    <div id="startup-media-ar-mobile-upload" style="display: ${settings.startupMedia?.arabic?.mobile?.source === 'url' ? 'none' : 'flex'}; align-items: center; gap: 8px;">
                                        <button class="btn btn-secondary btn-sm" id="upload-startup-media-ar-mobile">📁 Upload</button>
                                        <input type="file" id="startup-media-ar-mobile-file" accept="video/*" hidden>
                                        <span id="startup-media-ar-mobile-filename" style="font-size: 11px; color: var(--text-secondary);">
                                            ${settings.startupMedia?.arabic?.mobile?.data ? '✓ Uploaded' : 'Uses desktop'}
                                        </span>
                                    </div>
                                    <div id="startup-media-ar-mobile-url" style="display: ${settings.startupMedia?.arabic?.mobile?.source === 'url' ? 'block' : 'none'};">
                                        <input type="text" id="startup-media-ar-mobile-url-input" placeholder="https://example.com/intro-ar-mobile.mp4" value="${settings.startupMedia?.arabic?.mobile?.url || ''}" style="width: 100%;">
                                    </div>
                                </div>
                            </div>
                            
                            <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 16px 0 10px;">⏭️ Continue Button</p>
                            <div class="prop-row">
                                <label>Show after (seconds)</label>
                                <input type="number" id="startup-media-skip-delay" value="${settings.startupMedia?.skipButton?.showAfter ?? 2}" min="0" max="30" step="1" style="width: 80px;">
                            </div>
                            <div class="prop-row" style="margin-top: 8px;">
                                <label>Button text</label>
                                <input type="text" id="startup-media-skip-text" value="${settings.startupMedia?.skipButton?.text || 'Skip Intro'}" style="width: 150px;">
                            </div>
                            <div class="prop-row" style="margin-top: 8px;" id="auto-advance-row">
                                <label>Auto-advance (image only)</label>
                                <label class="toggle">
                                    <input type="checkbox" id="startup-media-auto-advance" ${settings.startupMedia?.autoAdvance?.enabled ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                                <input type="number" id="startup-media-auto-advance-delay" value="${settings.startupMedia?.autoAdvance?.delay || 5}" min="1" max="60" step="1" style="width: 60px; margin-left: 8px;">
                                <span style="font-size: 12px; color: var(--text-secondary);">seconds</span>
                            </div>
                        </div>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">📦 Camera Bounds</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Define an invisible boundary box to limit camera movement.</p>
                    <div class="prop-row">
                        <label>Enable Bounds</label>
                        <label class="toggle">
                            <input type="checkbox" id="bounds-enabled" ${cameraBounds.enabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div id="bounds-settings" style="display: ${cameraBounds.enabled ? 'block' : 'none'};">
                        <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-top: 8px;">
                            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">Bounding Box (Min Corner):</p>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                                <div>
                                    <label style="font-size: 11px;">X</label>
                                    <input type="number" id="bounds-min-x" value="${cameraBounds.min.x}" step="1">
                                </div>
                                <div>
                                    <label style="font-size: 11px;">Y</label>
                                    <input type="number" id="bounds-min-y" value="${cameraBounds.min.y}" step="1">
                                </div>
                                <div>
                                    <label style="font-size: 11px;">Z</label>
                                    <input type="number" id="bounds-min-z" value="${cameraBounds.min.z}" step="1">
                                </div>
                            </div>
                            <p style="font-size: 12px; color: var(--text-secondary); margin: 10px 0;">Bounding Box (Max Corner):</p>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                                <div>
                                    <label style="font-size: 11px;">X</label>
                                    <input type="number" id="bounds-max-x" value="${cameraBounds.max.x}" step="1">
                                </div>
                                <div>
                                    <label style="font-size: 11px;">Y</label>
                                    <input type="number" id="bounds-max-y" value="${cameraBounds.max.y}" step="1">
                                </div>
                                <div>
                                    <label style="font-size: 11px;">Z</label>
                                    <input type="number" id="bounds-max-z" value="${cameraBounds.max.z}" step="1">
                                </div>
                            </div>
                            <p style="font-size: 12px; color: var(--text-secondary); margin: 10px 0;">Zoom Distance Limits:</p>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                                <div>
                                    <label style="font-size: 11px;">Min Distance</label>
                                    <input type="number" id="bounds-min-dist" value="${cameraBounds.minDistance}" step="1" min="1">
                                </div>
                                <div>
                                    <label style="font-size: 11px;">Max Distance</label>
                                    <input type="number" id="bounds-max-dist" value="${cameraBounds.maxDistance}" step="1" min="10">
                                </div>
                            </div>
                        </div>
                        <div class="prop-row" style="margin-top: 12px;">
                            <button class="btn btn-secondary" id="fit-bounds-to-model">📐 Fit to Model</button>
                            <button class="btn btn-secondary" id="show-bounds-helper">👁 Show/Hide Bounds</button>
                        </div>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">📍 Point Icon Scaling</h4>
                    <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">
                        Icons scale based on camera distance to maintain visibility when zoomed out.
                    </p>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        <div>
                            <label style="font-size: 11px;">Min Scale (when close)</label>
                            <input type="number" id="icon-min-scale" value="${settings.iconScaling?.minScale || 0.5}" step="0.1" min="0.1" max="5">
                        </div>
                        <div>
                            <label style="font-size: 11px;">Max Scale (when far)</label>
                            <input type="number" id="icon-max-scale" value="${settings.iconScaling?.maxScale || 10}" step="0.5" min="1" max="20">
                        </div>
                        <div>
                            <label style="font-size: 11px;">Near Distance (m)</label>
                            <input type="number" id="icon-near-distance" value="${settings.iconScaling?.nearDistance || 20}" step="5" min="5">
                        </div>
                        <div>
                            <label style="font-size: 11px;">Far Distance (m)</label>
                            <input type="number" id="icon-far-distance" value="${settings.iconScaling?.farDistance || 200}" step="10" min="20">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="save-proj-settings">Save</button>
                </div>
            </div>
        `);

        // Volume slider update
        document.getElementById('sounds-volume').addEventListener('input', (e) => {
            document.getElementById('volume-display').textContent = Math.round(e.target.value * 100) + '%';
        });

        // Company logo upload
        document.getElementById('upload-company-logo').onclick = () => {
            console.log('Upload company logo button clicked');
            document.getElementById('company-logo-file').click();
        };
        document.getElementById('company-logo-file').onchange = (e) => {
            console.log('Company logo file changed', e.target.files);
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result;
                    console.log('Company logo loaded, size:', base64.length);
                    document.getElementById('company-logo-preview').innerHTML =
                        `<img src="${base64}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                    document.getElementById('remove-company-logo').disabled = false;

                    // Get current settings and update
                    const currentSettings = State.getProject('settings') || {};
                    currentSettings.companyLogo = base64;
                    State.setProject('settings', currentSettings);
                    console.log('Company logo saved to state');
                };
                reader.onerror = (err) => console.error('FileReader error:', err);
                reader.readAsDataURL(file);
            }
        };
        document.getElementById('remove-company-logo').onclick = () => {
            document.getElementById('company-logo-preview').innerHTML =
                '<span style="color: var(--text-tertiary); font-size: 10px;">No logo</span>';
            document.getElementById('remove-company-logo').disabled = true;

            const currentSettings = State.getProject('settings') || {};
            currentSettings.companyLogo = null;
            State.setProject('settings', currentSettings);
        };

        // Loading logo upload
        document.getElementById('upload-loading-logo').onclick = () => {
            console.log('Upload loading logo button clicked');
            document.getElementById('loading-logo-file').click();
        };
        document.getElementById('loading-logo-file').onchange = (e) => {
            console.log('Loading logo file changed', e.target.files);
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result;
                    console.log('Loading logo loaded, size:', base64.length);
                    document.getElementById('loading-logo-preview').innerHTML =
                        `<img src="${base64}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                    document.getElementById('remove-loading-logo').disabled = false;

                    // Get current settings and update
                    const currentSettings = State.getProject('settings') || {};
                    currentSettings.loadingLogo = base64;
                    State.setProject('settings', currentSettings);
                    console.log('Loading logo saved to state');
                };
                reader.onerror = (err) => console.error('FileReader error:', err);
                reader.readAsDataURL(file);
            }
        };
        document.getElementById('remove-loading-logo').onclick = () => {
            document.getElementById('loading-logo-preview').innerHTML =
                '<span style="color: var(--text-tertiary); font-size: 10px;">No logo</span>';
            document.getElementById('remove-loading-logo').disabled = true;

            const currentSettings = State.getProject('settings') || {};
            currentSettings.loadingLogo = null;
            State.setProject('settings', currentSettings);
        };

        // Camera Lock Icon upload handlers
        document.getElementById('upload-camera-lock-icon').onclick = () => {
            document.getElementById('camera-lock-icon-file').click();
        };
        document.getElementById('camera-lock-icon-file').onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target.result;
                    document.getElementById('camera-lock-icon-preview').innerHTML =
                        `<img src="${base64}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                    document.getElementById('remove-camera-lock-icon').disabled = false;

                    const currentSettings = State.getProject('settings') || {};
                    currentSettings.cameraLockIcon = base64;
                    State.setProject('settings', currentSettings);
                    this.showToast('success', 'Camera Lock Icon Updated');
                };
                reader.onerror = (err) => console.error('FileReader error:', err);
                reader.readAsDataURL(file);
            }
        };
        document.getElementById('remove-camera-lock-icon').onclick = () => {
            document.getElementById('camera-lock-icon-preview').innerHTML =
                '<span style="color: var(--text-tertiary); font-size: 10px;">Default</span>';
            document.getElementById('remove-camera-lock-icon').disabled = true;

            const currentSettings = State.getProject('settings') || {};
            currentSettings.cameraLockIcon = null;
            State.setProject('settings', currentSettings);
            this.showToast('success', 'Using Default Icon');
        };

        // Point Marker Mesh handlers
        document.getElementById('point-marker-enabled').onchange = (e) => {
            document.getElementById('point-marker-settings').style.display = e.target.checked ? 'block' : 'none';

            const currentSettings = State.getProject('settings') || {};
            if (!currentSettings.pointMarkerMesh) currentSettings.pointMarkerMesh = {};
            currentSettings.pointMarkerMesh.enabled = e.target.checked;
            State.setProject('settings', currentSettings);

            // If disabled, hide the marker
            if (!e.target.checked && Renderer.hidePointMarker) {
                Renderer.hidePointMarker();
            }
        };

        document.getElementById('upload-point-marker').onclick = () => {
            document.getElementById('point-marker-file').click();
        };

        document.getElementById('point-marker-file').onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    this.showLoading('Loading 3D model...');

                    // Read file as ArrayBuffer then convert to base64
                    const arrayBuffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64 = btoa(binary);

                    // Update UI
                    document.getElementById('point-marker-filename').textContent = '✓ ' + file.name;
                    document.getElementById('remove-point-marker').disabled = false;

                    // Save to state
                    const currentSettings = State.getProject('settings') || {};
                    if (!currentSettings.pointMarkerMesh) currentSettings.pointMarkerMesh = {};
                    currentSettings.pointMarkerMesh.data = base64;
                    currentSettings.pointMarkerMesh.filename = file.name;
                    State.setProject('settings', currentSettings);

                    // Load into renderer
                    if (Renderer.loadPointMarkerMesh) {
                        await Renderer.loadPointMarkerMesh();
                    }

                    this.hideLoading();
                    this.showToast('success', 'Point Marker Model Uploaded', file.name);
                } catch (err) {
                    this.hideLoading();
                    console.error('Error loading point marker model:', err);
                    this.showToast('error', 'Failed to load model', err.message);
                }
            }
        };

        document.getElementById('remove-point-marker').onclick = () => {
            document.getElementById('point-marker-filename').textContent = 'No model uploaded';
            document.getElementById('remove-point-marker').disabled = true;

            const currentSettings = State.getProject('settings') || {};
            if (currentSettings.pointMarkerMesh) {
                currentSettings.pointMarkerMesh.data = null;
                currentSettings.pointMarkerMesh.filename = null;
            }
            State.setProject('settings', currentSettings);

            // Remove from renderer
            if (Renderer.removePointMarkerMesh) {
                Renderer.removePointMarkerMesh();
            }

            this.showToast('success', 'Point Marker Model Removed');
        };

        // Point marker scale inputs
        ['x', 'y', 'z'].forEach(axis => {
            document.getElementById(`point-marker-scale-${axis}`).onchange = (e) => {
                const currentSettings = State.getProject('settings') || {};
                if (!currentSettings.pointMarkerMesh) currentSettings.pointMarkerMesh = {};
                if (!currentSettings.pointMarkerMesh.scale) currentSettings.pointMarkerMesh.scale = { x: 1, y: 1, z: 1 };
                currentSettings.pointMarkerMesh.scale[axis] = parseFloat(e.target.value) || 1;
                State.setProject('settings', currentSettings);

                // Update mesh scale in renderer
                if (Renderer.pointMarkerMesh) {
                    const scale = currentSettings.pointMarkerMesh.scale;
                    Renderer.pointMarkerMesh.scale.set(scale.x, scale.y, scale.z);
                }
            };
        });

        // Point marker offset inputs
        ['x', 'y', 'z'].forEach(axis => {
            document.getElementById(`point-marker-offset-${axis}`).onchange = (e) => {
                const currentSettings = State.getProject('settings') || {};
                if (!currentSettings.pointMarkerMesh) currentSettings.pointMarkerMesh = {};
                if (!currentSettings.pointMarkerMesh.offset) currentSettings.pointMarkerMesh.offset = { x: 0, y: 0, z: 0 };
                currentSettings.pointMarkerMesh.offset[axis] = parseFloat(e.target.value) || 0;
                State.setProject('settings', currentSettings);
            };
        });

        // Point marker animation duration
        document.getElementById('point-marker-duration').onchange = (e) => {
            const currentSettings = State.getProject('settings') || {};
            if (!currentSettings.pointMarkerMesh) currentSettings.pointMarkerMesh = {};
            currentSettings.pointMarkerMesh.animationDuration = parseInt(e.target.value) || 500;
            State.setProject('settings', currentSettings);
        };

        // Test sounds on selection
        document.querySelectorAll('[data-sound-key]').forEach(select => {
            select.addEventListener('change', (e) => {
                const soundId = e.target.value;
                if (soundId !== 'none') {
                    SoundManager.generateSound(soundId);
                }
            });
        });

        // Camera Bounds toggle
        document.getElementById('bounds-enabled').onchange = (e) => {
            document.getElementById('bounds-settings').style.display = e.target.checked ? 'block' : 'none';

            // Update renderer bounds helper visibility
            if (e.target.checked) {
                Renderer.showBoundsHelper && Renderer.showBoundsHelper(true);
            } else {
                Renderer.showBoundsHelper && Renderer.showBoundsHelper(false);
            }
        };

        // Fit bounds to model
        document.getElementById('fit-bounds-to-model')?.addEventListener('click', () => {
            const bounds = Renderer.getSceneBounds && Renderer.getSceneBounds();
            if (bounds) {
                document.getElementById('bounds-min-x').value = Math.floor(bounds.min.x - 5);
                document.getElementById('bounds-min-y').value = Math.floor(bounds.min.y - 5);
                document.getElementById('bounds-min-z').value = Math.floor(bounds.min.z - 5);
                document.getElementById('bounds-max-x').value = Math.ceil(bounds.max.x + 5);
                document.getElementById('bounds-max-y').value = Math.ceil(bounds.max.y + 20);
                document.getElementById('bounds-max-z').value = Math.ceil(bounds.max.z + 5);
                this.showToast('success', 'Bounds fitted to model');
            } else {
                this.showToast('warning', 'No model loaded');
            }
        });

        // Show/hide bounds helper
        document.getElementById('show-bounds-helper')?.addEventListener('click', () => {
            const minX = parseFloat(document.getElementById('bounds-min-x').value) || -50;
            const minY = parseFloat(document.getElementById('bounds-min-y').value) || -10;
            const minZ = parseFloat(document.getElementById('bounds-min-z').value) || -50;
            const maxX = parseFloat(document.getElementById('bounds-max-x').value) || 50;
            const maxY = parseFloat(document.getElementById('bounds-max-y').value) || 50;
            const maxZ = parseFloat(document.getElementById('bounds-max-z').value) || 50;

            Renderer.toggleBoundsHelper && Renderer.toggleBoundsHelper({
                min: { x: minX, y: minY, z: minZ },
                max: { x: maxX, y: maxY, z: maxZ }
            });
        });

        // Background Music toggle
        document.getElementById('bg-music-enabled')?.addEventListener('change', (e) => {
            document.getElementById('bg-music-settings').style.display = e.target.checked ? 'block' : 'none';
        });

        // Background Music source toggle
        document.querySelectorAll('input[name="bg-music-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('bg-music-upload-section').style.display = isUrl ? 'none' : 'block';
                document.getElementById('bg-music-url-section').style.display = isUrl ? 'block' : 'none';
            });
        });

        // Background Music upload
        document.getElementById('upload-bg-music')?.addEventListener('click', () => {
            document.getElementById('bg-music-file').click();
        });
        document.getElementById('bg-music-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result;
                    document.getElementById('bg-music-filename').textContent = '✓ ' + file.name;

                    // Store temporarily for save
                    document.getElementById('bg-music-file').dataset.base64 = base64;
                };
                reader.readAsDataURL(file);
            }
        });

        // Background Music volume slider
        document.getElementById('bg-music-volume')?.addEventListener('input', (e) => {
            document.getElementById('bg-music-volume-display').textContent = Math.round(e.target.value * 100) + '%';
        });

        // Background Music preview
        let bgMusicPreviewAudio = null;
        document.getElementById('preview-bg-music')?.addEventListener('click', () => {
            const btn = document.getElementById('preview-bg-music');

            if (bgMusicPreviewAudio && !bgMusicPreviewAudio.paused) {
                bgMusicPreviewAudio.pause();
                btn.textContent = '▶ Preview';
                return;
            }

            const isUrl = document.querySelector('input[name="bg-music-source"]:checked')?.value === 'url';
            let src = '';

            if (isUrl) {
                src = document.getElementById('bg-music-url').value;
            } else {
                src = document.getElementById('bg-music-file').dataset?.base64 ||
                    State.getProject('settings')?.backgroundMusic?.data;
            }

            if (src) {
                bgMusicPreviewAudio = new Audio(src);
                bgMusicPreviewAudio.volume = parseFloat(document.getElementById('bg-music-volume').value) || 0.3;
                bgMusicPreviewAudio.play();
                btn.textContent = '⏹ Stop';

                bgMusicPreviewAudio.onended = () => {
                    btn.textContent = '▶ Preview';
                };
            } else {
                this.showToast('warning', 'No audio selected');
            }
        });

        // Startup Sound toggle
        document.getElementById('startup-sound-enabled')?.addEventListener('change', (e) => {
            document.getElementById('startup-sound-settings').style.display = e.target.checked ? 'block' : 'none';
        });

        // Startup Sound source toggle
        document.querySelectorAll('input[name="startup-sound-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('startup-sound-upload-section').style.display = isUrl ? 'none' : 'block';
                document.getElementById('startup-sound-url-section').style.display = isUrl ? 'block' : 'none';
            });
        });

        // Startup Sound upload
        document.getElementById('upload-startup-sound')?.addEventListener('click', () => {
            document.getElementById('startup-sound-file').click();
        });
        document.getElementById('startup-sound-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result;
                    document.getElementById('startup-sound-filename').textContent = '✓ ' + file.name;
                    document.getElementById('startup-sound-file').dataset.base64 = base64;
                };
                reader.readAsDataURL(file);
            }
        });

        // Startup Sound volume slider
        document.getElementById('startup-sound-volume')?.addEventListener('input', (e) => {
            document.getElementById('startup-sound-volume-display').textContent = Math.round(e.target.value * 100) + '%';
        });

        // Startup Sound preview
        document.getElementById('preview-startup-sound')?.addEventListener('click', () => {
            const isUrl = document.querySelector('input[name="startup-sound-source"]:checked')?.value === 'url';
            let src = '';

            if (isUrl) {
                src = document.getElementById('startup-sound-url').value;
            } else {
                src = document.getElementById('startup-sound-file').dataset?.base64 ||
                    State.getProject('settings')?.startupSound?.data;
            }

            if (src) {
                const audio = new Audio(src);
                audio.volume = parseFloat(document.getElementById('startup-sound-volume').value) || 0.5;
                audio.play();
            } else {
                this.showToast('warning', 'No audio selected');
            }
        });

        // Startup Media toggle
        document.getElementById('startup-media-enabled')?.addEventListener('change', (e) => {
            document.getElementById('startup-media-settings').style.display = e.target.checked ? 'block' : 'none';
        });

        // Language Selection toggle (show/hide language-specific vs default media sections)
        document.getElementById('startup-language-selection-enabled')?.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            const defaultSection = document.getElementById('default-media-section');
            const languageSection = document.getElementById('language-media-section');
            if (defaultSection) defaultSection.style.display = isEnabled ? 'none' : 'block';
            if (languageSection) languageSection.style.display = isEnabled ? 'block' : 'none';
        });

        // Startup Media type toggle (video/image)
        document.querySelectorAll('input[name="startup-media-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                // Update visual selection
                document.querySelectorAll('.media-type-option').forEach(opt => {
                    const isSelected = opt.querySelector('input').value === e.target.value;
                    opt.style.borderColor = isSelected ? 'var(--accent-primary)' : 'transparent';
                });
            });
        });

        // Startup Media desktop source toggle
        document.querySelectorAll('input[name="startup-media-desktop-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('startup-media-desktop-upload').style.display = isUrl ? 'none' : 'block';
                document.getElementById('startup-media-desktop-url').style.display = isUrl ? 'block' : 'none';
            });
        });

        // Startup Media mobile source toggle
        document.querySelectorAll('input[name="startup-media-mobile-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('startup-media-mobile-upload').style.display = isUrl ? 'none' : 'block';
                document.getElementById('startup-media-mobile-url').style.display = isUrl ? 'block' : 'none';
            });
        });

        // Startup Media desktop upload
        document.getElementById('upload-startup-media-desktop')?.addEventListener('click', () => {
            document.getElementById('startup-media-desktop-file').click();
        });
        document.getElementById('startup-media-desktop-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('startup-media-desktop-filename').textContent = '✓ ' + file.name;
                    document.getElementById('startup-media-desktop-file').dataset.base64 = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // Startup Media mobile upload
        document.getElementById('upload-startup-media-mobile')?.addEventListener('click', () => {
            document.getElementById('startup-media-mobile-file').click();
        });
        document.getElementById('startup-media-mobile-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('startup-media-mobile-filename').textContent = '✓ ' + file.name;
                    document.getElementById('startup-media-mobile-file').dataset.base64 = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // ====== LANGUAGE-SPECIFIC VIDEO UPLOADS ======

        // English Desktop source toggle
        document.querySelectorAll('input[name="startup-media-en-desktop-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('startup-media-en-desktop-upload').style.display = isUrl ? 'none' : 'flex';
                document.getElementById('startup-media-en-desktop-url').style.display = isUrl ? 'block' : 'none';
            });
        });

        // English Mobile source toggle
        document.querySelectorAll('input[name="startup-media-en-mobile-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('startup-media-en-mobile-upload').style.display = isUrl ? 'none' : 'flex';
                document.getElementById('startup-media-en-mobile-url').style.display = isUrl ? 'block' : 'none';
            });
        });

        // Arabic Desktop source toggle
        document.querySelectorAll('input[name="startup-media-ar-desktop-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('startup-media-ar-desktop-upload').style.display = isUrl ? 'none' : 'flex';
                document.getElementById('startup-media-ar-desktop-url').style.display = isUrl ? 'block' : 'none';
            });
        });

        // Arabic Mobile source toggle
        document.querySelectorAll('input[name="startup-media-ar-mobile-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isUrl = e.target.value === 'url';
                document.getElementById('startup-media-ar-mobile-upload').style.display = isUrl ? 'none' : 'flex';
                document.getElementById('startup-media-ar-mobile-url').style.display = isUrl ? 'block' : 'none';
            });
        });

        // English Desktop video upload
        document.getElementById('upload-startup-media-en-desktop')?.addEventListener('click', () => {
            document.getElementById('startup-media-en-desktop-file').click();
        });
        document.getElementById('startup-media-en-desktop-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('startup-media-en-desktop-filename').textContent = '✓ ' + file.name;
                    document.getElementById('startup-media-en-desktop-file').dataset.base64 = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // English Mobile video upload
        document.getElementById('upload-startup-media-en-mobile')?.addEventListener('click', () => {
            document.getElementById('startup-media-en-mobile-file').click();
        });
        document.getElementById('startup-media-en-mobile-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('startup-media-en-mobile-filename').textContent = '✓ ' + file.name;
                    document.getElementById('startup-media-en-mobile-file').dataset.base64 = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // Arabic Desktop video upload
        document.getElementById('upload-startup-media-ar-desktop')?.addEventListener('click', () => {
            document.getElementById('startup-media-ar-desktop-file').click();
        });
        document.getElementById('startup-media-ar-desktop-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('startup-media-ar-desktop-filename').textContent = '✓ ' + file.name;
                    document.getElementById('startup-media-ar-desktop-file').dataset.base64 = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // Arabic Mobile video upload
        document.getElementById('upload-startup-media-ar-mobile')?.addEventListener('click', () => {
            document.getElementById('startup-media-ar-mobile-file').click();
        });
        document.getElementById('startup-media-ar-mobile-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('startup-media-ar-mobile-filename').textContent = '✓ ' + file.name;
                    document.getElementById('startup-media-ar-mobile-file').dataset.base64 = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('save-proj-settings').onclick = () => {
            State.setProject('meta.name', document.getElementById('proj-name').value);
            State.setProject('meta.subtitle', document.getElementById('proj-subtitle').value);
            State.setProject('meta.analyticsId', document.getElementById('proj-analytics-id').value);

            // Save UI sounds settings
            const soundAssignments = {};
            document.querySelectorAll('[data-sound-key]').forEach(select => {
                soundAssignments[select.dataset.soundKey] = select.value;
            });

            const uiSoundsSettings = {
                enabled: document.getElementById('sounds-enabled')?.checked ?? true,
                volume: parseFloat(document.getElementById('sounds-volume')?.value || 0.5),
                assignments: soundAssignments
            };

            // Save Background Music settings
            const bgMusicEnabled = document.getElementById('bg-music-enabled')?.checked ?? false;
            const bgMusicSource = document.querySelector('input[name="bg-music-source"]:checked')?.value || 'upload';
            const backgroundMusicSettings = {
                enabled: bgMusicEnabled,
                source: bgMusicSource,
                url: document.getElementById('bg-music-url')?.value || '',
                data: document.getElementById('bg-music-file')?.dataset?.base64 ||
                    State.getProject('settings')?.backgroundMusic?.data || '',
                volume: parseFloat(document.getElementById('bg-music-volume')?.value || 0.3),
                loop: document.getElementById('bg-music-loop')?.checked ?? true,
                autoplay: document.getElementById('bg-music-autoplay')?.checked ?? true
            };

            // Save Startup Sound settings
            const startupSoundEnabled = document.getElementById('startup-sound-enabled')?.checked ?? false;
            const startupSoundSource = document.querySelector('input[name="startup-sound-source"]:checked')?.value || 'upload';
            const startupSoundSettings = {
                enabled: startupSoundEnabled,
                source: startupSoundSource,
                url: document.getElementById('startup-sound-url')?.value || '',
                data: document.getElementById('startup-sound-file')?.dataset?.base64 ||
                    State.getProject('settings')?.startupSound?.data || '',
                volume: parseFloat(document.getElementById('startup-sound-volume')?.value || 0.5)
            };

            // Save Auto Fullscreen setting
            const autoFullscreenSettings = {
                enabled: document.getElementById('auto-fullscreen-enabled')?.checked ?? false
            };

            // Save Startup Media settings
            const startupMediaEnabled = document.getElementById('startup-media-enabled')?.checked ?? false;
            const languageSelectionEnabled = document.getElementById('startup-language-selection-enabled')?.checked ?? false;
            const mediaType = document.querySelector('input[name="startup-media-type"]:checked')?.value || 'video';
            const desktopSource = document.querySelector('input[name="startup-media-desktop-source"]:checked')?.value || 'file';
            const mobileSource = document.querySelector('input[name="startup-media-mobile-source"]:checked')?.value || 'file';

            // Language-specific sources
            const enDesktopSource = document.querySelector('input[name="startup-media-en-desktop-source"]:checked')?.value || 'file';
            const enMobileSource = document.querySelector('input[name="startup-media-en-mobile-source"]:checked')?.value || 'file';
            const arDesktopSource = document.querySelector('input[name="startup-media-ar-desktop-source"]:checked')?.value || 'file';
            const arMobileSource = document.querySelector('input[name="startup-media-ar-mobile-source"]:checked')?.value || 'file';

            const startupMediaSettings = {
                enabled: startupMediaEnabled,
                type: mediaType,
                languageSelection: {
                    enabled: languageSelectionEnabled
                },
                // Default media (used when language selection is OFF)
                desktop: {
                    source: desktopSource,
                    url: document.getElementById('startup-media-desktop-url-input')?.value || '',
                    data: document.getElementById('startup-media-desktop-file')?.dataset?.base64 ||
                        State.getProject('settings')?.startupMedia?.desktop?.data || null
                },
                mobile: {
                    source: mobileSource,
                    url: document.getElementById('startup-media-mobile-url-input')?.value || '',
                    data: document.getElementById('startup-media-mobile-file')?.dataset?.base64 ||
                        State.getProject('settings')?.startupMedia?.mobile?.data || null
                },
                // English intro video (used when language selection is ON)
                english: {
                    desktop: {
                        source: enDesktopSource,
                        url: document.getElementById('startup-media-en-desktop-url-input')?.value || '',
                        data: document.getElementById('startup-media-en-desktop-file')?.dataset?.base64 ||
                            State.getProject('settings')?.startupMedia?.english?.desktop?.data || null
                    },
                    mobile: {
                        source: enMobileSource,
                        url: document.getElementById('startup-media-en-mobile-url-input')?.value || '',
                        data: document.getElementById('startup-media-en-mobile-file')?.dataset?.base64 ||
                            State.getProject('settings')?.startupMedia?.english?.mobile?.data || null
                    }
                },
                // Arabic intro video (used when language selection is ON)
                arabic: {
                    desktop: {
                        source: arDesktopSource,
                        url: document.getElementById('startup-media-ar-desktop-url-input')?.value || '',
                        data: document.getElementById('startup-media-ar-desktop-file')?.dataset?.base64 ||
                            State.getProject('settings')?.startupMedia?.arabic?.desktop?.data || null
                    },
                    mobile: {
                        source: arMobileSource,
                        url: document.getElementById('startup-media-ar-mobile-url-input')?.value || '',
                        data: document.getElementById('startup-media-ar-mobile-file')?.dataset?.base64 ||
                            State.getProject('settings')?.startupMedia?.arabic?.mobile?.data || null
                    }
                },
                skipButton: {
                    showAfter: parseInt(document.getElementById('startup-media-skip-delay')?.value) ?? 2,
                    text: document.getElementById('startup-media-skip-text')?.value || 'Skip Intro'
                },
                autoAdvance: {
                    enabled: document.getElementById('startup-media-auto-advance')?.checked ?? false,
                    delay: parseInt(document.getElementById('startup-media-auto-advance-delay')?.value) || 5
                }
            };

            // Save Camera Bounds settings
            const cameraBoundsSettings = {
                enabled: document.getElementById('bounds-enabled')?.checked ?? false,
                min: {
                    x: parseFloat(document.getElementById('bounds-min-x')?.value) || -50,
                    y: parseFloat(document.getElementById('bounds-min-y')?.value) || -10,
                    z: parseFloat(document.getElementById('bounds-min-z')?.value) || -50
                },
                max: {
                    x: parseFloat(document.getElementById('bounds-max-x')?.value) || 50,
                    y: parseFloat(document.getElementById('bounds-max-y')?.value) || 50,
                    z: parseFloat(document.getElementById('bounds-max-z')?.value) || 50
                },
                minDistance: parseFloat(document.getElementById('bounds-min-dist')?.value) || 5,
                maxDistance: parseFloat(document.getElementById('bounds-max-dist')?.value) || 200
            };

            // Save Icon Scaling settings
            const iconScalingSettings = {
                minScale: parseFloat(document.getElementById('icon-min-scale')?.value) || 0.5,
                maxScale: parseFloat(document.getElementById('icon-max-scale')?.value) || 10,
                nearDistance: parseFloat(document.getElementById('icon-near-distance')?.value) || 20,
                farDistance: parseFloat(document.getElementById('icon-far-distance')?.value) || 200
            };

            // Get current settings and update
            const currentSettings = State.getProject('settings') || {};
            currentSettings.uiSounds = uiSoundsSettings;
            currentSettings.backgroundMusic = backgroundMusicSettings;
            currentSettings.startupSound = startupSoundSettings;
            currentSettings.autoFullscreen = autoFullscreenSettings;
            currentSettings.startupMedia = startupMediaSettings;
            currentSettings.cameraBounds = cameraBoundsSettings;
            currentSettings.iconScaling = iconScalingSettings;
            State.setProject('settings', currentSettings);

            // Update SoundManager with new settings
            SoundManager.updateSettings(uiSoundsSettings);

            // Update Renderer camera bounds
            Renderer.setCameraBounds && Renderer.setCameraBounds(cameraBoundsSettings);

            this.closeModal();
            this.showToast('success', 'Settings Saved');
        };
    },

    showAPISettingsModal() {
        this.showModal(`
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">API Configuration</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="api-settings-form">
                        <div class="api-field">
                            <label>OpenAI API Key</label>
                            <div class="api-key-input">
                                <input type="password" id="openai-key" value="${AI.apiKey}" placeholder="sk-...">
                                <button class="btn btn-secondary" onclick="this.previousElementSibling.type = this.previousElementSibling.type === 'password' ? 'text' : 'password'">👁</button>
                            </div>
                            <p class="field-hint">Used for AI translation and content enhancement</p>
                        </div>
                        <div id="api-status-container"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="save-api-settings">Save & Test</button>
                </div>
            </div>
        `);

        document.getElementById('save-api-settings').onclick = async () => {
            const key = document.getElementById('openai-key').value;
            AI.setApiKey(key);

            const statusContainer = document.getElementById('api-status-container');
            statusContainer.innerHTML = '<div class="api-status info"><span class="api-status-icon">⏳</span> Testing connection...</div>';

            const success = await AI.testConnection();

            if (success) {
                statusContainer.innerHTML = '<div class="api-status success"><span class="api-status-icon">✓</span> Connection successful!</div>';
                Storage.set('openai_key', key);
            } else {
                statusContainer.innerHTML = '<div class="api-status error"><span class="api-status-icon">✕</span> Connection failed. Please check your API key.</div>';
            }
        };
    },

    showSaveViewModal() {
        const name = prompt('View name:', `View ${State.getProject('views').length + 1}`);
        if (!name) return;

        const view = State.saveView(name);
        this.showToast('success', 'View Saved', name);
    },

    // ========================================
    // SET START VIEW / RECENTER
    // ========================================

    setStartView() {
        const view = {
            position: {
                x: Renderer.camera.position.x,
                y: Renderer.camera.position.y,
                z: Renderer.camera.position.z
            },
            target: {
                x: Renderer.controls.target.x,
                y: Renderer.controls.target.y,
                z: Renderer.controls.target.z
            }
        };

        State.setProject('settings.defaultView', view);
        this.showToast('success', 'Desktop Start View Set', 'This will be the initial camera position on PC');
    },

    setStartViewMobile() {
        const view = {
            position: {
                x: Renderer.camera.position.x,
                y: Renderer.camera.position.y,
                z: Renderer.camera.position.z
            },
            target: {
                x: Renderer.controls.target.x,
                y: Renderer.controls.target.y,
                z: Renderer.controls.target.z
            }
        };

        State.setProject('settings.defaultViewMobile', view);
        this.showToast('success', 'Mobile Start View Set', 'This will be the initial camera position on mobile devices');
    },

    goToStartView() {
        const view = State.getProject('settings.defaultView');
        if (view) {
            Renderer.camera.position.set(view.position.x, view.position.y, view.position.z);
            Renderer.controls.target.set(view.target.x, view.target.y, view.target.z);
            Renderer.controls.update();
        } else {
            // Fit all meshes in view
            Renderer.fitCameraToScene();
        }
    },

    // ========================================
    // ACTION BUTTONS (CONTENT TRIGGERS)
    // ========================================

    createActionButton() {
        const languages = State.getProject('languages') || [{ code: 'en', name: 'English' }];
        const categories = State.getProject('categories') || [];
        const textboxes = State.getProject('textboxes') || [];

        const modalHTML = `
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">🎬 Create Action Button</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                    <div class="prop-row">
                        <label>Icon</label>
                        <input type="text" id="ab-icon" value="▶" maxlength="2" style="width: 50px; font-size: 20px; text-align: center;">
                    </div>
                    
                    <h4 style="margin: 16px 0 8px; font-size: 13px; color: var(--text-secondary);">Names by Language</h4>
                    ${languages.map(lang => `
                        <div class="prop-row">
                            <label style="width: 40px;">${lang.code.toUpperCase()}</label>
                            <input type="text" id="ab-name-${lang.code}" placeholder="Name in ${lang.name}">
                        </div>
                    `).join('')}
                    
                    <h4 style="margin: 16px 0 8px; font-size: 13px; color: var(--text-secondary);">Placement</h4>
                    <div class="prop-row">
                        <label>Location</label>
                        <select id="ab-placement">
                            <option value="standalone">Standalone (main menu)</option>
                            <option value="category">Under a Category</option>
                        </select>
                    </div>
                    <div class="prop-row" id="ab-cat-row" style="display: none;">
                        <label>Category</label>
                        <select id="ab-category">
                            <option value="">Select...</option>
                            ${categories.map(c => `<option value="${c.id}">${c.icon || '📁'} ${c.names?.en || c.name}</option>`).join('')}
                        </select>
                    </div>
                    
                    <h4 style="margin: 16px 0 8px; font-size: 13px; color: var(--text-secondary);">Content Type</h4>
                    <div class="prop-row">
                        <label>When Clicked</label>
                        <select id="ab-content-type">
                            <option value="textbox">Show Textbox</option>
                            <option value="image">Show Image</option>
                            <option value="video">Play Video</option>
                            <option value="link">Open Link</option>
                        </select>
                    </div>
                    
                    <div id="ab-content-textbox" class="ab-content-section">
                        <div class="prop-row">
                            <label>Textbox</label>
                            <select id="ab-textbox">
                                <option value="">Select existing...</option>
                                ${textboxes.map(t => `<option value="${t.id}">${t.content?.en?.heading || 'Untitled'}</option>`).join('')}
                                <option value="new">+ Create New Textbox</option>
                            </select>
                        </div>
                    </div>
                    
                    <div id="ab-content-image" class="ab-content-section" style="display: none;">
                        <div class="prop-row">
                            <label>Image</label>
                            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('ab-image-file').click()">Upload Image</button>
                            <input type="file" id="ab-image-file" accept="image/*" style="display: none;">
                        </div>
                        <div id="ab-image-preview" style="margin-top: 8px;"></div>
                    </div>
                    
                    <div id="ab-content-video" class="ab-content-section" style="display: none;">
                        <div class="prop-row">
                            <label>Video URL</label>
                            <input type="text" id="ab-video-url" placeholder="YouTube or video URL">
                        </div>
                    </div>
                    
                    <div id="ab-content-link" class="ab-content-section" style="display: none;">
                        <div class="prop-row">
                            <label>URL</label>
                            <input type="text" id="ab-link-url" placeholder="https://...">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="UI.saveNewActionButton()">Create</button>
                </div>
            </div>
        `;

        this.showModal(modalHTML);

        // Event handlers
        document.getElementById('ab-placement').onchange = (e) => {
            document.getElementById('ab-cat-row').style.display = e.target.value === 'category' ? '' : 'none';
        };

        document.getElementById('ab-content-type').onchange = (e) => {
            document.querySelectorAll('.ab-content-section').forEach(s => s.style.display = 'none');
            document.getElementById(`ab-content-${e.target.value}`).style.display = '';
        };

        document.getElementById('ab-image-file').onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('ab-image-preview').innerHTML =
                        `<img src="${ev.target.result}" style="max-width: 100%; max-height: 150px; border-radius: 8px;">`;
                    document.getElementById('ab-image-preview').dataset.imageData = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
    },

    saveNewActionButton() {
        const languages = State.getProject('languages') || [{ code: 'en', name: 'English' }];

        // Collect names
        const names = {};
        let hasName = false;
        languages.forEach(lang => {
            const input = document.getElementById(`ab-name-${lang.code}`);
            if (input && input.value.trim()) {
                names[lang.code] = input.value.trim();
                hasName = true;
            }
        });

        if (!hasName) {
            this.showToast('error', 'Enter at least one name');
            return;
        }

        const defaultName = names['en'] || Object.values(names)[0];
        const contentType = document.getElementById('ab-content-type').value;

        // Build content object
        let contentId = null;
        let content = {};

        if (contentType === 'textbox') {
            contentId = document.getElementById('ab-textbox').value;
            if (contentId === 'new') {
                // Create a new textbox
                const newTextbox = {
                    id: Utils.generateId('textbox'),
                    content: { en: { heading: defaultName, body: '' } },
                    position: { x: 0, y: 0, z: 0 },
                    style: {}
                };
                State.addToProject('textboxes', newTextbox);
                contentId = newTextbox.id;
            }
        } else if (contentType === 'image') {
            content.image = document.getElementById('ab-image-preview')?.dataset?.imageData || null;
        } else if (contentType === 'video') {
            content.video = document.getElementById('ab-video-url').value;
        } else if (contentType === 'link') {
            content.link = document.getElementById('ab-link-url').value;
        }

        const actionButton = {
            id: Utils.generateId('action'),
            name: defaultName,
            names: names,
            icon: document.getElementById('ab-icon').value || '▶',
            placement: document.getElementById('ab-placement').value,
            categoryId: document.getElementById('ab-category')?.value || null,
            contentType: contentType,
            contentId: contentId,
            content: content
        };

        // Add to project
        const actionButtons = State.getProject('actionButtons') || [];
        actionButtons.push(actionButton);
        State.setProject('actionButtons', actionButtons);

        this.closeModal();
        this.updateHierarchy();
        State.select('actionButton', actionButton.id);
        this.showToast('success', 'Action Button Created', defaultName);
    },

    // Execute action button (for preview/viewer)
    executeActionButton(actionId) {
        const btn = (State.getProject('actionButtons') || []).find(b => b.id === actionId);
        if (!btn) return;

        console.log('Executing action button:', btn.name, btn.contentType);

        if (btn.contentType === 'textbox' && btn.contentId) {
            const textbox = State.findById('textboxes', btn.contentId);
            if (textbox) {
                ContentManager.showPopup(textbox);
            }
        } else if (btn.contentType === 'image' && btn.content?.image) {
            ContentManager.showImagePopup(btn.content.image);
        } else if (btn.contentType === 'video' && btn.content?.video) {
            ContentManager.showVideo(btn.content.video);
        } else if (btn.contentType === 'link' && btn.content?.link) {
            window.open(btn.content.link, '_blank');
        }
    },

    // ========================================
    // GLOBAL STYLING SETTINGS
    // ========================================

    showGlobalStylesModal() {
        const settings = State.getProject('settings') || {};
        const typography = settings.typography || {};
        const colors = settings.colors || {};
        const textboxDefaults = settings.textboxDefaults || {};
        const menuStyle = settings.menuStyle || {};

        const availableFonts = [
            'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
            'Playfair Display', 'Merriweather', 'Noto Sans', 'Noto Sans Arabic',
            'Amiri', 'Cairo', 'Tajawal', 'Source Sans Pro', 'Raleway'
        ];

        const modalHTML = `
            <div class="modal modal-lg">
                <div class="modal-header">
                    <h3 class="modal-title">🎨 Global Styles</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    
                    <h4 style="margin: 0 0 12px; color: var(--accent-primary);">📝 Typography</h4>
                    <div class="prop-row">
                        <label>Primary Font</label>
                        <select id="gs-primary-font">
                            ${availableFonts.map(f => `<option value="${f}" ${typography.primaryFont === f ? 'selected' : ''}>${f}</option>`).join('')}
                        </select>
                    </div>
                    <div class="prop-row">
                        <label>Heading Font</label>
                        <select id="gs-heading-font">
                            ${availableFonts.map(f => `<option value="${f}" ${typography.headingFont === f ? 'selected' : ''}>${f}</option>`).join('')}
                        </select>
                    </div>
                    <div class="prop-row">
                        <label>Base Font Size</label>
                        <select id="gs-font-size">
                            <option value="14" ${typography.baseFontSize == 14 ? 'selected' : ''}>Small (14px)</option>
                            <option value="18" ${typography.baseFontSize == 18 || !typography.baseFontSize ? 'selected' : ''}>Medium (18px)</option>
                            <option value="25" ${typography.baseFontSize == 25 ? 'selected' : ''}>Large (25px)</option>
                            <option value="30" ${typography.baseFontSize == 30 ? 'selected' : ''}>Extra Large (30px)</option>
                        </select>
                    </div>
                    <div class="prop-row">
                        <label>RTL Support</label>
                        <label class="toggle">
                            <input type="checkbox" id="gs-rtl" ${typography.rtlSupport ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="prop-row">
                        <label>Custom Font</label>
                        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('gs-font-file').click()">Upload Font (.woff, .woff2, .ttf)</button>
                        <input type="file" id="gs-font-file" accept=".woff,.woff2,.ttf,.otf" style="display: none;">
                    </div>
                    <div id="gs-custom-fonts-list" style="margin-top: 8px;"></div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">🎨 Colors</h4>
                    <div class="prop-row">
                        <label>Primary Color</label>
                        <input type="color" id="gs-color-primary" value="${colors.primary || '#00C8FF'}">
                    </div>
                    <div class="prop-row">
                        <label>Secondary Color</label>
                        <input type="color" id="gs-color-secondary" value="${colors.secondary || '#7B61FF'}">
                    </div>
                    <div class="prop-row">
                        <label>Text Color</label>
                        <input type="color" id="gs-color-text" value="${colors.text || '#ffffff'}">
                    </div>
                    <div class="prop-row">
                        <label>Background Color</label>
                        <input type="color" id="gs-color-bg" value="${colors.background || '#1a1a1a'}">
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">📦 Textbox Defaults</h4>
                    <div class="prop-row">
                        <label>Header Background</label>
                        <input type="color" id="gs-tb-header-bg" value="${textboxDefaults.headerBackground || '#00C8FF'}">
                    </div>
                    <div class="prop-row">
                        <label>Header Text</label>
                        <input type="color" id="gs-tb-header-text" value="${textboxDefaults.headerTextColor || '#ffffff'}">
                    </div>
                    <div class="prop-row">
                        <label>Body Background</label>
                        <input type="color" id="gs-tb-body-bg" value="${textboxDefaults.bodyBackground || '#2a2a2a'}">
                    </div>
                    <div class="prop-row">
                        <label>Body Text</label>
                        <input type="color" id="gs-tb-body-text" value="${textboxDefaults.bodyTextColor || '#ffffff'}">
                    </div>
                    <div class="prop-row">
                        <label>Border Radius</label>
                        <select id="gs-tb-radius">
                            <option value="0" ${textboxDefaults.borderRadius == 0 ? 'selected' : ''}>None</option>
                            <option value="8" ${textboxDefaults.borderRadius == 8 ? 'selected' : ''}>Small (8px)</option>
                            <option value="12" ${textboxDefaults.borderRadius == 12 || !textboxDefaults.borderRadius ? 'selected' : ''}>Medium (12px)</option>
                            <option value="16" ${textboxDefaults.borderRadius == 16 ? 'selected' : ''}>Large (16px)</option>
                            <option value="24" ${textboxDefaults.borderRadius == 24 ? 'selected' : ''}>Extra Large (24px)</option>
                        </select>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">📋 Menu Style</h4>
                    <div class="prop-row">
                        <label>Menu Background</label>
                        <input type="color" id="gs-menu-bg" value="${this.rgbaToHex(menuStyle.background) || '#1a1a1a'}">
                    </div>
                    <div class="prop-row">
                        <label>Menu Text</label>
                        <input type="color" id="gs-menu-text" value="${menuStyle.textColor || '#ffffff'}">
                    </div>
                    <div class="prop-row">
                        <label>Hover Color</label>
                        <input type="color" id="gs-menu-hover" value="${menuStyle.hoverColor || '#00C8FF'}">
                    </div>
                    
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="UI.saveGlobalStyles()">Save Styles</button>
                </div>
            </div>
        `;

        this.showModal(modalHTML);

        // Custom font upload handler
        document.getElementById('gs-font-file').onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const fontName = file.name.replace(/\.[^/.]+$/, "");
                    const customFonts = State.getProject('settings.typography.customFonts') || [];
                    customFonts.push({ name: fontName, data: ev.target.result });
                    State.setProject('settings.typography.customFonts', customFonts);
                    this.updateCustomFontsList();
                    this.showToast('success', 'Font Uploaded', fontName);
                };
                reader.readAsDataURL(file);
            }
        };

        this.updateCustomFontsList();
    },

    updateCustomFontsList() {
        const container = document.getElementById('gs-custom-fonts-list');
        if (!container) return;

        const customFonts = State.getProject('settings.typography.customFonts') || [];
        if (customFonts.length === 0) {
            container.innerHTML = '<p style="font-size: 12px; color: var(--text-tertiary);">No custom fonts uploaded</p>';
            return;
        }

        container.innerHTML = customFonts.map((f, i) => `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 12px;">${f.name}</span>
                <button class="btn btn-sm" onclick="UI.removeCustomFont(${i})" style="padding: 2px 6px;">×</button>
            </div>
        `).join('');
    },

    removeCustomFont(index) {
        const customFonts = State.getProject('settings.typography.customFonts') || [];
        customFonts.splice(index, 1);
        State.setProject('settings.typography.customFonts', customFonts);
        this.updateCustomFontsList();
    },

    rgbaToHex(rgba) {
        if (!rgba || !rgba.includes('rgba')) return rgba;
        const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            return '#' + [match[1], match[2], match[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
        }
        return '#1a1a1a';
    },

    saveGlobalStyles() {
        // Typography
        State.setProject('settings.typography', {
            primaryFont: document.getElementById('gs-primary-font').value,
            headingFont: document.getElementById('gs-heading-font').value,
            baseFontSize: parseInt(document.getElementById('gs-font-size').value),
            rtlSupport: document.getElementById('gs-rtl').checked,
            customFonts: State.getProject('settings.typography.customFonts') || []
        });

        // Colors
        State.setProject('settings.colors', {
            primary: document.getElementById('gs-color-primary').value,
            secondary: document.getElementById('gs-color-secondary').value,
            text: document.getElementById('gs-color-text').value,
            background: document.getElementById('gs-color-bg').value
        });

        // Textbox defaults
        State.setProject('settings.textboxDefaults', {
            headerBackground: document.getElementById('gs-tb-header-bg').value,
            headerTextColor: document.getElementById('gs-tb-header-text').value,
            bodyBackground: document.getElementById('gs-tb-body-bg').value,
            bodyTextColor: document.getElementById('gs-tb-body-text').value,
            borderRadius: parseInt(document.getElementById('gs-tb-radius').value)
        });

        // Menu style
        State.setProject('settings.menuStyle', {
            background: document.getElementById('gs-menu-bg').value,
            textColor: document.getElementById('gs-menu-text').value,
            hoverColor: document.getElementById('gs-menu-hover').value
        });

        // Update 3D background
        Renderer.setBackgroundColor(document.getElementById('gs-color-bg').value);

        this.closeModal();
        this.showToast('success', 'Global Styles Saved');
    },

    // ========================================
    // MEASUREMENT SCALE SETTINGS
    // ========================================

    showScaleSettingsModal() {
        const settings = State.getProject('settings') || {};
        const scale = settings.scale || { factor: 1, unit: 'meters', gridSize: 10 };

        const modalHTML = `
            <div class="modal modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">📏 Scale & Measurement</h3>
                    <button class="modal-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <h4 style="margin: 0 0 12px; color: var(--accent-primary);">Option A: Manual Scale Factor</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Set how many real-world units equal 1 internal unit.</p>
                    
                    <div class="prop-row">
                        <label>1 internal unit =</label>
                        <div style="display: flex; gap: 8px; flex: 1;">
                            <input type="number" id="scale-factor" value="${scale.factor}" min="0.001" step="0.1" style="width: 100px;">
                            <select id="scale-unit">
                                <option value="meters" ${scale.unit === 'meters' ? 'selected' : ''}>meters</option>
                                <option value="feet" ${scale.unit === 'feet' ? 'selected' : ''}>feet</option>
                                <option value="centimeters" ${scale.unit === 'centimeters' ? 'selected' : ''}>centimeters</option>
                                <option value="inches" ${scale.unit === 'inches' ? 'selected' : ''}>inches</option>
                            </select>
                        </div>
                    </div>
                    
                    <h4 style="margin: 20px 0 12px; color: var(--accent-primary);">Option B: Visual Grid</h4>
                    <p class="field-hint" style="margin-bottom: 12px;">Display a grid overlay and adjust until it matches known distances.</p>
                    
                    <div class="prop-row">
                        <label>Show Grid</label>
                        <label class="toggle">
                            <input type="checkbox" id="scale-show-grid" ${this.scaleGridVisible ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="prop-row">
                        <label>Grid Square Size</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="number" id="scale-grid-size" value="${scale.gridSize}" min="1" step="1" style="width: 80px;">
                            <span id="scale-grid-unit">${scale.unit}</span>
                        </div>
                    </div>
                    <div class="prop-row">
                        <label>Grid Opacity</label>
                        <input type="range" id="scale-grid-opacity" min="0.1" max="1" step="0.1" value="0.3" style="flex: 1;">
                    </div>
                    
                    <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-top: 16px;">
                        <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">
                            💡 <strong>Tip:</strong> If you know a distance in your model (e.g., a door is 2m), 
                            measure it with the ruler tool, then adjust the scale factor until 
                            the measurement shows the correct value.
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="UI.saveScaleSettings()">Save</button>
                </div>
            </div>
        `;

        this.showModal(modalHTML);

        // Event handlers
        document.getElementById('scale-unit').onchange = (e) => {
            document.getElementById('scale-grid-unit').textContent = e.target.value;
        };

        document.getElementById('scale-show-grid').onchange = (e) => {
            this.toggleScaleGrid(e.target.checked);
        };

        document.getElementById('scale-grid-size').oninput = (e) => {
            this.updateScaleGrid(parseFloat(e.target.value));
        };

        document.getElementById('scale-grid-opacity').oninput = (e) => {
            this.setScaleGridOpacity(parseFloat(e.target.value));
        };
    },

    toggleScaleGrid(show) {
        this.scaleGridVisible = show;

        if (show) {
            if (!this.scaleGrid) {
                const size = parseFloat(document.getElementById('scale-grid-size')?.value || 10);
                this.createScaleGrid(size);
            }
            this.scaleGrid.visible = true;
        } else if (this.scaleGrid) {
            this.scaleGrid.visible = false;
        }
    },

    createScaleGrid(gridSize) {
        // Remove existing grid
        if (this.scaleGrid) {
            Renderer.scene.remove(this.scaleGrid);
            this.scaleGrid.geometry.dispose();
            this.scaleGrid.material.dispose();
        }

        // Create grid - 100x100 squares
        const divisions = 100;
        const size = gridSize * divisions;

        const gridHelper = new THREE.GridHelper(size, divisions, 0x00C8FF, 0x444444);
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        gridHelper.renderOrder = 1;

        this.scaleGrid = gridHelper;
        Renderer.scene.add(this.scaleGrid);
    },

    updateScaleGrid(gridSize) {
        if (this.scaleGridVisible) {
            this.createScaleGrid(gridSize);
        }
    },

    setScaleGridOpacity(opacity) {
        if (this.scaleGrid) {
            this.scaleGrid.material.opacity = opacity;
        }
    },

    saveScaleSettings() {
        const factor = parseFloat(document.getElementById('scale-factor').value) || 1;
        const unit = document.getElementById('scale-unit').value;
        const gridSize = parseFloat(document.getElementById('scale-grid-size').value) || 10;

        State.setProject('settings.scale', {
            factor: factor,
            unit: unit,
            gridSize: gridSize
        });

        // Hide grid after saving
        if (this.scaleGrid) {
            this.scaleGrid.visible = false;
            this.scaleGridVisible = false;
        }

        this.closeModal();
        this.showToast('success', 'Scale Settings Saved', `1 unit = ${factor} ${unit}`);
    },

    // Get real-world distance from internal distance
    convertToRealDistance(internalDistance) {
        const scale = State.getProject('settings.scale') || { factor: 1, unit: 'meters' };
        return {
            value: internalDistance * scale.factor,
            unit: scale.unit
        };
    },

    // ========================================
    // PATH ANIMATIONS UI
    // ========================================

    /**
     * Show Path Animations Panel (floating side panel - doesn't block canvas)
     */
    showPathAnimationsPanel() {
        // Remove existing panel if any
        const existingPanel = document.getElementById('path-animations-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const paths = PathAnimations.paths || [];

        // Create floating panel
        const panel = document.createElement('div');
        panel.id = 'path-animations-panel';
        panel.className = 'path-animations-panel';
        panel.innerHTML = `
            <div class="path-panel-header">
                <h3>🛤️ Path Animations</h3>
                <button class="path-panel-close" onclick="UI.closePathAnimationsPanel()">×</button>
            </div>
            <div class="path-panel-body">
                <!-- Path List -->
                <div class="path-panel-section">
                    <div class="path-panel-section-header">
                        <span>Paths</span>
                        <button class="btn btn-sm btn-primary" onclick="UI.createNewPath()">+ New</button>
                    </div>
                    <div id="path-list" class="path-list">
                        ${paths.length === 0 ?
                '<p class="path-empty-msg">No paths created yet.</p>' :
                paths.map(p => this.renderPathListItem(p)).join('')
            }
                    </div>
                </div>
                
                <!-- Path Properties -->
                <div id="path-properties-container" class="path-properties-container">
                    <div class="path-empty-msg">
                        <p>Select a path to edit, or create a new one.</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Make panel draggable by header
        this.makePathPanelDraggable(panel);
    },

    /**
     * Close Path Animations Panel
     */
    closePathAnimationsPanel() {
        const panel = document.getElementById('path-animations-panel');
        if (panel) {
            panel.remove();
        }

        // Stop adding points mode if active
        if (PathAnimations.isAddingPoints) {
            PathAnimations.stopAddingPoints();
        }

        // Hide point edit panel
        this.hidePointProperties();
    },

    /**
     * Make the path panel draggable
     */
    makePathPanelDraggable(panel) {
        const header = panel.querySelector('.path-panel-header');
        let isDragging = false;
        let startX, startY, initialX, initialY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = (initialX + dx) + 'px';
            panel.style.top = (initialY + dy) + 'px';
            panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'grab';
        });
    },

    /**
     * Render a path list item
     */
    renderPathListItem(path) {
        const isSelected = PathAnimations.selectedPathId === path.id;
        const pointCount = path.points?.length || 0;
        const loopIcon = path.isLooping ? '🔄' : '➡️';

        return `
            <div class="path-list-item ${isSelected ? 'selected' : ''}" 
                 onclick="UI.selectPathForEdit('${path.id}')"
                 data-path-id="${path.id}">
                <div class="path-item-info">
                    <span class="path-item-name">${path.name}</span>
                    <span class="path-item-meta">${pointCount} points • ${loopIcon}</span>
                </div>
                <div class="path-item-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); UI.duplicatePathAnim('${path.id}')" title="Duplicate">📋</button>
                    <button class="btn-icon" onclick="event.stopPropagation(); UI.deletePathAnim('${path.id}')" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    },

    /**
     * Update path list
     */
    updatePathList() {
        const container = document.getElementById('path-list');
        if (!container) return;

        const paths = PathAnimations.paths || [];
        container.innerHTML = paths.length === 0 ?
            '<p style="color: var(--text-secondary); font-size: 13px;">No paths created yet.</p>' :
            paths.map(p => this.renderPathListItem(p)).join('');
    },

    /**
     * Create a new path
     */
    createNewPath() {
        const path = PathAnimations.createPath('Path ' + (PathAnimations.paths.length + 1));
        this.updatePathList();
        this.selectPathForEdit(path.id);
        this.showToast('success', 'Path created');
    },

    /**
     * Select a path for editing
     */
    selectPathForEdit(pathId) {
        PathAnimations.selectPath(pathId);
        this.updatePathList();
        this.showPathProperties(pathId);
    },

    /**
     * Delete a path
     */
    deletePathAnim(pathId) {
        if (confirm('Delete this path animation?')) {
            PathAnimations.deletePath(pathId);
            this.updatePathList();
            const container = document.getElementById('path-properties-container');
            if (container) {
                container.innerHTML = `
                    <div class="path-empty-msg">
                        <p>Select a path to edit, or create a new one.</p>
                    </div>
                `;
            }
            this.showToast('success', 'Path deleted');
        }
    },

    /**
     * Duplicate a path
     */
    duplicatePathAnim(pathId) {
        const newPath = PathAnimations.duplicatePath(pathId);
        if (newPath) {
            this.updatePathList();
            this.selectPathForEdit(newPath.id);
            this.showToast('success', 'Path duplicated');
        }
    },

    /**
     * Show path properties panel
     */
    showPathProperties(pathId) {
        const path = PathAnimations.paths.find(p => p.id === pathId);
        if (!path) return;

        const container = document.getElementById('path-properties-container');
        if (!container) return;

        // Get available meshes
        const meshes = State.getProject('meshes') || [];
        const categories = State.getProject('categories') || [];
        const points = State.getProject('points') || [];

        container.innerHTML = `
            <div class="path-properties">
                <!-- Basic Info -->
                <div class="prop-section">
                    <h4>Basic Info</h4>
                    <div class="prop-row">
                        <label>Name</label>
                        <input type="text" id="path-name" value="${path.name}" 
                               onchange="UI.updatePathProp('${pathId}', 'name', this.value)">
                    </div>
                    <div class="prop-row">
                        <label>Enabled</label>
                        <label class="toggle">
                            <input type="checkbox" id="path-enabled" ${path.enabled ? 'checked' : ''} 
                                   onchange="UI.updatePathProp('${pathId}', 'enabled', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Target Surface for Point Placement - IMPORTANT -->
                <div class="prop-section" style="background: var(--accent-color); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <h4 style="color: white; margin-bottom: 8px;">🎯 Surface Mesh (REQUIRED)</h4>
                    <p style="font-size: 11px; color: rgba(255,255,255,0.8); margin-bottom: 8px;">
                        Select the terrain/ground mesh where points should land
                    </p>
                    <div class="prop-row">
                        <select id="path-target-surface" onchange="UI.updatePathProp('${pathId}', 'targetSurfaceId', this.value)" 
                                style="width: 100%; padding: 8px; font-size: 14px;">
                            <option value="">⚠️ SELECT A MESH...</option>
                            ${meshes.map(m => `<option value="${m.id}" ${path.targetSurfaceId === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </div>
                    ${!path.targetSurfaceId ? '<p style="color: #ffcc00; font-size: 11px; margin-top: 8px;">⚠️ Please select a mesh (e.g., "big final") to place points on it!</p>' : '<p style="color: #00ff00; font-size: 11px; margin-top: 8px;">✓ Points will land on: ' + (meshes.find(m => m.id === path.targetSurfaceId)?.name || 'Selected Mesh') + '</p>'}
                </div>
                
                <!-- Path Points -->
                <div class="prop-section">
                    <h4>Path Points <span style="color: var(--text-secondary);">(${path.points.length})</span></h4>
                    <div class="path-toolbar">
                        <button class="btn btn-sm ${PathAnimations.isAddingPoints ? 'btn-primary' : ''}" 
                                onclick="UI.toggleAddPoints('${pathId}')" id="btn-add-points">
                            ${PathAnimations.isAddingPoints ? '✓ Done Adding' : '+ Add Points'}
                        </button>
                        <button class="btn btn-sm" onclick="UI.clearAllPathPoints('${pathId}')">Clear All</button>
                    </div>
                    <div id="path-points-list" class="path-points-list">
                        ${this.renderPathPointsList(path)}
                    </div>
                    
                    <div class="path-loop-status">
                        Loop Status: ${path.isLooping ? '🔄 Looping' : '➡️ Non-looping'}
                        <span style="color: var(--text-secondary); font-size: 11px;">(auto-detected)</span>
                    </div>
                </div>
                
                <!-- Path Type -->
                <div class="prop-section">
                    <h4>Path Type</h4>
                    <div class="path-type-toggle">
                        <label class="path-type-option ${path.pathType === 'bezier' ? 'selected' : ''}">
                            <input type="radio" name="pathType" value="bezier" 
                                   ${path.pathType === 'bezier' ? 'checked' : ''}
                                   onchange="UI.updatePathProp('${pathId}', 'pathType', 'bezier')">
                            <span>∿ Bezier</span>
                            <small>Smooth Curve</small>
                        </label>
                        <label class="path-type-option ${path.pathType === 'linear' ? 'selected' : ''}">
                            <input type="radio" name="pathType" value="linear"
                                   ${path.pathType === 'linear' ? 'checked' : ''}
                                   onchange="UI.updatePathProp('${pathId}', 'pathType', 'linear')">
                            <span>╱ Linear</span>
                            <small>Straight Lines</small>
                        </label>
                    </div>
                    <div class="prop-row" id="curve-tension-row" style="${path.pathType === 'linear' ? 'display:none;' : ''}">
                        <label>Curve Tension</label>
                        <input type="range" min="0" max="1" step="0.1" value="${path.curveTension}"
                               onchange="UI.updatePathProp('${pathId}', 'curveTension', parseFloat(this.value))"
                               oninput="document.getElementById('tension-val').textContent = this.value">
                        <span id="tension-val">${path.curveTension}</span>
                    </div>
                </div>
                
                <!-- Mesh Assignment -->
                <div class="prop-section">
                    <h4>Mesh Assignment</h4>
                    <div class="prop-row">
                        <label>Mesh</label>
                        <select id="path-mesh" onchange="UI.updatePathMesh('${pathId}', this.value)">
                            <option value="">Select a mesh...</option>
                            ${meshes.map(m => `<option value="${m.id}" ${path.mesh.id === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="prop-row">
                        <label>Density</label>
                        <input type="number" value="${path.spawning?.maxOnScreen || 1}" min="1" max="50" step="1"
                               onchange="UI.updatePathProp('${pathId}', 'spawning.maxOnScreen', parseInt(this.value))"
                               title="Number of mesh instances on path at once">
                        <span style="color: var(--text-secondary); font-size: 10px; margin-left: 4px;">instances</span>
                    </div>
                    <div class="prop-row">
                        <label>Spread</label>
                        <input type="number" value="${path.mesh.spread || 0}" min="0" max="50" step="1"
                               onchange="UI.updatePathProp('${pathId}', 'mesh.spread', parseFloat(this.value))"
                               title="How far left/right meshes can deviate from path">
                        <span style="color: var(--text-secondary); font-size: 10px; margin-left: 4px;">meters</span>
                    </div>
                    <div class="prop-row">
                        <label>Orient to Path</label>
                        <label class="toggle">
                            <input type="checkbox" ${path.mesh.orientToPath ? 'checked' : ''} 
                                   onchange="UI.updatePathProp('${pathId}', 'mesh.orientToPath', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="prop-row">
                        <label>Rotation Offset (Y°)</label>
                        <input type="number" value="${path.mesh.rotationOffset?.y || 0}" step="15"
                               onchange="UI.updatePathProp('${pathId}', 'mesh.rotationOffset.y', parseFloat(this.value))">
                    </div>
                </div>
                
                <!-- Motion Settings -->
                <div class="prop-section">
                    <h4>Motion Settings</h4>
                    <div class="prop-row">
                        <label>Speed (m/s)</label>
                        <input type="number" value="${path.motion.speed}" min="0.1" step="0.5"
                               onchange="UI.updatePathProp('${pathId}', 'motion.speed', parseFloat(this.value))">
                    </div>
                </div>
                

                
                <!-- Trigger -->
                <div class="prop-section">
                    <h4>Trigger</h4>
                    <div class="prop-row">
                        <label>Start On</label>
                        <select id="path-trigger-type" onchange="UI.updateTriggerType('${pathId}', this.value)">
                            <option value="startup" ${path.trigger.type === 'startup' ? 'selected' : ''}>Startup (Auto-start)</option>
                            <option value="category" ${path.trigger.type === 'category' ? 'selected' : ''}>Category Click</option>
                            <option value="point" ${path.trigger.type === 'point' ? 'selected' : ''}>Point Click</option>
                            <option value="manual" ${path.trigger.type === 'manual' ? 'selected' : ''}>Manual (API)</option>
                        </select>
                    </div>
                    <div id="trigger-target-row" style="${path.trigger.type === 'category' || path.trigger.type === 'point' ? '' : 'display:none;'}">
                        <div class="prop-row">
                            <label>${path.trigger.type === 'category' ? 'Category' : 'Point'}</label>
                            <select onchange="UI.updatePathProp('${pathId}', 'trigger.targetId', this.value)">
                                <option value="">Select...</option>
                                ${path.trigger.type === 'category' ?
                categories.map(c => `<option value="${c.id}" ${path.trigger.targetId === c.id ? 'selected' : ''}>${c.name}</option>`).join('') :
                points.map(p => `<option value="${p.id}" ${path.trigger.targetId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')
            }
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Preview -->
                <div class="prop-section">
                    <h4>Preview</h4>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" onclick="UI.previewPathAnimation('${pathId}')">▶ Preview</button>
                        <button class="btn" onclick="UI.stopPathPreview()">⏹ Stop</button>
                    </div>
                </div>
            </div>
        `;

        // Setup sound enabled toggle
        document.getElementById('path-sound-enabled')?.addEventListener('change', (e) => {
            document.getElementById('path-sound-settings').style.display = e.target.checked ? '' : 'none';
        });
    },

    /**
     * Render path points list
     */
    renderPathPointsList(path) {
        if (!path.points || path.points.length === 0) {
            return '<p style="color: var(--text-secondary); font-size: 12px; padding: 8px;">No points yet. Click "Add Points" then click on the 3D canvas.</p>';
        }

        return path.points.map((pt, index) => {
            const isStart = index === 0;
            const isEnd = index === path.points.length - 1 && !path.isLooping;
            const isSelected = PathAnimations.selectedPointIndex === index;

            let icon = '🟢';
            if (isStart) icon = '🟡';
            else if (isEnd) icon = '🔴';

            return `
                <div class="path-point-item ${isSelected ? 'selected' : ''}" 
                     onclick="UI.selectPathPoint('${path.id}', ${index})">
                    <span class="point-icon">${icon}</span>
                    <span class="point-label">Point ${index + 1}</span>
                    <span class="point-coords">(${pt.position.x.toFixed(1)}, ${pt.position.y.toFixed(1)}, ${pt.position.z.toFixed(1)})</span>
                    <div class="point-actions">
                        ${index > 0 ? `<button class="btn-icon-sm" onclick="event.stopPropagation(); UI.movePathPointUp('${path.id}', ${index})" title="Move Up">↑</button>` : ''}
                        ${index < path.points.length - 1 ? `<button class="btn-icon-sm" onclick="event.stopPropagation(); UI.movePathPointDown('${path.id}', ${index})" title="Move Down">↓</button>` : ''}
                        <button class="btn-icon-sm" onclick="event.stopPropagation(); UI.deletePathPoint('${path.id}', ${index})" title="Delete">🗑</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Update path points list
     */
    updatePathPointsList(pathId) {
        const path = PathAnimations.paths.find(p => p.id === pathId);
        if (!path) {
            console.log('updatePathPointsList: path not found', pathId);
            return;
        }

        console.log('updatePathPointsList:', pathId, 'points:', path.points.length);

        const container = document.getElementById('path-points-list');
        if (container) {
            container.innerHTML = this.renderPathPointsList(path);
        }

        // Update point count in header
        const headers = document.querySelectorAll('.prop-section h4');
        headers.forEach(header => {
            if (header.textContent.includes('Path Points')) {
                header.innerHTML = `Path Points <span style="color: var(--text-secondary);">(${path.points.length})</span>`;
            }
        });

        // Update loop status
        this.updateLoopStatus(path.isLooping);
    },

    /**
     * Toggle add points mode
     */
    toggleAddPoints(pathId) {
        if (PathAnimations.isAddingPoints) {
            PathAnimations.stopAddingPoints();
            document.getElementById('btn-add-points').textContent = '+ Add Points';
            document.getElementById('btn-add-points').classList.remove('btn-primary');
        } else {
            PathAnimations.startAddingPoints();
            document.getElementById('btn-add-points').textContent = '✓ Done Adding';
            document.getElementById('btn-add-points').classList.add('btn-primary');
        }
    },

    /**
     * Clear all points from path
     */
    clearAllPathPoints(pathId) {
        if (confirm('Clear all points from this path?')) {
            const path = PathAnimations.paths.find(p => p.id === pathId);
            if (path) {
                path.points = [];
                PathAnimations.saveToState();
                PathAnimations.renderPath(pathId);
                this.updatePathPointsList(pathId);
                this.showToast('success', 'All points cleared');
            }
        }
    },

    /**
     * Move all points to a specific Y height
     */
    moveAllPointsY(pathId) {
        const path = PathAnimations.paths.find(p => p.id === pathId);
        if (!path || path.points.length === 0) {
            this.showToast('warning', 'No points to move');
            return;
        }

        const yInput = document.getElementById('move-all-y-value');
        const newY = parseFloat(yInput?.value || 0);

        path.points.forEach(pt => {
            pt.position.y = newY;
        });

        PathAnimations.saveToState();
        PathAnimations.renderPath(pathId);
        this.updatePathPointsList(pathId);
        this.showToast('success', `All ${path.points.length} points moved to Y=${newY}`);
    },

    /**
     * Project all points down onto the selected surface mesh
     */
    projectPointsToSurface(pathId) {
        console.log('=== PROJECT POINTS TO SURFACE ===');
        const path = PathAnimations.paths.find(p => p.id === pathId);
        if (!path || path.points.length === 0) {
            this.showToast('warning', 'No points to project');
            return;
        }
        console.log('Path has', path.points.length, 'points');

        const targetMeshId = path.targetSurfaceId;
        console.log('Target Surface ID:', targetMeshId);
        if (!targetMeshId) {
            this.showToast('warning', 'Select a Surface Mesh first in the blue box above!');
            return;
        }

        const targetMeshData = Renderer.meshes?.get(targetMeshId);
        console.log('Target Mesh Data:', targetMeshData);
        if (!targetMeshData || !targetMeshData.object) {
            this.showToast('error', 'Target mesh not found');
            return;
        }

        // Get all meshes from target
        const meshes = [];
        targetMeshData.object.traverse(child => {
            if (child.isMesh) meshes.push(child);
        });
        console.log('Found', meshes.length, 'mesh children');

        const raycaster = new THREE.Raycaster();
        let projected = 0;

        path.points.forEach((pt, idx) => {
            // Raycast from above the point straight down
            const origin = new THREE.Vector3(pt.position.x, pt.position.y + 1000, pt.position.z);
            const direction = new THREE.Vector3(0, -1, 0);
            raycaster.set(origin, direction);

            const intersects = raycaster.intersectObjects(meshes, true);
            console.log(`Point ${idx}: raycast from Y=${origin.y}, found ${intersects.length} intersections`);
            if (intersects.length > 0) {
                const oldY = pt.position.y;
                pt.position.y = intersects[0].point.y;
                console.log(`  Point ${idx}: Y changed from ${oldY} to ${pt.position.y}`);
                projected++;
            }
        });

        PathAnimations.saveToState();
        PathAnimations.renderPath(pathId);
        this.updatePathPointsList(pathId);
        this.showToast('success', `${projected}/${path.points.length} points projected to surface`);
        console.log('=== PROJECT COMPLETE ===');
    },

    /**
     * Select a path point
     */
    selectPathPoint(pathId, pointIndex) {
        PathAnimations.selectPoint(pathId, pointIndex);
        this.updatePathPointsList(pathId);
        this.showPointEditModal(pathId, pointIndex);
    },

    /**
     * Show point edit modal
     */
    showPointEditModal(pathId, pointIndex) {
        const path = PathAnimations.paths.find(p => p.id === pathId);
        if (!path || pointIndex < 0 || pointIndex >= path.points.length) return;

        const point = path.points[pointIndex];

        // Create a small overlay panel for point editing
        let panel = document.getElementById('point-edit-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'point-edit-panel';
            panel.className = 'point-edit-panel';
            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div class="point-edit-header">
                <h4>Point ${pointIndex + 1}</h4>
                <button onclick="UI.hidePointProperties()">×</button>
            </div>
            <div class="point-edit-content">
                <div class="prop-row">
                    <label>X</label>
                    <input type="number" id="point-x" value="${point.position.x.toFixed(2)}" step="0.1"
                           onchange="UI.updatePointPos('${pathId}', ${pointIndex}, 'x', this.value)">
                </div>
                <div class="prop-row">
                    <label>Y</label>
                    <input type="number" id="point-y" value="${point.position.y.toFixed(2)}" step="0.1"
                           onchange="UI.updatePointPos('${pathId}', ${pointIndex}, 'y', this.value)">
                </div>
                <div class="prop-row">
                    <label>Z</label>
                    <input type="number" id="point-z" value="${point.position.z.toFixed(2)}" step="0.1"
                           onchange="UI.updatePointPos('${pathId}', ${pointIndex}, 'z', this.value)">
                </div>
                <button class="btn btn-sm" onclick="UI.snapPointToGround('${pathId}', ${pointIndex})">📍 Snap to Ground</button>
                
                <hr style="margin: 12px 0; border-color: var(--border);">
                
                <div class="prop-row">
                    <label>Point Sound</label>
                    <input type="text" placeholder="Audio URL (optional)" value="${point.sound?.url || ''}"
                           onchange="UI.setPointSoundUrl('${pathId}', ${pointIndex}, this.value)">
                </div>
                <button class="btn btn-sm btn-danger" onclick="UI.deletePathPoint('${pathId}', ${pointIndex})">🗑 Delete Point</button>
            </div>
        `;

        panel.style.display = 'block';
    },

    /**
     * Hide point properties panel
     */
    hidePointProperties() {
        const panel = document.getElementById('point-edit-panel');
        if (panel) {
            panel.style.display = 'none';
        }
        // Only call deselectPoint if a point is currently selected (prevents circular calls)
        if (PathAnimations.selectedPointIndex !== null) {
            PathAnimations.deselectPoint();
        }
    },

    /**
     * Update point position from input
     */
    updatePointPos(pathId, pointIndex, axis, value) {
        PathAnimations.updatePointPosition(pathId, pointIndex, axis, value);
        this.updatePathPointsList(pathId);
    },

    /**
     * Update point position fields
     */
    updatePointPositionFields(position) {
        const xInput = document.getElementById('point-x');
        const yInput = document.getElementById('point-y');
        const zInput = document.getElementById('point-z');

        if (xInput) xInput.value = position.x.toFixed(2);
        if (yInput) yInput.value = position.y.toFixed(2);
        if (zInput) zInput.value = position.z.toFixed(2);
    },

    /**
     * Snap point to ground
     */
    snapPointToGround(pathId, pointIndex) {
        PathAnimations.snapPointToGround(pathId, pointIndex);
        this.updatePathPointsList(pathId);
        this.showToast('success', 'Point snapped to ground');
    },

    /**
     * Set point sound URL
     */
    setPointSoundUrl(pathId, pointIndex, url) {
        if (url) {
            PathAnimations.setPointSound(pathId, pointIndex, { source: 'url', url: url, volume: 0.8 });
        } else {
            PathAnimations.setPointSound(pathId, pointIndex, null);
        }
    },

    /**
     * Delete a path point
     */
    deletePathPoint(pathId, pointIndex) {
        PathAnimations.deletePoint(pathId, pointIndex);
        this.hidePointProperties();
    },

    /**
     * Move path point up
     */
    movePathPointUp(pathId, pointIndex) {
        PathAnimations.movePointUp(pathId, pointIndex);
    },

    /**
     * Move path point down
     */
    movePathPointDown(pathId, pointIndex) {
        PathAnimations.movePointDown(pathId, pointIndex);
    },

    /**
     * Update path property
     */
    updatePathProp(pathId, property, value) {
        PathAnimations.updatePathProperty(pathId, property, value);

        // Special handling for path type toggle
        if (property === 'pathType') {
            document.querySelectorAll('.path-type-option').forEach(opt => {
                opt.classList.toggle('selected', opt.querySelector('input').value === value);
            });
            document.getElementById('curve-tension-row').style.display = value === 'linear' ? 'none' : '';
        }
    },

    /**
     * Toggle force Y height for path points
     */
    toggleForceYHeight(pathId, enabled) {
        if (enabled) {
            PathAnimations.updatePathProperty(pathId, 'forceYHeight', 0);
        } else {
            PathAnimations.updatePathProperty(pathId, 'forceYHeight', undefined);
        }

        // Show/hide Y height input
        const row = document.getElementById('path-y-height-row');
        if (row) {
            row.style.display = enabled ? '' : 'none';
        }
    },

    /**
     * Quick move all points to Y value
     */
    quickMoveAllPointsY(pathId) {
        const path = PathAnimations.paths.find(p => p.id === pathId);
        if (!path || path.points.length === 0) {
            this.showToast('warning', 'No points to move');
            return;
        }

        const yInput = document.getElementById('quick-move-y');
        const newY = parseFloat(yInput?.value || 0);

        path.points.forEach(pt => {
            pt.position.y = newY;
        });

        PathAnimations.saveToState();
        PathAnimations.renderPath(pathId);
        this.updatePathPointsList(pathId);
        this.showToast('success', `All ${path.points.length} points moved to Y=${newY}`);
    },

    /**
     * Quick project all points to mesh surface
     */
    quickProjectToMesh(pathId) {
        const path = PathAnimations.paths.find(p => p.id === pathId);
        if (!path || path.points.length === 0) {
            this.showToast('warning', 'No points to project');
            return;
        }

        // Use the mesh assigned to the path for animation (mesh.id)
        const targetMeshId = path.mesh?.id;
        if (!targetMeshId) {
            this.showToast('warning', 'Select a Mesh in "Mesh Assignment" section first!');
            return;
        }

        const targetMeshData = Renderer.meshes?.get(targetMeshId);
        if (!targetMeshData || !targetMeshData.object) {
            this.showToast('error', 'Mesh not found in scene');
            return;
        }

        // Get all meshes to raycast against - but for ground, we need a DIFFERENT mesh
        // Let's use the first visible mesh that's NOT this one
        const groundMeshes = [];
        Renderer.meshes.forEach((data, id) => {
            if (id !== targetMeshId && data.object) {
                data.object.traverse(child => {
                    if (child.isMesh) groundMeshes.push(child);
                });
            }
        });

        if (groundMeshes.length === 0) {
            // Fall back to Y = 0
            path.points.forEach(pt => pt.position.y = 0);
            PathAnimations.saveToState();
            PathAnimations.renderPath(pathId);
            this.updatePathPointsList(pathId);
            this.showToast('info', 'No ground mesh found - points set to Y=0');
            return;
        }

        const raycaster = new THREE.Raycaster();
        let projected = 0;

        path.points.forEach(pt => {
            const origin = new THREE.Vector3(pt.position.x, 10000, pt.position.z);
            const direction = new THREE.Vector3(0, -1, 0);
            raycaster.set(origin, direction);

            const intersects = raycaster.intersectObjects(groundMeshes, true);
            if (intersects.length > 0) {
                pt.position.y = intersects[0].point.y;
                projected++;
            }
        });

        PathAnimations.saveToState();
        PathAnimations.renderPath(pathId);
        this.updatePathPointsList(pathId);
        this.showToast('success', `${projected}/${path.points.length} points snapped to ground!`);
    },

    /**
     * Update path mesh
     */
    updatePathMesh(pathId, meshId) {
        const mesh = State.getProject('meshes')?.find(m => m.id === meshId);
        PathAnimations.updatePathProperty(pathId, 'mesh.id', meshId);
        PathAnimations.updatePathProperty(pathId, 'mesh.filename', mesh?.filename || null);
    },

    /**
     * Update trigger type
     */
    updateTriggerType(pathId, type) {
        PathAnimations.updatePathProperty(pathId, 'trigger.type', type);
        PathAnimations.updatePathProperty(pathId, 'trigger.targetId', null);

        const row = document.getElementById('trigger-target-row');
        if (row) {
            row.style.display = (type === 'category' || type === 'point') ? '' : 'none';

            // Refresh the select options
            if (type === 'category' || type === 'point') {
                this.showPathProperties(pathId);
            }
        }
    },

    /**
     * Upload path sound
     */
    uploadPathSound(pathId, input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            PathAnimations.setPathSound(pathId, {
                enabled: true,
                source: 'file',
                data: e.target.result,
                url: ''
            });
            this.showToast('success', 'Sound uploaded');
        };
        reader.readAsDataURL(file);
    },

    /**
     * Test path sound
     */
    testPathSound(pathId) {
        const path = PathAnimations.paths.find(p => p.id === pathId);
        if (path?.pathSound) {
            PathAnimations.testSound(path.pathSound);
        }
    },

    /**
     * Preview path animation
     */
    previewPathAnimation(pathId) {
        PathAnimations.startPreview(pathId);
    },

    /**
     * Stop path preview
     */
    stopPathPreview() {
        PathAnimations.stopPreview();
        this.showToast('info', 'Preview stopped');
    },

    /**
     * Update loop status display
     */
    updateLoopStatus(isLooping) {
        const statusEl = document.querySelector('.path-loop-status');
        if (statusEl) {
            statusEl.innerHTML = `Loop Status: ${isLooping ? '🔄 Looping' : '➡️ Non-looping'} <span style="color: var(--text-secondary); font-size: 11px;">(auto-detected)</span>`;
        }
    },

    // Apply brightness to mesh materials (Helper)
    applyTextureBrightness(meshObj, brightnessPercent) {
        if (!meshObj) return;
        const intensity = brightnessPercent / 100;

        meshObj.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (!mat.userData.originalColor) {
                        mat.userData.originalColor = mat.color.clone();
                    }
                    mat.color.copy(mat.userData.originalColor).multiplyScalar(intensity);

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
    },
    // Folder Management
    createFolder(type, containerId) {
        // Create folder immediately with default name
        const id = Utils.generateId('folder');
        const existingFolders = State.getProject(type) || [];
        const folderNumber = existingFolders.length + 1;

        const folder = {
            id,
            name: `New Folder`,
            expanded: true,
            itemIds: []
        };

        State.addToProject(type, folder);
        this.updateHierarchy();
        this.showToast('success', 'Folder Created');

        // Trigger inline rename after creation
        setTimeout(() => {
            this.startInlineRename(id, type);
        }, 100);
    },

    toggleFolder(id, type) {
        const folder = State.findById(type, id);
        if (folder) {
            State.updateInProject(type, id, { expanded: !folder.expanded });
            this.updateHierarchy();
        }
    },

    // Start inline rename for folder
    startInlineRename(id, type) {
        const folderEl = document.querySelector(`.tree-folder[data-folder-id="${id}"] .tree-folder-name`);
        if (!folderEl) return;

        const currentName = folderEl.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'inline-rename-input';
        input.style.cssText = 'background: var(--bg-tertiary); border: 1px solid var(--accent-primary); color: var(--text-primary); padding: 2px 6px; border-radius: 4px; font-size: inherit; width: 100%;';

        folderEl.innerHTML = '';
        folderEl.appendChild(input);
        input.focus();
        input.select();

        const finishRename = () => {
            const newName = input.value.trim() || currentName;
            State.updateInProject(type, id, { name: newName });
            this.updateHierarchy();
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = currentName;
                input.blur();
            }
        });
    },

    showFolderContextMenu(e, id, type) {
        e.preventDefault();
        e.stopPropagation();

        // Create custom context menu
        const existingMenu = document.querySelector('.folder-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'folder-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 8px 0;
            min-width: 160px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
        `;

        const createMenuItem = (icon, text, action) => {
            const item = document.createElement('div');
            item.style.cssText = 'padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: var(--text-primary);';
            item.innerHTML = `<span>${icon}</span> ${text}`;
            item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-secondary)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');
            item.addEventListener('click', () => {
                menu.remove();
                action();
            });
            return item;
        };

        menu.appendChild(createMenuItem('✏️', 'Rename', () => {
            this.startInlineRename(id, type);
        }));

        menu.appendChild(createMenuItem('🗑️', 'Delete Folder', () => {
            // Move items to root before deleting
            const folder = State.findById(type, id);
            if (folder && folder.itemIds) {
                folder.itemIds.forEach(itemId => {
                    // Items are now orphaned (in root)
                });
            }
            State.removeFromProject(type, id);
            this.updateHierarchy();
            this.showToast('success', 'Folder Deleted');
        }));

        menu.appendChild(createMenuItem('📤', 'Ungroup All Items', () => {
            const folder = State.findById(type, id);
            if (folder) {
                State.updateInProject(type, id, { itemIds: [] });
                this.updateHierarchy();
                this.showToast('success', 'Items Ungrouped');
            }
        }));

        document.body.appendChild(menu);

        // Close menu on click outside
        const closeMenu = (evt) => {
            if (!menu.contains(evt.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    },

    // NOTE: setupFolderDragDrop is defined earlier in the file (around line 3728)
    // with proper multi-select support. Do not redefine it here!

    toggleBorderVisibility(id) {
        const borderGroup = Renderer.borders?.get(id);
        if (borderGroup) {
            borderGroup.visible = !borderGroup.visible;
            const btn = document.querySelector(`.tree-item[data-id="${id}"] .tree-item-visibility`);
            if (btn) {
                btn.innerHTML = borderGroup.visible ? '👁' : '🚫';
                btn.classList.toggle('visibility-off', !borderGroup.visible);
            }
        }
    },

    toggleFolderBordersVisibility(folderId) {
        const folders = State.getProject('borderFolders') || [];
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return;

        const anyVisible = folder.itemIds.some(id => {
            return Renderer.borders?.get(id)?.visible !== false;
        });
        const newState = !anyVisible;

        folder.itemIds.forEach(id => {
            const borderGroup = Renderer.borders?.get(id);
            if (borderGroup) {
                borderGroup.visible = newState;
                const btn = document.querySelector(`.tree-item[data-id="${id}"] .tree-item-visibility`);
                if (btn) {
                    btn.innerHTML = newState ? '👁' : '🚫';
                    btn.classList.toggle('visibility-off', !newState);
                }
            }
        });

        const folderBtn = document.querySelector(`.tree-folder[data-folder-id="${folderId}"] .tree-folder-header .tree-item-visibility`);
        if (folderBtn) {
            folderBtn.innerHTML = newState ? '👁' : '🚫';
            folderBtn.classList.toggle('visibility-off', !newState);
        }
    },

    applyBorderVisibilityOnLoad() {
        const borders = State.getProject('borders') || [];
        borders.forEach(border => {
            const borderGroup = Renderer.borders?.get(border.id);
            if (borderGroup && border.visibleOnLoad === false) {
                borderGroup.visible = false;
            }
        });
    },

};

// Export
window.UI = UI;







