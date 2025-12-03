import express from 'express';
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Protected routes (Admin only - can add admin middleware later)
router.post('/', protect, createCategory);
router.patch('/:id', protect, updateCategory);
router.delete('/:id', protect, deleteCategory);

export default router;