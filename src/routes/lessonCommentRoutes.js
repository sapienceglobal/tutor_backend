import express from 'express';
import {
    getLessonComments,
    addLessonComment,
    deleteLessonComment
} from '../controllers/lessonCommentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/:lessonId', protect, getLessonComments);
router.post('/:lessonId', protect, addLessonComment);
router.delete('/:commentId', protect, deleteLessonComment);

export default router;
