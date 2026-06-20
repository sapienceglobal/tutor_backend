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

async function test() {
    try {
        console.log('📝 Testing GET /certificates/verify/CERT-SAP-2026-0002...');
        const res = await axios.get(`${BASE_URL}/certificates/verify/CERT-SAP-2026-0002`, {
            headers: {
                'x-api-key': API_KEY
            }
        });

        console.log('✅ Response status:', res.status);
        console.log('✅ Response body:', JSON.stringify(res.data, null, 2));

        if (res.data?.success && res.data?.certificate) {
            const cert = res.data.certificate;
            console.log('\n⭐ Verification Success!');
            console.log(` - Certificate ID: ${cert.certificateId}`);
            console.log(` - Student Name: ${cert.studentName}`);
            console.log(` - Course Name: ${cert.courseName}`);
            console.log(` - Tutor Name: ${cert.tutorName}`);
            console.log(` - Issued At: ${cert.issuedAt}`);
        } else {
            console.log('\n❌ Verification response did not have success or certificate object.');
        }

    } catch (err) {
        console.error('❌ Error during testing:', err.response ? err.response.data : err.message);
    }
}

test();
