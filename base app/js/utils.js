/* ========================================
   Sirah Maps - Utility Functions
   ======================================== */

const Utils = {
    // Generate unique ID
    generateId: (prefix = 'id') => {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    // Deep clone object
    deepClone: (obj) => {
        if (obj === undefined) return undefined;
        return JSON.parse(JSON.stringify(obj));
    },

    // Debounce function
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle: (func, limit) => {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Format file size
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Format duration
    formatDuration: (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // Get file extension
    getFileExtension: (filename) => {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
    },

    // Check if file is valid 3D model
    isValid3DModel: (filename) => {
        const validExtensions = ['fbx', 'obj', 'glb', 'gltf'];
        return validExtensions.includes(Utils.getFileExtension(filename));
    },

    // Check if file is image
    isImage: (filename) => {
        const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        return validExtensions.includes(Utils.getFileExtension(filename));
    },

    // Check if file is video
    isVideo: (filename) => {
        const validExtensions = ['mp4', 'webm', 'ogg', 'mov'];
        return validExtensions.includes(Utils.getFileExtension(filename));
    },

    // Check if file is audio
    isAudio: (filename) => {
        const validExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
        return validExtensions.includes(Utils.getFileExtension(filename));
    },

    // Clamp value between min and max
    clamp: (value, min, max) => {
        return Math.min(Math.max(value, min), max);
    },

    // Linear interpolation
    lerp: (start, end, t) => {
        return start + (end - start) * t;
    },

    // Degrees to radians
    degToRad: (degrees) => {
        return degrees * (Math.PI / 180);
    },

    // Radians to degrees
    radToDeg: (radians) => {
        return radians * (180 / Math.PI);
    },

    // Check if point is inside rectangle
    pointInRect: (x, y, rect) => {
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    },

    // Get mouse position relative to element
    getRelativeMousePos: (event, element) => {
        const rect = element.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    },

    // Download blob as file
    downloadBlob: (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Download JSON as file
    downloadJSON: (data, filename) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        Utils.downloadBlob(blob, filename);
    },

    // Read file as data URL
    readFileAsDataURL: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // Read file as array buffer
    readFileAsArrayBuffer: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    // Read file as text
    readFileAsText: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    // Get language direction
    getTextDirection: (langCode) => {
        const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
        return rtlLanguages.includes(langCode) ? 'rtl' : 'ltr';
    },

    // Get language name
    getLanguageName: (code) => {
        const languages = {
            'en': 'English',
            'ar': 'العربية',
            'ur': 'اردو',
            'fr': 'Français',
            'de': 'Deutsch',
            'es': 'Español',
            'tr': 'Türkçe',
            'id': 'Bahasa Indonesia',
            'ms': 'Bahasa Melayu',
            'bn': 'বাংলা',
            'hi': 'हिन्दी',
            'zh': '中文',
            'ja': '日本語',
            'ko': '한국어',
            'ru': 'Русский',
            'pt': 'Português',
            'it': 'Italiano',
            'nl': 'Nederlands',
            'pl': 'Polski',
            'th': 'ไทย',
            'vi': 'Tiếng Việt'
        };
        return languages[code] || code.toUpperCase();
    },

    // Simple hash function for strings
    hashString: (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    },

    // Copy text to clipboard
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } catch (e) {
                document.body.removeChild(textarea);
                return false;
            }
        }
    },

    // Parse color to RGB object
    parseColor: (color) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2] };
    },

    // RGB to hex
    rgbToHex: (r, g, b) => {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    },

    // Hex to RGB
    hexToRgb: (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    // Check if device is mobile
    isMobile: () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Check if device supports touch
    isTouchDevice: () => {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    // Request fullscreen
    requestFullscreen: (element) => {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    },

    // Exit fullscreen
    exitFullscreen: () => {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    },

    // Check if fullscreen
    isFullscreen: () => {
        return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    },

    // Estimate memory usage
    getMemoryUsage: () => {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    },

    // Create element with attributes
    createElement: (tag, attributes = {}, children = []) => {
        const element = document.createElement(tag);
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('data')) {
                element.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.substring(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        return element;
    },

    // Wait for specified milliseconds
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // Retry function with exponential backoff
    retry: async (fn, maxAttempts = 3, delay = 1000) => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts) throw error;
                await Utils.wait(delay * attempt);
            }
        }
    },

    // Remove diacritics/special characters for searchable text
    // Converts "Ḥirāʾ" → "Hira", "Ṣiddīq" → "Siddiq", etc.
    removeDiacritics: (text) => {
        if (!text) return '';

        // Comprehensive mapping for Arabic transliteration characters
        const diacriticsMap = {
            // Vowels with macrons (long vowels)
            'ā': 'a', 'Ā': 'A', 'ī': 'i', 'Ī': 'I', 'ū': 'u', 'Ū': 'U',
            'ē': 'e', 'Ē': 'E', 'ō': 'o', 'Ō': 'O',

            // Consonants with dots below
            'ḥ': 'h', 'Ḥ': 'H', 'ṣ': 's', 'Ṣ': 'S', 'ḍ': 'd', 'Ḍ': 'D',
            'ṭ': 't', 'Ṭ': 'T', 'ẓ': 'z', 'Ẓ': 'Z', 'ḏ': 'd', 'Ḏ': 'D',
            'ṯ': 't', 'Ṯ': 'T', 'ḡ': 'g', 'Ḡ': 'G',

            // Ayn and hamza
            '\u02bf': '', '\u02be': '', '\u2018': '', '\u2019': '', '\u02bb': '', '\u02bc': '',

            // Other special characters
            'ñ': 'n', 'Ñ': 'N', 'ç': 'c', 'Ç': 'C',
            'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G',

            // Common accented vowels
            'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a',
            'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
            'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
            'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
            'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
            'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A', 'Ã': 'A',
            'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
            'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
            'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ö': 'O', 'Õ': 'O',
            'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U'
        };

        let result = text;
        for (const [char, replacement] of Object.entries(diacriticsMap)) {
            result = result.split(char).join(replacement);
        }

        // Also use normalize to handle any remaining combining diacritics
        result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        return result;
    },

    // Generate search tags from a name (removes diacritics and creates searchable version)
    generateSearchTag: (name) => {
        if (!name) return '';
        return Utils.removeDiacritics(name).toLowerCase().trim();
    }
};

// Event Emitter class
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => callback(...args));
    }

    once(event, callback) {
        const unsubscribe = this.on(event, (...args) => {
            unsubscribe();
            callback(...args);
        });
        return unsubscribe;
    }
}

// Storage helper with fallback
const Storage = {
    prefix: 'sirah_',

    set: (key, value) => {
        try {
            localStorage.setItem(Storage.prefix + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('localStorage not available:', e);
            return false;
        }
    },

    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(Storage.prefix + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },

    remove: (key) => {
        try {
            localStorage.removeItem(Storage.prefix + key);
            return true;
        } catch (e) {
            return false;
        }
    },

    clear: () => {
        try {
            Object.keys(localStorage)
                .filter(key => key.startsWith(Storage.prefix))
                .forEach(key => localStorage.removeItem(key));
            return true;
        } catch (e) {
            return false;
        }
    }
};

// IndexedDB helper for large file storage
class IDBStorage {
    constructor(dbName = 'SirahMapsDB', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            try {
                if (!window.indexedDB) {
                    console.warn('IndexedDB not supported');
                    resolve(null);
                    return;
                }

                const request = indexedDB.open(this.dbName, this.version);

                request.onerror = () => {
                    console.warn('Failed to open IndexedDB (possibly due to sandbox/private mode):', request.error);
                    resolve(null); // Resolve with null instead of rejecting to prevent app crash
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    resolve(this.db);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    // Create stores
                    if (!db.objectStoreNames.contains('assets')) {
                        db.createObjectStore('assets', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('projects')) {
                        db.createObjectStore('projects', { keyPath: 'id' });
                    }
                };
            } catch (e) {
                console.warn('IndexedDB init error:', e);
                resolve(null);
            }
        });
    }

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// Sound Manager for UI sounds
const SoundManager = {
    sounds: {},
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
    },

    // Available sound options
    availableSounds: [
        { id: 'none', name: 'None' },
        { id: 'click1', name: 'Click (Soft)' },
        { id: 'click2', name: 'Click (Sharp)' },
        { id: 'pop', name: 'Pop' },
        { id: 'subtle', name: 'Subtle' },
        { id: 'whoosh', name: 'Whoosh' },
        { id: 'chime', name: 'Chime' }
    ],

    // Initialize with settings
    init(settings) {
        if (settings) {
            this.enabled = settings.enabled !== false;
            this.volume = settings.volume || 0.5;
            if (settings.assignments) {
                this.assignments = { ...this.assignments, ...settings.assignments };
            }
        }
        this.preloadSounds();
    },

    // Preload sounds using Web Audio API
    preloadSounds() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },

    // Generate a simple tone/sound programmatically
    generateSound(type) {
        if (!this.audioContext || !this.enabled) return;

        const ctx = this.audioContext;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(this.volume * 0.3, now);

        switch (type) {
            case 'click1':
                oscillator.frequency.setValueAtTime(800, now);
                oscillator.type = 'sine';
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                break;
            case 'click2':
                oscillator.frequency.setValueAtTime(1200, now);
                oscillator.type = 'square';
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
                oscillator.start(now);
                oscillator.stop(now + 0.03);
                break;
            case 'pop':
                oscillator.frequency.setValueAtTime(400, now);
                oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.1);
                oscillator.type = 'sine';
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                oscillator.start(now);
                oscillator.stop(now + 0.1);
                break;
            case 'subtle':
                oscillator.frequency.setValueAtTime(600, now);
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(this.volume * 0.15, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                oscillator.start(now);
                oscillator.stop(now + 0.04);
                break;
            case 'whoosh':
                const noise = ctx.createBufferSource();
                const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < buffer.length; i++) {
                    data[i] = (Math.random() * 2 - 1) * (1 - i / buffer.length);
                }
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2000, now);
                filter.frequency.exponentialRampToValueAtTime(500, now + 0.15);
                noise.connect(filter);
                filter.connect(gainNode);
                gainNode.gain.setValueAtTime(this.volume * 0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                noise.start(now);
                return;
            case 'chime':
                oscillator.frequency.setValueAtTime(880, now);
                oscillator.type = 'sine';
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                // Add harmonic
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.setValueAtTime(1320, now);
                osc2.type = 'sine';
                gain2.gain.setValueAtTime(this.volume * 0.15, now);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc2.start(now);
                osc2.stop(now + 0.25);
                break;
            default:
                return;
        }
    },

    // Play sound for an action
    play(action) {
        if (!this.enabled) return;

        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const soundId = this.assignments[action];
        if (soundId && soundId !== 'none') {
            this.generateSound(soundId);
        }
    },

    // Update settings
    updateSettings(settings) {
        if (settings.enabled !== undefined) this.enabled = settings.enabled;
        if (settings.volume !== undefined) this.volume = settings.volume;
        if (settings.assignments) {
            this.assignments = { ...this.assignments, ...settings.assignments };
        }
    }
};

// Export for use in other modules
window.Utils = Utils;
window.EventEmitter = EventEmitter;
window.Storage = Storage;
window.IDBStorage = IDBStorage;
window.SoundManager = SoundManager;
