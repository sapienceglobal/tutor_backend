import LearningEvent from '../models/LearningEvent.js';
import LearningEventDailyAggregate from '../models/LearningEventDailyAggregate.js';
import { featureFlags } from '../config/featureFlags.js';
import { toStringId } from '../utils/audience.js';

const toObjectIdOrNull = (value) => toStringId(value) || null;

const normalizeActor = (actor) => {
    if (!actor) return null;
    if (typeof actor === 'string') {
        return { userId: actor, role: 'student' };
    }
    return {
        userId: actor.id || actor._id || actor.userId || null,
        role: actor.role || 'student',
    };
};

export const emitLearningEvent = async (eventType, actor, context = {}) => {
    if (!featureFlags.analyticsEventsV1) {
        return null;
    }

    const normalizedActor = normalizeActor(actor);
    if (!normalizedActor?.userId) {
        return null;
    }

    const payload = {
        eventType,
        userId: toObjectIdOrNull(normalizedActor.userId),
        role: normalizedActor.role,
        instituteId: toObjectIdOrNull(context.instituteId),
        courseId: toObjectIdOrNull(context.courseId),
        batchId: toObjectIdOrNull(context.batchId),
        resourceId: toObjectIdOrNull(context.resourceId),
        resourceType: context.resourceType || null,
        meta: context.meta || {},
    };

    try {
        return await LearningEvent.create(payload);
    } catch (error) {
        console.error('Learning event emit error:', error.message);
        return null;
    }
};

export const aggregateLearningEvents = async ({
    startDate,
    endDate,
    instituteId = null,
    groupByDay = false,
} = {}) => {
    const match = {};
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    if (instituteId) {
        match.instituteId = instituteId;
    }

    const groupId = {
        eventType: '$eventType',
        instituteId: '$instituteId',
        courseId: '$courseId',
        batchId: '$batchId',
    };

    if (groupByDay) {
        groupId.day = {
            $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'UTC',
            },
        };
    }

    return LearningEvent.aggregate([
        { $match: match },
        {
            $group: {
                _id: groupId,
                count: { $sum: 1 },
            },
        },
    ]);
};

const toUtcDayDate = (dayString) => new Date(`${dayString}T00:00:00.000Z`);

export const upsertDailyLearningEventAggregates = async ({
    startDate,
    endDate,
    instituteId = null,
    dryRun = true,
} = {}) => {
    const rows = await aggregateLearningEvents({
        startDate,
        endDate,
        instituteId,
        groupByDay: true,
    });

    if (dryRun) {
        return {
            dryRun: true,
            totalGroups: rows.length,
            rows,
        };
    }

    const operations = rows.map((row) => ({
        updateOne: {
            filter: {
                date: toUtcDayDate(row._id.day),
                eventType: row._id.eventType,
                instituteId: row._id.instituteId || null,
                courseId: row._id.courseId || null,
                batchId: row._id.batchId || null,
            },
            update: {
                $set: {
                    count: row.count,
                },
            },
            upsert: true,
        },
    }));

    if (operations.length === 0) {
        return {
            dryRun: false,
            totalGroups: 0,
            modified: 0,
        };
    }

    const result = await LearningEventDailyAggregate.bulkWrite(operations, { ordered: false });

    return {
        dryRun: false,
        totalGroups: rows.length,
        modified: (result.modifiedCount || 0) + (result.upsertedCount || 0),
    };
};
