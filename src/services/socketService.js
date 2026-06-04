import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

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

      const user = await User.findById(decoded.id).select('_id role isBlocked');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (user.isBlocked) {
        return next(new Error('Authentication error: Account is blocked'));
      }

      // Attach user details to socket
      socket.userId = user._id.toString();
      socket.userRole = user.role;
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
    socket.on('join_exam_attempt', ({ examId }) => {
      console.log(`✍️ User ${userId} joining exam ${examId}`);
      
      // Check if there is already another active socket for this student on ANY exam
      const existingSession = activeExamSessions.get(userId);
      
      if (existingSession && existingSession.socketId !== socket.id) {
        console.log(`🚨 Multi-device login attempt by Student ${userId} on exam ${examId}`);
        
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
        activeExamSessions.set(userId, {
          socketId: socket.id,
          examId,
          startTime: Date.now()
        });
        socket.join(`exam_${examId}`);
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
      console.log(`🚨 Proctoring event from student ${userId}:`, eventData);
      
      // eventData contains: { examId, eventType, severity, details }
      try {
        const { Exam } = await import('../models/Exam.js');
        const exam = await Exam.findById(eventData.examId).populate({
          path: 'courseId',
          populate: { path: 'tutorId' }
        });
        
        if (exam && exam.courseId && exam.courseId.tutorId) {
          const tutorUserId = exam.courseId.tutorId.userId;
          if (tutorUserId) {
            emitProctoringAlert(tutorUserId.toString(), {
              attemptId: eventData.attemptId || null,
              studentId: userId.toString(),
              examId: eventData.examId,
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
