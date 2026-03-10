/**
 * /api/settings routes
 * 
 * These are accessible to ALL authenticated users (student, tutor, admin, superadmin)
 * because ThemeContext needs to call /api/settings/global-theme on every page load.
 * 
 * Mount in app.js as:
 *   app.use('/api/settings', settingsRouter);
 * 
 * IMPORTANT: Mount this BEFORE any superadmin-restricted routes
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import { getGlobalTheme } from '../controllers/superadminSettingsController.js';

const router = express.Router();

// ── GET /api/settings/global-theme ───────────────────────────────────────────
// Any logged-in user (student/tutor/admin/superadmin) can read the global theme.
// ThemeContext calls this on every app load to resolve the correct theme.
router.get('/global-theme', protect, getGlobalTheme);

export default router;