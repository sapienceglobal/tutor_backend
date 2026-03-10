import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    getGlobalSettings,
    updateGlobalSettings,
    getGlobalTheme,
} from '../controllers/superadminSettingsController.js';

const router = express.Router();

// ── Public-ish: any logged-in user can read global theme ─────────────────────
// Students, tutors, admins all need this to resolve their theme
// No role restriction — just needs valid JWT token
router.get('/global-theme', protect, getGlobalTheme);

// ── SuperAdmin-only routes ────────────────────────────────────────────────────
router.use(protect);
router.use(authorize('superadmin'));

router.get('/settings', getGlobalSettings);
router.put('/settings', updateGlobalSettings);

export default router;