// Routes exempt from API key check (OAuth callbacks come from Google/GitHub servers)
const EXEMPT_ROUTES = [
    '/api/auth/google',
    '/api/auth/google/callback',
    '/api/auth/github',
    '/api/auth/github/callback',
    '/api/ai/semantic-search',
    '/api/ai/analytics',
    '/api/ai/god-mode-db',
    '/api/ai/trigger-email',
    '/api/ai/generate-csv-report',
    '/api/ai/system-health'
];

export const verifyApiKey = (req, res, next) => {
    // Skip API key check for OAuth routes
    if (EXEMPT_ROUTES.some(route => req.path.startsWith(route))) {
        return next();
    }

    const clientKey = req.headers['x-api-key'];

    if (!clientKey) {
        return res.status(401).json({
            success: false,
            message: "API Key missing"
        });
    }

    if (clientKey !== process.env.API_KEY) {
        return res.status(403).json({
            success: false,
            message: "Invalid API Key"
        });
    }

    next();
};

// 🔒 n8n Secret Line Middleware: Prevents unauthorized public access to RAG & Analytics tunnels
export const checkN8nSecret = (req, res, next) => {
    const configuredSecret = process.env.N8N_API_KEY;

    // SECURITY: Block all n8n-protected routes if the secret is not configured
    if (!configuredSecret) {
        console.error('SECURITY: N8N_API_KEY environment variable is not configured. Blocking n8n endpoint access.');
        return res.status(503).json({
            success: false,
            message: "Service unavailable: AI integration is not configured."
        });
    }

    const incomingSecret = req.headers['x-n8n-secret'] || req.headers['x-n8n-api-key'];

    if (!incomingSecret || incomingSecret !== configuredSecret) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized access: Invalid integration key."
        });
    }
    next();
};
