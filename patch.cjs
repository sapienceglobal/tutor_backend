const fs = require('fs');

let content = fs.readFileSync('src/controllers/aiController.js', 'utf8');

// 1. Insert callGroqWithTools before generateQuestions
const insertIndex = content.indexOf('export const generateQuestions = async (req, res) => {');

const callGroqCode = `// Helper function to call Groq AI iteratively handling all backend function calls
async function callGroqWithTools(messages, tools, maxLoops = 3) {
    let loopCount = 0;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const { executeAgentTool } = await import('../services/aiAgentTools.js');
    
    while (loopCount < maxLoops) {
        loopCount++;

        // Small rate-limit buffer between loops (skip on first call)
        if (loopCount > 1) await sleep(1000);

        try {
            const res = await (await import('axios')).default.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: 'llama-3.3-70b-versatile',
                    messages: messages,
                    tools: tools,
                    tool_choice: 'auto',
                    max_tokens: 2000,
                    temperature: 0.5,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: \`Bearer \${process.env.GROQ_API_KEY}\`,
                    },
                }
            );

            const responseMessage = res.data.choices[0].message;
            messages.push(responseMessage);

            if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
                return responseMessage.content || '';
            }

            const toolResults = await Promise.all(
                responseMessage.tool_calls
                    .filter(tc => tc.type === 'function')
                    .map(async (toolCall) => {
                        const functionResponse = await executeAgentTool(
                            toolCall.function.name,
                            toolCall.function.arguments
                        );
                        return {
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            name: toolCall.function.name,
                            content: functionResponse,
                        };
                    })
            );

            messages.push(...toolResults);
        } catch (error) {
            console.error('Groq Agentic Loop Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'AI Chat failed');
        }
    }
    return "Agentic loop limit reached. Please refine your question or ask in smaller parts.";
}

`;

content = content.slice(0, insertIndex) + callGroqCode + content.slice(insertIndex);

// 2. Append Super Admin Functions to EOF
const eofCode = `

// @desc    Super Admin Agentic Chat (God Mode)
// @route   POST /api/ai/superadmin-coordinator
export const superAdminCoordinatorChat = async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const User = (await import('../models/User.js')).default;
        const Institute = (await import('../models/Institute.js')).default;
        const Course = (await import('../models/Course.js')).default;
        const Enrollment = (await import('../models/Enrollment.js')).default;
        const { agentTools } = await import('../services/aiAgentTools.js');

        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalTutors = await User.countDocuments({ role: 'tutor' });
        const totalInstitutes = await Institute.countDocuments();
        
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const expiringInstitutes = await Institute.find({
            subscriptionExpiresAt: { $lt: thirtyDaysFromNow, $gt: new Date() },
            isActive: true
        }).select('name subscriptionExpiresAt contactEmail');

        const expiringListStr = expiringInstitutes.length > 0 
            ? expiringInstitutes.map(inst => \`- \${inst.name} (Contact: \${inst.contactEmail}, Expires On: \${new Date(inst.subscriptionExpiresAt).toLocaleDateString()})\`).join('\\n')
            : 'No institutes are expiring in the next 30 days.';

        const suspendedInstitutesCount = await Institute.countDocuments({ isActive: false });
        const blockedUsersCount = await User.countDocuments({ isBlocked: true });
        
        const totalActiveCourses = await Course.countDocuments({ status: 'published' });
        const totalEnrollments = await Enrollment.countDocuments();
        
        const platformState = \`LIVE STATS: Students=\${totalStudents}, Tutors=\${totalTutors}, Institutes=\${totalInstitutes}, Courses(published)=\${totalActiveCourses}, Enrollments=\${totalEnrollments}, SuspendedInstitutes=\${suspendedInstitutesCount}, BlockedUsers=\${blockedUsersCount}. EXPIRING(30days): \${expiringListStr}\`;

        const systemPrompt = {
            role: 'system',
            content: \`You are the Sapience LMS Super Admin AI Coordinator - an elite, agentic AI assistant designed exclusively for the platform owner/super admin.
You monitor the entire SaaS platform's health and provide deeply analytical, operational, and actionable advice.

\${platformState}

READ-ONLY TOOLS (NO CONFIRMATION NEEDED):
- searchUsers(query): Find user details by name/email
- getInstituteDetails(instituteName): Get ONE institute's full details. NEVER try to pass "All Institutes".
- getCourseMetrics(courseName): Enrollment & price stats for a course
- getLiveRadar(): See all active live sessions across the platform RIGHT NOW
- checkSystemAlerts(): Get expiring subscriptions (INCLUDES EMAILS) & AI quota alerts. Call this when asked about expiring institutes.
- searchExams(query): Exam pass rates and attempt stats

Call these tools automatically when the Super Admin asks for specific details not present in the dashboard summary. NO CONFIRMATION NEEDED FOR READ TOOLS.

DESTRUCTIVE ACTIONS (REQUIRE JSON FORMAT):
When the Super Admin explicitly asks you to perform a critical platform operation (e.g., "Suspend this institute", "Block this user"):
1. Explain what you WILL do based on current data.
2. At the VERY END of your response, output a structured JSON block representing the action. 
3. ONLY use these EXACT action names: 'suspend_institute', 'block_user'.
4. CRITICAL RULE: DO NOT create a JSON block for data fetching. NEVER create JSON blocks except for suspending/blocking.
5. JSON block format: \\\`\\\`\\\`json { "action": "suspend_institute", "targetId": "<real_mongo_id>" } \\\`\\\`\\\`

Respond clearly, concisely, and format your answers nicely using Markdown.\`
        };

        // Filter out ANY previous assistant tool call messages - they cause Groq 400 bad request formatting errors
        const formattedHistory = [];
        for (const msg of history.slice(-4)) {
            if (msg.role === 'user') {
                formattedHistory.push({ role: 'user', content: String(msg.content).slice(0, 800) });
            } else if (msg.role === 'assistant' || msg.role === 'coordinator' || msg.role === 'tutor') {
                // If it has a json action block, strip it so the model doesn't over-generate action blocks
                let cleanContent = String(msg.content).replace(/\`\`\`json[\\s\\S]*?\`\`\`/g, '').trim();
                if (cleanContent) {
                    formattedHistory.push({ role: 'assistant', content: cleanContent.slice(0, 800) });
                }
            }
        }

        const messages = [
            systemPrompt,
            ...formattedHistory,
            { role: 'user', content: message }
        ];

        const responseText = await callGroqWithTools(messages, agentTools);

        res.status(200).json({
            success: true,
            reply: responseText,
            platformStateFootprint: {
                totalStudents, totalTutors, totalInstitutes, totalActiveCourses, expiringInstitutesCount: expiringInstitutes.length
            }
        });

    } catch (error) {
        console.error('superAdminCoordinatorChat error:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Failed to process AI Super Admin Chat' });
    }
};

// @desc    Execute AI Generated Action (God Mode Button)
// @route   POST /api/ai/execute-action
export const executeAIAction = async (req, res) => {
    try {
        const { action, targetId } = req.body;

        if (!action || !targetId) {
            return res.status(400).json({ success: false, message: 'Action and Target ID are required' });
        }

        const User = (await import('../models/User.js')).default;
        const Institute = (await import('../models/Institute.js')).default;

        let resultMsg = "Action executed successfully";

        if (action === "suspend_institute") {
            const institute = await Institute.findById(targetId);
            if (!institute) return res.status(404).json({ success: false, message: 'Institute not found' });
            institute.isActive = !institute.isActive; // Toggle
            await institute.save();
            resultMsg = \`Institute \${institute.name} has been \${institute.isActive ? 'activated' : 'suspended'}.\`;
        }
        else if (action === "block_user") {
            const user = await User.findById(targetId);
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });
            user.isBlocked = !user.isBlocked; // Toggle
            await user.save();
            resultMsg = \`User \${user.name} has been \${user.isBlocked ? 'unblocked' : 'blocked'}.\`;
        }
        else {
            return res.status(400).json({ success: false, message: 'Unknown action type requested' });
        }

        res.status(200).json({ success: true, message: resultMsg });

    } catch (error) {
        console.error('executeAIAction error:', error);
        res.status(500).json({ success: false, message: 'Failed to execute AI action' });
    }
};

`;

fs.writeFileSync('src/controllers/aiController.js', content + eofCode);
console.log('Patch complete.');
