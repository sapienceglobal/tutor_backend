import express from 'express';
import {
    captureLead,
    getLeads,
    updateLead,
    addLeadNote,
    getCounselors
} from '../controllers/crmController.js';
import {
    createCampaign,
    sendCampaign,
    getCampaigns,
    getCampaignById,
    updateLeadConversion,
} from '../controllers/campaignController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public endpoint for lead capture form
router.post('/leads', captureLead);

// Admin / Counselor endpoints
router.use(protect);
router.use(authorize('admin', 'superadmin'));

router.get('/leads', getLeads);
router.put('/leads/:id', updateLead);
router.post('/leads/:id/notes', addLeadNote);
router.patch('/leads/:id/conversion', updateLeadConversion);

router.get('/counselors', getCounselors);

// Campaign management
router.get('/campaigns', getCampaigns);
router.get('/campaigns/:id', getCampaignById);
router.post('/campaigns', createCampaign);
router.post('/campaigns/:id/send', sendCampaign);

export default router;
