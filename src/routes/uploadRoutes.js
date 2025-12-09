import express from 'express';
import {
  upload,
  uploadSingle,
  uploadMultiple,
  deleteFile,
  getFileInfo,
} from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Upload routes (all protected)
router.post('/single', protect, upload.single('file'), uploadSingle);
router.post('/multiple', protect, upload.array('files', 10), uploadMultiple);
router.delete('/:publicId', protect, deleteFile);
router.get('/info/:publicId', protect, getFileInfo);

export default router;