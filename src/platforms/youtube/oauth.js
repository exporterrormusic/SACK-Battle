// src/platforms/youtube/oauth.js
// YouTube OAuth 2.0 authentication service
const { BrowserWindow } = require('electron');
const https = require('https');
const http = require('http');
const url = require('url');

class YouTubeOAuth {
    constructor() {
        this.clientId = null;
        this.clientSecret = null;
        this.redirectUri = 'http://localhost:8080/oauth/callback';
        this.scopes = [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/youtube.force-ssl'
        ];
        this.accessToken = null;
        this.refreshToken = null;
        this.expiryTime = null;
        this.callbackServer = null;
    }

    // Set OAuth credentials (from settings)
    setCredentials(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        console.log('[YouTube OAuth] Credentials set');
    }

    // Generate OAuth authorization URL
    getAuthUrl() {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: this.scopes.join(' '),
            response_type: 'code',
            access_type: 'offline',
            prompt: 'consent'
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    // Start local server to handle OAuth callback
    startCallbackServer() {
        return new Promise((resolve, reject) => {
            this.callbackServer = http.createServer((req, res) => {
                const parsedUrl = url.parse(req.url, true);
                
                if (parsedUrl.pathname === '/oauth/callback') {
                    const code = parsedUrl.query.code;
                    const error = parsedUrl.query.error;
                    
                    // Send response to browser
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    if (error) {
                        res.end(`<html><body><h1>Authentication Failed</h1><p>Error: ${error}</p><script>window.close();</script></body></html>`);
                        reject(new Error(`OAuth error: ${error}`));
                    } else if (code) {
                        res.end(`<html><body><h1>Authentication Successful</h1><p>You can close this window now.</p><script>window.close();</script></body></html>`);
                        resolve(code);
                    } else {
                        res.end(`<html><body><h1>Authentication Failed</h1><p>No authorization code received</p><script>window.close();</script></body></html>`);
                        reject(new Error('No authorization code received'));
                    }
                    
                    // Close server after handling callback
                    this.callbackServer.close();
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<html><body><h1>404 Not Found</h1></body></html>');
                }
            });
            
            this.callbackServer.listen(8080, 'localhost', () => {
                console.log('[YouTube OAuth] Callback server started on http://localhost:8080');
            });
            
            this.callbackServer.on('error', (err) => {
                reject(new Error(`Failed to start callback server: ${err.message}`));
            });
        });
    }

    // Launch OAuth flow in new window
    async authenticate() {
        if (!this.clientId || !this.clientSecret) {
            throw new Error('OAuth credentials not configured');
        }

        console.log('[YouTube OAuth] Starting authentication flow...');

        try {
            // Start callback server
            const authCodePromise = this.startCallbackServer();

            // Create OAuth window
            const authWindow = new BrowserWindow({
                width: 600,
                height: 700,
                webSecurity: true,
                nodeIntegration: false,
                contextIsolation: true,
                show: true,
                modal: true,
                title: 'YouTube Authentication'
            });

            const authUrl = this.getAuthUrl();
            console.log('[YouTube OAuth] Auth URL:', authUrl);

            authWindow.loadURL(authUrl);

            // Handle window closed
            authWindow.on('closed', () => {
                if (this.callbackServer) {
                    this.callbackServer.close();
                }
            });

            // Wait for authorization code from callback server
            const code = await authCodePromise;
            authWindow.close();

            console.log('[YouTube OAuth] Received authorization code');
            
            // Exchange code for tokens
            const tokens = await this.exchangeCodeForTokens(code);
            console.log('[YouTube OAuth] Successfully obtained tokens');
            
            return tokens;

        } catch (error) {
            if (this.callbackServer) {
                this.callbackServer.close();
            }
            throw error;
        }
    }

    // Exchange authorization code for access tokens
    async exchangeCodeForTokens(code) {
        return new Promise((resolve, reject) => {
            const postData = new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: this.redirectUri
            }).toString();

            const options = {
                hostname: 'oauth2.googleapis.com',
                port: 443,
                path: '/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            console.log('[YouTube OAuth] Exchanging code for tokens...');

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        console.log('[YouTube OAuth] Token response received');

                        if (response.error) {
                            reject(new Error(`Token exchange error: ${response.error_description || response.error}`));
                            return;
                        }

                        // Store tokens
                        this.accessToken = response.access_token;
                        this.refreshToken = response.refresh_token;
                        this.expiryTime = Date.now() + (response.expires_in * 1000);

                        console.log('[YouTube OAuth] Tokens stored successfully');

                        resolve({
                            accessToken: this.accessToken,
                            refreshToken: this.refreshToken,
                            expiryTime: this.expiryTime
                        });
                    } catch (err) {
                        reject(new Error(`Failed to parse token response: ${err.message}`));
                    }
                });
            });

            req.on('error', (err) => {
                reject(new Error(`Token request failed: ${err.message}`));
            });

            req.write(postData);
            req.end();
        });
    }

    // Refresh access token using refresh token
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        return new Promise((resolve, reject) => {
            const postData = new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken,
                grant_type: 'refresh_token'
            }).toString();

            const options = {
                hostname: 'oauth2.googleapis.com',
                port: 443,
                path: '/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            console.log('[YouTube OAuth] Refreshing access token...');

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);

                        if (response.error) {
                            reject(new Error(`Token refresh error: ${response.error_description || response.error}`));
                            return;
                        }

                        // Update tokens
                        this.accessToken = response.access_token;
                        this.expiryTime = Date.now() + (response.expires_in * 1000);

                        // Update refresh token if provided
                        if (response.refresh_token) {
                            this.refreshToken = response.refresh_token;
                        }

                        console.log('[YouTube OAuth] Token refreshed successfully');

                        resolve({
                            accessToken: this.accessToken,
                            refreshToken: this.refreshToken,
                            expiryTime: this.expiryTime
                        });
                    } catch (err) {
                        reject(new Error(`Failed to parse refresh response: ${err.message}`));
                    }
                });
            });

            req.on('error', (err) => {
                reject(new Error(`Token refresh request failed: ${err.message}`));
            });

            req.write(postData);
            req.end();
        });
    }

    // Get valid access token (refresh if needed)
    async getValidAccessToken() {
        if (!this.accessToken) {
            throw new Error('No access token available. Please authenticate first.');
        }

        // Check if token is expired (with 5 minute buffer)
        if (this.expiryTime && Date.now() > (this.expiryTime - 300000)) {
            console.log('[YouTube OAuth] Token expired, refreshing...');
            await this.refreshAccessToken();
        }

        return this.accessToken;
    }

    // Check if we have valid authentication
    isAuthenticated() {
        return this.accessToken && this.expiryTime && Date.now() < this.expiryTime;
    }

    // Clear stored tokens
    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.expiryTime = null;
        console.log('[YouTube OAuth] Logged out');
    }

    // Store tokens to persistent storage
    serializeTokens() {
        return {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            expiryTime: this.expiryTime
        };
    }

    // Load tokens from persistent storage
    deserializeTokens(tokens) {
        if (tokens) {
            this.accessToken = tokens.accessToken;
            this.refreshToken = tokens.refreshToken;
            this.expiryTime = tokens.expiryTime;
            console.log('[YouTube OAuth] Tokens loaded from storage');
        }
    }
}

module.exports = YouTubeOAuth;
