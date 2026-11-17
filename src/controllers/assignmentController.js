import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import { createNotification } from './notificationController.js';
import { featureFlags } from '../config/featureFlags.js';
import { getForUser as getEntitlementsForUser } from '../services/entitlementService.js';
import { evaluateAccess } from '../services/accessPolicy.js';
import { emitLearningEvent } from '../services/learningEventService.js';
import {
    AUDIENCE_SCOPES,
    normalizeAudienceInput,
    validateAudience,
} from '../utils/audience.js';

const getWorkspaceTenantFilter = (req) => {
    if (req.workspace?.type === 'private_tutor') return { instituteId: null };
    const instId = req.workspace?.instituteId || req.tenant?._id || null;
    return instId ? { instituteId: instId } : { instituteId: null };
};

const resolveAssignmentAudience = ({ body, instituteId, isPrivateWorkspace = false }) => {
    const fallbackScope = (body.batchId || (Array.isArray(body.batchIds) && body.batchIds.length > 0))
        ? AUDIENCE_SCOPES.BATCH
        : (isPrivateWorkspace || !instituteId ? AUDIENCE_SCOPES.TUTOR_NETWORK : AUDIENCE_SCOPES.INSTITUTE);

    const normalizedAudience = normalizeAudienceInput({
        audience: body.audience,
        scope: body.scope === 'global' || body.visibility === 'public' ? fallbackScope : body.scope,
        instituteId: isPrivateWorkspace ? null : (instituteId || body.instituteId || null),
        batchId: body.batchId || null,
        batchIds: body.batchIds || [],
        studentIds: body.studentIds || [],
    }, {
        defaultScope: fallbackScope,
        defaultInstituteId: isPrivateWorkspace ? null : (instituteId || body.instituteId || null),
    });

    if (normalizedAudience.scope === AUDIENCE_SCOPES.GLOBAL) {
        normalizedAudience.scope = fallbackScope;
    }
    if (isPrivateWorkspace || normalizedAudience.scope === AUDIENCE_SCOPES.TUTOR_NETWORK) {
        normalizedAudience.instituteId = null;
    }

    return validateAudience(normalizedAudience, {
        requireInstituteId: false,
        allowEmptyPrivate: false,
    });
};

// @desc    Create a new assignment
// @route   POST /api/assignments
// @access  Private (Tutor, Admin)
export const createAssignment = async (req, res) => {
    try {
        let { courseId, batchId, moduleId, title, description, dueDate, totalMarks, rubric, attachments, status } = req.body;
        const isPrivateWorkspace = req.workspace?.type === 'private_tutor' || !req.tenant;
        const instituteId = isPrivateWorkspace ? null : (req.workspace?.instituteId || req.tenant._id);

        // Next.js FormData sometimes stringifies arrays/objects
        if (typeof attachments === 'string') {
            try { attachments = JSON.parse(attachments); } catch (e) { attachments = []; }
        } else if (Array.isArray(attachments) && typeof attachments[0] === 'string' && attachments[0].startsWith('[')) {
            try { attachments = JSON.parse(attachments[0]); } catch (e) { attachments = []; }
        }

        if (typeof rubric === 'string') {
            try { rubric = JSON.parse(rubric); } catch (e) { rubric = []; }
        } else if (Array.isArray(rubric) && typeof rubric[0] === 'string' && rubric[0].startsWith('[')) {
            try { rubric = JSON.parse(rubric[0]); } catch (e) { rubric = []; }
        }

        // Verify course exists and belongs to tenant
        const course = await Course.findOne({ _id: courseId, instituteId });
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        let audience;
        try {
            audience = resolveAssignmentAudience({
                body: req.body,
                instituteId,
                isPrivateWorkspace: !course.instituteId,
            });
        } catch (audienceError) {
            return res.status(400).json({ success: false, message: audienceError.message });
        }

        const assignment = new Assignment({
            instituteId: course.instituteId || null,
            courseId,
            batchId: audience.scope === AUDIENCE_SCOPES.BATCH ? (audience.batchIds[0] || null) : null,
            moduleId,
            title,
            description,
            dueDate,
            totalMarks,
            rubric: rubric || [],
            attachments: attachments || [],
            status,
            audience,
        });

        await assignment.save();

        // Notify enrolled students
        try {
            const enrollmentQuery = { courseId, status: 'active' };
            if (audience.scope === AUDIENCE_SCOPES.BATCH) {
                enrollmentQuery.batchId = { $in: audience.batchIds };
            }
            if (audience.scope === AUDIENCE_SCOPES.PRIVATE) {
                enrollmentQuery.studentId = { $in: audience.studentIds };
            }
            const enrollments = await Enrollment.find(enrollmentQuery).select('studentId');
            if (enrollments.length > 0) {
                const notifications = enrollments.map(enr => ({
                    userId: enr.studentId,
                    type: 'assignment_created',
                    title: 'New Assignment Posted',
                    message: `A new assignment "${title}" has been added to your course.`,
                    data: { courseId, assignmentId: assignment._id }
                }));
                // Fire and forget
                Promise.all(notifications.map(n => createNotification(n))).catch(err => console.error("Notification trigger failed", err));
            }
        } catch (notifErr) {
            console.error('Error sending assignment creation notifications:', notifErr);
        }

        res.status(201).json({ success: true, assignment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get assignments for a course (Students only see published)
// @route   GET /api/assignments/course/:courseId
// @access  Private
export const getCourseAssignments = async (req, res) => {
    try {
        const { courseId } = req.params;
        const course = await Course.findById(courseId).select('instituteId tutorId').lean();
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const tenantFilter = getWorkspaceTenantFilter(req);
        if (course.instituteId && tenantFilter.instituteId === null && req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Switch to your Institute workspace to view these assignments.' });
        }
        if (!course.instituteId && req.workspace?.type === 'institute' && req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Switch to your Private Tutor workspace to view these assignments.' });
        }

        const query = { courseId, instituteId: course.instituteId || null };

        // If student, only show assignments for their specific batch OR course-wide assignments
        if (req.user.role === 'student') {
            const enrollment = await Enrollment.findOne({ studentId: req.user._id, courseId, status: 'active' });
            if (enrollment && enrollment.batchId) {
                query.$or = [
                    { batchId: enrollment.batchId },
                    { batchId: null }
                ];
            } else {
                query.batchId = null; // Only show course-wide if not in a specific batch
            }
            query.status = 'published';
        }

        let assignments = await Assignment.find(query).sort({ createdAt: -1 });

        if ((featureFlags.audienceEnforceV2 || featureFlags.audienceReadV2Shadow) && req.user.role === 'student') {
            const entitlements = await getEntitlementsForUser(req.user);
            if (featureFlags.audienceEnforceV2) {
                assignments = assignments.filter((assignment) => evaluateAccess({
                    resource: assignment,
                    entitlements,
                    requireEnrollment: true,
                    requirePayment: false,
                    isFree: true,
                    courseId,
                    legacyAllowed: true,
                    shadowContext: {
                        route: 'GET /api/assignments/course/:courseId',
                        resourceType: 'assignment',
                    },
                }).allowed);
            } else {
                assignments.forEach((assignment) => {
                    evaluateAccess({
                        resource: assignment,
                        entitlements,
                        requireEnrollment: true,
                        requirePayment: false,
                        isFree: true,
                        courseId,
                        legacyAllowed: true,
                        shadowContext: {
                            route: 'GET /api/assignments/course/:courseId',
                            resourceType: 'assignment',
                        },
                    });
                });
            }
        }

        // If student, attach their submission status
        if (req.user.role === 'student') {
            const submissions = await Submission.find({
                studentId: req.user._id,
                courseId
            }).lean();

            const submissionMap = {};
            submissions.forEach(sub => {
                submissionMap[sub.assignmentId.toString()] = sub;
            });

            const assignmentsWithStatus = assignments.map(a => {
                const doc = a.toObject();
                doc.mySubmission = submissionMap[a._id.toString()] || null;
                return doc;
            });
            return res.json({ success: true, assignments: assignmentsWithStatus });
        }

        res.json({ success: true, assignments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get single assignment details
// @route   GET /api/assignments/:id
// @access  Private
export const getAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findOne({
            _id: req.params.id,
            ...getWorkspaceTenantFilter(req),
        });

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        if (req.user.role === 'student' && assignment.status !== 'published') {
            return res.status(403).json({ success: false, message: 'Assignment is not published' });
        }

        if (featureFlags.audienceEnforceV2 && req.user.role === 'student') {
            const entitlements = await getEntitlementsForUser(req.user);
            const accessDecision = evaluateAccess({
                resource: assignment,
                entitlements,
                requireEnrollment: true,
                requirePayment: false,
                isFree: true,
                courseId: assignment.courseId,
            });
            if (!accessDecision.allowed) {
                return res.status(403).json({ success: false, message: 'Assignment is not available in your current audience scope' });
            }
        }

        let responseData = { success: true, assignment };

        if (req.user.role === 'student') {
            const submission = await Submission.findOne({
                assignmentId: assignment._id,
                studentId: req.user._id
            });
            responseData.mySubmission = submission;
        }

        res.json(responseData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update assignment
// @route   PATCH /api/assignments/:id
// @access  Private (Tutor, Admin)
export const updateAssignment = async (req, res) => {
    try {
        const tenantFilter = getWorkspaceTenantFilter(req);
        const assignment = await Assignment.findOne({
            _id: req.params.id,
            ...tenantFilter,
        });

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        if (
            req.body.audience !== undefined
            || req.body.scope !== undefined
            || req.body.batchId !== undefined
            || req.body.batchIds !== undefined
            || req.body.studentIds !== undefined
            || req.body.instituteId !== undefined
        ) {
            const isPrivateAssignment = !assignment.instituteId;
            let audience;
            try {
                audience = resolveAssignmentAudience({
                    body: req.body,
                    instituteId: assignment.instituteId || tenantFilter.instituteId,
                    isPrivateWorkspace: isPrivateAssignment,
                });
            } catch (audienceError) {
                return res.status(400).json({ success: false, message: audienceError.message });
            }

            assignment.audience = audience;
            assignment.instituteId = isPrivateAssignment
                ? null
                : (audience.instituteId || assignment.instituteId || tenantFilter.instituteId || null);
            assignment.batchId = audience.scope === AUDIENCE_SCOPES.BATCH
                ? (audience.batchIds[0] || null)
                : null;
        }

        const allowedUpdates = [
            'title', 'description', 'dueDate', 'totalMarks', 'rubric', 'attachments',
            'status', 'moduleId',
        ];
        allowedUpdates.forEach((field) => {
            if (req.body[field] !== undefined) {
                assignment[field] = req.body[field];
            }
        });

        await assignment.save();

        res.json({ success: true, assignment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Tutor, Admin)
export const deleteAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findOneAndDelete({
            _id: req.params.id,
            ...getWorkspaceTenantFilter(req),
        });

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        // Also delete all submissions
        await Submission.deleteMany({ assignmentId: assignment._id });

        res.json({ success: true, message: 'Assignment deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// --- SUBMISSIONS ---

// @desc    Submit an assignment
// @route   POST /api/assignments/:id/submit
// @access  Private (Student)
export const submitAssignment = async (req, res) => {
    try {
        const { content, attachments } = req.body;
        const assignmentId = req.params.id;
        const tenantFilter = getWorkspaceTenantFilter(req);
        const instituteId = tenantFilter.instituteId;
        const studentId = req.user._id;

        const assignment = await Assignment.findOne({
            _id: assignmentId,
            status: 'published',
            ...tenantFilter,
        });
        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found or not published' });
        }

        if (featureFlags.audienceEnforceV2) {
            const entitlements = await getEntitlementsForUser(req.user);
            const accessDecision = evaluateAccess({
                resource: assignment,
                entitlements,
                requireEnrollment: true,
                requirePayment: false,
                isFree: true,
                courseId: assignment.courseId,
            });
            if (!accessDecision.allowed) {
                return res.status(403).json({ success: false, message: 'Assignment is not available in your current audience scope' });
            }
        }

        // Check dueDate if strict (optional feature)
        // if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
        //     return res.status(400).json({ success: false, message: 'Past due date' });
        // }

        let submission = await Submission.findOne({ assignmentId, studentId });

        if (submission) {
            if (submission.status === 'graded') {
                return res.status(400).json({ success: false, message: 'Cannot update graded submission' });
            }
            // Update existing
            submission.content = content;
            submission.attachments = attachments;
            submission.submittedAt = Date.now();
            submission.status = 'submitted';
            await submission.save();
        } else {
            // Create new
            submission = new Submission({
                instituteId,
                assignmentId,
                studentId,
                courseId: assignment.courseId,
                content,
                attachments
            });
            await submission.save();
        }

        await emitLearningEvent('assignment_submitted', req.user, {
            instituteId: assignment.instituteId || req.tenant?._id || null,
            courseId: assignment.courseId,
            batchId: assignment.batchId || null,
            resourceId: assignment._id,
            resourceType: 'assignment',
            meta: {
                submissionId: submission._id,
                status: submission.status,
            },
        });

        res.json({ success: true, submission });
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Already submitted' });
        }
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get submissions for an assignment
// @route   GET /api/assignments/:id/submissions
// @access  Private (Tutor, Admin)
export const getAssignmentSubmissions = async (req, res) => {
    try {
        const submissions = await Submission.find({
            assignmentId: req.params.id,
            ...getWorkspaceTenantFilter(req),
        })
            .populate('studentId', 'name email avatar')
            .sort({ submittedAt: -1 });

        res.json({ success: true, submissions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Grade a submission
// @route   PATCH /api/assignments/submissions/:submissionId/grade
// @access  Private (Tutor, Admin)
export const gradeSubmission = async (req, res) => {
    try {
        const { grade, feedback, rubricScores } = req.body;

        const submission = await Submission.findOne({
            _id: req.params.submissionId,
            ...getWorkspaceTenantFilter(req),
        });

        if (!submission) {
            return res.status(404).json({ success: false, message: 'Submission not found' });
        }

        submission.status = 'graded';
        submission.grade = grade;
        submission.feedback = feedback;
        submission.rubricScores = rubricScores || [];
        submission.gradedAt = Date.now();
        submission.gradedBy = req.user._id;

        await submission.save();

        // Notify the student about the grade
        try {
            await createNotification({
                userId: submission.studentId,
                type: 'assignment_graded',
                title: 'Assignment Graded',
                message: `Your assignment has been graded. You scored ${grade} marks.`,
                data: { courseId: submission.courseId, assignmentId: submission.assignmentId }
            });
        } catch (notifErr) {
            console.error('Error sending grade notification:', notifErr);
        }

        res.json({ success: true, submission });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Student fetches their own submission for an assignment (with grade/feedback)
// @route   GET /api/assignments/:id/my-submission
// @access  Private (Student)
export const getMySubmission = async (req, res) => {
    try {
        const submission = await Submission.findOne({
            assignmentId: req.params.id,
            studentId: req.user._id,
        })
            .populate('gradedBy', 'name')
            .lean();

        if (!submission) {
            return res.status(404).json({ success: false, message: 'No submission found' });
        }

        const assignment = await Assignment.findById(req.params.id).lean();
        res.json({ success: true, submission, assignment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
