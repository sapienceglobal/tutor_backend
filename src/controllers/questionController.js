import Question from '../models/Question.js';
import Comprehension from '../models/Comprehension.js';
import Tutor from '../models/Tutor.js';
import mongoose from 'mongoose';

const IMPORT_SUPPORTED_TYPES = new Set(['mcq', 'true_false', 'fill_blank', 'subjective']);
const IMPORT_SUPPORTED_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

const parseBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value !== 'string') return null;

    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return null;
};

const splitDelimitedText = (value) => {
    if (typeof value !== 'string') return [];
    const separator = value.includes('|') ? '|' : ',';
    return value
        .split(separator)
        .map((item) => item.trim())
        .filter(Boolean);
};

const toValidObjectIdOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    return mongoose.Types.ObjectId.isValid(value) ? value : null;
};

const parseOptions = (rawOptions) => {
    if (Array.isArray(rawOptions)) return rawOptions;
    if (typeof rawOptions !== 'string' || !rawOptions.trim()) return [];

    const text = rawOptions.trim();
    if (text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return splitDelimitedText(text);
        }
    }

    return splitDelimitedText(text);
};

const normalizeOption = (option) => {
    if (typeof option === 'string') {
        const text = option.trim();
        return text ? { text, isCorrect: false } : null;
    }

    if (option && typeof option === 'object') {
        const text = String(option.text || option.option || '').trim();
        if (!text) return null;
        return { text, isCorrect: Boolean(option.isCorrect) };
    }

    return null;
};

const getCorrectIndex = (raw, optionsLength) => {
    const fromIndex = Number.parseInt(raw.correctOptionIndex ?? raw.correctOption, 10);
    if (!Number.isNaN(fromIndex)) {
        if (fromIndex >= 0 && fromIndex < optionsLength) return fromIndex;
        if (fromIndex >= 1 && fromIndex <= optionsLength) return fromIndex - 1;
    }

    const rawAnswer = raw.correctAnswer ?? raw.answer;
    if (rawAnswer === undefined || rawAnswer === null) return -1;

    const boolAnswer = parseBoolean(rawAnswer);
    if (boolAnswer !== null) {
        const expected = boolAnswer ? 'true' : 'false';
        return raw.optionsNormalized.findIndex((opt) => opt.text.trim().toLowerCase() === expected);
    }

    const textAnswer = String(rawAnswer).trim().toLowerCase();
    if (!textAnswer) return -1;
    return raw.optionsNormalized.findIndex((opt) => opt.text.trim().toLowerCase() === textAnswer);
};

const normalizeImportRow = (row, tutorId) => {
    const type = String(row.type || 'mcq').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!IMPORT_SUPPORTED_TYPES.has(type)) {
        return { error: `Unsupported type "${row.type}"` };
    }

    const question = String(row.question ?? row.questionText ?? row.text ?? '').trim();
    if (!question) return { error: 'Question text is required' };

    const difficulty = String(row.difficulty || 'medium').trim().toLowerCase();
    const safeDifficulty = IMPORT_SUPPORTED_DIFFICULTIES.has(difficulty) ? difficulty : 'medium';

    const parsedPoints = Number(row.points);
    const points = Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : 1;

    const topicId = toValidObjectIdOrNull(row.topicId);
    if (row.topicId && !topicId) return { error: `Invalid topicId "${row.topicId}"` };

    const skillId = toValidObjectIdOrNull(row.skillId);
    if (row.skillId && !skillId) return { error: `Invalid skillId "${row.skillId}"` };

    const questionDoc = {
        tutorId,
        type,
        question,
        explanation: row.explanation ? String(row.explanation).trim() : '',
        points,
        difficulty: safeDifficulty,
    };

    if (topicId) questionDoc.topicId = topicId;
    if (skillId) questionDoc.skillId = skillId;

    if (row.tags) {
        questionDoc.tags = Array.isArray(row.tags)
            ? row.tags.map((tag) => String(tag).trim()).filter(Boolean)
            : splitDelimitedText(String(row.tags));
    }

    if (type === 'mcq' || type === 'true_false') {
        let normalizedOptions = parseOptions(row.options).map(normalizeOption).filter(Boolean);

        if (type === 'true_false' && normalizedOptions.length === 0) {
            normalizedOptions = [
                { text: 'True', isCorrect: false },
                { text: 'False', isCorrect: false },
            ];
        }

        if (normalizedOptions.length < 2) {
            return { error: 'At least two options are required' };
        }

        const hasCorrect = normalizedOptions.some((opt) => opt.isCorrect);
        if (!hasCorrect) {
            const idx = getCorrectIndex({ ...row, optionsNormalized: normalizedOptions }, normalizedOptions.length);
            if (idx >= 0) {
                normalizedOptions = normalizedOptions.map((opt, i) => ({ ...opt, isCorrect: i === idx }));
            }
        }

        if (!normalizedOptions.some((opt) => opt.isCorrect)) {
            return { error: 'A correct answer is required for objective question types' };
        }

        questionDoc.options = normalizedOptions;
        return { questionDoc };
    }

    const idealAnswer = String(row.idealAnswer ?? row.correctAnswer ?? row.answer ?? '').trim();
    if (type === 'fill_blank' && !idealAnswer) {
        return { error: 'Ideal answer is required for fill_blank type' };
    }

    if (idealAnswer) questionDoc.idealAnswer = idealAnswer;
    return { questionDoc };
};

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

export const importQuestions = async (req, res) => {
    try {
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor profile not found' });
        }

        const questions = req.body?.questions;
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ success: false, message: 'questions must be a non-empty array' });
        }

        if (questions.length > 500) {
            return res.status(400).json({ success: false, message: 'Import limit exceeded (max 500 rows per request)' });
        }

        const errors = [];
        const normalizedRows = [];

        questions.forEach((row, index) => {
            const rowNumber = index + 1;
            const { questionDoc, error } = normalizeImportRow(row || {}, tutor._id);
            if (error) {
                errors.push({ row: rowNumber, message: error });
                return;
            }
            normalizedRows.push({ row: rowNumber, questionDoc });
        });

        let importedCount = 0;
        for (const row of normalizedRows) {
            try {
                await Question.create(row.questionDoc);
                importedCount += 1;
            } catch (error) {
                errors.push({ row: row.row, message: error.message });
            }
        }

        const failedCount = questions.length - importedCount;
        const success = importedCount > 0;

        return res.status(success ? 200 : 400).json({
            success,
            message: success
                ? `Imported ${importedCount} question(s)`
                : 'No questions could be imported',
            totalCount: questions.length,
            importedCount,
            failedCount,
            errors: errors.slice(0, 100),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
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
