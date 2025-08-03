const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const bucketName = process.env.AWS_BUCKETNAME;

// Upload middleware for background videos
const uploadBackgroundVideo = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    // acl removed due to bucket owner enforced policy
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const pageName = req.params.pageName || 'home';
      const timestamp = Date.now();
      const fileName = `${pageName}/background/${timestamp}-${file.originalname}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

const uploadTeamPhoto = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const fileName = `about/team-section/${timestamp}-${file.originalname}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Upload middleware for partner logos
const uploadPartnerLogo = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    // acl removed due to bucket owner enforced policy
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const fileName = `homepage/partnerlogo/${timestamp}-${file.originalname}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const uploadAwardImage = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const awardTitle = req.body.awardName || 'award';

      // Clean award title for filename (remove special characters, spaces, etc.)
      const cleanTitle = awardTitle
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_') // Replace non-alphanumeric with underscore
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

      // Get file extension
      const fileExtension = file.originalname.split('.').pop();

      const fileName = `awards/award_image/${timestamp}-${cleanTitle}.${fileExtension}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Upload middleware for key offerings images
const uploadKeyOfferingImage = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const title = req.body.title || 'key-offering';

      // Clean title for filename
      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // Get file extension
      const fileExtension = file.originalname.split('.').pop();

      const fileName = `services/key-offerings/${timestamp}-${cleanTitle}.${fileExtension}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Upload middleware for case studies images
const uploadCaseStudyImage = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const title = req.body.title || 'case-study';

      // Clean title for filename
      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // Get file extension
      const fileExtension = file.originalname.split('.').pop();

      const fileName = `services/case-study/${timestamp}-${cleanTitle}.${fileExtension}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Upload middleware for Why Watch ISBC images (Musical Events)
const uploadWhyWatchISBCImage = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const title = req.body.title || 'why-watch-item';

      // Clean title for filename
      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // Get file extension
      const fileExtension = file.originalname.split('.').pop();

      const fileName = `musicalevents/whywatchisbc/${timestamp}-${cleanTitle}.${fileExtension}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Upload middleware for ISBC Standout images (Political Events)
const uploadISBCStandoutImage = multer({
  storage: multerS3({
    s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const title = req.body.title || 'standout-item';

      // Clean title for filename
      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // Get file extension
      const fileExtension = file.originalname.split('.').pop();

      const fileName = `politicalevents/isbcstandout/${timestamp}-${cleanTitle}.${fileExtension}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Delete file from S3
const deleteFile = async (fileUrl) => {
  try {
    if (!fileUrl) return;

    let key;
    const bucketUrl1 = `https://${bucketName}.s3.amazonaws.com/`;
    const bucketUrl2 = `https://s3.amazonaws.com/${bucketName}/`;

    if (fileUrl.includes(bucketUrl1)) {
      key = fileUrl.replace(bucketUrl1, '');
    } else if (fileUrl.includes(bucketUrl2)) {
      key = fileUrl.replace(bucketUrl2, '');
    } else {
      console.error('Cannot extract key from URL:', fileUrl);
      return;
    }

    const params = {
      Bucket: bucketName,
      Key: key,
    };

    await s3.deleteObject(params).promise();
    console.log('✅ Successfully deleted:', key);
  } catch (error) {
    console.error('❌ Error deleting file from S3:', error.message);
  }
};

// Test S3 connection
const testS3Connection = async () => {
  try {
    const params = {
      Bucket: bucketName,
      MaxKeys: 1,
    };
    await s3.listObjectsV2(params).promise();
    console.log('✅ S3 connection successful');
    return true;
  } catch (error) {
    console.error('❌ S3 connection failed:', error.message);
    return false;
  }
};

testS3Connection();

module.exports = {
  uploadBackgroundVideo,
  uploadPartnerLogo,
  deleteFile,
  s3,
  uploadTeamPhoto,
  uploadAwardImage,
  uploadKeyOfferingImage,
  uploadCaseStudyImage,
  uploadWhyWatchISBCImage,
  uploadISBCStandoutImage,
  bucketName,
};
