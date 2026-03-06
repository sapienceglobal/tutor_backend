import '../src/config/loadEnv.js';
import mongoose from 'mongoose';
import connectDB from '../src/config/database.js';
import Course from '../src/models/Course.js';
import { Exam } from '../src/models/Exam.js';
import Assignment from '../src/models/Assignment.js';
import LiveClass from '../src/models/LiveClass.js';
import {
    AUDIENCE_SCOPES,
    normalizeAudienceInput,
    validateAudience,
} from '../src/utils/audience.js';

const shouldApply = process.argv.includes('--apply');

const inferAudience = (doc) => {
    const normalized = normalizeAudienceInput({
        audience: doc.audience,
        visibility: doc.visibility,
        visibilityScope: doc.visibilityScope,
        instituteId: doc.instituteId,
        batchId: doc.batchId,
    }, {
        defaultScope: doc.batchId
            ? AUDIENCE_SCOPES.BATCH
            : (doc.instituteId ? AUDIENCE_SCOPES.INSTITUTE : AUDIENCE_SCOPES.GLOBAL),
        defaultInstituteId: doc.instituteId || null,
    });

    return validateAudience(normalized, {
        requireInstituteId: false,
        allowEmptyPrivate: true,
    });
};

const backfillModel = async (Model, name) => {
    const docs = await Model.find({}).select('_id audience visibility visibilityScope instituteId batchId');
    let changed = 0;

    for (const doc of docs) {
        const nextAudience = inferAudience(doc);
        const prev = JSON.stringify(doc.audience || {});
        const next = JSON.stringify(nextAudience || {});
        if (prev !== next) {
            changed += 1;
            if (shouldApply) {
                doc.audience = nextAudience;
                if (Object.prototype.hasOwnProperty.call(doc, 'batchId')) {
                    doc.batchId = nextAudience.scope === AUDIENCE_SCOPES.BATCH
                        ? (nextAudience.batchIds[0] || null)
                        : null;
                }
                if (Object.prototype.hasOwnProperty.call(doc, 'instituteId')) {
                    doc.instituteId = nextAudience.scope === AUDIENCE_SCOPES.GLOBAL
                        ? null
                        : (nextAudience.instituteId || null);
                }
                if (Object.prototype.hasOwnProperty.call(doc, 'visibility')) {
                    doc.visibility = nextAudience.scope === AUDIENCE_SCOPES.GLOBAL ? 'public' : 'institute';
                }
                if (Object.prototype.hasOwnProperty.call(doc, 'visibilityScope')) {
                    doc.visibilityScope = nextAudience.scope === AUDIENCE_SCOPES.GLOBAL
                        ? AUDIENCE_SCOPES.GLOBAL
                        : (nextAudience.scope === AUDIENCE_SCOPES.PRIVATE ? AUDIENCE_SCOPES.PRIVATE : AUDIENCE_SCOPES.INSTITUTE);
                }
                await doc.save();
            }
        }
    }

    console.log(`${name}: ${changed} documents ${shouldApply ? 'updated' : 'would update'}.`);
};

const run = async () => {
    await connectDB();
    console.log(`Backfill mode: ${shouldApply ? 'APPLY' : 'DRY-RUN'}`);

    await backfillModel(Course, 'Course');
    await backfillModel(Exam, 'Exam');
    await backfillModel(Assignment, 'Assignment');
    await backfillModel(LiveClass, 'LiveClass');

    await mongoose.disconnect();
    console.log('Backfill complete.');
};

run().catch(async (error) => {
    console.error('Audience backfill failed:', error);
    await mongoose.disconnect();
    process.exit(1);
});
