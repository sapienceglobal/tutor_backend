import OTP from '../models/OTP.js';
import User from '../models/User.js';
import Invite from '../models/Invite.js';
import InstituteMembership from '../models/InstituteMembership.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Email configuration (use existing email setup)
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS,
        },
    });
};

// @desc    Send OTP
// @route   POST /api/auth/send-otp
// @access  Public
export const sendOTP = async (req, res) => {
    try {
        const { email, purpose } = req.body;

        if (!email || !purpose) {
            return res.status(400).json({
                success: false,
                message: 'Email and purpose are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Create OTP
        const otpDoc = await OTP.createOTP(email.toLowerCase(), purpose);

        // Send email
        const transporter = createTransporter();
        const mailOptions = {
            from: `"TutorApp" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: purpose === 'invite-registration' ? 'Verify Your Email for Account Creation' : 'Your Verification Code',
            html: generateOTPEmailTemplate(otpDoc.otp, purpose)
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            // Don't send OTP in response for security
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP'
        });
    }
};

// @desc    Verify OTP and Register User
// @route   POST /api/auth/verify-otp-and-register
// @access  Public
export const verifyOTPAndRegister = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { name, email, password, role, inviteToken, otp } = req.body;

        console.log('🔍 OTP Registration Request:', {
            name,
            email,
            role,
            inviteToken: inviteToken ? 'provided' : 'none',
            otp: otp ? 'provided' : 'none'
        });

        // Validate required fields
        if (!name || !email || !password || !role || !otp) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Verify OTP
        const otpResult = await OTP.verifyOTP(email.toLowerCase(), otp, 'invite-registration');

        if (!otpResult.valid) {
            return res.status(400).json({
                success: false,
                message: otpResult.message
            });
        }

        // Mark OTP as used
        await otpResult.otpDoc.updateOne({ isUsed: true });

        // Check if user already exists (double check)
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        console.log('👤 Creating user with data:', {
            name,
            email: email.toLowerCase(),
            role,
            isEmailVerified: true
        });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create([{
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            isEmailVerified: true // Email is verified via OTP
        }], { session });

        const createdUser = user[0];
        console.log('✅ User created successfully:', {
            id: createdUser._id,
            name: createdUser.name,
            email: createdUser.email,
            role: createdUser.role
        });

        // Handle invite acceptance if inviteToken is provided
        if (inviteToken) {
            console.log('🎫 Processing invite token:', inviteToken);

            // Find and validate invite
            const invite = await Invite.findOne({
                token: inviteToken,
                status: 'pending',
                email: email.toLowerCase()
            }).populate('instituteId').session(session);

            if (!invite) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or expired invite token'
                });
            }

            console.log('📋 Invite found:', {
                id: invite._id,
                instituteId: invite.instituteId._id,
                instituteName: invite.instituteId.name
            });

            // Update invite status
            await Invite.updateOne(
                { _id: invite._id },
                {
                    status: 'accepted',
                    acceptedBy: createdUser._id,
                    acceptedAt: new Date()
                }
            ).session(session);

            console.log('✅ Invite status updated to accepted');

            // Create institute membership
            const membership = await InstituteMembership.create([{
                userId: createdUser._id,
                instituteId: invite.instituteId._id,
                roleInInstitute: role,
                status: 'active',
                joinedVia: 'invite', // Added missing joinedVia field
                joinedAt: new Date()
            }], { session });

            console.log('✅ Institute membership created:', {
                userId: createdUser._id,
                instituteId: invite.instituteId._id,
                role: role
            });

            // Update user's instituteId
            await User.updateOne(
                { _id: createdUser._id },
                { instituteId: invite.instituteId._id }
            ).session(session);

            console.log('✅ User instituteId updated');
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: createdUser._id, role: createdUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Remove password from output
        createdUser.password = undefined;

        await session.commitTransaction();
        session.endSession();

        console.log('🎉 Registration completed successfully!');

        res.status(201).json({
            success: true,
            token,
            user: {
                _id: createdUser._id,
                name: createdUser.name,
                email: createdUser.email,
                phone: createdUser.phone || '',
                role: createdUser.role,
                instituteId: createdUser.instituteId || null,
                profileImage: createdUser.profileImage,
                language: createdUser.language,
                notificationSettings: createdUser.notificationSettings,
                authProvider: createdUser.authProvider,
                hasPassword: true
            },
            message: 'Account created successfully'
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('❌ Verify OTP and Register error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
};

// Helper function to generate OTP email template
const generateOTPEmailTemplate = (otp, purpose) => {
    const purposeText = purpose === 'invite-registration' ? 'Account Creation' : 'Email Verification';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verification Code</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }
                .content {
                    background: #f9f9f9;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }
                .otp-code {
                    background: white;
                    border: 2px dashed #667eea;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 20px 0;
                }
                .otp-number {
                    font-size: 32px;
                    font-weight: bold;
                    color: #667eea;
                    letter-spacing: 5px;
                    margin: 10px 0;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 14px;
                }
                .security-note {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 5px;
                    padding: 15px;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔐 Email Verification</h1>
                <p>${purposeText}</p>
            </div>
            
            <div class="content">
                <p>Hello,</p>
                <p>You requested a verification code for ${purposeText.toLowerCase()}. Please use the following code to proceed:</p>
                
                <div class="otp-code">
                    <p>Your verification code is:</p>
                    <div class="otp-number">${otp}</div>
                </div>
                
                <div class="security-note">
                    <p><strong>⚠️ Security Notice:</strong></p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>This code will expire in 10 minutes</li>
                        <li>Never share this code with anyone</li>
                        <li>We will never ask for your password via email</li>
                    </ul>
                </div>
                
                <p>If you didn't request this code, please ignore this email.</p>
            </div>
            
            <div class="footer">
                <p>Best regards,<br>The TutorApp Team</p>
                <p style="font-size: 12px; color: #999;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </body>
        </html>
    `;
};
