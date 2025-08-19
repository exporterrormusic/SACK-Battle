// Configuration for SACK BATTLE Twitch Extension
const EXTENSION_CONFIG = {
  // Backend URL - Current production deployment
  BACKEND_URL: "https://sack-battle-backend-ih8anga2q-exporterrormusics-projects.vercel.app",
  
  // Rate limiting
  COOLDOWN_MS: 1200,
  
  // Debug mode - set to false for production
  DEBUG: false
};

// Using production Vercel backend
console.log("Extension configured for Vercel backend:", EXTENSION_CONFIG.BACKEND_URL);
