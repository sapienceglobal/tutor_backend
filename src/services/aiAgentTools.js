import User from '../models/User.js';
import Institute from '../models/Institute.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import LiveSession from '../models/LiveSession.js';
import { Exam, ExamAttempt } from '../models/Exam.js';

// --- Groq Tool Definitions ---
export const agentTools = [
    {
        type: "function",
        function: {
            name: "searchUsers",
            description: "Search for users (students, tutors, admins) by name or email to view their basic details, roles, and status.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Name or email to search for" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getInstituteDetails",
            description: "Get accurate details about ONE specific institute. Use this when asked about a single institute's details.",
            parameters: {
                type: "object",
                properties: {
                    instituteName: { type: "string", description: "Name or subdomain of the institute" }
                },
                required: ["instituteName"]
            }
        }
    },
    // 🌟 NAYA TOOL: Lists nikalne ke liye
    {
        type: "function",
        function: {
            name: "searchInstitutes",
            description: "Search or list multiple institutes by their status. ALWAYS use this when the user ASKS A QUESTION like 'which institutes are suspended?' or 'list active institutes'. DO NOT use suspend_institute for answering questions.",
            parameters: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["active", "suspended", "all"], description: "Filter by status" }
                },
                required: ["status"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getCourseMetrics",
            description: "Get detailed metrics for a specific course (such as total enrollments and pricing).",
            parameters: {
                type: "object",
                properties: {
                    courseName: { type: "string", description: "Name/title of the course to look up" }
                },
                required: ["courseName"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getLiveRadar",
            description: "Gets all currently ongoing live sessions across the platform.",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    },
    {
        type: "function",
        function: {
            name: "checkSystemAlerts",
            description: "Checks for immediate platform risks (expiring subscriptions, inactive institutes).",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    },
    {
        type: "function",
        function: {
            name: "searchExams",
            description: "Search for exams by title or course context to see average scores and attempt counts.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Name or topic of the exam to search for" }
                },
                required: ["query"]
            }
        }
    },
    // 🌟 STRICT INTENT DEFINITION
    {
        type: "function",
        function: {
            name: "getUsersList",
            description: "Get a list of users filtered by role and status. Use this when asked 'show me blocked students', 'list active tutors', etc.",
            parameters: {
                type: "object",
                properties: {
                    role: { type: "string", enum: ["student", "tutor", "admin", "all"], description: "Filter by role" },
                    status: { type: "string", enum: ["blocked", "active", "all"], description: "Filter by block status" }
                },
                required: ["role", "status"]
            }
        }
    },
];

// --- Tool Execution Routing ---
export const executeAgentTool = async (functionName, argsString) => {
    try {
        const args = argsString ? JSON.parse(argsString) : {};

        switch (functionName) {
            case 'searchUsers': return await searchUsers(args.query);
            case 'getInstituteDetails': return await getInstituteDetails(args.instituteName);
            case 'searchInstitutes': return await searchInstitutes(args.status);
            case 'searchUsers': return await searchUsers(args.query);
            case 'getUsersList': return await getUsersList(args.role, args.status); // 🌟 ADDED HERE
            case 'getInstituteDetails': return await getInstituteDetails(args.instituteName); // 🌟 Added Router
            case 'getCourseMetrics': return await getCourseMetrics(args.courseName);
            case 'getLiveRadar': return await getLiveRadar();
            case 'checkSystemAlerts': return await checkSystemAlerts();
            case 'searchExams': return await searchExams(args.query);
           

            default: return JSON.stringify({ error: `Function ${functionName} not handled.` });
        }
    } catch (error) {
        console.error(`Error executing tool ${functionName}:`, error);
        return JSON.stringify({ error: error.message });
    }
};

// --- Execution Implementations ---
async function searchUsers(query) {
    if (!query || query.length < 3) return JSON.stringify({ message: 'Query too short. Provide at least 3 characters.' });
    const regex = new RegExp(query, 'i');
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).populate('instituteId', 'name').select('name email role isBlocked createdAt instituteId').limit(5).lean();
    if (users.length === 0) return JSON.stringify({ message: "No users found." });
    return JSON.stringify(users.map(u => ({ id: u._id, name: u.name, email: u.email, role: u.role, isBlocked: u.isBlocked, institute: u.instituteId ? u.instituteId.name : null, joined: u.createdAt })));
}

async function getInstituteDetails(instituteName) {
    if (!instituteName) return JSON.stringify({ message: "Missing institute name." });
    const regex = new RegExp(instituteName, 'i');
    const institute = await Institute.findOne({ $or: [{ name: regex }, { subdomain: regex }] }).select('name subdomain isActive subscriptionPlan contactEmail subscriptionExpiresAt aiUsageQuota aiUsageCount features').lean();
    if (!institute) return JSON.stringify({ message: "No institute found matching query." });
    return JSON.stringify(institute);
}

// 🌟 NAYA FUNCTION: Handle queries about lists
async function searchInstitutes(status) {
    let query = {};
    if (status === 'active') query.isActive = true;
    if (status === 'suspended') query.isActive = false;

    const institutes = await Institute.find(query).select('name subdomain contactEmail isActive createdAt').lean().limit(10);
    if (institutes.length === 0) return JSON.stringify({ message: `No ${status} institutes found.` });

    return JSON.stringify(institutes.map(inst => ({ id: inst._id, name: inst.name, status: inst.isActive ? 'Active' : 'Suspended', email: inst.contactEmail })));
}

async function getCourseMetrics(courseName) {
    if (!courseName) return JSON.stringify({ message: "Missing course name." });
    const regex = new RegExp(courseName, 'i');
    const course = await Course.findOne({ title: regex }).select('title description category level price status').lean();
    if (!course) return JSON.stringify({ message: "Course not found." });
    const enrollmentCount = await Enrollment.countDocuments({ courseId: course._id });
    return JSON.stringify({ courseId: course._id, title: course.title, status: course.status, category: course.category, totalEnrollments: enrollmentCount, price: course.price });
}

async function getLiveRadar() {
    const activeSessions = await LiveSession.find({ status: 'ongoing' }).populate('courseId', 'title').populate('tutorId', 'name').populate('instituteId', 'name').select('title participantCount startedAt').lean();
    if (activeSessions.length === 0) return JSON.stringify({ message: "No active live sessions going on right now." });
    return JSON.stringify(activeSessions.map(sess => ({ sessionTitle: sess.title, tutorName: sess.tutorId?.name, courseTitle: sess.courseId?.title, institute: sess.instituteId?.name, participants: sess.participantCount, started: sess.startedAt })));
}

async function checkSystemAlerts() {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringInstitutes = await Institute.find({ subscriptionExpiresAt: { $lt: thirtyDaysFromNow, $gt: new Date() }, isActive: true }).select('name subscriptionExpiresAt contactEmail').lean();
    const overLimitInstitutes = await Institute.find({ $expr: { $gte: ["$aiUsageCount", "$aiUsageQuota"] } }).select('name aiUsageCount aiUsageQuota').lean();
    return JSON.stringify({ alerts: { expiringInstitutesIn30Days: expiringInstitutes, aiQuotaExhaustedInstitutes: overLimitInstitutes } });
}

async function searchExams(query) {
    if (!query || query.length < 3) return JSON.stringify({ message: "Query too short." });
    const regex = new RegExp(query, 'i');
    const exams = await Exam.find({ title: regex }).select('title passingMarks isPublished _id courseId').lean().limit(3);
    if (exams.length === 0) return JSON.stringify({ message: "No exams found." });
    let results = [];
    for (const exam of exams) {
        const attempts = await ExamAttempt.find({ examId: exam._id }).select('score isPassed').lean();
        const totalAttempts = attempts.length;
        const passedAttempts = attempts.filter(a => a.isPassed).length;
        const avgScore = totalAttempts > 0 ? (attempts.reduce((acc, a) => acc + a.score, 0) / totalAttempts).toFixed(2) : 0;
        results.push({ id: exam._id, title: exam.title, published: exam.isPublished, totalAttempts, passedAttempts, passPercentage: totalAttempts > 0 ? ((passedAttempts / totalAttempts) * 100).toFixed(1) + "%" : "N/A", averageScore: avgScore });
    }
    return JSON.stringify(results);
}

// 🌟 NAYA FUNCTION: List filter karne ke liye
async function getUsersList(role, status) {
    let query = {};
    if (role !== 'all') query.role = role;
    if (status === 'blocked') query.isBlocked = true;
    if (status === 'active') query.isBlocked = false;

    const users = await User.find(query).select('name email role isBlocked createdAt').limit(15).lean();

    if (users.length === 0) return JSON.stringify({ message: `No ${status} ${role}s found.` });

    return JSON.stringify(users.map(u => ({
        id: u._id, name: u.name, email: u.email, role: u.role, isBlocked: u.isBlocked
    })));
}