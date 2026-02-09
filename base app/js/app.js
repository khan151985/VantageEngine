/* ========================================
   Sirah Maps - Main Application
   ======================================== */

// Global references
let Renderer = null;
let Controls = null;

// Application initialization
const App = {
    // Initialize application
    async init() {
        console.log('🗺️ Sirah Maps Initializing...');

        try {
            // Initialize IndexedDB for asset storage
            const idb = new IDBStorage();
            await idb.init();
            window.IDB = idb;

            // Create renderer
            const canvas = document.getElementById('three-canvas');
            Renderer = new MapRenderer(canvas);
            window.Renderer = Renderer;

            // Create controls
            Controls = new InteractionController(Renderer);
            window.Controls = Controls;

            // Initialize UI
            UI.init();

            // Initialize Points Manager
            PointsManager.init(Renderer);

            // Initialize Content Manager
            ContentManager.init();

            // Initialize Path Animations
            if (window.PathAnimations) {
                PathAnimations.init();
            }

            // Initialize AI
            AI.init();

            // Initialize Sound Manager
            const uiSounds = State.getProject('settings.uiSounds');
            SoundManager.init(uiSounds);

            // Set initial mode
            State.setMode('admin');
            State.setTool('select');

            // Update hierarchy
            UI.updateHierarchy();

            // Setup file input handlers
            this.setupFileInputs();

            // Setup drag and drop
            this.setupDragDrop();

            // Hide loading screen
            await this.hideLoadingScreen();

            // Show app
            document.getElementById('app').style.display = '';

            // Check for saved project
            this.checkAutoSave();

            console.log('✅ Sirah Maps Ready');

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showError(error);
        }
    },

    // Hide loading screen with animation
    async hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');

        // Update progress to 100%
        const progress = loadingScreen.querySelector('.loader-progress');
        if (progress) {
            progress.style.width = '100%';
            progress.style.animation = 'none';
        }

        const text = loadingScreen.querySelector('.loader-text');
        if (text) {
            text.textContent = 'Ready!';
        }

        // Wait a moment then fade out
        await Utils.wait(500);
        loadingScreen.classList.add('hidden');

        // Remove after animation
        await Utils.wait(500);
        loadingScreen.remove();
    },

    // Setup file input handlers
    setupFileInputs() {
        // Mesh file input - handled by UI.showAddMeshModal()
        // We just need to reset the input value after use

        // Image file input
        document.getElementById('file-image').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && State.state.selected.type === 'textbox') {
                await ContentManager.addMediaToTextbox(State.state.selected.id, 'image', file);
                UI.showToast('success', 'Image Added');
            }
            e.target.value = '';
        });

        // Video file input
        document.getElementById('file-video').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (State.state.selected.type === 'textbox') {
                    await ContentManager.addMediaToTextbox(State.state.selected.id, 'video', file);
                } else {
                    await ContentManager.addMedia(file, 'video');
                }
                UI.showToast('success', 'Video Added', file.name);
            }
            e.target.value = '';
        });

        // Audio file input
        document.getElementById('file-audio').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (State.state.selected.type === 'textbox') {
                    await ContentManager.addMediaToTextbox(State.state.selected.id, 'audio', file);
                } else {
                    await ContentManager.addMedia(file, 'audio');
                }
                UI.showToast('success', 'Audio Added', file.name);
            }
            e.target.value = '';
        });

        // Panorama file input
        document.getElementById('file-panorama').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await ContentManager.addMedia(file, 'panorama');
                UI.showToast('success', 'Panorama Added', file.name);
            }
            e.target.value = '';
        });

        // Project file input
        document.getElementById('file-project').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await Utils.readFileAsText(file);
                    const data = JSON.parse(text);
                    await this.loadProject(data);
                    UI.showToast('success', 'Project Loaded', file.name);
                } catch (err) {
                    UI.showToast('error', 'Load Error', err.message);
                }
            }
            e.target.value = '';
        });

        // Textbox media buttons - Per-language image uploads
        document.querySelectorAll('.lang-image-add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                const fileInput = document.querySelector(`.lang-image-file[data-lang="${lang}"]`);
                if (fileInput) fileInput.click();
            });
        });

        // Handle per-language image file selection
        document.querySelectorAll('.lang-image-file').forEach(fileInput => {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                const lang = fileInput.dataset.lang;
                if (file && State.state.selected.type === 'textbox') {
                    await ContentManager.addMediaToTextbox(State.state.selected.id, 'image', file, lang);
                    UI.showToast('success', `Image Added (${lang.toUpperCase()})`);
                    UI.updateLangImagePreview(lang);
                }
                e.target.value = '';
            });
        });

        // Handle per-language image remove buttons
        document.querySelectorAll('.lang-image-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                UI.removeLangImage(lang);
            });
        });

        document.getElementById('textbox-add-video')?.addEventListener('click', () => {
            document.getElementById('file-video').click();
        });

        document.getElementById('textbox-add-audio')?.addEventListener('click', () => {
            document.getElementById('file-audio').click();
        });
    },

    // Setup drag and drop for files
    setupDragDrop() {
        const viewport = document.getElementById('viewport');

        // Create drag indicator
        const dragIndicator = document.createElement('div');
        dragIndicator.className = 'drag-indicator hidden';
        dragIndicator.innerHTML = `
            <div class="drag-indicator-content">
                <div class="drag-indicator-icon">📦</div>
                <div class="drag-indicator-text">Drop to add 3D model</div>
            </div>
        `;
        document.body.appendChild(dragIndicator);

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Handle drag enter/over
        document.body.addEventListener('dragenter', (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                dragIndicator.classList.remove('hidden');
            }
        });

        document.body.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget || e.relatedTarget === document.body) {
                dragIndicator.classList.add('hidden');
            }
        });

        // Handle drop
        document.body.addEventListener('drop', async (e) => {
            dragIndicator.classList.add('hidden');

            const files = Array.from(e.dataTransfer.files);

            for (const file of files) {
                // Check file type
                if (Loader.isFormatSupported(file.name)) {
                    await UI.loadMeshFile(file);
                } else if (Utils.isImage(file.name)) {
                    if (State.state.selected.type === 'textbox') {
                        await ContentManager.addMediaToTextbox(State.state.selected.id, 'image', file);
                    } else {
                        await ContentManager.addMedia(file, 'image');
                    }
                    UI.showToast('success', 'Image Added', file.name);
                } else if (Utils.isVideo(file.name)) {
                    await ContentManager.addMedia(file, 'video');
                    UI.showToast('success', 'Video Added', file.name);
                } else if (Utils.isAudio(file.name)) {
                    await ContentManager.addMedia(file, 'audio');
                    UI.showToast('success', 'Audio Added', file.name);
                } else {
                    UI.showToast('warning', 'Unsupported File', `Cannot import ${file.name}`);
                }
            }
        });
    },

    // Load project data
    async loadProject(data) {
        // Clear current scene
        Renderer.meshes.forEach((_, id) => Renderer.removeMesh(id));
        Renderer.pointSprites.forEach((_, id) => Renderer.removePoint(id));

        // Load project state
        State.loadProject(data);

        // Load meshes from stored base64 data
        for (const meshData of data.meshes) {
            if (meshData.fileData) {
                try {
                    console.log('Loading mesh from saved data:', meshData.name);

                    // Convert base64 back to file
                    const mimeType = meshData.filename.endsWith('.glb') ? 'model/gltf-binary' : 'model/gltf+json';
                    const file = UI.base64ToFile(meshData.fileData, meshData.filename, mimeType);

                    // Load and add to scene
                    const result = await Renderer.loadAndAddModel(file, meshData.id, meshData);
                    console.log('Mesh loaded successfully:', meshData.name);
                } catch (err) {
                    console.error(`Failed to load mesh ${meshData.name}:`, err);
                    UI.showToast('error', 'Mesh Load Failed', meshData.name);
                }
            }
        }

        // Load points
        for (const point of data.points) {
            await Renderer.addPoint(point.id, point);
        }

        // Load borders
        if (data.borders && Array.isArray(data.borders)) {
            data.borders.forEach(border => {
                if (Renderer.addBorder) Renderer.addBorder(border);
            });
        }

        // Apply settings
        if (data.settings.backgroundColor) {
            Renderer.setBackgroundColor(data.settings.backgroundColor);
        }

        // Go to initial view if set
        if (data.settings.initialView) {
            Renderer.goToView(data.settings.initialView);
        }

        // Update UI
        UI.updateHierarchy();

        // Load point marker mesh if configured
        const settings = data.settings || {};
        if (settings.pointMarkerMesh && settings.pointMarkerMesh.data && settings.pointMarkerMesh.enabled !== false) {
            try {
                await Renderer.loadPointMarkerMesh();
                console.log('Point marker mesh loaded from project');
            } catch (err) {
                console.warn('Failed to load point marker mesh:', err);
            }
        }
    },

    // Auto-save check
    async checkAutoSave() {
        // Clear legacy localStorage autosave to free space
        if (Storage.get('autosave')) {
            Storage.remove('autosave');
        }

        try {
            // Check IndexedDB
            const savedState = await window.IDB.get('projects', 'autosave');
            if (savedState && savedState.data) {
                UI.showConfirm(
                    'Restore Auto-Save?',
                    'An auto-saved project was found. Would you like to restore it?',
                    async () => {
                        await this.loadProject(savedState.data);
                        UI.showToast('success', 'Auto-Save Restored');
                    },
                    async () => {
                        await window.IDB.delete('projects', 'autosave');
                    }
                );
            }
        } catch (error) {
            console.warn('Autosave check failed:', error);
        }

        // Setup auto-save interval
        setInterval(async () => {
            const meshCount = State.getProject('meshes').length;
            const pointCount = State.getProject('points').length;

            if (meshCount > 0 || pointCount > 0) {
                try {
                    const projectData = State.exportProject();
                    await window.IDB.put('projects', {
                        id: 'autosave',
                        timestamp: Date.now(),
                        data: projectData
                    });
                } catch (e) {
                    console.warn('Autosave failed:', e);
                }
            }
        }, 60000); // Every minute
    },

    // Show error screen
    showError(error) {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div class="loader-content">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <h2 style="margin-bottom: 10px;">Initialization Error</h2>
                    <p style="color: var(--text-secondary);">${error.message}</p>
                    <button onclick="location.reload()" style="
                        margin-top: 20px;
                        padding: 10px 24px;
                        background: var(--accent-primary);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Reload</button>
                </div>
            `;
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Handle beforeunload
window.addEventListener('beforeunload', (e) => {
    // Note: Cannot reliably save to IndexedDB during unload as it requires async
    // Relying on periodic autosave instead
});

// Export
window.App = App;
