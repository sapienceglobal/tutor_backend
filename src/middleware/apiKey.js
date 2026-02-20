// Routes exempt from API key check (OAuth callbacks come from Google/GitHub servers)
const EXEMPT_ROUTES = [
    '/api/auth/google',
    '/api/auth/google/callback',
    '/api/auth/github',
    '/api/auth/github/callback'
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
