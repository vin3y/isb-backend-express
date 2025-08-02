const express = require('express');
const router = express.Router();
const publicPagesController = require('../../src/controllers/publicController');

// Get all published pages with basic info
router.get('/pages', publicPagesController.getAllPublicPages);

// Get specific page details (with related data like partners, team, etc.)
router.get('/pages/:pageName', publicPagesController.getPublicPageDetails);

// Get only background and title data for all pages
router.get('/pages-background', publicPagesController.getAllPagesBackground);

// Get only background and title data for specific page
router.get('/pages/:pageName/background', publicPagesController.getPageBackground);

module.exports = router;
