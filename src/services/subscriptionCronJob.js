import cron from 'node-cron';
import User from '../models/User.js';
import Institute from '../models/Institute.js';
import { logBillingEvent } from '../utils/billingLogger.js';

/**
 * 🔐 Subscription Lifecycle Cron Jobs
 * 
 * 1. Daily Expiry Check (midnight) — Deactivates expired personal & institute subscriptions
 * 2. Monthly Credit Reset (1st of month, 00:05) — Resets aiUsageCount for all active subscriptions
 */
export const initSubscriptionCronJobs = () => {
    console.log("⏰ Subscription Cron Jobs Initialized.");

    // ──────────────────────────────────────────────────────────────
    // 📅 DAILY: Deactivate expired subscriptions (runs at midnight)
    // ──────────────────────────────────────────────────────────────
    cron.schedule('0 0 * * *', async () => {
        const now = new Date();
        console.log(`🔒 [Cron] Running subscription expiry check at ${now.toISOString()}...`);

        try {
            // 1. Deactivate expired PERSONAL subscriptions
            const personalResult = await User.updateMany(
                {
                    'personalSubscription.isActive': true,
                    'personalSubscription.subscriptionExpiresAt': { $lte: now, $ne: null }
                },
                {
                    $set: {
                        'personalSubscription.isActive': false,
                        'personalSubscription.planName': 'Free'
                    }
                }
            );

            if (personalResult.modifiedCount > 0) {
                console.log(`🔒 [Cron] Deactivated ${personalResult.modifiedCount} expired personal subscriptions.`);
            }

            // 2. Downgrade expired INSTITUTE subscriptions
            const instituteResult = await Institute.updateMany(
                {
                    subscriptionExpiresAt: { $lte: now, $ne: null },
                    subscriptionPlan: { $ne: 'Free', $ne: 'free' }
                },
                {
                    $set: {
                        subscriptionPlan: 'Free',
                        'features.hlsStreaming': false,
                        'features.customBranding': false,
                        'features.zoomIntegration': false,
                        'features.aiFeatures': false,
                        'features.aiAssistant': false,
                        'features.aiAssessment': false,
                        'features.aiIntelligence': false,
                        'features.customDomain': false,
                        'features.advancedAnalytics': false,
                        'features.apiAccess': false
                    }
                }
            );

            if (personalResult.modifiedCount > 0 || instituteResult.modifiedCount > 0) {
                await logBillingEvent(null, 'BILLING_SUBSCRIPTION_EXPIRED', {
                    personalSubscriptionsExpired: personalResult.modifiedCount,
                    instituteSubscriptionsExpired: instituteResult.modifiedCount,
                    timestamp: now
                });
            }

            console.log(`✅ [Cron] Expiry check complete. Personal: ${personalResult.modifiedCount}, Institute: ${instituteResult.modifiedCount}`);
        } catch (error) {
            console.error('❌ [Cron] Subscription expiry check failed:', error.message);
        }
    });

    // ──────────────────────────────────────────────────────────────
    // 📅 MONTHLY: Reset AI usage credits (1st of every month, 00:05)
    // ──────────────────────────────────────────────────────────────
    cron.schedule('5 0 1 * *', async () => {
        console.log(`🔄 [Cron] Running monthly AI credit reset...`);

        try {
            // 1. Reset personal AI usage counts
            const personalReset = await User.updateMany(
                {
                    'personalSubscription.isActive': true,
                    'personalSubscription.features.aiUsageCount': { $gt: 0 }
                },
                {
                    $set: { 'personalSubscription.features.aiUsageCount': 0 }
                }
            );

            // 2. Reset institute AI usage counts
            const instituteReset = await Institute.updateMany(
                { aiUsageCount: { $gt: 0 } },
                { $set: { aiUsageCount: 0 } }
            );

            await logBillingEvent(null, 'BILLING_USAGE_RESET', {
                personalUsersResetCount: personalReset.modifiedCount,
                institutesResetCount: instituteReset.modifiedCount,
                timestamp: new Date()
            });

            console.log(`✅ [Cron] Monthly credit reset complete. Personal: ${personalReset.modifiedCount} users, Institute: ${instituteReset.modifiedCount} institutes.`);
        } catch (error) {
            console.error('❌ [Cron] Monthly credit reset failed:', error.message);
        }
    });
};
