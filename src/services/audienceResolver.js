import { canAudienceAccess, getAudienceFromResource } from '../utils/audience.js';

export const resolveAudience = (resource, options = {}) => {
    return getAudienceFromResource(resource, options);
};

export const canAccess = ({ resource, entitlements, ownerId = null, options = {} }) => {
    const audience = resolveAudience(resource, options);
    const decision = canAudienceAccess({
        audience,
        entitlements,
        ownerId,
        tutorId: resource?.tutorId?._id || resource?.tutorId || null,
    });
    return {
        ...decision,
        audience,
    };
};
