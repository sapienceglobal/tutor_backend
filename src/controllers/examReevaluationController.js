import mongoose from 'mongoose';
import { Exam, ExamAttempt } from '../models/Exam.js';
import Tutor from '../models/Tutor.js';
import User from '../models/User.js';
import ExamReevaluationRequest from '../models/ExamReevaluationRequest.js';
import { evaluatePass } from '../utils/examScoring.js';
import { createNotification } from './notificationController.js';

const toObjectId = (value) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const safeStatus = (value) => {
  if (value === 'pending' || value === 'approved' || value === 'rejected') return value;
  return null;
};

const getTutorProfileByUserId = async (userId) => {
  return Tutor.findOne({ userId }).select('_id userId');
};

const buildPagedResponse = async ({
  model,
  filter,
  page,
  limit,
  populate = [],
  sort = { createdAt: -1 },
}) => {
  const [items, total] = await Promise.all([
    model.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(populate),
    model.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

// @desc    Student creates re-evaluation request for an attempt
// @route   POST /api/student/exams/attempt/:attemptId/re-evaluation-request
// @access  Private (Student)
export const createReevaluationRequest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const reasonRaw = typeof req.body?.reason === 'string' ? req.body.reason : '';
    const reason = reasonRaw.trim();

    if (!reason || reason.length < 15) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a clear reason with at least 15 characters',
      });
    }

    const attempt = await ExamAttempt.findById(attemptId).populate('examId', 'title totalMarks passingMarks passingPercentage tutorId courseId');
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Exam attempt not found' });
    }

    if (String(attempt.studentId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You can only request re-evaluation for your own attempts' });
    }

    const existing = await ExamReevaluationRequest.findOne({ attemptId: attempt._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Re-evaluation request already exists for this attempt',
        request: existing,
      });
    }

    const exam = attempt.examId;
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Associated exam not found' });
    }

    const tutorProfile = await Tutor.findById(exam.tutorId).select('_id userId');
    if (!tutorProfile) {
      return res.status(400).json({ success: false, message: 'Tutor profile not found for this exam' });
    }

    const request = await ExamReevaluationRequest.create({
      attemptId: attempt._id,
      examId: exam._id,
      courseId: attempt.courseId || exam.courseId || null,
      studentId: req.user.id,
      tutorId: tutorProfile._id,
      status: 'pending',
      reason,
      originalScore: attempt.score,
      originalPercentage: attempt.percentage,
      originalPassed: attempt.isPassed,
    });

    await createNotification({
      userId: tutorProfile.userId,
      type: 'exam_reevaluation_requested',
      title: 'New Re-evaluation Request',
      message: `${req.user.name || 'A student'} requested re-evaluation for "${exam.title}"`,
      data: {
        requestId: request._id,
        examId: exam._id,
        attemptId: attempt._id,
        route: '/tutor/quizzes/re-evaluations',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Re-evaluation request submitted successfully',
      request,
    });
  } catch (error) {
    console.error('Create re-evaluation request error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit re-evaluation request' });
  }
};

// @desc    Student lists own re-evaluation requests
// @route   GET /api/student/exams/re-evaluation-requests
// @access  Private (Student)
export const getMyReevaluationRequests = async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const status = safeStatus(req.query.status);

    const filter = { studentId: req.user.id };
    if (status) filter.status = status;

    const attemptId = toObjectId(req.query.attemptId);
    if (attemptId) filter.attemptId = attemptId;

    const { items, pagination } = await buildPagedResponse({
      model: ExamReevaluationRequest,
      filter,
      page,
      limit,
      populate: [
        { path: 'examId', select: 'title totalMarks passingMarks passingPercentage' },
        { path: 'reviewedBy', select: 'name email' },
      ],
    });

    const stats = await ExamReevaluationRequest.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const summary = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    };
    for (const row of stats) {
      if (summary[row._id] !== undefined) summary[row._id] = row.count;
      summary.total += row.count;
    }

    res.status(200).json({
      success: true,
      requests: items,
      pagination,
      summary,
    });
  } catch (error) {
    console.error('Get my re-evaluation requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch re-evaluation requests' });
  }
};

// @desc    Tutor lists re-evaluation requests
// @route   GET /api/exams/re-evaluation-requests
// @access  Private (Tutor/Admin)
export const getTutorReevaluationRequests = async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const status = safeStatus(req.query.status);
    const examId = toObjectId(req.query.examId);
    const search = (req.query.search || '').trim();

    const tutorProfile = await getTutorProfileByUserId(req.user.id);
    if (!tutorProfile) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }

    const filter = { tutorId: tutorProfile._id };
    if (status) filter.status = status;
    if (examId) filter.examId = examId;

    if (search) {
      const regex = new RegExp(search, 'i');
      const [studentMatches, examMatches] = await Promise.all([
        User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').limit(50),
        Exam.find({ tutorId: tutorProfile._id, title: regex }).select('_id').limit(50),
      ]);

      const studentIds = studentMatches.map((row) => row._id);
      const examIds = examMatches.map((row) => row._id);

      if (studentIds.length === 0 && examIds.length === 0) {
        return res.status(200).json({
          success: true,
          requests: [],
          pagination: { total: 0, page, limit, pages: 1 },
          summary: { pending: 0, approved: 0, rejected: 0, total: 0 },
        });
      }

      filter.$or = [];
      if (studentIds.length > 0) filter.$or.push({ studentId: { $in: studentIds } });
      if (examIds.length > 0) filter.$or.push({ examId: { $in: examIds } });
    }

    const { items, pagination } = await buildPagedResponse({
      model: ExamReevaluationRequest,
      filter,
      page,
      limit,
      populate: [
        { path: 'studentId', select: 'name email profileImage' },
        { path: 'examId', select: 'title totalMarks passingMarks passingPercentage' },
        { path: 'reviewedBy', select: 'name email' },
      ],
    });

    const stats = await ExamReevaluationRequest.aggregate([
      { $match: { tutorId: tutorProfile._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const summary = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    };
    for (const row of stats) {
      if (summary[row._id] !== undefined) summary[row._id] = row.count;
      summary.total += row.count;
    }

    res.status(200).json({
      success: true,
      requests: items,
      pagination,
      summary,
    });
  } catch (error) {
    console.error('Get tutor re-evaluation requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch re-evaluation requests' });
  }
};

// @desc    Tutor reviews a re-evaluation request
// @route   PATCH /api/exams/re-evaluation-requests/:requestId/review
// @access  Private (Tutor/Admin)
export const reviewReevaluationRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const decisionRaw = req.body?.decision ?? req.body?.status;
    const decision = safeStatus(decisionRaw);
    const tutorRemarks = typeof req.body?.tutorRemarks === 'string' ? req.body.tutorRemarks.trim() : '';

    if (!decision || decision === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Decision must be either approved or rejected',
      });
    }

    const tutorProfile = await getTutorProfileByUserId(req.user.id);
    if (!tutorProfile) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }

    const request = await ExamReevaluationRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Re-evaluation request not found' });
    }

    if (String(request.tutorId) !== String(tutorProfile._id)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to review this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request is already ${request.status}`,
      });
    }

    const attempt = await ExamAttempt.findById(request.attemptId).populate('examId', 'title totalMarks passingMarks passingPercentage');
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Associated attempt not found' });
    }

    let revisedScore = attempt.score;
    let revisedPercentage = attempt.percentage;
    let revisedPassed = attempt.isPassed;
    const exam = attempt.examId;
    const examTotalMarks = Number(exam?.totalMarks ?? 0);

    if (decision === 'approved') {
      if (req.body?.revisedScore !== undefined && req.body?.revisedScore !== null && req.body?.revisedScore !== '') {
        const numericScore = Number(req.body.revisedScore);
        if (!Number.isFinite(numericScore) || numericScore < 0 || (examTotalMarks > 0 && numericScore > examTotalMarks)) {
          return res.status(400).json({
            success: false,
            message: `Revised score must be between 0 and ${examTotalMarks || 'total marks'}`,
          });
        }
        revisedScore = Number(numericScore.toFixed(2));
      }

      const passResult = evaluatePass({
        score: revisedScore,
        totalMarks: exam?.totalMarks,
        passingMarks: exam?.passingMarks,
        passingPercentage: exam?.passingPercentage,
      });

      revisedPercentage = passResult.displayPercentage;
      revisedPassed = passResult.isPassed;

      attempt.score = revisedScore;
      attempt.percentage = revisedPercentage;
      attempt.isPassed = revisedPassed;
      await attempt.save();
    }

    request.status = decision;
    request.tutorRemarks = tutorRemarks;
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.revisedScore = revisedScore;
    request.revisedPercentage = revisedPercentage;
    request.revisedPassed = revisedPassed;
    await request.save();

    await createNotification({
      userId: request.studentId,
      type: `exam_reevaluation_${decision}`,
      title: `Re-evaluation ${decision}`,
      message: decision === 'approved'
        ? `Your re-evaluation for "${exam?.title || 'exam'}" was approved`
        : `Your re-evaluation for "${exam?.title || 'exam'}" was rejected`,
      data: {
        requestId: request._id,
        attemptId: attempt._id,
        examId: request.examId,
        route: `/student/exams/attempt/${attempt._id}`,
      },
    });

    const requestDoc = await ExamReevaluationRequest.findById(request._id)
      .populate('studentId', 'name email profileImage')
      .populate('examId', 'title totalMarks passingMarks passingPercentage')
      .populate('reviewedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `Re-evaluation request ${decision} successfully`,
      request: requestDoc,
      updatedAttempt: {
        _id: attempt._id,
        score: attempt.score,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
      },
    });
  } catch (error) {
    console.error('Review re-evaluation request error:', error);
    res.status(500).json({ success: false, message: 'Failed to review re-evaluation request' });
  }
};
