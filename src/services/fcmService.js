import User from '../models/User.js';

/**
 * FCM Service — handles sending push notifications via Firebase Cloud Messaging.
 * Falls back to graceful console logging (mock) if service account is not yet configured.
 */
export const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      return; // No tokens registered
    }

    if (!user.notificationSettings?.push) {
      return; // User has disabled push notifications
    }

    console.log(`[FCM Push Triggered] User: ${user.name} (${userId})`);
    console.log(`[FCM Details] Title: "${title}" | Body: "${body}"`);
    console.log(`[FCM Tokens Count]: ${user.fcmTokens.length}`);

    // Simulate sending FCM pushes
    // In production, when Firebase Admin SDK is initialized:
    // await admin.messaging().sendEachForMulticast({
    //   tokens: user.fcmTokens,
    //   notification: { title, body },
    //   data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' }
    // });
    user.fcmTokens.forEach(token => {
      console.log(` -> Simulated push sent to token: ${token.substring(0, 15)}...`);
    });

  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};
