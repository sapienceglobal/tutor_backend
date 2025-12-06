import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads a file buffer to Cloudinary using upload_stream.
 * Returns { url, public_id } on success.
 */
export function uploadBufferToCloudinary(buffer, folder = "reviews") {
  console.log("Uploading in progress")
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Delete image by public_id (optional)
 */
export async function deleteFromCloudinary(public_id) {
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (e) {
    console.warn("Cloudinary delete error:", e);
  }
}
