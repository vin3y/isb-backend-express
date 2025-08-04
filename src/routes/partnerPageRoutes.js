const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const router = express.Router();
const partnersController = require('../controllers/partnersPageController');

// ============ PARTNERS PAGE ROUTES ============

// Get complete partners page data
router.get('/', authenticateToken, partnersController.getPartnersPage);

// ============ VALUED PARTNERS ROUTES ============

// Get all valued partners
router.get('/valued-partners', authenticateToken, partnersController.getAllValuedPartners);

// Get single valued partner by ID
router.get('/valued-partners/:partnerId', authenticateToken, partnersController.getSingleValuedPartner);

// Get valued partners by year
router.get('/valued-partners/year/:year', authenticateToken, partnersController.getValuedPartnersByYear);

// Add new valued partner
router.post('/valued-partners', authenticateToken, partnersController.addValuedPartner);

// Update existing valued partner
router.put('/valued-partners/:partnerId', authenticateToken, partnersController.updateValuedPartner);

// Delete valued partner by ID
router.delete('/valued-partners/:partnerId', authenticateToken, partnersController.deleteValuedPartner);

module.exports = router;
