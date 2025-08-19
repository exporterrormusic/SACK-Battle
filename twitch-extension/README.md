# SACK BATTLE Twitch Extension

This directory contains the Twitch Extension components for SACK BATTLE:

- **`frontend/`** - Extension UI (buttons and interface shown to viewers)
- **`backend/`** - Express.js API server (handles extension requests)

## Quick Setup

### Backend (Required First)
```powershell
cd backend
copy .env.template .env
# Edit .env with your Twitch extension credentials
npm install
npm run dev
```

### Frontend (Deploy to Twitch)
```powershell
cd frontend
# Update config.js with your backend URL
./package-for-upload.bat
# Upload dist/extension-package.zip to Twitch Developer Console
```

## Complete Documentation

**📖 Full setup instructions, architecture details, deployment guides, and troubleshooting:**

See the [Twitch Extension Development Guide](../README.md#-twitch-extension-development-guide) in the main README.

## Quick Links

- [Twitch Developer Console](https://dev.twitch.tv/console) - Manage your extension
- [Vercel Dashboard](https://vercel.com/dashboard) - Deploy backend
- [Extension Documentation](https://dev.twitch.tv/docs/extensions/) - Twitch official docs

## Need Help?

1. Check the [Troubleshooting section](../README.md#troubleshooting) in main README
2. Verify environment variables are correct
3. Test API endpoints directly with curl/Postman
4. Enable debug mode in frontend config.js
