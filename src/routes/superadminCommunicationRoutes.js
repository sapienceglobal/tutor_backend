import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { getCommunicationData, sendGlobalAnnouncement, createCampaign } from '../controllers/superadminCommunicationController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('superadmin')); 

// Read data
router.get('/', getCommunicationData);
 
router.post('/announcement', sendGlobalAnnouncement);
router.post('/campaign', createCampaign);

export default router;