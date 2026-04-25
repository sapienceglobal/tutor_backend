import mongoose from 'mongoose';

const visibilityScopeSchema = new mongoose.Schema({
  visibilityScope: {
    type: String,
    enum: ['global', 'institute', 'private'],
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

    // Get user's active institute memberships
    const memberships = await InstituteMembership.findActiveMemberships(userId);
    const userInstituteIds = memberships.map(m => m.instituteId._id);

    // Build visibility query
    const visibilityQuery = {
      $or: [
        { visibilityScope: 'global' },
        { visibilityScope: 'private', createdBy: userId },
        {
          visibilityScope: 'institute',
          instituteId: { $in: userInstituteIds }
        },
        {
          visibilityScope: 'institute',
          allowedInstitutes: { $in: userInstituteIds }
        }
      ]
    };

    // Apply additional filters
    if (options.instituteId) {
      visibilityQuery.$or.push({
        visibilityScope: 'institute',
        instituteId: options.instituteId
      });
    }

    if (options.createdBy) {
      visibilityQuery.createdBy = options.createdBy;
    }

    return this.find(visibilityQuery);
  },

  async findByInstitute(instituteId, options = {}) {
    const query = {
      $or: [
        { visibilityScope: 'global' },
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
    const resource = await this.constructor.findById(resourceId);
    if (!resource) return false;

    const InstituteMembership = mongoose.model('InstituteMembership');

    switch (resource.visibilityScope) {
      case 'global':
        return true;

      case 'private':
        return resource.createdBy.toString() === userId;

      case 'institute':
        // Check if user is member of the resource's institute
        const membership = await InstituteMembership.checkMembership(
          userId,
          resource.instituteId
        );

        if (membership) return true;

        // Check if user's institute is in allowed institutes
        const userMemberships = await InstituteMembership.findActiveMemberships(userId);
        const userInstituteIds = userMemberships.map(m => m.instituteId._id);

        return resource.allowedInstitutes.some(id =>
          userInstituteIds.includes(id)
        );

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
    const validScopes = ['global', 'institute', 'private'];
    if (!validScopes.includes(newScope)) {
      throw new Error('Invalid visibility scope');
    }

    this.visibilityScope = newScope;

    if (newScope === 'institute' && options.instituteId) {
      this.instituteId = options.instituteId;
    }

    if (newScope === 'private') {
      this.allowedInstitutes = [];
    }

    return this.save();
  }
};

// Middleware for automatic scope validation
visibilityScopeSchema.pre('save', function () {
  // Auto-correct: if scope says 'institute' but no instituteId is available,
  // downgrade to 'global' to avoid a hard crash for independent tutors.
  if (this.visibilityScope === 'institute' && !this.instituteId) {
    console.warn('[VisibilityScope] visibilityScope=institute but no instituteId — auto-correcting to global');
    this.visibilityScope = 'global';
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
