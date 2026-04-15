import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { getGlobalBatches } from '../controllers/superadminBatchController.js';

const router = express.Router();

// Strict protection: Only superadmin can view all global batches
router.use(protect);
router.use(authorize('superadmin')); 

// Read-only route for global batches
router.get('/', getGlobalBatches);

export default router;
