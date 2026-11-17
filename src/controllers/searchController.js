import Course from '../models/Course.js';
import User from '../models/User.js';
import Institute from '../models/Institute.js';
import Batch from '../models/Batch.js';
import Tutor from '../models/Tutor.js';
import TutorStudentLink from '../models/TutorStudentLink.js';

export const unifiedSearch = async (req, res) => {
    try {
        const query = req.query.q || '';
        const role = req.user?.role;
        const workspaceType = req.workspace?.type;
        const instituteId = workspaceType === 'institute'
            ? (req.workspace?.instituteId || req.user?.instituteId)
            : null;

        if (!query.trim()) {
            return res.json({ success: true, results: {} });
        }

        const regex = new RegExp(query, 'i');
        const results = {};

        if (role === 'superadmin') {
            const [institutes, users] = await Promise.all([
                Institute.find({
                    $or: [{ name: regex }, { subdomain: regex }],
                }).limit(5).lean(),
                User.find({
                    role: { $ne: 'superadmin' },
                    $or: [{ name: regex }, { email: regex }],
                }).limit(5).select('name email role profileImage').lean(),
            ]);

            results.institutes = institutes;
            results.users = users;
        } else if (workspaceType === 'private_tutor') {
            if (role === 'tutor') {
                const tutorProfile = await Tutor.findOne({ userId: req.user.id }).select('_id').lean();
                const courseFilter = { instituteId: null, title: regex };
                if (tutorProfile?._id) {
                    courseFilter.$or = [{ tutorId: tutorProfile._id }, { createdBy: req.user.id }];
                } else {
                    courseFilter.createdBy = req.user.id;
                }

                const links = await TutorStudentLink.find({ tutorUserId: req.user.id, status: 'active' })
                    .select('studentId')
                    .lean();
                const linkedStudentIds = links.map((l) => l.studentId);

                const [courses, batches, students] = await Promise.all([
                    Course.find(courseFilter).limit(5).select('title thumbnail').lean(),
                    Batch.find({ instituteId: null, createdBy: req.user.id, name: regex })
                        .limit(5).select('name status').lean(),
                    linkedStudentIds.length > 0
                        ? User.find({
                            _id: { $in: linkedStudentIds },
                            $or: [{ name: regex }, { email: regex }],
                        }).limit(5).select('name email profileImage').lean()
                        : Promise.resolve([]),
                ]);

                results.courses = courses;
                results.batches = batches;
                results.students = students;
            } else if (role === 'student') {
                const activeTutorIds = req.workspace?.activeTutorIds || [];
                const courses = activeTutorIds.length > 0
                    ? await Course.find({
                        instituteId: null,
                        tutorId: { $in: activeTutorIds },
                        status: 'published',
                        title: regex,
                    }).limit(5).select('title thumbnail').lean()
                    : [];
                results.courses = courses;
            }
        } else if (role === 'admin' && instituteId) {
            const [courses, tutors, students, batches] = await Promise.all([
                Course.find({ instituteId, title: regex }).limit(5).select('title thumbnail').lean(),
                User.find({
                    instituteId,
                    role: 'tutor',
                    $or: [{ name: regex }, { email: regex }],
                }).limit(5).select('name email profileImage').lean(),
                User.find({
                    instituteId,
                    role: 'student',
                    $or: [{ name: regex }, { email: regex }],
                }).limit(5).select('name email profileImage').lean(),
                Batch.find({ instituteId, name: regex }).limit(5).select('name status').lean(),
            ]);

            results.courses = courses;
            results.tutors = tutors;
            results.students = students;
            results.batches = batches;
        } else if (role === 'tutor' && instituteId) {
            const tutorProfile = await Tutor.findOne({ userId: req.user.id }).select('_id').lean();
            const courseFilter = { instituteId, title: regex };
            if (tutorProfile?._id) {
                courseFilter.$or = [{ tutorId: tutorProfile._id }, { createdBy: req.user.id }];
            } else {
                courseFilter.createdBy = req.user.id;
            }

            const [courses, batches, students] = await Promise.all([
                Course.find(courseFilter).limit(5).select('title thumbnail').lean(),
                Batch.find({ instituteId, name: regex }).limit(5).select('name status').lean(),
                User.find({
                    instituteId,
                    role: 'student',
                    $or: [{ name: regex }, { email: regex }],
                }).limit(5).select('name email profileImage').lean(),
            ]);

            results.courses = courses;
            results.batches = batches;
            results.students = students;
        } else if (role === 'student' && instituteId) {
            const courses = await Course.find({
                instituteId,
                status: 'published',
                title: regex,
            }).limit(5).select('title thumbnail').lean();
            results.courses = courses;
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error('Unified search error:', error);
        res.status(500).json({ success: false, message: 'Server error during unified search' });
    }
};
