const express = require('express');
const router = express.Router();
const isbFilmsPageController = require('../controllers/isbFilmsPageController');
const isbFilmsCrewController = require('../controllers/isbFilmsCrewController');
const {
  uploadISBFilmsBackgroundVideo,
  uploadISBFilmsCrewPhoto,
} = require('../utils/s3');
const { authenticateToken } = require('../middlewares/auth');

// ==================== ISB FILMS PAGE ROUTES ====================

// Get all ISB Films pages
router.get('/', authenticateToken, isbFilmsPageController.getAllISBFilmsPages);

// Get specific page details
router.get('/:pageName', authenticateToken, isbFilmsPageController.getISBFilmsPageDetails);

// Save page as draft
router.post('/:pageName/save', authenticateToken, isbFilmsPageController.saveISBFilmsPage);

// Publish page
router.post('/:pageName/publish', authenticateToken, isbFilmsPageController.publishISBFilmsPage);

// Update page status
router.patch(
  '/:pageName/status',
  authenticateToken,
  isbFilmsPageController.updateISBFilmsPageStatus
);

// Update page title
router.patch(
  '/:pageName/title',
  authenticateToken,
  isbFilmsPageController.updateISBFilmsPageTitle
);

// Upload background video
router.post(
  '/:pageName/background',
  authenticateToken,
  uploadISBFilmsBackgroundVideo.single('video'),
  isbFilmsPageController.uploadISBFilmsBackgroundVideo
);

// Generate thumbnail from existing video
router.post(
  '/:pageName/generate-thumbnail',
  authenticateToken,
  isbFilmsPageController.generateISBFilmsPageThumbnail
);

// ==================== ISB FILMS CREW ROUTES ====================

// Get all crew members
router.get('/home/crew', authenticateToken, isbFilmsCrewController.getAllISBFilmsCrew);

// Get single crew member
router.get('/home/crew/:crewId', authenticateToken, isbFilmsCrewController.getISBFilmsCrewMember);

// Add new crew member
router.post(
  '/home/crew',
  authenticateToken,
  uploadISBFilmsCrewPhoto.single('photo'),
  isbFilmsCrewController.addISBFilmsCrewMember
);

// Update crew member
router.put(
  '/home/crew/:crewId',
  authenticateToken,
  uploadISBFilmsCrewPhoto.single('photo'),
  isbFilmsCrewController.updateISBFilmsCrewMember
);

// Delete crew member
router.delete(
  '/home/crew/:crewId',
  authenticateToken,
  isbFilmsCrewController.deleteISBFilmsCrewMember
);

// Reorder crew members
router.post('/home/crew/reorder', authenticateToken, isbFilmsCrewController.reorderISBFilmsCrew);

module.exports = router;
