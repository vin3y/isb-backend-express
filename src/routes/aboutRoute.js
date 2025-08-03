const express = require('express');
const router = express.Router();
const aboutController = require('../controllers/aboutController');
const { uploadTeamPhoto } = require('../utils/s3');
const { authenticateToken } = require('../middlewares/auth');

// Get all about page data (vision, mission, team)
router.get('/', authenticateToken, aboutController.getAboutPageData);

// Vision and Mission routes
router.put('/vision', authenticateToken, aboutController.updateVision);
router.put('/mission', authenticateToken, aboutController.updateMission);

// Team member routes
router.get('/team', authenticateToken, aboutController.getAllTeamMembers);
router.get('/team/:memberId', authenticateToken, aboutController.getTeamMember);
router.post(
  '/team',
  authenticateToken,
  uploadTeamPhoto.single('photo'),
  aboutController.addTeamMember
);
router.put(
  '/team/:memberId',
  authenticateToken,
  uploadTeamPhoto.single('photo'),
  aboutController.updateTeamMember
);
router.delete('/team/:memberId', authenticateToken, aboutController.deleteTeamMember);

module.exports = router;
