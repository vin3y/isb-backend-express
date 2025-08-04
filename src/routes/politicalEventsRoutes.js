const express = require('express');
const {authenticateToken} = require("../middlewares/auth");
const {uploadISBCStandoutImage} = require("../utils/s3");
const router = express.Router();
const politicalEventsController = require("../controllers/politicalEventsController");

// ============ POLITICAL EVENTS PAGE ROUTES ============

// Get complete political events page data
router.get('/', authenticateToken, politicalEventsController.getPoliticalEventsPage);

// ============ ISBC STANDOUT ROUTES ============

// Get all standout items
router.get('/standout', authenticateToken, politicalEventsController.getAllStandoutItems);

// Get single standout item by ID
router.get('/standout/:itemId', authenticateToken, politicalEventsController.getSingleStandoutItem);

// Add new standout item (with image upload)
router.post(
    '/standout',
    authenticateToken,
    uploadISBCStandoutImage.single('image'),
    politicalEventsController.addStandoutItem
);

// Update existing standout item (with optional image upload)
router.put(
    '/standout/:itemId',
    authenticateToken,
    uploadISBCStandoutImage.single('image'),
    politicalEventsController.updateStandoutItem
);

// Delete standout item by ID
router.delete('/standout/:itemId', authenticateToken, politicalEventsController.deleteStandoutItem);

module.exports = router;
