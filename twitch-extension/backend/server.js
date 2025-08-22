import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = createServer(app);

// Middleware
const corsOptions = {
  origin: [
    /^https:\/\/.*\.ext-twitch\.tv$/,     // Twitch Extension domains
    /^https:\/\/.*\.twitch\.tv$/,         // Twitch domains
    'http://localhost:3000',              // Local development
    'http://127.0.0.1:3000',             // Local development
    'http://localhost:8080',              // Extension development server
    'http://127.0.0.1:8080'              // Extension development server
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
};
app.use(cors(corsOptions));

// Explicitly handle OPTIONS for all routes (CORS preflight)
app.options('*', cors(corsOptions));
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
  next();
});

// Configuration
const PORT = process.env.PORT || 3000;
const EXT_SECRET = process.env.TWITCH_EXT_SECRET; // Get from Twitch Developer Console
const GAME_SERVER_PORT = process.env.GAME_SERVER_PORT || 3002; // Use 3002 to avoid conflict with game's port 3001

// In production, we'll use WebSocket over HTTP (Railway will handle this)
const isProduction = process.env.NODE_ENV === 'production';

if (!EXT_SECRET) {
  console.error("❌ TWITCH_EXT_SECRET environment variable is required!");
  console.log("💡 Get this from your Twitch Developer Console → Extensions → Your Extension → Settings");
  process.exit(1);
}

// WebSocket connection to game
let gameConnection = null;

// In production, we use HTTP endpoints instead of separate WebSocket server
// to work better with cloud hosting
if (isProduction) {
  console.log('🌐 Production mode: Using HTTP endpoints for game communication');
} else {
  // Local development: Use WebSocket server
  const gameWS = new WebSocketServer({ port: GAME_SERVER_PORT });

  gameWS.on('connection', (ws) => {
    console.log('🎮 Game connected to backend');
    gameConnection = ws;
    
    ws.on('close', () => {
      console.log('🎮 Game disconnected from backend');
      gameConnection = null;
    });
    
    ws.on('error', (err) => {
      console.error('🎮 Game WebSocket error:', err);
      gameConnection = null;
    });
  });
}

// Verify Twitch JWT token
function verifyTwitchToken(token) {
  try {
    // Allow test tokens in development
    if (token.startsWith('test-token-') && process.env.NODE_ENV === 'development') {
      return {
        user_id: 'test-user-123',
        channel_id: 'test-channel-456',
        opaque_user_id: 'test-opaque-789'
      };
    }

    const secret = Buffer.from(EXT_SECRET, "base64");
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    
    // Only log token contents in development for security
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Token decoded:`, {
        user_id: decoded.user_id,
        opaque_user_id: decoded.opaque_user_id,
        role: decoded.role,
        hasUserId: !!decoded.user_id,
        hasOpaqueId: !!decoded.opaque_user_id
      });
    }
    
    return decoded;
  } catch (e) {
    console.error("❌ Invalid Twitch token:", e.message);
    return null;
  }
}

// Rate limiting per user
const userCooldowns = new Map();
const COOLDOWN_MS = 1000; // 1 second cooldown per user

// Clean up expired cooldowns every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 300000; // 5 minutes
  
  for (const [userId, timestamp] of userCooldowns) {
    if (timestamp < fiveMinutesAgo) {
      userCooldowns.delete(userId);
    }
  }
}, 300000); // Run every 5 minutes

// Store commands for production polling
const pendingCommands = [];

// Game state storage (simple in-memory cache for burst tracking)
const gameState = {
  players: new Map(), // playername -> { burstGauge, lastAction, twitchUserId, etc }
  twitchUserMap: new Map(), // twitchUserId -> playerName
  opaqueUserMap: new Map(), // opaque_user_id -> consistent player name
  chatUserMap: new Map(), // chatUsername -> { twitchUserId, gameUsername }
  userIdToGameName: new Map(), // twitchUserId -> gameUsername (unified mapping)
  lastUpdate: Date.now()
};

function isUserOnCooldown(userId) {
  const lastCommand = userCooldowns.get(userId);
  if (!lastCommand) return false;
  return (Date.now() - lastCommand) < COOLDOWN_MS;
}

function setUserCooldown(userId) {
  userCooldowns.set(userId, Date.now());
}

// Main game command endpoint
app.post("/game", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyTwitchToken(token);

  if (!decoded) {
    return res.status(403).json({ error: "Invalid token" });
  }

  const userId = decoded.user_id;
  const channelId = decoded.channel_id;

  // Validate request body exists
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { command } = req.body;

  // Validate command exists and is string
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: "Command is required and must be a string" });
  }

  // Validate command value
  const validCommands = ['attack', 'heal', 'cover', 'strike', 'burst', 'aggressive'];
  if (!validCommands.includes(command)) {
    return res.status(400).json({ error: "Invalid command" });
  }

  // Check cooldown
  if (isUserOnCooldown(userId)) {
    return res.status(429).json({ error: "Command on cooldown" });
  }

  // Set cooldown
  setUserCooldown(userId);

// Fetch real username from Twitch API
async function fetchTwitchUsername(userId, channelId) {
  try {
    // Use the app access token to fetch user info
    const response = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
      headers: {
        'Client-ID': process.env.TWITCH_EXTENSION_CLIENT_ID,
        'Authorization': `Bearer ${appAccessToken}` // We'll need to add this
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const username = data.data[0].login;
        const displayName = data.data[0].display_name;
        console.log(`✅ Fetched real username for ${userId}: ${username} (${displayName})`);
        return { username, displayName };
      }
    } else {
      console.warn(`⚠️ Failed to fetch username for ${userId}: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Error fetching username for ${userId}:`, error.message);
  }
  
  // Fallback to generic name
  return { username: `Viewer_${userId.slice(-6)}`, displayName: `Viewer_${userId.slice(-6)}` };
}

// App access token for Twitch API calls
let appAccessToken = null;

// Get app access token for API calls
async function getAppAccessToken() {
  if (appAccessToken) return appAccessToken;
  
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_EXTENSION_CLIENT_ID,
        client_secret: process.env.TWITCH_EXTENSION_SECRET,
        grant_type: 'client_credentials'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      appAccessToken = data.access_token;
      console.log('✅ App access token obtained for username fetching');
      
      // Refresh token before it expires (typically 1 hour)
      setTimeout(() => { appAccessToken = null; }, 3500000); // 58 minutes
      
      return appAccessToken;
    } else {
      console.error('❌ Failed to get app access token:', response.status);
    }
  } catch (error) {
    console.error('❌ Error getting app access token:', error.message);
  }
  
  return null;
}

// Initialize app access token on startup
getAppAccessToken();

  // Fetch real username from Twitch API (or use fallback)
  let realUsername, realDisplayName;
  
  try {
    await getAppAccessToken(); // Ensure we have an access token
    const userInfo = await fetchTwitchUsername(userId, channelId);
    realUsername = userInfo.username;
    realDisplayName = userInfo.displayName;
    console.log(`👤 Using real username: ${realUsername} (${realDisplayName}) for user ${userId}`);
  } catch (error) {
    // Fallback: Use opaque_user_id to create consistent username
    const opaqueUserId = decoded.opaque_user_id;
    if (opaqueUserId) {
      // Check if we already have a mapping for this opaque user
      if (gameState.opaqueUserMap.has(opaqueUserId)) {
        realUsername = gameState.opaqueUserMap.get(opaqueUserId);
        console.log(`🔗 Using existing opaque mapping: ${opaqueUserId} -> ${realUsername}`);
      } else {
        // Create a consistent username based on opaque ID
        realUsername = `Player_${opaqueUserId.slice(-6)}`;
        gameState.opaqueUserMap.set(opaqueUserId, realUsername);
        console.log(`🆕 Created opaque mapping: ${opaqueUserId} -> ${realUsername}`);
      }
    } else {
      // Final fallback
      realUsername = `Player_${userId.slice(-6)}`;
      console.log(`⚠️ Using final fallback username: ${realUsername}`);
    }
    realDisplayName = realUsername;
  }

  // Create or update Twitch user mapping for burst tracking
  if (!gameState.twitchUserMap.has(userId)) {
    gameState.twitchUserMap.set(userId, realUsername);
    console.log(`🔗 Created mapping with real username: ${userId} -> ${realUsername}`);
  }

  // Use real username for the game
  let gameUsername;
  
  // Check if we already have a unified mapping for this user ID
  if (gameState.userIdToGameName.has(userId)) {
    gameUsername = gameState.userIdToGameName.get(userId);
    console.log(`🔗 Using existing unified mapping: ${userId} -> ${gameUsername}`);
  } else {
    // Use real username as the game username
    gameUsername = realUsername;
    
    // Store in unified mapping
    gameState.userIdToGameName.set(userId, gameUsername);
    console.log(`🆕 Created new unified mapping: ${userId} -> ${gameUsername}`);
  }

  // Prepare game message
  const gameMessage = {
    type: 'command',
    userId,
    channelId,
    command,
    timestamp: Date.now(),
    username: gameUsername,
    source: 'twitch_extension'
  };

  // Forward to game
  if (isProduction) {
    // Production: Store command for polling
    pendingCommands.push(gameMessage);
    console.log(`📦 Stored ${command} for game polling (${pendingCommands.length} pending)`);
  } else {
    // Development: Use WebSocket
    if (gameConnection && gameConnection.readyState === 1) {
      try {
        gameConnection.send(JSON.stringify(gameMessage));
        console.log(`✅ Forwarded ${command} to game`);
      } catch (err) {
        console.error(`❌ Failed to forward to game:`, err);
        return res.status(500).json({ error: "Game server unavailable" });
      }
    } else {
      console.log(`⚠️ Game not connected, command ${command} ignored`);
      return res.status(503).json({ error: "Game server not connected" });
    }
  }

  res.json({ 
    success: true, 
    command,
    cooldown: COOLDOWN_MS 
  });
});

// Game polling endpoint for production
app.get("/commands", (req, res) => {
  // Return all pending commands and clear the queue
  const commands = [...pendingCommands];
  pendingCommands.length = 0; // Clear array
  
  res.json({
    commands,
    timestamp: Date.now(),
    count: commands.length
  });
});

// User mapping endpoint for chat/extension consistency
app.post("/map-user", (req, res) => {
  try {
    const { twitchUserId, gameUsername, chatUsername } = req.body;
    
    if (!twitchUserId || !gameUsername) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Store the mapping
    gameState.userIdToGameName.set(twitchUserId, gameUsername);
    
    if (chatUsername) {
      gameState.chatUserMap.set(chatUsername, {
        twitchUserId,
        gameUsername
      });
    }

    console.log(`🔗 User mapping stored: ${chatUsername || 'unknown'} (${twitchUserId}) -> ${gameUsername}`);
    
    res.json({ 
      success: true, 
      mapping: { twitchUserId, gameUsername, chatUsername }
    });
  } catch (error) {
    console.error('❌ Error in /map-user:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Privacy policy endpoint
app.get("/privacy-policy", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SACK BATTLE - Privacy Policy</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 { color: #9146ff; }
        h2 { color: #555; margin-top: 30px; }
        .contact { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px; }
        .last-updated { font-style: italic; color: #666; }
    </style>
</head>
<body>
    <h1>SACK BATTLE - Privacy Policy</h1>
    <p class="last-updated">Last updated: August 21, 2025</p>

    <h2>1. Introduction</h2>
    <p>This Privacy Policy describes how SACK BATTLE ("we", "our", or "us") collects, uses, and protects your information when you use our Twitch Extension.</p>

    <h2>2. Information We Collect</h2>
    <h3>2.1 Twitch User Information</h3>
    <ul>
        <li><strong>Twitch User ID:</strong> Used to identify you and link your Twitch account to your game character</li>
        <li><strong>Twitch Username:</strong> Used for display purposes in the game</li>
        <li><strong>Channel ID:</strong> Used to associate your actions with the appropriate game session</li>
    </ul>

    <h3>2.2 Game Activity Data</h3>
    <ul>
        <li><strong>Game Commands:</strong> Actions you take in the game (attack, heal, cover, etc.)</li>
        <li><strong>Game Progress:</strong> Your burst gauge level and other game statistics</li>
        <li><strong>Timestamps:</strong> When you perform actions to prevent spam and manage cooldowns</li>
    </ul>

    <h2>3. How We Use Your Information</h2>
    <p>We use the collected information to:</p>
    <ul>
        <li>Provide the game functionality and connect your Twitch account to your game character</li>
        <li>Track your game progress and statistics</li>
        <li>Prevent spam and abuse through rate limiting</li>
        <li>Display your username and actions to other players in the game</li>
        <li>Improve the game experience and fix technical issues</li>
    </ul>

    <h2>4. Information Sharing</h2>
    <p>We do not sell, trade, or otherwise transfer your personal information to third parties. Your information may be shared only in the following circumstances:</p>
    <ul>
        <li><strong>Game Display:</strong> Your username and game actions are visible to other players in the same game session</li>
        <li><strong>Legal Requirements:</strong> If required by law or to protect our rights and safety</li>
    </ul>

    <h2>5. Data Storage and Security</h2>
    <ul>
        <li>Your data is stored temporarily in memory for the duration of your game session</li>
        <li>User mappings may be cached temporarily to improve performance</li>
        <li>We implement reasonable security measures to protect your information</li>
        <li>No payment information or sensitive personal data is collected or stored</li>
    </ul>

    <h2>6. Data Retention</h2>
    <p>We retain your information only as long as necessary to provide the game service:</p>
    <ul>
        <li>Game session data is cleared when the game ends</li>
        <li>User mappings may be retained for up to 30 days to improve user experience</li>
        <li>Error logs containing user IDs are automatically purged after 7 days</li>
    </ul>

    <h2>7. Third-Party Services</h2>
    <p>Our extension interacts with:</p>
    <ul>
        <li><strong>Twitch Platform:</strong> We receive user tokens and IDs from Twitch's authorization system</li>
        <li><strong>Hosting Services:</strong> Our backend may be hosted on cloud platforms (Railway, Vercel, etc.)</li>
    </ul>

    <h2>8. Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
        <li>Stop using the extension at any time</li>
        <li>Request information about what data we have collected about you</li>
        <li>Request deletion of your data (contact us below)</li>
    </ul>

    <h2>9. Children's Privacy</h2>
    <p>Our extension is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.</p>

    <h2>10. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Last updated" date at the top of this policy.</p>

    <h2>11. Contact Information</h2>
    <div class="contact">
        <p>If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:</p>
        <p><strong>Email:</strong> privacy@sackbattle.com</p>
        <p><strong>GitHub:</strong> https://github.com/exporterrormusic/SACK-Battle</p>
    </div>

    <h2>12. Compliance</h2>
    <p>This extension complies with:</p>
    <ul>
        <li>Twitch Developer Services Agreement</li>
        <li>Twitch Community Guidelines</li>
        <li>Applicable data protection laws including GDPR and CCPA where applicable</li>
    </ul>
</body>
</html>`);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    gameConnected: gameConnection?.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

// Player state endpoint for burst tracking
app.get("/player-state/:playerName", (req, res) => {
  const playerName = decodeURIComponent(req.params.playerName);
  const playerState = gameState.players.get(playerName) || { 
    burstGauge: 0, 
    lastAction: null,
    lastUpdate: Date.now()
  };
  
  res.json(playerState);
});

// Player state by Twitch ID endpoint (for individual tracking)
app.get("/player-state-by-twitch-id/:twitchUserId", (req, res) => {
  const twitchUserId = req.params.twitchUserId;
  const playerName = gameState.twitchUserMap.get(twitchUserId);
  
  if (!playerName) {
    return res.status(404).json({ 
      error: "Player not found in game",
      burstGauge: 0,
      playerName: null
    });
  }
  
  const playerState = gameState.players.get(playerName) || { 
    burstGauge: 0, 
    lastAction: null,
    lastUpdate: Date.now(),
    playerName: playerName
  };
  
  // Include player name in response
  playerState.playerName = playerName;
  
  res.json(playerState);
});

// Game state update endpoint (called by game)
app.post("/update-player-state", (req, res) => {
  const { playerName, burstGauge, lastAction, twitchUserId } = req.body;
  
  if (!playerName) {
    return res.status(400).json({ error: "Player name required" });
  }
  
  // Update player state
  gameState.players.set(playerName, {
    burstGauge: burstGauge || 0,
    lastAction: lastAction || null,
    lastUpdate: Date.now(),
    twitchUserId: twitchUserId || null
  });
  
  // Update Twitch user mapping if provided
  if (twitchUserId) {
    gameState.twitchUserMap.set(twitchUserId, playerName);
  }
  
  gameState.lastUpdate = Date.now();
  
  res.json({ success: true });
});

// Batch update endpoint for efficiency
app.post("/update-all-players", (req, res) => {
  const { players } = req.body; // Array of player states
  
  if (!Array.isArray(players)) {
    return res.status(400).json({ error: "Players array required" });
  }
  
  players.forEach(player => {
    if (player.playerName) {
      gameState.players.set(player.playerName, {
        burstGauge: player.burstGauge || 0,
        lastAction: player.lastAction || null,
        lastUpdate: Date.now(),
        twitchUserId: player.twitchUserId || null
      });
      
      if (player.twitchUserId) {
        gameState.twitchUserMap.set(player.twitchUserId, player.playerName);
      }
    }
  });
  
  gameState.lastUpdate = Date.now();
  
  res.json({ 
    success: true, 
    playersUpdated: players.length 
  });
});

// Stats endpoint
app.get("/stats", (req, res) => {
  res.json({
    activeUsers: userCooldowns.size,
    gameConnected: gameConnection?.readyState === 1,
    uptime: process.uptime(),
    opaqueUserMappings: gameState.opaqueUserMap.size,
    activePlayers: gameState.players.size
  });
});

// Game state endpoint for extension UI
app.get("/game-state", (req, res) => {
  const playerCount = gameState.players.size;
  const gameActive = playerCount > 0;
  
  // Mock boss data - in a real implementation this would come from the game
  const bossData = {
    boss: {
      name: gameActive ? "Shadow Beast" : "No Active Boss",
      health: gameActive ? Math.floor(Math.random() * 80) + 20 : 0, // Random health 20-100
      maxHealth: 100,
      abilities: gameActive ? ["Shadow Strike", "Dark Charge", "Void Shield"] : []
    },
    gameActive: gameActive,
    playerCount: playerCount,
    channelPoints: {
      available: gameActive ? Math.floor(Math.random() * 500) + 100 : 0 // Random points 100-600
    }
  };
  
  res.json(bossData);
});

// Debug endpoint for user mappings
app.get("/debug/users", (req, res) => {
  res.json({
    opaqueUserMap: Object.fromEntries(gameState.opaqueUserMap),
    twitchUserMap: Object.fromEntries(gameState.twitchUserMap),
    players: Object.fromEntries(gameState.players)
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 SACK BATTLE Twitch Backend running on port ${PORT}`);
  console.log(`🎮 Game WebSocket server running on port ${GAME_SERVER_PORT}`);
  console.log(`🔑 Extension secret configured: ${EXT_SECRET ? 'Yes' : 'No'}`);
  
  if (!EXT_SECRET) {
    console.log(`\n💡 To set up:\n1. Get your extension secret from Twitch Developer Console\n2. Set TWITCH_EXT_SECRET environment variable\n3. Restart the server`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  gameWS.close();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
