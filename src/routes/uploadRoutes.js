import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import upload from '../utils/cloudinary.js';
import { protect, authorize } from '../middleware/auth.js';
import { processVideoForHLS } from '../services/hlsService.js';
import { requireFeature } from '../middleware/tenant.js';

const router = express.Router();

// Ensure local directories exist for video uploads
const localUploadsDir = path.join(process.cwd(), 'public', 'uploads', 'raw_videos');
const hlsOutputDir = path.join(process.cwd(), 'public', 'uploads', 'hls');

if (!fs.existsSync(localUploadsDir)) fs.mkdirSync(localUploadsDir, { recursive: true });
if (!fs.existsSync(hlsOutputDir)) fs.mkdirSync(hlsOutputDir, { recursive: true });

// Multer storage for raw videos
const localVideoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, localUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    cb(null, `${uniqueId}${path.extname(file.originalname)}`);
  }
});
const localVideoUpload = multer({ storage: localVideoStorage });

// @route   POST /api/upload/image
// @desc    Upload an image
// @access  Private (Tutor/Admin)
router.post('/image', protect, authorize('tutor', 'admin'), upload.single('image'), (req, res) => {
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
// @access  Private (Tutor/Admin)
import { fileUpload } from '../utils/cloudinary.js';

router.post('/file', protect, authorize('tutor', 'admin'), fileUpload.single('file'), (req, res) => {
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

// @route   POST /api/upload/video-hls
// @desc    Upload an MP4 and convert to HLS format
// @access  Private (Tutor)
router.post(
  '/video-hls',
  protect,
  authorize('tutor'),
  requireFeature('hlsStreaming'), // Only tenants with HLS plan can use this
  localVideoUpload.single('video'),
  async (req, res) => {

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided' });
    }

    try {
      const fileId = path.parse(req.file.filename).name; // UUID without .mp4

      // Asynchronously process the video so the upload request doesn't timeout
      // In a production app, use heavily decoupled Queues (RabbitMQ, Redis/BullMQ)
      // Since we are running on standard servers, we'll offload it but return immediately

      processVideoForHLS(req.file.path, hlsOutputDir, fileId)
        .then((result) => {
          // Here we could update a database record status to "processed"
          console.log(`Video ready at ${result.playlistUrl}`);

          // Optional: Clean up the raw .mp4 after successful HLS creation to save space
          try {
            fs.unlinkSync(req.file.path);
            console.log('Cleaned up raw MP4:', req.file.path);
          } catch (cleanupErr) {
            console.error('Failed to clean up raw MP4:', cleanupErr);
          }
        })
        .catch((err) => {
          console.error(`HLS processing failed for ${fileId}`, err);
        });

      // Return immediately while FFMPEG runs in the background
      res.status(202).json({
        success: true,
        message: 'Video uploaded and is being processed for HLS streaming.',
        estimatedPlaylistUrl: `/uploads/hls/${fileId}/index.m3u8`,
        status: 'processing'
      });

    } catch (error) {
      console.error('Upload Video Error:', error);
      res.status(500).json({ success: false, message: 'Server error during upload' });
    }
  });

export default router;