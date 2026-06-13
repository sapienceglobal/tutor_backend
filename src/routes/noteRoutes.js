import express from 'express';
import { saveNote, getCourseNotes, deleteNote } from '../controllers/noteController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All note routes require authentication
router.use(protect);

router.post('/', saveNote);
router.get('/course/:courseId', getCourseNotes);
router.delete('/:id', deleteNote);

export default router;
