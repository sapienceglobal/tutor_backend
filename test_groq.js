import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: 'e:/Projects/TutorApp/tutor-backend/.env' });

async function testGroq() {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const prompt = `
You are an expert exam question generator for educational purposes.

Task:
Generate 10 high-quality multiple-choice questions about: "RRB NTPC graduate level".

Requirements for each question:
- "question": A clear, specific question (avoid ambiguity)
- "options": Array of exactly 4 distinct options (A, B, C, D format)
- "correctAnswer": The correct option text (must exactly match one option)
- "explanation": Brief explanation of why the answer is correct (1-2 sentences)
- "difficulty": "hard" (Easy/Medium/Hard)

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
    try {
        const res = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4000,
                temperature: 0.5,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                },
            }
        );
        const raw = res.data.choices[0].message.content;
        console.log("RAW RESPONSE:");
        console.log(raw);
        
        let cleanedText = raw.replace(/```(?:json)?/gi, '').trim();
        const jsonStart = cleanedText.indexOf('[');
        const jsonEnd = cleanedText.lastIndexOf(']') + 1;
        let jsonText = cleanedText.slice(jsonStart, jsonEnd);
        jsonText = jsonText.replace(/,\s*([\]}])/g, '$1');
        
        const q = JSON.parse(jsonText);
        console.log("PARSED SUCCESSFULLY!", q.length, "questions");
    } catch (e) {
        console.error("ERROR:", e);
    }
}
testGroq();
