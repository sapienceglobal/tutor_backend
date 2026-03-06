import { canAudienceAccess, getAudienceFromResource } from '../utils/audience.js';

export const resolveAudience = (resource, options = {}) => {
    return getAudienceFromResource(resource, options);
};

export const canAccess = ({ resource, entitlements, ownerId = null, options = {} }) => {
    const audience = resolveAudience(resource, options);
    const decision = canAudienceAccess({ audience, entitlements, ownerId });
    return {
        ...decision,
        audience,
    };
};
