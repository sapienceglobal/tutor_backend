import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import Institute from '../models/Institute.js';

// ── Settings Cache (avoids DB query on every request) ───────────────────────
let _cachedSettings = null;
let _settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedSettings = async () => {
    const now = Date.now();
    if (!_cachedSettings || (now - _settingsCacheTime) > SETTINGS_CACHE_TTL) {
        _cachedSettings = await Settings.findOne().lean();
        _settingsCacheTime = now;
    }
    return _cachedSettings;
};

// ── Institute Cache (avoids DB query on every request) ───────────────────────
let _instituteCache = new Map();
const INST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

const getCachedInstitute = async (id) => {
    if (!id) return null;
    const key = id.toString();
    const now = Date.now();
    const cached = _instituteCache.get(key);
    if (cached && (now - cached.time) < INST_CACHE_TTL) {
        return cached.data;
    }
    const institute = await Institute.findById(id).lean();
    if (institute) {
        // Ensure _id is present as object or string
        _instituteCache.set(key, { data: institute, time: now });
    }
    return institute;
};

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers, cookies, or query parameters
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Reject pending 2FA tokens from accessing protected routes
    if (decoded.pending2FA) {
      return res.status(401).json({
        success: false,
        message: '2FA verification required'
      });
    }

    // Get user from token
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Attach tenant context when user belongs to an institute.
    req.tenant = null;

    // Admin accounts must always be tied to an institute.
    if (req.user.role === 'admin' && !req.user.instituteId) {
      return res.status(403).json({
        success: false,
        message: 'Admin account is not linked to an institute'
      });
    }

    // Prevent blocked users from making requests
    if (req.user.isBlocked) {
      const reqUrl = req.originalUrl || req.url;
      const blockedAllowedPaths = ['/api/auth/me', '/api/auth/logout'];
      const isBlockedAllowed = blockedAllowedPaths.some(p => reqUrl.startsWith(p));

      // Always attach the flag so /auth/me can include it in the response
      req.userBlocked = true;

      // Admin & Tutor → block everything EXCEPT auth/me and logout
      if (req.user.role === 'admin' || req.user.role === 'tutor') {
        if (!isBlockedAllowed) {
          return res.status(403).json({
            success: false,
            userBlocked: true,
            message: 'Account has been blocked by the administrator. Contact support for assistance.',
          });
        }
      }

      // Student → read-only access to purchased course content
      if (req.user.role === 'student') {
        const studentAllowedPaths = [
          ...blockedAllowedPaths,
          '/api/courses', '/api/lessons', '/api/progress', '/api/auth/sessions',
        ];
        const isStudentAllowed = req.method === 'GET' && studentAllowedPaths.some(p => reqUrl.startsWith(p));

        if (!isStudentAllowed) {
          return res.status(403).json({
            success: false,
            userBlocked: true,
            message: 'Account has been blocked. Access is restricted to viewing purchased courses.',
          });
        }
      }
    }

    // --- Session Validation ---
    // Verify that this token exists in user's active sessions
    if (req.user.activeSessions && req.user.activeSessions.length > 0) {
      const sessionExists = req.user.activeSessions.some(s => s.token === token);
      if (!sessionExists) {
        return res.status(401).json({
          success: false,
          sessionRevoked: true,
          message: 'Session has been revoked. Login is required.'
        });
      }
    }

    // --- Subscription Expiry Check ---
    if (req.user.instituteId) {
      const institute = await getCachedInstitute(req.user.instituteId);
      req.tenant = institute || null;
      const reqUrl = req.originalUrl || req.url; // Full URL path for reliable matching

      if (!institute) {
        return res.status(403).json({
          success: false,
          message: 'Institute not found for this account'
        });
      }

      if (institute.subscriptionExpiresAt) {
        if (new Date(institute.subscriptionExpiresAt) < new Date()) {
          const readOnlyMethods = ['GET'];
          const allowedPaths = ['/api/auth/me', '/api/auth/sessions', '/api/payments'];
          const isAllowed = readOnlyMethods.includes(req.method) || allowedPaths.some(p => reqUrl.startsWith(p));

          if (!isAllowed) {
            return res.status(403).json({
              success: false,
              subscriptionExpired: true,
              message: 'Institute subscription has expired. Renewal is required to continue.',
            });
          }
        }
      }

      // --- Institute Suspension Check ---
      if (institute.isActive === false && req.user.role !== 'superadmin') {
        const suspendedAllowedPaths = ['/api/auth/me', '/api/auth/logout'];
        const isSuspendedAllowed = suspendedAllowedPaths.some(p => reqUrl.startsWith(p));

        // Always attach the flag so /auth/me can include it in the response
        req.instituteSuspended = true;

        // Admin & Tutor → block everything EXCEPT auth/me and logout
        if (req.user.role === 'admin' || req.user.role === 'tutor') {
          if (!isSuspendedAllowed) {
            return res.status(403).json({
              success: false,
              instituteSuspended: true,
              message: 'Institute has been suspended by the administrator. Contact support for assistance.',
            });
          }
        }

        // Student → read-only access to purchased course content
        if (req.user.role === 'student') {
          const studentAllowedPaths = [
            ...suspendedAllowedPaths,
            '/api/courses', '/api/lessons', '/api/progress', '/api/auth/sessions',
          ];
          const isStudentAllowed = req.method === 'GET' && studentAllowedPaths.some(p => reqUrl.startsWith(p));

          if (!isStudentAllowed) {
            return res.status(403).json({
              success: false,
              instituteSuspended: true,
              message: 'Institute has been suspended. Access is restricted to viewing purchased courses.',
            });
          }
        }
      }
    }

    // Check Maintenance Mode (cached — refreshes every 5 min)
    const settings = await getCachedSettings();
    if (settings && settings.maintenanceMode) {
      // Allow only admins to bypass maintenance mode
      if (req.user.role !== 'superadmin') {
        return res.status(503).json({
          success: false,
          isMaintenanceMode: true,
          message: 'Platform is currently under maintenance. Try again later.'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Optional: Admin middleware
export const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
};

// Grant access to specific roles (superadmin always passes)
export const authorize = (...roles) => {
  return (req, res, next) => {
    // Superadmin has god-mode — always allowed
    if (req.user.role === 'superadmin') return next();

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Optional auth — populates req.user if token exists, but doesn't block if missing
export const optionalAuth = async (req, res, next) => {
  try {
    req.tenant = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      const token = req.headers.authorization.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.pending2FA) {
          req.user = await User.findById(decoded.id);
          if (req.user?.instituteId) {
            req.tenant = await getCachedInstitute(req.user.instituteId);
          }
        }
      }
    }
  } catch {
    // Token invalid/expired — continue without user
  }
  next();
};