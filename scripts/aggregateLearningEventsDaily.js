import '../src/config/loadEnv.js';
import mongoose from 'mongoose';
import connectDB from '../src/config/database.js';
import { upsertDailyLearningEventAggregates } from '../src/services/learningEventService.js';

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');

const readArgValue = (name) => {
    const prefix = `${name}=`;
    const arg = args.find((entry) => entry.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : null;
};

const parseDate = (value, endOfDay = false) => {
    if (!value) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`
        : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
};

const buildDateRange = () => {
    const singleDate = readArgValue('--date');
    if (singleDate) {
        return {
            startDate: parseDate(singleDate, false),
            endDate: parseDate(singleDate, true),
        };
    }

    const from = parseDate(readArgValue('--from'), false);
    const to = parseDate(readArgValue('--to'), true);
    if (from || to) {
        return { startDate: from, endDate: to };
    }

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const day = yesterday.toISOString().slice(0, 10);
    return {
        startDate: parseDate(day, false),
        endDate: parseDate(day, true),
    };
};

const run = async () => {
    const { startDate, endDate } = buildDateRange();
    if (!startDate || !endDate) {
        throw new Error('Invalid date range. Use --date=YYYY-MM-DD or --from=YYYY-MM-DD --to=YYYY-MM-DD');
    }

    const instituteId = readArgValue('--institute');

    await connectDB();
    console.log(`Aggregation mode: ${shouldApply ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`Date range (UTC): ${startDate.toISOString()} -> ${endDate.toISOString()}`);
    if (instituteId) {
        console.log(`Institute filter: ${instituteId}`);
    }

    const result = await upsertDailyLearningEventAggregates({
        startDate,
        endDate,
        instituteId,
        dryRun: !shouldApply,
    });

    if (result.dryRun) {
        const preview = result.rows.slice(0, 10).map((row) => ({
            day: row._id.day,
            eventType: row._id.eventType,
            instituteId: row._id.instituteId || null,
            courseId: row._id.courseId || null,
            batchId: row._id.batchId || null,
            count: row.count,
        }));
        console.log(`Dry-run groups: ${result.totalGroups}`);
        console.log('Sample:', preview);
    } else {
        console.log(`Applied groups: ${result.totalGroups}`);
        console.log(`Rows upserted/updated: ${result.modified}`);
    }

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error('Daily aggregation failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
});
