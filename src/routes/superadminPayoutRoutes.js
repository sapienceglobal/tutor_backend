import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { auditMiddleware } from '../middleware/auditMiddleware.js';
import {
    getGlobalPayouts,
    processPayout,
    getTutorPayoutAccounts,
    verifyTutorPayoutAccount,
} from '../controllers/superadminPayoutController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('superadmin')); 

// Read-only dashboard routes
router.get('/', getGlobalPayouts);
router.get('/accounts', getTutorPayoutAccounts);

// Mutating routes - Requires Audit logging
router.use(auditMiddleware); 
router.patch('/:id/process', processPayout);
router.patch('/accounts/:tutorId/verify', verifyTutorPayoutAccount);

export default router;