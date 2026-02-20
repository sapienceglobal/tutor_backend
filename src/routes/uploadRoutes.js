import express from 'express';
import upload from '../utils/cloudinary.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/upload/image
// @desc    Upload an image
// @access  Private
router.post('/image', protect, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  res.json({
    success: true,
    imageUrl: req.file.path,
    cloudinaryId: req.file.filename,
  });
});

// @route   POST /api/upload/file
// @desc    Upload a document/file
// @access  Private
import { fileUpload } from '../utils/cloudinary.js';

router.post('/file', protect, fileUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  res.json({
    success: true,
    fileUrl: req.file.path,
    name: req.file.originalname,
    type: req.file.mimetype,
    cloudinaryId: req.file.filename,
  });
});

export default router;