// oauth.js - OAuth & connection status
(function(global){ const api=global.electronAPI||{}; function ensureConnectionStatus(text){ if(!global.devBar) return; if(!ensureConnectionStatus._badge){ const divider=document.createElement('div'); divider.className='dev-divider'; global.devBar.appendChild(divider); const badge=document.createElement('div'); ensureConnectionStatus._badge=badge; badge.style.cssText='min-width:200px;padding:4px 10px;background:#2d3754;border-radius:8px;font-size:0.75rem;font-weight:700;letter-spacing:0.08em;color:#c5d4ff;display:flex;gap:6px;align-items:center;box-shadow:0 0 6px #24314f inset,0 0 4px #4a5d99;'; badge.innerHTML='<span id="conn-dot" style="width:10px;height:10px;border-radius:50%;background:#666;"></span><span id="conn-text"></span>'; global.devBar.appendChild(badge); ensureConnectionStatus._state={ chat:'-', pubsub:'-' }; } if(!ensureConnectionStatus._state) ensureConnectionStatus._state={ chat:'-', pubsub:'-' }; if(['Connecting...','Connected','Disconnected','Error'].includes(text)) ensureConnectionStatus._state.pubsub=text; const lbl=`Chat: ${ensureConnectionStatus._state.chat} | PubSub: ${ensureConnectionStatus._state.pubsub}`; const txt=document.getElementById('conn-text'); if(txt) txt.textContent=lbl; let bg='#32406a'; const st=ensureConnectionStatus._state; if(st.chat==='Error'||st.pubsub==='Error') bg='#6a324f'; else if(st.chat==='Disconnected'||st.pubsub==='Disconnected') bg='#6a3232'; else if(st.chat==='Connecting...'||st.pubsub==='Connecting...') bg='#5a5a2d'; else if(st.chat==='Connected'&&st.pubsub==='Connected') bg='#2d5c2d'; const dot=document.getElementById('conn-dot'); if(dot){ dot.style.background=(bg==='#2d5c2d')?'#36e06f':(bg==='#6a3232'?'#ff5555':(bg==='#6a324f'?'#ff55aa':'#d4c04a')); dot.style.boxShadow='0 0 6px '+dot.style.background; } if(ensureConnectionStatus._badge) ensureConnectionStatus._badge.style.background=bg; }
  global.ensureConnectionStatus = global.ensureConnectionStatus || ensureConnectionStatus;
  function extractTokenAndScopes(str){ if(!str) return null; let frag=''; const hashIdx=str.indexOf('#'); if(hashIdx>=0) frag=str.substring(hashIdx+1); else if(/access_token=/.test(str)) frag=str; const params=new URLSearchParams(frag.replace(/^[^#]*#/,'').replace(/^[^?]*\?/,'').replace(/\s+/g,'')); let token=params.get('access_token'); if(!token){ const m=str.match(/access_token=([a-z0-9]+)/i); if(m) token=m[1]; } let scopeRaw=params.get('scope')||''; if(!scopeRaw){ const sm=str.match(/scope=([^&\s]+)/i); if(sm) scopeRaw=decodeURIComponent(sm[1]); } const scopes=scopeRaw?scopeRaw.split(/[+\s]/).filter(Boolean):[]; if(!token) return null; return { token, scopes }; }
  global.__extractTokenAndScopes = extractTokenAndScopes;
  function wire(){ const btnGenerate=document.getElementById('btn-generate-oauth'); const btnConnect=document.getElementById('btn-connect-twitch'); const btnTest=document.getElementById('btn-test-chat'); const parseBtn=document.getElementById('btn-parse-redirect'); const redirectInput=document.getElementById('twitch-redirect-paste'); const clientIdInput=document.getElementById('input-twitch-client-id'); const channelInput=document.getElementById('twitch-channel'); const botInput=document.getElementById('twitch-bot-username'); const tokenInput=document.getElementById('twitch-oauth-token'); const helper=document.getElementById('oauth-helper'); const scopeDisp=document.getElementById('scope-display'); const redirectCfg=document.getElementById('input-twitch-redirect');
    // Prefill redirect from persisted settings if empty
    try { if (redirectCfg && !redirectCfg.value) { const gs=window.Game?.getState?.(); if (gs?.settings?.twitchRedirectUri) redirectCfg.value=gs.settings.twitchRedirectUri; } } catch(_){ }
  if(btnGenerate){ btnGenerate.onclick=()=>{ const clientId=(clientIdInput?.value||'').trim(); if(!clientId){ helper&&(helper.textContent='Client ID required to build URL.'); return; } // Channel not required for OAuth authorize, only for connecting chat later
    const userInput=(redirectCfg?.value||'').trim();
    let redirectPrimary = userInput || 'http://localhost';
    // Do NOT auto-append slash; user must match what is registered. Provide alternate suggestion instead.
    const addAlt = !redirectPrimary.endsWith('/') && /^https?:\/\/[^\/?#]+$/i.test(redirectPrimary);
      const base='https://id.twitch.tv/oauth2/authorize'; // Twitch endpoint MUST be lowercase
      const scopeList=['channel:read:redemptions','bits:read','chat:read','chat:edit'];
      const scopesEnc=encodeURIComponent(scopeList.join(' '));
    const primaryUrl=`${base}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectPrimary)}&response_type=token&scope=${scopesEnc}`;
    const altUrl = addAlt ? `${base}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectPrimary+'/')}&response_type=token&scope=${scopesEnc}` : null;
    helper&&(helper.innerHTML=`<strong>Authorize URL (implicit grant):</strong><br><span class="oauth-url" style="font-family:monospace;font-size:0.65rem;display:inline-block;max-width:100%;word-break:break-all;" id="oauth-url-primary">${primaryUrl}</span><br><button type="button" id="btn-copy-oauth" style="margin-top:4px;background:#35518f;color:#fff;border:1px solid #4767b2;border-radius:6px;padding:4px 8px;font-size:0.55rem;cursor:pointer;">Copy URL</button>` + (altUrl?`<br><small>Alt (with slash):</small><br><span class="oauth-url" style="font-family:monospace;font-size:0.6rem;opacity:.75;" id="oauth-url-alt">${altUrl}</span> <button type="button" id="btn-copy-oauth-alt" style="margin-top:2px;background:#3d4f8a;color:#fff;border:1px solid #4f68b3;border-radius:6px;padding:2px 6px;font-size:0.5rem;cursor:pointer;">Copy Alt</button>`:'')+`<br><em>If you get redirect_mismatch add BOTH '${redirectPrimary}' and '${redirectPrimary}${addAlt?'/':''}' to your Twitch app or use the one you registered exactly.</em>`);
    const copyBtn=document.getElementById('btn-copy-oauth');
    copyBtn && copyBtn.addEventListener('click',()=>{ try { navigator.clipboard.writeText(primaryUrl); copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent='Copy URL',2500); } catch(_){ copyBtn.textContent='Copy failed'; setTimeout(()=>copyBtn.textContent='Copy URL',2500); } });
    const copyAlt=document.getElementById('btn-copy-oauth-alt');
    copyAlt && copyAlt.addEventListener('click',()=>{ try { navigator.clipboard.writeText(altUrl); copyAlt.textContent='Copied'; setTimeout(()=>copyAlt.textContent='Copy Alt',2500); } catch(_){ copyAlt.textContent='Copy failed'; setTimeout(()=>copyAlt.textContent='Copy Alt',2500); } });
  }; btnGenerate.addEventListener('click',e=>{ if(!e.shiftKey) return; e.preventDefault(); const clientId=(clientIdInput?.value||'').trim(); if(!clientId){ helper&&(helper.textContent='Client ID required for popup flow.'); return; } let redirectBase=(redirectCfg?.value||'').trim(); if(!redirectBase){ redirectBase='http://localhost/'; } api.startOAuthFlow&&api.startOAuthFlow(clientId,['channel:read:redemptions','bits:read','chat:read','chat:edit'], redirectBase); helper&&(helper.textContent='Popup opened. Authorize and it will auto-fill token.'); }); }
    api.onOAuthToken && api.onOAuthToken(p=>{ if(p?.token && tokenInput){ tokenInput.value='oauth:'+p.token; helper&&(helper.textContent='Token captured and filled.'); if(Array.isArray(p.scopes)&&p.scopes.length && scopeDisp) scopeDisp.textContent='Scopes: '+p.scopes.join(', '); btnConnect && btnConnect.click(); } else if(p?.error && helper){ helper.textContent='OAuth error: '+p.error; } });
    if(btnConnect){ btnConnect.onclick=async()=>{
      const rawBot=(botInput?.value||'').trim();
      const rawToken=(tokenInput?.value||'').trim();
      const rawChannel=(channelInput?.value||'').trim();
      const rawClientId=(clientIdInput?.value||'').trim();
      const problems=[];
      if(!rawBot) problems.push('Bot Username');
      if(!rawToken) problems.push('OAuth Token');
      if(!rawChannel) problems.push('Channel');
      if(!rawClientId) problems.push('Client ID');
      if(problems.length){ helper && (helper.textContent='Missing: '+problems.join(', ')); return; }
      let tokenNorm=rawToken.startsWith('oauth:')?rawToken:'oauth:'+rawToken;
      if(/\s/.test(tokenNorm)){ helper&&(helper.textContent='Token contains whitespace – re-copy from Twitch redirect fragment.'); return; }
      helper && (helper.textContent='Connecting (validating token & opening sockets)...');
      try {
        api.connectTwitch && await api.connectTwitch({ botUsername:rawBot, oauthToken:tokenNorm, channel:rawChannel, clientId:rawClientId });
        ensureConnectionStatus('Connecting...');
      } catch(e){ helper && (helper.textContent='Connect failed: '+ (e && e.message || e)); }
    }; }
  btnTest && (btnTest.onclick=()=> { api.testChatMessage && api.testChatMessage('[Test] Chat connectivity check'); });
    if(parseBtn && redirectInput){ parseBtn.onclick=()=>{ const val=redirectInput.value.trim(); const res=extractTokenAndScopes(val); if(!res){ helper&&(helper.textContent='Could not parse token from input.'); return; } const tokenEl=document.getElementById('twitch-oauth-token'); tokenEl && (tokenEl.value='oauth:'+res.token); if(res.scopes.length){ const gs=global.Game.getState(); global.Game.setSettings({ ...gs.settings, twitchTokenScopes: res.scopes }); helper&&(helper.textContent='Token parsed and filled. Click Connect.'); } }; }
  api.onChatStatus && api.onChatStatus(evt=>{ if(!ensureConnectionStatus._state) ensureConnectionStatus._state={ chat:'-', pubsub:'-' }; let st=evt?.status||''; let mapped=st; if(['validating','warning','reconnecting','connecting'].includes(st)) mapped='Connecting...'; else if(['connected','corrected'].includes(st)) mapped='Connected'; else if(st==='disconnected') mapped='Disconnected'; ensureConnectionStatus._state.chat=mapped; if(st==='warning' && evt.reason==='token_not_broadcaster'){ global.__tokenChannelMismatch = { tokenUser: evt.tokenUser, channel: evt.channel }; } ensureConnectionStatus(`Chat: ${ensureConnectionStatus._state.chat} | PubSub: ${ensureConnectionStatus._state.pubsub}`); if(helper){ if(st==='validating') helper.textContent='Validating token & scopes...'; else if(st==='token-info') helper.textContent='Token scopes recorded.'; else if(st==='corrected') helper.textContent='Bot username auto-corrected to match token.'; else if(st==='connected') helper.textContent='Chat connected.'; else if(st==='warning' && evt.reason==='token_not_broadcaster') helper.textContent=`WARNING: Token user (${evt.tokenUser}) != channel (${evt.channel}). Redeem/cheer EventSub requires broadcaster token.`; else if(st==='disconnected' && evt.reason==='missing_fields') helper.textContent='Connect failed: missing required fields.'; else if(st==='disconnected') helper.textContent='Chat disconnected'+(evt.reason?': '+evt.reason:''); } });
    api.onPubSubStatus && api.onPubSubStatus(evt=>{ const st=evt?.status||''; if(st==='connecting') ensureConnectionStatus('Connecting...'); else if(['connected','listening'].includes(st)) ensureConnectionStatus('Connected'); else if(st==='disconnected') ensureConnectionStatus('Disconnected'); else if(st==='error') ensureConnectionStatus('Error'); else if(st==='pong') ensureConnectionStatus('Connected'); });
    api.onBits && api.onBits(data=>{ ensureConnectionStatus('Connected'); if(data?.bits_used && global.Game?.applyBitsDamage) global.Game.applyBitsDamage(50); });
    api.onPoints && api.onPoints(data=>{ ensureConnectionStatus('Connected'); try { const title=(data?.redemption?.reward?.title||'').toLowerCase(); if(title.includes('invinc')) global.Game?.applyBitsInvincibility?.(3); } catch(_){ } });

  // Scope + expiry helper injection (once DOM ready & after initial wire)
  setTimeout(()=>{
    try {
      const gs = global.Game?.getState?.();
      const scopes = gs?.settings?.twitchTokenScopes||[];
      const exp = gs?.settings?.twitchTokenExpiresAt||0;
      const container = document.getElementById('oauth-helper');
      if(container && scopes && scopes.length){
        const missingRedemptions = scopes.indexOf('channel:read:redemptions')===-1;
        const missingBits = scopes.indexOf('bits:read')===-1;
        const parts=[];
        if (exp) {
          const mins = Math.max(0, Math.round((exp-Date.now())/60000));
            parts.push('Token ~'+mins+'m left');
        }
        if (missingRedemptions) parts.push('MISSING channel:read:redemptions (reward triggers disabled)');
        if (missingBits) parts.push('MISSING bits:read (bits triggers disabled)');
        if (parts.length){
          const warnId='scope-warn-line';
          if(!document.getElementById(warnId)){
            const line=document.createElement('div'); line.id=warnId; line.style.cssText='margin-top:6px;font-size:0.55rem;line-height:1.2;color:#ffb347;'; line.textContent=parts.join(' | ');
            container.appendChild(line);
          }
        }
      }
    } catch(e){ /* ignore */ }
  }, 1200);
  }
  document.addEventListener('DOMContentLoaded', wire);
})(typeof window!=='undefined'?window:globalThis);
