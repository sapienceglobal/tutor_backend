import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { auditMiddleware } from '../middleware/auditMiddleware.js';
import { getGlobalPayouts, processPayout } from '../controllers/superadminPayoutController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('superadmin')); 

// Read-only dashboard route
router.get('/', getGlobalPayouts);

// Mutating route - Requires Audit logging
router.use(auditMiddleware); 
router.patch('/:id/process', processPayout);

export default router;