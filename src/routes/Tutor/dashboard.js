import express from 'express';
import {
  getTutorStats,
  getRecentActivities,
  getEarningsOverview,
  getTutorStudents,
  getStudentPerformance,
  exportAnalyticsReport,
  getTutorReportsSummary,
  getTutorStudentPerformanceReport,
  getTutorAtRiskStudents,
  getTutorAttendanceReport,
  exportTutorReports,
  exportTutorAttendanceReport,
  blockStudent,
  unblockStudent
} from '../../controllers/Tutor/dashboardController.js';
import { protect, authorize } from '../../middleware/auth.js';

const router = express.Router();

// All routes are protected and restricted to tutors only
router.use(protect, authorize('tutor'));

router.get('/stats', getTutorStats);
router.get('/activities', getRecentActivities);
router.get('/earnings', getEarningsOverview);
router.get('/students', getTutorStudents);
router.get('/performance', getStudentPerformance);
router.get('/export', exportAnalyticsReport);
router.get('/reports/summary', getTutorReportsSummary);
router.get('/reports/students', getTutorStudentPerformanceReport);
router.get('/reports/at-risk', getTutorAtRiskStudents);
router.get('/reports/attendance', getTutorAttendanceReport);
router.get('/reports/attendance/export', exportTutorAttendanceReport);
router.get('/reports/export', exportTutorReports);
router.post('/students/:studentId/block', blockStudent);
router.post('/students/:studentId/unblock', unblockStudent);

export default router;
