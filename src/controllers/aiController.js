import axios from 'axios';

const GROQ_API_KEY = process.env.GROQ_API_KEY;


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

        const { topic, count = 5, difficulty = 'medium' } = req.body;

        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Topic is required',
            });
        }

        // Validate count
        const questionCount = Math.min(Math.max(Number(count), 1), 20);

        const prompt = `
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
                if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
                    throw new Error(`Invalid question format at index ${i}`);
                }

                return {
                    question: String(q.question).trim(),
                    options: q.options.map(opt => String(opt).trim()),
                    correctAnswer: String(q.correctAnswer || q.options[0]).trim(),
                    explanation: String(q.explanation || '').trim(),
                    difficulty: String(q.difficulty || difficulty).trim(),
                };
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