import Invite from '../models/Invite.js';
import InstituteMembership from '../models/InstituteMembership.js';
import User from '../models/User.js';
import Institute from '../models/Institute.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// @desc    Bulk create invites
// @route   POST /api/admin/invites/bulk
// @access  Private (Admin)
export const bulkCreateInvites = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { invites, type } = req.body; // type: 'csv' | 'form'
        const invitedBy = req.user.id;

        console.log('🔍 DEBUG - bulkCreateInvites:', {
            userId: invitedBy,
            userRole: req.user.role,
            userInstituteId: req.user.instituteId,
            invitesCount: invites?.length,
            type
        });

        // Validate invites array
        if (!invites || !Array.isArray(invites) || invites.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide valid invites array'
            });
        }

        // Get admin's institute - check both superadmin and institute admin
        let instituteId;
        
        // Check if user is superadmin
        if (req.user.role === 'superadmin') {
            // Superadmin can create invites for any institute
            instituteId = req.body.instituteId || req.user.instituteId;
            console.log('👑 Superadmin detected for bulk create, using instituteId:', instituteId);
        } else {
            // Check if user has instituteId directly (for admins without InstituteMembership)
            if (req.user.instituteId) {
                instituteId = req.user.instituteId;
                console.log('🏢 Using direct instituteId from user:', instituteId);
            } else {
                // Check institute admin membership
                const adminMembership = await InstituteMembership.findOne({
                    userId: invitedBy,
                    roleInInstitute: 'admin',
                    status: 'active'
                }).populate('instituteId');

                console.log('🏢 Institute membership check for bulk create:', {
                    userId: invitedBy,
                    found: !!adminMembership,
                    membership: adminMembership
                });

                if (!adminMembership) {
                    return res.status(403).json({
                        success: false,
                        message: 'Only institute admins can create invites'
                    });
                }

                instituteId = adminMembership.instituteId._id;
            }
        }

        // Validate each invite
        const validInvites = [];
        const errors = [];

        for (let i = 0; i < invites.length; i++) {
            const invite = invites[i];
            const { name, email, role } = invite;

            // Basic validation
            if (!name || !email || !role) {
                errors.push({
                    row: i + 1,
                    error: 'Name, email, and role are required'
                });
                continue;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                errors.push({
                    row: i + 1,
                    email,
                    error: 'Invalid email format'
                });
                continue;
            }

            // Validate role
            if (!['student', 'tutor'].includes(role)) {
                errors.push({
                    row: i + 1,
                    email,
                    error: 'Role must be either student or tutor'
                });
                continue;
            }

            // Check if user already has a pending or accepted invite
            const existingInvite = await Invite.findByEmailAndInstitute(email, instituteId);
            if (existingInvite) {
                // If invite was accepted, check if user still exists
                if (existingInvite.status === 'accepted') {
                    const userExists = await User.findOne({ email: email.toLowerCase() });
                    if (userExists) {
                        errors.push({
                            row: i + 1,
                            email,
                            error: 'User already joined the institute'
                        });
                        continue;
                    } else {
                        // User was deleted, allow re-inviting by deleting old invite
                        console.log('🔄 User was deleted, removing old invite for:', email);
                        await Invite.deleteOne({ _id: existingInvite._id }).session(session);
                    }
                } else {
                    // Pending invite exists
                    errors.push({
                        row: i + 1,
                        email,
                        error: 'User already has a pending invite'
                    });
                    continue;
                }
            }

            validInvites.push({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                role,
                instituteId,
                invitedBy
            });
        }

        if (validInvites.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'No valid invites to create',
                errors
            });
        }

        // Generate tokens for each invite
        const invitesWithTokens = validInvites.map(invite => ({
            ...invite,
            token: crypto.randomBytes(32).toString('hex')
        }));

        // Create invites with tokens
        const createdInvites = await Invite.insertMany(invitesWithTokens, { session });

        // Send emails (async, don't wait for completion)
        sendBulkInviteEmails(createdInvites, instituteId).catch(console.error);

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: `Successfully created ${createdInvites.length} invites`,
            data: {
                created: createdInvites.length,
                errors: errors.length,
                errors: errors.length > 0 ? errors : undefined
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Bulk invite creation error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to create invites',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get invite by token
// @route   GET /api/invite/:token
// @access  Public
export const getInviteByToken = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Invite token is required'
            });
        }

        // Find valid invite
        const invite = await Invite.findValidInvite(token);

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired invite link'
            });
        }

        // Check if invite is expired
        if (invite.isExpired) {
            await invite.markAsExpired();
            return res.status(410).json({
                success: false,
                message: 'Invite link has expired'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                name: invite.name,
                email: invite.email,
                role: invite.role,
                institute: {
                    name: invite.instituteId.name,
                    subdomain: invite.instituteId.subdomain,
                    logo: invite.instituteId.logo,
                    brandColors: invite.instituteId.brandColors
                },
                expiresAt: invite.expiresAt
            }
        });

    } catch (error) {
        console.error('Get invite by token error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invite',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Accept invite
// @route   POST /api/invite/accept
// @access  Private
export const acceptInvite = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { token } = req.body;
        
        // Get user from token instead of req.user (since protect middleware is removed)
        const authHeader = req.headers.authorization;
        const tokenFromHeader = authHeader && authHeader.split(' ')[1];
        
        if (!tokenFromHeader) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Verify token and get user
        const decoded = jwt.verify(tokenFromHeader, process.env.JWT_SECRET);
        const userId = decoded.id;
        
        // Fetch user from database to get email
        const userRecord = await User.findById(userId);
        const userEmail = userRecord?.email;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Invite token is required'
            });
        }

        // Find valid invite
        const invite = await Invite.findValidInvite(token);

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired invite link'
            });
        }

        // Verify email matches
        if (userEmail.toLowerCase() !== invite.email.toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: 'This invite link is not for your account'
            });
        }

        // Check if user already has membership with this institute
        const existingMembership = await InstituteMembership.findOne({
            userId,
            instituteId: invite.instituteId._id
        });

        if (existingMembership) {
            return res.status(400).json({
                success: false,
                message: 'You are already a member of this institute'
            });
        }

        // Create institute membership
        const membership = await InstituteMembership.create([{
            userId,
            instituteId: invite.instituteId._id,
            roleInInstitute: invite.role,
            status: 'active',
            joinedVia: 'invite',
            approvedBy: invite.invitedBy,
            approvedAt: new Date(),
            permissions: getDefaultPermissions(invite.role)
        }], { session });

        // Update user's instituteId if not set
        if (!userRecord.instituteId) {
            userRecord.instituteId = invite.instituteId._id;
            await userRecord.save({ session });
        }

        // Accept the invite
        await invite.acceptInvite(userId);

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Invite accepted successfully! You are now a member of the institute.',
            data: {
                institute: {
                    name: invite.instituteId.name,
                    subdomain: invite.instituteId.subdomain
                },
                role: invite.role,
                expiresAt: invite.expiresAt
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('💥 Accept invite error:', error);
        console.error('💥 Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to accept invite',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get all invites for admin
// @route   GET /api/admin/invites
// @access  Private (Admin)
export const getAdminInvites = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const adminId = req.user.id;

        console.log('🔍 DEBUG - getAdminInvites:', {
            userId: adminId,
            userRole: req.user.role,
            userInstituteId: req.user.instituteId
        });

        // Get admin's institute - check both superadmin and institute admin
        let instituteId;
        
        // Check if user is superadmin
        if (req.user.role === 'superadmin') {
            // Superadmin can view invites for any institute
            instituteId = req.query.instituteId || req.user.instituteId;
            console.log('👑 Superadmin detected, using instituteId:', instituteId);
        } else {
            // Check if user has instituteId directly (for admins without InstituteMembership)
            if (req.user.instituteId) {
                instituteId = req.user.instituteId;
                console.log('🏢 Using direct instituteId from user for getAdminInvites:', instituteId);
            } else {
                // Check institute admin membership
                const adminMembership = await InstituteMembership.findOne({
                    userId: adminId,
                    roleInInstitute: 'admin',
                    status: 'active'
                });

                console.log('🏢 Institute membership check:', {
                    userId: adminId,
                    found: !!adminMembership,
                    membership: adminMembership
                });

                if (!adminMembership) {
                    return res.status(403).json({
                        success: false,
                        message: 'Only institute admins can view invites'
                    });
                }

                instituteId = adminMembership.instituteId;
            }
        }

        // Build query
        const query = { instituteId };
        if (status) {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const [invites, total] = await Promise.all([
            Invite.find(query)
                .populate('invitedBy', 'name email')
                .populate('acceptedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Invite.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: {
                invites,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get admin invites error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invites'
        });
    }
};

// @desc    Resend invite
// @route   POST /api/admin/invites/:id/resend
// @access  Private (Admin)
export const resendInvite = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        // Get invite
        const invite = await Invite.findById(id).populate('instituteId');

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: 'Invite not found'
            });
        }

        // Verify admin owns this invite
        const adminMembership = await InstituteMembership.findOne({
            userId: adminId,
            instituteId: invite.instituteId._id,
            roleInInstitute: 'admin',
            status: 'active'
        });

        if (!adminMembership) {
            return res.status(403).json({
                success: false,
                message: 'You can only resend invites for your institute'
            });
        }

        // Check if invite can be resent
        if (invite.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot resend invite with status: ${invite.status}`
            });
        }

        // Update resend count and timestamp
        invite.resendCount += 1;
        invite.lastResentAt = new Date();
        invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Reset expiry
        
        // Use findOneAndUpdate to avoid pre-save middleware issues
        await Invite.findByIdAndUpdate(id, {
            resendCount: invite.resendCount,
            lastResentAt: invite.lastResentAt,
            expiresAt: invite.expiresAt
        });

        // Send email
        await sendInviteEmail(invite, invite.instituteId);

        res.status(200).json({
            success: true,
            message: 'Invite resent successfully'
        });

    } catch (error) {
        console.error('Resend invite error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend invite'
        });
    }
};

// @desc    Revoke invite
// @route   DELETE /api/admin/invites/:id
// @access  Private (Admin)
export const revokeInvite = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        // Get invite
        const invite = await Invite.findById(id).populate('instituteId');

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: 'Invite not found'
            });
        }

        // Verify admin owns this invite
        const adminMembership = await InstituteMembership.findOne({
            userId: adminId,
            instituteId: invite.instituteId._id,
            roleInInstitute: 'admin',
            status: 'active'
        });

        if (!adminMembership) {
            return res.status(403).json({
                success: false,
                message: 'You can only revoke invites for your institute'
            });
        }

        // Revoke invite
        await invite.revokeInvite();

        res.status(200).json({
            success: true,
            message: 'Invite revoked successfully'
        });

    } catch (error) {
        console.error('Revoke invite error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to revoke invite'
        });
    }
};

// Helper functions
const getDefaultPermissions = (role) => {
    if (role === 'tutor') {
        return {
            canCreateCourses: true,
            canCreateExams: true,
            canViewAnalytics: true,
            canManageStudents: false
        };
    }
    return {
        canCreateCourses: false,
        canCreateExams: false,
        canViewAnalytics: false,
        canManageStudents: false
    };
};

const sendBulkInviteEmails = async (invites, institute) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS,
        },
    });

    for (const invite of invites) {
        try {
            await sendInviteEmail(invite, institute, transporter);
        } catch (error) {
            console.error(`Failed to send invite email to ${invite.email}:`, error);
        }
    }
};

const sendInviteEmail = async (invite, institute, transporter = null) => {
    const mailTransporter = transporter || nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS,
        },
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${invite.token}`;

    await mailTransporter.sendMail({
        from: `"${institute.name}" <${process.env.EMAIL_USER}>`,
        to: invite.email,
        subject: `Invitation to join ${institute.name} as ${invite.role}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    ${institute.logo ? `<img src="${institute.logo}" alt="${institute.name}" style="max-width: 150px; margin-bottom: 20px;">` : ''}
                    <h1 style="color: ${institute.brandColors?.primary || '#4F46E5'}; margin-bottom: 10px;">You're Invited!</h1>
                    <h2 style="color: ${institute.brandColors?.secondary || '#F97316'}; margin-bottom: 5px;">Join ${institute.name}</h2>
                </div>
                
                <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin: 20px 0;">
                    <p style="margin: 0 0 20px 0; font-size: 16px;">
                        Hello <strong>${invite.name}</strong>,
                    </p>
                    <p style="margin: 0 0 20px 0; font-size: 16px;">
                        You have been invited to join <strong>${institute.name}</strong> as a <strong>${invite.role}</strong>.
                    </p>
                    <p style="margin: 0 0 30px 0; font-size: 16px;">
                        Click the button below to accept your invitation and get started:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${inviteLink}" 
                           style="background: ${institute.brandColors?.primary || '#4F46E5'}; 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 8px; 
                                  font-weight: bold; 
                                  font-size: 16px;
                                  display: inline-block;">
                            Accept Invitation
                        </a>
                    </div>
                    
                    <p style="margin: 30px 0 0 0; font-size: 14px; color: #6c757d;">
                        This invitation will expire on ${invite.expiresAt.toLocaleDateString()}.
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="margin: 0; font-size: 14px; color: #6c757d;">
                        If you have any questions, please contact your institute administrator.
                    </p>
                </div>
            </div>
        `,
    });
};
