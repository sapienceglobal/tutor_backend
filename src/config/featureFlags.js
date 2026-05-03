const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

const toBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return TRUTHY_VALUES.has(String(value).trim().toLowerCase());
};

export const featureFlags = Object.freeze({
    audienceWriteV2: toBoolean(process.env.FF_AUDIENCE_WRITE_V2, true),
    audienceReadV2Shadow: toBoolean(process.env.FF_AUDIENCE_READ_V2_SHADOW, true),
    audienceEnforceV2: toBoolean(process.env.FF_AUDIENCE_ENFORCE_V2, true),
    analyticsEventsV1: toBoolean(process.env.FF_ANALYTICS_EVENTS_V1, true),
});

export const isFlagEnabled = (flagName) => Boolean(featureFlags[flagName]);
