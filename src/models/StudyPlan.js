import mongoose from 'mongoose';

const dayPlanSchema = new mongoose.Schema({
    day: { type: String, required: true },          // 'Monday', 'Tuesday'…
    date: { type: String },                          // 'Day 1', 'Day 2'…
    topics: [{
        title:       { type: String, required: true },
        duration:    { type: String },               // '45 mins'
        type:        { type: String, enum: ['study', 'practice', 'revision', 'quiz', 'break'], default: 'study' },
        description: { type: String },
        resources:   [{ type: String }],
        completed:   { type: Boolean, default: false },
    }],
    totalMinutes: { type: Number, default: 0 },
    focus:        { type: String },                  // 'Concept Building', 'Practice'…
}, { _id: false });

const studyPlanSchema = new mongoose.Schema({
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'Tutor',
        required: true,
        index: true,
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
        required: true,
        index: true,
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'Course',
        default: null,
    },
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'Institute',
        default: null,
    },

    // Plan metadata
    title:          { type: String, required: true },
    studentName:    { type: String },
    weakTopics:     [{ type: String }],              // lesson titles passed in
    durationWeeks:  { type: Number, default: 2 },
    hoursPerDay:    { type: Number, default: 2 },
    difficulty:     { type: String, enum: ['easy', 'moderate', 'intensive'], default: 'moderate' },
    goal:           { type: String },                // AI-generated goal statement

    // Plan content
    weeklyPlan:     [dayPlanSchema],
    summary:        { type: String },
    keyMilestones:  [{ type: String }],
    estimatedScore: { type: Number },                // projected improvement %

    // Stats
    totalDays:         { type: Number, default: 0 },
    totalStudyHours:   { type: Number, default: 0 },
    topicsCount:       { type: Number, default: 0 },

    status: {
        type:    String,
        enum:    ['active', 'completed', 'archived'],
        default: 'active',
    },
}, { timestamps: true });

studyPlanSchema.index({ tutorId: 1, studentId: 1, createdAt: -1 });

export default mongoose.model('StudyPlan', studyPlanSchema);