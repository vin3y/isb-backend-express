const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { activityLoggers } = require('../middlewares/activityLogger');

/* ============================================================
   TOKEN GENERATORS
============================================================ */

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET_KEY || 'your-secret-key',
    { expiresIn: '2h' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: 'refresh' },
    process.env.REFRESH_SECRET_KEY || 'your-refresh-secret-key',
    { expiresIn: '7d' }
  );
};

/* ============================================================
   DATE/TIME HELPERS
============================================================ */

const getCurrentUTC = () => new Date().toISOString();

const addDaysToUTC = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

const formatDateForTimezone = (utcDate, timezone = 'UTC') => {
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
};

/* ============================================================
   LOGIN HISTORY LOGGER
============================================================ */

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

/* ============================================================
   LOGIN CONTROLLER
============================================================ */

const login = async (req, res) => {
  const { email, username, password } = req.body;
  const identifier = email || username;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const userTimezone = req.headers['x-timezone'] || 'UTC';

  try {
    const userResult = await db.query(
      `SELECT id, email, role, password_hash, password_expires_at, password_updated_at
       FROM users
       WHERE email = $1 OR email = $2`,
      [identifier, identifier + '@local']
    );

    // USER NOT FOUND
    if (userResult.rows.length === 0) {
      await activityLoggers.auth.logLogin(req, false, identifier, "User not found");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);

    // WRONG PASSWORD
    if (!validPassword) {
      await activityLoggers.auth.logLogin(req, false, user.email, "Incorrect password");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // PASSWORD EXPIRED (NOT for superuser)
    if (user.role !== "superuser") {
      const expiresAt = new Date(user.password_expires_at);
      const now = new Date();

      if (expiresAt < now) {
        await activityLoggers.auth.logLogin(req, false, user.email, "Password expired");
        return res.status(403).json({
          error: "Password has expired. Please reset your password.",
          passwordExpired: true
        });
      }
    }

    // SUCCESSFUL LOGIN → LOG IT
    await activityLoggers.auth.logLogin(req, true, user.email, null);

    // Generate access + refresh tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const refreshExpiryUTC = addDaysToUTC(7);

    await db.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES ($1, $2, $3, $4)",
      [user.id, refreshToken, refreshExpiryUTC, new Date().toISOString()]
    );

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      passwordInfo: {
        expiresAt: user.password_expires_at,
        lastUpdate: user.password_updated_at,
        expiresAtFormatted: formatDateForTimezone(user.password_expires_at, userTimezone),
        lastUpdateFormatted: formatDateForTimezone(user.password_updated_at, userTimezone),
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};



/* ============================================================
   REFRESH TOKEN
============================================================ */

const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  const timezone = req.headers["x-timezone"] || "UTC";

  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_SECRET_KEY || "your-refresh-secret-key"
    );

    const tokenResult = await db.query(
      `SELECT * FROM refresh_tokens 
       WHERE token=$1 AND user_id=$2 AND expires_at > $3 AND revoked=false`,
      [refreshToken, decoded.id, new Date().toISOString()]
    );

    if (tokenResult.rows.length === 0) {
      await activityLoggers.auth.logLogin(req, false, decoded.email, "Invalid refresh token");
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    const userResult = await db.query(
      "SELECT id, email, role, password_expires_at, password_updated_at FROM users WHERE id=$1",
      [decoded.id]
    );

    const user = userResult.rows[0];
    const newAccessToken = generateAccessToken(user);

    return res.json({
      accessToken: newAccessToken,
      passwordInfo: {
        expiresAt: user.password_expires_at,
        lastUpdate: user.password_updated_at,
        expiresAtFormatted: formatDateForTimezone(user.password_expires_at, timezone),
        lastUpdateFormatted: formatDateForTimezone(user.password_updated_at, timezone),
      },
    });

  } catch (err) {
    await activityLoggers.auth.logLogin(req, false, "UNKNOWN", "Expired refresh token");
    return res.status(403).json({ error: "Invalid or expired refresh token" });
  }
};


/* ============================================================
   LOGOUT
============================================================ */

const logout = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      await db.query(
        "UPDATE refresh_tokens SET revoked = true, updated_at = $1 WHERE token = $2",
        [new Date().toISOString(), refreshToken]
      );
    }

    if (req.user) {
      await activityLoggers.auth.logLogout(req, req.user.email);
    }

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};


/* ============================================================
   USER RESET OWN PASSWORD
============================================================ */

const resetPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  const email = req.user.email;

  try {
    const userResult = await db.query(
      "SELECT password_hash, role FROM users WHERE id = $1",
      [userId]
    );

    const user = userResult.rows[0];

    // 🔐 SUPERUSER — does NOT need old password
    if (user.role === "superuser") {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.query(
        `UPDATE users SET password_hash=$1, password_updated_at=$2, password_expires_at=$3 WHERE id=$4`,
        [hashedPassword, new Date().toISOString(), "9999-12-31 23:59:59", userId]
      );

      await activityLoggers.auth.logPasswordReset(req, email);

      return res.json({ message: "Superuser password updated successfully" });
    }

    // NORMAL USER
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: "Current password incorrect" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users SET password_hash=$1, password_updated_at=$2, password_expires_at=$3 WHERE id=$4`,
      [hashedPassword, new Date().toISOString(), addDaysToUTC(60), userId]
    );

    await activityLoggers.auth.logPasswordReset(req, email);

    res.json({
      message: "Password reset successfully",
      requiresRelogin: true,
    });

  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};


/* ============================================================
   ADMIN RESET ANY USER PASSWORD (SUPERUSER ONLY)
============================================================ */

const adminResetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  if (req.user.role !== "superuser") {
    return res.status(403).json({ error: "Only superuser can reset passwords" });
  }

  try {
    const userResult = await db.query("SELECT id FROM users WHERE email=$1", [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users SET password_hash=$1, password_updated_at=$2, password_expires_at=$3 WHERE email=$4`,
      [hashedPassword, new Date().toISOString(), addDaysToUTC(60), email]
    );

    await activityLoggers.auth.logPasswordReset(req, email);

    res.json({ message: "Password reset successfully" });

  } catch (error) {
    console.error("Admin password reset error:", error);
    res.status(500).json({ error: "Server error" });
  }
};



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

    const expiresAt = new Date(user.password_expires_at);
    const diff = expiresAt - new Date();
    const daysUntilExpiry = Math.floor(diff / (1000 * 60 * 60 * 24));

    res.json({
      updatedAt: user.password_updated_at,
      expiresAt: user.password_expires_at,
      updatedAtFormatted: formatDateForTimezone(user.password_updated_at, userTimezone),
      expiresAtFormatted: formatDateForTimezone(user.password_expires_at, userTimezone),
      daysUntilExpiry,
      expired: daysUntilExpiry < 0,
    });
  } catch (error) {
    console.error('Error fetching password status:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

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

    const loginHistory = result.rows.map((row) => ({
      ...row,
      login_time_formatted: formatDateForTimezone(row.login_time, userTimezone),
      login_time_utc: row.login_time,
    }));

    res.json(loginHistory);
  } catch (error) {
    console.error('Error fetching login history:', error);
    res.status(500).json({ error: 'Server error' });
  }
};


/* ============================================================
   EXPORT CONTROLLERS
============================================================ */

module.exports = {
  login,
  refreshToken,
  logout,
  resetPassword,
  adminResetPassword,
  getLoginHistory,
  getPasswordStatus
};
