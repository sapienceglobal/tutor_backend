import InstituteMembership from '../models/InstituteMembership.js';
import TutorStudentLink from '../models/TutorStudentLink.js';
import Tutor from '../models/Tutor.js';
import Institute from '../models/Institute.js';
import User from '../models/User.js';

/**
 * Resolve all active workspaces, pending requests, and rejected requests for a user
 * under the unified single-login architecture.
 */
export async function buildWorkspaceBootstrap(userOrId) {
  const user = userOrId && typeof userOrId === 'object' && userOrId._id
    ? userOrId
    : await User.findById(userOrId).select('role instituteId personalSubscription isVerified');

  if (!user) {
    return {
      hasActiveWorkspace: false,
      defaultWorkspace: null,
      workspaces: { institutes: [], privateTuition: null },
      pendingRequests: { institutes: [], tutors: [] },
      rejectedRequests: { institutes: [], tutors: [] },
    };
  }

  const userId = user._id;

  const [memberships, tutorLinks, tutorProfile] = await Promise.all([
    InstituteMembership.find({ userId })
      .populate('instituteId', 'name subdomain logo isActive subscriptionPlan features discovery')
      .populate('requestedBatchId', 'name')
      .sort({ lastActiveAt: -1, createdAt: -1 })
      .lean(),
    user.role === 'student'
      ? TutorStudentLink.find({ studentId: userId })
          .populate('tutorId', 'subjects bio title rating experience privateTeaching payoutAccount.verificationStatus')
          .populate('tutorUserId', 'name email profileImage')
          .sort({ approvedAt: -1, createdAt: -1 })
          .lean()
      : Promise.resolve([]),
    user.role === 'tutor'
      ? Tutor.findOne({ userId })
          .select('_id instituteId subjects title bio experience isVerified privateTeaching payoutAccount.verificationStatus payoutAccount.method payoutAccount.accountNumberMasked payoutAccount.upiId payoutAccount.bankName payoutAccount.accountHolderName payoutAccount.ifscCode payoutAccount.rejectionReason')
          .lean()
      : Promise.resolve(null),
  ]);

  // Backwards-compatibility: if user has a direct instituteId without an InstituteMembership doc
  const activeMemberships = memberships.filter(
    (m) => m.status === 'active' && m.instituteId && m.instituteId.isActive !== false
  );

  const instituteWorkspaces = activeMemberships.map((m) => ({
    id: m.instituteId._id,
    membershipId: m._id,
    name: m.instituteId.name,
    subdomain: m.instituteId.subdomain,
    logo: m.instituteId.logo,
    roleInInstitute: m.roleInInstitute,
    subscriptionPlan: m.instituteId.subscriptionPlan || 'free',
    features: m.instituteId.features || {},
    permissions: m.permissions || {},
    isPrimary: Boolean(user.instituteId && String(user.instituteId) === String(m.instituteId._id)),
  }));

  if (instituteWorkspaces.length === 0 && user.instituteId) {
    const fallbackInst = await Institute.findById(user.instituteId)
      .select('name subdomain logo isActive subscriptionPlan features')
      .lean();
    if (fallbackInst && fallbackInst.isActive !== false) {
      instituteWorkspaces.push({
        id: fallbackInst._id,
        membershipId: null,
        name: fallbackInst.name,
        subdomain: fallbackInst.subdomain,
        logo: fallbackInst.logo,
        roleInInstitute: user.role === 'admin' ? 'admin' : user.role,
        subscriptionPlan: fallbackInst.subscriptionPlan || 'free',
        features: fallbackInst.features || {},
        permissions: {},
        isPrimary: true,
      });
    }
  }

  const pendingInstitutes = memberships
    .filter((m) => m.status === 'pending' && m.instituteId)
    .map((m) => ({
      id: m._id,
      instituteId: m.instituteId._id,
      instituteName: m.instituteId.name,
      subdomain: m.instituteId.subdomain,
      logo: m.instituteId.logo,
      roleInInstitute: m.roleInInstitute,
      requestMessage: m.requestMessage || '',
      requestedBatch: m.requestedBatchId?.name || null,
      createdAt: m.createdAt,
    }));

  const rejectedInstitutes = memberships
    .filter((m) => m.status === 'rejected' && m.instituteId)
    .map((m) => ({
      id: m._id,
      instituteId: m.instituteId._id,
      instituteName: m.instituteId.name,
      subdomain: m.instituteId.subdomain,
      roleInInstitute: m.roleInInstitute,
      rejectionReason: m.rejectionReason || '',
      rejectedAt: m.rejectedAt || m.updatedAt,
    }));

  const activeTutors = tutorLinks
    .filter((l) => l.status === 'active' && l.tutorId && l.tutorUserId)
    .map((l) => ({
      linkId: l._id,
      tutorId: l.tutorId._id,
      tutorUserId: l.tutorUserId._id,
      name: l.tutorUserId.name,
      profileImage: l.tutorUserId.profileImage,
      title: l.tutorId.title || '',
      subjects: l.subjects?.length ? l.subjects : (l.tutorId.subjects || []),
      experience: l.tutorId.experience || 0,
      headline: l.tutorId.privateTeaching?.headline || '',
      approvedAt: l.approvedAt,
    }));

  const pendingTutors = tutorLinks
    .filter((l) => l.status === 'pending' && l.tutorId && l.tutorUserId)
    .map((l) => ({
      id: l._id,
      tutorId: l.tutorId._id,
      tutorName: l.tutorUserId.name,
      profileImage: l.tutorUserId.profileImage,
      subjects: l.subjects?.length ? l.subjects : (l.tutorId.subjects || []),
      requestMessage: l.requestMessage || '',
      createdAt: l.createdAt,
    }));

  const rejectedTutors = tutorLinks
    .filter((l) => l.status === 'rejected' && l.tutorId && l.tutorUserId)
    .map((l) => ({
      id: l._id,
      tutorId: l.tutorId._id,
      tutorName: l.tutorUserId.name,
      rejectionReason: l.rejectionReason || '',
      rejectedAt: l.rejectedAt || l.updatedAt,
    }));

  let privateTuition = null;
  if (user.role === 'student') {
    privateTuition = {
      enabled: activeTutors.length > 0,
      linkedTutors: activeTutors,
    };
  } else if (user.role === 'tutor') {
    privateTuition = {
      enabled: tutorProfile?.privateTeaching?.isEnabled !== false,
      tutorId: tutorProfile?._id || null,
      acceptSelfJoinRequests: tutorProfile?.privateTeaching?.acceptSelfJoinRequests !== false,
      headline: tutorProfile?.privateTeaching?.headline || '',
      city: tutorProfile?.privateTeaching?.city || '',
      planName: user.personalSubscription?.planName || 'free',
      maxPrivateStudents: user.personalSubscription?.features?.maxPrivateStudents ?? 15,
      maxPrivateCourses: user.personalSubscription?.features?.maxPrivateCourses ?? 3,
      payoutStatus: tutorProfile?.payoutAccount?.verificationStatus || 'not_configured',
    };
  }

  let hasActiveWorkspace = false;
  if (user.role === 'superadmin' || user.role === 'admin') {
    hasActiveWorkspace = true;
  } else if (user.role === 'tutor') {
    hasActiveWorkspace = instituteWorkspaces.length > 0 || Boolean(privateTuition?.enabled);
  } else {
    hasActiveWorkspace = instituteWorkspaces.length > 0 || activeTutors.length > 0;
  }

  let defaultWorkspace = null;
  if (instituteWorkspaces.length > 0) {
    const preferred = instituteWorkspaces.find((w) => w.isPrimary) || instituteWorkspaces[0];
    defaultWorkspace = { type: 'institute', instituteId: preferred.id, name: preferred.name };
  } else if (user.role === 'tutor' && privateTuition?.enabled) {
    defaultWorkspace = { type: 'private_tutor', tutorId: tutorProfile?._id || null, name: 'My Private Studio' };
  } else if (user.role === 'student' && activeTutors.length > 0) {
    defaultWorkspace = { type: 'private_tutor', tutorId: null, name: 'My Private Tutors' };
  }

  return {
    hasActiveWorkspace,
    defaultWorkspace,
    workspaces: {
      institutes: instituteWorkspaces,
      privateTuition,
    },
    pendingRequests: {
      institutes: pendingInstitutes,
      tutors: pendingTutors,
    },
    rejectedRequests: {
      institutes: rejectedInstitutes,
      tutors: rejectedTutors,
    },
  };
}

