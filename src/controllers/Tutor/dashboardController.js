import Course from '../../models/Course.js';
import Tutor from '../../models/Tutor.js';
import Appointment from '../../models/Appointment.js';
import Enrollment from '../../models/Enrollment.js';
import { Exam, ExamAttempt } from '../../models/Exam.js';
import Assignment from '../../models/Assignment.js';
import Submission from '../../models/Submission.js';
import Attendance from '../../models/Attendance.js';
import LiveClass from '../../models/LiveClass.js';
import Batch from '../../models/Batch.js';
import BatchAttendance from '../../models/BatchAttendance.js';
import { QuestionSet } from '../../models/QuestionSet.js';
import LearningEvent from '../../models/LearningEvent.js';
import LearningEventDailyAggregate from '../../models/LearningEventDailyAggregate.js';

const sanitizeCsvFormula = (value) => {
  if (typeof value !== 'string') return value;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
};

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  const normalized = sanitizeCsvFormula(String(value));
  const escaped = normalized.replace(/"/g, '""');
  if (/[",\n]/.test(escaped)) return `"${escaped}"`;
  return escaped;
};

const buildCsvLine = (cells) => cells.map((cell) => escapeCsvCell(cell)).join(',');

const roundToOne = (value) => Number((Number(value || 0)).toFixed(1));

const calculateRate = (numerator, denominator) => {
  if (!denominator) return 0;
  return roundToOne((Number(numerator || 0) / Number(denominator || 1)) * 100);
};

const toDateStringSafe = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const isPresentLike = (status) => {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'present' || normalized === 'late';
};

const applyLatestActivity = (currentValue, candidate) => {
  if (!candidate) return currentValue;
  const candidateDate = new Date(candidate);
  if (Number.isNaN(candidateDate.getTime())) return currentValue;
  if (!currentValue) return candidateDate;
  return candidateDate > currentValue ? candidateDate : currentValue;
};

const buildStudentRisk = ({
  progressAverage,
  examAverage,
  assignmentRate,
  attendanceRate,
  inactivityDays,
  hasPublishedExams,
  expectedAssignments,
  attendanceSamples,
}) => {
  let riskScore = 0;
  const reasons = [];

  if (progressAverage < 40) {
    riskScore += 30;
    reasons.push(`Low learning progress (${roundToOne(progressAverage)}%)`);
  } else if (progressAverage < 60) {
    riskScore += 16;
    reasons.push(`Slipping learning progress (${roundToOne(progressAverage)}%)`);
  }

  if (hasPublishedExams && examAverage === null) {
    riskScore += 10;
    reasons.push('No recent exam attempts');
  } else if (examAverage !== null && examAverage < 40) {
    riskScore += 24;
    reasons.push(`Low exam performance (${roundToOne(examAverage)}%)`);
  } else if (examAverage !== null && examAverage < 60) {
    riskScore += 12;
    reasons.push(`Exam performance needs attention (${roundToOne(examAverage)}%)`);
  }

  if (expectedAssignments > 0 && assignmentRate < 40) {
    riskScore += 20;
    reasons.push(`Low assignment submission (${roundToOne(assignmentRate)}%)`);
  } else if (expectedAssignments > 0 && assignmentRate < 70) {
    riskScore += 10;
    reasons.push(`Assignment submission is below target (${roundToOne(assignmentRate)}%)`);
  }

  if (attendanceSamples > 0 && attendanceRate < 60) {
    riskScore += 16;
    reasons.push(`Low attendance consistency (${roundToOne(attendanceRate)}%)`);
  } else if (attendanceSamples > 0 && attendanceRate < 80) {
    riskScore += 8;
    reasons.push(`Attendance trend needs monitoring (${roundToOne(attendanceRate)}%)`);
  }

  if (inactivityDays !== null && inactivityDays > 21) {
    riskScore += 20;
    reasons.push(`Inactive for ${inactivityDays} days`);
  } else if (inactivityDays !== null && inactivityDays > 10) {
    riskScore += 10;
    reasons.push(`Inactivity spike (${inactivityDays} days)`);
  }

  const normalizedScore = Math.min(100, roundToOne(riskScore));
  const riskLevel = normalizedScore >= 70 ? 'high' : normalizedScore >= 45 ? 'medium' : 'low';

  return { riskLevel, riskScore: normalizedScore, reasons };
};

const buildTutorReportsPayload = async (userId) => {
  const tutor = await Tutor.findOne({ userId }).select('_id').lean();
  if (!tutor) return null;

  const now = new Date();

  const courses = await Course.find({ tutorId: tutor._id })
    .select('_id title status enrolledCount')
    .lean();
  const courseIds = courses.map((course) => course._id);
  const publishedCourses = courses.filter((course) => course.status === 'published').length;
  const draftCourses = courses.filter((course) => course.status === 'draft').length;

  const emptyPayload = {
    report: {
      generatedAt: now.toISOString(),
      overview: {
        totalCourses: courses.length,
        publishedCourses,
        draftCourses,
        totalStudents: 0,
        activeEnrollments: 0,
        upcomingClasses: 0,
        upcomingExams: 0,
      },
      courses: {
        averageProgress: 0,
        completionRate: 0,
      },
      exams: {
        totalExams: 0,
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
      },
      assignments: {
        totalAssignments: 0,
        totalSubmissions: 0,
        pendingReview: 0,
        submissionRate: 0,
        gradingRate: 0,
      },
      attendance: {
        totalSessions: 0,
        totalEntries: 0,
        attendanceRate: 0,
      },
      students: {
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        atRiskCount: 0,
      },
    },
    atRiskStudents: [],
    studentReports: [],
    courseReports: [],
  };

  if (courseIds.length === 0) return emptyPayload;

  const [enrollments, assignments, exams, liveClasses] = await Promise.all([
    Enrollment.find({
      courseId: { $in: courseIds },
      status: { $in: ['active', 'completed'] },
    })
      .populate('studentId', 'name email profileImage')
      .populate('courseId', 'title')
      .lean(),
    Assignment.find({
      courseId: { $in: courseIds },
      status: 'published',
    }).select('_id courseId title dueDate').lean(),
    Exam.find({
      tutorId: tutor._id,
      type: { $ne: 'practice' },
      status: 'published',
    }).select('_id title courseId startDate').lean(),
    LiveClass.find({ tutorId: tutor._id })
      .select('_id courseId title dateTime status')
      .lean(),
  ]);

  const assignmentIds = assignments.map((assignment) => assignment._id);
  const examIds = exams.map((exam) => exam._id);
  const liveClassIds = liveClasses.map((liveClass) => liveClass._id);

  const [submissions, latestExamAttempts, attendanceRecords] = await Promise.all([
    assignmentIds.length > 0
      ? Submission.find({
          assignmentId: { $in: assignmentIds },
        })
          .select('assignmentId studentId status submittedAt')
          .lean()
      : Promise.resolve([]),
    examIds.length > 0
      ? ExamAttempt.aggregate([
          {
            $match: {
              examId: { $in: examIds },
            },
          },
          { $sort: { submittedAt: -1, createdAt: -1 } },
          {
            $group: {
              _id: {
                examId: '$examId',
                studentId: '$studentId',
              },
              percentage: { $first: '$percentage' },
              isPassed: { $first: '$isPassed' },
              submittedAt: { $first: '$submittedAt' },
              courseId: { $first: '$courseId' },
            },
          },
        ])
      : Promise.resolve([]),
    liveClassIds.length > 0
      ? Attendance.find({
          liveClassId: { $in: liveClassIds },
        })
          .select('studentId status courseId joinedAt')
          .lean()
      : Promise.resolve([]),
  ]);

  const courseAssignmentsCount = new Map();
  const assignmentCourseById = new Map();
  assignments.forEach((assignment) => {
    const courseId = assignment.courseId?.toString();
    if (!courseId) return;
    courseAssignmentsCount.set(courseId, (courseAssignmentsCount.get(courseId) || 0) + 1);
    assignmentCourseById.set(assignment._id.toString(), courseId);
  });

  const courseReportMap = new Map();
  courses.forEach((course) => {
    courseReportMap.set(course._id.toString(), {
      courseId: course._id,
      title: course.title || 'Untitled Course',
      status: course.status || 'draft',
      students: 0,
      progressTotal: 0,
      progressCount: 0,
      assignmentCount: courseAssignmentsCount.get(course._id.toString()) || 0,
      assignmentExpected: 0,
      assignmentSubmitted: 0,
      examCount: 0,
      examScoreTotal: 0,
      examScoreCount: 0,
      attendanceTotal: 0,
      attendancePresent: 0,
    });
  });

  const studentMetrics = new Map();
  const uniqueStudentIds = new Set();

  enrollments.forEach((enrollment) => {
    const student = enrollment.studentId;
    const course = enrollment.courseId;
    if (!student?._id || !course?._id) return;

    const studentId = student._id.toString();
    const courseId = course._id.toString();
    const progress = Number(enrollment.progress?.percentage || 0);

    uniqueStudentIds.add(studentId);

    if (!studentMetrics.has(studentId)) {
      studentMetrics.set(studentId, {
        studentId: student._id,
        name: student.name || 'Student',
        email: student.email || '',
        profileImage: student.profileImage || null,
        courseIds: new Set(),
        courseTitles: new Set(),
        progressTotal: 0,
        progressCount: 0,
        expectedAssignments: 0,
        submittedAssignments: 0,
        examPercentages: [],
        attendanceTotal: 0,
        attendancePresent: 0,
        lastActivity: null,
      });
    }

    const metric = studentMetrics.get(studentId);
    metric.courseIds.add(courseId);
    metric.courseTitles.add(course.title || 'Untitled Course');
    metric.progressTotal += progress;
    metric.progressCount += 1;
    metric.lastActivity = applyLatestActivity(metric.lastActivity, enrollment.lastAccessed || enrollment.enrolledAt);

    const courseReport = courseReportMap.get(courseId);
    if (courseReport) {
      courseReport.students += 1;
      courseReport.progressTotal += progress;
      courseReport.progressCount += 1;
      courseReport.assignmentExpected += courseReport.assignmentCount;
    }
  });

  studentMetrics.forEach((metric) => {
    metric.expectedAssignments = Array.from(metric.courseIds).reduce(
      (sum, courseId) => sum + (courseAssignmentsCount.get(courseId) || 0),
      0
    );
  });

  submissions.forEach((submission) => {
    const studentId = submission.studentId?.toString();
    const assignmentId = submission.assignmentId?.toString();
    if (!studentId || !assignmentId) return;

    const metric = studentMetrics.get(studentId);
    if (metric) {
      metric.submittedAssignments += 1;
      metric.lastActivity = applyLatestActivity(metric.lastActivity, submission.submittedAt);
    }

    const courseId = assignmentCourseById.get(assignmentId);
    if (!courseId) return;
    const courseReport = courseReportMap.get(courseId);
    if (courseReport) {
      courseReport.assignmentSubmitted += 1;
    }
  });

  let totalPassedAttempts = 0;
  latestExamAttempts.forEach((attempt) => {
    const studentId = attempt?._id?.studentId?.toString();
    if (!studentId) return;

    const metric = studentMetrics.get(studentId);
    if (metric) {
      metric.examPercentages.push(Number(attempt.percentage || 0));
      metric.lastActivity = applyLatestActivity(metric.lastActivity, attempt.submittedAt);
    }

    const courseId = attempt.courseId?.toString();
    if (courseId && courseReportMap.has(courseId)) {
      const courseReport = courseReportMap.get(courseId);
      courseReport.examScoreTotal += Number(attempt.percentage || 0);
      courseReport.examScoreCount += 1;
    }

    if (attempt.isPassed) totalPassedAttempts += 1;
  });

  exams.forEach((exam) => {
    const courseId = exam.courseId?.toString();
    if (!courseId || !courseReportMap.has(courseId)) return;
    courseReportMap.get(courseId).examCount += 1;
  });

  attendanceRecords.forEach((record) => {
    const studentId = record.studentId?.toString();
    if (!studentId) return;
    const isPresent = ['present', 'late'].includes(record.status);

    const metric = studentMetrics.get(studentId);
    if (metric) {
      metric.attendanceTotal += 1;
      if (isPresent) metric.attendancePresent += 1;
      metric.lastActivity = applyLatestActivity(metric.lastActivity, record.joinedAt);
    }

    const courseId = record.courseId?.toString();
    if (courseId && courseReportMap.has(courseId)) {
      const courseReport = courseReportMap.get(courseId);
      courseReport.attendanceTotal += 1;
      if (isPresent) courseReport.attendancePresent += 1;
    }
  });

  const atRiskStudents = [];
  const studentReports = [];
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;

  studentMetrics.forEach((metric) => {
    const progressAverage = metric.progressCount > 0
      ? (metric.progressTotal / metric.progressCount)
      : 0;
    const examAverage = metric.examPercentages.length > 0
      ? (metric.examPercentages.reduce((sum, value) => sum + value, 0) / metric.examPercentages.length)
      : null;
    const assignmentRate = metric.expectedAssignments > 0
      ? (metric.submittedAssignments / metric.expectedAssignments) * 100
      : 0;
    const attendanceRate = metric.attendanceTotal > 0
      ? (metric.attendancePresent / metric.attendanceTotal) * 100
      : 0;
    const inactivityDays = metric.lastActivity
      ? Math.max(0, Math.floor((Date.now() - metric.lastActivity.getTime()) / (24 * 60 * 60 * 1000)))
      : null;

    const risk = buildStudentRisk({
      progressAverage,
      examAverage,
      assignmentRate,
      attendanceRate,
      inactivityDays,
      hasPublishedExams: exams.length > 0,
      expectedAssignments: metric.expectedAssignments,
      attendanceSamples: metric.attendanceTotal,
    });

    if (risk.riskLevel === 'high') highRiskCount += 1;
    else if (risk.riskLevel === 'medium') mediumRiskCount += 1;
    else lowRiskCount += 1;

    const studentReport = {
      studentId: metric.studentId,
      name: metric.name,
      email: metric.email,
      profileImage: metric.profileImage,
      courses: Array.from(metric.courseTitles),
      courseCount: metric.courseTitles.size,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      reasons: risk.reasons,
      indicators: {
        progress: roundToOne(progressAverage),
        examAverage: examAverage === null ? null : roundToOne(examAverage),
        assignmentRate: roundToOne(assignmentRate),
        attendanceRate: roundToOne(attendanceRate),
        inactivityDays,
      },
      lastActivityAt: toDateStringSafe(metric.lastActivity),
    };

    studentReports.push(studentReport);

    if (risk.riskLevel === 'high' || risk.riskLevel === 'medium') {
      atRiskStudents.push(studentReport);
    }
  });

  atRiskStudents.sort((a, b) => b.riskScore - a.riskScore);
  studentReports.sort((a, b) => b.riskScore - a.riskScore);

  const courseReports = Array.from(courseReportMap.values())
    .map((course) => ({
      courseId: course.courseId,
      title: course.title,
      status: course.status,
      students: course.students,
      assignmentCount: course.assignmentCount,
      examCount: course.examCount,
      averageProgress: course.progressCount > 0 ? roundToOne(course.progressTotal / course.progressCount) : 0,
      assignmentSubmissionRate: calculateRate(course.assignmentSubmitted, course.assignmentExpected),
      averageExamScore: course.examScoreCount > 0 ? roundToOne(course.examScoreTotal / course.examScoreCount) : 0,
      attendanceRate: calculateRate(course.attendancePresent, course.attendanceTotal),
    }))
    .sort((a, b) => b.students - a.students);

  const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === 'active').length;
  const completionCount = enrollments.filter((enrollment) =>
    enrollment.status === 'completed' || Number(enrollment.progress?.percentage || 0) >= 100
  ).length;
  const averageProgress = enrollments.length > 0
    ? roundToOne(enrollments.reduce((sum, enrollment) => sum + Number(enrollment.progress?.percentage || 0), 0) / enrollments.length)
    : 0;

  const totalExpectedSubmissions = Array.from(courseReportMap.values()).reduce(
    (sum, course) => sum + (course.assignmentExpected || 0),
    0
  );
  const totalSubmissions = submissions.length;
  const pendingReview = submissions.filter((submission) => submission.status === 'submitted').length;
  const gradedSubmissions = submissions.filter((submission) => ['graded', 'returned'].includes(submission.status)).length;
  const attendancePresentCount = attendanceRecords.filter((record) => ['present', 'late'].includes(record.status)).length;

  const upcomingClasses = liveClasses.filter((liveClass) => {
    if (!liveClass.dateTime) return false;
    if (liveClass.status === 'cancelled' || liveClass.status === 'completed') return false;
    return new Date(liveClass.dateTime) >= now;
  }).length;
  const upcomingExams = exams.filter((exam) => exam.startDate && new Date(exam.startDate) >= now).length;

  return {
    report: {
      generatedAt: now.toISOString(),
      overview: {
        totalCourses: courses.length,
        publishedCourses,
        draftCourses,
        totalStudents: uniqueStudentIds.size,
        activeEnrollments,
        upcomingClasses,
        upcomingExams,
      },
      courses: {
        averageProgress,
        completionRate: calculateRate(completionCount, enrollments.length),
      },
      exams: {
        totalExams: exams.length,
        totalAttempts: latestExamAttempts.length,
        averageScore: latestExamAttempts.length > 0
          ? roundToOne(latestExamAttempts.reduce((sum, attempt) => sum + Number(attempt.percentage || 0), 0) / latestExamAttempts.length)
          : 0,
        passRate: calculateRate(totalPassedAttempts, latestExamAttempts.length),
      },
      assignments: {
        totalAssignments: assignments.length,
        totalSubmissions,
        pendingReview,
        submissionRate: calculateRate(totalSubmissions, totalExpectedSubmissions),
        gradingRate: calculateRate(gradedSubmissions, totalSubmissions),
      },
      attendance: {
        totalSessions: liveClasses.length,
        totalEntries: attendanceRecords.length,
        attendanceRate: calculateRate(attendancePresentCount, attendanceRecords.length),
      },
      students: {
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
        atRiskCount: highRiskCount + mediumRiskCount,
      },
    },
    atRiskStudents,
    studentReports,
    courseReports,
  };
};

const buildTutorAttendanceReportPayload = async (userId) => {
  const tutor = await Tutor.findOne({ userId }).select('_id').lean();
  if (!tutor) return null;

  const now = new Date();
  const courses = await Course.find({ tutorId: tutor._id })
    .select('_id title status')
    .lean();
  const courseIds = courses.map((course) => course._id);

  const [batches, liveClasses, enrollments] = await Promise.all([
    Batch.find({ tutorId: tutor._id })
      .populate('courseId', 'title')
      .populate('students', 'name email profileImage')
      .lean(),
    LiveClass.find({ tutorId: tutor._id })
      .select('_id title courseId dateTime status')
      .lean(),
    courseIds.length > 0
      ? Enrollment.find({
          courseId: { $in: courseIds },
          status: { $in: ['active', 'completed'] },
        })
          .populate('studentId', 'name email profileImage')
          .populate('courseId', 'title')
          .lean()
      : Promise.resolve([]),
  ]);

  const batchIds = batches.map((batch) => batch._id);
  const liveClassIds = liveClasses.map((liveClass) => liveClass._id);

  const [liveAttendanceRows, batchAttendanceRows] = await Promise.all([
    liveClassIds.length > 0
      ? Attendance.find({ liveClassId: { $in: liveClassIds } })
          .populate('studentId', 'name email profileImage')
          .lean()
      : Promise.resolve([]),
    batchIds.length > 0
      ? BatchAttendance.find({ batchId: { $in: batchIds } })
          .populate('records.studentId', 'name email profileImage')
          .lean()
      : Promise.resolve([]),
  ]);

  const courseStatsMap = new Map();
  courses.forEach((course) => {
    courseStatsMap.set(course._id.toString(), {
      courseId: course._id,
      title: course.title || 'Untitled Course',
      status: course.status || 'draft',
      enrolledStudents: new Set(),
      liveSessions: 0,
      liveMarked: 0,
      livePresentLike: 0,
      batchSessions: 0,
      batchMarked: 0,
      batchPresentLike: 0,
    });
  });

  const liveClassById = new Map();
  liveClasses.forEach((liveClass) => {
    liveClassById.set(liveClass._id.toString(), liveClass);
    const courseId = liveClass.courseId?.toString();
    if (!courseId || !courseStatsMap.has(courseId)) return;
    courseStatsMap.get(courseId).liveSessions += 1;
  });

  const batchById = new Map();
  const batchStatsMap = new Map();
  batches.forEach((batch) => {
    const batchId = batch._id.toString();
    batchById.set(batchId, batch);
    batchStatsMap.set(batchId, {
      batchId: batch._id,
      batchName: batch.name || 'Unnamed Batch',
      courseId: batch.courseId?._id || null,
      courseTitle: batch.courseId?.title || 'Unassigned Course',
      students: Array.isArray(batch.students) ? batch.students.length : 0,
      sessions: 0,
      markedEntries: 0,
      presentLikeEntries: 0,
      absentEntries: 0,
      lateEntries: 0,
      lastSessionAt: null,
    });
  });

  enrollments.forEach((enrollment) => {
    const courseId = enrollment.courseId?._id?.toString();
    const studentId = enrollment.studentId?._id?.toString();
    if (!courseId || !studentId || !courseStatsMap.has(courseId)) return;
    courseStatsMap.get(courseId).enrolledStudents.add(studentId);
  });

  const studentMetricMap = new Map();
  const ensureStudentMetric = (studentId, studentData = {}, seedCourseTitle = null, seedBatchName = null) => {
    if (!studentId) return null;
    if (!studentMetricMap.has(studentId)) {
      studentMetricMap.set(studentId, {
        studentId: studentData._id || studentId,
        name: studentData.name || 'Student',
        email: studentData.email || '',
        profileImage: studentData.profileImage || null,
        courses: new Set(),
        batches: new Set(),
        liveMarked: 0,
        livePresentLike: 0,
        batchMarked: 0,
        batchPresentLike: 0,
        absentCount: 0,
        lateCount: 0,
        lastAttendanceAt: null,
      });
    }
    const metric = studentMetricMap.get(studentId);
    if (seedCourseTitle) metric.courses.add(seedCourseTitle);
    if (seedBatchName) metric.batches.add(seedBatchName);
    return metric;
  };

  enrollments.forEach((enrollment) => {
    const studentId = enrollment.studentId?._id?.toString();
    if (!studentId) return;
    ensureStudentMetric(
      studentId,
      enrollment.studentId,
      enrollment.courseId?.title || null
    );
  });

  let totalLiveMarked = 0;
  let totalLivePresentLike = 0;
  liveAttendanceRows.forEach((row) => {
    const studentId = row.studentId?._id?.toString() || row.studentId?.toString();
    if (!studentId) return;

    const liveClass = liveClassById.get(row.liveClassId?.toString());
    const courseId = row.courseId?.toString() || liveClass?.courseId?.toString();
    const courseTitle = courseId && courseStatsMap.has(courseId)
      ? courseStatsMap.get(courseId).title
      : null;
    const presentLike = isPresentLike(row.status);

    totalLiveMarked += 1;
    if (presentLike) totalLivePresentLike += 1;

    if (courseId && courseStatsMap.has(courseId)) {
      const courseStats = courseStatsMap.get(courseId);
      courseStats.liveMarked += 1;
      if (presentLike) courseStats.livePresentLike += 1;
    }

    const metric = ensureStudentMetric(studentId, row.studentId, courseTitle);
    if (!metric) return;

    metric.liveMarked += 1;
    if (presentLike) metric.livePresentLike += 1;
    if (String(row.status || '').toLowerCase() === 'absent') metric.absentCount += 1;
    if (String(row.status || '').toLowerCase() === 'late') metric.lateCount += 1;
    metric.lastAttendanceAt = applyLatestActivity(metric.lastAttendanceAt, row.joinedAt || row.createdAt);
  });

  let totalBatchMarked = 0;
  let totalBatchPresentLike = 0;
  batchAttendanceRows.forEach((attendanceDoc) => {
    const batchId = attendanceDoc.batchId?.toString();
    if (!batchId || !batchStatsMap.has(batchId)) return;

    const batchStats = batchStatsMap.get(batchId);
    batchStats.sessions += 1;
    batchStats.lastSessionAt = applyLatestActivity(batchStats.lastSessionAt, attendanceDoc.date || attendanceDoc.createdAt);

    const batch = batchById.get(batchId);
    const courseId = batch?.courseId?._id?.toString() || batch?.courseId?.toString() || null;
    if (courseId && courseStatsMap.has(courseId)) {
      courseStatsMap.get(courseId).batchSessions += 1;
    }

    const records = Array.isArray(attendanceDoc.records) ? attendanceDoc.records : [];
    records.forEach((record) => {
      const studentId = record.studentId?._id?.toString() || record.studentId?.toString();
      if (!studentId) return;

      const normalizedStatus = String(record.status || '').toLowerCase();
      const presentLike = isPresentLike(normalizedStatus);

      totalBatchMarked += 1;
      batchStats.markedEntries += 1;
      if (presentLike) {
        totalBatchPresentLike += 1;
        batchStats.presentLikeEntries += 1;
      }
      if (normalizedStatus === 'absent') batchStats.absentEntries += 1;
      if (normalizedStatus === 'late') batchStats.lateEntries += 1;

      if (courseId && courseStatsMap.has(courseId)) {
        const courseStats = courseStatsMap.get(courseId);
        courseStats.batchMarked += 1;
        if (presentLike) courseStats.batchPresentLike += 1;
      }

      const metric = ensureStudentMetric(
        studentId,
        record.studentId,
        batchStats.courseTitle,
        batchStats.batchName
      );
      if (!metric) return;

      metric.batchMarked += 1;
      if (presentLike) metric.batchPresentLike += 1;
      if (normalizedStatus === 'absent') metric.absentCount += 1;
      if (normalizedStatus === 'late') metric.lateCount += 1;
      metric.lastAttendanceAt = applyLatestActivity(metric.lastAttendanceAt, attendanceDoc.date || attendanceDoc.createdAt);
    });
  });

  const courseReports = Array.from(courseStatsMap.values())
    .map((course) => ({
      courseId: course.courseId,
      title: course.title,
      status: course.status,
      enrolledStudents: course.enrolledStudents.size,
      liveSessions: course.liveSessions,
      batchSessions: course.batchSessions,
      liveAttendanceRate: calculateRate(course.livePresentLike, course.liveMarked),
      batchAttendanceRate: calculateRate(course.batchPresentLike, course.batchMarked),
      overallAttendanceRate: calculateRate(
        course.livePresentLike + course.batchPresentLike,
        course.liveMarked + course.batchMarked
      ),
      trackedEntries: course.liveMarked + course.batchMarked,
    }))
    .sort((a, b) => b.overallAttendanceRate - a.overallAttendanceRate);

  const batchReports = Array.from(batchStatsMap.values())
    .map((batchStats) => ({
      batchId: batchStats.batchId,
      batchName: batchStats.batchName,
      courseTitle: batchStats.courseTitle,
      students: batchStats.students,
      sessions: batchStats.sessions,
      trackedEntries: batchStats.markedEntries,
      presentEntries: batchStats.presentLikeEntries,
      absentEntries: batchStats.absentEntries,
      lateEntries: batchStats.lateEntries,
      attendanceRate: calculateRate(batchStats.presentLikeEntries, batchStats.markedEntries),
      lastSessionAt: toDateStringSafe(batchStats.lastSessionAt),
    }))
    .sort((a, b) => b.attendanceRate - a.attendanceRate);

  const studentReports = Array.from(studentMetricMap.values())
    .map((metric) => {
      const totalMarked = metric.liveMarked + metric.batchMarked;
      const totalPresentLike = metric.livePresentLike + metric.batchPresentLike;
      const overallAttendanceRate = calculateRate(totalPresentLike, totalMarked);
      const liveAttendanceRate = calculateRate(metric.livePresentLike, metric.liveMarked);
      const batchAttendanceRate = calculateRate(metric.batchPresentLike, metric.batchMarked);
      const inactivityDays = metric.lastAttendanceAt
        ? Math.max(0, Math.floor((Date.now() - metric.lastAttendanceAt.getTime()) / (24 * 60 * 60 * 1000)))
        : null;

      let riskLevel = 'low';
      const reasons = [];

      if (totalMarked === 0 && (liveClasses.length > 0 || batchAttendanceRows.length > 0)) {
        riskLevel = 'medium';
        reasons.push('No attendance records tracked yet');
      } else if (overallAttendanceRate < 50) {
        riskLevel = 'high';
        reasons.push(`Very low attendance (${overallAttendanceRate}%)`);
      } else if (overallAttendanceRate < 70) {
        riskLevel = 'medium';
        reasons.push(`Attendance needs improvement (${overallAttendanceRate}%)`);
      }

      if (metric.liveMarked >= 2 && liveAttendanceRate < 60) {
        reasons.push(`Live class attendance is low (${liveAttendanceRate}%)`);
      }
      if (metric.batchMarked >= 2 && batchAttendanceRate < 60) {
        reasons.push(`Batch attendance is low (${batchAttendanceRate}%)`);
      }
      if (inactivityDays !== null && inactivityDays > 14) {
        reasons.push(`No attendance update in ${inactivityDays} days`);
        if (riskLevel === 'low') riskLevel = 'medium';
      }

      return {
        studentId: metric.studentId,
        name: metric.name,
        email: metric.email,
        profileImage: metric.profileImage,
        courses: Array.from(metric.courses),
        batches: Array.from(metric.batches),
        attendance: {
          overallRate: overallAttendanceRate,
          liveRate: liveAttendanceRate,
          batchRate: batchAttendanceRate,
          trackedSessions: totalMarked,
          presentSessions: totalPresentLike,
          absentCount: metric.absentCount,
          lateCount: metric.lateCount,
        },
        riskLevel,
        reasons,
        inactivityDays,
        lastAttendanceAt: toDateStringSafe(metric.lastAttendanceAt),
      };
    })
    .sort((a, b) => a.attendance.overallRate - b.attendance.overallRate);

  const lowAttendanceStudents = studentReports.filter((student) =>
    student.riskLevel === 'high' || student.riskLevel === 'medium'
  );

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalCourses: courses.length,
      totalBatches: batches.length,
      totalStudents: studentReports.length,
      liveSessions: liveClasses.length,
      batchSessions: batchAttendanceRows.length,
      liveAttendanceRate: calculateRate(totalLivePresentLike, totalLiveMarked),
      batchAttendanceRate: calculateRate(totalBatchPresentLike, totalBatchMarked),
      overallAttendanceRate: calculateRate(
        totalLivePresentLike + totalBatchPresentLike,
        totalLiveMarked + totalBatchMarked
      ),
      lowAttendanceStudents: lowAttendanceStudents.length,
    },
    courseReports,
    batchReports,
    studentReports,
    lowAttendanceStudents,
  };
};

// @desc    Get tutor dashboard statistics
// @route   GET /api/dashboard/stats
export const getTutorStats = async (req, res) => {
  try {
    // Find tutor profile
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    // Get courses statistics
    const totalCourses = await Course.countDocuments({ tutorId: tutor._id });
    const publishedCourses = await Course.countDocuments({
      tutorId: tutor._id,
      status: 'published',
    });
    const draftCourses = await Course.countDocuments({
      tutorId: tutor._id,
      status: 'draft',
    });

    // Get all courses for this tutor
    const courses = await Course.find({ tutorId: tutor._id });

    // Calculate total enrolled students (Active Students)
    const totalStudents = courses.reduce(
      (sum, course) => sum + course.enrolledCount,
      0
    );

    // Calculate average rating
    const coursesWithRatings = courses.filter(c => c.rating > 0);
    const averageRating =
      coursesWithRatings.length > 0
        ? (
          coursesWithRatings.reduce((sum, c) => sum + c.rating, 0) /
          coursesWithRatings.length
        ).toFixed(1)
        : 0;

    // Get appointments statistics
    const now = new Date();
    const upcomingAppointments = await Appointment.countDocuments({
      tutorId: tutor._id,
      dateTime: { $gte: now },
      status: { $in: ['pending', 'confirmed'] },
    });

    const totalAppointments = await Appointment.countDocuments({
      tutorId: tutor._id,
    });

    const completedAppointments = await Appointment.countDocuments({
      tutorId: tutor._id,
      status: 'completed',
    });

    // Get recent enrollments (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentEnrollments = await Enrollment.countDocuments({
      courseId: { $in: courses.map(c => c._id) },
      enrolledAt: { $gte: sevenDaysAgo },
    });

    // Get total revenue (if courses are paid)
    const totalRevenue = courses.reduce(
      (sum, course) => sum + course.price * course.enrolledCount,
      0
    );

    // --- NEW STATS FOR DASHBOARD V2 ---

    // 1. Total Quizzes (Exams excluding practice sets)
    const totalQuizzes = await Exam.countDocuments({
      tutorId: tutor._id,
      type: { $ne: 'practice' }
    });

    // 2. Total Practice Sets
    const totalPracticeSets = await Exam.countDocuments({
      tutorId: tutor._id,
      type: 'practice'
    });

    // 3. Total Questions
    // Aggregate questions from QuestionSets
    const questionSets = await QuestionSet.find({ tutorId: tutor._id });
    const questionSetCount = questionSets.reduce((acc, set) => acc + (set.questions ? set.questions.length : 0), 0);

    // Aggregate questions from Exams (that might not be in question sets, or just count all exam questions)
    // To avoid over-complexity/performance issues with massive question banks, we can simplify or use aggregation.
    // For now, let's sum up questions in all exams + question sets. 
    // Note: This might double count if questions are imported, but without a dedicated 'Question' model collection, this is best approximation.
    const allExams = await Exam.find({ tutorId: tutor._id }, 'totalQuestions questions');
    const examQuestionCount = allExams.reduce((acc, exam) => acc + (exam.totalQuestions || exam.questions.length), 0);

    const totalQuestions = questionSetCount + examQuestionCount;


    res.status(200).json({
      success: true,
      stats: {
        courses: {
          total: totalCourses,
          published: publishedCourses,
          draft: draftCourses,
        },
        students: {
          total: totalStudents,
          recentEnrollments,
        },
        appointments: {
          total: totalAppointments,
          upcoming: upcomingAppointments,
          completed: completedAppointments,
        },
        rating: {
          average: parseFloat(averageRating),
          totalReviews: courses.reduce((sum, c) => sum + c.reviewCount, 0),
        },
        revenue: {
          total: totalRevenue,
        },
        // Enhanced Stats
        content: {
          questions: totalQuestions,
          quizzes: totalQuizzes,
          practiceSets: totalPracticeSets
        }
      },
    });
  } catch (error) {
    console.error('Get tutor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


// @desc    Get all students enrolled in tutor's courses
// @route   GET /api/dashboard/students
export const getTutorStudents = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    // Get all courses for this tutor
    const courses = await Course.find({ tutorId: tutor._id });
    const courseIds = courses.map(c => c._id);

    // Get all enrollments with student details
    const enrollments = await Enrollment.find({
      courseId: { $in: courseIds },
      status: 'active',
    })
      .populate('studentId', 'name email phone profileImage')
      .populate('courseId', 'title')
      .sort({ enrolledAt: -1 });

    // Group students by course
    const studentsByCourse = courses.map(course => {
      const courseEnrollments = enrollments.filter(
        e => e.courseId._id.toString() === course._id.toString()
      );

      return {
        courseId: course._id,
        courseTitle: course.title,
        studentCount: courseEnrollments.length,
        students: courseEnrollments.filter(e => e.studentId).map(e => ({
          studentId: e.studentId._id,
          name: e.studentId.name,
          email: e.studentId.email,
          phone: e.studentId.phone,
          profileImage: e.studentId.profileImage,
          enrolledAt: e.enrolledAt,
          progress: e.progress.percentage,
        })),
      };
    });

    // Get unique students
    const uniqueStudents = [];
    const studentIds = new Set();

    enrollments.forEach(e => {
      // Defensive check: If student was deleted but enrollment remains
      if (!e.studentId || !e.studentId._id) return;

      if (!studentIds.has(e.studentId._id.toString())) {
        studentIds.add(e.studentId._id.toString());
        const isBlockedByTutor = tutor.blockedStudents?.some(
          bId => bId.toString() === e.studentId._id.toString()
        ) || false;
        uniqueStudents.push({
          _id: e.studentId._id,
          studentId: e.studentId._id,
          name: e.studentId.name,
          email: e.studentId.email,
          phone: e.studentId.phone,
          profileImage: e.studentId.profileImage,
          isBlockedByTutor,
          joinedAt: e.studentId.createdAt,
          enrolledCourses: enrollments.filter(
            en => en.studentId && en.studentId._id.toString() === e.studentId._id.toString()
          ).map(en => ({
            courseId: en.courseId._id,
            title: en.courseId.title
          }))
        });
      }
    });

    res.status(200).json({
      success: true,
      totalStudents: uniqueStudents.length,
      students: uniqueStudents,
      byCourse: studentsByCourse,
    });
  } catch (error) {
    console.error('Get tutor students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get recent activities
// @route   GET /api/dashboard/activities
export const getRecentActivities = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    // Get courses
    const courses = await Course.find({ tutorId: tutor._id });
    const courseIds = courses.map(c => c._id);

    // Get recent enrollments
    const recentEnrollments = await Enrollment.find({
      courseId: { $in: courseIds },
    })
      .populate('studentId', 'name profileImage')
      .populate('courseId', 'title')
      .sort({ enrolledAt: -1 })
      .limit(10);

    // Get recent appointments
    const recentAppointments = await Appointment.find({
      tutorId: tutor._id,
    })
      .populate('studentId', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      activities: {
        enrollments: recentEnrollments,
        appointments: recentAppointments,
      },
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get earnings overview
// @route   GET /api/dashboard/earnings
export const getEarningsOverview = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const courses = await Course.find({ tutorId: tutor._id });

    // Calculate earnings by course
    const earningsByCourse = courses.map(course => ({
      courseId: course._id,
      title: course.title,
      enrollments: course.enrolledCount,
      price: course.price,
      totalEarnings: course.price * course.enrolledCount,
    }));

    // Calculate monthly earnings using aggregation
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);

    const monthlyEarningsAgg = await Enrollment.aggregate([
      {
        $match: {
          courseId: { $in: courses.map(c => c._id) },
          enrolledAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      {
        $unwind: '$course'
      },
      {
        $group: {
          _id: {
            year: { $year: '$enrolledAt' },
            month: { $month: '$enrolledAt' }
          },
          earnings: { $sum: '$course.price' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Format for frontend (ensure last 6 months exist even if 0 earnings)
    const monthlyEarnings = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // 1-based

      const found = monthlyEarningsAgg.find(m => m._id.year === year && m._id.month === month);

      monthlyEarnings.push({
        name: d.toLocaleString('default', { month: 'short' }), // Jan, Feb
        revenue: found ? found.earnings : 0,
        month: d.toISOString()
      });
    }

    res.status(200).json({
      success: true,
      earnings: {
        byCourse: earningsByCourse,
        monthly: monthlyEarnings,
        total: earningsByCourse.reduce((sum, c) => sum + c.totalEarnings, 0),
      },
    });
  } catch (error) {
    console.error('Get earnings overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get student engagement/performance metrics (for chart)
// @route   GET /api/dashboard/performance
export const getStudentPerformance = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const courses = await Course.find({ tutorId: tutor._id }).select('_id').lean();
    const courseIds = courses.map((course) => course._id);
    if (courseIds.length === 0) {
      return res.status(200).json({
        success: true,
        performance: [],
      });
    }

    const trackedEventTypes = ['exam_submitted', 'assignment_submitted', 'live_class_joined', 'attendance_marked'];

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const todayUtcKey = now.toISOString().split('T')[0];
    const todayUtcStart = new Date(`${todayUtcKey}T00:00:00.000Z`);

    const historicalDailyRows = await LearningEventDailyAggregate.find({
      courseId: { $in: courseIds },
      eventType: { $in: trackedEventTypes },
      date: {
        $gte: new Date(startDate.toISOString().split('T')[0] + 'T00:00:00.000Z'),
        $lt: todayUtcStart,
      },
    }).select('date eventType count').lean();

    const todayRows = await LearningEvent.aggregate([
      {
        $match: {
          courseId: { $in: courseIds },
          createdAt: { $gte: todayUtcStart, $lte: now },
          eventType: { $in: trackedEventTypes },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const uniqueStudentRows = await LearningEvent.aggregate([
      {
        $match: {
          courseId: { $in: courseIds },
          createdAt: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
          },
          uniqueStudents: { $addToSet: '$userId' },
        },
      },
    ]);

    const dayMap = new Map();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayKey = d.toISOString().split('T')[0];
      dayMap.set(dayKey, {
        name: d.toLocaleString('default', { weekday: 'short' }),
        students: 0,
        quizzes: 0,
        assignments: 0,
        liveClasses: 0,
        attendance: 0,
      });
    }

    historicalDailyRows.forEach((row) => {
      const dayKey = new Date(row.date).toISOString().split('T')[0];
      const dayEntry = dayMap.get(dayKey);
      if (!dayEntry) return;

      if (row.eventType === 'exam_submitted') dayEntry.quizzes += row.count;
      if (row.eventType === 'assignment_submitted') dayEntry.assignments += row.count;
      if (row.eventType === 'live_class_joined') dayEntry.liveClasses += row.count;
      if (row.eventType === 'attendance_marked') dayEntry.attendance += row.count;
    });

    todayRows.forEach((row) => {
      const dayKey = row._id.day;
      const dayEntry = dayMap.get(dayKey);
      if (!dayEntry) return;

      if (row._id.eventType === 'exam_submitted') dayEntry.quizzes += row.count;
      if (row._id.eventType === 'assignment_submitted') dayEntry.assignments += row.count;
      if (row._id.eventType === 'live_class_joined') dayEntry.liveClasses += row.count;
      if (row._id.eventType === 'attendance_marked') dayEntry.attendance += row.count;
    });

    const uniqueByDay = new Map();
    uniqueStudentRows.forEach((row) => {
      const daySet = new Set(
        (row.uniqueStudents || [])
          .filter(Boolean)
          .map((studentId) => studentId.toString())
      );
      uniqueByDay.set(row._id.day, daySet);
    });

    const performanceData = Array.from(dayMap.entries()).map(([dayKey, data]) => {
      const uniqueStudents = uniqueByDay.get(dayKey);
      return {
        ...data,
        students: uniqueStudents ? uniqueStudents.size : 0,
      };
    });

    res.status(200).json({
      success: true,
      performance: performanceData
    });

  } catch (error) {
    console.error('Get performance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Export tutor analytics report as CSV
// @route   GET /api/tutor/dashboard/export
export const exportAnalyticsReport = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const now = new Date();
    const courses = await Course.find({ tutorId: tutor._id })
      .select('title enrolledCount price rating reviewCount status level')
      .lean();

    const publishedCourses = courses.filter((course) => course.status === 'published').length;
    const draftCourses = courses.filter((course) => course.status === 'draft').length;
    const totalStudents = courses.reduce((sum, course) => sum + (course.enrolledCount || 0), 0);
    const totalRevenue = courses.reduce((sum, course) => sum + ((course.price || 0) * (course.enrolledCount || 0)), 0);
    const ratedCourses = courses.filter((course) => Number(course.rating) > 0);
    const averageRating = ratedCourses.length > 0
      ? (ratedCourses.reduce((sum, course) => sum + Number(course.rating || 0), 0) / ratedCourses.length).toFixed(2)
      : '0.00';
    const totalReviews = courses.reduce((sum, course) => sum + (course.reviewCount || 0), 0);
    const courseIds = courses.map((course) => course._id);

    // Monthly revenue for last 6 months
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);

    const monthlyEarningsAgg = courseIds.length > 0
      ? await Enrollment.aggregate([
          {
            $match: {
              courseId: { $in: courseIds },
              enrolledAt: { $gte: sixMonthsAgo },
            },
          },
          {
            $lookup: {
              from: 'courses',
              localField: 'courseId',
              foreignField: '_id',
              as: 'course',
            },
          },
          { $unwind: '$course' },
          {
            $group: {
              _id: {
                year: { $year: '$enrolledAt' },
                month: { $month: '$enrolledAt' },
              },
              revenue: { $sum: '$course.price' },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ])
      : [];

    const monthlyRevenueRows = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const found = monthlyEarningsAgg.find((row) => row._id.year === year && row._id.month === month);
      monthlyRevenueRows.push({
        monthLabel: d.toLocaleString('default', { month: 'short' }),
        monthKey: `${year}-${String(month).padStart(2, '0')}`,
        revenue: found ? found.revenue : 0,
      });
    }

    // 7-day engagement
    const trackedEventTypes = ['exam_submitted', 'assignment_submitted', 'live_class_joined', 'attendance_marked'];
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const eventRows = courseIds.length > 0
      ? await LearningEvent.aggregate([
          {
            $match: {
              courseId: { $in: courseIds },
              createdAt: { $gte: startDate, $lte: now },
              eventType: { $in: trackedEventTypes },
            },
          },
          {
            $group: {
              _id: {
                day: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: 'UTC',
                  },
                },
                eventType: '$eventType',
              },
              count: { $sum: 1 },
            },
          },
        ])
      : [];

    const uniqueStudentRows = courseIds.length > 0
      ? await LearningEvent.aggregate([
          {
            $match: {
              courseId: { $in: courseIds },
              createdAt: { $gte: startDate, $lte: now },
            },
          },
          {
            $group: {
              _id: {
                day: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: 'UTC',
                  },
                },
              },
              uniqueStudents: { $addToSet: '$userId' },
            },
          },
        ])
      : [];

    const engagementMap = new Map();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayKey = d.toISOString().split('T')[0];
      engagementMap.set(dayKey, {
        date: dayKey,
        weekday: d.toLocaleString('default', { weekday: 'short' }),
        students: 0,
        quizzes: 0,
        assignments: 0,
        liveClasses: 0,
        attendance: 0,
      });
    }

    eventRows.forEach((row) => {
      const dayData = engagementMap.get(row._id.day);
      if (!dayData) return;
      if (row._id.eventType === 'exam_submitted') dayData.quizzes += row.count;
      if (row._id.eventType === 'assignment_submitted') dayData.assignments += row.count;
      if (row._id.eventType === 'live_class_joined') dayData.liveClasses += row.count;
      if (row._id.eventType === 'attendance_marked') dayData.attendance += row.count;
    });

    uniqueStudentRows.forEach((row) => {
      const dayData = engagementMap.get(row._id.day);
      if (!dayData) return;
      dayData.students = (row.uniqueStudents || []).filter(Boolean).length;
    });

    const lines = [];

    lines.push(buildCsvLine(['Tutor Analytics Export']));
    lines.push(buildCsvLine(['Generated At', now.toISOString()]));
    lines.push('');

    lines.push(buildCsvLine(['Summary']));
    lines.push(buildCsvLine(['Metric', 'Value']));
    lines.push(buildCsvLine(['Total Courses', courses.length]));
    lines.push(buildCsvLine(['Published Courses', publishedCourses]));
    lines.push(buildCsvLine(['Draft Courses', draftCourses]));
    lines.push(buildCsvLine(['Active Learners', totalStudents]));
    lines.push(buildCsvLine(['Total Revenue', totalRevenue]));
    lines.push(buildCsvLine(['Average Rating', averageRating]));
    lines.push(buildCsvLine(['Total Reviews', totalReviews]));
    lines.push('');

    lines.push(buildCsvLine(['Monthly Revenue (Last 6 Months)']));
    lines.push(buildCsvLine(['Month', 'Month Key', 'Revenue']));
    monthlyRevenueRows.forEach((row) => {
      lines.push(buildCsvLine([row.monthLabel, row.monthKey, row.revenue]));
    });
    lines.push('');

    lines.push(buildCsvLine(['Course Performance']));
    lines.push(buildCsvLine(['Course Title', 'Status', 'Level', 'Enrollments', 'Price', 'Total Earnings', 'Rating', 'Reviews']));
    courses.forEach((course) => {
      lines.push(buildCsvLine([
        course.title || 'Untitled Course',
        course.status || 'draft',
        course.level || 'beginner',
        course.enrolledCount || 0,
        course.price || 0,
        (course.price || 0) * (course.enrolledCount || 0),
        Number(course.rating || 0).toFixed(1),
        course.reviewCount || 0,
      ]));
    });
    lines.push('');

    lines.push(buildCsvLine(['Student Engagement (Last 7 Days)']));
    lines.push(buildCsvLine(['Date', 'Weekday', 'Unique Students', 'Quiz Submissions', 'Assignment Submissions', 'Live Class Joins', 'Attendance Marks']));
    Array.from(engagementMap.values()).forEach((row) => {
      lines.push(buildCsvLine([
        row.date,
        row.weekday,
        row.students,
        row.quizzes,
        row.assignments,
        row.liveClasses,
        row.attendance,
      ]));
    });

    const fileDate = now.toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"tutor-analytics-${fileDate}.csv\"`);
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    console.error('Export tutor analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export analytics',
    });
  }
};

// @desc    Get tutor reports summary with at-risk students
// @route   GET /api/tutor/dashboard/reports/summary
export const getTutorReportsSummary = async (req, res) => {
  try {
    const payload = await buildTutorReportsPayload(req.user.id);
    if (!payload) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    return res.status(200).json({
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('Get tutor reports summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load reports summary',
    });
  }
};

// @desc    Get tutor student performance report
// @route   GET /api/tutor/dashboard/reports/students
export const getTutorStudentPerformanceReport = async (req, res) => {
  try {
    const payload = await buildTutorReportsPayload(req.user.id);
    if (!payload) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const riskFilter = String(req.query.risk || 'all').toLowerCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const sortBy = String(req.query.sortBy || 'riskScore');
    const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    let students = [...(payload.studentReports || [])];

    if (riskFilter === 'high' || riskFilter === 'medium' || riskFilter === 'low') {
      students = students.filter((student) => student.riskLevel === riskFilter);
    } else if (riskFilter === 'at-risk' || riskFilter === 'atrisk') {
      students = students.filter((student) => student.riskLevel === 'high' || student.riskLevel === 'medium');
    }

    if (search) {
      students = students.filter((student) => {
        const courseText = (student.courses || []).join(' ').toLowerCase();
        return (
          String(student.name || '').toLowerCase().includes(search)
          || String(student.email || '').toLowerCase().includes(search)
          || courseText.includes(search)
        );
      });
    }

    const scoreForSort = (student) => {
      if (sortBy === 'progress') return Number(student.indicators?.progress || 0);
      if (sortBy === 'examAverage') return Number(student.indicators?.examAverage ?? -1);
      if (sortBy === 'assignmentRate') return Number(student.indicators?.assignmentRate || 0);
      if (sortBy === 'attendanceRate') return Number(student.indicators?.attendanceRate || 0);
      if (sortBy === 'inactivityDays') return Number(student.indicators?.inactivityDays ?? -1);
      if (sortBy === 'name') return String(student.name || '').toLowerCase();
      return Number(student.riskScore || 0);
    };

    students.sort((a, b) => {
      const left = scoreForSort(a);
      const right = scoreForSort(b);
      if (typeof left === 'string' && typeof right === 'string') {
        return sortOrder === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
      }
      return sortOrder === 'asc' ? left - right : right - left;
    });

    return res.status(200).json({
      success: true,
      report: payload.report,
      summary: {
        totalStudents: payload.studentReports?.length || 0,
        filteredStudents: students.length,
        highRiskCount: payload.report?.students?.highRiskCount || 0,
        mediumRiskCount: payload.report?.students?.mediumRiskCount || 0,
        lowRiskCount: payload.report?.students?.lowRiskCount || 0,
        atRiskCount: payload.report?.students?.atRiskCount || 0,
      },
      students,
    });
  } catch (error) {
    console.error('Get tutor student performance report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load student performance report',
    });
  }
};

// @desc    Get tutor at-risk students report with intervention actions
// @route   GET /api/tutor/dashboard/reports/at-risk
export const getTutorAtRiskStudents = async (req, res) => {
  try {
    const payload = await buildTutorReportsPayload(req.user.id);
    if (!payload) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const tutorProfile = await Tutor.findOne({ userId: req.user.id })
      .select('blockedStudents')
      .lean();
    const blockedSet = new Set((tutorProfile?.blockedStudents || []).map((studentId) => studentId.toString()));

    const riskFilter = String(req.query.risk || 'all').toLowerCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const sortBy = String(req.query.sortBy || 'riskScore');
    const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const minRiskScore = Math.max(0, Math.min(100, Number(req.query.minRiskScore || 0)));
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 30)));

    const recommendActions = (student) => {
      const actions = [];
      const inactivityDays = Number(student.indicators?.inactivityDays ?? -1);
      const progress = Number(student.indicators?.progress || 0);
      const examAverage = Number(student.indicators?.examAverage ?? -1);
      const assignmentRate = Number(student.indicators?.assignmentRate || 0);
      const attendanceRate = Number(student.indicators?.attendanceRate || 0);

      if (inactivityDays >= 10) actions.push('Reach out via direct message within 24 hours');
      if (progress < 55) actions.push('Assign a short remedial study plan and track completion');
      if (examAverage === -1) actions.push('Prompt student to attempt pending exam');
      else if (examAverage < 55) actions.push('Schedule an exam-focused revision session');
      if (assignmentRate < 70) actions.push('Follow up on assignment submission discipline');
      if (attendanceRate > 0 && attendanceRate < 75) actions.push('Counsel on attendance consistency and class participation');
      if (actions.length === 0) actions.push('Monitor weekly and provide positive reinforcement');

      return actions.slice(0, 3);
    };

    const priorityFor = (student) => {
      const inactivityDays = Number(student.indicators?.inactivityDays ?? -1);
      const riskScore = Number(student.riskScore || 0);
      if (riskScore >= 80 || inactivityDays >= 21) return 'critical';
      if (riskScore >= 65 || inactivityDays >= 14) return 'high';
      return 'moderate';
    };

    let students = [...(payload.atRiskStudents || [])];

    if (riskFilter === 'high' || riskFilter === 'medium') {
      students = students.filter((student) => student.riskLevel === riskFilter);
    }

    students = students.filter((student) => Number(student.riskScore || 0) >= minRiskScore);

    if (search) {
      students = students.filter((student) => {
        const reasonText = (student.reasons || []).join(' ').toLowerCase();
        const courseText = (student.courses || []).join(' ').toLowerCase();
        return (
          String(student.name || '').toLowerCase().includes(search)
          || String(student.email || '').toLowerCase().includes(search)
          || reasonText.includes(search)
          || courseText.includes(search)
        );
      });
    }

    const valueForSort = (student) => {
      if (sortBy === 'name') return String(student.name || '').toLowerCase();
      if (sortBy === 'inactivityDays') return Number(student.indicators?.inactivityDays ?? -1);
      if (sortBy === 'progress') return Number(student.indicators?.progress || 0);
      if (sortBy === 'examAverage') return Number(student.indicators?.examAverage ?? -1);
      if (sortBy === 'assignmentRate') return Number(student.indicators?.assignmentRate || 0);
      if (sortBy === 'attendanceRate') return Number(student.indicators?.attendanceRate || 0);
      return Number(student.riskScore || 0);
    };

    students.sort((a, b) => {
      const left = valueForSort(a);
      const right = valueForSort(b);
      if (typeof left === 'string' && typeof right === 'string') {
        return sortOrder === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
      }
      return sortOrder === 'asc' ? left - right : right - left;
    });

    const total = students.length;
    const start = (page - 1) * limit;
    const paged = students.slice(start, start + limit).map((student) => ({
      ...student,
      isBlockedByTutor: blockedSet.has(String(student.studentId)),
      interventionPriority: priorityFor(student),
      recommendedActions: recommendActions(student),
    }));

    return res.status(200).json({
      success: true,
      summary: {
        totalStudents: payload.studentReports?.length || 0,
        atRiskCount: payload.report?.students?.atRiskCount || 0,
        highRiskCount: payload.report?.students?.highRiskCount || 0,
        mediumRiskCount: payload.report?.students?.mediumRiskCount || 0,
        lowRiskCount: payload.report?.students?.lowRiskCount || 0,
        filteredAtRiskCount: total,
      },
      pagination: {
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        limit,
      },
      students: paged,
    });
  } catch (error) {
    console.error('Get tutor at-risk students error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load at-risk students report',
    });
  }
};

// @desc    Get tutor attendance report
// @route   GET /api/tutor/dashboard/reports/attendance
export const getTutorAttendanceReport = async (req, res) => {
  try {
    const payload = await buildTutorAttendanceReportPayload(req.user.id);
    if (!payload) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const riskFilter = String(req.query.risk || 'all').toLowerCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const sortBy = String(req.query.sortBy || 'overallRate');
    const sortOrder = String(req.query.sortOrder || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';

    let students = [...(payload.studentReports || [])];

    if (riskFilter === 'high' || riskFilter === 'medium' || riskFilter === 'low') {
      students = students.filter((student) => student.riskLevel === riskFilter);
    } else if (riskFilter === 'at-risk' || riskFilter === 'atrisk') {
      students = students.filter((student) => student.riskLevel === 'high' || student.riskLevel === 'medium');
    }

    if (search) {
      students = students.filter((student) => {
        const courseText = (student.courses || []).join(' ').toLowerCase();
        const batchText = (student.batches || []).join(' ').toLowerCase();
        return (
          String(student.name || '').toLowerCase().includes(search)
          || String(student.email || '').toLowerCase().includes(search)
          || courseText.includes(search)
          || batchText.includes(search)
        );
      });
    }

    const valueForSort = (student) => {
      if (sortBy === 'name') return String(student.name || '').toLowerCase();
      if (sortBy === 'liveRate') return Number(student.attendance?.liveRate || 0);
      if (sortBy === 'batchRate') return Number(student.attendance?.batchRate || 0);
      if (sortBy === 'inactivityDays') return Number(student.inactivityDays ?? -1);
      return Number(student.attendance?.overallRate || 0);
    };

    students.sort((a, b) => {
      const left = valueForSort(a);
      const right = valueForSort(b);
      if (typeof left === 'string' && typeof right === 'string') {
        return sortOrder === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
      }
      return sortOrder === 'asc' ? left - right : right - left;
    });

    return res.status(200).json({
      success: true,
      generatedAt: payload.generatedAt,
      summary: {
        ...payload.summary,
        filteredStudents: students.length,
      },
      courseReports: payload.courseReports,
      batchReports: payload.batchReports,
      lowAttendanceStudents: payload.lowAttendanceStudents,
      students,
    });
  } catch (error) {
    console.error('Get tutor attendance report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load attendance report',
    });
  }
};

// @desc    Export tutor attendance report as CSV
// @route   GET /api/tutor/dashboard/reports/attendance/export
export const exportTutorAttendanceReport = async (req, res) => {
  try {
    const payload = await buildTutorAttendanceReportPayload(req.user.id);
    if (!payload) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const now = new Date();
    const lines = [];

    lines.push(buildCsvLine(['Tutor Attendance Report Export']));
    lines.push(buildCsvLine(['Generated At', payload.generatedAt]));
    lines.push('');

    lines.push(buildCsvLine(['Summary']));
    lines.push(buildCsvLine(['Metric', 'Value']));
    lines.push(buildCsvLine(['Total Courses', payload.summary.totalCourses]));
    lines.push(buildCsvLine(['Total Batches', payload.summary.totalBatches]));
    lines.push(buildCsvLine(['Total Students', payload.summary.totalStudents]));
    lines.push(buildCsvLine(['Live Sessions', payload.summary.liveSessions]));
    lines.push(buildCsvLine(['Batch Sessions', payload.summary.batchSessions]));
    lines.push(buildCsvLine(['Live Attendance Rate (%)', payload.summary.liveAttendanceRate]));
    lines.push(buildCsvLine(['Batch Attendance Rate (%)', payload.summary.batchAttendanceRate]));
    lines.push(buildCsvLine(['Overall Attendance Rate (%)', payload.summary.overallAttendanceRate]));
    lines.push(buildCsvLine(['Low Attendance Students', payload.summary.lowAttendanceStudents]));
    lines.push('');

    lines.push(buildCsvLine(['Course Attendance Reports']));
    lines.push(buildCsvLine([
      'Course',
      'Status',
      'Enrolled Students',
      'Live Sessions',
      'Batch Sessions',
      'Live Attendance Rate (%)',
      'Batch Attendance Rate (%)',
      'Overall Attendance Rate (%)',
      'Tracked Entries',
    ]));
    payload.courseReports.forEach((course) => {
      lines.push(buildCsvLine([
        course.title,
        course.status,
        course.enrolledStudents,
        course.liveSessions,
        course.batchSessions,
        course.liveAttendanceRate,
        course.batchAttendanceRate,
        course.overallAttendanceRate,
        course.trackedEntries,
      ]));
    });
    lines.push('');

    lines.push(buildCsvLine(['Batch Attendance Reports']));
    lines.push(buildCsvLine([
      'Batch',
      'Course',
      'Students',
      'Sessions',
      'Tracked Entries',
      'Present Entries',
      'Absent Entries',
      'Late Entries',
      'Attendance Rate (%)',
      'Last Session At',
    ]));
    payload.batchReports.forEach((batch) => {
      lines.push(buildCsvLine([
        batch.batchName,
        batch.courseTitle,
        batch.students,
        batch.sessions,
        batch.trackedEntries,
        batch.presentEntries,
        batch.absentEntries,
        batch.lateEntries,
        batch.attendanceRate,
        batch.lastSessionAt || 'N/A',
      ]));
    });
    lines.push('');

    lines.push(buildCsvLine(['Student Attendance Reports']));
    lines.push(buildCsvLine([
      'Student Name',
      'Email',
      'Risk Level',
      'Overall Rate (%)',
      'Live Rate (%)',
      'Batch Rate (%)',
      'Tracked Sessions',
      'Present Sessions',
      'Absences',
      'Late Marks',
      'Inactivity Days',
      'Last Attendance At',
      'Courses',
      'Batches',
      'Reasons',
    ]));
    payload.studentReports.forEach((student) => {
      lines.push(buildCsvLine([
        student.name,
        student.email,
        student.riskLevel,
        student.attendance?.overallRate ?? 0,
        student.attendance?.liveRate ?? 0,
        student.attendance?.batchRate ?? 0,
        student.attendance?.trackedSessions ?? 0,
        student.attendance?.presentSessions ?? 0,
        student.attendance?.absentCount ?? 0,
        student.attendance?.lateCount ?? 0,
        student.inactivityDays ?? 'N/A',
        student.lastAttendanceAt || 'N/A',
        (student.courses || []).join(' | '),
        (student.batches || []).join(' | '),
        (student.reasons || []).join(' | '),
      ]));
    });

    const fileDate = now.toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"tutor-attendance-report-${fileDate}.csv\"`);
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    console.error('Export tutor attendance report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export attendance report',
    });
  }
};

// @desc    Export tutor reports summary as CSV
// @route   GET /api/tutor/dashboard/reports/export
export const exportTutorReports = async (req, res) => {
  try {
    const payload = await buildTutorReportsPayload(req.user.id);
    if (!payload) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const now = new Date();
    const { report, courseReports, atRiskStudents, studentReports } = payload;
    const lines = [];

    lines.push(buildCsvLine(['Tutor Reports Export']));
    lines.push(buildCsvLine(['Generated At', report.generatedAt]));
    lines.push('');

    lines.push(buildCsvLine(['Overview']));
    lines.push(buildCsvLine(['Metric', 'Value']));
    lines.push(buildCsvLine(['Total Courses', report.overview.totalCourses]));
    lines.push(buildCsvLine(['Published Courses', report.overview.publishedCourses]));
    lines.push(buildCsvLine(['Draft Courses', report.overview.draftCourses]));
    lines.push(buildCsvLine(['Total Students', report.overview.totalStudents]));
    lines.push(buildCsvLine(['Active Enrollments', report.overview.activeEnrollments]));
    lines.push(buildCsvLine(['Upcoming Classes', report.overview.upcomingClasses]));
    lines.push(buildCsvLine(['Upcoming Exams', report.overview.upcomingExams]));
    lines.push('');

    lines.push(buildCsvLine(['Course Metrics']));
    lines.push(buildCsvLine(['Average Progress (%)', report.courses.averageProgress]));
    lines.push(buildCsvLine(['Completion Rate (%)', report.courses.completionRate]));
    lines.push('');

    lines.push(buildCsvLine(['Exam Metrics']));
    lines.push(buildCsvLine(['Total Exams', report.exams.totalExams]));
    lines.push(buildCsvLine(['Total Attempts', report.exams.totalAttempts]));
    lines.push(buildCsvLine(['Average Score (%)', report.exams.averageScore]));
    lines.push(buildCsvLine(['Pass Rate (%)', report.exams.passRate]));
    lines.push('');

    lines.push(buildCsvLine(['Assignment Metrics']));
    lines.push(buildCsvLine(['Total Assignments', report.assignments.totalAssignments]));
    lines.push(buildCsvLine(['Total Submissions', report.assignments.totalSubmissions]));
    lines.push(buildCsvLine(['Pending Review', report.assignments.pendingReview]));
    lines.push(buildCsvLine(['Submission Rate (%)', report.assignments.submissionRate]));
    lines.push(buildCsvLine(['Grading Rate (%)', report.assignments.gradingRate]));
    lines.push('');

    lines.push(buildCsvLine(['Attendance Metrics']));
    lines.push(buildCsvLine(['Total Sessions', report.attendance.totalSessions]));
    lines.push(buildCsvLine(['Attendance Entries', report.attendance.totalEntries]));
    lines.push(buildCsvLine(['Attendance Rate (%)', report.attendance.attendanceRate]));
    lines.push('');

    lines.push(buildCsvLine(['Student Risk Metrics']));
    lines.push(buildCsvLine(['High Risk', report.students.highRiskCount]));
    lines.push(buildCsvLine(['Medium Risk', report.students.mediumRiskCount]));
    lines.push(buildCsvLine(['Low Risk', report.students.lowRiskCount]));
    lines.push(buildCsvLine(['At-Risk (High+Medium)', report.students.atRiskCount]));
    lines.push('');

    lines.push(buildCsvLine(['Course Reports']));
    lines.push(buildCsvLine([
      'Course',
      'Status',
      'Students',
      'Assignments',
      'Exams',
      'Avg Progress (%)',
      'Assignment Submission Rate (%)',
      'Avg Exam Score (%)',
      'Attendance Rate (%)',
    ]));
    courseReports.forEach((course) => {
      lines.push(buildCsvLine([
        course.title,
        course.status,
        course.students,
        course.assignmentCount,
        course.examCount,
        course.averageProgress,
        course.assignmentSubmissionRate,
        course.averageExamScore,
        course.attendanceRate,
      ]));
    });
    lines.push('');

    lines.push(buildCsvLine(['At-Risk Students']));
    lines.push(buildCsvLine([
      'Student Name',
      'Email',
      'Risk Level',
      'Risk Score',
      'Progress (%)',
      'Exam Avg (%)',
      'Assignment Rate (%)',
      'Attendance Rate (%)',
      'Inactivity Days',
      'Courses',
      'Reasons',
    ]));
    atRiskStudents.forEach((student) => {
      lines.push(buildCsvLine([
        student.name,
        student.email,
        student.riskLevel,
        student.riskScore,
        student.indicators.progress,
        student.indicators.examAverage ?? 'N/A',
        student.indicators.assignmentRate,
        student.indicators.attendanceRate,
        student.indicators.inactivityDays ?? 'N/A',
        (student.courses || []).join(' | '),
        (student.reasons || []).join(' | '),
      ]));
    });
    lines.push('');

    lines.push(buildCsvLine(['Student Performance (All Students)']));
    lines.push(buildCsvLine([
      'Student Name',
      'Email',
      'Risk Level',
      'Risk Score',
      'Progress (%)',
      'Exam Avg (%)',
      'Assignment Rate (%)',
      'Attendance Rate (%)',
      'Inactivity Days',
      'Last Activity',
      'Courses',
    ]));
    studentReports.forEach((student) => {
      lines.push(buildCsvLine([
        student.name,
        student.email,
        student.riskLevel,
        student.riskScore,
        student.indicators.progress,
        student.indicators.examAverage ?? 'N/A',
        student.indicators.assignmentRate,
        student.indicators.attendanceRate,
        student.indicators.inactivityDays ?? 'N/A',
        student.lastActivityAt || 'N/A',
        (student.courses || []).join(' | '),
      ]));
    });

    const fileDate = now.toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"tutor-reports-${fileDate}.csv\"`);
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    console.error('Export tutor reports error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export reports',
    });
  }
};

// @desc    Block a student (tutor-level)
// @route   POST /api/tutor/dashboard/students/:studentId/block
export const blockStudent = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(403).json({ success: false, message: 'Only tutors can access this endpoint' });
    }

    const { studentId } = req.params;

    // Check if already blocked
    if (tutor.blockedStudents?.includes(studentId)) {
      return res.status(400).json({ success: false, message: 'Student is already blocked' });
    }

    tutor.blockedStudents = tutor.blockedStudents || [];
    tutor.blockedStudents.push(studentId);
    await tutor.save();

    res.status(200).json({ success: true, message: 'Student blocked successfully' });
  } catch (error) {
    console.error('Block student error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Unblock a student (tutor-level)
// @route   POST /api/tutor/dashboard/students/:studentId/unblock
export const unblockStudent = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(403).json({ success: false, message: 'Only tutors can access this endpoint' });
    }

    const { studentId } = req.params;

    tutor.blockedStudents = (tutor.blockedStudents || []).filter(
      id => id.toString() !== studentId
    );
    await tutor.save();

    res.status(200).json({ success: true, message: 'Student unblocked successfully' });
  } catch (error) {
    console.error('Unblock student error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
