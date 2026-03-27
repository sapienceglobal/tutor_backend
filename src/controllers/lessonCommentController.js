import LessonComment from '../models/LessonComment.js';
import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';
import Tutor from '../models/Tutor.js';
import { createNotification } from './notificationController.js';

const STATUS_VALUES = ['visible', 'flagged', 'resolved', 'hidden'];

const normalizeComment = (comment, lessonMap) => {
    const lessonInfo = lessonMap?.get(comment.lessonId?.toString()) || null;
    return {
        _id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        moderationStatus: comment.moderationStatus || 'visible',
        isHidden: Boolean(comment.isHidden),
        hiddenReason: comment.hiddenReason || '',
        hiddenAt: comment.hiddenAt || null,
        student: comment.studentId
            ? {
                _id: comment.studentId._id || comment.studentId,
                name: comment.studentId.name || 'Student',
                email: comment.studentId.email || '',
                profileImage: comment.studentId.profileImage || null,
            }
            : null,
        lesson: lessonInfo
            ? {
                _id: lessonInfo._id,
                title: lessonInfo.title || 'Untitled Lesson',
                moduleId: lessonInfo.moduleId || null,
                courseId: lessonInfo.courseId || null,
                courseTitle: lessonInfo.courseTitle || '',
            }
            : {
                _id: comment.lessonId,
                title: 'Unknown Lesson',
                moduleId: null,
                courseId: null,
                courseTitle: '',
            },
        tutorReply: comment.tutorReply?.text
            ? {
                text: comment.tutorReply.text,
                repliedAt: comment.tutorReply.repliedAt || null,
                tutorUser: comment.tutorReply.tutorUserId
                    ? {
                        _id: comment.tutorReply.tutorUserId._id || comment.tutorReply.tutorUserId,
                        name: comment.tutorReply.tutorUserId.name || 'Tutor',
                        profileImage: comment.tutorReply.tutorUserId.profileImage || null,
                    }
                    : null,
            }
            : null,
    };
};

const resolveTutorAndLessonOwnership = async ({ userId, lessonId }) => {
    const tutor = await Tutor.findOne({ userId }).select('_id').lean();
    if (!tutor) return { ok: false, message: 'Tutor profile not found' };

    const lesson = await Lesson.findById(lessonId).select('_id courseId title moduleId').lean();
    if (!lesson) return { ok: false, message: 'Lesson not found' };

    const course = await Course.findById(lesson.courseId).select('_id title tutorId').lean();
    if (!course) return { ok: false, message: 'Course not found' };

    if (course.tutorId?.toString() !== tutor._id.toString()) {
        return { ok: false, message: 'Not authorized for this lesson' };
    }

    return { ok: true, tutor, lesson, course };
};

const canUserDeleteComment = async (req, comment) => {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return false;

    if (comment.studentId?.toString() === userId.toString()) return true;
    if (['admin', 'superadmin'].includes(req.user?.role)) return true;

    if (req.user?.role !== 'tutor') return false;
    const ownership = await resolveTutorAndLessonOwnership({ userId, lessonId: comment.lessonId });
    return ownership.ok;
};

// @desc    Get comments for a lesson
// @route   GET /api/comments/:lessonId
// @access  Private
export const getLessonComments = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const includeHidden = req.query.includeHidden === 'true';

        const filter = { lessonId };
        if (!includeHidden || !['tutor', 'admin', 'superadmin'].includes(req.user?.role)) {
            filter.isHidden = false;
        }

        const comments = await LessonComment.find(filter)
            .populate('studentId', 'name email profileImage avatar')
            .populate('tutorReply.tutorUserId', 'name profileImage')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, comments });
    } catch (error) {
        console.error('Get lesson comments error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Add a comment to a lesson
// @route   POST /api/comments/:lessonId
// @access  Private
export const addLessonComment = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const text = String(req.body?.text || '').trim();

        if (!text) {
            return res.status(400).json({ success: false, message: 'Comment text is required' });
        }

        const lesson = await Lesson.findById(lessonId).select('_id courseId');
        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        const newComment = new LessonComment({
            lessonId,
            studentId: req.user._id,
            text,
            moderationStatus: 'visible',
            isHidden: false,
        });

        await newComment.save();
        await newComment.populate('studentId', 'name email profileImage avatar');
        await newComment.populate('tutorReply.tutorUserId', 'name profileImage');

        res.status(201).json({ success: true, comment: newComment });
    } catch (error) {
        console.error('Add lesson comment error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:commentId
// @access  Private (Author or Tutor/Admin)
export const deleteLessonComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const comment = await LessonComment.findById(commentId);

        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }

        const allowed = await canUserDeleteComment(req, comment);
        if (!allowed) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        await comment.deleteOne();
        res.status(200).json({ success: true, message: 'Comment removed' });
    } catch (error) {
        console.error('Delete lesson comment error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get tutor discussion moderation comments
// @route   GET /api/comments/moderation
// @access  Private (Tutor)
export const getTutorModerationComments = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const tutor = await Tutor.findOne({ userId }).select('_id').lean();
        if (!tutor) {
            return res.status(403).json({ success: false, message: 'Only tutors can access this endpoint' });
        }

        const status = String(req.query.status || 'all').toLowerCase();
        const courseId = String(req.query.courseId || '').trim();
        const lessonId = String(req.query.lessonId || '').trim();
        const search = String(req.query.search || '').trim().toLowerCase();
        const limit = Math.min(300, Math.max(20, Number(req.query.limit || 200)));

        const courses = await Course.find({ tutorId: tutor._id })
            .select('_id title')
            .lean();
        const courseIds = courses.map((course) => course._id);

        if (courseIds.length === 0) {
            return res.status(200).json({
                success: true,
                summary: {
                    total: 0,
                    visible: 0,
                    flagged: 0,
                    resolved: 0,
                    hidden: 0,
                    withoutReply: 0,
                },
                courses: [],
                comments: [],
            });
        }

        const lessons = await Lesson.find({ courseId: { $in: courseIds } })
            .select('_id title courseId moduleId')
            .lean();
        const lessonIds = lessons.map((lesson) => lesson._id);
        const lessonIdsSet = new Set(lessonIds.map((id) => id.toString()));

        const courseMap = new Map(courses.map((course) => [course._id.toString(), course]));
        const lessonMap = new Map(lessons.map((lesson) => [
            lesson._id.toString(),
            {
                ...lesson,
                courseTitle: courseMap.get(lesson.courseId?.toString())?.title || '',
            },
        ]));

        const baseFilter = { lessonId: { $in: lessonIds } };
        const listFilter = { ...baseFilter };

        if (STATUS_VALUES.includes(status)) {
            listFilter.moderationStatus = status;
        }
        if (courseId) {
            const allowedLessonIds = lessons
                .filter((lesson) => lesson.courseId?.toString() === courseId)
                .map((lesson) => lesson._id);
            listFilter.lessonId = { $in: allowedLessonIds };
        }
        if (lessonId && lessonIdsSet.has(lessonId)) {
            listFilter.lessonId = lessonId;
        }

        let comments = await LessonComment.find(listFilter)
            .populate('studentId', 'name email profileImage')
            .populate('tutorReply.tutorUserId', 'name profileImage')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        if (search) {
            comments = comments.filter((comment) => {
                const student = comment.studentId || {};
                const lesson = lessonMap.get(comment.lessonId?.toString()) || {};
                const courseTitle = lesson.courseTitle || '';
                return (
                    String(comment.text || '').toLowerCase().includes(search)
                    || String(student.name || '').toLowerCase().includes(search)
                    || String(student.email || '').toLowerCase().includes(search)
                    || String(lesson.title || '').toLowerCase().includes(search)
                    || String(courseTitle).toLowerCase().includes(search)
                );
            });
        }

        const [visible, flagged, resolved, hidden, withoutReply] = await Promise.all([
            LessonComment.countDocuments({ ...baseFilter, moderationStatus: 'visible' }),
            LessonComment.countDocuments({ ...baseFilter, moderationStatus: 'flagged' }),
            LessonComment.countDocuments({ ...baseFilter, moderationStatus: 'resolved' }),
            LessonComment.countDocuments({ ...baseFilter, moderationStatus: 'hidden' }),
            LessonComment.countDocuments({ ...baseFilter, $or: [{ 'tutorReply.text': { $exists: false } }, { 'tutorReply.text': '' }] }),
        ]);

        return res.status(200).json({
            success: true,
            summary: {
                total: visible + flagged + resolved + hidden,
                visible,
                flagged,
                resolved,
                hidden,
                withoutReply,
            },
            courses: courses.map((course) => ({ _id: course._id, title: course.title })),
            comments: comments.map((comment) => normalizeComment(comment, lessonMap)),
        });
    } catch (error) {
        console.error('Get tutor moderation comments error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load discussion moderation data' });
    }
};

// @desc    Moderate comment status (hide, unhide, flag, resolve)
// @route   PATCH /api/comments/moderation/:commentId
// @access  Private (Tutor)
export const moderateLessonComment = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { commentId } = req.params;
        const action = String(req.body?.action || '').toLowerCase();
        const reason = String(req.body?.reason || '').trim();

        if (!['hide', 'unhide', 'flag', 'resolve', 'visible'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid moderation action' });
        }

        const comment = await LessonComment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }

        const ownership = await resolveTutorAndLessonOwnership({ userId, lessonId: comment.lessonId });
        if (!ownership.ok) {
            return res.status(403).json({ success: false, message: ownership.message });
        }

        if (action === 'hide') {
            comment.isHidden = true;
            comment.moderationStatus = 'hidden';
            comment.hiddenReason = reason || '';
            comment.hiddenBy = userId;
            comment.hiddenAt = new Date();
        } else if (action === 'unhide' || action === 'visible') {
            comment.isHidden = false;
            comment.moderationStatus = 'visible';
            comment.hiddenReason = '';
            comment.hiddenBy = null;
            comment.hiddenAt = null;
        } else if (action === 'flag') {
            comment.isHidden = false;
            comment.moderationStatus = 'flagged';
            comment.hiddenReason = reason || comment.hiddenReason || '';
            comment.hiddenBy = null;
            comment.hiddenAt = null;
        } else if (action === 'resolve') {
            comment.isHidden = false;
            comment.moderationStatus = 'resolved';
            comment.hiddenReason = '';
            comment.hiddenBy = null;
            comment.hiddenAt = null;
        }

        await comment.save();
        await comment.populate('studentId', 'name email profileImage');
        await comment.populate('tutorReply.tutorUserId', 'name profileImage');

        const lessonMap = new Map([[
            ownership.lesson._id.toString(),
            {
                ...ownership.lesson,
                courseTitle: ownership.course.title || '',
            },
        ]]);

        return res.status(200).json({
            success: true,
            comment: normalizeComment(comment.toObject ? comment.toObject() : comment, lessonMap),
        });
    } catch (error) {
        console.error('Moderate lesson comment error:', error);
        return res.status(500).json({ success: false, message: 'Failed to moderate comment' });
    }
};

// @desc    Reply to lesson comment as tutor
// @route   POST /api/comments/:commentId/reply
// @access  Private (Tutor)
export const replyToLessonComment = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { commentId } = req.params;
        const text = String(req.body?.text || '').trim();

        if (!text) {
            return res.status(400).json({ success: false, message: 'Reply text is required' });
        }

        const comment = await LessonComment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }

        const ownership = await resolveTutorAndLessonOwnership({ userId, lessonId: comment.lessonId });
        if (!ownership.ok) {
            return res.status(403).json({ success: false, message: ownership.message });
        }

        comment.tutorReply = {
            text,
            tutorUserId: userId,
            repliedAt: new Date(),
        };
        if (comment.moderationStatus !== 'hidden') {
            comment.moderationStatus = 'resolved';
        }
        await comment.save();
        await comment.populate('studentId', 'name email profileImage');
        await comment.populate('tutorReply.tutorUserId', 'name profileImage');

        await createNotification({
            userId: comment.studentId,
            type: 'tutor_reply',
            title: 'Tutor replied to your lesson discussion',
            message: text.length > 120 ? `${text.slice(0, 117)}...` : text,
            data: {
                courseId: ownership.course._id,
                lessonId: ownership.lesson._id,
                extras: {
                    commentId: comment._id,
                },
            },
        });

        const lessonMap = new Map([[
            ownership.lesson._id.toString(),
            {
                ...ownership.lesson,
                courseTitle: ownership.course.title || '',
            },
        ]]);

        return res.status(200).json({
            success: true,
            comment: normalizeComment(comment.toObject ? comment.toObject() : comment, lessonMap),
        });
    } catch (error) {
        console.error('Reply to lesson comment error:', error);
        return res.status(500).json({ success: false, message: 'Failed to post reply' });
    }
};
