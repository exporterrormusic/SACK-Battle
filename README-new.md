# SACK BATTLE

An interactive Twitch game where viewers control characters in real-time boss battles. Viewers use chat commands, channel points, and a Twitch Extension to attack, heal, and defeat bosses together.

## ✨ Features
- **Twitch Chat Integration** - Any message spawns players
- **Twitch Extension** - Click buttons to control your character  
- **Multi-Platform** - Supports Twitch, Discord, and YouTube
- **Boss Battles** - Multiple bosses with unique abilities
- **Live Audio & Visuals** - Dynamic music, sound effects, and animations

## 🚀 Quick Start

1. **Install and Run**:
   ```
   npm install
   npm start
   ```

2. **Configure Twitch** (Settings → General):
   - Add Bot Username, OAuth Token, Channel, Client ID
   - Click "Connect to Twitch"

3. **Add Bosses** (Settings → Boss tab):
   - Import boss folders and arrange playlist

4. **Go Live**: Chat messages now spawn players who can fight bosses!

### Twitch Extension (Optional)
The extension adds clickable buttons for viewers. Extension is pre-deployed - just add it to your channel from the Twitch Extensions directory.

### Discord Integration (Optional)  
Create a Discord bot for clean commands without chat spam:
1. Create bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Configure in Settings → Discord tab

## 🎮 How It Works

**For Streamers:**
- Run the game locally
- Connect to Twitch/Discord/YouTube
- Viewers automatically join when they interact

**For Viewers:**
- **Chat**: Type any message to join, then use `!attack`, `!heal`, `!cover` 
- **Extension**: Click action buttons in the Twitch extension panel
- **Channel Points**: Use configured rewards to trigger special abilities

## 📦 Portable Executable

Create a standalone .exe that runs without installation:

```
npm run build-portable
```

Output: `dist-electron/SACK-BATTLE-Portable-1.0.0.exe` (~200MB)

### Reduce File Size
Compress media files to create smaller executables:

```
./compress-media-quick.bat
```

Reduces size by 50-100MB while maintaining quality.

## ⚙️ Configuration

All settings are in the in-app Settings panel:

- **General**: Twitch connection and basic game settings
- **Boss**: Import and manage boss playlist  
- **Commands**: Configure channel point rewards and chat triggers
- **Discord/YouTube**: Optional platform integrations

Settings save automatically to: `%APPDATA%/SACK BATTLE/game-settings.json`

## 🎯 Game Commands

**Chat Commands:**
- `!attack` - Attack the boss
- `!heal` - Heal yourself  
- `!cover` - Defend against attacks
- `!strike` - Special strike ability
- `!burst` - Ultimate ability (requires charge)
- `!rules` - Show game rules

**Extension**: Same actions via clickable buttons

**Channel Points**: Configure custom rewards in settings

## 🔧 Development

```
npm install
npm start        # Run in development mode
npm run dev      # Alternative start command
```

**Project Structure:**
- `src/` - Main game code
- `twitch-extension/` - Twitch extension frontend/backend
- `src/assets/` - Game assets (avatars, bosses, audio)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Need Help?** Check the [Issues](https://github.com/exporterrormusic/SACK-Battle/issues) page or create a new issue.
