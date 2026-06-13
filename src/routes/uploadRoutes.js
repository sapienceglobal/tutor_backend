
import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import upload from '../utils/cloudinary.js';
import { protect, authorize } from '../middleware/auth.js';
import { processVideoForHLS } from '../services/hlsService.js';
import { requireFeature } from '../middleware/subscriptionMiddleware.js';

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
const MAX_VIDEO_UPLOAD_MB = Number(process.env.MAX_VIDEO_UPLOAD_MB || 500);
const localVideoUpload = multer({
  storage: localVideoStorage,
  limits: { fileSize: MAX_VIDEO_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file?.mimetype?.startsWith('video/')) {
      return cb(new Error('Only video files are allowed'));
    }
    return cb(null, true);
  },
});

// @route   POST /api/upload/image
// @desc    Upload an image
// @access  Private (Tutor/Admin)
router.post('/image', protect, authorize('tutor', 'admin', 'student'), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const imageUrl = String(req.file.path || '').replace(/^http:\/\//i, 'https://');

  res.json({
    success: true,
    imageUrl,
    url: imageUrl,
    cloudinaryId: req.file.filename,
  });
});

// @route   POST /api/upload/file
// @desc    Upload a document/file
// @access  Private (Tutor/Admin)
import { fileUpload } from '../utils/cloudinary.js';

router.post('/file', protect, authorize('tutor', 'admin', 'student'), fileUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const fileUrl = String(req.file.path || '').replace(/^http:\/\//i, 'https://');

  res.json({
    success: true,
    fileUrl,
    url: fileUrl,
    name: req.file.originalname,
    type: req.file.mimetype,
    cloudinaryId: req.file.filename,
  });
});

// @route   POST /api/upload/cloudinary-signature
// @desc    Get signed signature for direct Cloudinary upload
// @access  Private (Tutor/Admin/Student)
router.post('/cloudinary-signature', protect, (req, res, next) => {
  if (req.body?.type === 'hls') {
    return requireFeature('hlsStreaming')(req, res, next);
  }
  next();
}, (req, res) => {
  try {
    const { type } = req.body || {};
    const timestamp = Math.round((new Date()).getTime() / 1000);
    
    const isHls = type === 'hls';
    const folder = isHls ? 'tutor-app-hls' : 'tutor-app-resources';
    
    const params_to_sign = {
      timestamp: timestamp,
      folder: folder,
    };
    
    if (isHls) {
      params_to_sign.eager = 'sp_auto/m3u8';
      params_to_sign.eager_async = 'true';
    }
    
    const signature = cloudinary.utils.api_sign_request(params_to_sign, process.env.CLOUDINARY_API_SECRET);
    
    res.json({
      success: true,
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
      ...(isHls ? { eager: 'sp_auto/m3u8', eager_async: 'true' } : {})
    });
  } catch (error) {
    console.error('Error generating signature:', error);
    res.status(500).json({ success: false, message: 'Failed to generate upload signature' });
  }
});

// @route   POST /api/upload/video-hls
// @desc    Upload an MP4 and convert to HLS format
// @access  Private (Tutor)
router.post(
  '/video-hls',
  protect,
  authorize('tutor'),
  requireFeature('hlsStreaming'), // SECURE: Only tenants with HLS plan can use this
  localVideoUpload.single('video'),
  async (req, res) => {

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided' });
    }

    try {
      // Upload raw video to Cloudinary and request background HLS transcoding
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'tutor-app-hls',
        eager: [
          { streaming_profile: 'auto', format: 'm3u8' }
        ],
        eager_async: true
      });

      // Clean up the local temp MP4 file immediately to save VPS disk space
      try {
        fs.unlinkSync(req.file.path);
        console.log('Cleaned up raw local video file:', req.file.path);
      } catch (cleanupErr) {
        console.error('Failed to clean up raw local video file:', cleanupErr);
      }

      const cloudName = cloudinary.config().cloud_name || process.env.CLOUDINARY_CLOUD_NAME;
      const estimatedPlaylistUrl = `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${result.public_id}.m3u8`;

      res.status(200).json({
        success: true,
        message: 'Video uploaded and is being processed for HLS streaming on Cloudinary.',
        estimatedPlaylistUrl,
        duration: Math.round(result.duration || 0),
        videoSize: result.bytes || req.file.size || 0,
        status: 'processing'
      });

    } catch (error) {
      console.error('Upload Video Error:', error);
      // Clean up local file in case upload failed
      try {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (_) {}
      res.status(500).json({ success: false, message: 'Server error during upload' });
    }
  });

export default router;
