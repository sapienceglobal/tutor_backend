import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { getAuditLogs } from '../controllers/superadminAuditController.js';

const router = express.Router();

// Strict Superadmin Protection
router.use(protect);
router.use(authorize('superadmin')); 

// Read-only route for security logs
router.get('/logs', getAuditLogs);

export default router;