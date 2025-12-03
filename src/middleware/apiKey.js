export const verifyApiKey = (req, res, next) => {
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
