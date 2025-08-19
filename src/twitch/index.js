// src/twitch/index.js
// Centralizes Twitch-related helpers used by main.js (IRC + EventSub integration).
// Thin wrappers around token validation, user lookups, and EventSub subscription creation.

const https = require('https');
const TwitchExtensionService = require('./extensionService');

function validateToken(oauthToken, clientId) {
  return new Promise((resolve, reject) => {
    if (!oauthToken) return reject(new Error('Missing token'));
    const clean = oauthToken.startsWith('oauth:') ? oauthToken.slice(6) : oauthToken;
    const opts = { hostname: 'id.twitch.tv', path: '/oauth2/validate', method: 'GET', headers: { 'Authorization': `OAuth ${clean}` } };
    const req = https.request(opts, res => { let data=''; res.on('data', d=>data+=d); res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e){ reject(e);} }); });
    req.on('error', reject); req.end();
  });
}

function helixGetUser(login, token, clientId){
  return new Promise((resolve, reject) => {
    if (!login) return reject(new Error('Missing login'));
    const opts = { hostname:'api.twitch.tv', path:`/helix/users?login=${encodeURIComponent(login)}`, method:'GET', headers:{ 'Authorization':`Bearer ${token}`, 'Client-Id': clientId } };
    const req = https.request(opts, res => { let data=''; res.on('data',d=>data+=d); res.on('end', ()=>{ try { const json = JSON.parse(data); resolve(json.data && json.data[0]); } catch(e){ reject(e);} }); });
    req.on('error', reject); req.end();
  });
}

function helixGetSelf(token, clientId){
  return new Promise((resolve, reject) => {
    const opts = { hostname:'api.twitch.tv', path:'/helix/users', method:'GET', headers:{ 'Authorization':`Bearer ${token}`, 'Client-Id': clientId } };
    const req = https.request(opts, res => { let data=''; res.on('data',d=>data+=d); res.on('end', ()=>{ try { const json = JSON.parse(data); resolve(json.data && json.data[0]); } catch(e){ reject(e);} }); });
    req.on('error', reject); req.end();
  });
}

function helixCreateEventSubSubscription({ type, version, condition, sessionId, token, clientId }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ type, version: version || '1', condition, transport:{ method:'websocket', session_id: sessionId } });
    const req = https.request({ hostname:'api.twitch.tv', path:'/helix/eventsub/subscriptions', method:'POST', headers:{ 'Authorization':`Bearer ${token}`, 'Client-Id': clientId, 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data=''; res.on('data', d=>data+=d); res.on('end', ()=>{ let json=null; try{ json=JSON.parse(data);}catch(_){}; if (res.statusCode>=200 && res.statusCode<300) resolve(json); else reject(new Error('Sub create failed '+res.statusCode+': '+data)); });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

module.exports = { validateToken, helixGetUser, helixGetSelf, helixCreateEventSubSubscription, TwitchExtensionService };
