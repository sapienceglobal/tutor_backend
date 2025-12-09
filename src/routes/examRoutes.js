// // examRoutes.js
// import express from 'express';
// import {
//   getExamsByCourse,
//   getExamById,
//   createExam,
//   updateExam,
//   deleteExam,
//   submitExam,
//   getExamAttempts,
// } from '../controllers/examController.js';
// import { protect } from '../middleware/auth.js';

// const router = express.Router();

// router.get('/course/:courseId', protect, getExamsByCourse);
// router.get('/:id', protect, getExamById);
// router.get('/:id/attempts', protect, getExamAttempts);
// router.post('/', protect, createExam);
// router.post('/:id/submit', protect, submitExam);
// router.patch('/:id', protect, updateExam);
// router.delete('/:id', protect, deleteExam);

// export default router;