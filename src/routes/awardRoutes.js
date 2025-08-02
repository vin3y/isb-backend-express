const express = require('express');
const {authenticateToken} = require("../middlewares/auth");
const {uploadAwardImage} = require("../utils/s3");
const router = express.Router();
const awardsController = require('../controllers/awardController');



// GET routes
// Get all awards for awards page
router.get('/', authenticateToken, awardsController.getAllAwards);

// Get unique years that have awards
router.get('/years', authenticateToken, awardsController.getAwardYears);

// Get awards by specific year
router.get('/year/:year', authenticateToken, awardsController.getAwardsByYear);

// Get single award by ID
router.get('/:awardId', authenticateToken, awardsController.getSingleAward);

// POST routes
// Add new award (with image upload)
router.post('/', authenticateToken, uploadAwardImage.single('awardImage'), awardsController.addAward);

// PUT routes
// Update existing award (with optional image upload)
router.put('/:awardId', authenticateToken, uploadAwardImage.single('awardImage'), awardsController.updateAward);

// DELETE routes
// Delete award by ID
router.delete('/:awardId', authenticateToken, awardsController.deleteAward);

module.exports = router;
