import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 

import { getFinanceOverview, processPayout } from '../controllers/financeController.js';

const router = express.Router();

// 1. Authentication & Authorization
router.use(protect);
router.use(authorize('superadmin')); 



// 3. Routes
router.get('/overview', getFinanceOverview); // Not logged (GET)
router.post('/payouts/:instituteId', processPayout); // 🌟 Automatically Logged!

export default router;