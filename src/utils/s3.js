const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

// Configure AWS SDK v2 explicitly
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'eu-north-1',
  signatureVersion: 'v4'
});

const s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'eu-north-1',
  signatureVersion: 'v4'
});

const bucketName = process.env.AWS_BUCKETNAME;

// ============================================================================
// EXISTING UPLOADS (Your original functions)
// ============================================================================

const uploadBackgroundVideo = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
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
    s3: s3,
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

const uploadPartnerLogo = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
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
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const awardTitle = req.body.awardName || 'award';

      const cleanTitle = awardTitle
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

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

const uploadKeyOfferingImage = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const title = req.body.title || 'key-offering';

      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

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

const uploadCaseStudyImage = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const title = req.body.title || 'case-study';

      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

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

const uploadWhyWatchISBCImage = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const title = req.body.title || 'why-watch-item';

      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

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

const uploadISBCStandoutImage = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const title = req.body.title || 'standout-item';

      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

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

// ============================================================================
// ISB FILMS - CREW PHOTO UPLOAD
// ============================================================================

const uploadISBFilmsCrewPhoto = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const name = req.body.name || 'crew-member';
      const cleanName = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50);
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `isbfilms/crew/${timestamp}-${cleanName}.${fileExtension}`;
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
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// ============================================================================
// ISB FILMS - BACKGROUND VIDEO UPLOAD
// ============================================================================

const uploadISBFilmsBackgroundVideo = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const pageName = req.params.pageName || 'home';
      const timestamp = Date.now();
      const cleanPageName = pageName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `isbfilms/${cleanPageName}/background/${timestamp}-${cleanPageName}.${fileExtension}`;
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

// ============================================================================
// ISB FILMS - NEWS IMAGE UPLOAD
// ============================================================================

const uploadISBFilmsNewsImage = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const title = req.body.title || 'news-article';
      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50);
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `isbfilms/news/${timestamp}-${cleanTitle}.${fileExtension}`;
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
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// ============================================================================
// ISB FILMS - MOVIE POSTER UPLOAD (DEDICATED FUNCTION) ⭐ NEW
// ============================================================================

const uploadISBFilmsMoviePoster = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const filmName = req.body.film_name || 'movie';

      // Clean the film name for use in filename
      const cleanName = filmName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50); // Limit to 50 characters

      const fileExtension = file.originalname.split('.').pop();
      const fileName = `isbfilms/movies/posters/${timestamp}-${cleanName}.${fileExtension}`;

      console.log('📸 Uploading movie poster:', fileName);
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for movie posters'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// ============================================================================
// ISB FILMS - AWARD LOGO UPLOAD
// ============================================================================

const uploadISBFilmsAwardLogo = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const fieldName = file.fieldname || 'award';
      const cleanName = fieldName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50);
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `isbfilms/awards/${timestamp}-${cleanName}.${fileExtension}`;

      console.log('🏆 Uploading award logo:', fileName);
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for award logos'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// ============================================================================
// ISB FILMS - COMBINED MOVIE WITH AWARDS UPLOAD
// ============================================================================

const uploadISBFilmsMovieWithAwards = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const filmName = req.body.film_name || 'movie';
      const cleanName = filmName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50);
      const fileExtension = file.originalname.split('.').pop();

      let fileName;

      if (file.fieldname === 'poster') {
        // Movie poster
        fileName = `isbfilms/movies/posters/${timestamp}-${cleanName}.${fileExtension}`;
        console.log('📸 Uploading poster:', fileName);
      } else if (file.fieldname.startsWith('award_logo_')) {
        // Award logo files (award_logo_0, award_logo_1, etc.)
        const awardIndex = file.fieldname.replace('award_logo_', '');
        fileName = `isbfilms/awards/${timestamp}-${cleanName}-award-${awardIndex}.${fileExtension}`;
        console.log('🏆 Uploading award logo:', fileName);
      } else {
        // Fallback for any other files
        fileName = `isbfilms/movies/misc/${timestamp}-${file.fieldname}.${fileExtension}`;
        console.log('📁 Uploading misc file:', fileName);
      }

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
    fileSize: 15 * 1024 * 1024, // 15MB per file
  },
});

// ============================================================================
// DELETE FILE FROM S3
// ============================================================================

const deleteFile = async (fileUrl) => {
  try {
    if (!fileUrl) return;

    let key;
    const bucketUrl1 = `https://${bucketName}.s3.amazonaws.com/`;
    const bucketUrl2 = `https://s3.amazonaws.com/${bucketName}/`;
    const bucketUrl3 = `https://${bucketName}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/`;

    if (fileUrl.includes(bucketUrl1)) {
      key = fileUrl.replace(bucketUrl1, '');
    } else if (fileUrl.includes(bucketUrl2)) {
      key = fileUrl.replace(bucketUrl2, '');
    } else if (fileUrl.includes(bucketUrl3)) {
      key = fileUrl.replace(bucketUrl3, '');
    } else {
      console.error('Cannot extract key from URL:', fileUrl);
      return;
    }

    const params = {
      Bucket: bucketName,
      Key: decodeURIComponent(key),
    };

    await s3.deleteObject(params).promise();
    console.log('✅ Successfully deleted:', key);
  } catch (error) {
    console.error('❌ Error deleting file from S3:', error.message);
  }
};

// ============================================================================
// TEST S3 CONNECTION
// ============================================================================

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

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Existing uploads
  uploadBackgroundVideo,
  uploadPartnerLogo,
  uploadTeamPhoto,
  uploadAwardImage,
  uploadKeyOfferingImage,
  uploadCaseStudyImage,
  uploadWhyWatchISBCImage,
  uploadISBCStandoutImage,

  // ISB Films uploads
  uploadISBFilmsCrewPhoto,
  uploadISBFilmsBackgroundVideo,
  uploadISBFilmsNewsImage,
  uploadISBFilmsMoviePoster,           // ⭐ NEW - Dedicated poster upload
  uploadISBFilmsAwardLogo,             // Award logo only
  uploadISBFilmsMovieWithAwards,       // Combined movie + awards

  // Utilities
  deleteFile,
  s3,
  bucketName,
};
