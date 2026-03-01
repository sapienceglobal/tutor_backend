import express from 'express';
import { generateCertificate, getMyCertificates, verifyCertificate } from '../controllers/certificateController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Generate a certificate for a completed course
// This returns a PDF file stream
router.get('/generate/:courseId', generateCertificate);

// Get a list of certificates earned by the logged-in user
router.get('/my-certificates', protect, getMyCertificates);

// Public route to verify a certificate by its unique ID
router.get('/verify/:certificateId', verifyCertificate);

export default router;
