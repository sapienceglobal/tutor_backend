import express from 'express';
import {
    getLessonComments,
    addLessonComment,
    deleteLessonComment,
    getTutorModerationComments,
    moderateLessonComment,
    replyToLessonComment,
} from '../controllers/lessonCommentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/moderation', protect, authorize('tutor', 'admin'), getTutorModerationComments);
router.patch('/moderation/:commentId', protect, authorize('tutor', 'admin'), moderateLessonComment);
router.post('/:commentId/reply', protect, authorize('tutor', 'admin'), replyToLessonComment);

router.get('/:lessonId', protect, getLessonComments);
router.post('/:lessonId', protect, addLessonComment);
router.delete('/:commentId', protect, deleteLessonComment);

export default router;
