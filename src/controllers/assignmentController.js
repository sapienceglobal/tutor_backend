import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';

// @desc    Create a new assignment
// @route   POST /api/assignments
// @access  Private (Tutor, Admin)
export const createAssignment = async (req, res) => {
    try {
        const { courseId, moduleId, title, description, dueDate, totalMarks, rubric, attachments, status } = req.body;
        const instituteId = req.tenant.instituteId;

        // Verify course exists and belongs to tenant
        const course = await Course.findOne({ _id: courseId, instituteId });
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const assignment = new Assignment({
            instituteId,
            courseId,
            moduleId,
            title,
            description,
            dueDate,
            totalMarks,
            rubric: rubric || [],
            attachments: attachments || [],
            status
        });

        await assignment.save();
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
        const instituteId = req.tenant.instituteId;

        // Check enrollment if student
        if (req.user.role === 'student') {
            const isEnrolled = await Enrollment.findOne({ studentId: req.user._id, courseId, status: 'active' });
            if (!isEnrolled) {
                return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
            }
        }

        const query = { courseId, instituteId };

        // Students only see published assignments
        if (req.user.role === 'student') {
            query.status = 'published';
        }

        const assignments = await Assignment.find(query).sort({ createdAt: -1 });

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
            instituteId: req.tenant.instituteId
        });

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        if (req.user.role === 'student' && assignment.status !== 'published') {
            return res.status(403).json({ success: false, message: 'Assignment is not published' });
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
        const assignment = await Assignment.findOneAndUpdate(
            { _id: req.params.id, instituteId: req.tenant.instituteId },
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

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
            instituteId: req.tenant.instituteId
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
        const instituteId = req.tenant.instituteId;
        const studentId = req.user._id;

        const assignment = await Assignment.findOne({ _id: assignmentId, instituteId, status: 'published' });
        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found or not published' });
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
            instituteId: req.tenant.instituteId
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
            instituteId: req.tenant.instituteId
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

        res.json({ success: true, submission });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
