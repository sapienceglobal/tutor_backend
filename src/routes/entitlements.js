import express from 'express';
import { protect } from '../middleware/auth.js';
import { getMyEntitlements } from '../controllers/entitlementController.js';

const router = express.Router();

router.use(protect);
router.get('/me', getMyEntitlements);

export default router;
