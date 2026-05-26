// Routes exempt from API key check (OAuth callbacks come from Google/GitHub servers)
const EXEMPT_ROUTES = [
    '/api/auth/google',
    '/api/auth/google/callback',
    '/api/auth/github',
    '/api/auth/github/callback',
    '/api/ai/semantic-search',
    '/api/ai/analytics',
    '/api/ai/god-mode-db'
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
    const incomingSecret = req.headers['x-n8n-secret'] || req.headers['x-n8n-api-key'];
    const configuredSecret = process.env.N8N_API_KEY || 'mera_super_secret_password_123';

    if (!incomingSecret || incomingSecret !== configuredSecret) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized access: Dynamic neural link key mismatch."
        });
    }
    next();
};
