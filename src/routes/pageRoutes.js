const express = require('express');
const router = express.Router();
const pageController = require("../controllers/pageController");
const partnerController = require("../controllers/homeController");
const {uploadBackgroundVideo, uploadPartnerLogo} = require("../utils/s3");
const {authenticateToken} = require("../middlewares/auth");


router.get("/",authenticateToken, pageController.getAllPages);
router.get('/:pageName', authenticateToken,pageController.getPageDetails);
router.post('/:pageName/save',authenticateToken, pageController.savePage);
router.post('/:pageName/publish',authenticateToken, pageController.publishPage);
router.patch('/:pageName/status',authenticateToken, pageController.updatePageStatus);
router.patch('/:pageName/title',authenticateToken, pageController.updatePageTitle);
router.post('/:pageName/background',authenticateToken, uploadBackgroundVideo.single('video'), pageController.uploadBackgroundVideo);
router.post('/:pageName/generate-thumbnail',authenticateToken, pageController.generatePageThumbnail);

//partner home page get routes
router.get('/home/allpartners', authenticateToken, partnerController.getAllPartners);

// Partner routes (homepage specific)
router.post('/home/partners',authenticateToken, uploadPartnerLogo.single('logo'), partnerController.addPartner);
router.put('/home/partners/:partnerId',authenticateToken, uploadPartnerLogo.single('logo'), partnerController.updatePartner);
router.delete('/home/partners/:partnerId',authenticateToken, partnerController.deletePartner);


module.exports = router;
