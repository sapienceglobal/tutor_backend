import mongoose from 'mongoose';

const learningEventDailyAggregateSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        index: true,
    },
    eventType: {
        type: String,
        enum: ['attendance_marked', 'live_class_joined', 'assignment_submitted', 'exam_submitted'],
        required: true,
        index: true,
    },
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        default: null,
        index: true,
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: null,
        index: true,
    },
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        default: null,
        index: true,
    },
    count: {
        type: Number,
        required: true,
        default: 0,
    },
}, {
    timestamps: true,
});

learningEventDailyAggregateSchema.index(
    { date: 1, eventType: 1, instituteId: 1, courseId: 1, batchId: 1 },
    { unique: true, name: 'uniq_daily_event_rollup' }
);

export default mongoose.model('LearningEventDailyAggregate', learningEventDailyAggregateSchema);
