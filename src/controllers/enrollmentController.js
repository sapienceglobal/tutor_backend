import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Progress from '../models/Progress.js';
import TutorStudentLink from '../models/TutorStudentLink.js';
import InstituteMembership from '../models/InstituteMembership.js';
import Payment from '../models/Payment.js';
import { createNotification } from './notificationController.js';

// @desc    Enroll in a course
// @route   POST /api/enrollments
export const enrollInCourse = async (req, res) => {
  try {
    const { courseId, batchId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
    }

    // Check if course exists and its availability
    const course = await Course.findById(courseId).populate({
      path: 'tutorId',
      populate: { path: 'userId' },
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const isPrivateCourse = !course.instituteId;
    const isTutorVerified = isPrivateCourse
      ? (course.tutorId?.privateTeaching?.isEnabled !== false)
      : Boolean(course.tutorId?.isVerified);
    const isTutorBlocked = Boolean(course.tutorId?.userId?.isBlocked);
    const isCourseAvailable = course.status === 'published' && isTutorVerified && !isTutorBlocked;

    if (!isCourseAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Course is not currently available for new enrollments',
      });
    }

    // Closed-workspace membership / tutor link verification
    if (course.instituteId) {
      const hasInstAccess = String(req.user.instituteId) === String(course.instituteId)
        || await InstituteMembership.exists({
          userId: req.user.id,
          instituteId: course.instituteId,
          status: 'active',
        });
      if (!hasInstAccess) {
        return res.status(403).json({
          success: false,
          code: 'INSTITUTE_MEMBERSHIP_REQUIRED',
          message: 'This course is restricted to approved institute members.',
        });
      }
    } else {
      const hasTutorLink = await TutorStudentLink.exists({
        studentId: req.user.id,
        tutorId: course.tutorId?._id,
        status: 'active',
      });
      if (!hasTutorLink) {
        return res.status(403).json({
          success: false,
          code: 'TUTOR_NOT_LINKED',
          message: 'You must be connected with this Private Tutor before enrolling in their course.',
        });
      }
    }

    // Check existing enrollment
    const existingEnrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    });

    if (existingEnrollment) {
      if (existingEnrollment.status === 'pending_payment') {
        return res.status(400).json({
          success: false,
          pendingPayment: true,
          message: 'Your offline fee confirmation is already pending with the tutor.',
        });
      }
      if (existingEnrollment.status === 'pending') {
        return res.status(400).json({
          success: false,
          pending: true,
          message: 'Your enrollment request is already pending approval.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course',
      });
    }

    let resolvedPaymentId = null;
    let resolvedPaymentMode = 'free';

    // Handle paid courses (online payment verified vs offline manual fee submission)
    if (!course.isFree && Number(course.price || 0) > 0) {
      const { paymentId, note, transactionRef, declaredAmount } = req.body;

      if (paymentId) {
        const payment = await Payment.findById(paymentId);
        if (!payment || payment.status !== 'paid' || payment.courseId?.toString() !== String(courseId)) {
          return res.status(402).json({
            success: false,
            message: 'Valid paid transaction required for this course.',
          });
        }
        resolvedPaymentId = payment._id;
        resolvedPaymentMode = 'online';
      } else if (course.pricingMode === 'offline') {
        const pendingEnrollment = await Enrollment.create({
          studentId: req.user.id,
          courseId,
          batchId,
          status: 'pending_payment',
          paymentMode: 'offline',
          offlinePayment: {
            declaredAmount: Math.max(0, Number(declaredAmount ?? course.price) || course.price),
            note: String(note || '').trim().slice(0, 500),
            transactionRef: String(transactionRef || '').trim().slice(0, 120),
            markedPaidAt: new Date(),
          },
        });

        await Promise.allSettled([
          course.tutorId?.userId?._id && createNotification({
            userId: course.tutorId.userId._id,
            type: 'offline_enrollment_pending',
            title: 'Offline Fee Confirmation Pending',
            message: `${req.user.name || 'A student'} requested offline enrollment for "${course.title}". Confirm payment once received.`,
            data: { courseId: course._id, enrollmentId: pendingEnrollment._id },
          }),
          createNotification({
            userId: req.user.id,
            type: 'offline_enrollment_pending',
            title: 'Offline Enrollment Submitted',
            message: `Your offline enrollment request for "${course.title}" has been sent. Access unlocks once your tutor confirms payment.`,
            data: { courseId: course._id, enrollmentId: pendingEnrollment._id },
          }),
        ]);

        return res.status(201).json({
          success: true,
          pendingPayment: true,
          message: 'Offline enrollment request submitted. Course access unlocks once the tutor confirms your fee payment.',
          offlinePaymentInstructions: course.offlinePaymentInstructions || '',
          enrollment: pendingEnrollment,
        });
      } else {
        return res.status(402).json({
          success: false,
          message: 'Online payment required for this course.',
          requiresPayment: true,
          pricingMode: course.pricingMode,
          price: course.price,
        });
      }
    }

    const needsApproval = course.enrollmentSettings?.requireApproval;

    const enrollment = await Enrollment.create({
      studentId: req.user.id,
      courseId,
      batchId,
      paymentId: resolvedPaymentId,
      paymentMode: resolvedPaymentMode,
      status: needsApproval ? 'pending' : 'active',
    });

    if (needsApproval) {
      // Notify student that their request is pending
      await createNotification({
        userId: req.user.id,
        type: 'course_enrolled',
        title: '⏳ Enrollment Request Sent',
        message: `Your request to join "${course.title}" has been sent. You'll be notified once the tutor approves it.`,
        data: { courseId: course._id }
      });

      return res.status(201).json({
        success: true,
        pending: true,
        message: 'Enrollment request sent. Waiting for tutor approval.',
        enrollment,
      });
    }

    await createNotification({
      userId: req.user.id,
      type: 'course_enrolled',
      title: '🎉 Course Enrolled!',
      message: `You have successfully enrolled in "${course.title}"`,
      data: {
        courseId: course._id
      }
    });

    // Update course enrolled count
    course.enrolledCount += 1;
    await course.save();

    const populatedEnrollment = await Enrollment.findById(enrollment._id)
      .populate('courseId')
      .populate('studentId', 'name email profileImage');

    res.status(201).json({
      success: true,
      message: 'Enrolled successfully',
      enrollment: populatedEnrollment,
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get my enrollments
// @route   GET /api/enrollments/my-enrollments
export const getMyEnrollments = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = { studentId: req.user.id };
    if (status) filter.status = status;

    let enrollments = await Enrollment.find(filter)
      .populate({
        path: 'courseId',
        populate: {
          path: 'tutorId',
          populate: {
            path: 'userId',
            select: 'name profileImage',
          },
        },
      })
      .sort({ enrolledAt: -1 });

    enrollments = enrollments.filter((e) => {
      if (!e.courseId) return false;
      if (req.workspace?.type === 'private_tutor') {
        if (e.courseId.instituteId) return false;
        if (req.workspace.filterTutorId) {
          const tId = e.courseId.tutorId?._id || e.courseId.tutorId;
          return String(tId) === String(req.workspace.filterTutorId);
        }
        return true;
      }
      if (req.workspace?.type === 'institute' && req.workspace.instituteId) {
        return e.courseId.instituteId && String(e.courseId.instituteId) === String(req.workspace.instituteId);
      }
      return true;
    });

    res.status(200).json({
      success: true,
      count: enrollments.length,
      enrollments,
    });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get enrollment by course
// @route   GET /api/enrollments/course/:courseId
export const getEnrollmentByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    })
      .populate('courseId')
      .populate('studentId', 'name email profileImage');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Not enrolled in this course',
      });
    }

    res.status(200).json({
      success: true,
      enrollment,
    });
  } catch (error) {
    console.error('Get enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get students enrolled in a course (Tutor only)
// @route   GET /api/enrollments/students/:courseId
export const getCourseStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    // Check if user owns the course
    const course = await Course.findById(courseId).populate('tutorId');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (course.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view students',
      });
    }

    // ✅ FIX: Populate BOTH studentId AND courseId with nested tutorId
    const enrollments = await Enrollment.find({ courseId })
      .populate({
        path: 'studentId',
        select: 'name email phone profileImage',
        model: 'User'
      })
      .populate({
        path: 'courseId',
        model: 'Course',
        populate: {
          path: 'tutorId',
          model: 'Tutor',
          populate: {
            path: 'userId',
            model: 'User',
            select: 'name email profileImage'
          }
        }
      })
      .sort({ enrolledAt: -1 })
      .lean();

    // ✅ Filter out enrollments where data wasn't properly populated
    const validEnrollments = enrollments.filter(e => {
      const hasValidStudent = typeof e.studentId === 'object' &&
        e.studentId !== null &&
        e.studentId.name;

      const hasValidCourse = typeof e.courseId === 'object' &&
        e.courseId !== null &&
        e.courseId.title;

      const isValid = hasValidStudent && hasValidCourse;

      return isValid;
    });

    res.status(200).json({
      success: true,
      count: validEnrollments.length,
      students: validEnrollments,
    });
  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Unenroll from course
// @route   DELETE /api/enrollments/:id
export const unenrollFromCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = await Enrollment.findById(id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found',
      });
    }

    // Check if user owns this enrollment
    if (enrollment.studentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to unenroll',
      });
    }

    // Update course enrolled count
    const course = await Course.findById(enrollment.courseId);
    if (course) {
      course.enrolledCount = Math.max(0, course.enrolledCount - 1);
      await course.save();
    }

    // Delete all progress
    await Progress.deleteMany({
      studentId: req.user.id,
      courseId: enrollment.courseId,
    });

    await enrollment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Unenrolled successfully',
    });
  } catch (error) {
    console.error('Unenroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Check if enrolled in course
// @route   GET /api/enrollments/check/:courseId
export const checkEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    });

    const isEnrolled = Boolean(enrollment && ['active', 'completed'].includes(enrollment.status));

    res.status(200).json({
      success: true,
      isEnrolled,
      enrollmentStatus: enrollment?.status || null,
      enrollment: enrollment || null,
    });
  } catch (error) {
    console.error('Check enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Remove student from course (Tutor only)
// @route   DELETE /api/enrollments/tutor/:id
export const removeStudentFromCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = await Enrollment.findById(id).populate('courseId');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found',
      });
    }

    // Verify Tutor Ownership
    // enrollment.courseId is the populated Course object.

    const course = await Course.findById(enrollment.courseId._id).populate({
      path: 'tutorId',
      select: 'userId'
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check ownership
    // tutorId is populated, so we check tutorId.userId._id (or string) vs req.user.id
    // But wait, the population above selects userId from Tutor.
    // So course.tutorId is the Tutor document. course.tutorId.userId is the User ID (or object).

    // Let's rely on string comparison
    if (course.tutorId?.userId?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove student from this course'
      });
    }

    // Update course count
    course.enrolledCount = Math.max(0, course.enrolledCount - 1);
    await course.save();

    // Delete progress
    await Progress.deleteMany({
      studentId: enrollment.studentId,
      courseId: enrollment.courseId._id,
    });

    // Delete enrollment
    await enrollment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Student removed from course successfully',
    });

  } catch (error) {
    console.error('Remove student error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get all announcements for a student across all enrolled courses
// @route   GET /api/enrollments/my-announcements
// @access  Private (Student)
export const getStudentAnnouncements = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ studentId: req.user.id, status: 'active' })
      .populate({
        path: 'courseId',
        select: 'title announcements'
      })
      .populate({
        path: 'batchId',
        select: 'name announcements'
      });

    let allAnnouncements = [];

    enrollments.forEach(enrollment => {
      const course = enrollment.courseId;
      const batch = enrollment.batchId;

      // Add Course-level announcements
      if (course && course.announcements && course.announcements.length > 0) {
        course.announcements.forEach(ann => {
          allAnnouncements.push({
            id: ann._id,
            type: 'course',
            courseId: course._id,
            courseTitle: course.title,
            title: ann.title,
            message: ann.message,
            createdAt: ann.createdAt
          });
        });
      }

      // Add Batch-level announcements
      if (batch && batch.announcements && batch.announcements.length > 0) {
        batch.announcements.forEach(ann => {
          allAnnouncements.push({
            id: ann._id,
            type: 'batch',
            batchId: batch._id,
            batchName: batch.name,
            courseTitle: course?.title || 'Course',
            title: ann.title,
            message: ann.message,
            createdAt: ann.createdAt
          });
        });
      }
    });

    // Sort by most recent first
    allAnnouncements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      count: allAnnouncements.length,
      announcements: allAnnouncements
    });

  } catch (error) {
    console.error('Get student announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Approve a pending enrollment request (Tutor only)
// @route   PATCH /api/enrollments/:id/approve
export const approveEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate({ path: 'courseId', populate: { path: 'tutorId', select: 'userId' } });

    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    if (enrollment.status !== 'pending') return res.status(400).json({ success: false, message: 'Enrollment is not pending' });

    // Ownership check
    if (enrollment.courseId?.tutorId?.userId?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    enrollment.status = 'active';
    await enrollment.save();

    // Increment course enrolled count
    await Course.findByIdAndUpdate(enrollment.courseId._id, { $inc: { enrolledCount: 1 } });

    // Notify student
    await createNotification({
      userId: enrollment.studentId.toString(),
      type: 'course_enrolled',
      title: '✅ Enrollment Approved!',
      message: `Your request to join "${enrollment.courseId.title}" has been approved. You can now start learning!`,
      data: { courseId: enrollment.courseId._id }
    });

    res.status(200).json({ success: true, message: 'Enrollment approved', enrollment });
  } catch (error) {
    console.error('Approve enrollment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Reject a pending enrollment request (Tutor only)
// @route   DELETE /api/enrollments/:id/reject
// @desc    Get offline payment pending enrollments for tutor's active workspace
// @route   GET /api/enrollments/offline-pending
export const getOfflinePendingEnrollments = async (req, res) => {
  try {
    const Tutor = (await import('../models/Tutor.js')).default;
    const tutor = await Tutor.findOne({ userId: req.user._id || req.user.id }).select('_id').lean();
    if (!tutor) {
      return res.status(403).json({ success: false, message: 'Only tutors can view offline payment queues.' });
    }

    const courseFilter = { tutorId: tutor._id };
    if (req.workspace?.type === 'private_tutor') {
      courseFilter.instituteId = null;
    } else if (req.workspace?.type === 'institute' && req.workspace.instituteId) {
      courseFilter.instituteId = req.workspace.instituteId;
    }

    const tutorCourses = await Course.find(courseFilter).select('_id').lean();
    const courseIds = tutorCourses.map((c) => c._id);

    const enrollments = courseIds.length > 0
      ? await Enrollment.find({ courseId: { $in: courseIds }, status: 'pending_payment' })
          .populate('studentId', 'name email phone profileImage')
          .populate('courseId', 'title price thumbnail pricingMode instituteId')
          .sort({ createdAt: -1 })
      : [];

    res.status(200).json({
      success: true,
      count: enrollments.length,
      enrollments,
    });
  } catch (error) {
    console.error('Get offline pending enrollments error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Confirm offline fee payment and activate student enrollment (Tutor only)
// @route   PATCH /api/enrollments/:id/approve-offline
export const approveOfflinePaymentEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate({ path: 'courseId', populate: { path: 'tutorId', select: '_id userId' } });

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }
    if (enrollment.status !== 'pending_payment') {
      return res.status(400).json({ success: false, message: 'Enrollment is not awaiting offline payment confirmation' });
    }

    const ownerUserId = enrollment.courseId?.tutorId?.userId?.toString();
    if (ownerUserId !== String(req.user._id || req.user.id) && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Not authorized to approve this enrollment' });
    }

    const finalAmount = Math.max(
      0,
      Number(req.body?.paidAmount ?? enrollment.offlinePayment?.declaredAmount ?? enrollment.courseId?.price ?? 0) || 0
    );
    const offlineNote = String(req.body?.offlineNote || enrollment.offlinePayment?.note || 'Offline fee confirmed by tutor').slice(0, 500);
    const transactionRef = String(req.body?.transactionRef || enrollment.offlinePayment?.transactionRef || '').slice(0, 120);
    const isPrivateCourse = !enrollment.courseId?.instituteId;

    // Record manual audit payment excluded from withdrawable platform payouts (paymentMode: 'offline')
    const offlinePaymentRecord = await Payment.create({
      studentId: enrollment.studentId,
      courseId: enrollment.courseId._id,
      tutorId: enrollment.courseId?.tutorId?._id || enrollment.courseId?.tutorId || null,
      instituteId: enrollment.courseId?.instituteId || null,
      amount: finalAmount,
      title: `Offline Fee — ${enrollment.courseId?.title || 'Course'}`,
      currency: 'INR',
      status: 'paid',
      paidAt: new Date(),
      type: 'course_purchase',
      paymentMode: 'offline',
      settlementTarget: isPrivateCourse ? 'tutor' : 'institute',
      platformFee: 0,
      tutorEarnings: isPrivateCourse ? finalAmount : 0,
      instituteEarnings: isPrivateCourse ? 0 : finalAmount,
      transferStatus: 'not_applicable',
      isSettled: true,
      verifiedByTutorAt: new Date(),
      offlineNote,
    });

    enrollment.status = 'active';
    enrollment.paymentMode = 'offline';
    enrollment.paymentId = offlinePaymentRecord._id;
    enrollment.offlinePayment = {
      declaredAmount: finalAmount,
      note: offlineNote,
      transactionRef,
      markedPaidAt: enrollment.offlinePayment?.markedPaidAt || new Date(),
      confirmedBy: req.user._id || req.user.id,
      confirmedAt: new Date(),
    };
    await enrollment.save();

    await Course.findByIdAndUpdate(enrollment.courseId._id, { $inc: { enrolledCount: 1 } });

    await createNotification({
      userId: enrollment.studentId.toString(),
      type: 'offline_enrollment_approved',
      title: 'Offline Fee Confirmed!',
      message: `Your offline payment for "${enrollment.courseId?.title}" was confirmed. Course access is now unlocked!`,
      data: { courseId: enrollment.courseId._id, enrollmentId: enrollment._id },
    });

    res.status(200).json({
      success: true,
      message: 'Offline payment confirmed and student enrolled.',
      enrollment,
      payment: offlinePaymentRecord,
    });
  } catch (error) {
    console.error('Approve offline payment enrollment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const rejectEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate({ path: 'courseId', populate: { path: 'tutorId', select: 'userId' } });

    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    if (!['pending', 'pending_payment'].includes(enrollment.status)) {
      return res.status(400).json({ success: false, message: 'Enrollment is not pending approval' });
    }

    if (enrollment.courseId?.tutorId?.userId?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await createNotification({
      userId: enrollment.studentId.toString(),
      type: 'course_updated',
      title: '❌ Enrollment Request Declined',
      message: `Your request to join "${enrollment.courseId.title}" was not approved. Contact the tutor for more information.`,
      data: { courseId: enrollment.courseId._id },
    });

    await enrollment.deleteOne();

    res.status(200).json({ success: true, message: 'Enrollment request rejected' });
  } catch (error) {
    console.error('Reject enrollment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
