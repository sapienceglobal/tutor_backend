import axios from 'axios';
import Lesson from '../models/Lesson.js';
import Enrollment from '../models/Enrollment.js';
import QuizAttempt from '../models/QuizAttempt.js';
import AIUsageLog from '../models/AIUsageLog.js';
import Institute from '../models/Institute.js';
import VectorService from '../services/vectorService.js';
import AIChatSession from '../models/AIChatSession.js';

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

// @desc    RAG-based AI Tutor Chat with Citations
// @route   POST /api/ai/tutor-chat-rag
export const tutorChatRAG = async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Groq API key not configured'
            });
        }

        const { message, courseId, lessonId } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        // Get user's instituteId
        const user = await (await import('../models/User.js')).default.findById(req.user.id);
        const instituteId = user?.instituteId;

        // Perform similarity search to get relevant context
        let context = '';
        let citations = [];

        try {
            const searchResults = await VectorService.similaritySearch(
                message,
                courseId,
                instituteId,
                5
            );

            if (searchResults && searchResults.length > 0) {
                context = searchResults.map((result, index) =>
                    `[Source ${index + 1}]: ${result.content}`
                ).join('\n\n');

                citations = searchResults.map((result, index) => ({
                    id: index + 1,
                    lessonTitle: result.lesson.title,
                    contentType: result.contentType,
                    content: result.content.substring(0, 200) + '...',
                    similarity: result.similarity,
                    metadata: result.metadata
                }));
            }
        } catch (searchError) {
            console.error('Vector search error:', searchError);
            // Continue without context if search fails
        }

        // Build messages array for Groq AI
        const messages = [
            {
                role: 'system',
                content: `You are an expert AI Tutor for Sapience LMS. You help students learn effectively by providing accurate, educational answers.

${context ? `Context from course materials:
${context}

IMPORTANT: Use the provided context to answer the student's question. If the context doesn't contain enough information, you can supplement with your general knowledge but clearly indicate when you're doing so.

CITATION FORMAT: When using information from the context, include citations like [Source 1], [Source 2] etc.` : 'Provide helpful educational answers based on your general knowledge.'}

Guidelines:
- Be educational and encouraging
- Explain concepts clearly
- Provide examples when helpful
- Include citations when using context materials
- If you don't know something, admit it honestly
- Keep responses concise but thorough`
            },
            {
                role: 'user',
                content: message
            }
        ];

        const responseText = await callGroqAIChat(messages);

        res.status(200).json({
            success: true,
            reply: responseText,
            citations,
            contextUsed: context.length > 0
        });

        // Log usage
        await logAIUsage(req.user.id, 'tutor_chat', {
            courseId,
            lessonId,
            citationsCount: citations.length
        });

    } catch (error) {
        console.error('RAG AI Tutor Chat error:', error);
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

// @desc    Contextual Chat with AI Assistant (adapts to current page context)
// @route   POST /api/ai/contextual-chat
export const contextualChat = async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({ success: false, message: 'Groq API key not configured' });
        }

        const { message, history = [], context = {} } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        let systemContext = `You are a helpful, expert AI assistant embedded directly within a student's learning platform. Your goal is to provide concise, accurate, and highly relevant guidance.
        Keep formatting clean using Markdown (bullet points, bolding).
        `;

        // Enhance system prompt dynamically based on the provided context
        if (context.pageType === 'assignment_upload') {
            systemContext += `\n\nCURRENT CONTEXT: The student is currently on the "Upload Assignment" page, preparing to submit their work.`;
            if (context.courseId) {
                const course = await (await import('../models/Course.js')).default.findById(context.courseId).select('title');
                if (course) systemContext += `\nThey have selected the course: "${course.title}".`;
            }
            if (context.assignmentId) {
                const assignment = await (await import('../models/Assignment.js')).default.findById(context.assignmentId);
                if (assignment) {
                    systemContext += `\nThey are uploading a submission for the assignment titled: "${assignment.title}".`;
                    if (assignment.description) systemContext += `\nAssignment Details: ${assignment.description}`;
                    if (assignment.totalMarks) systemContext += `\nTotal Marks: ${assignment.totalMarks}`;
                    systemContext += `\nProvide guidance strictly relevant to helping them complete, format, or understand this specific assignment. Do not write the assignment for them; rather, act as an academic tutor giving them hints, clarifying the requirements, or helping structure their response.`;
                }
            } else {
                systemContext += `\nThey have not yet selected a specific assignment.`;
            }
        } else if (context.pageType === 'course_details') {
            systemContext += `\n\nCURRENT CONTEXT: The student is viewing a Course overview/curriculum page.`;
            if (context.courseId) {
                const course = await (await import('../models/Course.js')).default.findById(context.courseId).populate({
                    path: 'tutorId',
                    populate: { path: 'userId', select: 'name bio' }
                });
                const Enrollment = (await import('../models/Enrollment.js')).default;
                const Lesson = (await import('../models/Lesson.js')).default;

                if (course) {
                    const totalLessons = await Lesson.countDocuments({ courseId: course._id });
                    const enrollment = await Enrollment.findOne({ studentId: req.user._id, courseId: course._id });

                    const tutorName = course.tutorId?.userId?.name || 'Unknown Tutor';
                    const tutorBio = course.tutorId?.bio || course.tutorId?.userId?.bio || 'No bio available';
                    const tutorExperience = course.tutorId?.experience ? `${course.tutorId.experience} years` : 'Unknown';
                    const tutorSubjects = course.tutorId?.subjects?.join(', ') || 'Various Subjects';

                    systemContext += `\nCourse Title: "${course.title}"`;
                    if (course.description) systemContext += `\nDescription: ${course.description}`;
                    if (course.whatYouWillLearn?.length) systemContext += `\nWhat they will learn: ${course.whatYouWillLearn.join(', ')}`;

                    systemContext += `\n\n==== COURSE METADATA (DO NOT HALLUCINATE) ====`;
                    systemContext += `\nTotal Lessons in Course: ${totalLessons}`;
                    systemContext += `\nTutor's Name: ${tutorName}`;
                    systemContext += `\nTutor's Experience: ${tutorExperience}`;
                    systemContext += `\nTutor's Subjects: ${tutorSubjects}`;
                    systemContext += `\nTutor's Bio: ${tutorBio}`;

                    if (enrollment) {
                        const progressPercent = enrollment.progress?.percentage || 0;
                        const completedCount = enrollment.progress?.completedLessons?.length || 0;
                        systemContext += `\nStudent's Current Progress: ${progressPercent}% completed (${completedCount} out of ${totalLessons} lessons finished).`;
                    } else {
                        systemContext += `\nStudent Status: NOT ENROLLED IN THIS COURSE yet. Provide guidance on why they should enroll based on the curriculum.`;
                    }
                    systemContext += `\n============================================\n`;

                    systemContext += `\nAct as a knowledgeable guide about this specific course. Answer questions about what topics it covers, curriculum counts, tutor profile, the prerequisites, and course objectives using the EXACT factual data provided above.`;
                }
            }
        } else if (context.pageType === 'tutor_profile') {
            systemContext += `\n\nCURRENT CONTEXT: The student is viewing a Tutor's public profile and booking page.`;
            if (context.tutorId) {
                const tutor = await (await import('../models/Tutor.js')).default.findById(context.tutorId).populate('userId', 'name');
                if (tutor) {
                    systemContext += `\nTutor Name: "${tutor.userId?.name || 'Tutor'}"`;
                    if (tutor.bio) systemContext += `\nBio: ${tutor.bio}`;
                    if (tutor.experience) systemContext += `\nExperience: ${tutor.experience} years`;
                    if (tutor.subjects?.length) systemContext += `\nSpecialties: ${tutor.subjects.join(', ')}`;
                    if (tutor.hourlyRate) systemContext += `\nHourly Rate: ₹${tutor.hourlyRate}`;
                    systemContext += `\nHelp the student determine if this tutor is a good fit for their learning needs based on the fields above. Highlight the tutor's relevant experience and specialties.`;
                }
            }
        } else {
            systemContext += `\n\nCURRENT CONTEXT: The student is navigating the educational platform roughly. Be an encouraging academic counselor.`;
        }

        const formattedHistory = history.map(msg => ({
            role: msg.role === 'ai' || msg.role === 'assistant' || msg.role === 'tutor' ? 'assistant' : 'user',
            content: msg.content
        }));

        const messages = [
            { role: 'system', content: systemContext },
            ...formattedHistory,
            { role: 'user', content: message }
        ];

        const responseText = await callGroqAIChat(messages);

        res.status(200).json({
            success: true,
            reply: responseText
        });

        logAIUsage(req.user.id, 'contextual_chat', { pageType: context.pageType });

    } catch (error) {
        console.error('Contextual Chat error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to communicate with AI',
            error: error.message,
        });
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

// ==========================================
// CHAT SESSION CONTROLLERS (New UI Revamp)
// ==========================================

// Helper to auto-generate a title for a new chat
async function generateChatTitle(firstMessage) {
    try {
        const prompt = `Generate a very short, concise title (max 5 words) summarizing this message/topic: "${firstMessage}". Return ONLY the title text.`;
        const title = await callGroqAI(prompt);
        return title.replace(/['"]/g, '').trim() || 'New Chat';
    } catch (e) {
        return 'New Chat';
    }
}

// @desc    Get all chat sessions for the mapped user
// @route   GET /api/ai/chat-sessions
export const getChatSessions = async (req, res) => {
    try {
        const sessions = await AIChatSession.find({ userId: req.user._id })
            .select('-messages') // Don't send entire history for list view
            .sort('-updatedAt')
            .populate('courseId', 'title');

        res.status(200).json({ success: true, count: sessions.length, sessions });
    } catch (error) {
        console.error('Get chat sessions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chat sessions' });
    }
};

// @desc    Create a new chat session
// @route   POST /api/ai/chat-sessions
export const createChatSession = async (req, res) => {
    try {
        const { courseId } = req.body;

        const session = await AIChatSession.create({
            userId: req.user._id,
            courseId: courseId || null,
            messages: []
        });

        res.status(201).json({ success: true, session });
    } catch (error) {
        console.error('Create chat session error:', error);
        res.status(500).json({ success: false, message: 'Failed to create chat session' });
    }
};

// @desc    Get a specific chat session by ID
// @route   GET /api/ai/chat-sessions/:id
export const getChatSessionById = async (req, res) => {
    try {
        const session = await AIChatSession.findOne({ _id: req.params.id, userId: req.user._id })
            .populate('courseId', 'title');

        if (!session) {
            return res.status(404).json({ success: false, message: 'Chat session not found' });
        }

        res.status(200).json({ success: true, session });
    } catch (error) {
        console.error('Get chat session error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chat session' });
    }
};

// @desc    Delete a chat session
// @route   DELETE /api/ai/chat-sessions/:id
export const deleteChatSession = async (req, res) => {
    try {
        const session = await AIChatSession.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

        if (!session) {
            return res.status(404).json({ success: false, message: 'Chat session not found' });
        }

        res.status(200).json({ success: true, message: 'Chat session deleted' });
    } catch (error) {
        console.error('Delete chat session error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete chat session' });
    }
};

// @desc    Add a message to a session and get AI response
// @route   POST /api/ai/chat-sessions/:id/message
export const addMessageToChatSession = async (req, res) => {
    try {
        if (!GROQ_API_KEY) {
            return res.status(500).json({ success: false, message: 'Groq API key not configured' });
        }

        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message text is required' });
        }

        const session = await AIChatSession.findOne({ _id: req.params.id, userId: req.user._id });
        if (!session) {
            return res.status(404).json({ success: false, message: 'Chat session not found' });
        }

        // Auto-generate title if this is the first message
        if (session.messages.length === 0) {
            const title = await generateChatTitle(message);
            session.title = title;
        }

        // Save User Message
        const userMsg = { role: 'user', content: message, timestamp: new Date() };
        session.messages.push(userMsg);

        // Perform RAG if courseId is available
        let context = '';
        let citations = [];
        let contextUsed = false;
        let liveCourseMetadata = '';

        if (session.courseId) {
            try {
                // Get user's instituteId for Vector Search
                const user = await (await import('../models/User.js')).default.findById(req.user._id);
                const instituteId = user?.instituteId;

                const searchResults = await VectorService.similaritySearch(
                    message,
                    session.courseId,
                    instituteId,
                    4
                );

                if (searchResults && searchResults.length > 0) {
                    context = searchResults.map((result, index) =>
                        `[Source ${index + 1}]: ${result.content}`
                    ).join('\n\n');

                    citations = searchResults.map((result, index) => ({
                        id: index + 1,
                        title: result.lesson.title,
                        content: result.content.substring(0, 200) + '...',
                        similarity: result.similarity
                    }));
                    contextUsed = true;
                }

                // Fetch dynamic course / tutor / enrollment metadata for AI context
                try {
                    const Course = (await import('../models/Course.js')).default;
                    const Enrollment = (await import('../models/Enrollment.js')).default;
                    const Lesson = (await import('../models/Lesson.js')).default;

                    const courseDetails = await Course.findById(session.courseId).populate({
                        path: 'tutorId',
                        populate: { path: 'userId', select: 'name bio' }
                    });

                    const enrollment = await Enrollment.findOne({ studentId: req.user._id, courseId: session.courseId });

                    if (courseDetails) {
                        const totalLessons = await Lesson.countDocuments({ courseId: session.courseId });
                        const tutorName = courseDetails.tutorId?.userId?.name || 'Unknown Tutor';
                        const tutorBio = courseDetails.tutorId?.bio || courseDetails.tutorId?.userId?.bio || 'No bio available';
                        const tutorExperience = courseDetails.tutorId?.experience ? `${courseDetails.tutorId.experience} years` : 'Unknown';
                        const tutorSubjects = courseDetails.tutorId?.subjects?.join(', ') || 'Various Subjects';
                        const progressPercent = enrollment?.progress?.percentage || 0;
                        const completedCount = enrollment?.progress?.completedLessons?.length || 0;

                        liveCourseMetadata = `
== COURSE METADATA (DO NOT HALLUCINATE) ==
Course Title: ${courseDetails.title}
Course Description: ${courseDetails.description}
Total Lessons in Course: ${totalLessons}
Tutor's Name: ${tutorName}
Tutor's Experience: ${tutorExperience}
Tutor's Subjects: ${tutorSubjects}
Tutor's Bio: ${tutorBio}
Student's Current Progress: ${progressPercent}% completed (${completedCount} out of ${totalLessons} lessons finished).
============================================`;
                    }
                } catch (metaError) {
                    console.error('Metadata fetch error in chat session:', metaError);
                }

            } catch (searchError) {
                console.error('Vector search error in chat session:', searchError);
            }
        }

        // Build History Profile
        const systemPrompt = {
            role: 'system',
            content: `You are Sapience AI, an elite educational tutor. Help the student learn effectively.
            
${liveCourseMetadata ? `Here are concrete facts about the course and the student's enrollment:\n${liveCourseMetadata}\nIf the student asks about the tutor, syllabus, or their progress, use this exact data exclusively.\n` : ''}

${contextUsed ? `CONTEXT FROM COURSE MATERIALS:
${context}

IMPORTANT: Use the above context to accurately answer the question. If the context doesn't have the answer, use your general knowledge but indicate it.
When referencing context, cite it using [Source 1], [Source 2].` : 'Provide helpful, encouraging, and accurate educational answers.'}

Format replies cleanly using Markdown.`
        };

        // Get last 15 messages for context window
        const recentHistory = session.messages.slice(-15).map(m => ({
            role: m.role,
            content: m.content
        }));

        const aiPayload = [systemPrompt, ...recentHistory];

        // Call Groq AI
        const responseText = await callGroqAIChat(aiPayload);

        // Save Assistant Message
        const aiMsg = {
            role: 'assistant',
            content: responseText,
            citations: citations,
            contextUsed: contextUsed,
            timestamp: new Date()
        };
        session.messages.push(aiMsg);

        await session.save();

        res.status(200).json({
            success: true,
            reply: aiMsg,
            sessionTitle: session.title // Send back in case it was auto-updated
        });

        // Log usage
        await logAIUsage(req.user._id, 'tutor_chat_session', { sessionId: session._id, courseId: session.courseId });

    } catch (error) {
        console.error('Chat Session Message error:', error);
        res.status(500).json({ success: false, message: 'AI failed to respond' });
    }
};