const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');

//public routes
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
// Add this route (protected, admin only ideally)
router.post('/admin/reset-password', authenticateToken, authController.adminResetPassword);

//protected routes
router.post('/logout', authenticateToken, authController.logout);
router.post('/reset-password', authenticateToken, authController.resetPassword);
router.get('/login-history', authenticateToken, authController.getLoginHistory);
router.get('/password-status', authenticateToken, authController.getPasswordStatus);

module.exports = router;
