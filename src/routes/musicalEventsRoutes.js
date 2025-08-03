const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const { uploadWhyWatchISBCImage } = require('../utils/s3');
const router = express.Router();
const musicalEventsController = require('../controllers/musicalEventsController');


// ============ MUSICAL EVENTS PAGE ROUTES ============

// Get complete musical events page data
router.get('/', authenticateToken, musicalEventsController.getMusicalEventsPage);

// ============ WHY WATCH ISBC ROUTES ============

// Get all why watch items
router.get('/why-watch', authenticateToken, musicalEventsController.getAllWhyWatchItems);

// Get single why watch item by ID
router.get('/why-watch/:itemId', authenticateToken, musicalEventsController.getSingleWhyWatchItem);

// Add new why watch item (with image upload)
router.post(
    '/why-watch',
    authenticateToken,
    uploadWhyWatchISBCImage.single('image'),
    musicalEventsController.addWhyWatchItem
);

// Update existing why watch item (with optional image upload)
router.put(
    '/why-watch/:itemId',
    authenticateToken,
    uploadWhyWatchISBCImage.single('image'),
    musicalEventsController.updateWhyWatchItem
);

// Delete why watch item by ID
router.delete('/why-watch/:itemId', authenticateToken, musicalEventsController.deleteWhyWatchItem);

module.exports = router;
