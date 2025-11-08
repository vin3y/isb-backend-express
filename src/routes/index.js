const express = require('express');
const authRoutes = require('./authRoutes');
const pageRoutes = require('./pageRoutes');
const aboutRoutes = require('./aboutRoute');
const publicRoutes = require('./publicRoutes');
const awardsRoutes = require('./awardRoutes');
const servicesRoutes = require('./servicesRoutes');
const musicalEventsRoutes = require('./musicalEventsRoutes');
const politicalEventsRoutes = require('./politicalEventsRoutes');
const partnersRoutes = require('./partnerPageRoutes');
const contactRoutes = require('./contactRoutes');
const actionRoutes = require('./actionRoutes');
const isbFilmsRoutes = require('./isbFilmRoutes');
const isbFilmsPublicRoutes = require('./isbFilmsPublicRoutes');
// const {authenticateToken} = require("../middlewares/auth");

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/pages', pageRoutes);
router.use('/about', aboutRoutes);
router.use('/public', publicRoutes);
router.use('/awards', awardsRoutes);
router.use('/services', servicesRoutes);
router.use('/musicalevents', musicalEventsRoutes);
router.use('/politicalevents', politicalEventsRoutes);
router.use('/partners', partnersRoutes);
router.use('/contact', contactRoutes);
router.use('/actions', actionRoutes);


//isbfilms
router.use('/isbfilms', isbFilmsRoutes);
router.use('/public/isbfilms', isbFilmsPublicRoutes); // NEW




// API root endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Website Admin API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      pages: '/api/pages (requires authentication)',
      public: '/api/public',
    },
  });
});

module.exports = router;
