import mongoose from 'mongoose';
import Institute from '../models/Institute.js';
import InstituteMembership from '../models/InstituteMembership.js';
import Tutor from '../models/Tutor.js';
import TutorStudentLink from '../models/TutorStudentLink.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import {
  sendEmail,
  getJoinRequestSubmittedEmailTemplate,
  getNewJoinRequestForOwnerEmailTemplate,
  getJoinRequestApprovedEmailTemplate,
  getJoinRequestRejectedEmailTemplate,
} from '../utils/emailService.js';

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

export function getDefaultPermissions(role) {
  const permissions = {
    student: {
      canCreateCourses: false,
      canCreateExams: false,
      canViewAnalytics: false,
      canManageStudents: false,
    },
    tutor: {
      canCreateCourses: true,
      canCreateExams: true,
      canViewAnalytics: true,
      canManageStudents: false,
    },
    admin: {
      canCreateCourses: true,
      canCreateExams: true,
      canViewAnalytics: true,
      canManageStudents: true,
    },
  };
  return permissions[role] || permissions.student;
}

export function normalizeIdList(input, limit = 20) {
  if (!input) return [];
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',').map((s) => s.trim())
      : [input];
  const valid = raw
    .map((id) => String(id || '').trim())
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id));
  return [...new Set(valid)].slice(0, limit);
}

export function parseSubjectsList(input) {
  if (!input) return [];
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];
  return [...new Set(raw.map((s) => String(s || '').trim()).filter(Boolean))].slice(0, 20);
}

const safeDispatchEmail = async (options) => {
  try {
    if (!options?.to) return;
    await sendEmail(options);
  } catch (err) {
    console.warn('Admission email dispatch warning:', err?.message || err);
  }
};

const safeCreateNotification = async (payload) => {
  try {
    if (!payload?.userId) return;
    await Notification.create(payload);
  } catch (err) {
    console.warn('Admission notification creation warning:', err?.message || err);
  }
};

export async function dispatchInstituteRequestAlerts({ membership, institute, applicantUser, roleInInstitute = 'student' }) {
  if (!institute || !applicantUser) return;

  const admins = await User.find({
    instituteId: institute._id,
    role: 'admin',
    isActive: { $ne: false },
  }).select('_id name email').lean();

  const tasks = [
    safeCreateNotification({
      userId: applicantUser._id,
      type: 'join_request_submitted',
      title: 'Join Request Sent',
      message: `Your request to join ${institute.name} as a ${roleInInstitute} is awaiting approval.`,
      data: {
        instituteId: institute._id,
        membershipId: membership?._id,
      },
    }),
    safeDispatchEmail({
      to: applicantUser.email,
      subject: `Join Request Submitted — ${institute.name}`,
      html: getJoinRequestSubmittedEmailTemplate(applicantUser.name, institute.name, 'institute', roleInInstitute),
    }),
  ];

  const notifiedEmails = new Set();
  for (const admin of admins) {
    tasks.push(
      safeCreateNotification({
        userId: admin._id,
        type: 'join_request_received',
        title: `New ${roleInInstitute === 'tutor' ? 'Tutor' : 'Student'} Join Request`,
        message: `${applicantUser.name} requested to join ${institute.name}.`,
        data: {
          instituteId: institute._id,
          membershipId: membership?._id,
          extras: { applicantEmail: applicantUser.email, roleInInstitute },
        },
      })
    );
    if (admin.email && !notifiedEmails.has(admin.email.toLowerCase())) {
      notifiedEmails.add(admin.email.toLowerCase());
      tasks.push(
        safeDispatchEmail({
          to: admin.email,
          subject: `New ${roleInInstitute === 'tutor' ? 'Tutor' : 'Student'} Join Request — ${institute.name}`,
          html: getNewJoinRequestForOwnerEmailTemplate(
            admin.name,
            applicantUser.name,
            applicantUser.email,
            institute.name,
            'institute',
            roleInInstitute,
            `${APP_BASE_URL}/admin/admissions`
          ),
        })
      );
    }
  }

  if (institute.contactEmail && !notifiedEmails.has(institute.contactEmail.toLowerCase())) {
    tasks.push(
      safeDispatchEmail({
        to: institute.contactEmail,
        subject: `New ${roleInInstitute === 'tutor' ? 'Tutor' : 'Student'} Join Request — ${institute.name}`,
        html: getNewJoinRequestForOwnerEmailTemplate(
          `${institute.name} Admin`,
          applicantUser.name,
          applicantUser.email,
          institute.name,
          'institute',
          roleInInstitute,
          `${APP_BASE_URL}/admin/admissions`
        ),
      })
    );
  }

  await Promise.allSettled(tasks);
}

export async function dispatchInstituteDecisionAlerts({ membership, institute, memberUser, decision, reason = '' }) {
  if (!institute || !memberUser) return;
  const roleLabel = membership?.roleInInstitute || memberUser.role || 'student';
  const approved = decision === 'approved';

  const tasks = [
    safeCreateNotification({
      userId: memberUser._id,
      type: approved ? 'join_request_approved' : 'join_request_rejected',
      title: approved ? `Approved for ${institute.name}` : `Request Update — ${institute.name}`,
      message: approved
        ? `You now have access to ${institute.name} as a ${roleLabel}. Switch anytime from your Workspace Switcher.`
        : reason
          ? `Your request to join ${institute.name} was not approved: ${reason}`
          : `Your request to join ${institute.name} was not approved.`,
      data: {
        instituteId: institute._id,
        membershipId: membership?._id,
      },
    }),
    safeDispatchEmail({
      to: memberUser.email,
      subject: approved
        ? `Welcome to ${institute.name} — Request Approved`
        : `Join Request Update — ${institute.name}`,
      html: approved
        ? getJoinRequestApprovedEmailTemplate(
            memberUser.name,
            institute.name,
            'institute',
            roleLabel,
            `${APP_BASE_URL}/${roleLabel === 'tutor' ? 'tutor' : 'student'}/dashboard`
          )
        : getJoinRequestRejectedEmailTemplate(memberUser.name, institute.name, 'institute', reason),
    }),
  ];

  await Promise.allSettled(tasks);
}

export async function dispatchTutorLinkRequestAlerts({ link, tutorDoc, tutorUser, studentUser }) {
  if (!tutorDoc || !studentUser) return;
  const tutorDisplayName = tutorUser?.name || tutorDoc.title || 'Private Tutor';

  const tasks = [
    safeCreateNotification({
      userId: studentUser._id,
      type: 'join_request_submitted',
      title: 'Private Tutor Request Sent',
      message: `Your request to connect with ${tutorDisplayName} is awaiting approval.`,
      data: {
        tutorId: tutorDoc._id,
        linkId: link?._id,
      },
    }),
    safeDispatchEmail({
      to: studentUser.email,
      subject: `Private Tutor Request Sent — ${tutorDisplayName}`,
      html: getJoinRequestSubmittedEmailTemplate(studentUser.name, tutorDisplayName, 'tutor', 'student'),
    }),
  ];

  if (tutorUser?._id) {
    tasks.push(
      safeCreateNotification({
        userId: tutorUser._id,
        type: 'tutor_link_requested',
        title: 'New Private Student Request',
        message: `${studentUser.name} wants to connect to your Private Tuition classroom.`,
        data: {
          tutorId: tutorDoc._id,
          linkId: link?._id,
          extras: { studentEmail: studentUser.email },
        },
      })
    );
  }

  if (tutorUser?.email) {
    tasks.push(
      safeDispatchEmail({
        to: tutorUser.email,
        subject: `New Private Student Request from ${studentUser.name}`,
        html: getNewJoinRequestForOwnerEmailTemplate(
          tutorDisplayName,
          studentUser.name,
          studentUser.email,
          `${tutorDisplayName}'s Classroom`,
          'tutor',
          'student',
          `${APP_BASE_URL}/tutor/private-students`
        ),
      })
    );
  }

  await Promise.allSettled(tasks);
}

export async function dispatchTutorLinkDecisionAlerts({ link, tutorDoc, tutorUser, studentUser, decision, reason = '' }) {
  if (!studentUser) return;
  const tutorDisplayName = tutorUser?.name || tutorDoc?.title || 'Private Tutor';
  const approved = decision === 'approved';

  const tasks = [
    safeCreateNotification({
      userId: studentUser._id,
      type: approved ? 'tutor_link_approved' : 'tutor_link_rejected',
      title: approved ? `Connected with ${tutorDisplayName}` : `Request Update — ${tutorDisplayName}`,
      message: approved
        ? `${tutorDisplayName} approved your private tuition request! Access their classroom in your Workspace Switcher.`
        : reason
          ? `Your private tuition request with ${tutorDisplayName} was declined: ${reason}`
          : `Your private tuition request with ${tutorDisplayName} was declined.`,
      data: {
        tutorId: tutorDoc?._id,
        linkId: link?._id,
      },
    }),
    safeDispatchEmail({
      to: studentUser.email,
      subject: approved
        ? `Approved! You are now connected with ${tutorDisplayName}`
        : `Private Tuition Request Update — ${tutorDisplayName}`,
      html: approved
        ? getJoinRequestApprovedEmailTemplate(
            studentUser.name,
            tutorDisplayName,
            'tutor',
            'student',
            `${APP_BASE_URL}/student/dashboard`
          )
        : getJoinRequestRejectedEmailTemplate(studentUser.name, tutorDisplayName, 'tutor', reason),
    }),
  ];

  await Promise.allSettled(tasks);
}

/**
 * Creates pending InstituteMembership and/or TutorStudentLink records during signup/onboarding.
 * Supports multi-tutor requests cleanly inside or outside a MongoDB session.
 */
export async function createPendingJoinRecords({
  user,
  role,
  instituteId = null,
  tutorIds = [],
  requestedBatchId = null,
  requestMessage = '',
  subjects = [],
  joinedVia = 'self_request',
  session = null,
}) {
  const createdMemberships = [];
  const createdLinks = [];
  const institutesById = new Map();
  const tutorsById = new Map();
  const cleanMessage = String(requestMessage || '').trim().slice(0, 500);
  const parsedSubjects = parseSubjectsList(subjects);

  if (instituteId && mongoose.Types.ObjectId.isValid(String(instituteId))) {
    const instQuery = Institute.findOne({ _id: instituteId, isActive: true });
    if (session) instQuery.session(session);
    const institute = await instQuery;

    if (institute) {
      const canSelfRequest = role === 'tutor'
        ? institute.discovery?.acceptTutorRequests !== false
        : institute.discovery?.acceptSelfJoinRequests !== false;

      if (canSelfRequest) {
        const existingMemQuery = InstituteMembership.findOne({
          userId: user._id,
          instituteId: institute._id,
        });
        if (session) existingMemQuery.session(session);
        const existingMem = await existingMemQuery;

        if (!existingMem) {
          const validBatchId = requestedBatchId && mongoose.Types.ObjectId.isValid(String(requestedBatchId))
            ? requestedBatchId
            : null;
          const memPayload = {
            userId: user._id,
            instituteId: institute._id,
            roleInInstitute: role,
            status: 'pending',
            joinedVia,
            requestedBatchId: validBatchId,
            requestMessage: cleanMessage,
            permissions: getDefaultPermissions(role),
          };
          const createdMem = session
            ? (await InstituteMembership.create([memPayload], { session }))[0]
            : await InstituteMembership.create(memPayload);
          createdMemberships.push(createdMem);
          institutesById.set(String(institute._id), institute);
        }
      }
    }
  }

  const normalizedTutorIds = role === 'student' ? normalizeIdList(tutorIds) : [];
  if (normalizedTutorIds.length > 0) {
    const tutorsQuery = Tutor.find({
      _id: { $in: normalizedTutorIds },
      'privateTeaching.isEnabled': { $ne: false },
      'privateTeaching.acceptSelfJoinRequests': { $ne: false },
    }).populate('userId', 'name email profileImage');
    if (session) tutorsQuery.session(session);
    const tutors = await tutorsQuery;

    for (const tutorDoc of tutors) {
      const tutorUserId = tutorDoc.userId?._id || tutorDoc.userId;
      if (!tutorUserId || String(tutorUserId) === String(user._id)) continue;

      const existingLinkQuery = TutorStudentLink.findOne({
        tutorId: tutorDoc._id,
        studentId: user._id,
      });
      if (session) existingLinkQuery.session(session);
      const existingLink = await existingLinkQuery;

      if (!existingLink) {
        const linkPayload = {
          tutorId: tutorDoc._id,
          tutorUserId,
          studentId: user._id,
          status: 'pending',
          initiatedBy: 'student',
          requestMessage: cleanMessage,
          subjects: parsedSubjects.length > 0 ? parsedSubjects : (tutorDoc.subjects || []).slice(0, 5),
        };
        const createdLink = session
          ? (await TutorStudentLink.create([linkPayload], { session }))[0]
          : await TutorStudentLink.create(linkPayload);
        createdLinks.push(createdLink);
        tutorsById.set(String(tutorDoc._id), tutorDoc);
      }
    }
  }

  return { createdMemberships, createdLinks, institutesById, tutorsById };
}

export async function notifyPendingJoinRecords({ user, createdMemberships = [], createdLinks = [], institutesById = new Map(), tutorsById = new Map() }) {
  const tasks = [];

  for (const membership of createdMemberships) {
    const institute = institutesById.get(String(membership.instituteId));
    if (institute) {
      tasks.push(
        dispatchInstituteRequestAlerts({
          membership,
          institute,
          applicantUser: user,
          roleInInstitute: membership.roleInInstitute,
        })
      );
    }
  }

  for (const link of createdLinks) {
    const tutorDoc = tutorsById.get(String(link.tutorId));
    if (tutorDoc) {
      tasks.push(
        dispatchTutorLinkRequestAlerts({
          link,
          tutorDoc,
          tutorUser: tutorDoc.userId,
          studentUser: user,
        })
      );
    }
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

