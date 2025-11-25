const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const adminUserController = require('../controllers/adminUserController');

const { authenticateToken } = require('../middlewares/auth');

/* ============================================================
   PUBLIC ROUTES
============================================================ */
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);

/* ============================================================
   SUPERUSER ADMIN ROUTES
   All protected by authenticateToken and internal role checks
============================================================ */

// Reset password for any user (superuser only)
router.post('/admin/reset-password', authenticateToken, authController.adminResetPassword);

// Full user-management CRUD
router.get('/admin/users', authenticateToken, adminUserController.getUsers);              // List all users
router.get('/admin/users/:id', authenticateToken, adminUserController.getUser);          // Get one user
router.post('/admin/users', authenticateToken, adminUserController.createUser);          // Create user
router.put('/admin/users/:id', authenticateToken, adminUserController.updateUser);       // Update user
router.delete('/admin/users/:id', authenticateToken, adminUserController.deleteUser);    // Delete user
router.post('/admin/users/:id/reset-password', authenticateToken, adminUserController.resetUserPassword);

/* ============================================================
   PROTECTED USER ROUTES
============================================================ */
router.post('/logout', authenticateToken, authController.logout);
router.post('/reset-password', authenticateToken, authController.resetPassword);
router.get('/login-history', authenticateToken, authController.getLoginHistory);
router.get('/password-status', authenticateToken, authController.getPasswordStatus);

module.exports = router;
