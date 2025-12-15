import { QuestionSet } from '../models/QuestionSet.js';
import { Exam } from '../models/Exam.js'; // Import existing Exam model
import Course from '../models/Course.js';

// @desc    Create a new Question Set
// @route   POST /api/question-sets
export const createQuestionSet = async (req, res) => {
  try {
    const { courseId, title, description, tags, questions } = req.body;

    const course = await Course.findById(courseId).populate('tutorId');
    if (!course || course.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const questionSet = await QuestionSet.create({
      courseId,
      tutorId: course.tutorId._id,
      title,
      description,
      tags,
      questions,
    });

    res.status(201).json({ success: true, data: questionSet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all sets for a course
// @route   GET /api/question-sets/course/:courseId
export const getQuestionSetsByCourse = async (req, res) => {
  try {
    const sets = await QuestionSet.find({ 
      courseId: req.params.courseId,
      isArchived: false 
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: sets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a Question Set (Add/Remove/Edit questions)
// @route   PATCH /api/question-sets/:id
export const updateQuestionSet = async (req, res) => {
  try {
    // Basic fields update logic
    const updatedSet = await QuestionSet.findByIdAndUpdate(
      req.params.id,
      req.body, // This now includes selectedQuestionIds if sent from frontend
      { new: true }
    );
    if (!updatedSet) return res.status(404).json({ success: false, message: 'Not Found' });
    
    res.status(200).json({ success: true, data: updatedSet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete (Archive) a Question Set
// @route   DELETE /api/question-sets/:id
export const deleteQuestionSet = async (req, res) => {
  try {
    await QuestionSet.findByIdAndUpdate(req.params.id, { isArchived: true });
    res.status(200).json({ success: true, message: 'Question set deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// @desc    GO LIVE: Publish a Question Set as an Exam
// @route   POST /api/question-sets/:id/publish
// ---------------------------------------------------------
export const publishSetToExam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, duration, passingMarks,
      startDate, endDate, shuffleQuestions, allowRetake, maxAttempts,
      selectedQuestionIds // Array of IDs from frontend
    } = req.body;

    const qSet = await QuestionSet.findById(id);
    if (!qSet) return res.status(404).json({ success: false, message: 'Question Set not found' });

    // 1. Save the selection to the Set (so it persists)
    if (selectedQuestionIds) {
      qSet.selectedQuestionIds = selectedQuestionIds;
      await qSet.save();
    }

    // 2. Filter Questions based on Selection
    // Use saved selection if not provided in body, else fallback to all
    const idsToFilter = selectedQuestionIds || qSet.selectedQuestionIds || [];
    
    let questionsToInclude = [];
    if (idsToFilter.length > 0) {
      questionsToInclude = qSet.questions.filter(q => 
        idsToFilter.includes(q._id.toString())
      );
    } else {
      // Fallback: If absolutely no selection, take all (or throw error based on your preference)
      questionsToInclude = qSet.questions; 
    }

    if (questionsToInclude.length === 0) {
      return res.status(400).json({ success: false, message: 'No questions selected for publish.' });
    }

    // 3. Construct Exam Data Object
    const examData = {
      title: title || qSet.title,
      description: description || qSet.description,
      questions: questionsToInclude, // Updates questions based on current set version
      duration,
      passingMarks,
      startDate,
      endDate,
      isScheduled: !!(startDate && endDate),
      shuffleQuestions,
      allowRetake,
      maxAttempts,
      status: 'published',
      isPublished: true,
    };

    let examId;
    let message;

    // 4. CHECK: Create New OR Update Existing?
    if (qSet.publishedExamId) {
      // --- UPDATE EXISTING EXAM ---
      const existingExam = await Exam.findByIdAndUpdate(
        qSet.publishedExamId,
        examData,
        { new: true }
      );
      
      if (existingExam) {
        examId = existingExam._id;
        message = 'Existing exam updated successfully';
      } else {
        // Edge case: Exam ID exists in Set but Exam was deleted manually. Re-create.
        const newExam = await Exam.create({
          ...examData,
          courseId: qSet.courseId,
          tutorId: qSet.tutorId,
        });
        qSet.publishedExamId = newExam._id;
        await qSet.save();
        examId = newExam._id;
        message = 'Exam link was broken, created new exam.';
      }
    } else {
      // --- CREATE NEW EXAM ---
      const newExam = await Exam.create({
        ...examData,
        courseId: qSet.courseId,
        tutorId: qSet.tutorId,
      });
      
      // Link the new exam to the set
      qSet.publishedExamId = newExam._id;
      await qSet.save();
      
      examId = newExam._id;
      message = 'New exam published successfully';
    }

    res.status(200).json({ 
      success: true, 
      message, 
      examId 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};