import express from 'express';
import { uploadImage, uploadFile, deleteImage, deleteFile, upload } from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.post('/image', protect, upload.single('file'), uploadImage);
router.post('/file', protect, upload.single('file'), uploadFile);

router.delete('/image', protect, deleteImage);
router.delete('/file', protect, deleteFile);

export default router;