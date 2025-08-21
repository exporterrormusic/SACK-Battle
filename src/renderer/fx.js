// fx.js - flash & particle effects
// Unified Animation Timing Constants
const ANIMATION_TIMING = {
  // Flash effect durations (milliseconds)
  FLASH_DURATIONS: {
    growl: 760,
    special: 1500,
    massheal: 1150,
    attackup: 1250,
    burst: 1800,
    default: 1000
  },
  
  // Burst animation timing
  BURST: {
    DURATION_MS: 3500,
    MAX_ACTIVE: 6,
    SLIDE_IN_DELAY: 1200,
    DISSOLVE_DELAY: 2000,
    QUEUE_DELAY: 100 // ms between burst animations
  },
  
  // Layer cleanup timing
  LAYER_CLEANUP: {
    burst: 2000,
    default: 1600,
    overflow_restore_delay: 30
  },
  
  // System delays
  SYSTEM: {
    queue_init_delay: 50 // Delay to ensure AnimationQueueManager loads
  }
};

(function(global){
  // ...existing code...


  function spawnParticles(type) {
    const bf = document.getElementById('battlefield-container');
    if (!bf) return;
    
    const layer = document.createElement('div');
    layer.className = type === 'burst' ? 'burst-particles' : 'growl-particles';
    bf.appendChild(layer);
    
    if (type === 'burst') {
      // Create burst energy waves
      for (let i = 0; i < 3; i++) {
        const wave = document.createElement('div');
        wave.className = 'burst-wave';
        wave.style.animationDelay = (i * 100) + 'ms';
        layer.appendChild(wave);
      }
      // Create burst sparks
      for (let i = 0; i < 15; i++) {
        const sp = document.createElement('div');
        sp.className = 'burst-spark';
        const angle = (Math.PI * 2 * i) / 15;
        const distance = 80 + Math.random() * 60;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        sp.style.setProperty('--tx', tx + 'px');
        sp.style.setProperty('--ty', ty + 'px');
        sp.style.left = (window.innerWidth / 2) + 'px';
        sp.style.top = (window.innerHeight / 2) + 'px';
        sp.style.animationDelay = (Math.random() * 200) + 'ms';
        layer.appendChild(sp);
      }
    } else {
      // Growl effects (rings)
      for (let r = 0; r < 2; r++) {
        const ring = document.createElement('div');
        ring.className = 'ring';
        ring.style.animationDelay = (r * 150) + 'ms';
        layer.appendChild(ring);
      }
    }
    
    setTimeout(() => layer.remove(), ANIMATION_TIMING.LAYER_CLEANUP[type] || ANIMATION_TIMING.LAYER_CLEANUP.default);
  }
  function flash(type) {
    const area = document.getElementById('players-container');
    if (!area) return;
    
    area.querySelectorAll('.fx-flash').forEach(n => n.remove());
    const div = document.createElement('div');
    
    // Map 'attack' to 'attackup' for backwards compatibility
    const mappedType = type === 'attack' ? 'attackup' : type;
    const allowed = ['growl', 'special', 'massheal', 'attackup', 'burst'];
    if (!allowed.includes(mappedType)) return;
    
    div.className = 'fx-flash ' + mappedType;
    area.appendChild(div);
    
    const life = ANIMATION_TIMING.FLASH_DURATIONS[mappedType] || ANIMATION_TIMING.FLASH_DURATIONS.default;
                 
    const prev = area.style.overflow;
    area.style.overflow = 'hidden';
    setTimeout(() => div.remove(), life);
    setTimeout(() => area.style.overflow = prev || '', life + ANIMATION_TIMING.LAYER_CLEANUP.overflow_restore_delay);
    
    if (!['massheal', 'growl'].includes(type)) {
      spawnParticles(type === 'special' ? 'burst' : type);
    }
  }
  function shake(){ document.querySelectorAll('.player-card').forEach(c=>{ c.classList.remove('shake-hit'); void c.offsetWidth; c.classList.add('shake-hit'); }); }

  // Unified burst animation queue - migrated to AnimationQueueManager
  let burstQueue; // Will be initialized after AnimationQueueManager loads
  const _BURST_DURATION_MS = ANIMATION_TIMING.BURST.DURATION_MS;
  const _BURST_MAX_ACTIVE = ANIMATION_TIMING.BURST.MAX_ACTIVE;

  // Initialize the burst animation queue using the unified manager
  function initializeBurstQueue() {
    if (window.AnimationQueueManager && !burstQueue) {
      burstQueue = window.AnimationQueueManager.registerQueue(
        'bursts', 
        burstAnimationProcessor, 
        ANIMATION_TIMING.BURST.QUEUE_DELAY
      );
      console.log('[BurstFX] Initialized unified animation queue');
    }
  }

  // Processor function for burst animations - called by the queue manager
  function burstAnimationProcessor(burstData, onComplete) {
    const { playerName, avatarSrc } = burstData;
    console.log('[BurstFX] Processing burst animation for:', playerName);
    _processBurstInternal(playerName, avatarSrc, onComplete);
  }

  function _burstEnsureLayer() {
    // Use document.body directly to ensure highest z-index context
    let host = document.body;
    if (!host._burstStage) {
      const stage = global.__createDiv({
        className: 'burst-anim-stage',
        styles: {
          position: 'fixed', // Use fixed positioning to escape any container constraints
          left: '0',
          top: '0',
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: '9999' // Use very high z-index
        }
      });
      host.appendChild(stage);
      host._burstStage = stage;
      console.log('[BurstFX] Created burst stage with z-index:', stage.style.zIndex, 'positioned on:', host.tagName);
    }
    return host._burstStage;
  }

  function _createBurstVisual(playerName, avatarSrc) {
    const wrap = global.__createDiv({
      className: 'burst-attack-card',
      dataset: { player: playerName, ts: Date.now() },
      styles: {
        position: 'absolute',
        left: '-500px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '450px',
        height: '600px',
        pointerEvents: 'none',
        zIndex: '10000' // Use very high z-index
      }
    });

    // Create large avatar card
    const card = global.__createDiv({
      className: 'burst-card-container',
      styles: {
        width: '100%',
        height: '100%',
        borderRadius: '25px',
        background: 'linear-gradient(145deg, #FFD700, #FFA500)',
        boxShadow: '0 0 50px rgba(255, 215, 0, 0.95), inset 0 0 25px rgba(255, 255, 255, 0.4)',
        border: '6px solid #FFD700',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }
    });

    // Avatar image - much larger and crisp
    const avatar = global.__createImage(avatarSrc, {
      className: 'burst-card-avatar',
      styles: {
        width: '85%',
        height: '80%',
        borderRadius: '20px',
        objectFit: 'cover',
        objectPosition: 'top', // Crop from bottom instead of center
        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.5))',
        animation: 'burstCardPulse 0.6s ease-in-out infinite alternate',
        imageRendering: 'crisp-edges' // Remove blur/anti-aliasing
      }
    });

    // Player name label
    const nameLabel = global.__createDiv({
      className: 'burst-card-name',
      textContent: playerName,
      styles: {
        position: 'absolute',
        bottom: '15px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#000',
        fontWeight: 'bold',
        fontSize: '22px',
        textShadow: '2px 2px 4px rgba(255,255,255,0.9)',
        fontFamily: 'Arial, sans-serif'
      }
    });

    // Speed lines container for movement effect
    const speedLines = document.createElement('div');
    speedLines.className = 'burst-speed-lines';
    Object.assign(speedLines.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      overflow: 'hidden'
    });

    // Create multiple speed lines
    for (let i = 0; i < 12; i++) {
      const line = document.createElement('div');
      line.className = `burst-speed-line line-${i}`;
      Object.assign(line.style, {
        position: 'absolute',
        width: '4px',
        height: '120px',
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
        top: `${Math.random() * 80 + 10}%`,
        left: '-10px',
        transform: `rotate(${-15 + Math.random() * 10}deg)`,
        animation: `burstSpeedLine 0.8s ease-out ${i * 0.05}s forwards`
      });
      speedLines.appendChild(line);
    }

    // Impact flash effect
    const impactFlash = document.createElement('div');
    impactFlash.className = 'burst-impact-flash';
    Object.assign(impactFlash.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.8) 0%, transparent 70%)',
      opacity: '0',
      pointerEvents: 'none',
      borderRadius: '25px'
    });

    // Energy effects - cleaner without blur
    const energyRings = document.createElement('div');
    energyRings.className = 'burst-energy-rings';
    Object.assign(energyRings.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '130%',
      height: '130%',
      pointerEvents: 'none'
    });

    // Create multiple energy rings
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div');
      ring.className = `burst-energy-ring ring-${i}`;
      Object.assign(ring.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        border: '4px solid rgba(255, 215, 0, 0.7)',
        borderRadius: '50%',
        width: `${90 + i * 50}%`,
        height: `${90 + i * 50}%`,
        animation: `burstEnergyRing 1.2s ease-in-out infinite ${i * 0.2}s`
      });
      energyRings.appendChild(ring);
    }

    card.appendChild(avatar);
    card.appendChild(nameLabel);
    card.appendChild(speedLines);
    card.appendChild(impactFlash);
    card.appendChild(energyRings);
    wrap.appendChild(card);

    return wrap;
  }

  function _playBurstAudio(avatarSrc) {
    try {
      // Extract avatar folder from path like "app://assets/avatars/alice/alice.png"
      const pathParts = avatarSrc.split('/');
      const avatarFolder = pathParts[pathParts.length - 2]; // Get folder name
      
      if (!avatarFolder) return;
      
      // Try both .mp3 and .wav
      const audioExtensions = ['mp3', 'wav'];
      
      for (const ext of audioExtensions) {
        try {
          const burstPath = `app://assets/avatars/${avatarFolder}/burst.${ext}`;
          const constants = global.AUDIO_CONSTANTS || {};
          const burstVolume = constants.BURST_ATTACK_VOLUME || 0.85;
          
          // Use unified audio creation helper
          const audio = global.createAudioWithVolume(burstPath, 'sfx', burstVolume, { 
            loop: false, 
            preload: 'auto' 
          });
          
          audio.play().then(() => {
            console.log(`[Burst] Playing audio: ${burstPath}`);
          }).catch(() => {
            // If this extension fails, the loop will try the next one
          });
          break; // If successful, stop trying other extensions
        } catch (e) {
          // Continue to next extension
        }
      }
    } catch (err) {
      console.warn('[Burst] Audio play failed', err);
    }
  }

  function _processBurstInternal(playerName, avatarSrc, onComplete) {
    try {
      const stage = _burstEnsureLayer();
      if (!stage) {
        onComplete();
        return;
      }
      
      // Clean up old animations if too many
      const activeAnimations = stage.querySelectorAll('.burst-attack-card');
      if (activeAnimations.length >= _BURST_MAX_ACTIVE) {
        if (stage.firstChild) stage.firstChild.remove();
      }
      
      const burstCard = _createBurstVisual(playerName, avatarSrc);
      stage.appendChild(burstCard);
      
      console.log('[BurstFX] Created burst card for', playerName, 'with z-index:', burstCard.style.zIndex);
      
      // Play sound effect
      _playBurstAudio(avatarSrc);
      
      // Trigger animations
      void burstCard.offsetWidth; // Force reflow
      
      // Slide in animation
      burstCard.style.animation = 'burstCardSlideIn 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
      
      // Attack flash effect after slide in
      setTimeout(() => {
        burstCard.style.animation = 'burstCardAttack 0.8s ease-in-out forwards';
        
        // Trigger impact flash
        const impactFlash = burstCard.querySelector('.burst-impact-flash');
        if (impactFlash) {
          // Set CSS custom properties for impact flash animation
          impactFlash.style.setProperty('--flash-scale-start', '0.8');
          impactFlash.style.setProperty('--flash-scale-peak', '1.2');
          impactFlash.style.setProperty('--flash-scale-mid', '1.2');
          impactFlash.style.setProperty('--flash-scale-fade', '1.2');
          impactFlash.style.setProperty('--flash-scale-end', '1.5');
          impactFlash.style.setProperty('--flash-opacity-peak', '1');
          impactFlash.style.setProperty('--flash-opacity-mid', '1');
          impactFlash.style.setProperty('--flash-opacity-fade', '1');
          impactFlash.style.animation = 'flashEffect 0.4s ease-out forwards';
        }
        
        // Screen flash effect
        if (window.flashBattlefield) window.flashBattlefield('burst');
      }, ANIMATION_TIMING.BURST.SLIDE_IN_DELAY);
      
      // Dissolve effect
      setTimeout(() => {
        burstCard.style.animation = 'burstCardDissolve 1.5s ease-in-out forwards';
      }, ANIMATION_TIMING.BURST.DISSOLVE_DELAY);
      
      // Clean up and signal completion to queue manager
      setTimeout(() => {
        burstCard.remove();
        // Signal completion to the animation queue manager
        onComplete();
      }, _BURST_DURATION_MS);
      
    } catch (err) {
      console.warn('[Burst] Animation error', err);
      onComplete(); // Signal completion even on error
    }
  }

  // Enhanced burst attack with large avatar card and queueing
  function animateBurstAttack(playerName, avatarSrc) {
    try {
      // Ensure queue is initialized
      if (!burstQueue) {
        initializeBurstQueue();
      }
      
      if (burstQueue) {
        // Add to unified queue
        burstQueue.enqueue({ playerName, avatarSrc });
      } else {
        console.error('[BurstFX] Animation queue not available, falling back to direct play');
        _processBurstInternal(playerName, avatarSrc, () => {}); // Fallback without queue
      }
    } catch (err) {
      console.warn('[Burst] Queue error', err);
    }
  }

  // Initialize the burst queue when the script loads
  setTimeout(initializeBurstQueue, ANIMATION_TIMING.SYSTEM.queue_init_delay);

  global.flashBattlefield = flash; 
  global.shakeHitPlayers = shake;
  global.animateBurstAttack = animateBurstAttack;
})(typeof window!=='undefined'?window:globalThis);
