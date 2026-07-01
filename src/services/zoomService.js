import axios from 'axios';
import qs from 'qs';
import jwt from 'jsonwebtoken';

// Token cache keyed by clientId to support multi-tenancy
const tokenCache = {};

/**
 * Get Zoom Server-to-Server OAuth Token
 * Caches token until expiration for each client ID
 */
export const getZoomAccessToken = async (customConfig = null) => {
    const accountId = customConfig?.accountId || process.env.ZOOM_ACCOUNT_ID;
    const clientId = customConfig?.clientId || process.env.ZOOM_CLIENT_ID;
    const clientSecret = customConfig?.clientSecret || process.env.ZOOM_CLIENT_SECRET;

    if (!accountId || !clientId || !clientSecret) {
        throw new Error('Zoom Credentials (ACCOUNT_ID, CLIENT_ID, CLIENT_SECRET) missing');
    }

    const cacheKey = clientId;
    const cached = tokenCache[cacheKey];
    
    // Return cached token if still valid (buffer 5 mins)
    if (cached && Date.now() < cached.expiresAt - 300000) {
        return cached.token;
    }

    try {
        const tokenUrl = 'https://zoom.us/oauth/token';
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await axios.post(tokenUrl, qs.stringify({
            grant_type: 'account_credentials',
            account_id: accountId
        }), {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const token = response.data.access_token;
        const expiresAt = Date.now() + (response.data.expires_in * 1000);

        tokenCache[cacheKey] = { token, expiresAt };
        return token;
    } catch (error) {
        console.error('Error fetching Zoom Access Token:', error.response?.data || error.message);
        const detailedError = error.response?.data?.reason
            ? `Zoom Authentication Failed: ${error.response.data.reason} (${error.response.data.error || 'invalid_client'})`
            : 'Failed to authenticate with Zoom. Please check your credentials.';
        throw new Error(detailedError);
    }
};

/**
 * Create a Zoom Meeting
 * @param {object} customConfig - API credentials override { clientId, clientSecret, accountId }
 * @param {string} topic - Meeting topic
 * @param {string} startTime - ISO String start time
 * @param {number} duration - Duration in minutes
 */
export const createZoomMeeting = async (customConfig, topic, startTime, duration) => {
    try {
        const token = await getZoomAccessToken(customConfig);

        // 'me' refers to the account owner/authorized user for S2S app
        const url = 'https://api.zoom.us/v2/users/me/meetings';

        const meetingDetails = {
            topic: topic || 'Live Class',
            type: 2, // Scheduled Meeting
            start_time: startTime, // Should be ISO format
            duration: duration,
            timezone: 'Asia/Kolkata', // Default to India/User timezone
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true, // Allow students to join first
                mute_upon_entry: true,
                waiting_room: false,
                auto_recording: 'none'
            }
        };

        const response = await axios.post(url, meetingDetails, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        return {
            id: response.data.id.toString(),
            join_url: response.data.join_url,
            start_url: response.data.start_url,
            password: response.data.password || ''
        };

    } catch (error) {
        console.error('Error creating Zoom meeting:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to create Zoom meeting');
    }
};

/**
 * Generate Zoom Meeting SDK JWT Signature
 * 
 * ⚠️  IMPORTANT — Zoom Architecture:
 *   - This function MUST use Meeting SDK App credentials (ZOOM_SDK_CLIENT_ID / ZOOM_SDK_CLIENT_SECRET).
 *   - Server-to-Server OAuth credentials (ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET) CANNOT sign Web SDK JWTs.
 *     Using S2S creds here will cause an 'Invalid SDK Key' error / black screen in the frontend player.
 * 
 * @param {string} sdkKey    - From Meeting SDK App: ZOOM_SDK_CLIENT_ID
 * @param {string} sdkSecret - From Meeting SDK App: ZOOM_SDK_CLIENT_SECRET
 * @param {string|number} meetingNumber - Zoom Meeting ID
 * @param {number} role      - 0 = participant, 1 = host
 * @returns {string} HS256 JWT for Zoom Web SDK
 */
export const generateZoomSignature = (sdkKey, sdkSecret, meetingNumber, role) => {
    if (!sdkKey || !sdkSecret) {
        throw new Error('Meeting SDK credentials (ZOOM_SDK_CLIENT_ID / ZOOM_SDK_CLIENT_SECRET) are required to generate a Zoom signature.');
    }

    const iat = Math.round(Date.now() / 1000) - 30; // 30s clock-skew buffer
    const exp = iat + 60 * 60 * 2; // 2 hours expiration

    const payload = {
        sdkKey,
        appKey: sdkKey,
        mn: meetingNumber.toString(),
        role: parseInt(role, 10),
        iat,
        exp,
        tokenExp: exp
    };

    return jwt.sign(payload, sdkSecret, { algorithm: 'HS256' });
};
