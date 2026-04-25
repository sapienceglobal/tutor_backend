import Course from '../models/Course.js';

// @desc    Get all courses across the platform (God View)
// @route   GET /api/superadmin/courses
// @access  Private/Superadmin
export const getAllCourses = async (req, res) => {
    try {
        const { status, search } = req.query;

        // Build query
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                // If you want to search by other fields, add them here
            ];
        }

        let courses = await Course.find(query)
            .populate({
                path: 'tutorId',
                populate: {
                    path: 'userId',
                    select: 'name email profileImage'
                }
            })
            .populate('instituteId', 'name subdomain')
            .populate('categoryId', 'name') // Assuming you have a Category model
            .sort({ createdAt: -1 });

        // Map userId fields to tutorId to match frontend expectations
        courses = courses.map(course => {
            const courseObj = course.toObject();
            if (courseObj.tutorId && courseObj.tutorId.userId) {
                courseObj.tutorId.name = courseObj.tutorId.userId.name;
                courseObj.tutorId.email = courseObj.tutorId.userId.email;
                courseObj.tutorId.profileImage = courseObj.tutorId.userId.profileImage;
            }
            return courseObj;
        });

        // Calculate Global KPIs
        const totalCourses = await Course.countDocuments();
        const publishedCourses = await Course.countDocuments({ status: 'published' });
        const suspendedCourses = await Course.countDocuments({ status: 'suspended' });
        
        // Total global enrollments
        const enrollmentsAgg = await Course.aggregate([
            { $group: { _id: null, total: { $sum: "$enrolledCount" } } }
        ]);
        const totalEnrollments = enrollmentsAgg.length > 0 ? enrollmentsAgg[0].total : 0;

        res.status(200).json({
            success: true,
            data: {
                courses,
                kpis: {
                    totalCourses,
                    publishedCourses,
                    suspendedCourses,
                    totalEnrollments
                }
            }
        });
    } catch (error) {
        console.error('Superadmin Fetch Courses Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch courses' });
    }
};

// @desc    Update course status (Suspend, Publish, Reject)
// @route   PATCH /api/superadmin/courses/:id/status
// @access  Private/Superadmin
export const updateCourseStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'suspended', 'published', etc.

        const validStatuses = ['draft', 'pending', 'published', 'archived', 'suspended', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const course = await Course.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        );

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        res.status(200).json({
            success: true,
            message: `Course status updated to ${status}`,
            data: course
        });
    } catch (error) {
        console.error('Superadmin Update Course Error:', error);
        res.status(500).json({ success: false, message: 'Failed to update course status' });
    }
};