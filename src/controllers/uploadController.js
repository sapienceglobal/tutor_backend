import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
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

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    // CHANGE 1: Increased limit to 500MB (Video needs more space)
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            // Images
            'image/jpeg', 'image/png', 'image/webp',
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            // CHANGE 2: Added Video Mime Types
            'video/mp4',
            'video/mpeg',
            'video/quicktime', // .mov
            'video/x-msvideo', // .avi
            'video/webm',
            'video/x-matroska' // .mkv
        ];

        if (!allowedMimes.includes(file.mimetype)) {
            return cb(new Error('File type not allowed!'), false);
        }
        cb(null, true);
    },
});

// Helper: upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder, resourceType = 'auto') =>
    new Promise((resolve, reject) => {
        if (!cloudinary.config().cloud_name) {
            return reject(new Error("Cloudinary not configured"));
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: resourceType,
                // Image hai to optimize karo, Video/File hai to mat chedo
                transformation: resourceType === 'image' ? [
                    { width: 500, height: 500, crop: 'limit' },
                    { quality: 'auto' },
                ] : undefined,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        Readable.from(buffer).pipe(uploadStream);
    });

// Controller: Upload image
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const result = await uploadToCloudinary(
            req.file.buffer,
            'tutor_management/profiles',
            'image'
        );

        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            url: result.secure_url,
            publicId: result.public_id,
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: error.message || 'Upload failed' });
    }
};

// Controller: Upload file (PDF, DOC, Video, etc.)
export const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }


        // CHANGE 3: Auto-detect resource type (Video vs Raw File)
        // Agar MIME type 'video/' se start hota hai to 'video', nahi to 'raw'
        const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'raw';

        // Folder structure thoda clean kar diya (videos alag, docs alag)
        const folder = resourceType === 'video'
            ? 'tutor_management/videos'
            : 'tutor_management/documents';

        const result = await uploadToCloudinary(
            req.file.buffer,
            folder,
            resourceType
        );

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            url: result.secure_url,
            publicId: result.public_id,
            originalName: req.file.originalname,
            format: result.format,
            size: result.bytes,
            duration: result.duration || 0, // Video duration (seconds) Cloudinary return karta hai
            resourceType: resourceType // Frontend ko pata chale kya upload hua
        });
    } catch (error) {
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
