import { toStringId } from '../utils/audience.js';
import { canAccess } from './audienceResolver.js';
import { hasCourseEnrollment, hasPaidCourseAccess } from './entitlementService.js';
import { featureFlags } from '../config/featureFlags.js';

const getShadowResourceId = (resource, shadowContext) => (
    toStringId(shadowContext?.resourceId)
    || toStringId(resource?._id)
    || toStringId(resource?.id)
    || null
);

const logShadowMismatch = ({
    legacyAllowed,
    decision,
    entitlements,
    resource,
    shadowContext = {},
}) => {
    if (!featureFlags.audienceReadV2Shadow || typeof legacyAllowed !== 'boolean') {
        return;
    }
    if (decision.allowed === legacyAllowed) {
        return;
    }

    const resourceType = shadowContext.resourceType || resource?.resourceType || 'resource';
    const resourceId = getShadowResourceId(resource, shadowContext);
    const userId = toStringId(entitlements?.userId) || 'unknown';
    const role = entitlements?.role || 'unknown';
    const scope = decision?.audience?.scope || 'unknown';
    const route = shadowContext.route || 'unknown';

    console.warn(
        `[AUDIENCE_SHADOW_MISMATCH] route=${route} user=${userId} role=${role} resource=${resourceType} resourceId=${resourceId} legacyAllowed=${legacyAllowed} v2Allowed=${decision.allowed} reason=${decision.reason} scope=${scope}`
    );
};

export const evaluateAccess = ({
    resource,
    entitlements,
    ownerId = null,
    requireEnrollment = false,
    requirePayment = false,
    isFree = false,
    courseId = null,
    audienceOptions = {},
    legacyAllowed = null,
    shadowContext = {},
}) => {
    const finalize = (decision) => {
        logShadowMismatch({
            legacyAllowed,
            decision,
            entitlements,
            resource,
            shadowContext,
        });
        return decision;
    };

    const audienceDecision = canAccess({
        resource,
        entitlements,
        ownerId,
        options: audienceOptions,
    });

    if (!audienceDecision.allowed) {
        return finalize({
            allowed: false,
            reason: audienceDecision.reason,
            audience: audienceDecision.audience,
        });
    }

    const normalizedCourseId = toStringId(
        courseId
        || resource?.courseId?._id
        || resource?.courseId
        || null
    );

    const isStudent = entitlements?.role === 'student';

    if (isStudent && requireEnrollment && normalizedCourseId && !hasCourseEnrollment(entitlements, normalizedCourseId)) {
        return finalize({
            allowed: false,
            reason: 'enrollment_required',
            audience: audienceDecision.audience,
        });
    }

    if (isStudent && requirePayment && !isFree && normalizedCourseId && !hasPaidCourseAccess(entitlements, normalizedCourseId)) {
        return finalize({
            allowed: false,
            reason: 'payment_required',
            audience: audienceDecision.audience,
        });
    }

    return finalize({
        allowed: true,
        reason: audienceDecision.reason,
        audience: audienceDecision.audience,
    });
};
