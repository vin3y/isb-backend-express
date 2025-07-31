const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");


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

// Helper function to log login attempts
const logLoginAttempt = async (userId, ipAddress, userAgent, success) => {
    try {
        await db.query(
            'INSERT INTO login_history (user_id, ip_address, user_agent, success) VALUES ($1, $2, $3, $4)',
            [userId, ipAddress, userAgent, success]
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

    try {
        // Check if user exists
        const userResult = await db.query(
            'SELECT id, email, password_hash, password_expires_at, password_updated_at FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            await logLoginAttempt(null, clientIp, userAgent, false);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            await logLoginAttempt(user.id, clientIp, userAgent, false);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if password has expired
        const passwordExpired = new Date(user.password_expires_at) < new Date();
        const daysUntilExpiry = Math.floor(
            (new Date(user.password_expires_at) - new Date()) / (1000 * 60 * 60 * 24)
        );

        if (passwordExpired) {
            await logLoginAttempt(user.id, clientIp, userAgent, false);
            return res.status(403).json({
                error: 'Password has expired. Please reset your password.',
                passwordExpired: true,
                requiresPasswordReset: true
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token in database
        await db.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        );

        // Log successful login
        await logLoginAttempt(user.id, clientIp, userAgent, true);

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email
            },
            passwordInfo: {
                expiresIn: daysUntilExpiry,
                expiresAt: user.password_expires_at,
                lastUpdated: user.password_updated_at,
                requiresChange: daysUntilExpiry <= 7
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Refresh token controller
const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
    }

    try {
        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key'
        );

        // Check if refresh token exists in database and is valid
        const tokenResult = await db.query(
            'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW() AND revoked = false',
            [refreshToken, decoded.id]
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
        const daysUntilExpiry = Math.floor(
            (new Date(user.password_expires_at) - new Date()) / (1000 * 60 * 60 * 24)
        );

        res.json({
            accessToken: newAccessToken,
            passwordInfo: {
                expiresIn: daysUntilExpiry,
                expiresAt: user.password_expires_at,
                lastUpdated: user.password_updated_at,
                requiresChange: daysUntilExpiry <= 7
            }
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

    if (refreshToken) {
        try {
            await db.query(
                'UPDATE refresh_tokens SET revoked = true WHERE token = $1',
                [refreshToken]
            );
        } catch (error) {
            console.error('Error revoking refresh token:', error);
        }
    }

    res.json({ message: 'Logged out successfully' });
};


// Reset password controller
const resetPassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        // Get current password hash
        const userResult = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

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
            return res.status(400).json({ error: 'New password must be different from current password' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and reset expiry
        await db.query(
            `UPDATE users 
       SET password_hash = $1, 
           password_updated_at = CURRENT_TIMESTAMP,
           password_expires_at = CURRENT_TIMESTAMP + INTERVAL '60 days'
       WHERE id = $2`,
            [hashedPassword, userId]
        );

        // Revoke all existing refresh tokens for this user
        await db.query(
            'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
            [userId]
        );

        res.json({
            message: 'Password reset successfully',
            requiresRelogin: true
        });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Get login history controller
const getLoginHistory = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT lh.*, u.email 
       FROM login_history lh 
       JOIN users u ON lh.user_id = u.id 
       ORDER BY lh.login_time DESC 
       LIMIT 100`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching login history:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Get password status controller
const getPasswordStatus = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT password_updated_at, password_expires_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const daysUntilExpiry = Math.floor(
            (new Date(user.password_expires_at) - new Date()) / (1000 * 60 * 60 * 24)
        );

        res.json({
            passwordUpdatedAt: user.password_updated_at,
            passwordExpiresAt: user.password_expires_at,
            daysUntilExpiry,
            expired: daysUntilExpiry < 0,
            requiresChange: daysUntilExpiry <= 7
        });
    } catch (error) {
        console.error('Error fetching password status:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


module.exports = {
    login,
    refreshToken,
    logout,
    resetPassword,
    getLoginHistory,
    getPasswordStatus
};
