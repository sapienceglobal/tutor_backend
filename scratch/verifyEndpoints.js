import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 4000;
const BASE_URL = `http://localhost:${PORT}/api`;

console.log('API Key:', API_KEY);
console.log('Base URL:', BASE_URL);

async function test() {
    try {
        // 1. Login as Aarav Patel
        console.log('\n🔐 Testing login for Aarav Patel...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'aarav.patel@gmail.com',
            password: 'password123'
        }, {
            headers: {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        const token = loginResponse.data.token;
        console.log('✅ Logged in successfully. Token:', token ? token.substring(0, 20) + '...' : 'NONE');

        // 2. Fetch Exams List (Check Subject Mixing & Title Cleaning)
        console.log('\n📝 Testing GET /student/exams/all...');
        const examsResponse = await axios.get(`${BASE_URL}/student/exams/all`, {
            headers: {
                'x-api-key': API_KEY,
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Received Exams List:');
        const exams = examsResponse.data.exams;
        if (exams && exams.length > 0) {
            exams.forEach(e => {
                console.log(` - Title: "${e.title}" | Course: "${e.courseTitle}" | Tutor: "${e.tutorName}"`);
            });
        } else {
            console.log(' ⚠️ No exams returned or list empty.');
        }

        // 3. Fetch Course Details for Chemistry Course (Check Module/Lesson Linkage)
        const chemCourseId = '6a364c7c821b828b88b5edd5';
        console.log(`\n🧪 Testing GET /courses/${chemCourseId}...`);
        const courseResponse = await axios.get(`${BASE_URL}/courses/${chemCourseId}`, {
            headers: {
                'x-api-key': API_KEY,
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Received Course details:');
        console.log(` - Title: "${courseResponse.data.course.title}"`);
        console.log(` - Enrolled status: ${courseResponse.data.isEnrolled}`);
        console.log(' - Modules in course:');
        courseResponse.data.course.modules.forEach(m => {
            console.log(`   * Module Name: "${m.title}" (_id: ${m._id})`);
        });

        console.log(' - Lessons in response:');
        const lessons = courseResponse.data.lessons;
        if (lessons && lessons.length > 0) {
            lessons.forEach(l => {
                console.log(`   * Lesson Name: "${l.title}" | moduleId: ${l.moduleId}`);
            });
        } else {
            console.log(' ⚠️ No lessons returned in the response.');
        }

    } catch (err) {
        console.error('❌ Error during endpoint testing:', err.response ? err.response.data : err.message);
    }
}

test();
