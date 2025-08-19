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
