const express = require('express');
const router = express.Router();
const isbFilmsPageController = require('../controllers/isbFilmsPageController');
const isbFilmsCrewController = require('../controllers/isbFilmsCrewController');
const isbFilmsNewsController = require('../controllers/isbFilmsNewsController');
const isbFilmsMoviesController = require('../controllers/isbFilmsMoviesController');
const {
  uploadISBFilmsBackgroundVideo,
  uploadISBFilmsCrewPhoto,
  uploadISBFilmsNewsImage,
  uploadISBFilmsMovieWithAwards,
} = require('../utils/s3');
const { authenticateToken } = require('../middlewares/auth');

// ==================== ISB FILMS PAGE ROUTES ====================

// Get all ISB Films pages (admin)
router.get('/', authenticateToken, isbFilmsPageController.getAllISBFilmsPages);

// Get specific page details (admin)
router.get('/:pageName', authenticateToken, isbFilmsPageController.getISBFilmsPageDetails);

// Save page as draft (admin)
router.post('/:pageName/save', authenticateToken, isbFilmsPageController.saveISBFilmsPage);

// Publish page and all sections (admin)
router.post('/:pageName/publish', authenticateToken, isbFilmsPageController.publishISBFilmsPage);

// Update page status (admin)
router.patch('/:pageName/status', authenticateToken, isbFilmsPageController.updateISBFilmsPageStatus);

// Update page title (admin)
router.patch('/:pageName/title', authenticateToken, isbFilmsPageController.updateISBFilmsPageTitle);

// Upload background video (admin)
router.post(
  '/:pageName/background',
  authenticateToken,
  uploadISBFilmsBackgroundVideo.single('video'),
  isbFilmsPageController.uploadISBFilmsBackgroundVideo
);

// Generate thumbnail for background video (admin)
router.post(
  '/:pageName/generate-thumbnail',
  authenticateToken,
  isbFilmsPageController.generateISBFilmsPageThumbnail
);

// ==================== ISB FILMS CREW ROUTES ====================

// Public route (published only)
router.get('/home/crew/public', isbFilmsCrewController.getAllISBFilmsCrew);

// Admin routes (all statuses)
router.get('/home/crew', authenticateToken, isbFilmsCrewController.getAllISBFilmsCrewAdmin);
router.get('/home/crew/:crewId', authenticateToken, isbFilmsCrewController.getISBFilmsCrewMember);

// Create crew member (admin)
router.post(
  '/home/crew',
  authenticateToken,
  uploadISBFilmsCrewPhoto.single('photo'),
  isbFilmsCrewController.addISBFilmsCrewMember
);

// Update crew member (admin)
router.put(
  '/home/crew/:crewId',
  authenticateToken,
  uploadISBFilmsCrewPhoto.single('photo'),
  isbFilmsCrewController.updateISBFilmsCrewMember
);

// Delete crew member (admin)
router.delete('/home/crew/:crewId', authenticateToken, isbFilmsCrewController.deleteISBFilmsCrewMember);

// Reorder crew members (admin)
router.post('/home/crew/reorder', authenticateToken, isbFilmsCrewController.reorderISBFilmsCrew);

// ==================== ISB FILMS NEWS ROUTES ====================

// Public routes (published only)
router.get('/news/articles/public', isbFilmsNewsController.getAllNews);

// Admin routes (all statuses)
router.get('/news/articles', authenticateToken, isbFilmsNewsController.getAllNewsAdmin);
router.get('/news/articles/:newsId', authenticateToken, isbFilmsNewsController.getNewsArticle);

// Create news article (admin)
router.post(
  '/news/articles',
  authenticateToken,
  uploadISBFilmsNewsImage.single('image'),
  isbFilmsNewsController.createNewsArticle
);

// Update news article (admin)
router.put(
  '/news/articles/:newsId',
  authenticateToken,
  uploadISBFilmsNewsImage.single('image'),
  isbFilmsNewsController.updateNewsArticle
);

// Delete news article (admin)
router.delete('/news/articles/:newsId', authenticateToken, isbFilmsNewsController.deleteNewsArticle);

// Reorder news articles (admin)
router.post('/news/articles/reorder', authenticateToken, isbFilmsNewsController.reorderNews);

// ==================== ISB FILMS MOVIES ROUTES ====================

// Public routes (published only)
router.get('/movies/latest', isbFilmsMoviesController.getLatestMovies);
router.get('/movies/public', isbFilmsMoviesController.getAllMovies);
router.get('/movies/public/:movieId', isbFilmsMoviesController.getMovieDetails);

// Admin routes (all statuses)
router.get('/movies', authenticateToken, isbFilmsMoviesController.getAllMoviesAdmin);
router.get('/movies/:movieId', authenticateToken, isbFilmsMoviesController.getMovieDetails);

// Create movie with awards (admin)
router.post(
  '/movies',
  authenticateToken,
  uploadISBFilmsMovieWithAwards.any(),
  isbFilmsMoviesController.createMovie
);

// Update movie with awards (admin)
router.put(
  '/movies/:movieId',
  authenticateToken,
  uploadISBFilmsMovieWithAwards.any(),
  isbFilmsMoviesController.updateMovie
);

// Delete movie (admin)
router.delete('/movies/:movieId', authenticateToken, isbFilmsMoviesController.deleteMovie);

// Reorder movies (admin)
router.post('/movies/reorder', authenticateToken, isbFilmsMoviesController.reorderMovies);

module.exports = router;
