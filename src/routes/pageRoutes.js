const express = require('express');
const router = express.Router();
const pageController = require("../controllers/pageController");
const {uploadBackgroundVideo} = require("../utils/s3");
const {authenticateToken} = require("../middlewares/auth");


router.get("/",authenticateToken, pageController.getAllPages);
router.get('/:pageName', authenticateToken,pageController.getPageDetails);
router.post('/:pageName/save',authenticateToken, pageController.savePage);
router.post('/:pageName/publish',authenticateToken, pageController.publishPage);
router.patch('/:pageName/status',authenticateToken, pageController.updatePageStatus);
router.patch('/:pageName/title',authenticateToken, pageController.updatePageTitle);
router.post('/:pageName/background',authenticateToken, uploadBackgroundVideo.single('video'), pageController.uploadBackgroundVideo);
router.post('/:pageName/generate-thumbnail',authenticateToken, pageController.generatePageThumbnail);


module.exports = router;
