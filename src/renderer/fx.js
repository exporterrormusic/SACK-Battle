// fx.js - flash & particle effects
// ...existing code...
(function(global){
  // ...existing code...

  // Multi-avatar attack animation (sideways V formation)
  global.animateMultiAttack = function(players) {
    console.log('[MultiAttack] Function called with players:', players);
    if (!Array.isArray(players) || players.length === 0) return;
    
    // Use the same burst stage that works for burst animations
    const stage = _burstEnsureLayer();
    if (!stage) {
      console.warn('[MultiAttack] Could not create stage');
      return;
    }
    
    // Remove previous multi-attack visuals
    stage.querySelectorAll('.multi-attack-card').forEach(n => n.remove());
    // Position logic for 1, 2, or 3 avatars (centered as a group in players-container)
    // Adjusted to move further left and space out more
    let positions;
    if (players.length === 1) {
      // Single card centered, same size as the main card in 3-player version
      positions = [ { left: '25%', top: '35%', scale: '1.8' } ]; // Same scale as right card in 3-player
    } else if (players.length === 2) {
      // Two cards side by side, bigger and well spaced apart
      positions = [
        { left: '15%', top: '35%', scale: '1.4' }, // Left card, larger
        { left: '35%', top: '35%', scale: '1.4' }  // Right card, larger, more spacing (20% gap)
      ];
    } else {
      // 3 avatars: V formation, more spacing and further left
      positions = [
        { left: '15%', top: '20%', scale: '0.9' }, // left side of V, further left
        { left: '35%', top: '35%', scale: '1.8' }, // right side of V (double size), moved left
        { left: '15%', top: '50%', scale: '0.9' }  // left side of V, further left
      ];
    }
    players.forEach((p, i) => {
      // Use burst card visuals for full player card effect
      const wrap = document.createElement('div');
      wrap.className = 'multi-attack-card';
      Object.assign(wrap.style, {
        position: 'absolute',
        left: positions[i].left,
        top: positions[i].top,
        width: '260px',
        height: '320px',
        zIndex: 10001,
        pointerEvents: 'none',
        transform: `scale(${positions[i].scale})`,
        transition: 'opacity 0.3s',
        opacity: '1'
      });
      // Create burst card container
      const card = document.createElement('div');
      card.className = 'burst-card-container';
      Object.assign(card.style, {
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
      });
      // Avatar image - adjusted to match burst card positioning
      const avatar = document.createElement('img');
      avatar.src = p.avatarSrc;
      avatar.className = 'burst-card-avatar';
      Object.assign(avatar.style, {
        width: '85%',
        height: '75%', // Reduced from 80% to push avatar slightly higher like burst cards
        borderRadius: '20px',
        objectFit: 'cover',
        objectPosition: 'top', // Crop from bottom instead of center
        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.5))',
        animation: 'burstCardPulse 0.6s ease-in-out infinite alternate',
        imageRendering: 'crisp-edges',
        marginTop: '-5%' // Push avatar up slightly to match burst card positioning
      });
      // Name label - adjusted position to match burst card relative placement
      const nameLabel = document.createElement('div');
      nameLabel.textContent = p.name;
      nameLabel.className = 'burst-card-name';
      Object.assign(nameLabel.style, {
        position: 'absolute',
        bottom: '8px', // Adjusted from 15px to match relative position on smaller cards
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#000',
        fontWeight: 'bold',
        fontSize: '22px',
        textShadow: '2px 2px 4px rgba(255,255,255,0.9)',
        fontFamily: 'Arial, sans-serif'
      });
      // Speed lines
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
      for (let j = 0; j < 12; j++) {
        const line = document.createElement('div');
        line.className = `burst-speed-line line-${j}`;
        Object.assign(line.style, {
          position: 'absolute',
          width: '4px',
          height: '120px',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
          top: `${Math.random() * 80 + 10}%`,
          left: '-10px',
          transform: `rotate(${-15 + Math.random() * 10}deg)`,
          animation: `burstSpeedLine 0.8s ease-out ${j * 0.05}s forwards`
        });
        speedLines.appendChild(line);
      }
      // Impact flash
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
      // Energy rings
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
      for (let j = 0; j < 3; j++) {
        const ring = document.createElement('div');
        ring.className = `burst-energy-ring ring-${j}`;
        Object.assign(ring.style, {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          border: '4px solid rgba(255, 215, 0, 0.7)',
          borderRadius: '50%',
          width: `${90 + j * 50}%`,
          height: `${90 + j * 50}%`,
          animation: `burstEnergyRing 1.2s ease-in-out infinite ${j * 0.2}s`
        });
        energyRings.appendChild(ring);
      }
      card.appendChild(avatar);
      card.appendChild(nameLabel);
      card.appendChild(speedLines);
      card.appendChild(impactFlash);
      card.appendChild(energyRings);
      wrap.appendChild(card);
      // Smooth animation: slide from left with single transition
      wrap.style.left = '-300px'; // Start from off-screen left
      wrap.style.transform = `scale(${positions[i].scale}) rotate(-5deg)`;
      wrap.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      
      // Trigger slide in
      setTimeout(() => {
        wrap.style.left = positions[i].left;
        wrap.style.transform = `scale(${positions[i].scale}) rotate(0deg)`;
      }, 100);
      
      // Attack lunge (reduced rightward movement)
      setTimeout(() => {
        wrap.style.transition = 'transform 0.3s ease-out';
        const baseScale = parseFloat(positions[i].scale);
        const attackScale = baseScale + 0.05;
        wrap.style.transform = `scale(${attackScale}) translateX(10px) rotate(2deg)`; // Reduced from 20px to 10px
        
        // Impact flash during attack
        const impactFlash = wrap.querySelector('.burst-impact-flash');
        if (impactFlash) {
          impactFlash.style.animation = 'burstImpactFlash 0.3s ease-out forwards';
        }
      }, 1000);
      
      // Recoil back
      setTimeout(() => {
        wrap.style.transform = `scale(${positions[i].scale}) translateX(-5px) rotate(-1deg)`;
      }, 1300);
      setTimeout(() => {
        wrap.style.transition = 'opacity 0.8s ease-out';
        wrap.style.opacity = '0';
        setTimeout(() => wrap.remove(), 800);
      }, 2000);
      stage.appendChild(wrap);
      console.log('[MultiAttack] Added card for:', p.name, 'at position:', positions[i]);
      // Play attack.mp3 for the middle avatar (or only one)
      if ((players.length === 1 && i === 0) || (players.length === 3 && i === 1) || (players.length === 2 && i === 1)) {
        try {
          const avatarFolder = p.avatar.split('/')[0];
          const attackPath = `app://assets/avatars/${avatarFolder}/attack.mp3`;
          let audio;
          if (window.SackBattle?.utils?.audio) {
            audio = window.SackBattle.utils.audio.createAudio(attackPath, 'sfx', 0.85);
          } else {
            audio = new Audio(attackPath);
            audio.loop = false;
            if (window.__audioMixer) {
              audio.volume = window.__audioMixer.calculateCategoryVolume('sfx', 0.85);
            } else {
              audio.volume = 0.85;
            }
          }
          audio.preload = 'auto';
          audio.play().catch(() => {});
        } catch (err) {
          console.warn('[MultiAttack] Audio play failed', err);
        }
      }
    });
  };
  function spawnParticles(type){ const bf=document.getElementById('battlefield-container'); if(!bf) return; const layer=document.createElement('div'); layer.className=type==='attack'?'attack-particles':(type==='burst'?'burst-particles':'growl-particles'); bf.appendChild(layer); if(type==='attack'){ const flame=[{l:30,b:26},{l:72,b:38},{l:118,b:30},{l:162,b:44}]; flame.forEach((p,i)=>{ const f=document.createElement('div'); f.className='flame'; f.style.left=p.l+'px'; f.style.bottom=p.b+'px'; f.style.animationDelay=(i*70)+'ms'; layer.appendChild(f); }); const smoke=[{l:80,b:58,d:160},{l:132,b:70,d:280},{l:184,b:62,d:400}]; smoke.forEach(p=>{ const s=document.createElement('div'); s.className='smoke'; s.style.left=p.l+'px'; s.style.bottom=p.b+'px'; s.style.animationDelay=p.d+'ms'; layer.appendChild(s); }); for(let i=0;i<10;i++){ const sp=document.createElement('div'); sp.className='spark'; const tx=(Math.random()*160-80); const ty=(-40-Math.random()*100); sp.style.setProperty('--tx',tx+'px'); sp.style.setProperty('--ty',ty+'px'); sp.style.left=(window.innerWidth/2+(Math.random()*120-60))+'px'; sp.style.top=(window.innerHeight/2+(Math.random()*80-40))+'px'; sp.style.animationDelay=(80+Math.random()*180)+'ms'; layer.appendChild(sp);} } else if(type==='burst') { 
    // Create burst energy waves
    for(let i=0;i<3;i++){ 
      const wave=document.createElement('div'); 
      wave.className='burst-wave'; 
      wave.style.animationDelay=(i*100)+'ms'; 
      layer.appendChild(wave);
    } 
    // Create burst sparks
    for(let i=0;i<15;i++){ 
      const sp=document.createElement('div'); 
      sp.className='burst-spark'; 
      const angle = (Math.PI * 2 * i) / 15;
      const distance = 80 + Math.random() * 60;
      const tx = Math.cos(angle) * distance; 
      const ty = Math.sin(angle) * distance; 
      sp.style.setProperty('--tx',tx+'px'); 
      sp.style.setProperty('--ty',ty+'px'); 
      sp.style.left=(window.innerWidth/2)+'px'; 
      sp.style.top=(window.innerHeight/2)+'px'; 
      sp.style.animationDelay=(Math.random()*200)+'ms'; 
      layer.appendChild(sp);
    } 
  } else { for(let r=0;r<2;r++){ const ring=document.createElement('div'); ring.className='ring'; ring.style.animationDelay=(r*150)+'ms'; layer.appendChild(ring);} } setTimeout(()=>layer.remove(),type==='burst'?2000:1600); }
  function flash(type){ const area=document.getElementById('players-container'); if(!area) return; area.querySelectorAll('.fx-flash').forEach(n=>n.remove()); const div=document.createElement('div'); const allowed=['attack','growl','special','massheal','attackup','burst']; if(!allowed.includes(type)) return; div.className='fx-flash '+type; area.appendChild(div); const life= type==='attack'?1050: (type==='growl'?760:(type==='special'?1500:(type==='massheal'?1150:(type==='attackup'?1250:(type==='burst'?1800:1000))))); const prev=area.style.overflow; area.style.overflow='hidden'; setTimeout(()=>div.remove(),life); setTimeout(()=> area.style.overflow=prev||'', life+30); if(!['massheal','growl'].includes(type)) spawnParticles(type==='special'?'attack':type); }
  function shake(){ document.querySelectorAll('.player-card').forEach(c=>{ c.classList.remove('shake-hit'); void c.offsetWidth; c.classList.add('shake-hit'); }); }

  // Burst animation queue and system
  const _BURST_QUEUE = [];
  let _burstAnimationActive = false;
  const _BURST_DURATION_MS = 3500;
  const _BURST_MAX_ACTIVE = 6;

  function _burstEnsureLayer() {
    // Use document.body directly to ensure highest z-index context
    let host = document.body;
    if (!host._burstStage) {
      const stage = document.createElement('div');
      stage.className = 'burst-anim-stage';
      Object.assign(stage.style, {
        position: 'fixed', // Use fixed positioning to escape any container constraints
        left: '0',
        top: '0',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: '9999' // Use very high z-index
      });
      host.appendChild(stage);
      host._burstStage = stage;
      console.log('[BurstFX] Created burst stage with z-index:', stage.style.zIndex, 'positioned on:', host.tagName);
    }
    return host._burstStage;
  }

  function _createBurstVisual(playerName, avatarSrc) {
    const wrap = document.createElement('div');
    wrap.className = 'burst-attack-card';
    wrap.dataset.player = playerName;
    wrap.dataset.ts = Date.now();
    
    Object.assign(wrap.style, {
      position: 'absolute',
      left: '-500px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '450px',
      height: '600px',
      pointerEvents: 'none',
      zIndex: '10000' // Use very high z-index
    });

    // Create large avatar card
    const card = document.createElement('div');
    card.className = 'burst-card-container';
    Object.assign(card.style, {
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
    });

    // Avatar image - much larger and crisp
    const avatar = document.createElement('img');
    avatar.src = avatarSrc;
    avatar.className = 'burst-card-avatar';
    Object.assign(avatar.style, {
      width: '85%',
      height: '80%',
      borderRadius: '20px',
      objectFit: 'cover',
      objectPosition: 'top', // Crop from bottom instead of center
      filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.5))',
      animation: 'burstCardPulse 0.6s ease-in-out infinite alternate',
      imageRendering: 'crisp-edges' // Remove blur/anti-aliasing
    });

    // Player name label
    const nameLabel = document.createElement('div');
    nameLabel.textContent = playerName;
    nameLabel.className = 'burst-card-name';
    Object.assign(nameLabel.style, {
      position: 'absolute',
      bottom: '15px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: '#000',
      fontWeight: 'bold',
      fontSize: '22px',
      textShadow: '2px 2px 4px rgba(255,255,255,0.9)',
      fontFamily: 'Arial, sans-serif'
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
          let audio;
          if (window.SackBattle?.utils?.audio) {
            audio = window.SackBattle.utils.audio.createAudio(burstPath, 'sfx', 0.85);
          } else {
            audio = new Audio(burstPath);
            audio.loop = false;
            if (window.__audioMixer) {
              audio.volume = window.__audioMixer.calculateCategoryVolume('sfx', 0.85);
            } else {
              audio.volume = 0.85;
            }
          }
          audio.preload = 'auto';
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

  function _processBurstQueue() {
    if (_burstAnimationActive || _BURST_QUEUE.length === 0) return;
    
    const { playerName, avatarSrc } = _BURST_QUEUE.shift();
    _burstAnimationActive = true;
    
    try {
      const stage = _burstEnsureLayer();
      if (!stage) {
        _burstAnimationActive = false;
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
          impactFlash.style.animation = 'burstImpactFlash 0.4s ease-out forwards';
        }
        
        // Screen flash effect
        if (window.flashBattlefield) window.flashBattlefield('burst');
      }, 1200);
      
      // Dissolve effect
      setTimeout(() => {
        burstCard.style.animation = 'burstCardDissolve 1.5s ease-in-out forwards';
      }, 2000);
      
      // Clean up and process next in queue
      setTimeout(() => {
        burstCard.remove();
        _burstAnimationActive = false;
        // Process next burst in queue
        setTimeout(_processBurstQueue, 100);
      }, _BURST_DURATION_MS);
      
    } catch (err) {
      console.warn('[Burst] Animation error', err);
      _burstAnimationActive = false;
      setTimeout(_processBurstQueue, 100);
    }
  }

  // Enhanced burst attack with large avatar card and queueing
  function animateBurstAttack(playerName, avatarSrc) {
    try {
      // Add to queue
      _BURST_QUEUE.push({ playerName, avatarSrc });
      console.log(`[Burst] Queued burst for ${playerName}, queue length: ${_BURST_QUEUE.length}`);
      
      // Process queue
      _processBurstQueue();
    } catch (err) {
      console.warn('[Burst] Queue error', err);
    }
  }

  global.flashBattlefield = flash; 
  global.shakeHitPlayers = shake;
  global.animateBurstAttack = animateBurstAttack;
})(typeof window!=='undefined'?window:globalThis);
