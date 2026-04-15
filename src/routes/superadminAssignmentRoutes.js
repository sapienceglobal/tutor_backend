import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { getGlobalAssignments } from '../controllers/superadminAssignmentController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('superadmin')); 

// Read-only route
router.get('/', getGlobalAssignments);

export default router;