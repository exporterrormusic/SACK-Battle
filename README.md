# SACK BATTLE (Twitch Interactive Boss Battle)

An Electron desktop app that connects to Twitch chat + EventSub to drive an on-stream boss battle / arena experience. Viewers interact via chat messages, channel point redemptions, bits, and a **Twitch Extension** to trigger in‑game buffs, attacks, and events.

## ✨ Key Features
- **Live Twitch Chat integration** (raw IRC) - ANY message spawns players
- **Twitch Extension integration** - Extension buttons work seamlessly with chat
- **Unified user identity** - Chat users and extension users recognized as same person
- **Twitch EventSub** (channel point redemptions + cheer events)
- **Discord integration** - Clean commands without YouTube/Twitch chat spam
- **YouTube Live Chat support** - Multi-platform audience participation
- **Dynamic asset hot‑reload** (avatars, battlefields, bosses) via filesystem watchers
- **Configurable triggers** (channel point titles & bit thresholds)
- **Audio + visual feedback** (music, sfx, animations)

## 🚀 **Quick Setup**

### **Main Game Setup**
1. **Install & run**:
   ```powershell
   npm install
   npm run dev
   ```

2. **Configure Twitch** (Settings → General):
   - Bot Username, OAuth Token, Channel, Client ID
   - Click "Connect to Twitch"

3. **Add bosses** (Settings → Boss tab) and arrange playlist

4. **Test**: Any chat message now spawns players!

### **Twitch Extension Setup** 
The extension is already deployed and configured to work with the game:

- **Backend**: `https://sack-battle-backend-ih8anga2q-exporterrormusics-projects.vercel.app`
- **Extension buttons** create players that are recognized as the same people from chat
- **No duplicate characters** - unified user identity system prevents this

> **For Developers**: See the [Twitch Extension Development Guide](#-twitch-extension-development-guide) below for complete setup instructions, architecture details, and deployment procedures.

### **Discord Integration** (Optional)
For clean command processing without chat spam:

1. **Create Discord bot** at [Discord Developer Portal](https://discord.com/developers/applications)
2. **Get bot token and channel ID**
3. **Configure in Settings → Discord tab**
4. **Share Discord server** with viewers for clean commands

### **YouTube Integration** (Optional)
Multi-platform support with emoji commands:

1. **Get YouTube API key** from [Google Cloud Console](https://console.developers.google.com/)
2. **Configure in Settings → YouTube tab**
3. **Viewers use**: `⚔️` (attack), `🛡️` (cover), `❤️` (heal), `💥` (aggressive), `⭐` (burst)

## 🧱 Architecture Overview
```
Electron Main Process
  main.js
    ├─ Window / lifecycle
    ├─ Settings persistence (JSON in userData)
    ├─ Asset scanning & watchers (src/assets/...)
    ├─ TwitchService (src/twitch/service.js) orchestrates:
    │     ├─ IRC Chat: src/twitch/irc.js (TwitchIrcClient)
    │     ├─ EventSub: src/twitch/eventsub.js (EventSubClient)
    │     ├─ Helpers:  src/twitch/index.js (token validation, Helix lookups, subscription creation)
    │     └─ Backoff:  src/twitch/backoff.js (exponential w/ jitter)
    ├─ Central IPC channel constants: src/core/ipcChannels.js
    ├─ Structured logger: src/core/logger.js
    └─ Health aggregation: src/system/health.js (served via twitch-health IPC)

Renderer Layer (now fully modular – `renderer.js` is only a tiny dependency map stub)
  - Individual focused modules each register a namespaced global (`__audioModule`, `__playlist`, etc.) plus (temporarily) some legacy global aliases during migration
  - Central game-loop UI tick gathers functions via `__gameLoopDeps` (populated in minimal `renderer.js`) and drives rendering
  - Receives Twitch / asset / debug events over IPC through the preload-exposed API

Game Logic (src/game)
  gameState.js    (core game loop / state transitions)
  buffSystem.js   (buff registration + application)
```

## 🧩 Twitch Module Responsibilities
| Module | Purpose |
|--------|---------|
| `src/twitch/index.js` | Pure helper functions: validate token, Helix user fetch, EventSub subscription creation. |
| `src/twitch/service.js` | High-level façade exposing connect(), sendChat(), getHealth(); unifies IRC + EventSub + trigger routing & debug logging. |
| `src/twitch/irc.js` | `TwitchIrcClient` encapsulating raw IRC websocket, reconnect & message parsing. |
| `src/twitch/eventsub.js` | `EventSubClient` manages EventSub websocket session, subscribes to required event types, surfaces notifications. |
| `src/twitch/backoff.js` | Shared `nextDelay(attempt)` exponential backoff with jitter for reconnect strategies. |

## 🔌 IPC Channels (Main ⇄ Renderer)
Central source of truth: `src/core/ipcChannels.js` (imported by main, service, and preload (with fallback for resilience)). Avoid hard‑coding strings elsewhere.
### Incoming to Renderer
- `twitch-chat-status` : { status, bot?, reason?, delay? }
- `twitch-chat` : { username, displayName, message, channel }
- `twitch-pubsub-status` : { status, delay? }
- `twitch-points` : { redemption }
- `twitch-bits` : Event payload for cheer
- `twitch-trigger` : { type: 'reward'|'bits', ... }
- `assets-updated` : { folder, files[] }
- `boss-manifest` : manifest array
- `twitch-debug-log` : streamed debug entries

### Renderer Invokes (ipcRenderer.invoke)
- `twitch-connect` (creds) -> establishes IRC + EventSub
- `twitch-send-chat` ({ text, channel? })
- `twitch-oauth-flow` ({ clientId, scopes[] }) -> OAuth implicit flow popup
- `twitch-health` -> { chat, eventSub, scopes[], expiresAt }
- `load-settings` / `save-settings`
- `pick-image-file`
- `get-assets-list` (folder)
- `get-boss-manifest`
- `twitch-get-debug-log` / `twitch-clear-debug-log`
- `twitch-forget-chat-creds`

## 🔐 Twitch Auth & Scopes
The app uses the implicit flow (popup) and captures `access_token` from the fragment.
Recommended scopes (minimum for current features):
- `chat:read`
- `chat:edit`
- `channel:read:redemptions`
- `bits:read`

Token metadata & scopes are persisted in `game-settings.json` along with expiry calculation (`twitchTokenExpiresAt`).

## 🩺 Health Endpoint
Invoke `ipcRenderer.invoke('twitch-health')` to obtain current status summary:
```
{
  chat: 'connected' | 'connecting' | 'disconnected',
  eventSub: 'connected' | 'connecting' | 'disconnected',
  scopes: string[],
  expiresAt: epochMillis
}
```
Useful for a small status widget or reconnect logic in the UI.

## ♻️ Reconnect Strategy
Both IRC and EventSub use incremental exponential backoff capped (see `backoff.js`). Status events (`reconnect_wait`) include the scheduled delay so a UI can surface countdowns.

## 🗂 Assets
All under `src/assets/`:
- `avatars/` player avatar images
- `battlefield/` backgrounds
- `boss/` multiple boss folders each containing portrait + audio cues
- `powers/` power-specific art/audio bursts
- `ui/` general UI art & audio (menus, win/lose)

Watchers broadcast `assets-updated` to refresh UI automatically when dropping new files in those folders.

## 🧩 Renderer Modules (Current)
All major responsibilities have been extracted. `renderer.js` only defines `__gameLoopDeps` and an initial flag.

| Module | Namespace | Responsibility (summary) |
|--------|-----------|--------------------------|
| `audio.js` | `__audioModule` | Music / SFX (boss, overlay, waiting) + robust boss music retry. |
| `buffs.js` | `__buffsModule` | Buff bar icons, timers, animation helpers. |
| `gameBindings.js` | `__gameBindings` | Scoreboard rendering, round/match header, victory/defeat overlay logic. |
| `gameLoop.js` | (uses `__gameLoopDeps`) | Per-state UI update tick (players, boss, battlefield, overlays, FX). |
| `waitingRoom.js` | `__waitingRoom` | Welcome screen + prebattle overlay creation & dismissal. |
| `playlist.js` | `__playlist` | Boss playlist CRUD, drag reorder, rotation & application (HP, audio, portrait). |
| `bossUI.js` | `__bossUI` | Boss HP bar, portrait, battlefield background refresh. |
| `assets.js` | (globals set via defineProperty) | Initial & live asset list loading (avatars, boss, battlefield) + manifest. |
| `avatars.js` | (helper fn) | Deterministic avatar assignment / locking for players. |
| `fx.js` | (globals: flashBattlefield, shakeHitPlayers) | Particle & flash effects for boss moves. |
| `chat.js` | (listener) | IRC chat command parsing, auto-spawn, !rules cooldown reply. |
| `oauth.js` | (helpers) | OAuth popup flow, token parsing, connection/badge status aggregation, bits/points hooks. |
| `debugPanel.js` | (panel) | Collapsible streamed debug log viewer (refresh / copy / clear). |
| `uiExtras.js` | (helpers) | Rules collapsible, reveal buttons, responsive scaling + fit adjustments. |
| `startController.js` | (handlers) | Start / Next Game & Reset orchestration (clears overlays, buffs, music). |
| `settings.js` | `__settings` | Settings migration, load/save persistence, DOM trigger collectors. |
| `persistence.js` | (scheduler) | Debounced persistence + beforeunload flush. |
| `settingsModal.js` | (modal logic) | Modal open/prefill, dirty tracking, immediate save. |
| `settingsTabs.js` | (tab wiring) | Click delegation for settings tab buttons. |
| `controls.js` | (UI inputs) | Force turn, spawn bot, boss attack selection, test buff triggers. |
| `records.js` | (renderRecords) | Player win records CRUD UI (ties into rank progression). |
| `ranks.js` | (populateRanksTab) | Rank definitions CRUD / persistence. |
| `triggers.js` | (reward bits UI) | Channel point & bits trigger row rendering/editing. |
| `overlays.js` | (overlay helpers) | Overlay show/hide utilities used by bindings & waiting room. |
| `playerRender.js` | (renderPlayers) | Player row DOM diffing / action state styling. |
| `healthWidget.js` / `healthStatus.js` | (init / badge) | Live health polling & status badge management. |
| `utils.js` | (misc) | Small DOM helpers (populateSelect, etc.). |
| `coreWrappers.js` | (compat) | Transitional shims while migrating legacy calls. |
| `renderer.js` | (stub) | Defines `__gameLoopDeps` only (no UI logic). |

### Removal of Legacy Logic
The original monolithic `renderer.js` has been fully pruned. Any residual duplicate listeners were eliminated during extraction; only a dependency map remains, minimizing risk of double side effects.

### Planned (next steps)
- Remove remaining legacy global alias fallbacks once search confirms no external references.
- Add lightweight unit tests for utility & migration logic (settings, playlist rotation, backoff).
- Introduce automated integration smoke test (spawn players via simulated chat events).
- Packaging scripts (electron-builder) and platform icons.
- Optional: add module federation or deferred loading for heavy audio assets.
 - Auto-connect refinement (retry/backoff UI) – initial auto-connect implemented.

### Module Usage Highlights
Playlist flow: manifest load → `__playlist.onManifestLoaded()` → user arranges list → Start / Next Game button triggers `applyNextBossFromPlaylist()` which rotates first entry to end and applies boss assets & audio.

Waiting room: `waitingRoom.js` sets initial `waitingActive`. First user interaction (outside dev bar / settings) dismisses waiting overlay, triggers deferred boss music attempt, and shows prebattle overlay until first match start.

Compatibility strategy: During migration, modules exposed legacy global names. With the renderer stub now active, remaining alias removal is a low-risk cleanup task.

Settings lifecycle: On app load `bootstrap.js` invokes `__settings.loadPersisted(Game)` (migrates & hydrates state). User changes: Save button calls immediate `persist()`. Background changes (records, ranks, triggers) use debounced scheduler; `beforeunload` flush ensures durability on exit.

FX & audio timing: Boss move events processed inside `gameLoop.js` (using lastMove & visualState) to trigger flashes, shakes, and SFX with guard conditions (avoiding double-play during cooldown/charging phases). Boss music retries (spaced attempts) mitigate autoplay / focus restrictions.

### Adding a New Module Pattern
1. Create `src/renderer/myFeature.js` wrapped in an IIFE taking `window`.
2. Implement feature functions internally.
3. Expose a single `api` object on a namespaced global (`__myFeature`).
4. Assign legacy globals pointing to those functions if needed during migration.
5. Insert a `<script>` tag in `index.html` *before* `renderer.js` so renderer can reference it.
6. Replace direct logic in `renderer.js` with thin calls (or remove entirely when safe).

## � Twitch Extension Development Guide

### Overview
The SACK BATTLE Twitch Extension consists of two main components:
- **Frontend**: Interactive buttons displayed on Twitch streams (`twitch-extension/frontend/`)
- **Backend**: Express.js API hosted on Vercel that handles extension requests (`twitch-extension/backend/`)

The extension integrates seamlessly with the main game via `src/integration/backendSync.js`, which polls the backend every 2 seconds to synchronize extension user actions with chat-based gameplay.

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Twitch Viewer  │───▶│  Extension UI    │───▶│  Vercel Backend │
│  (on stream)    │    │  (Frontend)      │    │  (Express API)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         │ HTTP polling
                                                         ▼
                                               ┌─────────────────┐
                                               │  SACK BATTLE    │
                                               │  Electron App   │
                                               │  (Game Logic)   │
                                               └─────────────────┘
```

**Data Flow:**
1. Viewer clicks extension button → sends JWT-authenticated request to backend
2. Backend validates Twitch JWT, applies rate limiting, stores action in memory
3. Game polls backend every 2 seconds via `backendSync.js` 
4. Actions are processed and merged with chat commands using unified user identity
5. Backend automatically cleans up expired cooldowns and old data

### Frontend Development

**Location**: `twitch-extension/frontend/`

**Key Files:**
- `index.html` - Main extension UI with action buttons
- `script.js` - Extension logic, button handlers, Twitch API integration
- `config.js` - Configuration (backend URL, cooldowns, debug settings)
- `video_component.html` - Video overlay component (if used)

**Development Setup:**
1. **Configure Backend URL**:
   ```javascript
   // In config.js
   const EXTENSION_CONFIG = {
     BACKEND_URL: "http://localhost:3003", // For local development
     COOLDOWN_MS: 1200,
     DEBUG: true
   };
   ```

2. **Test Locally**:
   - Open `index.html` in browser (limited functionality without Twitch context)
   - Use Twitch Developer Rig for full testing environment
   - Enable debug mode in `config.js` for console logging

3. **Build for Upload**:
   ```powershell
   cd twitch-extension/frontend
   ./package-for-upload.bat
   # Creates dist/extension-package.zip ready for Twitch Developer Console upload
   ```

**Key Features:**
- **Twitch JWT Integration**: Automatically gets viewer identity and authentication
- **Rate Limiting**: Client-side cooldowns prevent spam (configurable)
- **Error Handling**: Graceful fallbacks for network issues and backend errors
- **Responsive Design**: Works on desktop and mobile Twitch players

### Backend Development

**Location**: `twitch-extension/backend/`

**Key Technologies:**
- Express.js (Node.js web server)
- JWT verification for Twitch authentication
- CORS enabled for extension requests
- Memory-based storage with automatic cleanup
- Environment-aware logging

**Environment Setup:**

1. **Copy Environment Template**:
   ```powershell
   cd twitch-extension/backend
   copy .env.template .env
   ```

2. **Configure Environment Variables**:
   ```bash
   # .env file
   TWITCH_EXT_SECRET="your_extension_secret_from_dev_twitch_tv"
   TWITCH_EXTENSION_CLIENT_ID="your_extension_client_id"
   TWITCH_EXTENSION_SECRET="your_extension_client_secret"
   PORT=3003
   NODE_ENV=development
   ```

   **Getting Twitch Credentials:**
   - Go to [dev.twitch.tv/console](https://dev.twitch.tv/console)
   - Navigate to your Extension → Settings
   - Copy Extension Secret, Client ID, and Client Secret

3. **Install Dependencies**:
   ```powershell
   npm install
   ```

4. **Run Development Server**:
   ```powershell
   npm run dev
   # Starts server with auto-restart on file changes
   ```

**API Endpoints:**

- `POST /command` - Receives extension button actions
  - Validates Twitch JWT token
  - Applies rate limiting (1200ms cooldown per user)
  - Stores action in memory for game polling
  - Returns success/error status

- `GET /commands` - Polled by game every 2 seconds
  - Returns all pending actions
  - Clears returned actions from memory
  - Used by `src/integration/backendSync.js`

**Security Features:**
- JWT signature verification using Twitch extension secret
- Rate limiting per user to prevent abuse
- Input validation and sanitization
- Environment-based logging (no tokens logged in production)
- Automatic memory cleanup of expired cooldowns

### Deployment

**Backend Deployment (Vercel):**

1. **Connect to Vercel**:
   ```powershell
   npm install -g vercel
   cd twitch-extension/backend
   vercel login
   vercel
   ```

2. **Configure Environment Variables**:
   - Go to Vercel dashboard → Project → Settings → Environment Variables
   - Add all variables from `.env` template
   - Set `NODE_ENV=production`

3. **Deploy**:
   ```powershell
   vercel --prod
   ```

4. **Update Frontend Config**:
   ```javascript
   // In frontend/config.js
   BACKEND_URL: "https://your-project.vercel.app"
   ```

**Frontend Deployment (Twitch Developer Console):**

1. **Build Package**:
   ```powershell
   cd twitch-extension/frontend
   ./package-for-upload.bat
   ```

2. **Upload to Twitch**:
   - Go to [dev.twitch.tv/console](https://dev.twitch.tv/console)
   - Select your Extension → Files
   - Upload `dist/extension-package.zip`
   - Submit for review

### Integration with Main Game

**File**: `src/integration/backendSync.js`

This module handles the bridge between the Twitch extension backend and the main game:

```javascript
// Polls backend every 2 seconds
const POLL_INTERVAL = 2000;

// Maps extension usernames to chat usernames
// Ensures unified identity across chat and extension
function mapExtensionToChat(username) {
  // Implementation handles username normalization
}
```

**Key Functions:**
- Polls backend API for new extension actions
- Maps extension usernames to chat equivalents
- Processes extension commands through game action system
- Maintains unified user identity for consistent gameplay

### Troubleshooting

**Common Issues:**

1. **Extension Not Connecting**:
   - Check backend URL in `frontend/config.js`
   - Verify backend is deployed and responding
   - Check browser console for CORS errors

2. **JWT Verification Failing**:
   - Verify `TWITCH_EXT_SECRET` in backend environment
   - Check extension secret in Twitch Developer Console
   - Ensure frontend is served from approved domain

3. **Rate Limiting Too Strict**:
   - Adjust `COOLDOWN_MS` in frontend config
   - Check backend memory cleanup (automatic every 5 minutes)

4. **Actions Not Appearing in Game**:
   - Verify `backendSync.js` is polling correctly
   - Check backend `/commands` endpoint is responding
   - Confirm backend URL in integration matches deployment

**Development Tools:**
- Enable `DEBUG: true` in frontend config for console logging
- Use `NODE_ENV=development` in backend for detailed logs
- Monitor Vercel function logs for backend debugging
- Test API endpoints directly with curl/Postman

### Extension Approval Process

**Before Submission:**
1. Test all functionality with Twitch Developer Rig
2. Verify rate limiting and error handling
3. Ensure proper content guidelines compliance
4. Test on multiple devices/browsers

**Submission Checklist:**
- [ ] Frontend package built with production backend URL
- [ ] Backend deployed with production environment variables
- [ ] All test cases passing in Developer Rig
- [ ] Privacy policy and terms of service configured
- [ ] Asset requirements met (icons, screenshots)

**Post-Approval:**
- Update game settings with extension client ID if needed
- Monitor backend logs for any production issues
- Keep extension secret secure and rotate periodically

## �🔒 Security Information

### For Developers Uploading to GitHub
This project contains sensitive credentials that must be secured before sharing:

**✅ Already Secured:**
- `.gitignore` excludes sensitive files
- `.env.template` provided as safe example
- Configuration files sanitized

**⚠️ Before Upload - Remove:**
- `twitch-extension/backend/.env` (contains real API keys)
- Any hardcoded API keys or tokens  
- Backend deployment URLs in production configs

**🔐 Twitch Extension Security:**
- **Extension Secret**: Never commit to repository, use environment variables only
- **Client ID/Secret**: Store in Vercel environment variables, not in code
- **JWT Verification**: Always validate Twitch extension tokens server-side
- **Rate Limiting**: Implemented to prevent abuse (1200ms cooldown per user)
- **CORS Configuration**: Restrict to Twitch domains in production

**What Users Need After Cloning:**
1. Copy `.env.template` to `.env` in backend directory
2. Add their own Twitch credentials from [dev.twitch.tv/console](https://dev.twitch.tv/console)
3. Update `frontend/config.js` with their backend URL
4. Set up their own Vercel deployment
5. Configure extension in Twitch Developer Console with their backend URL

### Current Status
All components are working and configured:
- ✅ Chat messages spawn characters (any message, not just commands)
- ✅ Extension buttons work with unified user identity
- ✅ Multi-platform support (Twitch, Discord, YouTube)
- ✅ Backend sync within 2 seconds
- ✅ Extension deployed and ready for viewers

## 🧪 Development
Install & run:
```powershell
npm install
npx electron .
```
Shortcut: `npm run dev` if defined (otherwise use above). The Electron entry is `main.js`.

## 📦 Building Portable Executable

Create a standalone .exe file that runs without installation:

### Quick Build
```powershell
# Using the build script (recommended)
./build-portable.bat

# Or manually
npm run build-portable
```

### Build Options
```powershell
npm run build-portable    # Creates portable .exe (no installation needed)
npm run build-installer   # Creates setup installer
npm run build-all         # Creates both portable and installer
```

**Output Location**: `dist-electron/`
- `SACK-BATTLE-Portable-1.0.0.exe` - Portable executable (distribute this file)
- `SACK-BATTLE-Setup-1.0.0.exe` - Installer version (if built)

### Distribution Notes
- **Portable .exe**: Users can run directly, no installation required
- **File size**: ~150-200MB (includes Electron runtime and all dependencies)
- **Requirements**: Windows 10/11, no additional software needed
- **First run**: May take a few seconds to extract and initialize

### Troubleshooting Build Issues
- **Missing dependencies**: Run `npm install` first
- **Build fails**: Check Node.js version (requires Node 16+)
- **Permission errors**: Run PowerShell as administrator
- **Antivirus warnings**: Normal for unsigned executables, add to exclusions if needed

## 🗜️ Media Compression (Reduce File Size)

Your project contains ~379MB of media files. Compress them to create smaller portable executables:

### Quick Compression (Recommended)
```powershell
# Compresses only the largest files for maximum size reduction
./compress-media-quick.bat
```

**Targets the biggest files:**
- `chatterbox/music.wav` (42MB) → Convert to MP3 (~7MB)
- **PNG Options** (you choose):
  - **Option 1**: Skip PNG compression (audio savings only)
  - **Option 2**: PNG optimization (same resolution, removes metadata, 10-30% savings)
  - **Option 3**: Convert backgrounds to JPEG (same resolution, 60-80% savings, loses transparency)

**Expected Results:**
- **Audio only**: 35MB saved (from WAV conversion)
- **With PNG optimization**: 35MB + 10-20MB = 45-55MB saved
- **With JPEG conversion**: 35MB + 30-50MB = 65-85MB saved

### Full Compression (Maximum Savings)
```powershell
# Compresses all media files thoroughly
./compress-media.bat
```

**What it does:**
- Convert all `.wav` files to high-quality MP3 (320kbps)
- Compress MP3 files over 3MB to 192kbps
- **PNG Options**:
  - **PNG Optimization**: Same resolution, removes metadata (10-30% savings)
  - **JPEG Conversion**: Convert non-transparent backgrounds to JPEG (60-80% savings)
  - **Skip PNG**: Audio compression only
- Maintain quality while reducing size

**Expected Results:**
- **Size Reduction**: 100-150MB saved
- **Quality**: High quality maintained
- **Build Time**: 5-10 minutes

### Manual Compression Options

**Audio Compression:**
```powershell
# Convert WAV to MP3 (individual file)
ffmpeg -i "path\to\file.wav" -codec:a libmp3lame -b:a 192k "output.mp3"

# Compress large MP3 files
ffmpeg -i "large-file.mp3" -codec:a libmp3lame -b:a 192k "compressed.mp3"
```

**Image Compression:**
```powershell
# PNG optimization (same resolution, removes metadata)
./optimize-png-only.bat

# Convert backgrounds to JPEG (same resolution, smaller files)
# Note: This loses transparency but keeps exact dimensions
ffmpeg -i "background.png" -q:v 2 "background.jpg"
```

### After Compression
1. **Test Game**: `npm start` - Verify audio/images work
2. **Build New Executable**: `npm run build-portable`
3. **Check Size**: Compare new `.exe` in `dist-electron/`

### Backup & Recovery
- **Automatic Backup**: Compression scripts create backups automatically
- **Restore**: Copy files from backup folder if issues occur
- **Safe Process**: Original files preserved until you confirm compression worked

### Compression Results
**Typical Savings:**
- Quick: 50-80MB reduction (13-21% smaller .exe)
- Full: 100-150MB reduction (26-40% smaller .exe)
- Original .exe: ~200MB → Compressed .exe: ~120-150MB

### Quick Start In-App
1. Open Settings → enter Bot Username, OAuth (use Generate OAuth URL shift‑click for popup), Channel, Client ID.
2. Add bosses to playlist (Boss tab) and arrange order (drag entries).
3. (Optional) Configure channel point & bits triggers (Commands tab) and ranks / records.
4. Close settings (Save). Status badge should show Chat / PubSub connecting → connected.
5. Viewers type chat commands (default: `!attack`, `!cover`, `!heal`) to act each turn; `!rules` prints rules summary (2m cooldown).

Settings persist to disk immediately on Save and on exit (debounced background saves flush on `beforeunload`). File: `%APPDATA%/SACK BATTLE/game-settings.json` (Windows typical path inside Electron `userData`).

### Auto-Connect Behavior
On launch the app now attempts an automatic Twitch connection if previously saved credentials (Bot Username, OAuth Token, Channel, Client ID) and recorded token scopes exist. A status line in the OAuth helper area will show "Auto-connecting...". Disable by clearing one of the fields or scopes (re-authorize) before exit.

If required scopes are missing (e.g. `channel:read:redemptions` or `bits:read`), a warning line appears indicating which trigger types are disabled until you re-authorize with full scopes.

## 🪵 Logging & Debug Stream
`src/core/logger.js` provides a minimal structured logger (timestamp + level + context object). TwitchService forwards notable events (connections, triggers, errors) to the debug log channel `twitch-debug-log`, which the renderer can display in a panel. You can request the full buffer with `twitch-get-debug-log` and clear it with `twitch-clear-debug-log`.

Tip: When adding new instrumentation, use the logger in main/service and emit succinct objects (avoid large payload spam).

## 🧰 Preload Constant Fallback
`preload.js` requires `src/core/ipcChannels.js`; on failure it supplies a maintained inline fallback list so renderer logic keeps working even during packaging misconfigurations. Add new IPC channels in both places when extending.

## 🧱 Future Improvements
- Remove now-redundant legacy global aliases
- Add lightweight unit tests (backoff, playlist rotation, settings migration)
- Optional analytics & usage metrics (guarded behind opt‑in)
- Configurable EventSub subscription types in UI
- Auto-updater for packaged distributions
- Asset pack downloader / import wizard
- Code signing for production releases

## 📝 Changelog (Recent)
- Full renderer decomposition; `renderer.js` reduced to dependency stub
- Added: assets.js, avatars.js, fx.js, chat.js, oauth.js, debugPanel.js, uiExtras.js, startController.js, settingsTabs.js
- Settings persistence reliability: early load in bootstrap + immediate save on manual Save + beforeunload flush
- Tab switching logic extracted (`settingsTabs.js`)
- Duplicate event listener sources removed (prevents double spawning / double audio)
- Boss music startup made more resilient (retry schedule + waiting dismissal hook)
- Added deterministic avatar assignment helper
- Improved prebattle overlay lifecycle (idempotent flags and scoreboard reset guards)
- Debug panel: copy / clear / collapsible state persisted
- Bits & points handlers unified under oauth/connection module
- Safety migrations & schema version tagging for settings
- Auto-connect on startup when prior valid Twitch credentials + scopes present
- Enhanced reward trigger debug logging (logs each redemption received, matches, and no-match reasons)
- Scope/expiry warning line in OAuth helper (highlights missing redemptions or bits scopes)

## 📄 License
(Choose and add a license file if you plan to distribute this.)

---
Feel free to customize wording, add screenshots/GIFs of gameplay, or expand trigger configuration documentation.
