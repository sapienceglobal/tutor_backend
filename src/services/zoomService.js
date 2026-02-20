import axios from 'axios';
import qs from 'qs';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get Zoom Server-to-Server OAuth Token
 * Caches token until expiration
 */
export const getZoomAccessToken = async () => {
    // Return cached token if still valid (buffer 5 mins)
    if (cachedToken && Date.now() < tokenExpiresAt - 300000) {
        return cachedToken;
    }

    try {
        const accountId = process.env.ZOOM_ACCOUNT_ID;
        const clientId = process.env.ZOOM_CLIENT_ID;
        const clientSecret = process.env.ZOOM_CLIENT_SECRET;

        if (!accountId || !clientId || !clientSecret) {
            throw new Error('Zoom Credentials (ACCOUNT_ID, CLIENT_ID, CLIENT_SECRET) missing');
        }

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

        cachedToken = response.data.access_token;
        // Expires in seconds, convert to ms, add to current time
        tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);

        return cachedToken;
    } catch (error) {
        console.error('Error fetching Zoom Access Token:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with Zoom');
    }
};

/**
 * Create a Zoom Meeting
 * @param {string} topic - Meeting topic
 * @param {string} startTime - ISO String start time
 * @param {number} duration - Duration in minutes
 */
export const createZoomMeeting = async (topic, startTime, duration) => {
    try {
        const token = await getZoomAccessToken();

        // 'me' refers to the account owner/authorized user for S2S app
        const url = 'https://api.zoom.us/v2/users/me/meetings';

        const meetingDetails = {
            topic: topic || 'Live Class',
            type: 2, // Scheduled Meeting
            start_time: startTime, // Should be ISO format
            duration: duration,
            timezone: 'Asia/Kolkata', // Default to India/User timezone if possible
            settings: {
                host_video: true,
                participant_video: false, // Default off
                join_before_host: false,
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
            id: response.data.id,
            join_url: response.data.join_url,
            start_url: response.data.start_url,
            password: response.data.password,
            encrypted_password: response.data.encrypted_password
        };

    } catch (error) {
        console.error('Error creating Zoom meeting:', error.response?.data || error.message);
        throw new Error('Failed to create Zoom meeting');
    }
};
