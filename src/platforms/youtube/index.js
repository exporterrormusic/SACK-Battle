// src/platforms/youtube/index.js
// YouTube platform service with OAuth and live chat integration
const YouTubeOAuth = require('./oauth');

// OAuth client instance
const oauthClient = new YouTubeOAuth();

async function validateApiKey(apiKey) {
    console.log('[YouTube] Validating API key...');
    
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=${apiKey}`);
        const data = await response.json();
        
        if (response.ok && data.items && data.items.length > 0) {
            console.log('[YouTube] API key is valid');
            return { success: true, data: data.items[0] };
        } else {
            console.log('[YouTube] API key validation failed:', data);
            return { success: false, error: data.error?.message || 'Invalid API key' };
        }
    } catch (error) {
        console.error('[YouTube] API key validation error:', error);
        return { success: false, error: error.message };
    }
}

async function getChannelInfo(apiKey, channelId) {
    console.log('[YouTube] Getting channel info for:', channelId);
    
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
        const data = await response.json();
        
        if (response.ok && data.items && data.items.length > 0) {
            const channel = data.items[0];
            console.log('[YouTube] Channel info retrieved successfully');
            return { 
                success: true, 
                data: channel
            };
        } else {
            console.log('[YouTube] Channel info failed:', data);
            // Provide more specific error information
            if (data.error) {
                return { success: false, error: `${data.error.message} (Code: ${data.error.code})` };
            } else if (!data.items || data.items.length === 0) {
                return { success: false, error: 'Channel not found. Please verify the Channel ID is correct.' };
            } else {
                return { success: false, error: 'Unknown error occurred while fetching channel info' };
            }
        }
    } catch (error) {
        console.error('[YouTube] Channel info error:', error);
        return { success: false, error: error.message };
    }
}

async function startOAuthFlow(clientId, clientSecret) {
    console.log('[YouTube] Starting OAuth flow...');
    
    try {
        oauthClient.setCredentials(clientId, clientSecret);
        const tokens = await oauthClient.authenticate();
        
        console.log('[YouTube] OAuth flow completed successfully');
        return { 
            success: true, 
            tokens: tokens,
            message: 'Authentication successful! You can now connect to live chat.'
        };
    } catch (error) {
        console.error('[YouTube] OAuth flow failed:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

async function getActiveLiveStreams(apiKey, channelId) {
    console.log('[YouTube] Searching for live streams...');
    
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (!searchResponse.ok) {
            console.error('[YouTube] Search API error:', searchData);
            return { success: false, error: searchData.error?.message || 'Search failed' };
        }
        
        if (!searchData.items || searchData.items.length === 0) {
            return { success: false, error: 'No live streams found. Make sure you are currently live streaming.' };
        }
        
        const liveVideo = searchData.items[0];
        console.log('[YouTube] Found live video:', liveVideo);
        
        return {
            success: true,
            streams: [{
                id: liveVideo.id.videoId,
                title: liveVideo.snippet.title,
                status: 'live'
            }]
        };
        
    } catch (error) {
        console.error('[YouTube] Error searching for live streams:', error);
        return { success: false, error: error.message };
    }
}

async function connectToLiveChat(apiKey, channelId) {
    console.log('[YouTube] Connecting to live chat...');
    
    try {
        if (!oauthClient.isAuthenticated()) {
            return {
                success: false,
                error: 'Not authenticated. Please complete OAuth flow first.',
                requiresAuth: true
            };
        }

        const accessToken = await oauthClient.getValidAccessToken();
        
        const streamsResult = await getActiveLiveStreams(apiKey, channelId);
        if (!streamsResult.success) {
            return streamsResult;
        }

        const liveVideo = streamsResult.streams[0];
        console.log('[YouTube] Connecting to chat for video:', liveVideo.id);

        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?` +
            `part=liveStreamingDetails&id=${liveVideo.id}`;

        const videoResponse = await fetch(videoUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const videoData = await videoResponse.json();
        
        if (!videoResponse.ok) {
            console.error('[YouTube] Video API error:', videoData);
            return { success: false, error: videoData.error?.message || 'Failed to get video details' };
        }

        const liveStreamingDetails = videoData.items[0]?.liveStreamingDetails;
        if (!liveStreamingDetails?.activeLiveChatId) {
            return { 
                success: false, 
                error: 'Live chat not available for this stream.' 
            };
        }

        const liveChatId = liveStreamingDetails.activeLiveChatId;
        console.log('[YouTube] Connected to live chat:', liveChatId);

        startChatPolling(liveChatId, accessToken);

        return {
            success: true,
            chatId: liveChatId,
            streamTitle: liveVideo.title,
            message: `Connected to live chat for "${liveVideo.title}"`
        };

    } catch (error) {
        console.error('[YouTube] Error connecting to live chat:', error);
        return { success: false, error: error.message };
    }
}

// Live chat polling variables
let chatPollingInterval = null;
let nextPageToken = null;

async function startChatPolling(liveChatId, accessToken) {
    console.log('[YouTube] Starting chat polling for:', liveChatId);
    
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
    }

    const pollMessages = async () => {
        try {
            const chatUrl = `https://www.googleapis.com/youtube/v3/liveChat/messages?` +
                `liveChatId=${liveChatId}&part=snippet,authorDetails` +
                (nextPageToken ? `&pageToken=${nextPageToken}` : '');

            const response = await fetch(chatUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('[YouTube] Chat polling error:', data);
                return;
            }

            nextPageToken = data.nextPageToken;

            if (data.items && data.items.length > 0) {
                console.log(`[YouTube] Received ${data.items.length} chat messages`);
                
                for (const message of data.items) {
                    processChatMessage(message);
                }
            }

            const pollingInterval = data.pollingIntervalMillis || 5000;
            setTimeout(pollMessages, pollingInterval);

        } catch (error) {
            console.error('[YouTube] Chat polling error:', error);
            setTimeout(pollMessages, 10000);
        }
    };

    pollMessages();
}

function processChatMessage(message) {
    console.log('[YouTube] Processing message:', message);
    
    const messageData = {
        id: message.id,
        author: message.authorDetails.displayName,
        text: message.snippet.displayMessage,
        timestamp: message.snippet.publishedAt,
        platform: 'youtube',
        authorId: message.authorDetails.channelId,
        isModerator: message.authorDetails.isChatModerator,
        isOwner: message.authorDetails.isChatOwner,
        isSponsor: message.authorDetails.isChatSponsor
    };

    // Send to command processor
    if (global.processCommand) {
        global.processCommand(messageData);
    }
}

function disconnectFromLiveChat() {
    console.log('[YouTube] Disconnecting from live chat...');
    
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }
    
    nextPageToken = null;
    
    return { success: true, message: 'Disconnected from YouTube live chat' };
}

// Token management functions
function saveTokens() {
    return oauthClient.serializeTokens();
}

function loadTokens(tokens) {
    oauthClient.deserializeTokens(tokens);
}

function isAuthenticated() {
    return oauthClient.isAuthenticated();
}

function logout() {
    disconnectFromLiveChat();
    oauthClient.logout();
    return { success: true, message: 'Logged out of YouTube' };
}

function connect() {
    console.log('[YouTube] Connect placeholder - use connectToLiveChat with OAuth instead');
    return { success: false, error: 'Use OAuth authentication and connectToLiveChat function' };
}

module.exports = {
    validateApiKey,
    getChannelInfo,
    startOAuthFlow,
    connectToLiveChat,
    disconnectFromLiveChat,
    isAuthenticated,
    saveTokens,
    loadTokens,
    logout,
    connect
};
