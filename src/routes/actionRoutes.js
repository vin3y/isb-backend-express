const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const router = express.Router();
const actionController = require('../controllers/actionController');

router.get('/recent', authenticateToken, actionController.getRecentActivities);
router.get('/', authenticateToken, actionController.getPaginatedAcitivites);
router.get('/page/:pageName', authenticateToken, actionController.getActivitesByPage);
router.get('/type/:typeName', authenticateToken, actionController.getByActionType);
router.get('/stats', authenticateToken, actionController.getDetailedStats);
router.post('/log', authenticateToken, actionController.manualLogActivity);

module.exports = router;
