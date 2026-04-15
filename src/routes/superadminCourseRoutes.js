import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 

import { getAllCourses, updateCourseStatus } from '../controllers/superadminCourseController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('superadmin')); 

router.get('/', getAllCourses);


router.patch('/:id/status', updateCourseStatus);

export default router;