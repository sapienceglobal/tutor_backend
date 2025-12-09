// import { Exam, ExamAttempt } from '../models/Exam.js';
// import Course from '../models/Course.js';
// import Enrollment from '../models/Enrollment.js';

// // @desc    Get all exams for a course (Tutor)
// // @route   GET /api/exams/course/:courseId
// export const getExamsByCourse = async (req, res) => {
//   try {
//     const { courseId } = req.params;

//     const course = await Course.findById(courseId).populate('tutorId');
//     if (!course) {
//       return res.status(404).json({
//         success: false,
//         message: 'Course not found',
//       });
//     }

//     // Check if user owns the course
//     const isOwner = course.tutorId.userId.toString() === req.user.id;
    
//     if (!isOwner) {
//       return res.status(403).json({
//         success: false,
//         message: 'Not authorized to view exams for this course',
//       });
//     }

//     const exams = await Exam.find({ courseId })
//       .sort({ createdAt: -1 });

//     res.status(200).json({
//       success: true,
//       count: exams.length,
//       exams,
//     });
//   } catch (error) {
//     console.error('Get exams error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// };

// // @desc    Get single exam
// // @route   GET /api/exams/:id
// export const getExamById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const exam = await Exam.findById(id).populate('courseId');

//     if (!exam) {
//       return res.status(404).json({
//         success: false,
//         message: 'Exam not found',
//       });
//     }

//     // Check access rights
//     const course = await Course.findById(exam.courseId).populate('tutorId');
//     const isOwner = course.tutorId.userId.toString() === req.user.id;
    
//     let enrollment = null;
//     if (!isOwner) {
//       enrollment = await Enrollment.findOne({
//         studentId: req.user.id,
//         courseId: exam.courseId._id,
//       });

//       if (!enrollment) {
//         return res.status(403).json({
//           success: false,
//           message: 'Enroll in the course to access this exam',
//         });
//       }
//     }

//     // Get student's attempts if not owner
//     let attempts = [];
//     if (!isOwner) {
//       attempts = await ExamAttempt.find({
//         examId: id,
//         studentId: req.user.id,
//       }).sort({ createdAt: -1 });
//     }

//     // Hide correct answers for students until after submission
//     let examData = exam.toObject();
//     if (!isOwner && !exam.showCorrectAnswers) {
//       examData.questions = examData.questions.map(q => ({
//         ...q,
//         options: q.options.map(opt => ({
//           text: opt.text,
//           _id: opt._id,
//         })),
//       }));
//     }

//     res.status(200).json({
//       success: true,
//       exam: examData,
//       attempts,
//       remainingAttempts: exam.maxAttempts - attempts.length,
//     });
//   } catch (error) {
//     console.error('Get exam error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// };

// // @desc    Create exam (Tutor only)
// // @route   POST /api/exams
// export const createExam = async (req, res) => {
//   try {
//     const {
//       courseId,
//       title,
//       description,
//       type,
//       instructions,
//       duration,
//       passingMarks,
//       questions,
//       shuffleQuestions,
//       shuffleOptions,
//       showResultImmediately,
//       showCorrectAnswers,
//       allowRetake,
//       maxAttempts,
//       startDate,
//       endDate,
//     } = req.body;

//     if (!courseId || !title || !duration || questions.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Course ID, title, duration, and questions are required',
//       });
//     }

//     // Check if course exists and user owns it
//     const course = await Course.findById(courseId).populate('tutorId');
//     if (!course) {
//       return res.status(404).json({
//         success: false,
//         message: 'Course not found',
//       });
//     }

//     if (course.tutorId.userId.toString() !== req.user.id) {
//       return res.status(403).json({
//         success: false,
//         message: 'Not authorized to create exam for this course',
//       });
//     }

//     const exam = await Exam.create({
//       courseId,
//       tutorId: course.tutorId._id,
//       title,
//       description,
//       type: type || 'assessment',
//       instructions,
//       duration,
//       passingMarks,
//       questions,
//       shuffleQuestions: shuffleQuestions || false,
//       shuffleOptions: shuffleOptions || false,
//       showResultImmediately: showResultImmediately || false,
//       showCorrectAnswers: showCorrectAnswers || true,
//       allowRetake: allowRetake || false,
//       maxAttempts: maxAttempts || 1,
//       startDate,
//       endDate,
//       isScheduled: !!(startDate && endDate),
//     });

//     res.status(201).json({
//       success: true,
//       message: 'Exam created successfully',
//       exam,
//     });
//   } catch (error) {
//     console.error('Create exam error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// };

// // @desc    Update exam (Tutor only)
// // @route   PATCH /api/exams/:id
// export const updateExam = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const exam = await Exam.findById(id).populate({
//       path: 'courseId',
//       populate: {
//         path: 'tutorId',
//       },
//     });

//     if (!exam) {
//       return res.status(404).json({
//         success: false,
//         message: 'Exam not found',
//       });
//     }

//     // Check if user owns the course
//     if (exam.courseId.tutorId.userId.toString() !== req.user.id) {
//       return res.status(403).json({
//         success: false,
//         message: 'Not authorized to update this exam',
//       });
//     }

//     const allowedUpdates = [
//       'title', 'description', 'type', 'instructions', 'duration',
//       'passingMarks', 'questions', 'shuffleQuestions', 'shuffleOptions',
//       'showResultImmediately', 'showCorrectAnswers', 'allowRetake',
//       'maxAttempts', 'startDate', 'endDate', 'isScheduled', 'status', 'isPublished',
//     ];

//     allowedUpdates.forEach(field => {
//       if (req.body[field] !== undefined) {
//         exam[field] = req.body[field];
//       }
//     });

//     await exam.save();

//     res.status(200).json({
//       success: true,
//       message: 'Exam updated successfully',
//       exam,
//     });
//   } catch (error) {
//     console.error('Update exam error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// };

// // @desc    Delete exam (Tutor only)
// // @route   DELETE /api/exams/:id
// export const deleteExam = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const exam = await Exam.findById(id).populate({
//       path: 'courseId',
//       populate: {
//         path: 'tutorId',
//       },
//     });

//     if (!exam) {
//       return res.status(404).json({
//         success: false,
//         message: 'Exam not found',
//       });
//     }

//     // Check if user owns the course
//     if (exam.courseId.tutorId.userId.toString() !== req.user.id) {
//       return res.status(403).json({
//         success: false,
//         message: 'Not authorized to delete this exam',
//       });
//     }

//     // Delete all attempts for this exam
//     await ExamAttempt.deleteMany({ examId: id });

//     await exam.deleteOne();

//     res.status(200).json({
//       success: true,
//       message: 'Exam deleted successfully',
//     });
//   } catch (error) {
//     console.error('Delete exam error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// };

// // @desc    Submit exam (Student)
// // @route   POST /api/exams/:id/submit
// export const submitExam = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { answers, timeSpent, startedAt } = req.body;

//     const exam = await Exam.findById(id);
//     if (!exam) {
//       return res.status(404).json({
//         success: false,
//         message: 'Exam not found',
//       });
//     }

//     // Check enrollment
//     const enrollment = await Enrollment.findOne({
//       studentId: req.user.id,
//       courseId: exam.courseId,
//     });

//     if (!enrollment) {
//       return res.status(403).json({
//         success: false,
//         message: 'You must be enrolled in the course to take this exam',
//       });
//     }

//     // Check previous attempts
//     const attemptCount = await ExamAttempt.countDocuments({
//       examId: id,
//       studentId: req.user.id,
//     });

//     if (!exam.allowRetake && attemptCount > 0) {
//       return res.status(403).json({
//         success: false,
//         message: 'You have already taken this exam',
//       });
//     }

//     if (exam.maxAttempts && attemptCount >= exam.maxAttempts) {
//       return res.status(403).json({
//         success: false,
//         message: 'Maximum attempts reached',
//       });
//     }

//     // Calculate score
//     let score = 0;
//     const processedAnswers = answers.map((ans) => {
//       const question = exam.questions.id(ans.questionId);
//       const isCorrect = question.options[ans.selectedOption]?.isCorrect || false;
//       const pointsEarned = isCorrect ? (question.points || 1) : 0;
//       score += pointsEarned;

//       return {
//         questionId: ans.questionId,
//         selectedOption: ans.selectedOption,
//         isCorrect,
//         pointsEarned,
//       };
//     });

//     const percentage = Math.round((score / exam.totalMarks) * 100);
//     const isPassed = score >= exam.passingMarks;

//     // Create attempt
//     const attempt = await ExamAttempt.create({
//       examId: id,
//       studentId: req.user.id,
//       courseId: exam.courseId,
//       attemptNumber: attemptCount + 1,
//       answers: processedAnswers,
//       score,
//       percentage,
//       isPassed,
//       timeSpent,
//       startedAt: new Date(startedAt),
//       submittedAt: new Date(),
//     });

//     // Update exam statistics
//     exam.attemptCount += 1;
//     const allAttempts = await ExamAttempt.find({ examId: id });
//     exam.averageScore = allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length;
//     await exam.save();

//     res.status(200).json({
//       success: true,
//       message: 'Exam submitted successfully',
//       attempt: {
//         score,
//         percentage,
//         isPassed,
//         totalMarks: exam.totalMarks,
//         passingMarks: exam.passingMarks,
//         answers: exam.showCorrectAnswers ? processedAnswers : undefined,
//       },
//     });
//   } catch (error) {
//     console.error('Submit exam error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// };

// // @desc    Get exam attempts (Student or Tutor)
// // @route   GET /api/exams/:id/attempts
// export const getExamAttempts = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const exam = await Exam.findById(id).populate({
//       path: 'courseId',
//       populate: {
//         path: 'tutorId',
//       },
//     });

//     if (!exam) {
//       return res.status(404).json({
//         success: false,
//         message: 'Exam not found',
//       });
//     }

//     const isOwner = exam.courseId.tutorId.userId.toString() === req.user.id;

//     let attempts;
//     if (isOwner) {
//       // Tutor can see all attempts
//       attempts = await ExamAttempt.find({ examId: id })
//         .populate('studentId', 'name email')
//         .sort({ createdAt: -1 });
//     } else {
//       // Student can only see their own attempts
//       attempts = await ExamAttempt.find({
//         examId: id,
//         studentId: req.user.id,
//       }).sort({ createdAt: -1 });
//     }

//     res.status(200).json({
//       success: true,
//       count: attempts.length,
//       attempts,
//     });
//   } catch (error) {
//     console.error('Get exam attempts error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// };