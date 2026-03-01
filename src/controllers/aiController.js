import axios from 'axios';
import Lesson from '../models/Lesson.js';
import Enrollment from '../models/Enrollment.js';
import QuizAttempt from '../models/QuizAttempt.js';
import AIUsageLog from '../models/AIUsageLog.js';
import Institute from '../models/Institute.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// --- AI Usage Logging Helper ---
async function logAIUsage(userId, action, details = {}) {
    try {
        const user = await (await import('../models/User.js')).default.findById(userId);
        const instituteId = user?.instituteId || null;

        await AIUsageLog.create({ userId, instituteId, action, details });

        // Increment institute AI usage count
        if (instituteId) {
            await Institute.findByIdAndUpdate(instituteId, { $inc: { aiUsageCount: 1 } });
        }
    } catch (err) {
        console.error('AI usage log error:', err.message);
    }
}

// Helper function to call Groq AI
async function callGroqAI(prompt) {
    try {
        const res = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 2000,
                temperature: 0.5,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                },
            }
        );

        return res.data.choices[0].message.content;
    } catch (error) {
        console.error('Groq AI error:', error.response?.data || error.message);
        throw new Error('AI generation failed');
    }
}

// Helper function to call Groq AI with full messages array
async function callGroqAIChat(messages) {
    try {
        const res = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                },
            }
        );

        return res.data.choices[0].message.content;
    } catch (error) {
        console.error('Groq AI Chat error:', error.response?.data || error.message);
        throw new Error('AI Chat failed');
    }
}

// @desc    Generate MCQ questions using AI
// @route   POST /api/ai/generate-questions
export const generateQuestions = async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Groq API key not configured',
            });
        }

        const { topic, count = 5, difficulty = 'medium', type = 'mcq' } = req.body;

        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Topic is required',
            });
        }

        // Validate count
        const questionCount = Math.min(Math.max(Number(count), 1), 20);

        const isSubjective = type === 'subjective';

        const prompt = isSubjective ? `
You are an expert exam question generator for educational purposes.

Task:
Generate ${questionCount} high-quality subjective/open-ended questions about: "${topic}".

Requirements for each question:
- "question": A clear, thought-provoking subjective question.
- "idealAnswer": A comprehensive ideal answer or grading rubric (3-4 sentences).
- "explanation": Brief explanation for the student (1-2 sentences).
- "difficulty": "${difficulty}" (Easy/Medium/Hard)

Return ONLY a valid JSON array with no additional text:
[
  {
    "question": "Explain the significance of the French Revolution.",
    "idealAnswer": "A good answer should mention the overthrow of the monarchy, the establishment of a republic, and the radical social and political changes. Key figures like Robespierre and events like the Reign of Terror should be noted, along with the long-term impact on democratic ideals in Europe.",
    "explanation": "The French Revolution was a watershed event in modern European history that began in 1789.",
    "difficulty": "Medium"
  }
]
` : `
You are an expert exam question generator for educational purposes.

Task:
Generate ${questionCount} high-quality multiple-choice questions about: "${topic}".

Requirements for each question:
- "question": A clear, specific question (avoid ambiguity)
- "options": Array of exactly 4 distinct options (A, B, C, D format)
- "correctAnswer": The correct option text (must exactly match one option)
- "explanation": Brief explanation of why the answer is correct (1-2 sentences)
- "difficulty": "${difficulty}" (Easy/Medium/Hard)

Guidelines:
- Questions should test understanding, not just memorization
- Options should be plausible but only one correct
- Avoid trick questions
- Keep language simple and professional

Return ONLY a valid JSON array with no additional text:
[
  {
    "question": "What is the capital of France?",
    "options": ["London", "Berlin", "Paris", "Madrid"],
    "correctAnswer": "Paris",
    "explanation": "Paris is the capital and largest city of France.",
    "difficulty": "Easy"
  }
]
`;

        // Call Groq AI
        const rawResponse = await callGroqAI(prompt);

        // Parse JSON safely
        let questions;
        try {
            // Find JSON array in response
            const jsonStart = rawResponse.indexOf('[');
            const jsonEnd = rawResponse.lastIndexOf(']') + 1;

            if (jsonStart === -1 || jsonEnd === 0) {
                throw new Error('No JSON array found in response');
            }

            const jsonText = rawResponse.slice(jsonStart, jsonEnd);
            questions = JSON.parse(jsonText);

            if (!Array.isArray(questions) || questions.length === 0) {
                throw new Error('Invalid questions array');
            }

            // Validate and format questions
            questions = questions.map((q, i) => {
                if (isSubjective) {
                    if (!q.question || !q.idealAnswer) {
                        throw new Error(`Invalid subjective question format at index ${i}`);
                    }
                    return {
                        question: String(q.question).trim(),
                        idealAnswer: String(q.idealAnswer).trim(),
                        explanation: String(q.explanation || '').trim(),
                        difficulty: String(q.difficulty || difficulty).trim(),
                        type: 'subjective'
                    };
                } else {
                    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
                        throw new Error(`Invalid MCQ question format at index ${i}`);
                    }
                    return {
                        question: String(q.question).trim(),
                        options: q.options.map(opt => String(opt).trim()),
                        correctAnswer: String(q.correctAnswer || q.options[0]).trim(),
                        explanation: String(q.explanation || '').trim(),
                        difficulty: String(q.difficulty || difficulty).trim(),
                        type: 'mcq'
                    };
                }
            });

        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return res.status(500).json({
                success: false,
                message: 'AI returned invalid format',
                details: rawResponse.substring(0, 500),
            });
        }

        res.status(200).json({
            success: true,
            count: questions.length,
            questions,
        });

        // Log usage
        logAIUsage(req.user.id, 'question_generation', { topic, count: questions.length, difficulty });

    } catch (error) {
        console.error('Generate questions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate questions',
            error: error.message,
        });
    }
};

// @desc    Generate quiz for a specific lesson
// @route   POST /api/ai/generate-lesson-quiz
export const generateLessonQuiz = async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Groq API key not configured',
            });
        }

        const {
            lessonTitle,
            lessonDescription,
            count = 5,
            difficulty = 'medium',
            customInstructions,
        } = req.body;

        if (!lessonTitle) {
            return res.status(400).json({
                success: false,
                message: 'Lesson title is required',
            });
        }

        const questionCount = Math.min(Math.max(Number(count), 1), 15);

        const prompt = `
You are creating a quiz for an educational lesson.

Lesson Title: "${lessonTitle}"
Lesson Description: "${lessonDescription || 'Not provided'}"
Additional Instructions: "${customInstructions || 'None'}"

Generate ${questionCount} multiple-choice questions specifically about this lesson content.

Requirements:
- Questions should directly test understanding of the lesson material
- Difficulty level: ${difficulty}
- Each question needs: question, 4 options, correctAnswer, explanation
- Make questions practical and relevant to real-world application

Return ONLY valid JSON array:
[
  {
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correctAnswer": "...",
    "explanation": "...",
    "difficulty": "${difficulty}"
  }
]
`;

        const rawResponse = await callGroqAI(prompt);

        // Parse and validate
        let questions;
        try {
            const jsonStart = rawResponse.indexOf('[');
            const jsonEnd = rawResponse.lastIndexOf(']') + 1;
            const jsonText = rawResponse.slice(jsonStart, jsonEnd);
            questions = JSON.parse(jsonText);

            questions = questions.map(q => ({
                question: String(q.question).trim(),
                options: q.options.map(opt => String(opt).trim()),
                correctAnswer: String(q.correctAnswer).trim(),
                explanation: String(q.explanation || '').trim(),
                difficulty: String(q.difficulty || difficulty).trim(),
            }));

        } catch (parseError) {
            return res.status(500).json({
                success: false,
                message: 'AI returned invalid format',
            });
        }

        res.status(200).json({
            success: true,
            count: questions.length,
            questions,
        });

    } catch (error) {
        console.error('Generate lesson quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate quiz',
            error: error.message,
        });
    }
};

// @desc    Chat with AI Tutor regarding a specific lesson
// @route   POST /api/ai/tutor-chat
export const chatWithTutor = async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({ success: false, message: 'Groq API key not configured' });
        }

        const { lessonId, message, history = [] } = req.body;

        if (!lessonId || !message) {
            return res.status(400).json({ success: false, message: 'Lesson ID and message are required' });
        }

        // Fetch lesson context
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        const lessonContext = `
        Lesson Title: ${lesson.title}
        Lesson Description: ${lesson.description || 'No description provided'}
        Content Text: ${lesson.content?.text || 'No additional text content'}
        `;

        // Build citation source info
        const citations = [{
            source: 'Lesson',
            title: lesson.title,
            description: lesson.description || '',
            id: lesson._id,
        }];

        // If lesson has attachments, include them as additional citation sources
        if (lesson.content?.attachments?.length > 0) {
            lesson.content.attachments.forEach(att => {
                citations.push({
                    source: 'Attachment',
                    title: att.name || att.originalName || 'Document',
                    id: att._id || null,
                });
            });
        }

        // Format history for Groq
        const formattedHistory = history.map(msg => ({
            role: msg.role === 'tutor' ? 'assistant' : 'user',
            content: msg.content
        }));

        const systemPrompt = {
            role: 'system',
            content: `You are Sapience AI, an expert tutor guiding a student through the lesson material. 
            Use the following lesson context to answer the student's questions. 
            If the question is completely unrelated to the lesson or educational topics, politely guide them back to the subject.
            Keep your answers concise, encouraging, and educational. Use Markdown formatting.
            
            IMPORTANT: When you reference information from the lesson, include the source at the end of your answer in this format:
            ---
            📚 **Source:** [Lesson title or document name]
            
            Lesson Context:
            ${lessonContext}`
        };

        const messages = [
            systemPrompt,
            ...formattedHistory,
            { role: 'user', content: message }
        ];

        const responseText = await callGroqAIChat(messages);

        res.status(200).json({
            success: true,
            reply: responseText,
            citations,
        });

        // Log usage
        logAIUsage(req.user.id, 'tutor_chat', { lessonId });

    } catch (error) {
        console.error('AI Tutor Chat error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to communicate with AI Tutor',
            error: error.message,
        });
    }
};

// @desc    Generate personalized analytics for a student
// @route   GET /api/ai/analytics/student
export const generateStudentAnalytics = async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({ success: false, message: 'Groq API key not configured' });
        }

        const studentId = req.user._id;

        const enrollments = await Enrollment.find({ studentId }).populate('courseId', 'title category level');
        const quizAttempts = await QuizAttempt.find({ studentId }).sort('-createdAt').limit(10).populate('lessonId', 'title');

        let studentDataText = 'Enrollments:\n';
        enrollments.forEach(e => {
            studentDataText += `- Course: ${e.courseId?.title || 'Unknown'}, Progress: ${e.progress?.percentage || 0}%\n`;
        });

        studentDataText += '\nRecent Quiz Attempts:\n';
        quizAttempts.forEach(q => {
            studentDataText += `- Lesson: ${q.lessonId?.title || 'Unknown'}, Score: ${q.score}% (${q.isPassed ? 'Passed' : 'Failed'})\n`;
        });

        if (enrollments.length === 0 && quizAttempts.length === 0) {
            studentDataText = "The student has just joined and has no active enrollments or quiz attempts yet.";
        }

        const prompt = `
        You are an elite AI educational analyst for Sapience LMS.
        Analyze the following student data and generate a personalized learning report.

        Student Data:
        ${studentDataText}

        Task: Produce a structured JSON response containing:
        - "weakTopics": Array of strings (up to 3 areas the student should improve, based on low scores or extrapolate).
        - "strongTopics": Array of strings (up to 3 areas the student excels at).
        - "successProbability": A number from 0 to 100 estimating their likelihood of completing current courses with good grades.
        - "dropoutRisk": A string, strictly one of ["Low", "Medium", "High"].
        - "studyPlan": An array of exactly 3 objects, each with {"step": string, "description": string} containing actionable advice.

        Return ONLY a valid JSON object. Do not include markdown formatting or backticks around the JSON.
        `;

        const rawResponse = await callGroqAI(prompt);

        const jsonStart = rawResponse.indexOf('{');
        const jsonEnd = rawResponse.lastIndexOf('}') + 1;

        if (jsonStart === -1 || jsonEnd === 0) {
            throw new Error('No JSON object found in response');
        }

        const jsonText = rawResponse.slice(jsonStart, jsonEnd);
        const analytics = JSON.parse(jsonText);

        res.status(200).json({
            success: true,
            analytics
        });

        // Log usage
        logAIUsage(req.user.id, 'analytics', { enrollmentCount: enrollments.length });

    } catch (error) {
        console.error('Analytics generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate analytics', error: error.message });
    }
};

// @desc    Summarize a lesson using AI
// @route   POST /api/ai/summarize-lesson
// @access  Private
export const summarizeLesson = async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({ success: false, message: 'Groq API key not configured' });
        }

        const { lessonId, courseId, lessonTitle, content } = req.body;

        let title, description, textContent;

        if (lessonId) {
            // Lesson-level summarize
            const lesson = await Lesson.findById(lessonId);
            if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
            title = lesson.title;
            description = lesson.description || '';
            textContent = lesson.content?.text || '';
        } else if (courseId || lessonTitle) {
            // Course-level summarize (from student course page)
            title = lessonTitle || 'Course';
            description = content || '';
            textContent = content || '';
        } else {
            return res.status(400).json({ success: false, message: 'Lesson ID or course details are required' });
        }

        const prompt = `
You are an expert educational content summarizer.

Summarize the following in a clear, structured format:
- Use bullet points for key concepts
- Include the most important takeaways
- Keep it concise but comprehensive (max 300 words)
- Use Markdown formatting

Title: "${title}"
Description: "${description}"
Content: "${textContent || 'Video/multimedia content — summarize based on title and description'}"
`;

        const summary = await callGroqAI(prompt);

        logAIUsage(req.user.id, 'summarize_lesson', { lessonId: lessonId || courseId });

        res.status(200).json({
            success: true,
            summary,
            lessonTitle: title,
        });
    } catch (error) {
        console.error('Summarize lesson error:', error);
        res.status(500).json({ success: false, message: 'Failed to summarize lesson', error: error.message });
    }
};

// @desc    Generate revision notes for a lesson using AI
// @route   POST /api/ai/revision-notes
// @access  Private
export const generateRevisionNotes = async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({ success: false, message: 'Groq API key not configured' });
        }

        const { lessonId, courseId, lessonTitle, content } = req.body;

        let title, description, textContent;

        if (lessonId) {
            const lesson = await Lesson.findById(lessonId);
            if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
            title = lesson.title;
            description = lesson.description || '';
            textContent = lesson.content?.text || '';
        } else if (courseId || lessonTitle) {
            title = lessonTitle || 'Course';
            description = content || '';
            textContent = content || '';
        } else {
            return res.status(400).json({ success: false, message: 'Lesson ID or course details are required' });
        }

        const prompt = `
You are an expert at creating revision notes for students.

Create comprehensive revision notes for the following:
- Include key definitions and concepts
- Add formulas or important facts if applicable
- Create memory aids / mnemonics where helpful
- Add 3-5 quick review questions at the end
- Use Markdown formatting with headers, bold, and bullet points

Title: "${title}"
Description: "${description}"
Content: "${textContent || 'Video/multimedia content — create notes based on title and description'}"
`;

        const notes = await callGroqAI(prompt);

        logAIUsage(req.user.id, 'revision_notes', { lessonId: lessonId || courseId });

        res.status(200).json({
            success: true,
            notes,
            lessonTitle: title,
        });
    } catch (error) {
        console.error('Revision notes error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate revision notes', error: error.message });
    }
};

// @desc    Get AI usage stats (for admin / billing)
// @route   GET /api/ai/usage-stats
// @access  Private/Admin
export const getAIUsageStats = async (req, res) => {
    try {
        const match = {};
        if (req.query.instituteId) match.instituteId = req.query.instituteId;
        if (req.query.userId) match.userId = req.query.userId;

        const stats = await AIUsageLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 },
                },
            },
        ]);

        const totalUsage = stats.reduce((sum, s) => sum + s.count, 0);

        res.status(200).json({
            success: true,
            totalUsage,
            breakdown: stats,
        });
    } catch (error) {
        console.error('AI usage stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch AI usage stats' });
    }
};