import express from 'express';
import { getCurrentInstitute, updateInstituteBranding, updateInstitutePlan } from '../controllers/instituteController.js';
import { protect, authorize } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';

const router = express.Router();

router.use(protect);
router.use(resolveTenant);

router.get('/me', authorize('admin'), getCurrentInstitute);
router.put('/me', authorize('admin'), updateInstituteBranding);
router.put('/plan', authorize('admin'), updateInstitutePlan);

export default router;
