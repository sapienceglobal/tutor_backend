import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Readable } from 'stream';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;


if (!cloudName || !apiKey || !apiSecret) {
    console.error("❌ CRITICAL ERROR: Cloudinary credentials missing in uploadController!");
}

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
});
// --- CHANGE END ---

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    },
});

// Helper: upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder) =>
    new Promise((resolve, reject) => {
        // Debug check inside the upload process
        if (!cloudinary.config().cloud_name) {
            return reject(new Error("Cloudinary not configured before upload start"));
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'auto',
                transformation: [
                    { width: 500, height: 500, crop: 'limit' },
                    { quality: 'auto' },
                ],
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

        console.log("Starting upload to Cloudinary..."); // Debug log
        const result = await uploadToCloudinary(req.file.buffer, 'tutor_management/profiles');

        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            url: result.secure_url,
            publicId: result.public_id,
        }); console.log("Uploaded to Cloudinary...");
    } catch (error) {
        console.error('Upload error details:', error); // Detailed error log
        res.status(500).json({ success: false, message: error.message || 'Upload failed' });
    }
};

// Controller: Delete image
export const deleteImage = async (req, res) => {
    try {
        const { publicId } = req.body;
        if (!publicId) return res.status(400).json({ success: false, message: 'Public ID required' });

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

export { upload };
