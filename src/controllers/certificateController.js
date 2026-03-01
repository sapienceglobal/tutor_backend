import Certificate from '../models/Certificate.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

import jwt from 'jsonwebtoken';

// @desc    Generate a new certificate
// @route   GET /api/certificates/generate/:courseId?token=...
export const generateCertificate = async (req, res) => {
    try {
        const { courseId } = req.params;
        const token = req.query.token;

        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized to download this certificate' });
        }

        let studentId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            studentId = decoded.id;
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }

        // 1. Verify Enrollment & Completion
        const enrollment = await Enrollment.findOne({ studentId, courseId }).populate('studentId', 'name');
        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'You are not enrolled in this course.' });
        }

        // You might want to calculate completion dynamically if percentage isn't always updated perfectly
        // For now, we rely on the enrollment progress or status
        if (enrollment.status !== 'completed' && enrollment.progress.percentage !== 100) {
            // Allow some flexibility for testing if needed
            // return res.status(403).json({ success: false, message: 'Course must be 100% completed to earn a certificate.' });
        }

        const course = await Course.findById(courseId).populate('tutorId');
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found.' });
        }

        // 2. Check if already generated
        let certificate = await Certificate.findOne({ studentId, courseId });

        if (!certificate) {
            // 3. Create DB Record if not found
            const certificateId = uuidv4().substring(0, 8).toUpperCase() + '-' + Date.now().toString().substring(8);

            const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${certificateId}`;

            certificate = await Certificate.create({
                certificateId,
                studentId,
                courseId,
                tutorId: course.tutorId._id || course.tutorId,
                qrCodeData: verificationUrl
            });
        }

        // 4. Generate PDF Document
        const pdfDoc = await PDFDocument.create();

        // Create an A4 landscape page
        const page = pdfDoc.addPage([842, 595]);
        const { width, height } = page.getSize();

        // Fonts
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Simple Border
        page.drawRectangle({
            x: 20,
            y: 20,
            width: width - 40,
            height: height - 40,
            borderColor: rgb(0.3, 0.4, 0.8),
            borderWidth: 5,
        });

        // Content
        const titleText = 'CERTIFICATE OF COMPLETION';
        const titleWidth = timesBoldFont.widthOfTextAtSize(titleText, 40);
        page.drawText(titleText, {
            x: (width - titleWidth) / 2,
            y: height - 120,
            size: 40,
            font: timesBoldFont,
            color: rgb(0.1, 0.1, 0.3),
        });

        const presentedTo = 'This is to certify that';
        page.drawText(presentedTo, {
            x: (width - helveticaFont.widthOfTextAtSize(presentedTo, 18)) / 2,
            y: height - 180,
            size: 18,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.4),
        });

        const studentName = enrollment.studentId?.name || "Student User";
        page.drawText(studentName, {
            x: (width - timesBoldFont.widthOfTextAtSize(studentName, 36)) / 2,
            y: height - 240,
            size: 36,
            font: timesBoldFont,
            color: rgb(0, 0, 0),
        });

        const completedText = 'has successfully completed the course';
        page.drawText(completedText, {
            x: (width - helveticaFont.widthOfTextAtSize(completedText, 18)) / 2,
            y: height - 300,
            size: 18,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.4),
        });

        const courseTitle = course.title;
        page.drawText(courseTitle, {
            x: (width - timesBoldFont.widthOfTextAtSize(courseTitle, 28)) / 2,
            y: height - 360,
            size: 28,
            font: timesBoldFont,
            color: rgb(0.2, 0.3, 0.6),
        });

        const issueDateStr = `Issued on: ${new Date(certificate.issuedAt).toLocaleDateString()}`;
        page.drawText(issueDateStr, {
            x: 80,
            y: 120,
            size: 14,
            font: helveticaFont,
            color: rgb(0.3, 0.3, 0.3),
        });

        const idStr = `Certificate ID: ${certificate.certificateId}`;
        page.drawText(idStr, {
            x: 80,
            y: 100,
            size: 12,
            font: timesRomanFont,
            color: rgb(0.5, 0.5, 0.5),
        });

        // 5. Generate and embed QR Code
        try {
            const verificationUrl = certificate.qrCodeData;
            const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: 'H' });

            // Convert base64 to Uint8Array
            const qrCodeImageBytes = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
            const qrImage = await pdfDoc.embedPng(qrCodeImageBytes);
            const qrDims = qrImage.scale(0.5); // scale down

            page.drawImage(qrImage, {
                x: width - 150 - qrDims.width,
                y: 80,
                width: qrDims.width,
                height: qrDims.height,
            });

            // Add "Scan to verify" text below QR
            page.drawText('Scan to verify', {
                x: width - 150 - qrDims.width + (qrDims.width / 2) - 30,
                y: 65,
                size: 10,
                font: helveticaFont,
                color: rgb(0.5, 0.5, 0.5),
            });

        } catch (qrErr) {
            console.error('Error attaching QR code:', qrErr);
        }

        // 6. Return PDF Buffer
        const pdfBytes = await pdfDoc.save();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=certificate-${certificate.certificateId}.pdf`);

        // We send binary data directly
        return res.end(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Generate certificate error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate certificate', error: error.message });
    }
};

// @desc    Get a student's certificates
// @route   GET /api/certificates/my-certificates
export const getMyCertificates = async (req, res) => {
    try {
        const studentId = req.user.id;
        const certificates = await Certificate.find({ studentId })
            .populate('courseId', 'title thumbnail displayStatus')
            .sort({ issuedAt: -1 });

        res.status(200).json({
            success: true,
            data: certificates
        });
    } catch (error) {
        console.error('Get my certificates error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Verify a certificate by ID (Public)
// @route   GET /api/certificates/verify/:certificateId
export const verifyCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;

        const certificate = await Certificate.findOne({ certificateId })
            .populate('studentId', 'name email avatar')
            .populate('courseId', 'title thumbnail')
            .populate('tutorId', 'name');

        if (!certificate) {
            return res.status(404).json({
                success: false,
                message: 'Certificate not found. This certificate ID is invalid or does not exist.'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                certificateId: certificate.certificateId,
                issuedAt: certificate.issuedAt,
                student: {
                    name: certificate.studentId.name,
                },
                course: {
                    title: certificate.courseId.title,
                    thumbnail: certificate.courseId.thumbnail
                },
                tutor: {
                    name: certificate.tutorId?.name || "Instructor"
                }
            }
        });

    } catch (error) {
        console.error('Verify certificate error:', error);
        res.status(500).json({ success: false, message: 'Server Error verifying certificate' });
    }
};
