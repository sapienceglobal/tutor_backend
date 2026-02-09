import bcrypt from 'bcryptjs';

const password = 'password123';
// Hash provided by user
const hash = '$2b$10$uP7AyQPjk9PNXCZggbvnXevCLp9d6PDTIReynSBrqHvniijKfz6Cu';

console.log('Testing password:', password);
console.log('Against hash:', hash);

try {
    const res = await bcrypt.compare(password, hash);
    console.log("Comparison result: " + res);
} catch (err) {
    console.error("Error:", err);
}
