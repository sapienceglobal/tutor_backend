import express from 'express';
import { getFacilities, createFacility, updateFacility, deleteFacility } from '../controllers/facilityController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getFacilities);
router.post('/', protect, admin, createFacility);
router.put('/:id', protect, admin, updateFacility);
router.delete('/:id', protect, admin, deleteFacility);

export default router;
