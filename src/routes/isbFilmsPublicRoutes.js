const express = require('express');
const router = express.Router();
const isbFilmsPublicController = require('../controllers/isbFilmsPublicController');

// ==================== PAGES ROUTES ====================

// Get all published ISB Films pages with basic info and sections
// GET /api/public/isbfilms/pages
router.get('/pages', isbFilmsPublicController.getAllPublicISBFilmsPages);

// Get specific page details (with related data like crew, movies, news)
// GET /api/public/isbfilms/pages/home
// GET /api/public/isbfilms/pages/filmography
// GET /api/public/isbfilms/pages/news
router.get('/pages/:pageName', isbFilmsPublicController.getPublicISBFilmsPageDetails);

// Get only background and title data for all pages
// GET /api/public/isbfilms/pages-background
router.get('/pages-background', isbFilmsPublicController.getAllISBFilmsPagesBackground);

// Get only background and title data for specific page
// GET /api/public/isbfilms/pages/home/background
router.get('/pages/:pageName/background', isbFilmsPublicController.getISBFilmsPageBackground);

// ==================== CREW ROUTES ====================

// Get all published crew members
// GET /api/public/isbfilms/crew
router.get('/crew', isbFilmsPublicController.getPublicCrew);

// ==================== MOVIES ROUTES ====================

// Get latest 4 movies
// GET /api/public/isbfilms/movies/latest
router.get('/movies/latest', isbFilmsPublicController.getLatestMovies);

// Get movies by year
// GET /api/public/isbfilms/movies/year/2024
router.get('/movies/year/:year', isbFilmsPublicController.getPublicMoviesByYear);

// Get single movie details with awards
// GET /api/public/isbfilms/movies/1
router.get('/movies/:movieId', isbFilmsPublicController.getPublicMovieDetails);

// ==================== NEWS ROUTES ====================

// Get news by category
// GET /api/public/isbfilms/news/category/Awards
router.get('/news/category/:category', isbFilmsPublicController.getPublicNewsByCategory);

// Get single news article
// GET /api/public/isbfilms/news/1
router.get('/news/:newsId', isbFilmsPublicController.getPublicNewsArticle);

module.exports = router;
