import dotenv from "dotenv";
dotenv.config();

// --- Required Environment Variables Validation ---
const requiredVars = ['JWT_SECRET', 'API_KEY', 'MONGODB_URI'];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
    console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
    console.error('   Create a .env file with all required variables. See .env.example');
    process.exit(1);
}
