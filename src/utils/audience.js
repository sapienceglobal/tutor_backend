export const AUDIENCE_SCOPES = Object.freeze({
    GLOBAL: 'global',
    INSTITUTE: 'institute',
    BATCH: 'batch',
    PRIVATE: 'private',
});

export const VALID_AUDIENCE_SCOPES = Object.values(AUDIENCE_SCOPES);

const isPlainObject = (value) => (
    Object.prototype.toString.call(value) === '[object Object]'
);

const toStringIdInternal = (value, seen) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'bigint') return value.toString();

    if (typeof value !== 'object') {
        return String(value);
    }

    // Prevent infinite recursion on cyclic objects or ObjectId self-references.
    if (seen.has(value)) return null;
    seen.add(value);

    // Native/ObjectId/BSON ids expose toHexString.
    if (typeof value.toHexString === 'function') {
        try {
            return value.toHexString();
        } catch (error) {
            // continue fallback path
        }
    }

    // Mongoose documents often expose _id/id via getters, and ObjectId._id may self-reference.
    let nestedIdValue = null;
    let nestedVirtualIdValue = null;
    try {
        nestedIdValue = value._id;
    } catch (error) {
        nestedIdValue = null;
    }
    try {
        nestedVirtualIdValue = value.id;
    } catch (error) {
        nestedVirtualIdValue = null;
    }

    if (nestedIdValue && nestedIdValue !== value) {
        const nested = toStringIdInternal(nestedIdValue, seen);
        if (nested) return nested;
    }
    if (nestedVirtualIdValue && nestedVirtualIdValue !== value) {
        const nested = toStringIdInternal(nestedVirtualIdValue, seen);
        if (nested) return nested;
    }

    // Avoid converting plain objects to "[object Object]".
    if (!isPlainObject(value) && typeof value.toString === 'function') {
        const asString = value.toString();
        if (asString && asString !== '[object Object]') {
            return asString;
        }
    }

    return null;
};

export const toStringId = (value) => toStringIdInternal(value, new WeakSet());

export const normalizeIdArray = (value) => {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : [value];
    const mapped = raw
        .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
        .map((entry) => toStringId(entry))
        .filter(Boolean);
    return [...new Set(mapped)];
};

const resolveScopeFromLegacy = ({ visibilityScope, visibility, hasBatchIds, hasStudentIds, defaultScope }) => {
    if (visibilityScope === AUDIENCE_SCOPES.GLOBAL || visibility === 'public') {
        return AUDIENCE_SCOPES.GLOBAL;
    }
    if (visibilityScope === AUDIENCE_SCOPES.PRIVATE) {
        return AUDIENCE_SCOPES.PRIVATE;
    }
    if (hasBatchIds) {
        return AUDIENCE_SCOPES.BATCH;
    }
    if (hasStudentIds) {
        return AUDIENCE_SCOPES.PRIVATE;
    }
    if (visibilityScope === AUDIENCE_SCOPES.INSTITUTE || visibility === 'institute') {
        return AUDIENCE_SCOPES.INSTITUTE;
    }
    return defaultScope;
};

export const normalizeAudienceInput = (input = {}, options = {}) => {
    const audienceInput = (input && typeof input.audience === 'object') ? input.audience : {};
    const defaultScope = options.defaultScope || AUDIENCE_SCOPES.GLOBAL;

    const batchIds = normalizeIdArray(
        audienceInput.batchIds
        ?? input.batchIds
        ?? input.batchId
        ?? null
    );
    const studentIds = normalizeIdArray(
        audienceInput.studentIds
        ?? input.studentIds
        ?? null
    );

    let scope = audienceInput.scope
        ?? input.scope
        ?? resolveScopeFromLegacy({
            visibilityScope: audienceInput.visibilityScope ?? input.visibilityScope,
            visibility: audienceInput.visibility ?? input.visibility,
            hasBatchIds: batchIds.length > 0,
            hasStudentIds: studentIds.length > 0,
            defaultScope,
        });

    if (!VALID_AUDIENCE_SCOPES.includes(scope)) {
        scope = defaultScope;
    }

    let instituteId = toStringId(
        audienceInput.instituteId
        ?? input.instituteId
        ?? options.defaultInstituteId
        ?? null
    );

    if (scope === AUDIENCE_SCOPES.GLOBAL) {
        instituteId = null;
    }

    return {
        scope,
        instituteId,
        batchIds,
        studentIds,
    };
};

export const validateAudience = (audience, options = {}) => {
    const { allowEmptyPrivate = true, requireInstituteId = true } = options;

    if (!audience || !VALID_AUDIENCE_SCOPES.includes(audience.scope)) {
        throw new Error('Invalid audience scope');
    }

    const normalized = {
        scope: audience.scope,
        instituteId: toStringId(audience.instituteId),
        batchIds: normalizeIdArray(audience.batchIds),
        studentIds: normalizeIdArray(audience.studentIds),
    };

    if ((normalized.scope === AUDIENCE_SCOPES.INSTITUTE || normalized.scope === AUDIENCE_SCOPES.BATCH)
        && requireInstituteId
        && !normalized.instituteId) {
        throw new Error('instituteId is required for institute or batch scope');
    }

    if (normalized.scope === AUDIENCE_SCOPES.BATCH && normalized.batchIds.length === 0) {
        throw new Error('At least one batchId is required for batch scope');
    }

    if (normalized.scope === AUDIENCE_SCOPES.PRIVATE && !allowEmptyPrivate && normalized.studentIds.length === 0) {
        throw new Error('At least one studentId is required for private scope');
    }

    if (normalized.scope !== AUDIENCE_SCOPES.BATCH) {
        normalized.batchIds = [];
    }
    if (normalized.scope !== AUDIENCE_SCOPES.PRIVATE) {
        normalized.studentIds = [];
    }

    return normalized;
};

export const syncLegacyAudience = (target, audience) => {
    if (!target || !audience) return target;

    target.audience = audience;

    if (Object.prototype.hasOwnProperty.call(target, 'visibility')) {
        target.visibility = audience.scope === AUDIENCE_SCOPES.GLOBAL ? 'public' : 'institute';
    }

    if (Object.prototype.hasOwnProperty.call(target, 'visibilityScope')) {
        if (audience.scope === AUDIENCE_SCOPES.GLOBAL) {
            target.visibilityScope = AUDIENCE_SCOPES.GLOBAL;
        } else if (audience.scope === AUDIENCE_SCOPES.PRIVATE) {
            target.visibilityScope = AUDIENCE_SCOPES.PRIVATE;
        } else {
            target.visibilityScope = AUDIENCE_SCOPES.INSTITUTE;
        }
    }

    if (Object.prototype.hasOwnProperty.call(target, 'instituteId')) {
        target.instituteId = audience.scope === AUDIENCE_SCOPES.GLOBAL ? null : audience.instituteId;
    }

    if (Object.prototype.hasOwnProperty.call(target, 'batchId')) {
        target.batchId = audience.scope === AUDIENCE_SCOPES.BATCH
            ? (audience.batchIds[0] || null)
            : null;
    }

    return target;
};

export const getAudienceFromResource = (resource = {}, options = {}) => {
    return normalizeAudienceInput({
        audience: resource.audience,
        scope: resource.scope,
        visibility: resource.visibility,
        visibilityScope: resource.visibilityScope,
        instituteId: resource.instituteId,
        batchIds: resource.batchIds,
        batchId: resource.batchId,
        studentIds: resource.studentIds,
    }, options);
};

export const hasIntersection = (left = [], right = []) => {
    if (!left.length || !right.length) return false;
    const rightSet = new Set(right.map((entry) => toStringId(entry)));
    return left.some((entry) => rightSet.has(toStringId(entry)));
};

export const canAudienceAccess = ({ audience, entitlements, ownerId = null }) => {
    if (!entitlements?.userId) {
        return { allowed: false, reason: 'unauthenticated' };
    }

    if (entitlements.role === 'superadmin') {
        return { allowed: true, reason: 'superadmin' };
    }

    const actorId = toStringId(entitlements.userId);
    if (ownerId && actorId && actorId === toStringId(ownerId)) {
        return { allowed: true, reason: 'owner' };
    }

    const normalizedAudience = validateAudience(
        normalizeAudienceInput({ audience }, {
            defaultScope: AUDIENCE_SCOPES.GLOBAL,
            defaultInstituteId: entitlements.activeInstituteId,
        }),
        { requireInstituteId: false, allowEmptyPrivate: true }
    );

    if (normalizedAudience.scope === AUDIENCE_SCOPES.GLOBAL) {
        return { allowed: true, reason: 'global' };
    }

    const membershipInstituteIds = normalizeIdArray(entitlements.membershipInstituteIds);
    const activeInstituteId = toStringId(entitlements.activeInstituteId);
    const audienceInstituteId = toStringId(normalizedAudience.instituteId);
    const hasInstituteAccess = Boolean(
        audienceInstituteId
        && (membershipInstituteIds.includes(audienceInstituteId) || activeInstituteId === audienceInstituteId)
    );

    if (normalizedAudience.scope === AUDIENCE_SCOPES.INSTITUTE) {
        return {
            allowed: hasInstituteAccess,
            reason: hasInstituteAccess ? 'institute_member' : 'institute_mismatch',
        };
    }

    if (normalizedAudience.scope === AUDIENCE_SCOPES.BATCH) {
        const batchIds = normalizeIdArray(entitlements.batchIds);
        const hasBatchAccess = hasInstituteAccess && hasIntersection(batchIds, normalizedAudience.batchIds);
        return {
            allowed: hasBatchAccess,
            reason: hasBatchAccess ? 'batch_member' : 'batch_mismatch',
        };
    }

    if (normalizedAudience.scope === AUDIENCE_SCOPES.PRIVATE) {
        const hasPrivateAccess = normalizeIdArray(normalizedAudience.studentIds).includes(actorId);
        return {
            allowed: hasPrivateAccess,
            reason: hasPrivateAccess ? 'private_allowed' : 'private_denied',
        };
    }

    return { allowed: false, reason: 'unknown_scope' };
};
