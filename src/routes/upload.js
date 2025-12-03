import express from 'express';
import { uploadImage, deleteImage, upload } from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.post('/image', protect, upload.single('file'), uploadImage);
router.delete('/image', protect, deleteImage);

export default router;