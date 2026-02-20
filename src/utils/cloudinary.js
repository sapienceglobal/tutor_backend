import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tutor-app-profiles',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});

const fileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tutor-app-resources',
    resource_type: 'auto', // Important for PDFs, Docs, etc.
    // allowed_formats: ['pdf', 'doc', 'docx', 'zip', 'ppt', 'pptx'], // Optional: Restrict types if needed
  },
});

const upload = multer({ storage: storage });
const fileUpload = multer({ storage: fileStorage });

export { fileUpload };
export default upload;
