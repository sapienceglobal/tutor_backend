import Question from '../models/Question.js';
import Comprehension from '../models/Comprehension.js';

// --- QUESTIONS ---

export const createQuestion = async (req, res) => {
    try {
        const tutorId = req.user.tutorId;
        const question = await Question.create({
            ...req.body,
            tutorId
        });
        res.status(201).json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getQuestions = async (req, res) => {
    try {
        const questions = await Question.find({ tutorId: req.user.tutorId })
            .populate('topicId', 'name')
            .populate('skillId', 'name');
        res.status(200).json({ success: true, questions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- COMPREHENSIONS ---

export const createComprehension = async (req, res) => {
    try {
        const tutorId = req.user.tutorId;
        const { title, content, questions } = req.body;

        // 1. Create Comprehension
        const comprehension = await Comprehension.create({
            title,
            content,
            tutorId
        });

        // 2. Create Child Questions
        if (questions && questions.length > 0) {
            const createdQuestions = await Promise.all(questions.map(q =>
                Question.create({
                    ...q,
                    tutorId,
                    // Optional: link back to comprehension if needed in Question model, 
                    // or just keep ref in Comprehension
                })
            ));

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
        const comprehensions = await Comprehension.find({ tutorId: req.user.tutorId })
            .populate('questions');
        res.status(200).json({ success: true, comprehensions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
