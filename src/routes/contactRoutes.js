const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const {
  getContactPage,
  getContactInfo,
  updateContactInfo,
  getSingleMessage,
  updateMessageStatus,
  deleteMessage,
  bulkUpdateMessageStatus,
  getMessagesByStatus,
  getMessageStats,
} = require('../controllers/contactController');

const router = express.Router();

// ===========================================
// ADMIN ROUTES (Protected - require authentication)
// ===========================================

// Get contact page with all information and messages (with pagination and filtering)
// GET /api/contact?page=1&limit=10&status=contacted
router.get('/', authenticateToken, getContactPage);

// Get contact information only
// GET /api/contact/info
router.get('/info', authenticateToken, getContactInfo);

// Update contact information
// PUT /api/contact/info
router.put('/info', authenticateToken, updateContactInfo);

// Get specific message details
// GET /api/contact/messages/123
router.get('/messages/:messageId', authenticateToken, getSingleMessage);

// Update message status (contacted <-> acknowledged)
// PATCH /api/contact/messages/123/status
router.patch('/messages/:messageId/status', authenticateToken, updateMessageStatus);

// Delete specific message
// DELETE /api/contact/messages/123
router.delete('/messages/:messageId', authenticateToken, deleteMessage);

// Bulk update message statuses
// PATCH /api/contact/messages/bulk/status
router.patch('/messages/bulk/status', authenticateToken, bulkUpdateMessageStatus);

// Get messages by status (contacted or acknowledged) with pagination
// GET /api/contact/messages/status/contacted?page=1&limit=10
router.get('/messages/status/:status', authenticateToken, getMessagesByStatus);

// Get message statistics and analytics
// GET /api/contact/stats
router.get('/stats', authenticateToken, getMessageStats);

module.exports = router;
