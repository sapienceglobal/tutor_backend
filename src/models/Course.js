import mongoose from 'mongoose';
import { visibilityScopePlugin } from './VisibilityScope.js';
import {
  AUDIENCE_SCOPES,
  normalizeAudienceInput,
  syncLegacyAudience,
  validateAudience,
} from '../utils/audience.js';

const moduleSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  title: {
    type: String,
    required: true,
  },
  description: String,
  order: {
    type: Number,
    default: 0,
  },
});

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
  },
  thumbnail: {
    type: String,
    default: 'https://via.placeholder.com/400x250',
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: true,
  },
  instituteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institute',
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  visibility: {
    type: String,
    enum: ['public', 'institute'],
    default: 'institute',
    index: true
  },
  audience: {
    scope: {
      type: String,
      enum: Object.values(AUDIENCE_SCOPES),
      default: function () {
        return this.instituteId ? AUDIENCE_SCOPES.INSTITUTE : AUDIENCE_SCOPES.GLOBAL;
      },
      index: true,
    },
    instituteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institute',
      default: null,
    },
    batchIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
    }],
    studentIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  price: {
    type: Number,
    default: 0,
    min: 0,
  },
  isFree: {
    type: Boolean,
    default: function () {
      return this.price === 0;
    },
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  },
  duration: {
    type: Number, // in hours
    default: 0,
  },
  language: {
    type: String,
    default: 'English',
  },
  modules: [moduleSchema],
  enrolledCount: {
    type: Number,
    default: 0,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'published', 'archived', 'suspended', 'rejected'],
    default: 'draft',
  },
  requirements: [String],
  whatYouWillLearn: [String],
  announcements: [{
    title: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
  // Multi-tenancy specific fields
  enrollmentSettings: {
    allowInstituteOnly: {
      type: Boolean,
      default: false
    },
    allowedInstitutes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institute'
    }],
    requireApproval: {
      type: Boolean,
      default: false
    }
  },
  // Live class settings
  liveClassSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    maxParticipants: {
      type: Number,
      default: 50
    },
    schedule: [{
      title: String,
      description: String,
      startTime: Date,
      endTime: Date,
      meetingLink: String,
      recordingUrl: String
    }]
  },
  isAIGenerated: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
courseSchema.pre('save', function () {
  this.updatedAt = Date.now();

  const normalizedAudience = normalizeAudienceInput({
    audience: this.audience,
    visibility: this.visibility,
    visibilityScope: this.visibilityScope,
    instituteId: this.instituteId,
  }, {
    defaultScope: this.instituteId ? AUDIENCE_SCOPES.INSTITUTE : AUDIENCE_SCOPES.GLOBAL,
    defaultInstituteId: this.instituteId,
  });

  const validatedAudience = validateAudience(normalizedAudience, {
    requireInstituteId: false,
    allowEmptyPrivate: true,
  });

  syncLegacyAudience(this, validatedAudience);
});

// Apply visibility scope plugin
courseSchema.plugin(visibilityScopePlugin);

// Indexes for performance
courseSchema.index({ title: 'text', description: 'text', 'whatYouWillLearn': 'text' });
courseSchema.index({ tutorId: 1, status: 1 });
courseSchema.index({ categoryId: 1, status: 1 });
courseSchema.index({ price: 1, status: 1 });
courseSchema.index({ rating: -1, enrolledCount: -1 });

// Virtual fields
courseSchema.virtual('previewLesson').get(function () {
  return this.modules.find(module => module.isPreview);
});

// Instance methods
courseSchema.methods = {
  /**
   * Check if user can enroll in this course
   */
  async canUserEnroll(userId) {
    // Check basic access first
    const canAccess = await this.canUserAccess(userId);
    if (!canAccess) return false;

    // Check enrollment restrictions
    if (this.enrollmentSettings.allowInstituteOnly) {
      const InstituteMembership = mongoose.model('InstituteMembership');
      const userMemberships = await InstituteMembership.findActiveMemberships(userId);

      const userInstituteIds = userMemberships.map(m => m.instituteId._id);
      const allowedInstituteIds = [
        this.instituteId,
        ...this.enrollmentSettings.allowedInstitutes.map(id => id.toString())
      ];

      const hasAccess = userInstituteIds.some(id =>
        allowedInstituteIds.includes(id.toString())
      );

      if (!hasAccess) return false;
    }

    return true;
  },

  /**
   * Enroll a student in the course
   */
  async enrollStudent(userId, options = {}) {
    const Enrollment = mongoose.model('Enrollment');

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      userId,
      courseId: this._id
    });

    if (existingEnrollment) {
      throw new Error('Already enrolled in this course');
    }

    // Check enrollment permissions
    const canEnroll = await this.canUserEnroll(userId);
    if (!canEnroll) {
      throw new Error('Not eligible to enroll in this course');
    }

    // Create enrollment
    const enrollment = new Enrollment({
      userId,
      courseId: this._id,
      tutorId: this.tutorId,
      instituteId: this.instituteId,
      status: options.requireApproval ? 'pending' : 'active',
      enrolledAt: new Date(),
      paymentStatus: this.price > 0 ? 'pending' : 'completed'
    });

    await enrollment.save();

    // Update enrollment count
    this.enrolledCount += 1;
    await this.save();

    return enrollment;
  }
};

// Static methods
courseSchema.statics = {
  /**
   * Find courses visible to user
   */
  async findVisibleToUser(userId, options = {}) {
    const filter = { status: 'published' };
    if (options.categoryId) filter.categoryId = options.categoryId;
    return this.find(filter)
      .populate('tutorId', 'name avatar bio')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 });
  },

  /**
   * Find courses by institute
   */
  async findByInstitute(instituteId, options = {}) {
    const filter = { instituteId, status: 'published' };
    if (options.categoryId) filter.categoryId = options.categoryId;
    return this.find(filter)
      .populate('tutorId', 'name avatar')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 });
  },

  /**
   * Search courses
   */
  async searchCourses(query, userId, options = {}) {
    const searchQuery = {
      $and: [
        { status: 'published' },
        {
          $text: { $search: query }
        }
      ]
    };

    // Apply visibility filtering
    if (userId) {
      const InstituteMembership = mongoose.model('InstituteMembership');
      const memberships = await InstituteMembership.findActiveMemberships(userId);
      const userInstituteIds = memberships.map(m => m.instituteId._id);

      searchQuery.$and.push({
        $or: [
          { visibilityScope: 'global' },
          { visibilityScope: 'private', createdBy: userId },
          {
            visibilityScope: 'institute',
            instituteId: { $in: userInstituteIds }
          }
        ]
      });
    } else {
      searchQuery.$and.push({ visibilityScope: 'global' });
    }

    // Apply additional filters
    if (options.categoryId) {
      searchQuery.$and.push({ categoryId: options.categoryId });
    }

    if (options.level) {
      searchQuery.$and.push({ level: options.level });
    }

    if (options.priceRange) {
      searchQuery.$and.push({
        price: {
          $gte: options.priceRange.min,
          $lte: options.priceRange.max
        }
      });
    }

    return this.find(searchQuery)
      .populate('tutorId', 'name avatar')
      .populate('categoryId', 'name')
      .sort({ score: { $meta: 'textScore' } });
  }
};

export default mongoose.model('Course', courseSchema);
