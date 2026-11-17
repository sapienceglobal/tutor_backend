/**
 * Centralized Free-tier & default subscription configurations for Institutes and Tutors.
 * Students always use the platform free of charge — no student subscription plans exist.
 */

export const INSTITUTE_FREE_PLAN_NAME = 'free';
export const TUTOR_FREE_PLAN_NAME = 'free';

export const FREE_INSTITUTE_FEATURES = Object.freeze({
  hlsStreaming: false,
  customBranding: false,
  zoomIntegration: false,
  aiFeatures: false,
  aiCreditsPerMonth: 0,
  aiAssistant: false,
  aiAssessment: false,
  aiIntelligence: false,
  manageTutors: true,
  manageStudents: true,
  maxTutors: 5,
  maxStudents: 50,
  customDomain: false,
  advancedAnalytics: false,
  apiAccess: false,
  allowGlobalPublishingByInstituteTutors: false,
});

export const FREE_TUTOR_FEATURES = Object.freeze({
  maxPrivateStudents: 15,
  maxPrivateCourses: 3,
  aiFeatures: false,
  aiCreditsPerMonth: 0,
  aiUsageCount: 0,
  aiAssistant: false,
  aiAssessment: false,
  aiIntelligence: false,
  hlsStreaming: false,
  zoomIntegration: false,
});

export function getInstituteFreePlanFeatures() {
  return { ...FREE_INSTITUTE_FEATURES };
}

export function getTutorFreeSubscriptionConfig() {
  return {
    planName: TUTOR_FREE_PLAN_NAME,
    isActive: true,
    subscriptionExpiresAt: null,
    features: { ...FREE_TUTOR_FEATURES },
  };
}

/**
 * Canonical Free SubscriptionPlan documents ensured by the seed/migration script.
 */
export const DEFAULT_FREE_SUBSCRIPTION_PLANS = Object.freeze([
  {
    name: 'Institute Free',
    price: 0,
    billingCycle: 'lifetime',
    planType: 'institute',
    planRole: 'all',
    isPopular: false,
    isActive: true,
    features: {
      maxTutors: FREE_INSTITUTE_FEATURES.maxTutors,
      maxStudents: FREE_INSTITUTE_FEATURES.maxStudents,
      maxPrivateStudents: 0,
      maxPrivateCourses: 0,
      storageLimitGB: 2,
      hlsStreaming: false,
      customBranding: false,
      zoomIntegration: false,
      apiAccess: false,
      aiAssistant: false,
      aiAssessment: false,
      aiIntelligence: false,
      aiCreditsPerMonth: 0,
    },
  },
  {
    name: 'Tutor Free',
    price: 0,
    billingCycle: 'lifetime',
    planType: 'personal',
    planRole: 'tutor',
    isPopular: false,
    isActive: true,
    features: {
      maxTutors: 1,
      maxStudents: FREE_TUTOR_FEATURES.maxPrivateStudents,
      maxPrivateStudents: FREE_TUTOR_FEATURES.maxPrivateStudents,
      maxPrivateCourses: FREE_TUTOR_FEATURES.maxPrivateCourses,
      storageLimitGB: 1,
      hlsStreaming: false,
      customBranding: false,
      zoomIntegration: false,
      apiAccess: false,
      aiAssistant: false,
      aiAssessment: false,
      aiIntelligence: false,
      aiCreditsPerMonth: 0,
    },
  },
]);

