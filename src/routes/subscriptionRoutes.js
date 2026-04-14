import express from 'express';
import { getPlans, createPlan, updatePlan, deletePlan } from '../controllers/subscriptionController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// 1. Sabse pehle token verify karo aur req.user set karo
router.use(protect); 

// 2. Phir check karo ki user superadmin hai ya nahi
router.use(authorize('superadmin')); 

// Ab in routes me baar-baar protect/authorize likhne ki zaroorat nahi
router.get('/', getPlans);
router.post('/', createPlan);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);

export default router;