import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testAIGenerator() {
    try {
        console.log('Testing MCQ Generation...');
        const mcqRes = await axios.post('http://127.0.0.1:4000/api/ai/generate-questions', {
            topic: 'Photosynthesis',
            count: 2,
            difficulty: 'easy',
            type: 'mcq'
        }, {
            headers: {
                'x-api-key': process.env.API_KEY
            }
        });
        console.log('MCQ Result:', JSON.stringify(mcqRes.data.questions, null, 2));

        console.log('\n----------------\n');

        console.log('Testing Subjective Generation...');
        const subRes = await axios.post('http://127.0.0.1:4000/api/ai/generate-questions', {
            topic: 'The impact of the Internet on global communication',
            count: 2,
            difficulty: 'medium',
            type: 'subjective'
        }, {
            headers: {
                'x-api-key': process.env.API_KEY
            }
        });
        console.log('Subjective Result:', JSON.stringify(subRes.data.questions, null, 2));

    } catch (error) {
        console.error('Test failed:', error.response ? error.response.data : error.message);
    }
}

testAIGenerator();
