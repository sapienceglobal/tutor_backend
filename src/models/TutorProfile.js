import mongoose from 'mongoose';

const tutorProfileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    bio: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    expertise: [{
        subject: String,
        level: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced']
        },
        experience: Number // in years
    }],
    education: [{
        degree: String,
        institution: String,
        year: Number,
        field: String
    }],
    experience: [{
        title: String,
        company: String,
        startDate: Date,
        endDate: Date,
        current: Boolean,
        description: String
    }],
    hourlyRate: {
        type: Number,
        min: 0,
        default: 0
    },
    availability: {
        timezone: String,
        schedule: [{
            day: {
                type: String,
                enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            },
            startTime: String,
            endTime: String,
            available: Boolean
        }]
    },
    profileVisibility: {
        type: String,
        enum: ['public', 'institute'],
        default: 'institute'
    },
    appointmentSettings: {
        requireApproval: {
            type: Boolean,
            default: false
        },
        minBookingHours: {
            type: Number,
            default: 24,
            min: 1
        },
        maxBookingHours: {
            type: Number,
            default: 168, // 1 week
            min: 1
        },
        allowedStudentTypes: [{
            type: String,
            enum: ['institute', 'independent', 'all'],
            default: 'institute'
        }]
    },
    ratings: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0
        }
    },
    totalStudents: {
        type: Number,
        default: 0
    },
    totalSessions: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
tutorProfileSchema.pre('save', function() {
    this.updatedAt = Date.now();
});

// Indexes for performance
tutorProfileSchema.index({ profileVisibility: 1 });
tutorProfileSchema.index({ isActive: 1 });
tutorProfileSchema.index({ 'ratings.average': -1 });

// Instance methods
tutorProfileSchema.methods = {
    /**
     * Check if user can book appointment with this tutor
     */
    canUserBookAppointment(userId) {
        if (!this.isActive) return false;
        
        if (this.profileVisibility === 'public') return true;
        
        // For institute-only visibility, check if user belongs to same institute
        const User = mongoose.model('User');
        return User.findOne({ _id: userId, instituteId: this.instituteId });
    },

    /**
     * Check if student type is allowed
     */
    isStudentTypeAllowed(studentType) {
        const allowedTypes = this.appointmentSettings.allowedStudentTypes;
        return allowedTypes.includes('all') || allowedTypes.includes(studentType);
    }
};

// Static methods
tutorProfileSchema.statics = {
    /**
     * Find public tutors
     */
    async findPublicTutors(options = {}) {
        const query = { 
            isActive: true,
            profileVisibility: 'public'
        };
        
        return this.find(query)
            .populate('userId', 'name email profileImage')
            .sort({ 'ratings.average': -1 })
            .limit(options.limit || 20);
    },

    /**
     * Find tutors visible to user
     */
    async findVisibleToUser(userId, options = {}) {
        const User = mongoose.model('User');
        const user = await User.findById(userId);
        
        if (!user) return [];
        
        let query = { isActive: true };
        
        if (user.instituteId) {
            // User has institute - show institute tutors + public tutors
            query.$or = [
                { profileVisibility: 'public' },
                { profileVisibility: 'institute', instituteId: user.instituteId }
            ];
        } else {
            // Independent user - show only public tutors
            query.profileVisibility = 'public';
        }
        
        return this.find(query)
            .populate('userId', 'name email profileImage')
            .sort({ 'ratings.average': -1 })
            .limit(options.limit || 20);
    }
};

export default mongoose.model('TutorProfile', tutorProfileSchema);
