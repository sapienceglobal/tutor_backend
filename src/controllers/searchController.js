import Course from '../models/Course.js';
import User from '../models/User.js';
import Institute from '../models/Institute.js';
import Batch from '../models/Batch.js';
import Tutor from '../models/Tutor.js';

export const unifiedSearch = async (req, res) => {
    try {
        const query = req.query.q || '';
        const role = req.user?.role;
        const instituteId = req.user?.instituteId;

        if (!query.trim()) {
            return res.json({ success: true, results: {} });
        }

        const regex = new RegExp(query, 'i');
        const results = {};

        if (role === 'superadmin') {
            const [institutes, users] = await Promise.all([
                Institute.find({
                    $or: [
                        { name: regex },
                        { subdomain: regex }
                    ]
                }).limit(5).lean(),
                User.find({
                    role: { $ne: 'superadmin' },
                    $or: [
                        { name: regex },
                        { email: regex }
                    ]
                }).limit(5).select('name email role profileImage').lean()
            ]);

            results.institutes = institutes;
            results.users = users;

        } else if (role === 'admin') {
            const [courses, tutors, students, batches] = await Promise.all([
                Course.find({
                    instituteId,
                    title: regex
                }).limit(5).select('title thumbnail').lean(),
                User.find({
                    instituteId,
                    role: 'tutor',
                    $or: [
                        { name: regex },
                        { email: regex }
                    ]
                }).limit(5).select('name email profileImage').lean(),
                User.find({
                    instituteId,
                    role: 'student',
                    $or: [
                        { name: regex },
                        { email: regex }
                    ]
                }).limit(5).select('name email profileImage').lean(),
                Batch.find({
                    instituteId,
                    name: regex
                }).limit(5).select('name status').lean()
            ]);

            results.courses = courses;
            results.tutors = tutors;
            results.students = students;
            results.batches = batches;

        } else if (role === 'tutor') {
            const tutorProfile = await Tutor.findOne({ userId: req.user.id });
            const tutorProfileId = tutorProfile ? tutorProfile._id : null;

            const courseFilter = { instituteId, title: regex };
            if (tutorProfileId) {
                courseFilter.$or = [
                    { tutorId: tutorProfileId },
                    { createdBy: req.user.id }
                ];
            } else {
                courseFilter.createdBy = req.user.id;
            }

            const [courses, batches, students] = await Promise.all([
                Course.find(courseFilter).limit(5).select('title thumbnail').lean(),
                Batch.find({
                    instituteId,
                    name: regex
                }).limit(5).select('name status').lean(),
                User.find({
                    instituteId,
                    role: 'student',
                    $or: [
                        { name: regex },
                        { email: regex }
                    ]
                }).limit(5).select('name email profileImage').lean()
            ]);

            results.courses = courses;
            results.batches = batches;
            results.students = students;
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error('Unified search error:', error);
        res.status(500).json({ success: false, message: 'Server error during unified search' });
    }
};
