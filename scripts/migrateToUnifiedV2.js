import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../src/models/User.js';
import Tutor from '../src/models/Tutor.js';
import Institute from '../src/models/Institute.js';
import InstituteMembership from '../src/models/InstituteMembership.js';
import TutorStudentLink from '../src/models/TutorStudentLink.js';
import Course from '../src/models/Course.js';
import { Exam } from '../src/models/Exam.js';
import LiveClass from '../src/models/LiveClass.js';
import Assignment from '../src/models/Assignment.js';
import SubscriptionPlan from '../src/models/SubscriptionPlan.js';
import {
  DEFAULT_FREE_SUBSCRIPTION_PLANS,
  getInstituteFreePlanFeatures,
  getTutorFreeSubscriptionConfig,
} from '../src/config/planDefaults.js';
import { AUDIENCE_SCOPES } from '../src/utils/audience.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';
const isApply = process.argv.includes('--apply');

async function migrateFreePlansAndDisableStudentPlans(summary) {
  for (const planDef of DEFAULT_FREE_SUBSCRIPTION_PLANS) {
    const existing = await SubscriptionPlan.findOne({ name: planDef.name });
    if (!existing) {
      summary.plansCreated += 1;
      if (isApply) {
        await SubscriptionPlan.create(planDef);
      }
    }
  }

  const studentPlansQuery = { planRole: 'student', isActive: true };
  summary.studentPlansRetired = await SubscriptionPlan.countDocuments(studentPlansQuery);
  if (isApply && summary.studentPlansRetired > 0) {
    await SubscriptionPlan.updateMany(studentPlansQuery, { $set: { isActive: false } });
  }
}

async function migrateUsersTutorsAndInstitutes(summary) {
  const tutorFreeConfig = getTutorFreeSubscriptionConfig();

  // Ensure Free Tutors have initialized private limits + Free active tier
  const freeTutorsFilter = {
    role: 'tutor',
    $or: [
      { 'personalSubscription.planName': { $exists: false } },
      { 'personalSubscription.planName': null },
      {
        'personalSubscription.planName': 'free',
        $or: [
          { 'personalSubscription.isActive': { $ne: true } },
          { 'personalSubscription.features.maxPrivateStudents': { $exists: false } },
        ],
      },
    ],
  };

  summary.tutorFreeSubscriptionsUpdated = await User.countDocuments(freeTutorsFilter);
  if (isApply && summary.tutorFreeSubscriptionsUpdated > 0) {
    const users = await User.find(freeTutorsFilter).select('_id personalSubscription');
    for (const user of users) {
      const preservedUsage = user.personalSubscription?.features?.aiUsageCount || 0;
      user.personalSubscription = {
        ...tutorFreeConfig,
        features: {
          ...tutorFreeConfig.features,
          aiUsageCount: preservedUsage,
        },
      };
      await user.save();
    }
  }

  // Ensure Tutor profiles have privateTeaching & payoutAccount defaults
  const tutorProfileFilter = {
    $or: [
      { 'privateTeaching.isEnabled': { $exists: false } },
      { 'payoutAccount.verificationStatus': { $exists: false } },
    ],
  };
  summary.tutorProfilesBackfilled = await Tutor.countDocuments(tutorProfileFilter);
  if (isApply && summary.tutorProfilesBackfilled > 0) {
    await Tutor.updateMany(
      { 'privateTeaching.isEnabled': { $exists: false } },
      {
        $set: {
          'privateTeaching.isEnabled': true,
          'privateTeaching.acceptSelfJoinRequests': true,
          'privateTeaching.headline': '',
          'privateTeaching.city': '',
        },
      }
    );
    await Tutor.updateMany(
      { 'payoutAccount.verificationStatus': { $exists: false } },
      {
        $set: {
          'payoutAccount.method': 'none',
          'payoutAccount.verificationStatus': 'not_configured',
        },
      }
    );
  }

  // Ensure Institute docs have discovery & Free limits initialized cleanly
  const freeFeatures = getInstituteFreePlanFeatures();
  const instFilter = {
    $or: [
      { 'discovery.isListedInSearch': { $exists: false } },
      { 'features.maxTutors': { $exists: false } },
      { 'features.maxStudents': { $exists: false } },
    ],
  };
  summary.institutesBackfilled = await Institute.countDocuments(instFilter);
  if (isApply && summary.institutesBackfilled > 0) {
    await Institute.updateMany(
      { 'discovery.isListedInSearch': { $exists: false } },
      {
        $set: {
          'discovery.isListedInSearch': true,
          'discovery.acceptSelfJoinRequests': true,
          'discovery.acceptTutorRequests': true,
          'discovery.city': '',
          'discovery.tagline': '',
        },
      }
    );
    await Institute.updateMany(
      { 'features.maxTutors': { $exists: false } },
      { $set: { 'features.maxTutors': freeFeatures.maxTutors } }
    );
    await Institute.updateMany(
      { 'features.maxStudents': { $exists: false } },
      { $set: { 'features.maxStudents': freeFeatures.maxStudents } }
    );
  }
}

async function migrateGlobalScopeResources(Model, label, summary) {
  const legacyQuery = {
    $or: [
      { 'audience.scope': AUDIENCE_SCOPES.GLOBAL },
      { 'audience.scope': { $exists: false } },
      { visibilityScope: AUDIENCE_SCOPES.GLOBAL },
    ],
  };

  const count = await Model.countDocuments(legacyQuery);
  summary.resourcesMigrated[label] = count;

  if (!isApply || count === 0) return;

  const docs = await Model.find(legacyQuery);
  for (const doc of docs) {
    const hasBatch = Boolean(doc.batchId || doc.audience?.batchIds?.length);
    let targetScope = AUDIENCE_SCOPES.TUTOR_NETWORK;
    if (doc.instituteId) {
      targetScope = hasBatch ? AUDIENCE_SCOPES.BATCH : AUDIENCE_SCOPES.INSTITUTE;
    }

    doc.audience = {
      scope: targetScope,
      instituteId: doc.instituteId || null,
      batchIds: targetScope === AUDIENCE_SCOPES.BATCH
        ? (doc.audience?.batchIds?.length ? doc.audience.batchIds : [doc.batchId])
        : [],
      studentIds: doc.audience?.studentIds || [],
    };

    if ('visibilityScope' in doc) {
      doc.visibilityScope = targetScope === AUDIENCE_SCOPES.TUTOR_NETWORK
        ? 'tutor_network'
        : 'institute';
    }
    if ('visibility' in doc) {
      doc.visibility = targetScope === AUDIENCE_SCOPES.TUTOR_NETWORK ? 'public' : 'institute';
    }

    await doc.save({ validateModifiedOnly: true });
  }
}

async function migrateCoursePricingModes(summary) {
  const missingPricingFilter = {
    $or: [
      { pricingMode: { $exists: false } },
      { pricingMode: null },
    ],
  };
  summary.coursesPricingBackfilled = await Course.countDocuments(missingPricingFilter);

  if (isApply && summary.coursesPricingBackfilled > 0) {
    await Course.updateMany(
      { ...missingPricingFilter, price: { $lte: 0 } },
      { $set: { pricingMode: 'free', isFree: true } }
    );
    await Course.updateMany(
      { ...missingPricingFilter, price: { $gt: 0 } },
      { $set: { pricingMode: 'offline', isFree: false } }
    );
  }
}

async function backfillInstituteMemberships(summary) {
  const usersWithInstitute = await User.find({
    instituteId: { $ne: null },
    role: { $in: ['student', 'tutor', 'admin'] },
  }).select('_id role instituteId isBlocked');

  let missingCount = 0;
  for (const user of usersWithInstitute) {
    const exists = await InstituteMembership.exists({
      userId: user._id,
      instituteId: user.instituteId,
    });
    if (!exists) {
      missingCount += 1;
      if (isApply) {
        await InstituteMembership.create({
          userId: user._id,
          instituteId: user.instituteId,
          roleInInstitute: user.role,
          status: user.isBlocked ? 'suspended' : 'active',
          joinedVia: 'system_created',
          approvedAt: user.isBlocked ? null : new Date(),
        });
      }
    }
  }
  summary.membershipsBackfilled = missingCount;
}

async function run() {
  const modeLabel = isApply ? 'APPLY (WRITING TO DATABASE)' : 'DRY-RUN (READ-ONLY PREVIEW)';
  console.log(`\n🚀 Starting Unified Workspace Migration [${modeLabel}]`);
  console.log(`📡 Connecting to MongoDB: ${MONGODB_URI}`);

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const summary = {
    mode: isApply ? 'apply' : 'dry-run',
    plansCreated: 0,
    studentPlansRetired: 0,
    tutorFreeSubscriptionsUpdated: 0,
    tutorProfilesBackfilled: 0,
    institutesBackfilled: 0,
    coursesPricingBackfilled: 0,
    membershipsBackfilled: 0,
    existingTutorStudentLinks: await TutorStudentLink.countDocuments({}),
    resourcesMigrated: {},
  };

  await migrateFreePlansAndDisableStudentPlans(summary);
  await migrateUsersTutorsAndInstitutes(summary);
  await migrateGlobalScopeResources(Course, 'courses', summary);
  await migrateGlobalScopeResources(Exam, 'exams', summary);
  await migrateGlobalScopeResources(LiveClass, 'liveClasses', summary);
  await migrateGlobalScopeResources(Assignment, 'assignments', summary);
  await migrateCoursePricingModes(summary);
  await backfillInstituteMemberships(summary);

  console.log('📊 Migration Summary:');
  console.log(JSON.stringify(summary, null, 2));

  if (!isApply) {
    console.log('\nℹ️  Dry-run complete. No database records were modified.');
    console.log('👉 Re-run with `--apply` when ready to commit changes.');
  } else {
    console.log('\n✅ Unified Workspace Migration applied cleanly.');
  }
}

run()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  });
