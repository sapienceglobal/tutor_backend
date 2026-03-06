import Question from '../models/Question.js';
import Comprehension from '../models/Comprehension.js';
import Tutor from '../models/Tutor.js';

// --- QUESTIONS ---

export const createQuestion = async (req, res) => {
    try {
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor profile not found' });
        }

        const questionData = { ...req.body, tutorId: tutor._id };

        // Remove empty strings to prevent Mongoose CastError to ObjectId
        if (!questionData.topicId) delete questionData.topicId;
        if (!questionData.skillId) delete questionData.skillId;

        const question = await Question.create(questionData);
        res.status(201).json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getQuestions = async (req, res) => {
    try {
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor profile not found' });
        }

        // Build filter from query params
        const filter = { tutorId: tutor._id };
        if (req.query.difficulty) filter.difficulty = req.query.difficulty;
        if (req.query.topicId) filter.topicId = req.query.topicId;
        if (req.query.skillId) filter.skillId = req.query.skillId;

        const questions = await Question.find(filter)
            .populate('topicId', 'name')
            .populate('skillId', 'name')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, questions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getQuestionById = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id)
            .populate('topicId', 'name')
            .populate('skillId', 'name');
        if (!question) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }
        res.status(200).json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateQuestion = async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (!updateData.topicId) delete updateData.topicId;
        if (!updateData.skillId) delete updateData.skillId;

        const question = await Question.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
            .populate('topicId', 'name')
            .populate('skillId', 'name');
        if (!question) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }
        res.status(200).json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteQuestion = async (req, res) => {
    try {
        const question = await Question.findByIdAndDelete(req.params.id);
        if (!question) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }
        res.status(200).json({ success: true, message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- COMPREHENSIONS ---

export const createComprehension = async (req, res) => {
    try {
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor profile not found' });
        }

        const { title, content, questions } = req.body;

        // 1. Create Comprehension
        const comprehension = await Comprehension.create({
            title,
            content,
            tutorId: tutor._id
        });

        // 2. Create Child Questions
        if (questions && questions.length > 0) {
            const createdQuestions = await Promise.all(questions.map(q => {
                const qData = { ...q, tutorId: tutor._id };
                if (!qData.topicId) delete qData.topicId;
                if (!qData.skillId) delete qData.skillId;
                return Question.create(qData);
            }));

            // 3. Link questions to comprehension
            comprehension.questions = createdQuestions.map(q => q._id);
            await comprehension.save();
        }

        res.status(201).json({ success: true, comprehension });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getComprehensions = async (req, res) => {
    try {
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor profile not found' });
        }

        const comprehensions = await Comprehension.find({ tutorId: tutor._id })
            .populate('questions');
        res.status(200).json({ success: true, comprehensions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
