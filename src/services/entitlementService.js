import User from '../models/User.js';
import Tutor from '../models/Tutor.js';
import Course from '../models/Course.js';
import Batch from '../models/Batch.js';
import Enrollment from '../models/Enrollment.js';
import Payment from '../models/Payment.js';
import InstituteMembership from '../models/InstituteMembership.js';
import TutorStudentLink from '../models/TutorStudentLink.js';
import { normalizeIdArray, toStringId } from '../utils/audience.js';

const uniq = (values = []) => [...new Set(values.filter(Boolean))];

const normalizeMembership = (membership) => ({
    id: toStringId(membership._id),
    instituteId: toStringId(membership.instituteId?._id || membership.instituteId),
    instituteName: membership.instituteId?.name || null,
    roleInInstitute: membership.roleInInstitute,
    status: membership.status,
});

export const getForUser = async (userOrId, activeInstituteId = null) => {
    const user = typeof userOrId === 'object'
        ? userOrId
        : await User.findById(userOrId).select('_id role instituteId');

    if (!user) {
        return null;
    }

    const userId = toStringId(user._id);

    const memberships = await InstituteMembership.find({
        userId: user._id,
        status: 'active',
    }).populate('instituteId', 'name subdomain logo');

    const normalizedMemberships = memberships.map(normalizeMembership);
    const directInstituteId = toStringId(user.instituteId);

    const enrollments = await Enrollment.find({
        studentId: user._id,
        status: { $in: ['active', 'completed'] },
    })
        .populate('courseId', '_id instituteId')
        .select('courseId batchId');

    const enrolledCourseIds = uniq(enrollments.map((enrollment) => toStringId(enrollment.courseId?._id || enrollment.courseId)));
    const enrollmentInstituteIds = uniq(enrollments.map((enrollment) => toStringId(enrollment.courseId?.instituteId)));

    const studentBatches = user.role === 'student'
        ? await Batch.find({ students: user._id }).select('_id instituteId courseId')
        : [];

    const batchIds = uniq([
        ...enrollments.map((enrollment) => toStringId(enrollment.batchId)),
        ...studentBatches.map((batch) => toStringId(batch._id)),
    ]);
    const batchInstituteIds = uniq(studentBatches.map((batch) => toStringId(batch.instituteId)));

    const membershipInstituteIds = uniq([
        ...normalizedMemberships.map((membership) => membership.instituteId),
        directInstituteId,
        ...enrollmentInstituteIds,
        ...batchInstituteIds,
    ]);

    const paidPayments = await Payment.find({
        studentId: user._id,
        status: 'paid',
        courseId: { $ne: null },
    }).select('courseId');

    const paidCourseIds = uniq([
        ...enrolledCourseIds,
        ...paidPayments.map((payment) => toStringId(payment.courseId)),
    ]);

    const tutorLinks = user.role === 'student'
        ? await TutorStudentLink.find({ studentId: user._id, status: 'active' }).select('tutorId tutorUserId')
        : [];
    const linkedTutorIds = uniq(tutorLinks.map((link) => toStringId(link.tutorId)));
    const linkedTutorUserIds = uniq(tutorLinks.map((link) => toStringId(link.tutorUserId)));

    const tutorProfile = await Tutor.findOne({ userId: user._id }).select('_id instituteId');
    let tutorCourseIds = [];
    if (tutorProfile) {
        const tutorCourses = await Course.find({ tutorId: tutorProfile._id }).select('_id');
        tutorCourseIds = tutorCourses.map((course) => toStringId(course._id));
    }

    const activeTutorIds = tutorProfile?._id
        ? uniq([toStringId(tutorProfile._id), ...linkedTutorIds])
        : linkedTutorIds;
    const activeTutorUserIds = user.role === 'tutor'
        ? uniq([userId, ...linkedTutorUserIds])
        : linkedTutorUserIds;

    const resolvedActiveInstituteId = toStringId(
        activeInstituteId
        || user.instituteId
        || enrollmentInstituteIds[0]
        || membershipInstituteIds[0]
        || null
    );

    const allowedScopes = ['private'];
    if (membershipInstituteIds.length > 0 || resolvedActiveInstituteId) {
        allowedScopes.push('institute', 'batch');
    }
    if (activeTutorIds.length > 0 || tutorProfile) {
        allowedScopes.push('tutor_network');
    }

    return {
        userId,
        role: user.role,
        activeInstituteId: resolvedActiveInstituteId,
        memberships: normalizedMemberships,
        membershipInstituteIds,
        enrolledCourseIds,
        batchIds,
        paidCourseIds,
        tutorId: toStringId(tutorProfile?._id),
        tutorCourseIds: uniq(tutorCourseIds),
        activeTutorIds,
        activeTutorUserIds,
        allowedScopes: uniq(allowedScopes),
    };
};

export const hasCourseEnrollment = (entitlements, courseId) => {
    const normalizedCourseId = toStringId(courseId);
    return normalizeIdArray(entitlements?.enrolledCourseIds).includes(normalizedCourseId);
};

export const hasPaidCourseAccess = (entitlements, courseId) => {
    const normalizedCourseId = toStringId(courseId);
    return normalizeIdArray(entitlements?.paidCourseIds).includes(normalizedCourseId);
};
