// src/system/health.js
// Builds a consolidated Twitch health snapshot (chat + EventSub + token info)
// If provided a twitchService (preferred), we call getHealth(); otherwise we fall
// back to legacy objects (chatClientWrapper/eventSubClient) for backward compatibility.
const { readSettingsFile } = require('./settings');

function buildTwitchHealth({ chatClientWrapper, eventSubClient, twitchService }) {
  if (twitchService && typeof twitchService.getHealth === 'function') {
    try { return twitchService.getHealth(); } catch(_){ /* fall through */ }
  }
  const s = readSettingsFile() || {};
  let chat = 'disconnected';
  if (chatClientWrapper && chatClientWrapper.client) {
    chat = chatClientWrapper.client._connected ? 'connected' : 'connecting';
  } else if (chatClientWrapper && chatClientWrapper.ws) {
    try { chat = chatClientWrapper.ws.readyState === 1 ? 'connected' : 'connecting'; } catch(_){ }
  }
  let eventSub = 'disconnected';
  if (eventSubClient && eventSubClient.socket) {
    try { eventSub = eventSubClient.socket.readyState === 1 ? 'connected' : 'connecting'; } catch(_){ }
  }
  return { chat, eventSub, scopes: s.twitchTokenScopes || [], expiresAt: s.twitchTokenExpiresAt || 0 };
}

module.exports = { buildTwitchHealth };
