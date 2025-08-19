// src/renderer/audio.js
// Centralized audio subsystem (UMD-ish). No require; exposes globals.
/**
 * Audio Module Public API (attached as window.__audioModule and legacy globals)
 * stopAllMusic(reason?:string)
 * playOverlayMusic(kind:'prebattle'|'victory'|'defeat')
 * stopOverlayMusic(kind?:string)
 * initBossAudio(meta) // meta.audio.{music,attack,charge,special,growl,defeat,victory}
 * tryStartBossMusic()
 * playBossSfx(kind)
 * scheduleBossMusicStart()
 * onWaitingDismissed()
 * state: { overlayMusic, bossAudio }
 */
(function(global){

// Define shared audio state early so all functions can reference it safely
const state = {
  overlayMusic: { type:null, audio:null, _deferPlay:false },
  bossAudio: { music:null, sfx:{}, _pendingPlay:false, _starting:false, _musicSrc:null },
  timers: { boss: [] },
  bossWelcome: null
};

function computeEffectiveVolume(category, baseVolume = 1.0) {
  // Simple rule: effective = base * categoryVolume (musicVolume or sfxVolume)
  // Prioritize AudioMixer for real-time volume changes, fall back to Game state
  if (window.__audioMixer) {
    const v = window.__audioMixer.calculateCategoryVolume(category, baseVolume);
    console.log(`[AudioVol] ${category} (AudioMixer): base=${baseVolume} => ${v}`);
    return v;
  }
  
  try {
    const st = window.Game && window.Game.getState ? window.Game.getState() : null;
    const as = st && st.settings && st.settings.audioSettings ? st.settings.audioSettings : null;
    if (as) {
      const catVol = category === 'music'
        ? (typeof as.musicVolume === 'number' ? as.musicVolume : 0.6)
        : (typeof as.sfxVolume === 'number' ? as.sfxVolume : 0.8);
      const v = Math.max(0, Math.min(1, (typeof baseVolume === 'number' ? baseVolume : 1) * catVol));
      console.log(`[AudioVol] ${category} (GameState): base=${baseVolume} * cat=${catVol} => ${v}`);
      return v;
    }
  } catch(_) {}
  
  return Math.max(0, Math.min(1, baseVolume));
}

function playAudioEnhanced(src, options = {}) {
  const { volume = 1.0, loop = false, defer = false } = options;
  
  // Traditional audio with proper categorized volume
  const audio = new Audio(src);
  
  // Apply categorized volume using AudioMixer if available
  const category = window.__audioMixer ? window.__audioMixer.categorizeAudio(src) : (String(src).toLowerCase().includes('/assets/ui/') ? 'music' : 'sfx');
  const finalVolume = computeEffectiveVolume(category, volume);
  console.log(`[AudioEnhanced] Audio volume for ${src} (${category}): ${volume} -> ${finalVolume}`);
  
  audio.volume = finalVolume;
  audio.loop = loop;
  
  // Store original volume for potential updates
  audio.dataset.originalVolume = volume.toString();
  
  if (defer) {
    // For deferred audio, just prepare but don't play yet
    console.log('[AudioEnhanced] Audio prepared for later playback');
    return audio;
  } else {
    // Try immediate playback
  // Force-apply current mixer volumes immediately
  try { if (global.__audioMixer && typeof global.__audioMixer.updateAllTrackVolumes === 'function') { global.__audioMixer.updateAllTrackVolumes(); } } catch(_){ }

  audio.play().then(()=>{
      console.log('[AudioEnhanced] Audio started playing successfully');
    }).catch(e => {
      console.warn('[AudioEnhanced] Audio play failed (probably need user interaction):', e.message);
    });
    return audio;
  }
}

function stopAudioEnhanced(audioOrId, fadeOut = 0) {
  if (window.__audioMixer && typeof audioOrId === 'string') {
    return window.__audioMixer.stop(audioOrId, fadeOut);
  } else if (audioOrId && typeof audioOrId.pause === 'function') {
    // Traditional audio object
    if (fadeOut > 0) {
      const startVolume = audioOrId.volume;
      const steps = 10;
      const stepDuration = fadeOut / steps;
      let currentStep = 0;
      
      const fadeStep = () => {
        currentStep++;
        audioOrId.volume = Math.max(0, startVolume * (1 - currentStep / steps));
        
        if (currentStep >= steps) {
          audioOrId.pause();
          audioOrId.currentTime = 0;
        } else {
          setTimeout(fadeStep, stepDuration);
        }
      };
      
      fadeStep();
    } else {
      audioOrId.pause();
      audioOrId.currentTime = 0;
    }
  }
}

// Play boss welcome.mp3 (if exists) once per boss spawn
let _lastBossWelcomePlayedBoss = '';
const _welcomeRetryCounts = Object.create(null);
// Reset the boss welcome flag so welcome.mp3 can play for each new boss
function resetBossWelcomeFlag() {
  _lastBossWelcomePlayedBoss = '';
}
function playBossWelcome(path, bossName) {
  // Always try to play welcome.mp3 for every boss spawn, even if previous failed
  if (!path || !bossName) {
    console.log('[BossWelcome] Skipped: missing path or bossName', { path, bossName });
    return;
  }
  if (_lastBossWelcomePlayedBoss === bossName) return; // Only play once per boss spawn
  // Check waitingActive every time
  if (typeof window.waitingActive !== 'undefined' && window.waitingActive) {
    console.log('[BossWelcome] Skipped: waitingActive is true');
    return;
  }
  // Ensure audio settings are ready to avoid playing at default/incorrect volume
  try {
    const st = window.Game && window.Game.getState ? window.Game.getState() : null;
    const hasAudioSettings = !!(st && st.settings && st.settings.audioSettings &&
      typeof st.settings.audioSettings.sfxVolume === 'number' && typeof st.settings.audioSettings.musicVolume === 'number');
    if (!hasAudioSettings) {
      const key = bossName.toLowerCase();
      _welcomeRetryCounts[key] = (_welcomeRetryCounts[key] || 0) + 1;
      if (_welcomeRetryCounts[key] <= 30) { // up to ~3.6s total if 120ms each
        console.log('[BossWelcome] Deferring welcome.mp3 until audio settings ready (attempt', _welcomeRetryCounts[key], ')');
        setTimeout(() => playBossWelcome(path, bossName), 120);
        return;
      } else {
        console.warn('[BossWelcome] Proceeding without confirmed audio settings after max retries');
      }
    }
  } catch(_) {}
  try {
    // Build candidate sources: welcome.mp3, then intro.mp3 (same folder)
    const norm = String(path || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '');
    // Determine boss folder from provided path or bossName
    let bossFolder = '';
    const m = norm.match(/assets\/boss\/([^/]+)\//);
    if (m && m[1]) bossFolder = m[1];
    if (!bossFolder) bossFolder = String(bossName || '').toLowerCase().trim().replace(/\s+/g, '-');
    const primary = `app://assets/boss/${bossFolder}/welcome.mp3`;
    const fallback = `app://assets/boss/${bossFolder}/intro.mp3`;
    const sources = [];
    // If caller passed an explicit app:// src that isn't the standard, honor it first
    if (/^app:\/\//.test(norm)) sources.push(norm);
    // Always try welcome first, then intro (avoid duplicates)
    if (!sources.includes(primary)) sources.push(primary);
    if (!sources.includes(fallback)) sources.push(fallback);

    const attemptPlay = (idx = 0) => {
      if (idx >= sources.length) {
        console.warn('[BossWelcome] All welcome/intro sources failed for', bossName, sources);
        try { state.bossWelcome = null; } catch(_) {}
        return;
      }
      const src = sources[idx];
      const audio = new Audio(src);
      audio.volume = computeEffectiveVolume('sfx', 0.7);
      let errored = false;
      const onError = () => {
        if (errored) return;
        errored = true;
        audio.removeEventListener('error', onError);
        // Try next source
        console.warn('[BossWelcome] Source failed, trying next', { src, nextIndex: idx + 1 });
        try { audio.pause(); } catch(_) {}
        attemptPlay(idx + 1);
      };
      audio.addEventListener('error', onError);
      // Register in shared state BEFORE play
      try {
        state.bossWelcome = audio;
        if (global.__audioModule && global.__audioModule.state) {
          global.__audioModule.state.bossWelcome = audio;
        }
      } catch(_) {}
      audio.play().then(() => {
        // Success: detach error listener and proceed
        audio.removeEventListener('error', onError);
        _lastBossWelcomePlayedBoss = bossName; // Only set after successful play
        console.log('[BossWelcome] Playing welcome clip for boss:', bossName, 'src:', src);
        // Reapply category volume periodically in case something resets volume during boss load
        try {
          let ticks = 0;
          const iv = setInterval(() => {
            try {
              if (!audio || audio.paused) { clearInterval(iv); return; }
              const v = computeEffectiveVolume('sfx', 0.7);
              if (Math.abs(audio.volume - v) > 0.005) {
                audio.volume = v;
                if (window.__audioMixer) console.log('[BossWelcome] Reapplied SFX volume:', v);
              }
              if (++ticks > 40) clearInterval(iv); // ~6s at 150ms
            } catch(_) { clearInterval(iv); }
          }, 150);
        } catch(_) {}
        setTimeout(() => { try { audio.pause(); audio.currentTime = 0; } catch(_) {} try { state.bossWelcome = null; } catch(_) {} }, 8000);
      }).catch((err) => {
        // Only try fallback for load errors; NotAllowedError (gesture) shouldn't trigger fallback loop
        const isNotAllowed = err && /NotAllowedError/i.test(String(err && err.name || ''));
        console.warn('[Audio] Boss welcome play failed', err, 'src:', src);
        if (!isNotAllowed) {
          try { audio.pause(); } catch(_) {}
          attemptPlay(idx + 1);
        } else {
          try { state.bossWelcome = null; } catch(_) {}
        }
      });
    };

    attemptPlay(0);
  } catch(e) { console.warn('[Audio] Boss welcome.mp3 play failed', e); }
}

function _clearBossMusicTimers(){
  state.timers.boss.forEach(t=>{ try { (t.kind==='i'?clearInterval:clearTimeout)(t.id); } catch(_){ } });
  state.timers.boss = [];
}

function stopAllMusic(reason){
  try {
    // Only stop prebattle music when boss music actually starts playing, not just when initializing
    const shouldStopPrebattle = reason && (
      reason.includes('playOverlayMusic') ||
      reason === 'setBoss' ||
      reason.includes('boss-starting') ||
      reason.includes('boss-music-start')
    );
    
    if (shouldStopPrebattle && state.overlayMusic.audio) { 
      console.log('[AudioStopAll] Stopping overlay music due to:', reason);
      if (state.overlayMusic._isAudioMixer && window.__audioMixer) {
        window.__audioMixer.stop(state.overlayMusic.audio, 200);
      } else {
        try { state.overlayMusic.audio.pause(); } catch(_){}; 
      }
      state.overlayMusic.type = null; 
      state.overlayMusic.audio = null; 
      state.overlayMusic._deferPlay = false;
      state.overlayMusic._isAudioMixer = false;
    }
    
    if (state.bossAudio.music) { try { state.bossAudio.music.pause(); } catch(_){} }
    if (window.setWaiting && window.setWaiting._waitingAudio) { try { window.setWaiting._waitingAudio.pause(); } catch(_){} }
  } catch(e){ console.warn('[AudioStopAll] error', e); }
  console.log('[AudioStopAll]', reason||'');
}

function initBossAudio(meta){
  // Defer init slightly until audio settings exist to ensure correct initial volumes
  try {
    const st = window.Game && window.Game.getState ? window.Game.getState() : null;
    const hasAudioSettings = !!(st && st.settings && st.settings.audioSettings &&
      typeof st.settings.audioSettings.sfxVolume === 'number' && typeof st.settings.audioSettings.musicVolume === 'number');
    if (!hasAudioSettings) {
      setTimeout(()=>initBossAudio(meta), 120);
      return;
    }
  } catch(_) {}
  stopAllMusic('initBossAudio');
  if (state.bossAudio.music){ try{ state.bossAudio.music.pause(); state.bossAudio.music=null; }catch(_){}}
  state.bossAudio.sfx = {};
  state.bossAudio._pendingPlay = false;
  state.bossAudio._starting = false;
  state.bossAudio._musicSrc = null;
  if (!meta || !meta.audio) return;
  const wantsMusicSrc = meta.audio.music;
  if (wantsMusicSrc){
    const audio = new Audio(wantsMusicSrc.startsWith('app://') ? wantsMusicSrc : `app://${wantsMusicSrc}`); 
    audio.loop = true; 
    
    // Use AudioMixer for volume if available
    if (window.__audioMixer) {
      audio.volume = window.__audioMixer.calculateCategoryVolume('music');
      console.log('[Audio] Boss music volume set via AudioMixer:', audio.volume);
    } else {
      audio.volume = 0.5;
    }
    
    state.bossAudio.music = audio;
    state.bossAudio._pendingPlay = true; // defer until safe to play
    state.bossAudio._musicSrc = wantsMusicSrc;
    console.log('[Audio] Boss music prepared (deferred start)', wantsMusicSrc);
  }
  ['attack','growl','charge','special','defeat','victory','cooldown'].forEach(k=>{ 
    if (meta.audio[k] && k!=='music'){ 
      const a=new Audio(meta.audio[k].startsWith('app://') ? meta.audio[k] : `app://${meta.audio[k]}`); 
      
      // Use AudioMixer for volume if available
      if (window.__audioMixer) {
        a.volume = window.__audioMixer.calculateCategoryVolume('sfx');
        console.log(`[Audio] Boss SFX ${k} volume set via AudioMixer:`, a.volume);
      } else {
        a.volume = 0.8;
      }
      
      state.bossAudio.sfx[k]=a; 
      // Register boss SFX individually under a flat map for other systems if needed
      try { 
        if (window.__audioState && window.__audioState !== state) {
          if (!window.__audioState.bossSfx) window.__audioState.bossSfx = {};
          window.__audioState.bossSfx[k] = a;
        }
      } catch(_){}
    }
  });
}

function _canStartBossMusic(){
  const Game = window.Game;
  let reasons = [];
  try {
    const st = Game && Game.getState ? Game.getState() : null;
    if (!st || !st.running) reasons.push('not-running');
    if (window.__prebattleActive) reasons.push('prebattle-active');
    if (typeof window.waitingActive !== 'undefined' && window.waitingActive) reasons.push('waiting-active');
    if (state.overlayMusic.type) reasons.push('overlay-active:'+state.overlayMusic.type);
    const ok = reasons.length === 0;
    if (!ok) console.log('[Audio] Boss music gate blocked', reasons);
    return ok;
  } catch(e){ console.log('[Audio] Boss music gate error', e); return false; }
}

function tryStartBossMusic(){
  const Game = window.Game;
  if (!state.bossAudio.music) return;
  if (!_canStartBossMusic()) return; // logging already done
  if (state.bossAudio.music && !state.bossAudio._pendingPlay && !state.bossAudio.music.paused && !state.bossAudio._starting){
    return; // already playing
  }
  if (state.bossAudio._starting) return;
  if (state.bossAudio._pendingPlay) {
    const a = state.bossAudio.music; state.bossAudio._pendingPlay = false; state.bossAudio._starting = true;
    setTimeout(()=>{
      if (!_canStartBossMusic()) { state.bossAudio._pendingPlay = true; state.bossAudio._starting = false; return; }
      try {
        if (state.overlayMusic.audio) { 
          console.log('[Audio] Stopping prebattle music for boss music start');
          stopOverlayMusic('boss-music-start'); 
        }
        a.currentTime = 0;
        a.play().then(()=>{ console.log('[Audio] Boss music started'); state.bossAudio._starting = false; }).catch(err=>{ console.warn('[Audio] Boss music play failed after defer', err); state.bossAudio._pendingPlay = true; state.bossAudio._starting = false; });
      } catch(e){ console.warn('[Audio] Boss music exception', e); state.bossAudio._pendingPlay = true; state.bossAudio._starting = false; }
    }, 140);
  }
}

function playBossSfx(kind){
  const Game = window.Game;
  try {
    const st = Game && Game.getState ? Game.getState() : null;
    // If victory/defeat, stop all boss SFX except victory/defeat
    if (st && st.victoryState) {
      Object.entries(state.bossAudio.sfx).forEach(([sfxKind, audio]) => {
        if (audio && !['victory','defeat'].includes(sfxKind)) {
          try { audio.pause(); audio.currentTime = 0; } catch(_){}
        }
      });
      if (!['victory','defeat'].includes(kind)) return; // suppress normal SFX once outcome shown
    }
  } catch(_){ }
  const clip = state.bossAudio.sfx && state.bossAudio.sfx[kind];
  if (clip){ try { clip.currentTime=0; clip.play().catch(()=>{}); } catch(_){ } }
}

function playOverlayMusic(kind){
  const Game = window.Game;
  if (kind === 'prebattle') {
    try { const st = Game && Game.getState ? Game.getState() : null; if (st && st.running) { return; } } catch(_){ }
    if (window.__firstMatchStarted) { return; }
    if (window.__suppressPrebattle) { return; }
    if (state.overlayMusic.type === 'prebattle' && state.overlayMusic.audio && !state.overlayMusic.audio.paused) { return; }
  }
  
  stopAllMusic('playOverlayMusic:'+kind);
  if (state.overlayMusic.audio){
    if (state.overlayMusic.type === kind) {
      if (state.overlayMusic._isAudioMixer) {
        // Audio mixer track should already be playing
        return;
      } else {
        // Traditional audio - try to resume
        try { 
          if (state.overlayMusic.audio.paused) {
            state.overlayMusic.audio.play().catch(err=>console.warn('[OverlayMusic] resume failed', kind, err)); 
          }
        } catch(_){ }
        return;
      }
    }
    // Different kind - stop current and continue to play new
    if (state.overlayMusic._isAudioMixer && window.__audioMixer) {
      window.__audioMixer.stop(state.overlayMusic.audio, 200);
    } else {
      try { state.overlayMusic.audio.pause(); } catch(_){ }
    }
    state.overlayMusic.type = null; 
    state.overlayMusic.audio = null; 
    state.overlayMusic._deferPlay = false;
    state.overlayMusic._isAudioMixer = false;
  }
  let file = null;
  if (kind === 'prebattle') { file = 'app://assets/ui/default.mp3'; if (state.bossAudio.music){ try { state.bossAudio.music.pause(); } catch(_){} } }
  else if (kind === 'victory') file = 'app://assets/ui/victory.mp3';
  else if (kind === 'defeat') file = 'app://assets/ui/defeat.mp3';
  if (!file) return;
  
  // Check if we should defer playback
  const shouldDefer = typeof window.waitingActive !== 'undefined' && window.waitingActive;
  
  const audioId = playAudioEnhanced(file, {
    group: 'music',
    volume: 0.6,
    loop: true,
    id: `overlay-${kind}`,
    fadeIn: shouldDefer ? 0 : 300, // Shorter fade-in (300ms instead of 500ms)
    delay: 0
  });
  
  if (typeof audioId === 'string') {
    // Using audio mixer
    state.overlayMusic.type = kind; 
    state.overlayMusic.audio = audioId; // Store track ID instead of audio object
    state.overlayMusic._isAudioMixer = true; // Flag to indicate audio mixer usage
    
    if (shouldDefer) {
      // Pause the track immediately since it auto-played
      if (window.__audioMixer) {
        window.__audioMixer.setTrackVolume(audioId, 0); // Mute instead of stop to preserve state
      }
      state.overlayMusic._deferPlay = true;
      console.log('[OverlayMusic] Deferred enhanced audio track until waiting dismissed', kind);
    } else {
      state.overlayMusic._deferPlay = false;
      console.log('[OverlayMusic] Playing enhanced audio for', kind);
    }
  } else {
    // Fallback to traditional audio
    const a = audioId;
    a.loop = true; 
    
    // Use AudioMixer for volume if available
    if (window.__audioMixer) {
      a.volume = window.__audioMixer.calculateCategoryVolume('music');
      console.log('[Audio] Overlay music volume set via AudioMixer:', a.volume);
    } else {
      a.volume = 0.6;
    }
    
    state.overlayMusic.type = kind; 
    state.overlayMusic.audio = a; 
    state.overlayMusic._isAudioMixer = false;
    
    if (shouldDefer) {
      state.overlayMusic._deferPlay = true;
      console.log('[OverlayMusic] Deferred overlay track until waiting dismissed', kind);
    } else {
      state.overlayMusic._deferPlay = false;
      a.play().catch(err=>{ console.warn('[OverlayMusic] play failed', kind, err); });
    }
  }
}

function stopOverlayMusic(kind){
  if (!state.overlayMusic.audio) return;
  if (kind && state.overlayMusic.type !== kind) return;
  
  if (state.overlayMusic._isAudioMixer && window.__audioMixer) {
    // Using audio mixer - stop by track ID
    window.__audioMixer.stop(state.overlayMusic.audio, 300); // 300ms fade out
  } else {
    // Traditional audio object
    try { 
      if (state.overlayMusic.audio.pause) {
        state.overlayMusic.audio.pause(); 
      }
    } catch(_){ }
  }
  
  state.overlayMusic.type = null; 
  state.overlayMusic.audio = null; 
  state.overlayMusic._deferPlay = false;
  state.overlayMusic._isAudioMixer = false;
}

function onWaitingDismissed(){
  if (state.overlayMusic._deferPlay && state.overlayMusic.audio){
    const kind = state.overlayMusic.type;
    state.overlayMusic._deferPlay = false;
    
    if (state.overlayMusic._isAudioMixer && window.__audioMixer) {
      // Resume audio mixer track by unmuting and adding fade in
      setTimeout(()=>{ 
        try { 
          window.__audioMixer.setTrackVolume(state.overlayMusic.audio, 0.6, 500); // Fade in over 500ms
          console.log('[OverlayMusic] Resumed enhanced audio for', kind);
        } catch(err) { 
          console.warn('[OverlayMusic] Enhanced audio resume failed', kind, err); 
        } 
      }, 60);
    } else {
      // Traditional audio object - resume playback
      setTimeout(()=>{ 
        try { 
          state.overlayMusic.audio.play().catch(err=>console.warn('[OverlayMusic] deferred play failed', kind, err)); 
        } catch(_){ } 
      }, 60);
    }
  }
  // Play boss welcome.mp3 if it was previously skipped due to waitingActive
  tryStartBossMusic();
  // Get current boss info from Game state
  try {
    const Game = window.Game;
    if (Game && Game.getState) {
      const st = Game.getState();
      const bossName = st.boss && st.boss.name ? st.boss.name : '';
      if (bossName) {
        // Normalize boss folder name
        const folderName = bossName.toLowerCase().replace(/ /g, '-');
        const welcomePath = `assets/boss/${folderName}/welcome.mp3`;
        // Only play if not already played for this boss
        if (window.__audioModule && window.__audioModule.playBossWelcome) {
          window.__audioModule.playBossWelcome(welcomePath, bossName);
        }
      }
    }
  } catch(e) { console.warn('[BossWelcome][onWaitingDismissed] Failed to play welcome.mp3', e); }
}

function scheduleBossMusicStart(){
  _clearBossMusicTimers();
  const t1 = setTimeout(()=>{ tryStartBossMusic(); }, 180); state.timers.boss.push({ id:t1 });
  let retries = 0; const interval = setInterval(()=>{ if (retries++>4){ clearInterval(interval); return; } tryStartBossMusic(); }, 500); state.timers.boss.push({ id:interval, kind:'i' });
}

// Add user interaction handler to enable audio context
let hasUserInteracted = false;

function enableAudioOnInteraction() {
  if (hasUserInteracted) return;
  
  console.log('[Audio] User interaction detected - enabling audio context');
  hasUserInteracted = true;
  
  // Try to resume any suspended audio contexts
  if (window.__audioMixer && window.__audioMixer.audioContext) {
    if (window.__audioMixer.audioContext.state === 'suspended') {
      console.log('[Audio] Resuming AudioMixer audio context');
      window.__audioMixer.audioContext.resume().then(() => {
        console.log('[Audio] AudioMixer audio context resumed successfully');
      }).catch(e => {
        console.warn('[Audio] Failed to resume AudioMixer audio context:', e);
      });
    } else {
      console.log('[Audio] AudioMixer audio context state:', window.__audioMixer.audioContext.state);
    }
  }
  
  // Try to start any deferred audio that's waiting
  if (state.overlayMusic._deferPlay && !window.waitingActive) {
    onWaitingDismissed();
  }
}

// Set up global interaction listeners for audio enablement
if (typeof document !== 'undefined') {
  document.addEventListener('click', enableAudioOnInteraction, { once: false });
  document.addEventListener('keydown', enableAudioOnInteraction, { once: false });
}

// Update AudioMixer settings when game settings change
function updateAudioSettings(gameSettings) {
  if (window.__audioMixer && gameSettings && gameSettings.audioSettings) {
    window.__audioMixer.updateAudioSettings(gameSettings);
    console.log('[Audio] AudioMixer settings updated from game settings');
  }
}

function exposeGlobals(target){
  target.stopAllMusic = stopAllMusic;
  target.playOverlayMusic = playOverlayMusic;
  target.stopOverlayMusic = stopOverlayMusic;
  target.initBossAudio = initBossAudio;
  target.tryStartBossMusic = tryStartBossMusic;
  target.playBossSfx = playBossSfx;
  target.__audioState = state;
  target.scheduleBossMusicStart = scheduleBossMusicStart;
  target.playBossWelcome = playBossWelcome;
  target.resetBossWelcomeFlag = resetBossWelcomeFlag;
  target.enableAudioOnInteraction = enableAudioOnInteraction; // Expose for manual triggering
  target.updateAudioSettings = updateAudioSettings; // Expose for settings updates
}

const api = { state, stopAllMusic, initBossAudio, tryStartBossMusic, playBossSfx, playOverlayMusic, stopOverlayMusic, onWaitingDismissed, scheduleBossMusicStart, updateAudioSettings, exposeGlobals };
global.__audioModule = api; exposeGlobals(global);

// Notify AudioMixer that the audio system is ready
if (window.__audioMixer && typeof window.__audioMixer.onAudioSystemReady === 'function') {
  console.log('[Audio] Notifying AudioMixer that audio system is ready');
  window.__audioMixer.onAudioSystemReady();
}
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

