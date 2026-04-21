import express from 'express';
import { getPlans, createPlan, updatePlan, deletePlan } from '../controllers/subscriptionController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// 1. Sabse pehle token verify karo aur req.user set karo (Ye sabpe apply hoga)
router.use(protect); 


// 2. GET route sab logged-in users ke liye open hai (Tutors & Admins can see plans)
router.get('/', getPlans);

// 3. POST, PUT, DELETE par specifically superadmin ka tala (lock) laga diya
router.post('/', authorize('superadmin'), createPlan);
router.put('/:id', authorize('superadmin'), updatePlan);
router.delete('/:id', authorize('superadmin'), deletePlan);

export default router;