import Tutor from '../models/Tutor.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import TutorMessage from '../models/TutorMessage.js';
import { createNotification } from './notificationController.js';

const getUserIdFromReq = (req) => req.user?._id || req.user?.id;

const resolveActor = async (req) => {
  const role = req.user?.role;
  const userId = getUserIdFromReq(req);
  if (!role || !userId) return null;

  if (role === 'tutor') {
    const tutor = await Tutor.findOne({ userId }).select('_id userId').lean();
    if (!tutor) return null;
    return {
      role,
      userId,
      tutorId: tutor._id,
      tutorUserId: tutor.userId,
    };
  }

  if (role === 'student') {
    return {
      role,
      userId,
      studentId: userId,
    };
  }

  return null;
};

const resolveTutorStudentRelation = async ({ tutorId, studentId, courseId = null }) => {
  if (!tutorId || !studentId) {
    return { ok: false, message: 'Invalid tutor/student relation' };
  }

  const courseFilter = { tutorId };
  if (courseId) courseFilter._id = courseId;

  const tutorCourses = await Course.find(courseFilter).select('_id title').lean();
  if (tutorCourses.length === 0) {
    return { ok: false, message: 'Course not found for this tutor' };
  }

  const tutorCourseIds = tutorCourses.map((course) => course._id);
  const enrollment = await Enrollment.findOne({
    studentId,
    courseId: { $in: tutorCourseIds },
    status: { $in: ['active', 'completed'] },
  })
    .sort({ enrolledAt: -1 })
    .lean();

  if (!enrollment) {
    return {
      ok: false,
      message: 'Messaging allowed only with enrolled students',
    };
  }

  const selectedCourse = tutorCourses.find(
    (course) => course._id.toString() === enrollment.courseId.toString()
  ) || tutorCourses[0];

  return {
    ok: true,
    courseId: selectedCourse?._id || enrollment.courseId,
    courseTitle: selectedCourse?.title || '',
  };
};

const mapMessageForResponse = (message, actorUserId) => {
  const senderUserId = message.senderUserId?._id || message.senderUserId;
  const isOwn = senderUserId?.toString() === actorUserId.toString();

  return {
    _id: message._id,
    body: message.body,
    senderRole: message.senderRole,
    senderUserId,
    sentAt: message.sentAt || message.createdAt,
    readByRecipient: message.readByRecipient,
    isOwn,
    course: message.courseId
      ? { _id: message.courseId._id || message.courseId, title: message.courseId.title || '' }
      : null,
  };
};

// @desc    Get messaging conversations for current user (tutor/student)
// @route   GET /api/messages/conversations
export const getConversations = async (req, res) => {
  try {
    const actor = await resolveActor(req);
    if (!actor) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const search = String(req.query.search || '').trim().toLowerCase();
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));

    const baseFilter = actor.role === 'tutor'
      ? { tutorId: actor.tutorId }
      : { studentId: actor.studentId };

    const messageDocs = await TutorMessage.find(baseFilter)
      .sort({ sentAt: -1, createdAt: -1 })
      .limit(1200)
      .populate('studentId', 'name email profileImage')
      .populate({ path: 'tutorId', populate: { path: 'userId', select: 'name email profileImage' } })
      .populate('courseId', 'title')
      .lean();

    const convoMap = new Map();

    messageDocs.forEach((message) => {
      const isTutorActor = actor.role === 'tutor';
      const counterpartId = isTutorActor
        ? (message.studentId?._id?.toString() || message.studentId?.toString())
        : (message.tutorId?._id?.toString() || message.tutorId?.toString());

      if (!counterpartId) return;

      if (!convoMap.has(counterpartId)) {
        const counterpart = isTutorActor
          ? {
              _id: message.studentId?._id || message.studentId,
              name: message.studentId?.name || 'Student',
              email: message.studentId?.email || '',
              profileImage: message.studentId?.profileImage || null,
              role: 'student',
            }
          : {
              _id: message.tutorId?._id || message.tutorId,
              name: message.tutorId?.userId?.name || 'Tutor',
              email: message.tutorId?.userId?.email || '',
              profileImage: message.tutorId?.userId?.profileImage || null,
              role: 'tutor',
            };

        convoMap.set(counterpartId, {
          counterpartId,
          counterpart,
          lastMessage: mapMessageForResponse(message, actor.userId),
          unreadCount: 0,
          messageCount: 0,
          course: message.courseId
            ? { _id: message.courseId._id || message.courseId, title: message.courseId.title || '' }
            : null,
        });
      }

      const convo = convoMap.get(counterpartId);
      convo.messageCount += 1;
      if (!message.readByRecipient && message.senderRole !== actor.role) {
        convo.unreadCount += 1;
      }
    });

    let conversations = Array.from(convoMap.values());

    if (search) {
      conversations = conversations.filter((convo) =>
        String(convo.counterpart?.name || '').toLowerCase().includes(search)
        || String(convo.counterpart?.email || '').toLowerCase().includes(search)
        || String(convo.course?.title || '').toLowerCase().includes(search)
      );
    }

    conversations = conversations
      .sort((a, b) => new Date(b.lastMessage.sentAt) - new Date(a.lastMessage.sentAt))
      .slice(0, limit);

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load conversations' });
  }
};

// @desc    Get one conversation messages
// @route   GET /api/messages/conversations/:partnerId
export const getConversationMessages = async (req, res) => {
  try {
    const actor = await resolveActor(req);
    if (!actor) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { partnerId } = req.params;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(20, Number(req.query.limit || 80)));

    const filter = actor.role === 'tutor'
      ? { tutorId: actor.tutorId, studentId: partnerId }
      : { studentId: actor.studentId, tutorId: partnerId };

    const messages = await TutorMessage.find(filter)
      .sort({ sentAt: 1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('courseId', 'title')
      .populate('senderUserId', 'name email profileImage')
      .lean();

    const total = await TutorMessage.countDocuments(filter);

    return res.status(200).json({
      success: true,
      messages: messages.map((message) => mapMessageForResponse(message, actor.userId)),
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load messages' });
  }
};

// @desc    Send direct message
// @route   POST /api/messages
export const sendMessage = async (req, res) => {
  try {
    const actor = await resolveActor(req);
    if (!actor) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const partnerId = String(req.body.partnerId || '').trim();
    const body = String(req.body.body || '').trim();
    const courseId = req.body.courseId || null;

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'partnerId is required' });
    }
    if (!body) {
      return res.status(400).json({ success: false, message: 'Message body is required' });
    }

    let tutorId;
    let studentId;
    let recipientUserId;
    let relation;

    if (actor.role === 'tutor') {
      tutorId = actor.tutorId;
      studentId = partnerId;

      const studentUser = await User.findById(studentId).select('_id name email').lean();
      if (!studentUser) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }

      relation = await resolveTutorStudentRelation({ tutorId, studentId, courseId });
      if (!relation.ok) {
        return res.status(403).json({ success: false, message: relation.message });
      }

      recipientUserId = studentUser._id;
    } else {
      studentId = actor.studentId;
      tutorId = partnerId;

      const tutor = await Tutor.findById(tutorId).select('_id userId').lean();
      if (!tutor) {
        return res.status(404).json({ success: false, message: 'Tutor not found' });
      }

      relation = await resolveTutorStudentRelation({ tutorId: tutor._id, studentId, courseId });
      if (!relation.ok) {
        return res.status(403).json({ success: false, message: relation.message });
      }

      recipientUserId = tutor.userId;
      tutorId = tutor._id;
    }

    const message = await TutorMessage.create({
      tutorId,
      studentId,
      courseId: relation.courseId || courseId || null,
      senderRole: actor.role,
      senderUserId: actor.userId,
      body,
      readByRecipient: false,
      sentAt: new Date(),
    });

    await createNotification({
      userId: recipientUserId,
      type: 'direct_message',
      title: actor.role === 'tutor' ? 'New message from your tutor' : 'New message from a student',
      message: body.length > 120 ? `${body.slice(0, 117)}...` : body,
      data: {
        courseId: relation.courseId || null,
        extras: {
          channel: 'direct_message',
          tutorId: String(tutorId),
          studentId: String(studentId),
        },
      },
    });

    const populatedMessage = await TutorMessage.findById(message._id)
      .populate('courseId', 'title')
      .populate('senderUserId', 'name email profileImage')
      .lean();

    return res.status(201).json({
      success: true,
      message: mapMessageForResponse(populatedMessage, actor.userId),
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// @desc    Mark incoming conversation messages as read
// @route   PATCH /api/messages/conversations/:partnerId/read
export const markConversationAsRead = async (req, res) => {
  try {
    const actor = await resolveActor(req);
    if (!actor) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { partnerId } = req.params;

    const filter = actor.role === 'tutor'
      ? {
          tutorId: actor.tutorId,
          studentId: partnerId,
          senderRole: 'student',
          readByRecipient: false,
        }
      : {
          studentId: actor.studentId,
          tutorId: partnerId,
          senderRole: 'tutor',
          readByRecipient: false,
        };

    const update = await TutorMessage.updateMany(filter, {
      $set: { readByRecipient: true },
    });

    return res.status(200).json({
      success: true,
      updated: update.modifiedCount || 0,
    });
  } catch (error) {
    console.error('Mark conversation read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark messages as read' });
  }
};
