const express = require('express');
const router = express.Router();

const aboutController = require('../controllers/aboutController');
const { authenticateToken } = require('../middlewares/auth'); // ✅ FIXED

const { uploadTeamPhoto, uploadAboutEventVideo } = require('../utils/s3');

// ==============================
// GET ABOUT PAGE – Admin Panel
// ==============================
router.get('/page-data', authenticateToken, aboutController.getAboutPageData);

// ==============================
// TEAM CRUD
// ==============================
router.post(
  '/team',
  authenticateToken,
  uploadTeamPhoto.single('photo'),
  aboutController.addTeamMember
);

router.put(
  '/team/:id',
  authenticateToken,
  uploadTeamPhoto.single('photo'),
  aboutController.updateTeamMember
);

router.delete('/team/:id', authenticateToken, aboutController.deleteTeamMember);

// ==============================
// SECTIONS (Vision, Mission, Who We Are)
// ==============================
// router.post('/sections', authenticateToken, aboutController.updateAboutSections);

// ==============================
// EVENTS CRUD (⭐ NEW)
// ==============================
router.get('/events', authenticateToken, aboutController.getAllEvents);

router.post(
  '/events',
  authenticateToken,
  uploadAboutEventVideo.single('event_video'),
  aboutController.addEvent
);

router.put(
  '/events/:eventId',
  authenticateToken,
  uploadAboutEventVideo.single('event_video'),
  aboutController.updateEvent
);

router.delete('/events/:eventId', authenticateToken, aboutController.deleteEvent);

module.exports = router;
