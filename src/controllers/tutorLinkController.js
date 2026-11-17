import mongoose from 'mongoose';
import TutorStudentLink from '../models/TutorStudentLink.js';
import Tutor from '../models/Tutor.js';
import User from '../models/User.js';
import { checkPrivateStudentQuota } from '../middleware/subscriptionMiddleware.js';
import {
  normalizeIdList,
  parseSubjectsList,
  dispatchTutorLinkRequestAlerts,
  dispatchTutorLinkDecisionAlerts,
} from '../services/admissionService.js';

const syncTutorStudentsCount = async (tutorId) => {
  if (!tutorId) return;
  const activeCount = await TutorStudentLink.countDocuments({ tutorId, status: 'active' });
  await Tutor.findByIdAndUpdate(tutorId, { studentsCount: activeCount });
};

/**
 * @desc    Student requests to connect with one or more Private Tutors (e.g. Bio + Maths + Hindi)
 * @route   POST /api/tutor-links/request
 * @access  Private (Student)
 */
export const requestTutorLink = async (req, res) => {
  try {
    const { tutorId, tutorIds, requestMessage, subjects } = req.body;
    const studentId = req.user.id || req.user._id;

    const requestedIds = normalizeIdList(tutorIds || tutorId);
    if (requestedIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one valid tutorId is required',
      });
    }

    const tutors = await Tutor.find({ _id: { $in: requestedIds } })
      .populate('userId', 'name email profileImage isBlocked')
      .lean();

    if (tutors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching tutors found',
      });
    }

    const parsedSubjects = parseSubjectsList(subjects);
    const cleanMessage = String(requestMessage || '').trim().slice(0, 500);
    const createdOrReopened = [];
    const skipped = [];

    for (const tutorDoc of tutors) {
      if (!tutorDoc.userId || tutorDoc.userId.isBlocked) {
        skipped.push({ tutorId: tutorDoc._id, reason: 'Tutor unavailable' });
        continue;
      }
      if (String(tutorDoc.userId._id) === String(studentId)) {
        skipped.push({ tutorId: tutorDoc._id, reason: 'Cannot connect to your own tutor profile' });
        continue;
      }
      if (tutorDoc.privateTeaching?.isEnabled === false || tutorDoc.privateTeaching?.acceptSelfJoinRequests === false) {
        skipped.push({ tutorId: tutorDoc._id, reason: 'Tutor is not accepting private join requests right now' });
        continue;
      }

      const existing = await TutorStudentLink.findOne({ tutorId: tutorDoc._id, studentId });
      if (existing) {
        if (existing.status === 'active') {
          skipped.push({ tutorId: tutorDoc._id, reason: 'Already connected to this tutor' });
          continue;
        }
        if (existing.status === 'pending') {
          skipped.push({ tutorId: tutorDoc._id, reason: 'Join request already pending' });
          continue;
        }
        // Re-open rejected/suspended request
        existing.status = 'pending';
        existing.initiatedBy = 'student';
        existing.requestMessage = cleanMessage;
        if (parsedSubjects.length > 0) existing.subjects = parsedSubjects;
        existing.rejectedAt = null;
        existing.rejectionReason = '';
        await existing.save();
        createdOrReopened.push({ link: existing, tutorDoc });
      } else {
        const link = await TutorStudentLink.create({
          tutorId: tutorDoc._id,
          tutorUserId: tutorDoc.userId._id,
          studentId,
          status: 'pending',
          initiatedBy: 'student',
          requestMessage: cleanMessage,
          subjects: parsedSubjects.length > 0 ? parsedSubjects : (tutorDoc.subjects || []).slice(0, 5),
        });
        createdOrReopened.push({ link, tutorDoc });
      }
    }

    if (createdOrReopened.length === 0) {
      return res.status(400).json({
        success: false,
        message: skipped[0]?.reason || 'No tutor requests could be submitted',
        skipped,
      });
    }

    Promise.allSettled(
      createdOrReopened.map(({ link, tutorDoc }) =>
        dispatchTutorLinkRequestAlerts({
          link,
          tutorDoc,
          tutorUser: tutorDoc.userId,
          studentUser: req.user,
        })
      )
    ).catch((err) => console.warn('Tutor link request alert warning:', err?.message || err));

    return res.status(201).json({
      success: true,
      message: `${createdOrReopened.length} tutor join request(s) submitted successfully`,
      links: createdOrReopened.map((item) => item.link),
      skipped,
    });
  } catch (error) {
    console.error('Request tutor link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit tutor join request',
    });
  }
};

/**
 * @desc    Student gets all their connected, pending, and rejected Private Tutors
 * @route   GET /api/tutor-links/my-tutors
 * @access  Private (Student)
 */
export const getMyTutorLinks = async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    const { status } = req.query;

    const query = { studentId };
    if (status && ['pending', 'active', 'rejected', 'suspended'].includes(status)) {
      query.status = status;
    }

    const links = await TutorStudentLink.find(query)
      .populate('tutorId', 'subjects bio title rating experience hourlyRate privateTeaching payoutAccount.verificationStatus')
      .populate('tutorUserId', 'name profileImage')
      .sort({ approvedAt: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      links,
      activeTutors: links.filter((l) => l.status === 'active'),
      pendingTutors: links.filter((l) => l.status === 'pending'),
      rejectedTutors: links.filter((l) => l.status === 'rejected'),
    });
  } catch (error) {
    console.error('Get my tutor links error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load private tutor connections',
    });
  }
};

/**
 * @desc    Student cancels a pending request or disconnects an active Private Tutor link
 * @route   DELETE /api/tutor-links/:linkId
 * @access  Private (Student or Tutor owner)
 */
export const cancelOrLeaveTutorLink = async (req, res) => {
  try {
    const { linkId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(linkId)) {
      return res.status(400).json({ success: false, message: 'Invalid linkId' });
    }

    const link = await TutorStudentLink.findById(linkId);
    if (!link) {
      return res.status(404).json({ success: false, message: 'Tutor link not found' });
    }

    const userId = String(req.user.id || req.user._id);
    const isOwnerStudent = String(link.studentId) === userId;
    const isOwnerTutor = String(link.tutorUserId) === userId;

    if (!isOwnerStudent && !isOwnerTutor && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const tutorId = link.tutorId;
    await TutorStudentLink.findByIdAndDelete(linkId);
    await syncTutorStudentsCount(tutorId);

    return res.status(200).json({
      success: true,
      message: 'Private tutor connection removed successfully',
    });
  } catch (error) {
    console.error('Delete tutor link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove tutor link',
    });
  }
};

/**
 * @desc    Tutor views pending requests or active private students
 * @route   GET /api/tutor-links/requests (or /students)
 * @access  Private (Tutor)
 */
export const getTutorStudentRequests = async (req, res) => {
  try {
    const tutorUserId = req.user.id || req.user._id;
    const defaultStatus = req.path.endsWith('/students') ? 'active' : 'pending';
    const status = req.query?.status || defaultStatus;

    const query = { tutorUserId };
    if (status !== 'all' && ['pending', 'active', 'rejected', 'suspended'].includes(status)) {
      query.status = status;
    }

    const links = await TutorStudentLink.find(query)
      .populate('studentId', 'name email phone profileImage isVerified grade')
      .sort({ createdAt: -1 })
      .lean();

    const quota = await checkPrivateStudentQuota(tutorUserId);

    return res.status(200).json({
      success: true,
      links,
      quota,
    });
  } catch (error) {
    console.error('Get tutor student requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load private student requests',
    });
  }
};

/**
 * @desc    Tutor approves a pending student request (enforces Free/Pro maxPrivateStudents limit)
 * @route   PUT /api/tutor-links/:linkId/approve
 * @access  Private (Tutor)
 */
export const approveTutorStudentLink = async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await TutorStudentLink.findById(linkId);

    if (!link) {
      return res.status(404).json({ success: false, message: 'Join request not found' });
    }

    const actorId = String(req.user.id || req.user._id);
    if (req.user.role !== 'superadmin' && String(link.tutorUserId) !== actorId) {
      return res.status(403).json({ success: false, message: 'Only the target tutor can approve this request' });
    }

    if (link.status === 'active') {
      return res.status(200).json({ success: true, message: 'Student is already connected', link });
    }

    const quota = await checkPrivateStudentQuota(link.tutorUserId);
    if (!quota.allowed) {
      return res.status(403).json({
        success: false,
        upgradeRequired: true,
        currentCount: quota.currentCount,
        maxAllowed: quota.maxAllowed,
        message: `Private student limit reached (${quota.currentCount}/${quota.maxAllowed}). Upgrade your Tutor plan to approve more private students.`,
      });
    }

    await link.approve();
    await syncTutorStudentsCount(link.tutorId);

    const [studentUser, tutorDoc] = await Promise.all([
      User.findById(link.studentId).select('name email isVerified'),
      Tutor.findById(link.tutorId).select('title'),
    ]);

    if (studentUser && !studentUser.isVerified) {
      studentUser.isVerified = true;
      await studentUser.save();
    }

    if (studentUser) {
      dispatchTutorLinkDecisionAlerts({
        link,
        tutorDoc,
        tutorUser: req.user,
        studentUser,
        decision: 'approved',
      }).catch((err) => console.warn('Tutor approval alert warning:', err?.message || err));
    }

    return res.status(200).json({
      success: true,
      message: 'Private student request approved',
      link,
    });
  } catch (error) {
    console.error('Approve tutor link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve student request',
    });
  }
};

/**
 * @desc    Tutor rejects a pending student request
 * @route   PUT /api/tutor-links/:linkId/reject
 * @access  Private (Tutor)
 */
export const rejectTutorStudentLink = async (req, res) => {
  try {
    const { linkId } = req.params;
    const reason = String(req.body?.reason || '').trim();
    const link = await TutorStudentLink.findById(linkId);

    if (!link) {
      return res.status(404).json({ success: false, message: 'Join request not found' });
    }

    const actorId = String(req.user.id || req.user._id);
    if (req.user.role !== 'superadmin' && String(link.tutorUserId) !== actorId) {
      return res.status(403).json({ success: false, message: 'Only the target tutor can reject this request' });
    }

    await link.reject(reason);
    await syncTutorStudentsCount(link.tutorId);

    const [studentUser, tutorDoc] = await Promise.all([
      User.findById(link.studentId).select('name email').lean(),
      Tutor.findById(link.tutorId).select('title').lean(),
    ]);

    if (studentUser) {
      dispatchTutorLinkDecisionAlerts({
        link,
        tutorDoc,
        tutorUser: req.user,
        studentUser,
        decision: 'rejected',
        reason,
      }).catch((err) => console.warn('Tutor rejection alert warning:', err?.message || err));
    }

    return res.status(200).json({
      success: true,
      message: 'Private student request rejected',
      link,
    });
  } catch (error) {
    console.error('Reject tutor link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject student request',
    });
  }
};

/**
 * @desc    Tutor suspends an active private student link
 * @route   PUT /api/tutor-links/:linkId/suspend
 * @access  Private (Tutor)
 */
export const suspendTutorStudentLink = async (req, res) => {
  try {
    const { linkId } = req.params;
    const reason = String(req.body?.reason || '').trim();
    const link = await TutorStudentLink.findById(linkId);

    if (!link) {
      return res.status(404).json({ success: false, message: 'Tutor link not found' });
    }

    const actorId = String(req.user.id || req.user._id);
    if (req.user.role !== 'superadmin' && String(link.tutorUserId) !== actorId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await link.suspend(reason);
    await syncTutorStudentsCount(link.tutorId);

    return res.status(200).json({
      success: true,
      message: 'Student access to your private studio suspended',
      link,
    });
  } catch (error) {
    console.error('Suspend tutor link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to suspend private student',
    });
  }
};

/**
 * @desc    Tutor directly adds an existing student by email to Private Studio
 * @route   POST /api/tutor-links/add-student
 * @access  Private (Tutor)
 */
export const addPrivateStudentByEmail = async (req, res) => {
  try {
    const { email, subjects, requestMessage } = req.body;
    const tutorUserId = req.user.id || req.user._id;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Student email is required' });
    }

    const [tutorDoc, studentUser] = await Promise.all([
      Tutor.findOne({ userId: tutorUserId }),
      User.findOne({ email: String(email).toLowerCase().trim() }),
    ]);

    if (!tutorDoc) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }
    if (!studentUser || studentUser.role !== 'student') {
      return res.status(404).json({ success: false, message: 'No registered student found with that email' });
    }

    const quota = await checkPrivateStudentQuota(tutorUserId);
    if (!quota.allowed) {
      return res.status(403).json({
        success: false,
        upgradeRequired: true,
        currentCount: quota.currentCount,
        maxAllowed: quota.maxAllowed,
        message: `Private student limit reached (${quota.currentCount}/${quota.maxAllowed}). Upgrade your Tutor plan to add more students.`,
      });
    }

    const parsedSubjects = parseSubjectsList(subjects);
    let link = await TutorStudentLink.findOne({ tutorId: tutorDoc._id, studentId: studentUser._id });

    if (link && link.status === 'active') {
      return res.status(400).json({ success: false, message: 'Student is already connected to your Private Studio' });
    }

    if (link) {
      link.status = 'active';
      link.initiatedBy = 'tutor';
      link.approvedAt = new Date();
      link.rejectedAt = null;
      link.rejectionReason = '';
      if (parsedSubjects.length > 0) link.subjects = parsedSubjects;
      await link.save();
    } else {
      link = await TutorStudentLink.create({
        tutorId: tutorDoc._id,
        tutorUserId,
        studentId: studentUser._id,
        status: 'active',
        initiatedBy: 'tutor',
        approvedAt: new Date(),
        requestMessage: String(requestMessage || '').trim().slice(0, 500),
        subjects: parsedSubjects.length > 0 ? parsedSubjects : (tutorDoc.subjects || []).slice(0, 5),
      });
    }

    await syncTutorStudentsCount(tutorDoc._id);

    if (!studentUser.isVerified) {
      studentUser.isVerified = true;
      await studentUser.save();
    }

    dispatchTutorLinkDecisionAlerts({
      link,
      tutorDoc,
      tutorUser: req.user,
      studentUser,
      decision: 'approved',
    }).catch((err) => console.warn('Direct private add alert warning:', err?.message || err));

    return res.status(201).json({
      success: true,
      message: `${studentUser.name} added to your Private Studio`,
      link,
    });
  } catch (error) {
    console.error('Add private student error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add student to Private Studio',
    });
  }
};

