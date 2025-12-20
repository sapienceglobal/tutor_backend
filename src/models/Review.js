import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        required: [true, 'Review comment is required'],
        trim: true,
        minlength: [10, 'Comment must be at least 10 characters'],
        maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
    // Helpful votes
    helpfulVotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    helpfulCount: {
        type: Number,
        default: 0,
    },
    // Response from tutor (optional feature for future)
    tutorResponse: {
        comment: String,
        respondedAt: Date,
    },
    isEdited: {
        type: Boolean,
        default: false,
    },
    editedAt: Date,
}, {
    timestamps: true, // Adds createdAt and updatedAt
});

// Compound index to ensure one review per student per course
reviewSchema.index({ courseId: 1, studentId: 1 }, { unique: true });

// Index for querying reviews by course
reviewSchema.index({ courseId: 1, createdAt: -1 });

// Static method to calculate average rating for a course
reviewSchema.statics.calculateAverageRating = async function (courseId) {
    const stats = await this.aggregate([
        { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
        {
            $group: {
                _id: '$courseId',
                avgRating: { $avg: '$rating' },
                reviewCount: { $sum: 1 },
            },
        },
    ]);

    if (stats.length > 0) {
        return {
            rating: Math.round(stats[0].avgRating * 10) / 10, // Round to 1 decimal
            reviewCount: stats[0].reviewCount,
        };
    }

    return { rating: 0, reviewCount: 0 };
};

// Method to update course and tutor ratings
reviewSchema.methods.updateRatings = async function () {
    const Course = mongoose.model('Course');
    const Tutor = mongoose.model('Tutor');
    const Review = mongoose.model('Review');

    // Update course rating
    const courseStats = await Review.calculateAverageRating(this.courseId);
    await Course.findByIdAndUpdate(this.courseId, {
        rating: courseStats.rating,
        reviewCount: courseStats.reviewCount,
    });

    // Update tutor rating (average of all their courses)
    const course = await Course.findById(this.courseId);
    if (course) {
        const tutorCourses = await Course.find({ tutorId: course.tutorId });
        const tutorCourseIds = tutorCourses.map(c => c._id);

        const tutorStats = await Review.aggregate([
            { $match: { courseId: { $in: tutorCourseIds } } },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: '$rating' },
                },
            },
        ]);

        if (tutorStats.length > 0) {
            await Tutor.findByIdAndUpdate(course.tutorId, {
                rating: Math.round(tutorStats[0].avgRating * 10) / 10,
            });
        }
    }
};

// Post-save hook to update ratings
reviewSchema.post('save', async function () {
    await this.updateRatings();
});

// Post-remove hook to update ratings
reviewSchema.post('remove', async function () {
    await this.updateRatings();
});

export default mongoose.model('Review', reviewSchema);