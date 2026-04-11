import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    createBatch,
    getBatches,
    getMyBatches,
    getAvailableBatches,
    joinBatch,
    getBatchById,
    updateBatch,
    updateBatchStudents,
    addBatchAnnouncement,
    getBatchAnalytics
} from '../controllers/batchController.js';

const router = express.Router();

router.use(protect);

// Student routes
router.get('/my', authorize('student'), getMyBatches);
router.get('/available', authorize('student'), getAvailableBatches);
router.post('/:id/join', authorize('student'), joinBatch);

// Admin / Tutor shared routes
router.post('/', authorize('admin', 'tutor'), createBatch);
router.get('/', authorize('admin', 'tutor'), getBatches);
router.get('/:id', getBatchById);
router.put('/:id', authorize('admin', 'tutor'), updateBatch);
router.put('/:id/students', authorize('admin', 'tutor'), updateBatchStudents);

// Batch announcements & analytics
router.post('/:id/announcements', authorize('admin', 'tutor'), addBatchAnnouncement);
router.get('/:id/analytics', authorize('admin', 'tutor'), getBatchAnalytics);

export default router;
