import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import Institute from '../models/Institute.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
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
            message: 'Your account has been blocked by the platform administrator. Please contact support.',
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
            message: 'Your account has been blocked. You can view your purchased courses but no new activity is allowed.',
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
          message: 'Session has been revoked. Please login again.'
        });
      }
    }

    // --- Subscription Expiry Check ---
    if (req.user.instituteId) {
      const institute = await Institute.findById(req.user.instituteId);
      const reqUrl = req.originalUrl || req.url; // Full URL path for reliable matching

      if (institute && institute.subscriptionExpiresAt) {
        if (new Date(institute.subscriptionExpiresAt) < new Date()) {
          const readOnlyMethods = ['GET'];
          const allowedPaths = ['/api/auth/me', '/api/auth/sessions', '/api/payments'];
          const isAllowed = readOnlyMethods.includes(req.method) || allowedPaths.some(p => reqUrl.startsWith(p));

          if (!isAllowed) {
            return res.status(403).json({
              success: false,
              subscriptionExpired: true,
              message: 'Your institute subscription has expired. Please renew to continue.',
            });
          }
        }
      }

      // --- Institute Suspension Check ---
      if (institute && institute.isActive === false && req.user.role !== 'superadmin') {
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
              message: 'Your institute has been suspended by the platform administrator. Please contact support.',
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
              message: 'Your institute has been suspended. You can view your purchased courses but no new activity is allowed.',
            });
          }
        }
      }
    }

    // Check Maintenance Mode
    const settings = await Settings.findOne();
    if (settings && settings.maintenanceMode) {
      // Allow only admins to bypass maintenance mode
      if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(503).json({
          success: false,
          isMaintenanceMode: true,
          message: 'Platform is currently under maintenance. Please try again later.'
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
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      const token = req.headers.authorization.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.pending2FA) {
          req.user = await User.findById(decoded.id);
        }
      }
    }
  } catch {
    // Token invalid/expired — continue without user
  }
  next();
};