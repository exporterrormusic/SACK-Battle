// src/system/settings.js
// Settings persistence helpers extracted from main.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const logger = require('../core/logger');

function settingsFile(){
  return path.join(app.getPath('userData'), 'game-settings.json');
}

function templateFile(){
  return path.join(__dirname, '../config/game-settings-template.json');
}

function readSettingsFile(){
  try { 
    const p = settingsFile(); 
    if (fs.existsSync(p)) { 
      const obj = JSON.parse(fs.readFileSync(p,'utf8')); 
      logger.debug('settings','read_ok',{ path: p }); 
      return obj; 
    } else {
      // Try to load from template file if no saved settings exist
      const templatePath = templateFile();
      if (fs.existsSync(templatePath)) {
        const template = JSON.parse(fs.readFileSync(templatePath,'utf8'));
        logger.debug('settings','loaded_from_template',{ path: templatePath });
        // Save the template as initial settings
        writeSettingsFile(template);
        return template;
      }
    }
  } catch(e){ 
    logger.warn('settings','read_failed',{ error: e.message }); 
  }
  return null;
}

function writeSettingsFile(data){
  try { 
    const stack = new Error().stack;
    console.log('[SettingsDebug] writeSettingsFile called with OAuth:', {
      youtubeOAuthClientId: data?.youtubeOAuthClientId ? `[${data.youtubeOAuthClientId.length} chars]` : data?.youtubeOAuthClientId,
      youtubeOAuthClientSecret: data?.youtubeOAuthClientSecret ? `[${data.youtubeOAuthClientSecret.length} chars]` : data?.youtubeOAuthClientSecret,
      youtubeOAuthTokens: data?.youtubeOAuthTokens
    });
    console.log('[SettingsDebug] Call stack:', stack.split('\n').slice(1, 4).join('\n'));
    
    // Read existing settings to preserve OAuth credentials if incoming data has empty values
    const existingSettings = readSettingsFile();
    let finalData = data;
    
    if (existingSettings) {
      // Preserve existing OAuth values if incoming data has empty values
      if ((!data?.youtubeOAuthClientId || data.youtubeOAuthClientId === '') && 
          existingSettings.youtubeOAuthClientId && existingSettings.youtubeOAuthClientId !== '') {
        console.log('[SettingsDebug] Preserving existing OAuth client ID');
        finalData = { ...data, youtubeOAuthClientId: existingSettings.youtubeOAuthClientId };
      }
      
      if ((!data?.youtubeOAuthClientSecret || data.youtubeOAuthClientSecret === '') && 
          existingSettings.youtubeOAuthClientSecret && existingSettings.youtubeOAuthClientSecret !== '') {
        console.log('[SettingsDebug] Preserving existing OAuth client secret');
        finalData = { ...finalData, youtubeOAuthClientSecret: existingSettings.youtubeOAuthClientSecret };
      }
      
      if ((!data?.youtubeOAuthTokens || data.youtubeOAuthTokens === null) && 
          existingSettings.youtubeOAuthTokens && existingSettings.youtubeOAuthTokens !== null) {
        console.log('[SettingsDebug] Preserving existing OAuth tokens');
        finalData = { ...finalData, youtubeOAuthTokens: existingSettings.youtubeOAuthTokens };
      }
    }
    
    // Always migrate settings before saving to ensure consistency
    const migratedData = migrateSettings(finalData);
    
    console.log('[SettingsDebug] After migration OAuth:', {
      youtubeOAuthClientId: migratedData?.youtubeOAuthClientId ? `[${migratedData.youtubeOAuthClientId.length} chars]` : migratedData?.youtubeOAuthClientId,
      youtubeOAuthClientSecret: migratedData?.youtubeOAuthClientSecret ? `[${migratedData.youtubeOAuthClientSecret.length} chars]` : migratedData?.youtubeOAuthClientSecret,
      youtubeOAuthTokens: migratedData?.youtubeOAuthTokens
    });
    
    fs.writeFileSync(settingsFile(), JSON.stringify(migratedData,null,2),'utf8'); 
    logger.debug('settings','write_ok'); 
    return true; 
  } catch(e){ 
    logger.warn('settings','write_failed',{ error: e.message }); 
  }
  return false;
}

// Migration function to ensure consistency with main.js
function migrateSettings(raw) {
  if (!raw || typeof raw !== 'object') raw = {};
  // Ensure arrays exist
  if (!Array.isArray(raw.channelPointTriggers)) raw.channelPointTriggers = [];
  if (!Array.isArray(raw.bitsThresholds)) raw.bitsThresholds = [];
  // Coerce numeric fields
  if (raw.turnLength != null) raw.turnLength = Math.max(5, parseInt(raw.turnLength,10)||30); else raw.turnLength = 30;
  if (raw.maxTurns != null) raw.maxTurns = Math.max(1, parseInt(raw.maxTurns,10)||6); else raw.maxTurns = 6;
  if (raw.powerfulAttackDamage != null) raw.powerfulAttackDamage = Math.max(1, parseInt(raw.powerfulAttackDamage,10)||30); else raw.powerfulAttackDamage = 30;
  // Normalize respawnMode
  if (!['cooldown','matchend'].includes(raw.respawnMode)) raw.respawnMode = 'cooldown';
  
  // Preserve YouTube settings (ensure they exist with defaults)
  if (raw.youtubeApiKey === undefined) raw.youtubeApiKey = '';
  if (raw.youtubeChannelId === undefined) raw.youtubeChannelId = '';
  if (raw.youtubeOAuthClientId === undefined) raw.youtubeOAuthClientId = '';
  if (raw.youtubeOAuthClientSecret === undefined) raw.youtubeOAuthClientSecret = '';
  if (raw.youtubeOAuthTokens === undefined) raw.youtubeOAuthTokens = null;
  
  // Preserve Discord settings (ensure they exist with defaults)
  if (raw.discordBotToken === undefined) raw.discordBotToken = '';
  if (raw.discordChannelId === undefined) raw.discordChannelId = '';
  
  // Handle chatCommands migration to platform-specific structure
  const cc = raw.chatCommands || {};
  if (cc.twitch || cc.youtube || cc.discord) {
    // Already migrated to platform-specific structure, preserve it
    raw.chatCommands = {
      twitch: cc.twitch || {
        attack: '!attack', cover: '!cover', heal: '!heal',
        aggressive: '!strike', burst: '!burst', avatar: '!avatar'
      },
      youtube: cc.youtube || {
        attack: '!attack', cover: '!cover', heal: '!heal',
        aggressive: '!aggressive', burst: '!burst', avatar: '!avatar'
      },
      discord: cc.discord || {
        attack: '!attack', cover: '!cover', heal: '!heal',
        aggressive: '!strike', burst: '!burst', avatar: '!avatar'
      }
    };
  } else if (cc.attack || cc.cover || cc.heal) {
    // Legacy flat structure - migrate to platform-specific
    const flatCommands = {
      attack: cc.attack || '!attack',
      cover: cc.cover || '!cover',
      heal: cc.heal || '!heal',
      aggressive: cc.aggressive || cc.strike || '!strike',
      burst: cc.burst || '!burst',
      avatar: cc.avatar || '!avatar'
    };
    
    raw.chatCommands = {
      twitch: { ...flatCommands },
      youtube: { 
        ...flatCommands,
        aggressive: '!aggressive' // YouTube uses different default
      },
      discord: { ...flatCommands }
    };
  } else {
    // No existing commands - create defaults
    raw.chatCommands = {
      twitch: {
        attack: '!attack', cover: '!cover', heal: '!heal',
        aggressive: '!strike', burst: '!burst', avatar: '!avatar'
      },
      youtube: {
        attack: '!attack', cover: '!cover', heal: '!heal',
        aggressive: '!aggressive', burst: '!burst', avatar: '!avatar'
      },
      discord: {
        attack: '!attack', cover: '!cover', heal: '!heal',
        aggressive: '!strike', burst: '!burst', avatar: '!avatar'
      }
    };
  }
  
  return raw;
}

module.exports = { settingsFile, readSettingsFile, writeSettingsFile, templateFile };
