import Institute from '../models/Institute.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

// 1. Get All Institutes
export const getInstitutes = async (req, res) => {
    try {
        const institutes = await Institute.find().sort({ createdAt: -1 });

        // Count users per institute
        const institutesWithStats = await Promise.all(institutes.map(async (inst) => {
            const userCount = await User.countDocuments({ instituteId: inst._id });
            return { ...inst.toObject(), userCount };
        }));

        res.json({ success: true, institutes: institutesWithStats });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch institutes' });
    }
};

// 2. Create New Institute & Default Admin
export const createInstitute = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { name, subdomain, adminName, adminEmail, adminPassword, plan } = req.body;

        // Check if subdomain exists
        const existingInst = await Institute.findOne({ subdomain: subdomain.toLowerCase() }).session(session);
        if (existingInst) {
            return res.status(400).json({ success: false, message: 'Subdomain already in use.' });
        }

        // Check if admin email exists globally
        const existingAdmin = await User.findOne({ email: adminEmail }).session(session);
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: 'Admin email already registered.' });
        }

        // Features by plan
        const features = {
            hlsStreaming: plan === 'enterprise',
            customBranding: ['pro', 'enterprise'].includes(plan),
            zoomIntegration: ['basic', 'pro', 'enterprise'].includes(plan),
            aiFeatures: ['pro', 'enterprise'].includes(plan)
        };

        const newInstitute = new Institute({
            name,
            subdomain: subdomain.toLowerCase(),
            subscriptionPlan: plan || 'free',
            features
        });

        await newInstitute.save({ session });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        const newAdmin = new User({
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            instituteId: newInstitute._id
        });

        await newAdmin.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Send credentials email to the new admin
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            await transporter.sendMail({
                from: `"Sapience LMS" <${process.env.EMAIL_USER}>`,
                to: adminEmail,
                subject: `Welcome to ${name} — Your Admin Credentials`,
                html: `
                    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
                        <h2 style="color: #4f46e5;">Welcome to Sapience LMS! 🎓</h2>
                        <p>An institute <strong>${name}</strong> has been created and you have been assigned as the Admin.</p>
                        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Login URL:</strong> <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login">${process.env.FRONTEND_URL || 'http://localhost:3000'}/login</a></p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> ${adminEmail}</p>
                            <p style="margin: 5px 0;"><strong>Password:</strong> ${adminPassword}</p>
                        </div>
                        <p style="color: #64748b; font-size: 13px;">Please change your password after first login.</p>
                    </div>
                `,
            });
        } catch (emailErr) {
            console.error('Failed to send admin credentials email:', emailErr.message);
            // Don't fail the request — institute is already created
        }

        res.status(201).json({ success: true, institute: newInstitute, message: 'Institute and Admin created successfully. Credentials emailed.' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(error);
        res.status(500).json({ success: false, message: error.message || 'Server error creating institute' });
    }
};

// 3. Update Institute Status or Features
export const updateInstitute = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const institute = await Institute.findByIdAndUpdate(id, updates, { new: true });

        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found.' });
        }

        res.json({ success: true, institute, message: 'Institute updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update institute' });
    }
};

// 4. Get Platform Overview Stats
export const getPlatformStats = async (req, res) => {
    try {
        const totalInstitutes = await Institute.countDocuments();
        const activeInstitutes = await Institute.countDocuments({ isActive: true });
        const totalUsers = await User.countDocuments({ role: { $ne: 'superadmin' } });
        const totalTutors = await User.countDocuments({ role: 'tutor' });
        const totalStudents = await User.countDocuments({ role: 'student' });

        res.json({
            success: true,
            stats: { totalInstitutes, activeInstitutes, totalUsers, totalTutors, totalStudents }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch platform stats' });
    }
};

// 5. Get All Users (Superadmin — All roles)
export const getAllUsers = async (req, res) => {
    try {
        const { role, search, blocked } = req.query;
        let filter = { role: { $ne: 'superadmin' } };

        if (role && role !== 'all') filter.role = role;
        if (blocked === 'true') filter.isBlocked = true;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const users = await User.find(filter)
            .select('name email role isBlocked profileImage createdAt phone instituteId')
            .populate('instituteId', 'name')
            .sort({ createdAt: -1 })
            .limit(200);

        res.json({ success: true, users, count: users.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

// 6. Update User Role/Status (Superadmin)
export const updateUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, isBlocked } = req.body;

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'superadmin') return res.status(403).json({ success: false, message: 'Cannot modify superadmin' });

        if (role) user.role = role;
        if (isBlocked !== undefined) user.isBlocked = isBlocked;

        await user.save();
        res.json({ success: true, user, message: 'User updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
};

// 7. Delete User (Superadmin)
export const deleteUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'superadmin') return res.status(403).json({ success: false, message: 'Cannot delete superadmin' });

        await User.findByIdAndDelete(id);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
};

// 8. Get Activity Log
export const getActivityLog = async (req, res) => {
    try {
        const recentUsers = await User.find({ role: { $ne: 'superadmin' } })
            .select('name email role createdAt profileImage')
            .sort({ createdAt: -1 })
            .limit(50);

        const activities = recentUsers.map(u => ({
            _id: u._id,
            type: 'registration',
            user: { name: u.name, email: u.email, role: u.role, profileImage: u.profileImage },
            description: `${u.name} (${u.role}) registered`,
            timestamp: u.createdAt,
        }));

        res.json({ success: true, activities, count: activities.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch activity log' });
    }
};

// 9. Get all users of a specific institute
export const getInstituteUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const institute = await Institute.findById(id);
        if (!institute) return res.status(404).json({ success: false, message: 'Institute not found' });

        const users = await User.find({ instituteId: id, role: { $ne: 'superadmin' } })
            .select('name email role isBlocked profileImage createdAt phone')
            .sort({ role: 1, createdAt: -1 });

        const admin = users.filter(u => u.role === 'admin');
        const tutors = users.filter(u => u.role === 'tutor');
        const students = users.filter(u => u.role === 'student');

        res.json({
            success: true,
            institute,
            users: { admin, tutors, students },
            counts: { admin: admin.length, tutors: tutors.length, students: students.length, total: users.length }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch institute users' });
    }
};

// 10. Impersonate a user (generate their token for superadmin)
export const impersonateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'superadmin') return res.status(403).json({ success: false, message: 'Cannot impersonate a superadmin' });

        // Generate a short-lived token for the target user
        const jwt = (await import('jsonwebtoken')).default;
        const token = jwt.sign(
            { id: user._id, role: user.role, impersonatedBy: req.user._id },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
            },
            message: `Now impersonating ${user.name} (${user.role})`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to impersonate user' });
    }
};
