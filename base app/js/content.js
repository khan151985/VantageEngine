/* ========================================
   Sirah Maps - Content Management
   ======================================== */

const ContentManager = {
    // Current active content
    activeContent: null,
    activeLanguage: 'en',

    // Audio element for narration
    audioPlayer: null,

    // Initialize
    init() {
        // Create audio player with better format support
        this.audioPlayer = new Audio();
        this.audioPlayer.preload = 'auto';

        // Audio error handling
        this.audioPlayer.addEventListener('error', (e) => {
            console.error('Audio error:', this.audioPlayer.error);
            const errorMessages = {
                1: 'Audio loading aborted',
                2: 'Network error loading audio',
                3: 'Audio decoding failed',
                4: 'Audio format not supported'
            };
            const errorCode = this.audioPlayer.error?.code || 0;
            UI.showToast('error', 'Audio Error', errorMessages[errorCode] || 'Unknown audio error');
        });

        this.setupEventListeners();

        // Listen to language changes
        State.on('languageChange', (lang) => {
            this.setLanguage(lang);
        });
    },

    // Set global language - updates everything in real-time
    setLanguage(langCode) {
        console.log('Setting language to:', langCode);
        this.activeLanguage = langCode;

        // Update all language buttons across the app
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === langCode);
        });

        // Update sidebar language display
        const sidebarLangBtn = document.querySelector('.language-btn .lang-code');
        if (sidebarLangBtn) {
            sidebarLangBtn.textContent = langCode.toUpperCase();
        }

        // Update popup if it's open
        if (this.activeContent) {
            this.updatePopupLanguage(langCode);
        }

        // Update menu with translated category names
        if (typeof UI !== 'undefined' && State.state.mode === 'preview') {
            UI.updateUserMenu();
        }
    },

    setupEventListeners() {
        // Popup close button
        document.querySelector('[data-action="close-popup"]')?.addEventListener('click', () => {
            this.closePopup();
        });

        // Media buttons
        document.querySelector('[data-action="show-image"]')?.addEventListener('click', () => {
            this.showImage();
        });

        document.querySelector('[data-action="play-video"]')?.addEventListener('click', () => {
            this.playVideo();
        });

        document.querySelector('[data-action="toggle-audio"]')?.addEventListener('click', () => {
            this.toggleAudio();
        });

        // Video modal close
        document.querySelector('[data-action="close-video"]')?.addEventListener('click', () => {
            this.closeVideo();
        });

        // Panorama close
        document.querySelector('[data-action="close-panorama"]')?.addEventListener('click', () => {
            this.closePanorama();
        });

        // Click outside popup to close
        document.getElementById('textbox-popup')?.addEventListener('click', (e) => {
            if (e.target.id === 'textbox-popup') {
                this.closePopup();
            }
        });

        // Sidebar language button
        document.querySelector('[data-action="change-language"]')?.addEventListener('click', () => {
            this.showLanguageMenu();
        });
    },

    // Show language selection menu
    showLanguageMenu() {
        const languages = State.getProject('languages');
        if (!languages || languages.length === 0) return;

        // Create a simple dropdown near the button
        const existingMenu = document.getElementById('lang-dropdown');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.id = 'lang-dropdown';
        menu.className = 'lang-dropdown';
        menu.innerHTML = languages.map(lang => `
            <button class="lang-dropdown-item ${lang.code === this.activeLanguage ? 'active' : ''}" 
                    data-lang="${lang.code}">
                ${lang.name} (${lang.code.toUpperCase()})
            </button>
        `).join('');

        // Position near sidebar
        menu.style.cssText = `
            position: fixed;
            right: 56px;
            bottom: 200px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-default);
            border-radius: 8px;
            padding: 4px;
            z-index: 100;
            min-width: 150px;
        `;

        document.body.appendChild(menu);

        // Add click handlers
        menu.querySelectorAll('.lang-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                this.setLanguage(item.dataset.lang);
                menu.remove();
            });
        });

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    },

    // Open content associated with a point
    openContent(pointId) {
        console.log('ContentManager.openContent called with pointId:', pointId);

        const point = State.findById('points', pointId);
        if (!point) {
            console.error('Point not found:', pointId);
            return;
        }

        console.log('Point found:', point);

        if (!point.contentId) {
            console.log('Point has no contentId');
            return;
        }

        console.log('Opening content type:', point.contentType, 'contentId:', point.contentId);

        switch (point.contentType) {
            case 'textbox':
                this.openTextbox(point.contentId);
                break;
            case 'video':
                this.openVideo(point.contentId);
                break;
            case 'audio':
                this.playAudio(point.contentId);
                break;
            case 'panorama':
                this.openPanorama(point.contentId);
                break;
            default:
                // Try textbox as default
                this.openTextbox(point.contentId);
        }
    },

    // Open textbox popup
    openTextbox(textboxId) {
        console.log('Opening textbox:', textboxId);

        const textbox = State.findById('textboxes', textboxId);
        if (!textbox) {
            console.error('Textbox not found:', textboxId);
            return;
        }

        console.log('Textbox found:', textbox);

        this.activeContent = textbox;

        // Get content for current language
        const lang = this.activeLanguage;
        const content = textbox.content[lang] || textbox.content['en'] || {};

        console.log('Content for language', lang, ':', content);

        // Update popup UI
        const popup = document.getElementById('textbox-popup');
        if (!popup) {
            console.error('Popup element not found!');
            return;
        }

        const titleEl = document.getElementById('popup-title');
        if (titleEl) titleEl.textContent = content.heading || 'Untitled';

        const contentEl = document.getElementById('popup-content');
        if (contentEl) {
            contentEl.innerHTML = this.formatContent(content.body || '');
            contentEl.dir = Utils.getTextDirection(lang);
        }

        // Apply custom styles
        const style = textbox.style || {};
        const header = popup.querySelector('.textbox-header');
        if (header) {
            header.style.backgroundColor = style.headerColor || '#00C8FF';
            header.style.color = style.headerTextColor || '#FFFFFF';
        }
        if (contentEl) {
            contentEl.style.fontSize = (style.fontSize || '15') + 'px';
            contentEl.style.lineHeight = style.lineHeight || '1.8';
        }

        // Update language buttons
        this.updateLanguageButtons(textbox);

        // Update media buttons
        this.updateMediaButtons(textbox);

        // Show popup
        popup.classList.remove('hidden');
        popup.classList.add('active');

        console.log('Popup should now be visible');
    },

    // Format content with basic markdown support
    formatContent(text) {
        if (!text) return '';

        // Convert line breaks
        let html = text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

        // Wrap in paragraphs
        html = `<p>${html}</p>`;

        // Basic markdown
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Quotes (lines starting with >)
        html = html.replace(/<p>"(.*?)"<\/p>/g, '<blockquote>$1</blockquote>');

        return html;
    },

    // Update language toggle buttons
    updateLanguageButtons(textbox) {
        const container = document.getElementById('popup-languages');
        container.innerHTML = '';

        const availableLanguages = Object.keys(textbox.content);

        availableLanguages.forEach(langCode => {
            const btn = document.createElement('button');
            btn.className = `lang-btn ${langCode === this.activeLanguage ? 'active' : ''}`;
            btn.dataset.lang = langCode;
            btn.textContent = langCode.toUpperCase();
            btn.addEventListener('click', () => this.setLanguage(langCode));
            container.appendChild(btn);
        });
    },

    // Update media button states
    updateMediaButtons(textbox) {
        // Check per-language images or legacy single image
        const hasImage = !!textbox.media?.images?.[this.activeLanguage] ||
            !!textbox.media?.images?.['en'] ||
            !!textbox.media?.image;
        const hasVideo = !!textbox.media?.video;
        const hasAudio = !!textbox.media?.audio?.[this.activeLanguage] || !!textbox.media?.audio?.['en'];

        document.querySelector('[data-action="show-image"]')?.classList.toggle('disabled', !hasImage);
        document.querySelector('[data-action="play-video"]')?.classList.toggle('disabled', !hasVideo);
        document.querySelector('[data-action="toggle-audio"]')?.classList.toggle('disabled', !hasAudio);
    },

    // Switch content language (legacy - now uses setLanguage)
    switchLanguage(langCode) {
        this.activeLanguage = langCode;
        State.setLanguage(langCode);

        if (this.activeContent) {
            const content = this.activeContent.content[langCode] || this.activeContent.content['en'] || {};

            document.getElementById('popup-title').textContent = content.heading || 'Untitled';

            const contentEl = document.getElementById('popup-content');
            contentEl.innerHTML = this.formatContent(content.body || '');
            contentEl.dir = Utils.getTextDirection(langCode);

            // Update active button
            document.querySelectorAll('#popup-languages .lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === langCode);
            });

            // Update media buttons
            this.updateMediaButtons(this.activeContent);

            // Stop and potentially restart audio in new language
            this.stopAudio();
        }
    },

    // Close popup
    closePopup() {
        document.getElementById('textbox-popup').classList.add('hidden');
        this.stopAudio();

        // Hide meshes for the active point when closing popup
        if (State.state.activePointId) {
            const point = State.findById('points', State.state.activePointId);
            if (point?.visibilityMeshes?.length > 0) {
                Renderer.toggleMeshesVisibility && Renderer.toggleMeshesVisibility(point.visibilityMeshes, false);
            }
            State.state.activePointId = null;
        }

        this.activeContent = null;
    },

    // Show image
    showImage() {
        // Get image for current language or fallback
        let imageSrc = this.activeContent?.media?.images?.[this.activeLanguage] ||
            this.activeContent?.media?.images?.['en'] ||
            this.activeContent?.media?.image;

        if (!imageSrc) return;

        // Create lightbox
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cursor = 'pointer';
        overlay.innerHTML = `
            <img src="${imageSrc}" 
                 style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px;">
        `;
        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
    },

    // Open video
    openVideo(mediaId) {
        const media = State.findById('media', mediaId);
        if (!media) return;

        const videoPlayer = document.getElementById('video-player');
        videoPlayer.src = media.data;

        document.getElementById('video-modal').classList.remove('hidden');
        videoPlayer.play();
    },

    // Play video from textbox media
    playVideo() {
        if (!this.activeContent?.media?.video) return;

        const videoPlayer = document.getElementById('video-player');
        videoPlayer.src = this.activeContent.media.video;

        document.getElementById('video-modal').classList.remove('hidden');
        videoPlayer.play();
    },

    // Close video
    closeVideo() {
        const videoPlayer = document.getElementById('video-player');
        videoPlayer.pause();
        videoPlayer.src = '';
        document.getElementById('video-modal').classList.add('hidden');
    },

    // Toggle audio narration
    toggleAudio() {
        if (!this.activeContent) {
            console.log('No active content for audio');
            return;
        }

        if (this.audioPlayer.paused || this.audioPlayer.ended) {
            this.playNarration();
        } else {
            this.stopAudio();
        }
    },

    // Play narration audio
    playNarration() {
        if (!this.activeContent?.media?.audio) {
            console.log('No audio in active content');
            return;
        }

        console.log('Audio media:', this.activeContent.media.audio);
        console.log('Current language:', this.activeLanguage);

        // Get audio for current language or fallback to English
        let audioSrc = this.activeContent.media.audio[this.activeLanguage];
        if (!audioSrc) {
            audioSrc = this.activeContent.media.audio['en'];
        }
        if (!audioSrc) {
            // Try first available language
            const availableAudio = Object.values(this.activeContent.media.audio)[0];
            audioSrc = availableAudio;
        }

        if (!audioSrc) {
            console.log('No audio source found');
            UI.showToast('info', 'No Audio', 'No audio available for this content');
            return;
        }

        console.log('Playing audio:', audioSrc.substring(0, 50) + '...');

        this.audioPlayer.src = audioSrc;
        this.audioPlayer.play().then(() => {
            console.log('Audio playing');
            document.querySelector('[data-action="toggle-audio"]')?.classList.add('active');
        }).catch(err => {
            console.error('Audio play failed:', err);
            UI.showToast('error', 'Audio Error', 'Could not play audio');
        });

        // Handle audio end
        this.audioPlayer.onended = () => {
            document.querySelector('[data-action="toggle-audio"]')?.classList.remove('active');
        };
    },

    // Stop audio
    stopAudio() {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
        document.querySelector('[data-action="toggle-audio"]')?.classList.remove('active');
    },

    // Play audio from media library
    playAudio(mediaId) {
        const media = State.findById('media', mediaId);
        if (!media) return;

        this.audioPlayer.src = media.data;
        this.audioPlayer.play();

        UI.showToast('info', 'Playing Audio', media.name);
    },

    // Open panorama viewer
    openPanorama(mediaId) {
        const media = State.findById('media', mediaId);
        if (!media) return;

        document.getElementById('panorama-viewer').classList.remove('hidden');

        // Initialize panorama viewer (using simple CSS 3D or Three.js)
        this.initPanoramaViewer(media.data);
    },

    // Initialize panorama viewer
    initPanoramaViewer(imageSrc) {
        const container = document.getElementById('panorama-container');
        container.innerHTML = '';

        // Create Three.js panorama viewer
        const width = container.clientWidth;
        const height = container.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        // Create sphere with panorama texture
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // Flip inside out

        const texture = new THREE.TextureLoader().load(imageSrc);
        const material = new THREE.MeshBasicMaterial({ map: texture });

        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        camera.position.set(0, 0, 0.1);

        // Simple drag controls
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let lon = 0, lat = 0;

        container.addEventListener('mousedown', () => isDragging = true);
        container.addEventListener('mouseup', () => isDragging = false);
        container.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            lon -= e.movementX * 0.1;
            lat += e.movementY * 0.1;
            lat = Math.max(-85, Math.min(85, lat));
        });

        // Touch controls
        let touchStart = { x: 0, y: 0 };
        container.addEventListener('touchstart', (e) => {
            touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        });
        container.addEventListener('touchmove', (e) => {
            const dx = e.touches[0].clientX - touchStart.x;
            const dy = e.touches[0].clientY - touchStart.y;

            lon -= dx * 0.1;
            lat += dy * 0.1;
            lat = Math.max(-85, Math.min(85, lat));

            touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        });

        // Animation loop
        const animate = () => {
            if (!document.getElementById('panorama-viewer').classList.contains('hidden')) {
                requestAnimationFrame(animate);

                // Update camera rotation
                const phi = Utils.degToRad(90 - lat);
                const theta = Utils.degToRad(lon);

                camera.position.x = 0.1 * Math.sin(phi) * Math.cos(theta);
                camera.position.y = 0.1 * Math.cos(phi);
                camera.position.z = 0.1 * Math.sin(phi) * Math.sin(theta);
                camera.lookAt(0, 0, 0);

                renderer.render(scene, camera);
            }
        };

        animate();

        // Store reference for cleanup
        this.panoramaRenderer = renderer;
    },

    // Close panorama
    closePanorama() {
        document.getElementById('panorama-viewer').classList.add('hidden');

        if (this.panoramaRenderer) {
            this.panoramaRenderer.dispose();
            this.panoramaRenderer = null;
        }

        document.getElementById('panorama-container').innerHTML = '';
    },

    // Create new textbox
    createTextbox(options = {}) {
        const textbox = {
            id: Utils.generateId('textbox'),
            content: {
                'en': {
                    heading: options.heading || 'New Text Box',
                    body: options.body || ''
                }
            },
            media: {
                image: null,
                video: null,
                audio: {}
            }
        };

        State.addToProject('textboxes', textbox);
        return textbox;
    },

    // Update textbox content
    updateTextbox(id, langCode, content) {
        const textbox = State.findById('textboxes', id);
        if (!textbox) return null;

        if (!textbox.content[langCode]) {
            textbox.content[langCode] = {};
        }

        Object.assign(textbox.content[langCode], content);

        State.emit('projectChange', { path: 'textboxes', action: 'update', id });
        return textbox;
    },

    // Add media to textbox
    async addMediaToTextbox(textboxId, type, file, lang = null) {
        const textbox = State.findById('textboxes', textboxId);
        if (!textbox) return null;

        let data;

        if (type === 'image') {
            data = await Loader.loadImage(file);
            // If language is specified, store per-language image
            if (lang) {
                if (!textbox.media.images) textbox.media.images = {};
                textbox.media.images[lang] = data;
            } else {
                // Legacy fallback - store as single image
                textbox.media.image = data;
            }
        } else if (type === 'video') {
            data = await Loader.loadVideo(file);
            textbox.media.video = data;
        } else if (type === 'audio') {
            data = await Loader.loadAudio(file);
            if (!textbox.media.audio) textbox.media.audio = {};
            textbox.media.audio[this.activeLanguage] = data;
        }

        State.emit('projectChange', { path: 'textboxes', action: 'update', id: textboxId });
        return textbox;
    },

    // Track uploads in progress to prevent race conditions
    uploadingFiles: new Set(),

    // Add media to library
    async addMedia(file, type) {
        // Check if already uploading
        const uploadKey = `${type}:${file.name}`;
        if (this.uploadingFiles.has(uploadKey)) {
            console.log('Upload in progress for:', uploadKey);
            return null;
        }

        this.uploadingFiles.add(uploadKey);

        try {
            // Check for duplicates in existing project data
            const existingMedia = State.getProject('media').find(m =>
                m.type === type && m.name === file.name
            );

            if (existingMedia) {
                console.log('Media already exists:', file.name);
                return existingMedia;
            }

            const media = {
                id: Utils.generateId('media'),
                type,
                name: file.name,
                filename: file.name,
                data: null
            };

            if (type === 'video') {
                media.data = await Loader.loadVideo(file);
            } else if (type === 'audio') {
                media.data = await Loader.loadAudio(file);
            } else if (type === 'panorama' || type === 'image') {
                media.data = await Loader.loadImage(file);
            }

            State.addToProject('media', media);
            return media;

        } catch (err) {
            console.error('Error adding media:', err);
            throw err;
        } finally {
            this.uploadingFiles.delete(uploadKey);
        }
    },

    // Get textboxes for dropdown
    getTextboxOptions() {
        return State.getProject('textboxes').map(tb => ({
            id: tb.id,
            name: tb.content['en']?.heading || tb.content[Object.keys(tb.content)[0]]?.heading || 'Untitled'
        }));
    },

    // Get media for dropdown
    getMediaOptions(type = null) {
        let media = State.getProject('media');
        if (type) {
            media = media.filter(m => m.type === type);
        }
        return media.map(m => ({
            id: m.id,
            name: m.name,
            type: m.type
        }));
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    ContentManager.init();
});

// Export
window.ContentManager = ContentManager;
