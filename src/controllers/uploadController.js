import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';       
import path from 'path';    
import os from 'os';
import { Readable } from 'stream';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
    console.error("❌ CRITICAL ERROR: Cloudinary credentials missing!");
}

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
});

// 🌟 CHANGE 1: Disk Storage instead of Memory Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Save safely to server's temporary directory
        cb(null, os.tmpdir());
    },
    filename: function (req, file, cb) {
        // Create a unique filename to prevent overwriting
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // ✅ Ab 500MB safe hai kyunki ye RAM mein nahi jayega!
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/webp',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'
        ];

        if (!allowedMimes.includes(file.mimetype)) {
            return cb(new Error('File type not allowed!'), false);
        }
        cb(null, true);
    },
});

// Helper: upload buffer to Cloudinary
// 🌟 CHANGE 2: Simpler Cloudinary Upload from Disk
const uploadToCloudinary = async (filePath, folder, resourceType = 'auto') => {
    if (!cloudinary.config().cloud_name) {
        throw new Error("Cloudinary not configured");
    }

    return await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: resourceType,
        transformation: resourceType === 'image' ? [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' },
        ] : undefined,
    });
};

// 🌟 CHANGE 3: Controllers with Automatic Garbage Collection (Cleanup)
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Upload from disk path
        const result = await uploadToCloudinary(req.file.path, 'tutor_management/profiles', 'image');

        // 🧹 Cleanup: Delete from server disk immediately after upload
        fs.unlinkSync(req.file.path);

        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            url: result.secure_url,
            publicId: result.public_id,
        });
    } catch (error) {
        // Safe Cleanup even if upload fails
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: error.message || 'Upload failed' });
    }
};

export const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'raw';
        const folder = resourceType === 'video' ? 'tutor_management/videos' : 'tutor_management/documents';

        // Upload from disk path
        const result = await uploadToCloudinary(req.file.path, folder, resourceType);

        // 🧹 Cleanup: Delete from server disk immediately after upload
        fs.unlinkSync(req.file.path);

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            url: result.secure_url,
            publicId: result.public_id,
            originalName: req.file.originalname,
            format: result.format,
            size: result.bytes,
            duration: result.duration || 0,
            resourceType: resourceType
        });
    } catch (error) {
        // Safe Cleanup even if upload fails
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('File upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'File upload failed'
        });
    }
};

// Controller: Delete image
export const deleteImage = async (req, res) => {
    try {
        const { publicId } = req.body;
        if (!publicId) {
            return res.status(400).json({ success: false, message: 'Public ID required' });
        }

        const result = await cloudinary.uploader.destroy(publicId);

        if (result.result === 'ok') {
            res.status(200).json({ success: true, message: 'Image deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Image not found' });
        }
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
};

// Controller: Delete file (Handles both Raw and Video)
export const deleteFile = async (req, res) => {
    try {
        const { publicId, resourceType } = req.body; // resourceType frontend se bhejna better hai
        if (!publicId) {
            return res.status(400).json({ success: false, message: 'Public ID required' });
        }

        // Default to 'raw' if not specified, but try to handle video deletion
        // Cloudinary needs correct resource_type to delete
        // Strategy: Try deleting as video first, if fails or not found, try as raw
        // Lekin simple rakhne ke liye hum 'raw' default rakhte hain ya frontend se expect karte hain.

        // CHANGE 4: Improved delete logic
        const typeToDelete = resourceType || 'raw';

        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: typeToDelete
        });

        if (result.result === 'ok') {
            res.status(200).json({ success: true, message: 'File deleted successfully' });
        } else {
            // Agar raw me nahi mila, to shayad video ho? (Optional safety)
            if (typeToDelete === 'raw') {
                const videoResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
                if (videoResult.result === 'ok') {
                    return res.status(200).json({ success: true, message: 'Video deleted successfully' });
                }
            }
            res.status(404).json({ success: false, message: 'File not found' });
        }
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
};

export { upload };
