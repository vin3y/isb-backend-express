const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const { uploadKeyOfferingImage, uploadCaseStudyImage } = require('../utils/s3');
const router = express.Router();
const servicesController = require('../controllers/servicesController');

// ============ SERVICES PAGE ROUTES ============

// Get complete services page data
router.get('/', authenticateToken, servicesController.getServicesPage);

// ============ KEY OFFERINGS ROUTES ============

// Get all key offerings
router.get('/key-offerings', authenticateToken, servicesController.getAllKeyOfferings);

// Get single key offering by ID
router.get(
  '/key-offerings/:offeringId',
  authenticateToken,
  servicesController.getSingleKeyOffering
);

// Add new key offering (with image upload)
router.post(
  '/key-offerings',
  authenticateToken,
  uploadKeyOfferingImage.single('image'),
  servicesController.addKeyOffering
);

// Update existing key offering (with optional image upload)
router.put(
  '/key-offerings/:offeringId',
  authenticateToken,
  uploadKeyOfferingImage.single('image'),
  servicesController.updateKeyOffering
);

// Delete key offering by ID
router.delete(
  '/key-offerings/:offeringId',
  authenticateToken,
  servicesController.deleteKeyOffering
);

// ============ CASE STUDIES ROUTES ============

// Get all case studies
router.get('/case-studies', authenticateToken, servicesController.getAllCaseStudies);

// Get single case study by ID
router.get('/case-studies/:studyId', authenticateToken, servicesController.getSingleCaseStudy);

// Add new case study (with image upload)
router.post(
  '/case-studies',
  authenticateToken,
  uploadCaseStudyImage.single('image'),
  servicesController.addCaseStudy
);

// Update existing case study (with optional image upload)
router.put(
  '/case-studies/:studyId',
  authenticateToken,
  uploadCaseStudyImage.single('image'),
  servicesController.updateCaseStudy
);

// Delete case study by ID
router.delete('/case-studies/:studyId', authenticateToken, servicesController.deleteCaseStudy);

module.exports = router;
