const express = require('express');
const router = express.Router();

const isbFilmsPageController = require('../controllers/isbFilmsPageController');
const isbFilmsCrewController = require('../controllers/isbFilmsCrewController');
const isbFilmsNewsController = require('../controllers/isbFilmsNewsController');
const isbFilmsMoviesController = require('../controllers/isbFilmsMoviesController');
const isbFilmsSustainabilityController = require('../controllers/isbFilmsSustainbilityController');

const {
  uploadISBFilmsBackgroundVideo,
  uploadISBFilmsCrewPhoto,
  uploadISBFilmsNewsImage,
  uploadISBFilmsMovieWithAwards,
  uploadISBFilmsSustainabilityVowImage,
} = require('../utils/s3');

const { authenticateToken } = require('../middlewares/auth');

// Debug middleware
router.use((req, res, next) => {
  console.log('🎬 ISB Films Route Hit:', req.method, req.path);
  next();
});

// ================================================================
// ✅ MOVIES ROUTES (SPECIFIC - MUST COME FIRST)
// ================================================================
router.get('/movies/latest', isbFilmsMoviesController.getLatestMovies);
router.get('/movies/public', isbFilmsMoviesController.getAllMovies);
router.get('/movies/public/:movieId', isbFilmsMoviesController.getMovieDetails);

// Admin
router.get('/movies', authenticateToken, isbFilmsMoviesController.getAllMoviesAdmin);
router.get('/movies/:movieId', authenticateToken, isbFilmsMoviesController.getMovieDetails);

router.post(
  '/movies',
  authenticateToken,
  uploadISBFilmsMovieWithAwards.any(),
  isbFilmsMoviesController.createMovie
);

router.put(
  '/movies/:movieId',
  authenticateToken,
  uploadISBFilmsMovieWithAwards.any(),
  isbFilmsMoviesController.updateMovie
);

router.delete('/movies/:movieId', authenticateToken, isbFilmsMoviesController.deleteMovie);

router.post('/movies/reorder', authenticateToken, isbFilmsMoviesController.reorderMovies);

// ================================================================
// ✅ CREW ROUTES
// ================================================================
router.get('/home/crew/public', isbFilmsCrewController.getAllISBFilmsCrew);

router.get('/home/crew', authenticateToken, isbFilmsCrewController.getAllISBFilmsCrewAdmin);
router.get('/home/crew/:crewId', authenticateToken, isbFilmsCrewController.getISBFilmsCrewMember);

router.post(
  '/home/crew',
  authenticateToken,
  uploadISBFilmsCrewPhoto.single('photo'),
  isbFilmsCrewController.addISBFilmsCrewMember
);

router.put(
  '/home/crew/:crewId',
  authenticateToken,
  uploadISBFilmsCrewPhoto.single('photo'),
  isbFilmsCrewController.updateISBFilmsCrewMember
);

router.delete(
  '/home/crew/:crewId',
  authenticateToken,
  isbFilmsCrewController.deleteISBFilmsCrewMember
);

router.post('/home/crew/reorder', authenticateToken, isbFilmsCrewController.reorderISBFilmsCrew);

// ================================================================
// ✅ NEWS ROUTES
// ================================================================
router.get('/news/articles/public', isbFilmsNewsController.getAllNews);

router.get('/news/articles', authenticateToken, isbFilmsNewsController.getAllNewsAdmin);
router.get('/news/articles/:newsId', authenticateToken, isbFilmsNewsController.getNewsArticle);

router.post(
  '/news/articles',
  authenticateToken,
  uploadISBFilmsNewsImage.single('image'),
  isbFilmsNewsController.createNewsArticle
);

router.put(
  '/news/articles/:newsId',
  authenticateToken,
  uploadISBFilmsNewsImage.single('image'),
  isbFilmsNewsController.updateNewsArticle
);

router.delete(
  '/news/articles/:newsId',
  authenticateToken,
  isbFilmsNewsController.deleteNewsArticle
);

router.post('/news/articles/reorder', authenticateToken, isbFilmsNewsController.reorderNews);

// ================================================================
// 🚨 CRITICAL FIX: ALL SUSTAINABILITY ROUTES COME BEFORE /:pageName
// ================================================================

// Public
router.get(
  '/sustainability/vows/public',
  isbFilmsSustainabilityController.getAllSustainabilityVows
);

// Admin
router.get(
  '/sustainability/vows',
  authenticateToken,
  isbFilmsSustainabilityController.getAllSustainabilityVowsAdmin
);

router.post(
  '/sustainability/vows/reorder',
  authenticateToken,
  isbFilmsSustainabilityController.reorderSustainabilityVows
);

router.post(
  '/sustainability/vows',
  authenticateToken,
  uploadISBFilmsSustainabilityVowImage.single('image'),
  isbFilmsSustainabilityController.createSustainabilityVow
);

router.get(
  '/sustainability/vows/:vowId',
  authenticateToken,
  isbFilmsSustainabilityController.getSustainabilityVow
);

router.put(
  '/sustainability/vows/:vowId',
  authenticateToken,
  uploadISBFilmsSustainabilityVowImage.single('image'),
  isbFilmsSustainabilityController.updateSustainabilityVow
);

router.delete(
  '/sustainability/vows/:vowId',
  authenticateToken,
  isbFilmsSustainabilityController.deleteSustainabilityVow
);

// ================================================================
// ⬇️ HOME SECTIONS
// ================================================================
router.get('/home/sections', authenticateToken, isbFilmsCrewController.getHomeSections);
router.post('/home/sections', authenticateToken, isbFilmsCrewController.addHomeSection);
router.put(
  '/home/sections/:sectionId',
  authenticateToken,
  isbFilmsCrewController.updateHomeSection
);
router.delete(
  '/home/sections/:sectionId',
  authenticateToken,
  isbFilmsCrewController.deleteHomeSection
);

// ================================================================
// ⬇️ GENERIC PAGE ROUTES — MUST BE LAST
// ================================================================
router.get('/', authenticateToken, isbFilmsPageController.getAllISBFilmsPages);

router.get('/:pageName', authenticateToken, isbFilmsPageController.getISBFilmsPageDetails);

router.post('/:pageName/save', authenticateToken, isbFilmsPageController.saveISBFilmsPage);
router.post('/:pageName/publish', authenticateToken, isbFilmsPageController.publishISBFilmsPage);

router.patch(
  '/:pageName/status',
  authenticateToken,
  isbFilmsPageController.updateISBFilmsPageStatus
);

router.patch('/:pageName/title', authenticateToken, isbFilmsPageController.updateISBFilmsPageTitle);

router.post(
  '/:pageName/background',
  authenticateToken,
  uploadISBFilmsBackgroundVideo.single('video'),
  isbFilmsPageController.uploadISBFilmsBackgroundVideo
);

router.post(
  '/:pageName/generate-thumbnail',
  authenticateToken,
  isbFilmsPageController.generateISBFilmsPageThumbnail
);

module.exports = router;
