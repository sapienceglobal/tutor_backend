import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getForUser as getEntitlementsForUser } from './entitlementService.js';
import { evaluateAccess } from './accessPolicy.js';

let io = null;

// Track active socket connections by user ID
// Map: userId -> Set of socketIds
const activeConnections = new Map();

// Track active exam sessions by student ID
// Map: studentId -> { socketId, examId, startTime }
const activeExamSessions = new Map();

const notifyTutorStudentLeft = async (examId, studentId) => {
  try {
    const { Exam } = await import('../models/Exam.js');
    const exam = await Exam.findById(examId).populate({
      path: 'courseId',
      populate: { path: 'tutorId' }
    });
    
    if (exam && exam.courseId && exam.courseId.tutorId) {
      const tutorUserId = exam.courseId.tutorId.userId;
      if (tutorUserId && io) {
        console.log(`🔌 Emitting student_left_exam to tutor user_${tutorUserId} for student ${studentId}`);
        io.to(`user_${tutorUserId}`).emit('student_left_exam', {
          studentId: studentId.toString(),
          examId: examId.toString()
        });
      }
    }
  } catch (err) {
    console.error('Failed to notify tutor student left:', err);
  }
};

const notifyTutorStudentJoined = async (examId, studentId, sessionData) => {
  try {
    const { Exam } = await import('../models/Exam.js');
    
    const exam = await Exam.findById(examId).populate({
      path: 'courseId',
      populate: { path: 'tutorId' }
    });
    
    if (exam && exam.courseId && exam.courseId.tutorId) {
      const tutorUserId = exam.courseId.tutorId.userId;
      if (tutorUserId && io) {
        const student = await User.findById(studentId).select('name email profileImage').lean();
        
        const payload = {
          studentId: studentId.toString(),
          socketId: sessionData.socketId,
          examId: examId.toString(),
          studentName: student?.name || 'Student',
          studentEmail: student?.email || '',
          studentAvatar: student?.profileImage || null,
          examTitle: exam.title || 'Unknown Exam',
          examDuration: exam.duration || 0,
          startTime: sessionData.startTime,
          elapsedSeconds: 0
        };

        console.log(`🔌 Emitting student_joined_exam to tutor user_${tutorUserId} for student ${studentId}`);
        io.to(`user_${tutorUserId}`).emit('student_joined_exam', payload);
      }
    }
  } catch (err) {
    console.error('Failed to notify tutor student joined:', err);
  }
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://195.35.20.207:5000').split(','),
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded || !decoded.id) {
        return next(new Error('Authentication error: Invalid token'));
      }

      const user = await User.findById(decoded.id).select('_id role instituteId isBlocked');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (user.isBlocked) {
        return next(new Error('Authentication error: Account is blocked'));
      }

      // Attach user details to socket
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userInstituteId = user.instituteId || null;
      next();
    } catch (err) {
      console.error('Socket authentication error:', err);
      return next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`🔌 Socket connected: User ${userId} (${socket.userRole}) on socket ${socket.id}`);

    // Track active connection
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId).add(socket.id);

    // Join a private room for this user
    socket.join(`user_${userId}`);

    // Join role-specific rooms
    if (socket.userRole === 'superadmin') {
      socket.join('role_superadmin');
      console.log(`🔌 Superadmin connected. Joined role_superadmin room.`);
    }

    // Handle joining exam attempt (Device Session Lock-in)
    socket.on('join_exam_attempt', async ({ examId, attemptId }) => {
      console.log(`✍️ User ${userId} requesting to join exam ${examId}`);

      // SECURITY: Only students can join exams
      if (socket.userRole !== 'student') {
        socket.emit('exam_error', { message: 'Only students can join exam sessions' });
        return;
      }

      // SECURITY: Verify the exam exists and is valid
      try {
        const { Exam, ExamAttempt } = await import('../models/Exam.js');
        const exam = await Exam.findById(examId);
        if (!exam) {
          socket.emit('exam_error', {
            message: 'Active exam not found. Verify start status.'
          });
          return;
        }
        
        if (exam.status !== 'published') {
          socket.emit('exam_error', {
            message: 'Active exam not found. Verify start status.'
          });
          return;
        }

        const entitlements = await getEntitlementsForUser({
          _id: userId,
          role: socket.userRole,
          instituteId: socket.userInstituteId
        });

        const accessDecision = evaluateAccess({
          resource: exam,
          entitlements,
          requireEnrollment: !exam.isFree,
          requirePayment: !exam.isFree,
          isFree: exam.isFree,
          courseId: exam.courseId,
        });

        if (!accessDecision.allowed) {
          socket.emit('exam_error', {
            message: 'You are not authorized to join this exam session'
          });
          return;
        }

        if (attemptId) {
          const attempt = await ExamAttempt.findOne({
            _id: attemptId,
            examId: exam._id,
            studentId: userId
          }).select('_id');

          if (!attempt) {
            socket.emit('exam_error', {
              message: 'Invalid exam attempt for this student'
            });
            return;
          }
        }

        // Check if there is already another active socket for this student on ANY exam
        const existingSession = activeExamSessions.get(userId);
        
        if (existingSession && existingSession.socketId !== socket.id) {
          // Block the NEW connection (current socket) to keep the original active
          socket.emit('multiple_devices_detected', {
            message: 'Another active session of this exam was detected on a different device or tab. This instance has been blocked to maintain exam integrity.'
          });
          
          // Also send a warning to the OLD connection to alert them
          io.to(existingSession.socketId).emit('exam_session_warning', {
            message: 'A secondary login attempt was made. We blocked it to protect your ongoing exam session.'
          });
        } else {
          // Register this socket as the active exam session
          const sessionData = {
            socketId: socket.id,
            examId: exam._id.toString(),
            attemptId: attemptId || null,
            startTime: Date.now()
          };
          activeExamSessions.set(userId, sessionData);
          socket.join(`exam_${exam._id}`);
          
          // Notify tutor of joined student in real time
          notifyTutorStudentJoined(exam._id, userId, sessionData);
        }
      } catch (err) {
        console.error('join_exam_attempt error during verification:', err);
        socket.emit('exam_error', { message: 'Failed to verify exam attempt' });
      }
    });

    // Handle leaving exam session explicitly (e.g. on submit or exit)
    socket.on('leave_exam_attempt', () => {
      if (activeExamSessions.has(userId) && activeExamSessions.get(userId).socketId === socket.id) {
        console.log(`🚪 Student ${userId} left the exam room.`);
        const session = activeExamSessions.get(userId);
        activeExamSessions.delete(userId);
        notifyTutorStudentLeft(session.examId, userId);
      }
    });

    // Handle real-time proctoring event (e.g. face detection deviation, voice trigger)
    socket.on('proctoring_event', async (eventData) => {
      // SECURITY: Only students with an active exam session can send proctoring events
      if (socket.userRole !== 'student') {
        return; // Silently ignore non-student events
      }

      const activeSession = activeExamSessions.get(userId);
      if (!activeSession || activeSession.socketId !== socket.id) {
        return; // Silently ignore events from non-active exam sessions
      }

      // Ensure the examId in the event matches the active session
      if (eventData.examId && eventData.examId !== activeSession.examId) {
        return; // Ignore events for different exams
      }

      console.log(`🚨 Proctoring event from student ${userId}:`, eventData);
      
      // eventData contains: { examId, eventType, severity, details }
      try {
        const { Exam } = await import('../models/Exam.js');
        const exam = await Exam.findById(activeSession.examId).populate({
          path: 'courseId',
          populate: { path: 'tutorId' }
        });
        
        if (exam && exam.courseId && exam.courseId.tutorId) {
          const tutorUserId = exam.courseId.tutorId.userId;
          if (tutorUserId) {
            emitProctoringAlert(tutorUserId.toString(), {
              attemptId: activeSession.attemptId || eventData.attemptId || null,
              studentId: userId.toString(),
              examId: activeSession.examId,
              studentName: socket.handshake.auth.userName || 'Student',
              examTitle: exam.title,
              eventType: eventData.eventType,
              severity: eventData.severity,
              details: eventData.details,
              timestamp: new Date()
            });
          }
        }
      } catch (err) {
        console.error('Failed to forward real-time proctoring alert:', err);
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: User ${userId} on socket ${socket.id}`);
      
      // Remove from active connections
      if (activeConnections.has(userId)) {
        activeConnections.get(userId).delete(socket.id);
        if (activeConnections.get(userId).size === 0) {
          activeConnections.delete(userId);
        }
      }

      // If this was the active exam socket, remove it
      if (activeExamSessions.has(userId) && activeExamSessions.get(userId).socketId === socket.id) {
        console.log(`🚪 Student ${userId} exam session disconnected.`);
        const session = activeExamSessions.get(userId);
        activeExamSessions.delete(userId);
        notifyTutorStudentLeft(session.examId, userId);
      }
    });
  });

  return io;
};

// Relays chat message in real-time to the recipient's user room
export const emitChatMessage = (recipientUserId, message) => {
  if (!io) return;
  console.log(`💬 Emitting message via WebSockets to user_${recipientUserId}`);
  io.to(`user_${recipientUserId}`).emit('chat_message', message);
};

// Relays notifications in real-time to the recipient's user room
export const emitNotification = (recipientUserId, notification) => {
  if (!io) return;
  console.log(`🔔 Emitting notification via WebSockets to user_${recipientUserId}`);
  io.to(`user_${recipientUserId}`).emit('notification', notification);
};

// Relays real-time proctoring alerts to a tutor or admin
export const emitProctoringAlert = (tutorUserId, alertData) => {
  if (!io) return;
  console.log(`🚨 Emitting proctoring alert via WebSockets to tutor user_${tutorUserId}`);
  io.to(`user_${tutorUserId}`).emit('proctoring_alert', alertData);
};

// Relays audit logs in real-time to all connected superadmins
export const emitAuditLogCreated = (auditLog) => {
  if (!io) return;
  console.log(`🛡️ Emitting audit log via WebSockets to role_superadmin`);
  io.to('role_superadmin').emit('audit_log_created', auditLog);
};

// Relays abuse reports in real-time to all connected superadmins
export const emitReportCreated = (report) => {
  if (!io) return;
  console.log(`🚨 Emitting report created via WebSockets to role_superadmin`);
  io.to('role_superadmin').emit('report_created', report);
};

// Relays report status changes in real-time to all connected superadmins
export const emitReportStatusChanged = (report) => {
  if (!io) return;
  console.log(`🚨 Emitting report status change via WebSockets to role_superadmin`);
  io.to('role_superadmin').emit('report_status_changed', report);
};

// Relays live class updates/status changes in real-time to all connected superadmins
export const emitLiveClassStatusChange = (eventData) => {
  if (!io) return;
  console.log(`📡 Emitting live class status change via WebSockets to role_superadmin`);
  io.to('role_superadmin').emit('live_class_status_change', eventData);
};

export const getIO = () => io;

// Returns a list of all currently active exam attempt sessions
export const getActiveSessions = () => {
  const sessions = [];
  for (const [studentId, session] of activeExamSessions.entries()) {
    sessions.push({
      studentId,
      socketId: session.socketId,
      examId: session.examId,
      startTime: session.startTime
    });
  }
  return sessions;
};
