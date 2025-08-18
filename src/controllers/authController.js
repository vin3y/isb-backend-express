const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { activityLoggers } = require('../middlewares/activityLogger');

// Generate access token (2 hours)
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET_KEY || 'your-secret-key',
    { expiresIn: '2h' }
  );
};

// Generate refresh token (7 days)
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, type: 'refresh' },
    process.env.REFRESH_SECRET_KEY || 'your-refresh-secret-key',
    { expiresIn: '7d' }
  );
};

// Helper function to convert UTC to local timezone for display
const formatDateForTimezone = (utcDate, timezone = 'UTC') => {
  try {
    return new Date(utcDate).toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (error) {
    console.error('Timezone conversion error:', error);
    return new Date(utcDate).toISOString();
  }
};

// Helper function to get current UTC timestamp
const getCurrentUTC = () => {
  return new Date().toISOString();
};

// Helper function to add days to current UTC date
const addDaysToUTC = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

// Helper function to log login attempts
const logLoginAttempt = async (userId, ipAddress, userAgent, success) => {
  try {
    await db.query(
      'INSERT INTO login_history (user_id, ip_address, user_agent, success, login_time) VALUES ($1, $2, $3, $4, $5)',
      [userId, ipAddress, userAgent, success, getCurrentUTC()]
    );
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
};

// Login controller
const login = async (req, res) => {
  const { email, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const userTimezone = req.headers['x-timezone'] || 'UTC'; // Get timezone from header

  try {
    // Check if user exists
    const userResult = await db.query(
      'SELECT id, email, password_hash, password_expires_at, password_updated_at FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      await logLoginAttempt(null, clientIp, userAgent, false);
      // Log failed login attempt with activity logger
      const mockReq = { ip: clientIp, get: () => userAgent, user: null };
      await activityLoggers.auth.logLogin(mockReq, false, email || 'unknown', 'User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await logLoginAttempt(user.id, clientIp, userAgent, false);
      // Log failed login attempt with activity logger
      const mockReq = {
        ip: clientIp,
        get: () => userAgent,
        user: { id: user.id, email: user.email },
      };
      await activityLoggers.auth.logLogin(mockReq, false, email, 'Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if password has expired (compare UTC dates)
    const passwordExpiresAt = new Date(user.password_expires_at);
    const currentDate = new Date();
    const passwordExpired = passwordExpiresAt < currentDate;

    // Calculate days until expiry
    const daysUntilExpiry = Math.floor(
      (passwordExpiresAt.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (passwordExpired) {
      await logLoginAttempt(user.id, clientIp, userAgent, false);
      // Log failed login attempt due to expired password
      const mockReq = {
        ip: clientIp,
        get: () => userAgent,
        user: { id: user.id, email: user.email },
      };
      await activityLoggers.auth.logLogin(mockReq, false, email, 'Password expired');
      return res.status(403).json({
        error: 'Password has expired. Please reset your password.',
        passwordExpired: true,
        requiresPasswordReset: true,
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in database with UTC expiration
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES ($1, $2, $3, $4)',
      [user.id, refreshToken, refreshTokenExpiry, getCurrentUTC()]
    );

    // Log successful login
    await logLoginAttempt(user.id, clientIp, userAgent, true);

    // Log successful login with activity logger
    const mockReq = {
      ip: clientIp,
      get: () => userAgent,
      user: { id: user.id, email: user.email },
    };
    await activityLoggers.auth.logLogin(mockReq, true, email);

    // Return response with timezone-aware dates for display
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
      },
      passwordInfo: {
        daysLeft: daysUntilExpiry, // For compatibility
        expiresIn: daysUntilExpiry,
        expiresAt: user.password_expires_at, // Keep as UTC for frontend to handle
        lastUpdate: user.password_updated_at, // Keep as UTC
        lastUpdated: user.password_updated_at, // Alternative naming
        requiresChange: daysUntilExpiry <= 7,
        // Add timezone-formatted dates for display
        expiresAtFormatted: formatDateForTimezone(user.password_expires_at, userTimezone),
        lastUpdateFormatted: formatDateForTimezone(user.password_updated_at, userTimezone),
      },
      serverTime: {
        utc: getCurrentUTC(),
        formatted: formatDateForTimezone(getCurrentUTC(), userTimezone),
        timezone: userTimezone,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Refresh token controller
const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  const userTimezone = req.headers['x-timezone'] || 'UTC';

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key'
    );

    // Check if refresh token exists in database and is valid (UTC comparison)
    const tokenResult = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > $3 AND revoked = false',
      [refreshToken, decoded.id, getCurrentUTC()]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    // Get user info
    const userResult = await db.query(
      'SELECT id, email, password_expires_at, password_updated_at FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    // Calculate password expiry info
    const passwordExpiresAt = new Date(user.password_expires_at);
    const currentDate = new Date();
    const daysUntilExpiry = Math.floor(
      (passwordExpiresAt.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    res.json({
      accessToken: newAccessToken,
      passwordInfo: {
        daysLeft: daysUntilExpiry,
        expiresIn: daysUntilExpiry,
        expiresAt: user.password_expires_at,
        lastUpdate: user.password_updated_at,
        lastUpdated: user.password_updated_at,
        requiresChange: daysUntilExpiry <= 7,
        // Add timezone-formatted dates
        expiresAtFormatted: formatDateForTimezone(user.password_expires_at, userTimezone),
        lastUpdateFormatted: formatDateForTimezone(user.password_updated_at, userTimezone),
      },
      serverTime: {
        utc: getCurrentUTC(),
        formatted: formatDateForTimezone(getCurrentUTC(), userTimezone),
        timezone: userTimezone,
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Logout controller
const logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  if (refreshToken) {
    try {
      // Update with UTC timestamp
      await db.query('UPDATE refresh_tokens SET revoked = true, updated_at = $1 WHERE token = $2', [
        getCurrentUTC(),
        refreshToken,
      ]);
    } catch (error) {
      console.error('Error revoking refresh token:', error);
    }
  }

  // Log the logout activity
  if (req.user) {
    await activityLoggers.auth.logLogout(req, req.user.email);
  }

  res.json({ message: 'Logged out successfully' });
};

// Reset password controller
const resetPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  const userTimezone = req.headers['x-timezone'] || 'UTC';

  try {
    // Get current password hash
    const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Check password requirements
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    // Check if new password is same as current
    const samePassword = await bcrypt.compare(newPassword, userResult.rows[0].password_hash);
    if (samePassword) {
      return res
        .status(400)
        .json({ error: 'New password must be different from current password' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and reset expiry (all in UTC)
    const currentUTC = getCurrentUTC();
    const newExpiryUTC = addDaysToUTC(60); // 60 days from now

    await db.query(
      `UPDATE users
       SET password_hash = $1,
           password_updated_at = $2,
           password_expires_at = $3
       WHERE id = $4`,
      [hashedPassword, currentUTC, newExpiryUTC, userId]
    );

    // Revoke all existing refresh tokens for this user
    await pool.query(`UPDATE refresh_tokens SET token = $1 WHERE user_id = $2`, [newToken, userId]);

    // Log the password reset activity
    await activityLoggers.auth.logPasswordReset(req, req.user.email);

    res.json({
      message: 'Password reset successfully',
      requiresRelogin: true,
      passwordInfo: {
        updatedAt: currentUTC,
        expiresAt: newExpiryUTC,
        updatedAtFormatted: formatDateForTimezone(currentUTC, userTimezone),
        expiresAtFormatted: formatDateForTimezone(newExpiryUTC, userTimezone),
      },
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get login history controller
const getLoginHistory = async (req, res) => {
  const userTimezone = req.headers['x-timezone'] || 'UTC';

  try {
    const result = await db.query(
      `SELECT lh.*, u.email
       FROM login_history lh
       JOIN users u ON lh.user_id = u.id
       ORDER BY lh.login_time DESC
       LIMIT 100`
    );

    // Add time_ago and formatted time to each record
    const loginHistory = result.rows.map((row) => ({
      ...row,
      time_ago: getTimeAgo(new Date(row.login_time)),
      login_time_formatted: formatDateForTimezone(row.login_time, userTimezone),
      login_time_utc: row.login_time, // Keep original UTC
    }));

    res.json(loginHistory);
  } catch (error) {
    console.error('Error fetching login history:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get password status controller
const getPasswordStatus = async (req, res) => {
  const userTimezone = req.headers['x-timezone'] || 'UTC';

  try {
    const result = await db.query(
      'SELECT password_updated_at, password_expires_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const passwordExpiresAt = new Date(user.password_expires_at);
    const currentDate = new Date();
    const daysUntilExpiry = Math.floor(
      (passwordExpiresAt.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    res.json({
      passwordUpdatedAt: user.password_updated_at,
      passwordExpiresAt: user.password_expires_at,
      passwordUpdatedAtFormatted: formatDateForTimezone(user.password_updated_at, userTimezone),
      passwordExpiresAtFormatted: formatDateForTimezone(user.password_expires_at, userTimezone),
      daysUntilExpiry,
      expired: daysUntilExpiry < 0,
      requiresChange: daysUntilExpiry <= 7,
      timezone: userTimezone,
      serverTime: {
        utc: getCurrentUTC(),
        formatted: formatDateForTimezone(getCurrentUTC(), userTimezone),
      },
    });
  } catch (error) {
    console.error('Error fetching password status:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return date.toLocaleDateString();
}

module.exports = {
  login,
  refreshToken,
  logout,
  resetPassword,
  getLoginHistory,
  getPasswordStatus,
};
