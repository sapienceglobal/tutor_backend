import PayoutRequest from '../models/PayoutRequest.js';
import Tutor from '../models/Tutor.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Payment from '../models/Payment.js';
import { logAdminAction } from '../utils/logger.js';

const MIN_PAYOUT_AMOUNT = 500;
const ACTIVE_PAYOUT_STATUSES = ['pending', 'processing'];

const normalizeBankDetails = (bankDetails = {}) => ({
  accountHolderName: String(bankDetails.accountHolderName || '').trim(),
  accountNumber: String(bankDetails.accountNumber || '').trim(),
  bankName: String(bankDetails.bankName || '').trim(),
  ifscCode: String(bankDetails.ifscCode || '').trim().toUpperCase(),
  upiId: String(bankDetails.upiId || '').trim(),
});

const buildCsvLine = (values = []) => values
  .map((value) => {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  })
  .join(',');

const clampMonths = (value, fallback = 6) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(24, Math.max(3, Math.floor(parsed)));
};

const buildMonthBuckets = (months = 6) => {
  const rows = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const monthKey = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    rows.push({
      monthKey,
      monthLabel: monthDate.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      revenue: 0,
      transactions: 0,
      payoutRequested: 0,
      payoutPaid: 0,
      payoutRequests: 0,
    });
  }
  return rows;
};

const getTutorByUserId = async (userId) => {
  return Tutor.findOne({ userId }).select('_id userId').lean();
};

const getTutorFinancialSummary = async (tutorId, options = {}) => {
  const months = clampMonths(options.months, 6);
  const includeDetailed = Boolean(options.includeDetailed);

  const tutorCourses = await Course.find({ tutorId }).select('_id title price enrolledCount').lean();
  const courseIds = tutorCourses.map((course) => course._id);
  const priceMap = new Map(tutorCourses.map((course) => [course._id.toString(), Number(course.price || 0)]));

  const paymentMatch = {
    type: 'course_purchase',
    status: 'paid',
    courseId: { $in: courseIds },
  };

  const payoutTotals = await PayoutRequest.aggregate([
    { $match: { tutorId } },
    { $group: { _id: '$status', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const payoutTotalsByStatus = payoutTotals.reduce((acc, row) => {
    acc[row._id] = {
      amount: Number(row.totalAmount || 0),
      count: Number(row.count || 0),
    };
    return acc;
  }, {});

  const totalRevenueAgg = courseIds.length > 0
    ? await Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
    ])
    : [];

  let totalEarnings = Number(totalRevenueAgg?.[0]?.totalRevenue || 0);
  let totalTransactions = Number(totalRevenueAgg?.[0]?.transactionCount || 0);

  if (totalEarnings <= 0 && courseIds.length > 0) {
    const enrollmentAgg = await Enrollment.aggregate([
      { $match: { courseId: { $in: courseIds } } },
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
    ]);
    const fallbackEstimated = enrollmentAgg.reduce((sum, row) => {
      return sum + (priceMap.get(String(row._id)) || 0) * Number(row.count || 0);
    }, 0);
    if (fallbackEstimated > 0) {
      totalEarnings = fallbackEstimated;
      totalTransactions = enrollmentAgg.reduce((sum, row) => sum + Number(row.count || 0), 0);
    }
  }

  const pendingAmount = (payoutTotalsByStatus.pending?.amount || 0) + (payoutTotalsByStatus.processing?.amount || 0);
  const paidAmount = payoutTotalsByStatus.paid?.amount || 0;
  const rejectedAmount = payoutTotalsByStatus.rejected?.amount || 0;
  const withdrawableBalance = Math.max(0, totalEarnings - pendingAmount - paidAmount);
  const activeRequests = (payoutTotalsByStatus.pending?.count || 0) + (payoutTotalsByStatus.processing?.count || 0);

  const summary = {
    totalEarnings,
    totalTransactions,
    pendingAmount,
    paidAmount,
    rejectedAmount,
    withdrawableBalance,
    activeRequests,
    minimumPayoutAmount: MIN_PAYOUT_AMOUNT,
  };

  if (!includeDetailed) return summary;

  const monthRows = buildMonthBuckets(months);
  const firstMonthDate = new Date(`${monthRows[0].monthKey}-01T00:00:00.000Z`);
  const rowByKey = new Map(monthRows.map((row) => [row.monthKey, row]));

  if (courseIds.length > 0) {
    const monthlyRevenueAgg = await Payment.aggregate([
      { $match: paymentMatch },
      {
        $addFields: {
          effectiveDate: { $ifNull: ['$paidAt', '$createdAt'] },
        },
      },
      {
        $match: {
          effectiveDate: { $gte: firstMonthDate },
        },
      },
      {
        $project: {
          amount: 1,
          monthKey: {
            $dateToString: {
              format: '%Y-%m',
              date: '$effectiveDate',
              timezone: 'UTC',
            },
          },
        },
      },
      {
        $group: {
          _id: '$monthKey',
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
        },
      },
    ]);

    monthlyRevenueAgg.forEach((row) => {
      const bucket = rowByKey.get(String(row._id));
      if (!bucket) return;
      bucket.revenue = Number(row.revenue || 0);
      bucket.transactions = Number(row.transactions || 0);
    });
  }

  const payoutRequestedAgg = await PayoutRequest.aggregate([
    {
      $match: {
        tutorId,
        createdAt: { $gte: firstMonthDate },
      },
    },
    {
      $project: {
        amount: 1,
        monthKey: {
          $dateToString: {
            format: '%Y-%m',
            date: '$createdAt',
            timezone: 'UTC',
          },
        },
      },
    },
    {
      $group: {
        _id: '$monthKey',
        payoutRequested: { $sum: '$amount' },
        payoutRequests: { $sum: 1 },
      },
    },
  ]);

  payoutRequestedAgg.forEach((row) => {
    const bucket = rowByKey.get(String(row._id));
    if (!bucket) return;
    bucket.payoutRequested = Number(row.payoutRequested || 0);
    bucket.payoutRequests = Number(row.payoutRequests || 0);
  });

  const payoutPaidAgg = await PayoutRequest.aggregate([
    {
      $match: {
        tutorId,
        status: 'paid',
        processedDate: { $gte: firstMonthDate },
      },
    },
    {
      $project: {
        amount: 1,
        monthKey: {
          $dateToString: {
            format: '%Y-%m',
            date: '$processedDate',
            timezone: 'UTC',
          },
        },
      },
    },
    {
      $group: {
        _id: '$monthKey',
        payoutPaid: { $sum: '$amount' },
      },
    },
  ]);

  payoutPaidAgg.forEach((row) => {
    const bucket = rowByKey.get(String(row._id));
    if (!bucket) return;
    bucket.payoutPaid = Number(row.payoutPaid || 0);
  });

  let courseRevenue = [];
  if (courseIds.length > 0) {
    courseRevenue = await Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: '$courseId',
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
          lastPaymentAt: { $max: { $ifNull: ['$paidAt', '$createdAt'] } },
        },
      },
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: '_id',
          as: 'course',
        },
      },
      {
        $unwind: {
          path: '$course',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          courseId: '$_id',
          title: { $ifNull: ['$course.title', 'Untitled Course'] },
          enrollments: { $ifNull: ['$course.enrolledCount', 0] },
          price: { $ifNull: ['$course.price', 0] },
          revenue: 1,
          transactions: 1,
          lastPaymentAt: 1,
        },
      },
      { $sort: { revenue: -1, title: 1 } },
    ]);
  }

  if (courseRevenue.length === 0 && tutorCourses.length > 0) {
    courseRevenue = tutorCourses
      .map((course) => ({
        courseId: course._id,
        title: course.title || 'Untitled Course',
        enrollments: Number(course.enrolledCount || 0),
        price: Number(course.price || 0),
        revenue: Number(course.price || 0) * Number(course.enrolledCount || 0),
        transactions: Number(course.enrolledCount || 0),
        lastPaymentAt: null,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  const revenueDenominator = totalEarnings > 0 ? totalEarnings : 1;
  courseRevenue = courseRevenue.map((row) => ({
    ...row,
    revenue: Number(row.revenue || 0),
    transactions: Number(row.transactions || 0),
    enrollments: Number(row.enrollments || 0),
    revenueSharePct: Number((((row.revenue || 0) / revenueDenominator) * 100).toFixed(2)),
  }));

  let recentPayments = [];
  if (courseIds.length > 0) {
    recentPayments = await Payment.find(paymentMatch)
      .populate('courseId', 'title')
      .populate('studentId', 'name email')
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(30)
      .lean();
  }

  return {
    ...summary,
    monthlyRevenue: monthRows.map((row) => ({
      monthKey: row.monthKey,
      monthLabel: row.monthLabel,
      revenue: row.revenue,
      transactions: row.transactions,
    })),
    monthlyPayouts: monthRows.map((row) => ({
      monthKey: row.monthKey,
      monthLabel: row.monthLabel,
      payoutRequested: row.payoutRequested,
      payoutPaid: row.payoutPaid,
      payoutRequests: row.payoutRequests,
    })),
    courseRevenue,
    recentPayments: recentPayments.map((payment) => ({
      _id: payment._id,
      amount: Number(payment.amount || 0),
      currency: payment.currency || 'INR',
      paidAt: payment.paidAt || payment.createdAt,
      invoiceNumber: payment.invoiceNumber || null,
      razorpayPaymentId: payment.razorpayPaymentId || null,
      course: payment.courseId
        ? { _id: payment.courseId._id || payment.courseId, title: payment.courseId.title || 'Course' }
        : null,
      student: payment.studentId
        ? {
          _id: payment.studentId._id || payment.studentId,
          name: payment.studentId.name || 'Student',
          email: payment.studentId.email || '',
        }
        : null,
    })),
  };
};

// @desc    Tutor requests a payout
// @route   POST /api/tutors/payouts/request
// @access  Private (Tutor only)
export const requestPayout = async (req, res) => {
  try {
    const requestedAmountRaw = Number(req.body.amount);
    const requestedAmount = Number(requestedAmountRaw.toFixed(2));
    const bankDetails = normalizeBankDetails(req.body.bankDetails);

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount' });
    }

    if (requestedAmount < MIN_PAYOUT_AMOUNT) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal amount is INR ${MIN_PAYOUT_AMOUNT}` });
    }

    const hasUpi = Boolean(bankDetails.upiId);
    const hasBankAccount = Boolean(
      bankDetails.accountHolderName
      && bankDetails.accountNumber
      && bankDetails.bankName
      && bankDetails.ifscCode
    );

    if (!hasUpi && !hasBankAccount) {
      return res.status(400).json({
        success: false,
        message: 'Provide valid bank details or a UPI ID to request payout',
      });
    }

    const tutor = await Tutor.findOne({ userId: req.user.id }).select('_id');
    if (!tutor) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }

    const existingActive = await PayoutRequest.findOne({
      tutorId: tutor._id,
      status: { $in: ACTIVE_PAYOUT_STATUSES },
    });
    if (existingActive) {
      return res.status(400).json({ success: false, message: 'You already have an active payout request' });
    }

    const summary = await getTutorFinancialSummary(tutor._id);
    if (requestedAmount > summary.withdrawableBalance) {
      return res.status(400).json({
        success: false,
        message: `Requested amount exceeds withdrawable balance (INR ${summary.withdrawableBalance.toLocaleString()})`,
      });
    }

    const payout = await PayoutRequest.create({
      tutorId: tutor._id,
      amount: requestedAmount,
      bankDetails,
    });

    const updatedSummary = await getTutorFinancialSummary(tutor._id);
    return res.status(201).json({
      success: true,
      payout,
      summary: updatedSummary,
      message: 'Payout requested successfully',
    });
  } catch (error) {
    console.error('Request payout error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get tutor's payout history
// @route   GET /api/tutors/payouts
// @access  Private (Tutor only)
export const getMyPayouts = async (req, res) => {
  try {
    const tutor = await getTutorByUserId(req.user.id);
    if (!tutor) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }

    const status = String(req.query.status || '').trim().toLowerCase();
    const limit = Math.min(400, Math.max(20, Number(req.query.limit || 200)));
    const filter = { tutorId: tutor._id };
    if (['pending', 'processing', 'paid', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const payouts = await PayoutRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);
    const summary = await getTutorFinancialSummary(tutor._id);

    return res.status(200).json({
      success: true,
      payouts,
      summary,
      minimumPayoutAmount: MIN_PAYOUT_AMOUNT,
    });
  } catch (error) {
    console.error('Get my payouts error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get tutor finance report (revenue + payouts + course breakdown)
// @route   GET /api/tutors/payouts/report
// @access  Private (Tutor only)
export const getTutorPayoutReport = async (req, res) => {
  try {
    const tutor = await getTutorByUserId(req.user.id);
    if (!tutor) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }

    const months = clampMonths(req.query.months, 6);
    const status = String(req.query.status || '').trim().toLowerCase();
    const payoutFilter = { tutorId: tutor._id };
    if (['pending', 'processing', 'paid', 'rejected'].includes(status)) {
      payoutFilter.status = status;
    }

    const [report, payouts] = await Promise.all([
      getTutorFinancialSummary(tutor._id, { months, includeDetailed: true }),
      PayoutRequest.find(payoutFilter).sort({ createdAt: -1 }).limit(250).lean(),
    ]);

    return res.status(200).json({
      success: true,
      months,
      generatedAt: new Date().toISOString(),
      summary: {
        totalEarnings: report.totalEarnings,
        totalTransactions: report.totalTransactions,
        pendingAmount: report.pendingAmount,
        paidAmount: report.paidAmount,
        rejectedAmount: report.rejectedAmount,
        withdrawableBalance: report.withdrawableBalance,
        activeRequests: report.activeRequests,
        minimumPayoutAmount: report.minimumPayoutAmount,
      },
      monthlyRevenue: report.monthlyRevenue || [],
      monthlyPayouts: report.monthlyPayouts || [],
      courseRevenue: report.courseRevenue || [],
      recentPayments: report.recentPayments || [],
      payouts,
    });
  } catch (error) {
    console.error('Get tutor payout report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load payout report' });
  }
};

// @desc    Export tutor payout report as CSV
// @route   GET /api/tutors/payouts/export
// @access  Private (Tutor only)
export const exportTutorPayoutReport = async (req, res) => {
  try {
    const tutor = await getTutorByUserId(req.user.id);
    if (!tutor) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }

    const months = clampMonths(req.query.months, 12);
    const report = await getTutorFinancialSummary(tutor._id, { months, includeDetailed: true });
    const payouts = await PayoutRequest.find({ tutorId: tutor._id }).sort({ createdAt: -1 }).limit(500).lean();

    const lines = [];
    lines.push(buildCsvLine(['Tutor Payout and Revenue Report']));
    lines.push(buildCsvLine(['Generated At', new Date().toISOString()]));
    lines.push('');

    lines.push(buildCsvLine(['Summary']));
    lines.push(buildCsvLine(['Metric', 'Value']));
    lines.push(buildCsvLine(['Total Earnings', report.totalEarnings]));
    lines.push(buildCsvLine(['Total Transactions', report.totalTransactions]));
    lines.push(buildCsvLine(['Withdrawable Balance', report.withdrawableBalance]));
    lines.push(buildCsvLine(['Pending Payout Amount', report.pendingAmount]));
    lines.push(buildCsvLine(['Paid Out Amount', report.paidAmount]));
    lines.push(buildCsvLine(['Rejected Amount', report.rejectedAmount]));
    lines.push(buildCsvLine(['Active Requests', report.activeRequests]));
    lines.push('');

    lines.push(buildCsvLine([`Monthly Revenue (${months} months)`]));
    lines.push(buildCsvLine(['Month', 'Month Key', 'Revenue', 'Transactions']));
    (report.monthlyRevenue || []).forEach((row) => {
      lines.push(buildCsvLine([row.monthLabel, row.monthKey, row.revenue, row.transactions]));
    });
    lines.push('');

    lines.push(buildCsvLine([`Monthly Payouts (${months} months)`]));
    lines.push(buildCsvLine(['Month', 'Month Key', 'Requested', 'Paid', 'Requests']));
    (report.monthlyPayouts || []).forEach((row) => {
      lines.push(buildCsvLine([row.monthLabel, row.monthKey, row.payoutRequested, row.payoutPaid, row.payoutRequests]));
    });
    lines.push('');

    lines.push(buildCsvLine(['Course Revenue Breakdown']));
    lines.push(buildCsvLine(['Course Title', 'Enrollments', 'Price', 'Revenue', 'Transactions', 'Revenue Share (%)']));
    (report.courseRevenue || []).forEach((row) => {
      lines.push(buildCsvLine([
        row.title,
        row.enrollments,
        row.price,
        row.revenue,
        row.transactions,
        row.revenueSharePct,
      ]));
    });
    lines.push('');

    lines.push(buildCsvLine(['Payout History']));
    lines.push(buildCsvLine(['Requested At', 'Amount', 'Status', 'Processed Date', 'Transaction ID', 'Admin Notes', 'UPI ID', 'Bank Name', 'Account Holder', 'IFSC']));
    payouts.forEach((payout) => {
      lines.push(buildCsvLine([
        payout.createdAt ? new Date(payout.createdAt).toISOString() : '',
        payout.amount || 0,
        payout.status || '',
        payout.processedDate ? new Date(payout.processedDate).toISOString() : '',
        payout.transactionId || '',
        payout.adminNotes || '',
        payout.bankDetails?.upiId || '',
        payout.bankDetails?.bankName || '',
        payout.bankDetails?.accountHolderName || '',
        payout.bankDetails?.ifscCode || '',
      ]));
    });

    const fileDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tutor-payout-report-${fileDate}.csv"`);
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    console.error('Export tutor payout report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to export payout report' });
  }
};

// @desc    Cancel own pending payout request
// @route   PATCH /api/tutors/payouts/:id/cancel
// @access  Private (Tutor only)
export const cancelMyPayoutRequest = async (req, res) => {
  try {
    const tutor = await getTutorByUserId(req.user.id);
    if (!tutor) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }

    const payout = await PayoutRequest.findOne({
      _id: req.params.id,
      tutorId: tutor._id,
    });

    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }

    if (payout.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending payout requests can be cancelled',
      });
    }

    payout.status = 'rejected';
    payout.processedDate = new Date();
    payout.adminNotes = payout.adminNotes
      ? `${payout.adminNotes}\nCancelled by tutor`
      : 'Cancelled by tutor';
    await payout.save();

    const summary = await getTutorFinancialSummary(tutor._id);

    return res.status(200).json({
      success: true,
      message: 'Payout request cancelled',
      payout,
      summary,
    });
  } catch (error) {
    console.error('Cancel payout request error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel payout request' });
  }
};

// @desc    Admin gets all payout requests
// @route   GET /api/admin/payouts
// @access  Private (Admin only)
export const getAllPayouts = async (req, res) => {
  try {
    const status = String(req.query.status || '').trim().toLowerCase();
    const search = String(req.query.search || '').trim();
    const limit = Math.min(500, Math.max(20, Number(req.query.limit || 200)));
    const page = Math.max(1, Number(req.query.page || 1));

    const filter = {};
    if (['pending', 'processing', 'paid', 'rejected'].includes(status)) {
      filter.status = status;
    }

    let payouts = await PayoutRequest.find(filter)
      .populate({
        path: 'tutorId',
        populate: { path: 'userId', select: 'name email profileImage' },
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    if (search) {
      const q = search.toLowerCase();
      payouts = payouts.filter((item) => {
        const tutorName = item.tutorId?.userId?.name || '';
        const tutorEmail = item.tutorId?.userId?.email || '';
        const bankName = item.bankDetails?.bankName || '';
        const transactionId = item.transactionId || '';
        return (
          String(tutorName).toLowerCase().includes(q)
          || String(tutorEmail).toLowerCase().includes(q)
          || String(bankName).toLowerCase().includes(q)
          || String(transactionId).toLowerCase().includes(q)
        );
      });
    }

    const total = await PayoutRequest.countDocuments(filter);

    return res.status(200).json({
      success: true,
      payouts,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get all payouts error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin updates a payout request status
// @route   PUT /api/admin/payouts/:id
// @access  Private (Admin only)
export const updatePayoutStatus = async (req, res) => {
  try {
    const { status, adminNotes, transactionId } = req.body;

    if (!['processing', 'paid', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const payout = await PayoutRequest.findById(req.params.id);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }

    if (payout.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Paid payout requests cannot be modified' });
    }

    if (status === 'paid' && !String(transactionId || '').trim()) {
      return res.status(400).json({ success: false, message: 'transactionId is required when marking payout as paid' });
    }

    payout.status = status;
    if (typeof adminNotes === 'string') payout.adminNotes = adminNotes.trim();

    if (status === 'paid') {
      payout.processedDate = new Date();
      payout.transactionId = String(transactionId).trim();
    } else if (status === 'rejected') {
      payout.processedDate = payout.processedDate || new Date();
    }

    await payout.save();

    await logAdminAction(req.user.id, 'PROCESS_PAYOUT', 'payout', payout._id, {
      status,
      amount: payout.amount,
      tutorId: payout.tutorId,
    });

    return res.status(200).json({
      success: true,
      payout,
      message: `Payout marked as ${status}`,
    });
  } catch (error) {
    console.error('Update payout error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
