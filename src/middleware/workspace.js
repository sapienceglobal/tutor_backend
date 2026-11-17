import Institute from '../models/Institute.js';
import InstituteMembership from '../models/InstituteMembership.js';
import TutorStudentLink from '../models/TutorStudentLink.js';
import Tutor from '../models/Tutor.js';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const toId = (val) => (val ? String(val._id || val) : null);

/**
 * Attach closed-workspace context (`req.workspace`, `req.tenant`, `req.hasActiveWorkspace`)
 * to authenticated requests. Guarantees strict isolation between Institute workspaces and
 * Private Tuition workspaces so quotas, billing, and data never cross-contaminate.
 */
export async function attachWorkspaceContext(req) {
  if (!req.user) {
    req.workspace = { type: 'guest', instituteId: null, activeTutorIds: [], activeTutorUserIds: [] };
    req.tenant = null;
    req.hasActiveWorkspace = false;
    return { ok: true };
  }

  const rawType = (req.headers['x-workspace-type'] || req.query?.workspaceType || '').toString().trim().toLowerCase();
  const requestedInstituteId = (req.headers['x-institute-id'] || req.query?.instituteId || '').toString().trim() || null;
  const requestedTutorId = (req.headers['x-tutor-id'] || req.query?.tutorId || '').toString().trim() || null;

  if (req.user.role === 'superadmin') {
    let targetInst = null;
    if (requestedInstituteId) {
      targetInst = await Institute.findById(requestedInstituteId).lean();
    }
    req.tenant = targetInst || null;
    req.workspace = {
      type: 'superadmin',
      instituteId: targetInst?._id || null,
      activeTutorIds: [],
      activeTutorUserIds: [],
      filterTutorId: requestedTutorId,
    };
    req.hasActiveWorkspace = true;
    return { ok: true };
  }

  const userId = req.user._id || req.user.id;
  const [memberships, tutorLinks, tutorProfile] = await Promise.all([
    InstituteMembership.find({ userId, status: 'active' }).select('instituteId roleInInstitute').lean(),
    req.user.role === 'student'
      ? TutorStudentLink.find({ studentId: userId, status: 'active' }).select('tutorId tutorUserId').lean()
      : Promise.resolve([]),
    req.user.role === 'tutor'
      ? Tutor.findOne({ userId }).select('_id instituteId privateTeaching isVerified').lean()
      : Promise.resolve(null),
  ]);

  const activeInstituteIds = [...new Set(
    [
      ...memberships.map((m) => toId(m.instituteId)),
      toId(req.user.instituteId),
    ].filter(Boolean)
  )];

  const activeTutorIds = req.user.role === 'student'
    ? [...new Set(tutorLinks.map((l) => toId(l.tutorId)).filter(Boolean))]
    : (tutorProfile?._id ? [toId(tutorProfile._id)] : []);

  const activeTutorUserIds = req.user.role === 'student'
    ? [...new Set(tutorLinks.map((l) => toId(l.tutorUserId)).filter(Boolean))]
    : (req.user.role === 'tutor' ? [toId(userId)] : []);

  if (req.user.role === 'student') {
    req.hasActiveWorkspace = activeInstituteIds.length > 0 || activeTutorIds.length > 0;
  } else if (req.user.role === 'tutor') {
    req.hasActiveWorkspace = activeInstituteIds.length > 0 || tutorProfile?.privateTeaching?.isEnabled !== false;
  } else {
    req.hasActiveWorkspace = true;
  }

  // Decide active workspace type
  let resolvedType = rawType;
  if (!resolvedType) {
    if (requestedInstituteId || activeInstituteIds.length > 0) {
      resolvedType = 'institute';
    } else if (req.user.role === 'student' && activeTutorIds.length > 0) {
      resolvedType = 'private_tutor';
    } else if (req.user.role === 'tutor' && tutorProfile?.privateTeaching?.isEnabled !== false) {
      resolvedType = 'private_tutor';
    } else {
      resolvedType = 'none';
    }
  }

  // ── PRIVATE TUITION WORKSPACE (Strictly isolated from Institute tenant/billing) ──
  if (resolvedType === 'private_tutor') {
    if (req.user.role === 'admin') {
      return {
        ok: false,
        status: 403,
        payload: {
          success: false,
          code: 'WORKSPACE_NOT_ALLOWED',
          message: 'Institute admins cannot operate inside Private Tutor workspace.',
        },
      };
    }

    if (req.user.role === 'tutor' && tutorProfile?.privateTeaching?.isEnabled === false) {
      return {
        ok: false,
        status: 403,
        payload: {
          success: false,
          code: 'PRIVATE_STUDIO_DISABLED',
          message: 'Private Studio is disabled on your tutor profile.',
        },
      };
    }

    if (req.user.role === 'student' && requestedTutorId && !activeTutorIds.includes(requestedTutorId)) {
      return {
        ok: false,
        status: 403,
        payload: {
          success: false,
          code: 'TUTOR_NOT_LINKED',
          message: 'You do not have an approved connection with the selected tutor.',
        },
      };
    }

    // Critical Firewall: NEVER expose an Institute tenant inside private_tutor mode
    req.tenant = null;
    req.instituteSuspended = false;

    const filterTutorLink = requestedTutorId
      ? tutorLinks.find((l) => toId(l.tutorId) === requestedTutorId)
      : null;

    req.workspace = {
      type: 'private_tutor',
      instituteId: null,
      tutorId: req.user.role === 'tutor' ? toId(tutorProfile?._id) : null,
      tutorUserId: req.user.role === 'tutor' ? toId(userId) : toId(filterTutorLink?.tutorUserId),
      activeTutorIds,
      activeTutorUserIds,
      filterTutorId: requestedTutorId,
    };

    return { ok: true };
  }

  // ── INSTITUTE WORKSPACE ──────────────────────────────────────────────────────
  if (resolvedType === 'institute') {
    const targetInstituteId = requestedInstituteId || toId(req.user.instituteId) || activeInstituteIds[0] || null;

    if (!targetInstituteId || !activeInstituteIds.includes(targetInstituteId)) {
      return {
        ok: false,
        status: 403,
        payload: {
          success: false,
          code: 'INSTITUTE_MEMBERSHIP_REQUIRED',
          message: 'You do not have an active membership for this institute.',
        },
      };
    }

    const institute = await Institute.findById(targetInstituteId).lean();
    if (!institute) {
      return {
        ok: false,
        status: 403,
        payload: {
          success: false,
          message: 'Institute not found for this workspace.',
        },
      };
    }

    req.tenant = institute;
    const reqUrl = req.originalUrl || req.url || '';

    // Check Institute Subscription Expiry (in institute workspace only, for non-free plans)
    const isFreePlan = String(institute.subscriptionPlan || 'free').toLowerCase() === 'free';
    if (!isFreePlan && institute.subscriptionExpiresAt && new Date(institute.subscriptionExpiresAt) < new Date()) {
      const allowedExpiredPaths = ['/api/auth/me', '/api/auth/sessions', '/api/payments', '/api/membership', '/api/tutor-links'];
      const isAllowed = READ_ONLY_METHODS.has(req.method) || allowedExpiredPaths.some((p) => reqUrl.startsWith(p));
      if (!isAllowed) {
        return {
          ok: false,
          status: 403,
          payload: {
            success: false,
            subscriptionExpired: true,
            message: 'Institute subscription has expired. Renewal is required to continue.',
          },
        };
      }
    }

    // Check Institute Suspension (in institute workspace only)
    if (institute.isActive === false) {
      req.instituteSuspended = true;
      const suspendedAllowedPaths = ['/api/auth/me', '/api/auth/logout', '/api/membership', '/api/tutor-links'];
      const isSuspendedAllowed = suspendedAllowedPaths.some((p) => reqUrl.startsWith(p));

      if (req.user.role === 'admin' || req.user.role === 'tutor') {
        if (!isSuspendedAllowed) {
          return {
            ok: false,
            status: 403,
            payload: {
              success: false,
              instituteSuspended: true,
              message: 'Institute has been suspended by the administrator. Contact support for assistance.',
            },
          };
        }
      }

      if (req.user.role === 'student') {
        const studentAllowedPaths = [
          ...suspendedAllowedPaths,
          '/api/courses', '/api/lessons', '/api/progress', '/api/auth/sessions',
        ];
        const isStudentAllowed = READ_ONLY_METHODS.has(req.method) && studentAllowedPaths.some((p) => reqUrl.startsWith(p));
        if (!isStudentAllowed) {
          return {
            ok: false,
            status: 403,
            payload: {
              success: false,
              instituteSuspended: true,
              message: 'Institute has been suspended. Access is restricted to viewing enrolled courses.',
            },
          };
        }
      }
    }

    req.workspace = {
      type: 'institute',
      instituteId: institute._id,
      membershipInstituteIds: activeInstituteIds,
      activeTutorIds: [],
      activeTutorUserIds: [],
      filterTutorId: null,
    };

    return { ok: true };
  }

  // ── PENDING / NO APPROVED WORKSPACE YET ─────────────────────────────────────
  req.tenant = null;
  req.workspace = {
    type: 'none',
    instituteId: null,
    activeTutorIds: [],
    activeTutorUserIds: [],
    filterTutorId: null,
  };
  return { ok: true };
}

/**
 * Route-level middleware that explicitly enforces active workspace resolution.
 */
export const resolveWorkspace = async (req, res, next) => {
  try {
    const result = await attachWorkspaceContext(req);
    if (!result.ok) {
      return res.status(result.status || 403).json(result.payload);
    }
    return next();
  } catch (error) {
    console.error('resolveWorkspace error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resolve workspace context' });
  }
};

/**
 * Guards portal routes until a student or user has at least 1 approved Institute or Private Tutor.
 */
export const requireActiveWorkspace = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  if (req.user.role === 'superadmin' || req.hasActiveWorkspace) {
    return next();
  }
  return res.status(403).json({
    success: false,
    code: 'PORTAL_APPROVAL_REQUIRED',
    portalApprovalRequired: true,
    message: 'Your join request is awaiting approval from an Institute or Private Tutor.',
  });
};

