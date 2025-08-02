const express = require('express');
const authRoutes = require('./authRoutes');
const pageRoutes = require('./pageRoutes');
const aboutRoutes = require('./aboutRoute');
const {authenticateToken} = require("../middlewares/auth");



const router = express.Router();

router.use('/auth', authRoutes);
router.use('/pages', pageRoutes);
router.use('/about', aboutRoutes);

// API root endpoint
router.get('/', (req, res) => {
    res.json({
        message: 'Website Admin API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            pages: '/api/pages (requires authentication)',
            public: '/api/public'
        }
    });
});


module.exports = router;


