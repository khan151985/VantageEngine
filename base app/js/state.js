/* ========================================
   Sirah Maps - State Management
   ======================================== */

// Application State
const AppState = {
    // Mode
    mode: 'admin', // 'admin' or 'preview'
    theme: 'dark', // 'dark' or 'light'

    // Current selection
    selected: {
        type: null, // 'mesh', 'point', 'textbox', 'camera', etc.
        id: null
    },

    // Active tool
    activeTool: 'select', // 'select', 'move', 'rotate', 'add-point', 'measure'

    // UI state
    ui: {
        leftPanelTab: 'hierarchy',
        showGrid: true,
        showPoints: true,
        showGizmos: true,
        fullscreen: false,
        visibleCategories: [],
        showAllPoints: true
    },

    // Camera state
    camera: {
        position: { x: 50, y: 50, z: 50 },
        target: { x: 0, y: 0, z: 0 },
        fov: 59,
        minDistance: 10,
        maxDistance: 500,
        minPolarAngle: 10,
        maxPolarAngle: 80
    },

    // Current language
    currentLanguage: 'en',

    // Loading states
    loading: {
        app: true,
        mesh: false,
        export: false
    },

    // Measurement state
    measurement: {
        active: false,
        points: [],
        distance: null
    }
};

// Project Data
const ProjectData = {
    // Project metadata
    meta: {
        id: Utils.generateId('project'),
        name: 'Untitled Project',
        subtitle: '',
        thumbnail: null,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: '1.0.0'
    },

    // Settings
    settings: {
        // Scale/Measurement
        scale: {
            factor: 1,           // 1 internal unit = X real units
            unit: 'meters',      // 'meters' or 'feet'
            gridSize: 10         // Grid square size in real units
        },

        // Default camera view (set by user)
        defaultView: null,       // { position, target, zoom } - for PC/Desktop
        defaultViewMobile: null, // { position, target, zoom } - for Mobile devices

        // Background
        backgroundColor: '#1a1a1a',

        // Global Typography
        typography: {
            primaryFont: 'Inter',
            headingFont: 'Inter',
            baseFontSize: 16,
            rtlSupport: false,
            customFonts: []      // [{ name: 'MyFont', data: base64 }]
        },

        // Global Colors
        colors: {
            primary: '#00C8FF',
            secondary: '#7B61FF',
            accent: '#00C8FF',
            text: '#ffffff',
            textSecondary: '#a0a0a0',
            background: '#1a1a1a'
        },

        // Global Textbox Defaults
        textboxDefaults: {
            headerBackground: '#00C8FF',
            headerTextColor: '#ffffff',
            bodyBackground: '#2a2a2a',
            bodyTextColor: '#ffffff',
            borderRadius: 12
        },

        // Global Menu Style
        menuStyle: {
            background: 'rgba(26, 26, 26, 0.95)',
            textColor: '#ffffff',
            hoverColor: '#00C8FF',
            submenuBackground: 'rgba(40, 40, 40, 0.98)'
        },

        // UI Sounds settings
        uiSounds: {
            enabled: true,
            volume: 0.5,
            assignments: {
                buttonClick: 'click1',
                menuOpen: 'whoosh',
                menuClose: 'subtle',
                pointSelect: 'pop',
                popupOpen: 'chime',
                popupClose: 'subtle',
                toggleSwitch: 'click1'
            }
        },

        // Branding
        companyLogo: null,           // base64 image data
        loadingLogo: null,           // base64 image data for loading screen

        // Camera Bounds (invisible collision volume)
        cameraBounds: {
            enabled: false,
            // Bounding box min/max corners
            min: { x: -50, y: -10, z: -50 },
            max: { x: 50, y: 50, z: 50 },
            // Additional constraints
            minDistance: 5,          // Minimum zoom distance
            maxDistance: 200         // Maximum zoom distance
        },

        // Point Marker 3D Mesh (flag/banner shown on point click)
        pointMarkerMesh: {
            enabled: true,           // Whether 3D mesh feature is enabled globally
            filename: null,          // Original filename
            data: null,              // Base64 GLB data
            scale: { x: 1, y: 1, z: 1 },
            offset: { x: 0, y: 0, z: 0 },  // Offset from point position
            animationDuration: 500   // Animation duration in ms
        }
    },

    // Languages
    languages: [
        { code: 'en', name: 'English', isDefault: true }
    ],

    // 3D Meshes
    meshes: [
        // {
        //     id: 'mesh_xxx',
        //     name: 'Model Name',
        //     filename: 'model.glb',
        //     data: null, // Base64 or blob reference
        //     position: { x: 0, y: 0, z: 0 },
        //     rotation: { x: 0, y: 0, z: 0 },
        //     scale: { x: 1, y: 1, z: 1 },
        //     animations: [],
        //     animationSettings: {
        //         clip: null,
        //         mode: 'loop',
        //         autoPlay: true,
        //         speed: 1
        //     }
        // }
    ],

    // Mesh Folders
    meshFolders: [
        // {
        //     id: 'folder_xxx',
        //     name: 'Folder Name',
        //     expanded: true,
        //     itemIds: [] // Array of mesh IDs in this folder
        // }
    ],

    // Point Folders
    pointFolders: [
        // {
        //     id: 'folder_xxx',
        //     name: 'Folder Name',
        //     expanded: true,
        //     itemIds: [] // Array of point IDs in this folder
        // }
    ],

    // Textbox Folders
    textboxFolders: [
        // {
        //     id: 'folder_xxx',
        //     name: 'Folder Name',
        //     expanded: true,
        //     itemIds: [] // Array of textbox IDs in this folder
        // }
    ],

    // Border Folders
    borderFolders: [],

    // Menu Categories
    categories: [
        // {
        //     id: 'cat_xxx',
        //     name: 'Category Name',
        //     icon: '🏠',
        //     color: '#00C8FF',
        //     order: 0
        // }
    ],

    // Action Buttons (Content Triggers)
    actionButtons: [
        // {
        //     id: 'action_xxx',
        //     name: 'Button Name',
        //     names: { en: 'Name', ar: 'اسم' },
        //     icon: '▶',
        //     placement: 'standalone',      // 'standalone' or 'category'
        //     categoryId: null,             // if placement is 'category'
        //     contentType: 'textbox',       // 'textbox', 'image', 'video', 'audio', 'link'
        //     contentId: null,              // ID of linked content (textbox, media)
        //     content: {                    // Or inline content
        //         image: null,              // base64 image data
        //         video: null,              // base64 or URL
        //         audio: null,              // base64 or URL
        //         link: null                // external URL
        //     }
        // }
    ],

    // Custom Borders
    borders: [
        // {
        //     id: 'border_xxx',
        //     name: 'Border Name',
        //     points: [ {x,y,z}, ... ], // Polygon vertices
        //     color: '#FFFF00',
        //     width: 5,
        //     visible: true
        // }
    ],

    // Interactable Points
    points: [
        // {
        //     id: 'point_xxx',
        //     name: 'Point Name',
        //     categoryId: 'cat_xxx',
        //     contentId: 'textbox_xxx',
        //     contentType: 'textbox', // 'textbox', 'video', 'audio', 'panorama'
        //     position: { x: 0, y: 0, z: 0 },
        //     type: '2d', // '2d' or '3d'
        //     lifted: false,
        //     liftHeight: 5,
        //     cameraView: null,
        //     show3DMesh: true,  // Whether to show 3D marker mesh on click
        //     meshScale: 1,      // Scale multiplier for 3D marker mesh (1 = default)
        //     meshRotation: 0,   // Y-axis rotation in degrees (default: 0)
        //     style: {
        //         icon: 'default',
        //         color: '#00C8FF',
        //         scale: 1
        //     }
        // }
    ],

    // Text Boxes
    textboxes: [
        // {
        //     id: 'textbox_xxx',
        //     content: {
        //         'en': {
        //             heading: 'Title',
        //             body: 'Content...'
        //         }
        //     },
        //     media: {
        //         image: null,
        //         video: null,
        //         audio: {
        //             'en': null
        //         }
        //     }
        // }
    ],

    // Media files
    media: [
        // {
        //     id: 'media_xxx',
        //     type: 'video', // 'video', 'audio', 'panorama', 'image'
        //     name: 'Video Name',
        //     filename: 'video.mp4',
        //     data: null
        // }
    ],

    // Saved camera views
    views: [
        // {
        //     id: 'view_xxx',
        //     name: 'View 1',
        //     position: { x: 0, y: 0, z: 0 },
        //     target: { x: 0, y: 0, z: 0 },
        //     fov: 59
        // }
    ]
};

// State Manager
class StateManager extends EventEmitter {
    constructor() {
        super();
        this.state = AppState;
        this.project = ProjectData;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
    }

    // Get state value
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    // Set state value
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => obj[key], this.state);
        const oldValue = target[lastKey];
        target[lastKey] = value;
        this.emit('stateChange', { path, value, oldValue });
        return value;
    }

    // Get project data
    getProject(path) {
        if (!path) return this.project;
        return path.split('.').reduce((obj, key) => obj?.[key], this.project);
    }

    // Set project data with undo support
    setProject(path, value, recordHistory = true) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => obj[key], this.project);
        const oldValue = Utils.deepClone(target[lastKey]);

        if (recordHistory) {
            this.recordHistory({
                type: 'set',
                path,
                oldValue,
                newValue: Utils.deepClone(value)
            });
        }

        target[lastKey] = value;
        this.project.meta.modified = new Date().toISOString();
        this.emit('projectChange', { path, value, oldValue });
        return value;
    }

    // Add item to array in project
    addToProject(path, item, recordHistory = true) {
        const array = this.getProject(path);
        if (!Array.isArray(array)) {
            console.error(`Path ${path} is not an array`);
            return null;
        }

        if (recordHistory) {
            this.recordHistory({
                type: 'add',
                path,
                item: Utils.deepClone(item)
            });
        }

        array.push(item);
        this.project.meta.modified = new Date().toISOString();
        this.emit('projectChange', { path, action: 'add', item });
        return item;
    }

    // Remove item from array in project
    removeFromProject(path, id, recordHistory = true) {
        const array = this.getProject(path);
        if (!Array.isArray(array)) {
            console.error(`Path ${path} is not an array`);
            return null;
        }

        const index = array.findIndex(item => item.id === id);
        if (index === -1) return null;

        const item = array[index];

        if (recordHistory) {
            this.recordHistory({
                type: 'remove',
                path,
                item: Utils.deepClone(item),
                index
            });
        }

        array.splice(index, 1);
        this.project.meta.modified = new Date().toISOString();
        this.emit('projectChange', { path, action: 'remove', id, item });
        return item;
    }

    // Update item in array
    updateInProject(path, id, updates, recordHistory = true) {
        const array = this.getProject(path);
        if (!Array.isArray(array)) {
            console.error(`Path ${path} is not an array`);
            return null;
        }

        const item = array.find(item => item.id === id);
        if (!item) return null;

        const oldItem = Utils.deepClone(item);

        if (recordHistory) {
            this.recordHistory({
                type: 'update',
                path,
                id,
                oldItem,
                updates: Utils.deepClone(updates)
            });
        }

        Object.assign(item, updates);
        this.project.meta.modified = new Date().toISOString();
        this.emit('projectChange', { path, action: 'update', id, item, updates });
        return item;
    }

    // Find item by ID
    findById(path, id) {
        const array = this.getProject(path);
        if (!Array.isArray(array)) return null;
        return array.find(item => item.id === id);
    }

    // Record history for undo/redo
    recordHistory(action) {
        // Remove any future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(action);

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this.emit('historyChange', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    }

    // Check if can undo
    canUndo() {
        return this.historyIndex >= 0;
    }

    // Check if can redo
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    // Undo last action
    undo() {
        if (!this.canUndo()) return false;

        const action = this.history[this.historyIndex];
        this.historyIndex--;

        switch (action.type) {
            case 'set':
                this.setProject(action.path, action.oldValue, false);
                break;
            case 'add':
                const addArray = this.getProject(action.path);
                const addIndex = addArray.findIndex(item => item.id === action.item.id);
                if (addIndex !== -1) addArray.splice(addIndex, 1);
                break;
            case 'remove':
                const removeArray = this.getProject(action.path);
                removeArray.splice(action.index, 0, action.item);
                break;
            case 'update':
                const item = this.findById(action.path, action.id);
                if (item) Object.assign(item, action.oldItem);
                break;
        }

        this.emit('undo', action);
        this.emit('historyChange', { canUndo: this.canUndo(), canRedo: this.canRedo() });
        return true;
    }

    // Redo last undone action
    redo() {
        if (!this.canRedo()) return false;

        this.historyIndex++;
        const action = this.history[this.historyIndex];

        switch (action.type) {
            case 'set':
                this.setProject(action.path, action.newValue, false);
                break;
            case 'add':
                const addArray = this.getProject(action.path);
                addArray.push(action.item);
                break;
            case 'remove':
                const removeArray = this.getProject(action.path);
                const removeIndex = removeArray.findIndex(item => item.id === action.item.id);
                if (removeIndex !== -1) removeArray.splice(removeIndex, 1);
                break;
            case 'update':
                const item = this.findById(action.path, action.id);
                if (item) Object.assign(item, action.updates);
                break;
        }

        this.emit('redo', action);
        this.emit('historyChange', { canUndo: this.canUndo(), canRedo: this.canRedo() });
        return true;
    }

    // Select item
    select(type, id) {
        this.state.selected = { type, id };
        this.emit('selectionChange', { type, id });
    }

    // Clear selection
    clearSelection() {
        this.state.selected = { type: null, id: null };
        this.emit('selectionChange', { type: null, id: null });
    }

    // Set active tool
    setTool(tool) {
        this.state.activeTool = tool;
        this.emit('toolChange', tool);
    }

    // Toggle UI state
    toggleUI(key) {
        this.state.ui[key] = !this.state.ui[key];
        this.emit('uiChange', { key, value: this.state.ui[key] });
        return this.state.ui[key];
    }

    // Set theme
    setTheme(theme) {
        this.state.theme = theme;
        document.body.className = `theme-${theme}`;
        Storage.set('theme', theme);
        this.emit('themeChange', theme);
    }

    // Set mode
    setMode(mode) {
        this.state.mode = mode;
        document.body.classList.toggle('admin-mode', mode === 'admin');
        document.body.classList.toggle('preview-mode', mode === 'preview');
        this.emit('modeChange', mode);
    }

    // Set language
    setLanguage(langCode) {
        this.state.currentLanguage = langCode;
        this.emit('languageChange', langCode);
    }

    // New project
    newProject() {
        this.project = {
            meta: {
                id: Utils.generateId('project'),
                name: 'Untitled Project',
                subtitle: '',
                thumbnail: null,
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                version: '1.0.0'
            },
            settings: {
                worldUnit: 100,
                worldUnitType: 'meters',
                initialView: null,
                backgroundColor: '#1a1a1a'
            },
            languages: [
                { code: 'en', name: 'English', isDefault: true }
            ],
            meshes: [],
            categories: [],
            points: [],
            textboxes: [],
            pathAnimations: [],
            media: [],
            views: []
        };

        this.history = [];
        this.historyIndex = -1;
        this.clearSelection();
        this.emit('projectNew');
    }

    // Load project from JSON
    loadProject(data) {
        // Ensure settings has all required properties with defaults
        const defaultSettings = {
            scale: { factor: 1, unit: 'meters', gridSize: 10 },
            defaultView: null,
            defaultViewMobile: null,
            backgroundColor: '#1a1a1a',
            typography: {
                primaryFont: 'Inter',
                headingFont: 'Inter',
                baseFontSize: 16,
                rtlSupport: false,
                customFonts: []
            },
            colors: {
                primary: '#00C8FF',
                secondary: '#7B61FF',
                accent: '#00C8FF',
                text: '#ffffff',
                textSecondary: '#a0a0a0',
                background: '#1a1a1a'
            },
            textboxDefaults: {
                headerBackground: '#00C8FF',
                headerTextColor: '#ffffff',
                bodyBackground: '#2a2a2a',
                bodyTextColor: '#ffffff',
                borderRadius: 12
            },
            menuStyle: {
                background: 'rgba(26, 26, 26, 0.95)',
                textColor: '#ffffff',
                hoverColor: '#00C8FF',
                submenuBackground: 'rgba(40, 40, 40, 0.98)'
            },
            uiSounds: {
                enabled: true,
                volume: 0.5,
                assignments: {
                    buttonClick: 'click1',
                    menuOpen: 'whoosh',
                    menuClose: 'subtle',
                    pointSelect: 'pop',
                    popupOpen: 'chime',
                    popupClose: 'subtle',
                    toggleSwitch: 'click1'
                }
            },
            companyLogo: null,
            loadingLogo: null,
            cameraBounds: {
                enabled: false,
                min: { x: -50, y: -10, z: -50 },
                max: { x: 50, y: 50, z: 50 },
                minDistance: 5,
                maxDistance: 200
            },
            pointMarkerMesh: {
                enabled: true,
                filename: null,
                data: null,
                scale: { x: 1, y: 1, z: 1 },
                offset: { x: 0, y: 0, z: 0 },
                animationDuration: 500
            }
        };


        // Merge loaded settings with defaults
        data.settings = { ...defaultSettings, ...data.settings };

        // Initialize folder arrays if they don't exist (backward compatibility)
        if (!data.meshFolders) data.meshFolders = [];
        if (!data.pointFolders) data.pointFolders = [];
        if (!data.textboxFolders) data.textboxFolders = [];
        if (!data.borderFolders) data.borderFolders = [];

        // Initialize pathAnimations if it doesn't exist (backward compatibility)
        if (!data.pathAnimations) data.pathAnimations = [];

        // Initialize borders if it doesn't exist
        if (!data.borders) data.borders = [];

        this.project = data;
        this.history = [];
        this.historyIndex = -1;
        this.clearSelection();
        this.emit('projectLoad', data);
    }

    // Export project to JSON
    exportProject() {
        return Utils.deepClone(this.project);
    }

    // Save current camera as view
    saveView(name) {
        const view = {
            id: Utils.generateId('view'),
            name: name || `View ${this.project.views.length + 1}`,
            position: Utils.deepClone(this.state.camera.position),
            target: Utils.deepClone(this.state.camera.target),
            fov: this.state.camera.fov
        };

        this.addToProject('views', view);
        return view;
    }
}

// Create global state instance
const State = new StateManager();

// Initialize theme from storage
const savedTheme = Storage.get('theme', 'dark');
document.body.className = `theme-${savedTheme}`;
State.state.theme = savedTheme;

// Export for use in other modules
window.State = State;
window.AppState = AppState;
window.ProjectData = ProjectData;
