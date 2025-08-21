// src/twitch/backoff.js
// Shared exponential backoff with jitter for Twitch reconnect logic.

function nextDelay(attempt){
  const capped = Math.min(attempt, 6); // cap growth
  const base = Math.pow(2, capped) * 1000; // 1s,2s,4s,...
  const jitter = Math.floor(Math.random()*400);
  return base + jitter;
}

module.exports = { nextDelay };
