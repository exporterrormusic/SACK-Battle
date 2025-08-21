/**
 * AudioMixer - Simple per-category volume controller (no normalization)
 */
class AudioMixer {
    constructor() {
        this.audioSettings = {
            sfxVolume: 0.8,
            musicVolume: 0.6
        };
        console.log('AudioMixer: Initialized (simple volumes only)', this.audioSettings);
        this.tryHydrateFromState();
    }

    // Load from Game state or __settings if present
    tryHydrateFromState() {
        try {
            if (window.Game && window.Game.getState) {
                const st = window.Game.getState();
                if (st && st.settings && st.settings.audioSettings) {
                    const { sfxVolume, musicVolume } = st.settings.audioSettings;
                    this.audioSettings.sfxVolume = typeof sfxVolume === 'number' ? sfxVolume : this.audioSettings.sfxVolume;
                    this.audioSettings.musicVolume = typeof musicVolume === 'number' ? musicVolume : this.audioSettings.musicVolume;
                    console.log('AudioMixer: Hydrated from Game state', this.audioSettings);
                    return;
                }
            }
            if (window.__settings && window.__settings.data && window.__settings.data.audioSettings) {
                const { sfxVolume, musicVolume } = window.__settings.data.audioSettings;
                this.audioSettings.sfxVolume = typeof sfxVolume === 'number' ? sfxVolume : this.audioSettings.sfxVolume;
                this.audioSettings.musicVolume = typeof musicVolume === 'number' ? musicVolume : this.audioSettings.musicVolume;
                console.log('AudioMixer: Hydrated from __settings.data', this.audioSettings);
            }
        } catch (e) {
            console.warn('AudioMixer: hydrate failed', e);
        }
    }

    updateAudioSettings(newSettings) {
        // Accept either root { audioSettings } or flat { sfxVolume, musicVolume }
        const src = newSettings && newSettings.audioSettings ? newSettings.audioSettings : newSettings;
        if (src) {
            if (typeof src.sfxVolume === 'number') this.audioSettings.sfxVolume = src.sfxVolume;
            if (typeof src.musicVolume === 'number') this.audioSettings.musicVolume = src.musicVolume;
            console.log('AudioMixer: Updated audioSettings', this.audioSettings);
            this.updateAllTrackVolumes();
        }
    }

    categorizeAudio(audioPath) {
        if (!audioPath) {
            console.log('AudioMixer: categorizeAudio called with empty path, defaulting to sfx');
            return 'sfx';
        }
        // Normalize separators and strip protocol for matching
        let audioName = String(audioPath).toLowerCase();
        audioName = audioName.replace(/^app:\/\//, '');
        audioName = audioName.replace(/\\/g, '/');
        console.log(`AudioMixer: categorizeAudio analyzing: "${audioPath}"`);
        
        // Music category: UI folder mp3/wav + files named music.mp3/wav
        // Accept both with and without leading slash (assets/ui/...)
        const isUIMusic = (audioName.includes('/assets/ui/') || audioName.includes('assets/ui/'))
            && (audioName.endsWith('.mp3') || audioName.endsWith('.wav'));
        const isNamedMusic = /(^|[\/])music\.(mp3|wav)$/.test(audioName);
        
        if (isUIMusic || isNamedMusic) {
            console.log(`AudioMixer: categorizeAudio result: MUSIC (isUIMusic: ${isUIMusic}, isNamedMusic: ${isNamedMusic})`);
            return 'music';
        }
        
        console.log(`AudioMixer: categorizeAudio result: SFX`);
        return 'sfx';
    }
    
    calculateCategoryVolume(category, baseVolume = 1.0) {
        const v = category === 'music' ? this.audioSettings.musicVolume : this.audioSettings.sfxVolume;
        const result = Math.max(0, Math.min(1, baseVolume * (typeof v === 'number' ? v : 1)));
        console.log(`AudioMixer: calc ${category} => base ${baseVolume} * cat ${v} = ${result}`);
        return result;
    }

    updateAllTrackVolumes() {
        console.log('AudioMixer: Updating all track volumes');
        this.updateTraditionalAudioVolumes();
        
    // If audio state isn't ready yet, schedule an update for later
    const hasAudioState = !!(window.__audioState || (window.__audioModule && window.__audioModule.state));
    if (!hasAudioState) {
            console.log('AudioMixer: Audio state not ready, scheduling delayed update');
            this.scheduleDelayedUpdate();
        }
    }
    
    scheduleDelayedUpdate() {
        // Clear any existing timeout
        if (this.delayedUpdateTimeout) {
            clearTimeout(this.delayedUpdateTimeout);
        }
        
        // Try again in 100ms, up to 50 times (5 seconds total)
        this.delayedUpdateAttempts = (this.delayedUpdateAttempts || 0) + 1;
        
        if (this.delayedUpdateAttempts < 50) {
            this.delayedUpdateTimeout = setTimeout(() => {
                console.log('AudioMixer: Attempting delayed update, attempt', this.delayedUpdateAttempts);
                const hasAudioState = !!(window.__audioState || (window.__audioModule && window.__audioModule.state));
                if (hasAudioState) {
                    console.log('AudioMixer: Audio state now available, applying delayed update');
                    this.updateTraditionalAudioVolumes();
                    this.delayedUpdateAttempts = 0; // Reset counter
                } else {
                    console.log('AudioMixer: Audio state still not ready, scheduling another attempt');
                    this.scheduleDelayedUpdate();
                }
            }, 100);
        } else {
            console.warn('AudioMixer: Gave up waiting for audio state after 50 attempts');
            this.delayedUpdateAttempts = 0; // Reset counter
        }
    }
    
    // Public method to force refresh settings from current game state
    refreshFromGameState() {
        if (window.Game && window.Game.getState) {
            const currentState = window.Game.getState();
            if (currentState.settings && currentState.settings.audioSettings) {
                this.updateAudioSettings(currentState.settings);
                console.log('AudioMixer: Force refreshed settings from current game state');
                return true;
            }
        }
        console.warn('AudioMixer: Could not refresh from game state - no settings available');
        return false;
    }

    // Public method to trigger immediate update when audio system is ready
    onAudioSystemReady() {
        console.log('AudioMixer: Audio system ready, applying settings immediately');
        // Clear any pending delayed updates
        if (this.delayedUpdateTimeout) {
            clearTimeout(this.delayedUpdateTimeout);
            this.delayedUpdateTimeout = null;
        }
        this.delayedUpdateAttempts = 0;
    // Ensure we have the latest settings from the game before touching volumes
    try { this.refreshFromGameState(); } catch(_){}
        this.updateTraditionalAudioVolumes();
    }

    updateTraditionalAudioVolumes() {
    console.log('AudioMixer: Updating traditional audio volumes');
        
        if (typeof window === 'undefined') {
            console.log('AudioMixer: No window object available');
            return;
        }
        const audioState = window.__audioState || (window.__audioModule && window.__audioModule.state);
        if (!audioState) {
            console.log('AudioMixer: No audio state available');
            return;
        }
        console.log('AudioMixer: Found audioState', Object.keys(audioState));

    // Update boss audio
        if (audioState.bossAudio) {
            if (audioState.bossAudio.music) {
                const volume = this.calculateCategoryVolume('music');
                try { audioState.bossAudio.music.volume = volume; } catch(_) {}
                console.log('AudioMixer: Set boss music volume to', volume);
            }
            if (audioState.bossAudio.sfx) {
                const volume = this.calculateCategoryVolume('sfx');
                const sfxObj = audioState.bossAudio.sfx;
                let count = 0;
                if (sfxObj && typeof sfxObj === 'object') {
                    Object.entries(sfxObj).forEach(([key, clip]) => {
                        try {
                            if (clip && typeof clip.volume !== 'undefined') {
                                clip.volume = volume;
                                count++;
                            }
                        } catch(_) {}
                    });
                }
                console.log(`AudioMixer: Set boss sfx volume to ${volume} on ${count} clips`);
            }
        }

        // Update overlay music
        if (audioState.overlayMusic && audioState.overlayMusic.audio) {
            const volume = this.calculateCategoryVolume('music');
            audioState.overlayMusic.audio.volume = volume;
            console.log('AudioMixer: Set overlay music volume to', volume);
        }

    // Update buff SFX registered by BuffSystem
        if (audioState.buffSfx && typeof audioState.buffSfx === 'object') {
            const volume = this.calculateCategoryVolume('sfx');
            let count = 0;
            Object.values(audioState.buffSfx).forEach(clip => {
                try { if (clip && typeof clip.volume !== 'undefined') { clip.volume = volume; count++; } } catch(_){}
            });
            if (count) console.log(`AudioMixer: Set buff SFX volume to ${volume} on ${count} clips`);
        }

        // Update boss welcome voice line (treated as SFX)
        let welcomeRef = null;
        
        // Check multiple possible locations for boss welcome audio
        if (audioState.bossWelcome && typeof audioState.bossWelcome.volume !== 'undefined') {
            welcomeRef = audioState.bossWelcome;
        } else if (audioState.state && audioState.state.bossWelcome && typeof audioState.state.bossWelcome.volume !== 'undefined') {
            welcomeRef = audioState.state.bossWelcome;
        } else if (window.__audioModule && window.__audioModule.state && window.__audioModule.state.bossWelcome && typeof window.__audioModule.state.bossWelcome.volume !== 'undefined') {
            welcomeRef = window.__audioModule.state.bossWelcome;
        }
        
        if (welcomeRef) {
            const volume = this.calculateCategoryVolume('sfx');
            try { 
                welcomeRef.volume = volume; 
                console.log('AudioMixer: Set boss welcome SFX volume to', volume);
            } catch(_){ 
                console.warn('AudioMixer: Failed to set boss welcome volume');
            }
        } else {
            console.log('AudioMixer: No boss welcome audio found to update');
        }

        // Update any other audio objects
        Object.keys(audioState).forEach(key => {
            const audio = audioState[key];
            if (audio && typeof audio.volume !== 'undefined' && key !== 'bossAudio' && key !== 'overlayMusic') {
                const category = this.categorizeAudio(audio.src || key);
                const volume = this.calculateCategoryVolume(category);
                audio.volume = volume;
                console.log(`AudioMixer: Set ${key} (${category}) volume to`, volume);
            }
        });
    }

        // Convenience methods for real-time updates
        setSfxVolume(volume) {
        this.audioSettings.sfxVolume = Math.max(0, Math.min(1, volume));
        this.updateAllTrackVolumes();
    }

    setMusicVolume(volume) {
        this.audioSettings.musicVolume = Math.max(0, Math.min(1, volume));
        this.updateAllTrackVolumes();
    }
}

// Global instance
window.AudioMixer = window.AudioMixer || new AudioMixer();
// Use window instead of global in renderer process
window.__audioMixer = window.__audioMixer || window.AudioMixer;
