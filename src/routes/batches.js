import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    createBatch,
    getBatches,
    getMyBatches,
    getBatchById,
    updateBatchStudents,
    addBatchAnnouncement,
    getBatchAnalytics
} from '../controllers/batchController.js';

const router = express.Router();

router.use(protect);

// Student routes
router.get('/my', authorize('student'), getMyBatches);

// Admin / Tutor shared routes
router.post('/', authorize('admin', 'tutor'), createBatch);
router.get('/', authorize('admin', 'tutor'), getBatches);
router.get('/:id', getBatchById); // Reused for view by student/tutor/admin
router.put('/:id/students', authorize('admin', 'tutor'), updateBatchStudents);

// Batch announcements & analytics
router.post('/:id/announcements', authorize('admin', 'tutor'), addBatchAnnouncement);
router.get('/:id/analytics', authorize('admin', 'tutor'), getBatchAnalytics);

export default router;
