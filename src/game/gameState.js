// gameState.js (moved from project root)
// Plain script, no modules, exposes window.Game
(function (window) {
  // Original implementation preserved from root file.
  const listeners = [];
  const settings = { bossHp: 100, turnLength: 30, maxTurns: 6, bossProbabilities: { growl: 0.15, attack: 0.45, cover: 0.15, charge: 0.25 }, twitchClientId: '', twitchClientSecret: '', twitchBotUsername: '', twitchOauthToken: '', twitchChannel: '', twitchTokenScopes: [], twitchTokenExpiresAt: 0, battlefieldImage: '', bossImage: '', bossName: '', rankDefinitions: [ { name: 'Rookie', wins: 0 }, { name: 'Fighter', wins: 5 }, { name: 'Warrior', wins: 10 }, { name: 'Commander', wins: 20 } ], channelPointTriggers: [], bitsThresholds: [], superchatThresholds: [], chatCommands: { 
  twitch: { attack: '!attack', cover: '!cover', heal: '!heal', aggressive: '!strike', burst: '!burst', avatar: '!avatar' },
  youtube: { attack: '!attack', cover: '!cover', heal: '!heal', aggressive: '!aggressive', burst: '!burst', avatar: '!avatar' },
  discord: { attack: '!attack', cover: '!cover', heal: '!heal', aggressive: '!strike', burst: '!burst', avatar: '!avatar' }
}, rules: 'Attack the boss, cover to block damage, heal to regain hearts. Use chat commands: !attack !cover !heal.', respawnMode: 'cooldown', powerfulAttackDamage: 30, waitingBackgroundImage: '', waitingMainLogoImage: '', waitingSecondaryLogoImage: '', bossPlaylist: [], style: { randomizeBattlefield: false, randomizeIntervalMs: 15000 } };
  const state = { players: {}, boss: { hp: settings.bossHp, charged: false, name: '', imageSrc: '', lastMove: null, recovering: false, visualState: null }, bossActionQueue: [], manualBossAction: null, round: 0, maxTurns: settings.maxTurns, secondsLeft: settings.turnLength, pendingBossAction: null, lastBossAction: null, teamScore: 0, running: false, completedMatches: 0, playerRecords: {}, playerDamageThisMatch: {}, lastMatchDamage: null };
  state.attackUpTurns = 0;
  let globalVictoryState = null;
  let countdownInterval = null;
  function finalizeVictory(reason){
    if (globalVictoryState) return;
    if (state.boss.hp > 0) { console.warn('[Victory] Suppressed finalize (boss hp > 0)', { hp: state.boss.hp, reason }); return; }
    globalVictoryState = 'victory';
    stopCountdown();
    state.running = false;
    state.attackUpTurns = 0;
    Object.values(state.players).forEach(p=>{ p.invincibleTurns = 0; });
    if (!state.lastMatchDamage) state.lastMatchDamage = clonePublic(state.playerDamageThisMatch);
    state.playerDamageThisMatch = {};
    state.completedMatches += 1; // single increment here only
    state.teamScore += 1;
    Object.entries(state.players).forEach(([nm,p])=>{
      if (p.hp>0 && !p.isBot){
        p.score = (p.score||0)+1;
        if (!state.playerRecords[nm]) state.playerRecords[nm] = { score:0, reviveItem:false };
        state.playerRecords[nm].score = p.score;
        // Only grant revive item if player does not already have one
        if (!state.playerRecords[nm].reviveItem) {
          p.hasReviveItem = true;
          state.playerRecords[nm].reviveItem = true;
        }
      }
    });
    
    // NOTE: Boss HP is intentionally NOT reset here; UI overlay should persist until explicit Game.start
    console.log('[Victory] Finalized', { reason, bossHp: state.boss.hp, completedMatches: state.completedMatches, running: state.running });
  }
  function clonePublic(obj) { return JSON.parse(JSON.stringify(obj)); }
  function emitUpdate() { const publicState = getPublicState(); listeners.forEach((cb) => { try { cb(publicState); } catch (e) { console.error('game update handler error', e); } }); }
  function getPublicState() { return { players: clonePublic(state.players), boss: { hp: state.boss.hp, charged: state.boss.charged, name: state.boss.name, imageSrc: state.boss.imageSrc, lastMove: state.boss.lastMove, visualState: state.boss.visualState }, victoryState: globalVictoryState, round: state.round, totalRounds: state.maxTurns, secondsLeft: state.secondsLeft, lastBossAction: state.lastBossAction, teamScore: state.teamScore, running: state.running, paused: (state.running && !countdownInterval), pendingBossAction: state.pendingBossAction, settings: { ...settings }, completedMatches: state.completedMatches, matchDamage: clonePublic(state.playerDamageThisMatch), lastMatchDamage: clonePublic(state.lastMatchDamage), attackUpTurns: state.attackUpTurns }; }
  function addPlayerIfMissing(name) {
    if (!state.players[name]) {
      // Use avatar from playerRecords if available, otherwise assign random avatar
      const savedAvatar = state.playerRecords[name]?.avatar;
      let avatarPick = '';
      if (typeof savedAvatar !== 'undefined' && savedAvatar !== null && savedAvatar !== '') {
        avatarPick = savedAvatar;
      } else if (window.__avatarsList && window.__avatarsList.length) {
        avatarPick = window.__avatarsList[Math.floor(Math.random() * window.__avatarsList.length)];
        // Persist random pick for future spawns
        if (!state.playerRecords[name]) state.playerRecords[name] = {};
        state.playerRecords[name].avatar = avatarPick;
        if (window.electronAPI && window.electronAPI.saveSettings && window.electronAPI.loadSettings) {
          window.electronAPI.loadSettings().then(existing => {
            const merged = { ...(existing || {}), playerRecords: state.playerRecords };
            window.electronAPI.saveSettings(merged);
          });
        }
      }
      state.players[name] = {
        hp: 3,
        score: (state.playerRecords[name]?.score) || 0,
        pendingAction: null,
        lastAction: null,
        rank: 0,
        autoReviveNextMatch: false,
        joined: true,
        avatar: avatarPick,
        isBot: false,
        behavior: 'random',
        invincibleTurns: 0,
        hasReviveItem: !!(state.playerRecords[name]?.reviveItem),
        respawnCooldown: 0,
        pendingRespawn: false,
        burstGauge: 0
      };
    }
    // Always clear reviveItem and hasReviveItem on spawn
    if (state.playerRecords[name]) {
      state.playerRecords[name].reviveItem = false;
    }
    if (state.players[name]) {
      state.players[name].hasReviveItem = false;
    }
  }
  
  function addPlayer(name, opts = {}) {
    addPlayerIfMissing(name, opts);
    const p = state.players[name];
    // Preserve avatar if present in opts or already set
    if (opts.avatar) p.avatar = opts.avatar;
    if (opts.isBot !== undefined) p.isBot = !!opts.isBot;
    if (opts.behavior) p.behavior = opts.behavior;
    if (!p.isBot && !state.playerRecords[name]) state.playerRecords[name] = { score: 0, reviveItem: false };
    emitUpdate();
    return true;
  }
  function actionDisplayName(action) { action = (action || '').toLowerCase(); if (action === 'defend') return 'cover'; if (action === 'cover') return 'cover'; if (action === 'attack') return 'attack'; if (action === 'heal') return 'heal'; if (action === 'aggressive') return 'aggressive'; if (action === 'burst') return 'burst'; return ''; }
  function setPlayerAction(name, action) { addPlayerIfMissing(name); const p = state.players[name]; if (!p) return false; if (p.hp <= 0) return false; action = (action || '').toLowerCase(); if (!['attack', 'defend', 'cover', 'heal', 'aggressive', 'burst'].includes(action)) return false; if (action === 'defend') action = 'cover'; if (action === 'burst' && p.burstGauge < 5) return false; p.pendingAction = action; if (!p.isBot) p.repeatAction = action; p.lastAction = actionDisplayName(action); emitUpdate(); return true; }
  function botChooseAction(bot) { 
    const acts = ['attack', 'cover', 'heal']; 
    
    // Always use burst when fully charged
    if (bot.burstGauge >= 5) return 'burst'; 
    
    // Handle specific behaviors
    if (bot.behavior === 'attack') return 'attack'; 
    if (bot.behavior === 'defend') return 'cover'; 
    if (bot.behavior === 'heal' && bot.hp < 3) return 'heal'; 
    if (bot.behavior === 'aggressive') {
      console.log(`[BotChooseAction][DEBUG] Bot with aggressive behavior returning 'aggressive'`);
      return 'aggressive';
    }
    
    // Random behavior with occasional aggressive attacks
    if (Math.random() < 0.1) return 'aggressive'; 
    return acts[Math.floor(Math.random() * acts.length)]; 
  }
  function applyBossAction(action) {
    // Ensure 'action' is always defined
    if (typeof action === 'undefined' || action === null) {
      console.error('[BossAction][ERROR] action is undefined or null');
      return;
    }
    
    state.lastBossAction = action;
    if (action === 'recovering') { return; }
    if (action === 'attack') {
      // Clear visual state for non-sequence actions
      state.boss.visualState = null;
      Object.values(state.players).forEach(target => {
        // Only skip bots if needed, otherwise affect all
        if (target.hp > 0 && target.pendingAction !== 'cover' && target.invincibleTurns <= 0) {
          target.hp -= 1;
          if (target.hp < 0) target.hp = 0;
        }
      });
      console.log('[BossAction] Setting lastMove from', state.boss.lastMove, 'to', action);
      state.boss.lastMove = action;
    } else if (action === 'growl') {
      // Clear visual state for non-sequence actions
      state.boss.visualState = null;
      // No effect
      console.log('[BossAction] Setting lastMove from', state.boss.lastMove, 'to', action);
      state.boss.lastMove = action;
    } else if (action === 'cover') {
      // Boss takes cover - no damage from normal attacks this turn
      state.boss.visualState = 'covered';
      console.log('[BossAction] Setting lastMove from', state.boss.lastMove, 'to', action);
      state.boss.lastMove = action;
    } else if (action === 'charge') {
      // Charge always sets up the sequence, but only if not already in sequence
      if (state.bossActionQueue.length === 0) {
        state.bossActionQueue = ['special', 'cooldown'];
      }
      // Set charging visual state
      state.boss.visualState = 'charging';
      console.log('[BossAction] Setting lastMove from', state.boss.lastMove, 'to', action);
      state.boss.lastMove = action;
    } else if (action === 'special') {
      // Special can only happen after charge
      console.log('[BossAction] Checking special sequence - lastMove:', state.boss.lastMove, 'expected: charge');
      if (state.boss.lastMove !== 'charge') {
        console.error('[BossAction] Special attempted without charge, skipping');
        return;
      }
      Object.values(state.players).forEach(target => {
        if (target.hp > 0 && target.pendingAction !== 'cover' && target.invincibleTurns <= 0) {
          target.hp -= 3;
          if (target.hp < 0) target.hp = 0;
        }
      });
      state.boss.visualState = 'exhausted';
      console.log('[BossAction] Setting lastMove from', state.boss.lastMove, 'to', action);
      state.boss.lastMove = action;
    } else if (action === 'cooldown') {
      // Cooldown can only happen after special
      console.log('[BossAction] Checking cooldown sequence - lastMove:', state.boss.lastMove, 'expected: special');
      if (state.boss.lastMove !== 'special') {
        console.error('[BossAction] Cooldown attempted without special, skipping');
        return;
      }
      // Boss is cooling down - no effects, no damage, normal appearance
      state.boss.visualState = null;
      console.log('[BossAction] Setting lastMove from', state.boss.lastMove, 'to', action);
      state.boss.lastMove = action;
    }
    // Debug: Log player health after boss action
    console.log('[BossAction][DEBUG] Action:', action);
    Object.entries(state.players).forEach(([name, p]) => {
      console.log(`[BossAction][DEBUG] Player: ${name}, HP: ${p.hp}, Pending: ${p.pendingAction}, Invincible: ${p.invincibleTurns}`);
    });
  }
  function processTurn() { 
    console.log('[ProcessTurn][DEBUG] Starting turn processing, game running:', state.running);
    console.log('[ProcessTurn][DEBUG] This is the ORIGINAL processTurn function');
    if (!state.running) return; 
    
    // Don't clear visual state at start of turn - let actions manage their own states
    // This allows states like 'exhausted' to persist until the next action
    
    // Auto-repeat actions for human players
    Object.entries(state.players).forEach(([name, p]) => { 
      if (!p.isBot && p.hp > 0 && !p.pendingAction && p.repeatAction) { 
        p.pendingAction = p.repeatAction; 
        p.lastAction = actionDisplayName(p.repeatAction); 
      } 
    }); 
    
    // AI actions for bots
    Object.entries(state.players).forEach(([name, p]) => { 
      if (p.isBot && p.hp > 0) { 
        if (!p.pendingAction) { 
          p.pendingAction = botChooseAction(p); 
          p.lastAction = actionDisplayName(p.pendingAction); 
          console.log(`[BotAction][DEBUG] Bot ${name} chose action: ${p.pendingAction}`);
        } 
      } 
    }); 
    
    // Determine boss action
    let action = state.manualBossAction; 
    if (!action) { 
      if (state.bossActionQueue.length) { 
        action = state.bossActionQueue.shift(); 
        // Validate sequence integrity
        if (action === 'special' && state.boss.lastMove !== 'charge') {
          console.error('[BossSequence] Special attempted without charge, forcing cooldown');
          action = 'cooldown';
          state.bossActionQueue = []; // Clear remaining queue
        } else if (action === 'cooldown' && state.boss.lastMove !== 'special') {
          console.error('[BossSequence] Cooldown attempted without special, skipping');
          action = 'growl'; // Safe fallback
          state.bossActionQueue = []; // Clear remaining queue
        }
      } else { 
        const p = settings.bossProbabilities; 
        const rand = Math.random(); 
        if (rand < p.growl) action = 'growl'; 
        else if (rand < p.growl + p.attack) action = 'attack'; 
        else if (rand < p.growl + p.attack + p.cover) action = 'cover'; 
        else action = 'charge'; 
      } 
    } else { 
      // Validate manual boss action sequence
      if (action === 'special' && state.boss.lastMove !== 'charge') {
        console.error('[BossSequence] Manual special without charge, canceling');
        action = null; // Will fall back to random selection
      } else if (action === 'cooldown' && state.boss.lastMove !== 'special') {
        console.error('[BossSequence] Manual cooldown without special, canceling');
        action = null; // Will fall back to random selection
      }
      
      // If manual action was invalid, fall back to random selection
      if (!action) {
        const p = settings.bossProbabilities; 
        const rand = Math.random(); 
        if (rand < p.growl) action = 'growl'; 
        else if (rand < p.growl + p.attack) action = 'attack'; 
        else if (rand < p.growl + p.attack + p.cover) action = 'cover'; 
        else action = 'charge'; 
      }
      
      if (action === 'charge') { 
        state.bossActionQueue = ['special', 'cooldown']; 
      } 
    } 
    state.manualBossAction = null; 
    state.pendingBossAction = action;
    // Debug: Log processTurn state
    console.log('[ProcessTurn][DEBUG] Action:', action);
    Object.entries(state.players).forEach(([name, p]) => {
      console.log(`[ProcessTurn][DEBUG] Player: ${name}, HP: ${p.hp}, Pending: ${p.pendingAction}, Invincible: ${p.invincibleTurns}`);
    });
    setTimeout(() => {
      const ap = window.SackBattle && window.SackBattle.actionProcessor;
      if (!ap) {
        console.warn('[ProcessTurn] actionProcessor not available, using legacy path');
        // fall back to legacy behavior (unchanged)
        // NOTE: leaving legacy branch intact above this patch ensures safety; in practice ap exists.
      } else {
        // CORRECT TURN ORDER: Cover first, then player actions, then other boss actions
        
        if (action === 'cover') {
          // Apply boss cover first (affects player attack damage)
          applyBossAction(action);
          // Then process all player actions (cover is already applied)
          ap.processActionsSelective(state, { 
            isBossSpecial: false, 
            processBurst: true, 
            processStrike: true, 
            processAttack: true, 
            processHeal: true, 
            processCover: true 
          });
        } else if (action === 'special') {
          // For boss special: process player actions first, then boss special attack
          ap.processActionsSelective(state, { 
            isBossSpecial: true, 
            processBurst: true, 
            processStrike: true, 
            processAttack: true, 
            processHeal: false, 
            processCover: true 
          });
          // Manually mark heals as displayed without changing HP (blocked by special)
          Object.values(state.players).forEach(pl => {
            if (pl.hp > 0 && pl.pendingAction === 'heal') {
              pl.lastAction = 'heal';
              pl.pendingAction = null;
            }
          });
          // Apply boss special attack after player actions
          if (!(state.boss.hp <= 0 && !globalVictoryState)) {
            applyBossAction(action);
          }
        } else {
          // For attack, growl, charge, cooldown: player actions first, then boss action
          const blockHeal = action === 'attack';
          ap.processActionsSelective(state, { 
            isBossSpecial: false, 
            processBurst: true, 
            processStrike: true, 
            processAttack: true, 
            processHeal: !blockHeal, 
            processCover: true 
          });
          if (blockHeal) {
            // Mark heals as displayed without changing HP (blocked by boss attack)
            Object.values(state.players).forEach(pl => {
              if (pl.hp > 0 && pl.pendingAction === 'heal') {
                pl.lastAction = 'heal';
                pl.pendingAction = null;
              }
            });
          }
          // Apply boss action after player actions
          applyBossAction(action);
        }
      }
      
      // Clean up pending actions after all processing is complete
      if (window.SackBattle && window.SackBattle.actionProcessor) {
        window.SackBattle.actionProcessor.cleanupPendingActions(state);
      }
      
      state.boss.charged = false; if (state.boss.hp <= 0 && !globalVictoryState) { finalizeVictory('turn-resolution'); } Object.keys(state.players).forEach(name => { const pl = state.players[name]; if (pl.hp <= 0) { if (pl.hasReviveItem) { pl.hp = 3; pl.hasReviveItem = false; if (pl.repeatAction) { pl.pendingAction = pl.repeatAction; pl.lastAction = actionDisplayName(pl.repeatAction); } else { pl.lastAction = 'revive'; } } else { if (!pl.isBot) { const sc = pl.score || 0; if (!state.playerRecords[name]) state.playerRecords[name] = { score: sc, reviveItem: false }; else if (state.playerRecords[name].score < sc) state.playerRecords[name].score = sc; } if (!pl.dying) { pl.dying = true; setTimeout(()=>{ if (state.players[name]) { pl.visibleGone = true; emitUpdate(); } }, 1100); } if (settings.respawnMode === 'cooldown') { if (!pl.pendingRespawn) { pl.respawnCooldown = 3; pl.pendingRespawn = true; } } else if (settings.respawnMode === 'matchend') { if (!pl.pendingRespawn) pl.pendingRespawn = true; } } } }); const anyAlive = Object.values(state.players).some(p => p.hp > 0); if (!anyAlive && !globalVictoryState) { 
        globalVictoryState = 'defeat'; 
        if (!state.lastMatchDamage) state.lastMatchDamage = clonePublic(state.playerDamageThisMatch); 
        state.playerDamageThisMatch = {}; 
        state.completedMatches += 1; 
        stopCountdown(); 
        state.running = false; 
        state.attackUpTurns = 0; 
        Object.values(state.players).forEach(p=>{ p.invincibleTurns=0; });
      }
      Object.values(state.players).forEach(p => { if (p.invincibleTurns > 0) p.invincibleTurns -= 1; });
      if (state.attackUpTurns > 0) state.attackUpTurns -= 1;
      state.round += 1;
      state.secondsLeft = settings.turnLength;
      // Respawn cooldown progression (only while no victory/defeat active)
      Object.entries(state.players).forEach(([name,p]) => {
        if (p.pendingRespawn && settings.respawnMode === 'cooldown' && globalVictoryState === null) {
          if (p.respawnCooldown > 0) p.respawnCooldown -= 1;
          if (p.respawnCooldown <= 0) {
            p.hp = 3; p.dying = false; p.visibleGone = false; p.pendingRespawn = false; p.lastAction = 'respawn';
            console.log(`[Respawn][DEBUG] Player ${name} respawned with hp=3, dying=false, visibleGone=false`);
          }
        }
      });
  if (state.round > state.maxTurns) {
        const originalRound = state.round;
        const anyAlivePlayers = Object.values(state.players).some(p=>p.hp>0);
        const bossAlive = state.boss.hp > 0;
        if (!globalVictoryState && bossAlive && anyAlivePlayers) {
          // Defeat by timeout
            globalVictoryState = 'defeat-timeout';
            if (!state.lastMatchDamage) state.lastMatchDamage = clonePublic(state.playerDamageThisMatch);
            state.playerDamageThisMatch = {};
            state.completedMatches += 1;
            stopCountdown();
            state.running = false;
            state.attackUpTurns = 0;
            Object.values(state.players).forEach(p=>{ p.invincibleTurns=0; });
            
            console.log('[MatchEnd:DefeatByTimeout]', { round: originalRound, bossHp: state.boss.hp });
            state.round = state.maxTurns; // lock at max
        } else {
          // Normal end-of-match cycle (only increment if victory/defeat not already counted)
          if (!globalVictoryState) {
            state.completedMatches += 1;
            state.lastMatchDamage = clonePublic(state.playerDamageThisMatch);
          }
          state.playerDamageThisMatch = {};
          state.round = 1;
          if (!globalVictoryState) {
            resetBossHp(`end-of-match(r${originalRound})`);
          }
          state.attackUpTurns = 0;
          Object.values(state.players).forEach(p=>{ p.invincibleTurns=0; });
          // Respawns for matchend mode
          Object.values(state.players).forEach(pp => {
            if (settings.respawnMode === 'matchend') {
              if (pp.pendingRespawn) { 
                pp.hp = 3; pp.pendingRespawn = false; pp.respawnCooldown = 0; pp.dying=false; pp.visibleGone=false; pp.lastAction='respawn'; 
                console.log(`[MatchEndRespawn][DEBUG] Player respawned with hp=3, dying=false, visibleGone=false`);
              }
            } else if (pp.hp > 0 && globalVictoryState === null) {
              pp.lastAction = null;
            }
          });
          // IMPORTANT: Do NOT clear victory/defeat immediately; overlay should persist until next Game.start
          // (previously cleared globalVictoryState here and reset boss HP, causing flicker and auto-cycle)
        }
      }
      state.pendingBossAction = null; 
      // Note: Visual states like 'charging' and 'cooldown' should persist for the entire turn
      // Cover state persists until next boss action (like other visual states)
      emitUpdate(); }, 350); }
  function startCountdown() { stopCountdown(); state.secondsLeft = settings.turnLength; countdownInterval = setInterval(() => { state.secondsLeft--; if (state.secondsLeft <= 0) { state.secondsLeft = settings.turnLength; processTurn(); } emitUpdate(); }, 1000); }
  let __lastStartMatchResetAt = 0; function resetBossHp(reason){ const prev = state.boss.hp; const target = settings.bossHp || 100; if (reason === 'start-match') __lastStartMatchResetAt = Date.now(); if (globalVictoryState && reason !== 'start-match') { console.warn(`[BossHPReset:BLOCKED:${reason}] victory active`, { prev, globalVictoryState }); return; } if (/^end-of-match/.test(reason)) { const since = Date.now() - __lastStartMatchResetAt; const m = reason.match(/r(\d+)/); const origRound = m ? parseInt(m[1]) : null; if (since < 1500 && (!origRound || origRound <= 2)) { console.warn('[BossHPReset:SKIP early end-of-match]', { reason, sinceFromStart: since, origRound }); return; } } if (prev === target) { console.log(`[BossHPReset:noop:${reason}]`, { value: target }); return; } state.boss.hp = target; console.log(`[BossHPReset:${reason}] ${prev} -> ${target} (r${state.round} matches=${state.completedMatches})`); }
  function noteBossHpChange(oldVal, newVal, context){ if (newVal !== oldVal) { if (newVal === (settings.bossHp||100) && newVal > oldVal + 5 && state.running) { console.warn('[BossHPChange:Anomaly?] Large jump to full during match', { from: oldVal, to: newVal, context, round: state.round }); } else { console.log('[BossHPChange]', { from: oldVal, to: newVal, context }); } } }
  function stopCountdown() { if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } }
  function setPlayerRecord(username, recordData) {
    if (!username || typeof username !== 'string') return;
    if (!recordData || typeof recordData !== 'object') return;
    if (!state.playerRecords) state.playerRecords = {};
    state.playerRecords[username] = { ...state.playerRecords[username], ...recordData };
    // Also persist to settings for modal save
    if (settings) {
      settings.playerRecords = state.playerRecords;
    }
  }

  const Game = { _rawState: state, setSettings(newSettings) { 
    console.log('[Game.setSettings] Called with:', newSettings);
    if (newSettings.respawnMode !== undefined) {
      console.log('[Game.setSettings] respawnMode incoming:', newSettings.respawnMode, 'current:', settings.respawnMode);
    }
    if (typeof newSettings.turnLength === 'number') { settings.turnLength = newSettings.turnLength; state.secondsLeft = newSettings.turnLength; } if (typeof newSettings.maxTurns === 'number') { settings.maxTurns = newSettings.maxTurns; state.maxTurns = newSettings.maxTurns; state.maxTurns = settings.maxTurns; } if (newSettings.bossProbabilities) { settings.bossProbabilities = newSettings.bossProbabilities; } if (typeof newSettings.bossHp === 'number' && newSettings.bossHp > 0) { settings.bossHp = newSettings.bossHp; if (state.boss.hp > settings.bossHp) { const old=state.boss.hp; state.boss.hp = settings.bossHp; noteBossHpChange(old, state.boss.hp, 'settings-cap'); } } if (newSettings.twitchClientId !== undefined) { settings.twitchClientId = newSettings.twitchClientId; } if (newSettings.twitchClientSecret !== undefined) { settings.twitchClientSecret = newSettings.twitchClientSecret; } if (newSettings.twitchBotUsername !== undefined) { settings.twitchBotUsername = newSettings.twitchBotUsername; } if (newSettings.twitchOauthToken !== undefined) { settings.twitchOauthToken = newSettings.twitchOauthToken; } if (newSettings.twitchChannel !== undefined) { settings.twitchChannel = newSettings.twitchChannel; } if (Array.isArray(newSettings.twitchTokenScopes)) { settings.twitchTokenScopes = newSettings.twitchTokenScopes; } if (typeof newSettings.twitchTokenExpiresAt === 'number') { settings.twitchTokenExpiresAt = newSettings.twitchTokenExpiresAt; } if (typeof newSettings.battlefieldImage === 'string') settings.battlefieldImage = newSettings.battlefieldImage; if (typeof newSettings.bossName === 'string') { settings.bossName = newSettings.bossName; state.boss.name = newSettings.bossName; } if (typeof newSettings.bossImage === 'string') { settings.bossImage = newSettings.bossImage; } if (Array.isArray(newSettings.rankDefinitions)) { settings.rankDefinitions = newSettings.rankDefinitions.map(r => ({ name: r.name || 'Rank', wins: r.wins || 0 })); } if (newSettings.chatCommands) { 
  // Handle both flat and platform-specific chatCommands structures
  if (newSettings.chatCommands.twitch || newSettings.chatCommands.youtube || newSettings.chatCommands.discord) {
    // New platform-specific structure - do deep merge
    settings.chatCommands = {
      twitch: { ...(settings.chatCommands?.twitch || {}), ...(newSettings.chatCommands.twitch || {}) },
      youtube: { ...(settings.chatCommands?.youtube || {}), ...(newSettings.chatCommands.youtube || {}) },
      discord: { ...(settings.chatCommands?.discord || {}), ...(newSettings.chatCommands.discord || {}) }
    };
  } else {
    // Legacy flat structure or partial update - use shallow merge
    settings.chatCommands = { ...settings.chatCommands, ...newSettings.chatCommands }; 
  }
} if (typeof newSettings.rules === 'string') { settings.rules = newSettings.rules; } if (['cooldown','matchend'].includes(newSettings.respawnMode)) { 
      console.log('[Game.setSettings] Setting respawnMode to:', newSettings.respawnMode);
      settings.respawnMode = newSettings.respawnMode; 
    } if (typeof newSettings.powerfulAttackDamage === 'number' && newSettings.powerfulAttackDamage > 0) settings.powerfulAttackDamage = newSettings.powerfulAttackDamage; if (Array.isArray(newSettings.bossPlaylist)) { settings.bossPlaylist = newSettings.bossPlaylist.map(e => ({ id: String(e.id||'').slice(0,100), hp: Math.max(1, parseInt(e.hp)||100), subName: String(e.subName||'').slice(0,50) })); } if (Array.isArray(newSettings.channelPointTriggers)) { settings.channelPointTriggers = newSettings.channelPointTriggers.map(r => ({ match: String(r.match||'').slice(0,100), key: String(r.key||'').slice(0,50), enabled: !!r.enabled })); } if (Array.isArray(newSettings.bitsThresholds)) { settings.bitsThresholds = newSettings.bitsThresholds.map(r => ({ minBits: Math.max(1, parseInt(r.minBits)||1), key: String(r.key||'').slice(0,50), enabled: !!r.enabled })).sort((a,b)=>a.minBits-b.minBits); } if (Array.isArray(newSettings.superchatThresholds)) { settings.superchatThresholds = newSettings.superchatThresholds.map(r => ({ minAmount: Math.max(0.01, parseFloat(r.minAmount)||0.01), key: String(r.key||'').slice(0,50), enabled: !!r.enabled })).sort((a,b)=>a.minAmount-b.minAmount); } if (newSettings.audioSettings) { settings.audioSettings = { ...settings.audioSettings, ...newSettings.audioSettings }; } if (typeof newSettings.waitingBackgroundImage === 'string') { settings.waitingBackgroundImage = newSettings.waitingBackgroundImage.startsWith('app://') ? newSettings.waitingBackgroundImage : ''; } if (typeof newSettings.waitingMainLogoImage === 'string') { settings.waitingMainLogoImage = newSettings.waitingMainLogoImage.startsWith('app://') ? newSettings.waitingMainLogoImage : ''; } if (typeof newSettings.waitingSecondaryLogoImage === 'string') { settings.waitingSecondaryLogoImage = newSettings.waitingSecondaryLogoImage.startsWith('app://') ? newSettings.waitingSecondaryLogoImage : ''; }

    // Merge any incoming style preferences so UI toggles (like randomizeBattlefield)
    // are preserved in the persistent settings object.
    if (newSettings.style && typeof newSettings.style === 'object') {
      settings.style = { ...(settings.style || {}), ...newSettings.style };
      if (typeof settings.style.randomizeIntervalMs === 'number' && settings.style.randomizeIntervalMs > 0) {
        settings.style.randomizeIntervalMs = Math.max(1000, parseInt(settings.style.randomizeIntervalMs, 10) || 15000);
      }
    }

    // YouTube settings handling
    if (newSettings.youtubeApiKey !== undefined) { 
      settings.youtubeApiKey = newSettings.youtubeApiKey; 
    }
    if (newSettings.youtubeChannelId !== undefined) { 
      settings.youtubeChannelId = newSettings.youtubeChannelId; 
    }

    // Discord settings handling
    if (newSettings.discordBotToken !== undefined) { 
      settings.discordBotToken = newSettings.discordBotToken; 
    }
    if (newSettings.discordChannelId !== undefined) { 
      settings.discordChannelId = newSettings.discordChannelId; 
    }

    emitUpdate();
  },
  getState() { return getPublicState(); }, setPlayerRecord, start() {
  // Don't exit early if game is running - "Next Game" needs to reset health even when running
  console.log('[Game.start] Starting new game, running state:', state.running);
  
  console.log('[Game.start] Resetting existing players for new game');
  
  // Reset all existing players to starting state instead of trying to restore them
  Object.values(state.players).forEach(player => {
    player.hp = 3;
    player.dying = false;
    player.visibleGone = false;
    player.pendingRespawn = false;
    player.respawnCooldown = 0;
    player.invincibleTurns = 0;
    player.pendingAction = null;
    player.lastAction = null;
    console.log(`[Game.start] Reset player ${Object.keys(state.players).find(k => state.players[k] === player)} to starting state`);
  });
  // Removed: state.bossPlaylistIndex = 0; (do not reset index on every game start)
  // Reset boss welcome flag so welcome.mp3 can play for each new boss
  if (window.__audioModule && window.__audioModule.resetBossWelcomeFlag) {
    window.__audioModule.resetBossWelcomeFlag();
  }
  state.running = true;
  state.round = 1;
  state.secondsLeft = settings.turnLength;
  resetBossHp('start-match');
  // Boss welcome sound feature
  try {
    // Do not play welcome.mp3 if battle commencing menu is active
    if (typeof window.waitingActive !== 'undefined' && window.waitingActive) {
      console.log('[BossWelcome] Skipped: waitingActive is true');
    } else {
      const bossName = (state.boss.name || '').trim();
      if (!bossName) {
        console.log('[BossWelcome] Skipped: empty bossName');
      } else if (window.__audioModule && window.__audioModule.playBossWelcome) {
        // Always try to play welcome.mp3 for every boss spawn
        const folderName = bossName.toLowerCase().replace(/\s+/g, '-');
        const welcomePath = `assets/boss/${folderName}/welcome.mp3`;
        window.__audioModule.playBossWelcome(welcomePath, bossName);
      } else {
        // Fallback: try to play directly via audioHelper
        const folderName = bossName.toLowerCase().replace(/\s+/g, '-');
        const welcomePath = `assets/boss/${folderName}/welcome.mp3`;
        const src = `app://${welcomePath.replace(/^\/+/, '')}`;
        if (window.SackBattle?.utils?.audio) {
          const a = window.SackBattle.utils.audio.createAudio(src, 'sfx', 0.7);
          a.play().catch(()=>{});
        } else {
          const audio = new Audio(src);
          if (window.__audioMixer) audio.volume = window.__audioMixer.calculateCategoryVolume('sfx', 0.7); else audio.volume = 0.7;
          audio.play().catch(()=>{});
        }
      }
    }
  } catch(e) { console.warn('[BossWelcome] Failed to play welcome.mp3', e); }
  if (state.boss.hp <= 0) { const old=state.boss.hp; state.boss.hp = settings.bossHp || 100; noteBossHpChange(old, state.boss.hp, 'start-nonpositive-clamp'); } if (globalVictoryState && state.boss.hp > 0) { console.warn('[Game.start] Clearing stale victory flag'); globalVictoryState = null; } state.boss.lastMove = null; state.boss.visualState = null; state.boss.charged = false; state.attackUpTurns = 0; Object.values(state.players).forEach(p=>{ p.invincibleTurns=0; }); state.bossActionQueue = []; state.pendingBossAction = null; state.lastBossAction = null; state.manualBossAction = null;
    Object.entries(state.players).forEach(([name, p]) => {
      const oldHp = p.hp;
      p.hp = 3;
      p.dying = false;
      p.visibleGone = false;
      p.pendingRespawn = false;
      p.respawnCooldown = 0;
      p.invincibleTurns = 0;
      p.pendingAction = null;
      p.burstGauge = 0; // Reset burst gauge to 0 at start of each game
      console.log(`[Game.start] FINAL HEALTH RESET: ${name} health ${oldHp} -> ${p.hp}`);
      // Only restore avatar from playerRecords for non-bots, to preserve bot avatars
      if (!p.isBot) {
        const savedAvatar = state.playerRecords[name]?.avatar;
        if (typeof savedAvatar !== 'undefined' && savedAvatar !== null && savedAvatar !== '') {
          p.avatar = savedAvatar;
          console.log(`[AvatarRestore][DEBUG] Player ${name} avatar set to: ${savedAvatar}`);
        } else {
          console.log(`[AvatarRestore][DEBUG] Player ${name} has no avatar in playerRecords.`);
        }
      } else {
        console.log(`[AvatarRestore][DEBUG] Bot ${name} avatar preserved: ${p.avatar}`);
      }
      if (p.repeatAction) {
        p.lastAction = actionDisplayName(p.repeatAction);
        p.pendingAction = p.repeatAction;
      } else {
        p.lastAction = null;
      }
    });
    state.playerDamageThisMatch = {};
    state.lastMatchDamage = null;
    globalVictoryState = null;
    console.log('[Game.start] New match initialized', { bossHp: state.boss.hp });
    emitUpdate();
    startCountdown(); }, stop() { state.running = false; stopCountdown(); emitUpdate(); }, forceNextTurn() { if (!state.running) return; state.secondsLeft = 1; }, pause() { if (!state.running) return; stopCountdown(); emitUpdate(); }, resume() { if (!state.running) return; if (countdownInterval) return; startCountdown(); emitUpdate(); }, resetCurrentMatch() {
  state.round = 1;
  state.secondsLeft = settings.turnLength;
  state.bossPlaylistIndex = 0;
  resetBossHp('reset-current-match');
  globalVictoryState = null;
  state.lastMatchDamage = null;
  state.playerDamageThisMatch = {};
  Object.values(state.players).forEach(p => {
    p.hp = 3;
    p.dying = false;
    p.visibleGone = false;
    p.pendingRespawn = false;
    p.respawnCooldown = 0;
    p.invincibleTurns = 0;
    p.pendingAction = null;
    p.burstGauge = 0; // Reset burst gauge to 0 at match reset
    if (p.repeatAction) {
      p.lastAction = actionDisplayName(p.repeatAction);
      p.pendingAction = p.repeatAction;
    } else {
      p.lastAction = null;
    }
  });
  emitUpdate();
}, resetMatchTotal() { state.completedMatches = 0; emitUpdate(); }, resetActivePlayers() { 
  state.players = {}; 
  emitUpdate(); 
}, clearVictoryState() { if (globalVictoryState) { console.log('[Game.clearVictoryState] Clearing', globalVictoryState); globalVictoryState = null; emitUpdate(); } }, setPlayerAction, addPlayer, importPlayerRecords(records = {}) { Object.entries(records).forEach(([name, rec]) => { if (/^Bot\d+$/i.test(name)) return; if (!state.playerRecords[name]) state.playerRecords[name] = { score: 0, reviveItem: false }; if (typeof rec.score === 'number') state.playerRecords[name].score = rec.score; if (typeof rec.reviveItem === 'boolean') state.playerRecords[name].reviveItem = rec.reviveItem; }); emitUpdate(); }, getPlayerRecords() { return JSON.parse(JSON.stringify(state.playerRecords)); }, setPlayerScore(name, score) { if (typeof score !== 'number' || score < 0) return false; if (!state.playerRecords[name]) state.playerRecords[name] = { score: 0 }; state.playerRecords[name].score = score; if (state.players[name]) { state.players[name].score = score; } emitUpdate(); return true; }, deletePlayerRecord(name) { if (state.players[name]) delete state.players[name]; if (state.playerRecords[name]) delete state.playerRecords[name]; emitUpdate(); return true; }, resetPlayerRecords() { state.playerRecords = {}; state.players = {}; emitUpdate(); return true; }, applyBitsDamage(amount = 50) { { const old=state.boss.hp; state.boss.hp -= amount; noteBossHpChange(old, state.boss.hp, 'bits-damage'); } if (state.boss.hp < 0) state.boss.hp = 0; emitUpdate(); }, applyMassHeal() { Object.values(state.players).forEach(p => { if (p.hp > 0) p.hp = 3; if (p.hp > 0) p.invincibleTurns = Math.max(p.invincibleTurns, 3); }); emitUpdate(); }, applyPowerfulAttack() { if (!state.running) { console.log('[PowerfulAttack] Ignored (game not running)'); return; } { const old=state.boss.hp; state.boss.hp -= settings.powerfulAttackDamage; noteBossHpChange(old, state.boss.hp, 'powerful-attack'); } if (state.boss.hp < 0) state.boss.hp = 0; if (state.boss.hp <= 0) { finalizeVictory('powerful-attack'); emitUpdate(); return; } console.log('[PowerfulAttack] Applied', { newBossHp: state.boss.hp, damage: settings.powerfulAttackDamage }); emitUpdate(); }, applyAttackUp(turns = 5) { const t = parseInt(turns)||5; state.attackUpTurns = Math.max(state.attackUpTurns, t); emitUpdate(); }, clearBuffs() { state.attackUpTurns = 0; Object.values(state.players).forEach(p=>{ if (p.invincibleTurns) p.invincibleTurns = 0; }); emitUpdate(); }, applyBitsInvincibility(turns = 3) { Object.values(state.players).forEach(p => { if (p.hp > 0) { p.hp = 3; p.invincibleTurns = Math.max(p.invincibleTurns, turns); } }); emitUpdate(); }, updateRewardTriggers(list) { if (Array.isArray(list)) { settings.channelPointTriggers = list.map(r => ({ match: String(r.match||'').slice(0,100), key: String(r.key||'').slice(0,50), enabled: !!r.enabled })); emitUpdate(); } }, updateBitsThresholds(list) { if (Array.isArray(list)) { settings.bitsThresholds = list.map(r => ({ minBits: Math.max(1, parseInt(r.minBits)||1), key: String(r.key||'').slice(0,50), enabled: !!r.enabled })).sort((a,b)=>a.minBits-b.minBits); emitUpdate(); } }, updateSuperchatThresholds(list) { if (Array.isArray(list)) { settings.superchatThresholds = list.map(r => ({ minAmount: Math.max(0.01, parseFloat(r.minAmount)||0.01), key: String(r.key||'').slice(0,50), enabled: !!r.enabled })).sort((a,b)=>a.minAmount-b.minAmount); emitUpdate(); } }, setBoss({ hp, name, image } = {}) {
    // Reset boss welcome flag so welcome.mp3 can play for every new boss
    if (window.__audioModule && window.__audioModule.resetBossWelcomeFlag) {
      window.__audioModule.resetBossWelcomeFlag();
    }
    const prevHp = state.boss.hp;
    if (typeof hp === 'number' && hp > 0) {
      state.boss.hp = hp;
      console.log('[SetBoss] Explicit HP applied', { from: prevHp, to: hp });
    } else if (state.running) {
      console.log('[SetBoss] Ignoring implicit HP reset while running', { current: prevHp });
    } else {
      state.boss.hp = (typeof settings.bossHp === 'number' ? settings.bossHp : prevHp);
    }
    if (typeof name === 'string') state.boss.name = name;
    if (typeof image === 'string') {
      if (/assets\/boss\//.test(image) || /assets\\boss\\/.test(image)) state.boss.imageSrc = image;
      else state.boss.imageSrc = image;
    }
    state.boss.lastMove = null;
    state.boss.visualState = null;
    state.boss.charged = false;
    state.bossActionQueue = [];
    state.pendingBossAction = null;
    state.lastBossAction = null;
    state.manualBossAction = null;
    emitUpdate();
    // Boss welcome sound feature (same as Game.start)
    try {
      if (typeof window.waitingActive !== 'undefined' && window.waitingActive) {
        console.log('[BossWelcome] Skipped: waitingActive is true');
      } else {
        const bossName = (state.boss.name || '').trim();
        if (!bossName) {
          console.log('[BossWelcome][setBoss] Skipped: empty bossName');
        } else if (window.__audioModule && window.__audioModule.playBossWelcome) {
          const folderName = bossName.toLowerCase().replace(/\s+/g, '-');
          const welcomePath = `assets/boss/${folderName}/welcome.mp3`;
          window.__audioModule.playBossWelcome(welcomePath, bossName);
        } else {
          const folderName = bossName.toLowerCase().replace(/\s+/g, '-');
          const welcomePath = `assets/boss/${folderName}/welcome.mp3`;
          const src = `app://${welcomePath.replace(/^\/+/, '')}`;
          if (window.SackBattle?.utils?.audio) {
            const a = window.SackBattle.utils.audio.createAudio(src, 'sfx', 0.7);
            a.play().catch(()=>{});
          } else {
            const audio = new Audio(src);
            if (window.__audioMixer) audio.volume = window.__audioMixer.calculateCategoryVolume('sfx', 0.7); else audio.volume = 0.7;
            audio.play().catch(()=>{});
          }
        }
      }
    } catch(e) { console.warn('[BossWelcome][setBoss] Failed to play welcome.mp3', e); }
  }, onUpdate(callback) { if (typeof callback === 'function') { listeners.push(callback); }   }, setBossNextMove(action) { 
    if (['growl', 'attack', 'cover', 'charge'].includes(action)) { 
      // Normal actions are always allowed
      state.manualBossAction = action; 
      emitUpdate(); 
      return true; 
    } else if (action === 'special' && state.bossActionQueue.length > 0 && state.bossActionQueue[0] === 'special') {
      // Special is only allowed if it's the next queued action after charge
      state.manualBossAction = action; 
      emitUpdate(); 
      return true; 
    } else if (action === 'cooldown' && state.bossActionQueue.length > 0 && state.bossActionQueue[0] === 'cooldown') {
      // Cooldown is only allowed if it's the next queued action after special
      state.manualBossAction = action; 
      emitUpdate(); 
      return true; 
    }
    return false; 
  }, importPlayers(playersObj = {}) { const recs = {}; Object.entries(playersObj).forEach(([name, data]) => { recs[name] = { score: (typeof data.score === 'number') ? data.score : 0 }; }); Game.importPlayerRecords(recs); }, setCompletedMatches(val) { if (typeof val === 'number' && val >= 0) { state.completedMatches = val; emitUpdate(); } }, applyReviveAll() { Object.values(state.players).forEach(p => { if (p.hp <= 0 || p.dying || p.visibleGone || p.pendingRespawn) { p.hp = 3; p.dying = false; p.visibleGone = false; p.pendingRespawn = false; p.respawnCooldown = 0; p.invincibleTurns = Math.max(p.invincibleTurns || 0, 2); p.lastAction = 'revive'; } }); emitUpdate(); } };
  function restorePlayersFromRecordsIfMissing() {
    if (Object.keys(state.players).length === 0 && Object.keys(state.playerRecords).length > 0) {
      console.log('[RestorePlayers][DEBUG] Restoring players from playerRecords:', JSON.stringify(state.playerRecords, null, 2));
      Object.entries(state.playerRecords).forEach(([name, rec]) => {
        if (!/^Bot\d+$/i.test(name)) {
          state.players[name] = {
            hp: 3,
            score: rec.score || 0,
            pendingAction: null,
            lastAction: null,
            rank: 0,
            autoReviveNextMatch: false,
            joined: true,
            avatar: (typeof rec.avatar !== 'undefined' && rec.avatar !== null && rec.avatar !== '') ? rec.avatar : '',
            isBot: false,
            behavior: 'random',
            invincibleTurns: 0,
            hasReviveItem: !!rec.reviveItem,
            respawnCooldown: 0,
            pendingRespawn: false,
            burstGauge: 0
          };
          console.log(`[RestorePlayers][DEBUG] Player ${name} restored with avatar: ${state.players[name].avatar}`);
        }
      });
      emitUpdate();
      console.log('[RestorePlayers][DEBUG] emitUpdate called after restoration. Current players:', JSON.stringify(state.players, null, 2));
    }
  }

  // --- Backend Sync Integration ---
  // Expose a function to get player state for backendSync.js
  window.getPlayerStateForBackend = function(playerName) {
    const p = state.players[playerName];
    if (!p) return null;
    return {
      playerName,
      burstGauge: p.burstGauge || 0,
      lastAction: p.lastAction || null,
      twitchUserId: Object.keys(state.playerRecords).find(
        k => k.endsWith(playerName.slice(-8))
      ) || null
    };
  };

  window.Game = Game;
  // Require backendSync if running in Node (for server-side game loop)
  if (typeof require !== 'undefined') {
    try { require('../integration/backendSync.js'); } catch (e) { /* ignore if not present */ }
  }
})(window);
