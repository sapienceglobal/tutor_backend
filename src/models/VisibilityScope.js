import mongoose from 'mongoose';
import './TutorStudentLink.js';

const visibilityScopeSchema = new mongoose.Schema({
  visibilityScope: {
    type: String,
    enum: ['global', 'institute', 'tutor_network', 'private'],
    default: 'institute',
    index: true
  },
  instituteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institute',
    required: false,   // Per-model schemas (e.g. Course) control their own required logic
    default: null,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  allowedInstitutes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institute'
  }],
  tags: [{
    type: String,
    index: true
  }]
}, {
  timestamps: true
});

// Compound indexes for efficient querying
visibilityScopeSchema.index({ visibilityScope: 1, instituteId: 1 });
visibilityScopeSchema.index({ createdBy: 1, visibilityScope: 1 });

// Static methods for visibility filtering
visibilityScopeSchema.statics = {
  async findVisibleToUser(userId, options = {}) {
    const InstituteMembership = mongoose.model('InstituteMembership');
    const TutorStudentLink = mongoose.models.TutorStudentLink || mongoose.model('TutorStudentLink');

    // Get user's active institute memberships & private tutor links
    const [memberships, tutorLinks] = await Promise.all([
      InstituteMembership.findActiveMemberships(userId),
      TutorStudentLink ? TutorStudentLink.find({ studentId: userId, status: 'active' }).select('tutorUserId') : [],
    ]);
    const userInstituteIds = memberships
      .map(m => m.instituteId?._id || m.instituteId)
      .filter(Boolean);
    const linkedTutorUserIds = tutorLinks
      .map(l => l.tutorUserId?._id || l.tutorUserId)
      .filter(Boolean);

    // Closed-workspace visibility query: never leak legacy 'global' marketplace items
    const orClauses = [
      { visibilityScope: 'private', createdBy: userId },
      { visibilityScope: 'tutor_network', createdBy: userId },
    ];

    if (linkedTutorUserIds.length > 0) {
      orClauses.push({
        visibilityScope: 'tutor_network',
        createdBy: { $in: linkedTutorUserIds },
      });
    }

    const allowedInstituteScopeIds = options.instituteId
      ? userInstituteIds.filter(id => id.toString() === options.instituteId.toString())
      : userInstituteIds;

    if (allowedInstituteScopeIds.length > 0) {
      orClauses.push(
        { visibilityScope: 'institute', instituteId: { $in: allowedInstituteScopeIds } },
        { visibilityScope: 'institute', allowedInstitutes: { $in: allowedInstituteScopeIds } }
      );
    }

    const visibilityQuery = { $or: orClauses };

    if (options.createdBy) {
      visibilityQuery.createdBy = options.createdBy;
    }

    return this.find(visibilityQuery);
  },

  async findByInstitute(instituteId, options = {}) {
    const query = {
      $or: [
        { visibilityScope: 'institute', instituteId },
        { visibilityScope: 'institute', allowedInstitutes: instituteId }
      ]
    };

    if (options.createdBy) {
      query.createdBy = options.createdBy;
    }

    return this.find(query);
  },

  async validateAccess(resourceId, userId) {
    const model = typeof this.findById === 'function' ? this : this.constructor;
    const resource = await model.findById(resourceId);
    if (!resource) return false;

    if (resource.createdBy && userId && resource.createdBy.toString() === userId.toString()) {
      return true;
    }

    const InstituteMembership = mongoose.model('InstituteMembership');

    switch (resource.visibilityScope) {
      case 'global':
        return false;

      case 'private':
        return resource.createdBy?.toString() === userId?.toString();

      case 'tutor_network': {
        const TutorStudentLink = mongoose.models.TutorStudentLink || mongoose.model('TutorStudentLink');
        if (!TutorStudentLink || !resource.createdBy || !userId) return false;
        const link = await TutorStudentLink.checkLinkByUserIds(resource.createdBy, userId);
        return Boolean(link);
      }

      case 'institute': {
        const membership = await InstituteMembership.checkMembership(
          userId,
          resource.instituteId
        );

        if (membership) return true;

        const userMemberships = await InstituteMembership.findActiveMemberships(userId);
        const userInstituteIds = userMemberships
          .map(m => (m.instituteId?._id || m.instituteId)?.toString())
          .filter(Boolean);

        return (resource.allowedInstitutes || []).some(id =>
          userInstituteIds.includes(id.toString())
        );
      }

      default:
        return false;
    }
  }
};

// Instance methods
visibilityScopeSchema.methods = {
  async canUserAccess(userId) {
    return this.constructor.validateAccess(this._id, userId);
  },

  async addInstituteAccess(instituteIds) {
    if (this.visibilityScope !== 'institute') {
      throw new Error('Can only add institute access to institute-scoped resources');
    }

    this.allowedInstitutes = [...new Set([
      ...this.allowedInstitutes.map(id => id.toString()),
      ...instituteIds
    ])];

    return this.save();
  },

  async removeInstituteAccess(instituteIds) {
    this.allowedInstitutes = this.allowedInstitutes.filter(
      id => !instituteIds.includes(id.toString())
    );
    return this.save();
  },

  async changeVisibility(newScope, options = {}) {
    const validScopes = ['institute', 'tutor_network', 'private'];
    if (!validScopes.includes(newScope)) {
      throw new Error('Invalid visibility scope');
    }

    this.visibilityScope = newScope;

    if (newScope === 'institute' && options.instituteId) {
      this.instituteId = options.instituteId;
    }

    if (newScope === 'tutor_network' || newScope === 'private') {
      this.allowedInstitutes = [];
      if (newScope === 'tutor_network') {
        this.instituteId = null;
      }
    }

    return this.save();
  }
};

// Middleware for automatic scope validation
visibilityScopeSchema.pre('save', function () {
  // Auto-correct: if scope says 'institute' but no instituteId is available,
  // assign 'tutor_network' (closed private workspace) rather than public global marketplace.
  if (this.visibilityScope === 'institute' && !this.instituteId) {
    console.warn('[VisibilityScope] visibilityScope=institute but no instituteId — auto-correcting to tutor_network');
    this.visibilityScope = 'tutor_network';
  }

  // Clear allowedInstitutes if not institute scope
  if (this.visibilityScope !== 'institute') {
    this.allowedInstitutes = [];
  }
});

/**
 * Plugin function to add visibility scope to any schema
 */
function visibilityScopePlugin(schema) {
  schema.add(visibilityScopeSchema);

  // Add static methods
  schema.statics.findVisibleToUser = visibilityScopeSchema.statics.findVisibleToUser;
  schema.statics.findByInstitute = visibilityScopeSchema.statics.findByInstitute;
  schema.statics.validateAccess = visibilityScopeSchema.statics.validateAccess;

  // Add instance methods
  schema.methods.canUserAccess = visibilityScopeSchema.methods.canUserAccess;
  schema.methods.addInstituteAccess = visibilityScopeSchema.methods.addInstituteAccess;
  schema.methods.removeInstituteAccess = visibilityScopeSchema.methods.removeInstituteAccess;
  schema.methods.changeVisibility = visibilityScopeSchema.methods.changeVisibility;
}

export { visibilityScopePlugin, visibilityScopeSchema };
