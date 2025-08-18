const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const AWS = require('aws-sdk');
const https = require('https');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'eu-north-1',
});

const bucketName = process.env.AWS_BUCKETNAME;

// Use /tmp directory which is writable in EB
const tempDir = '/tmp/thumbnails';

const ensureTempDir = async () => {
  try {
    await fs.mkdir(tempDir, { recursive: true });
    console.log('Temp directory created:', tempDir);
  } catch (error) {
    console.error('Error creating temp directory:', error);
  }
};

/**
 * Download video from S3 to local temp file
 */
const downloadVideoFromS3 = async (s3Url, localPath) => {
  console.log(`Downloading video from ${s3Url} to ${localPath}`);

  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(localPath);

    https
      .get(s3Url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download video: ${response.statusCode}`));
          return;
        }

        console.log(`Download started, content-length: ${response.headers['content-length']}`);

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log('Video download completed');
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(localPath).catch(() => {});
          reject(err);
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

/**
 * Generate thumbnail from video file
 * @param {Object} videoFile - Multer file object
 * @param {string} pageName - Page name for S3 folder structure
 * @returns {Promise<string>} - S3 URL of uploaded thumbnail
 */
const generateThumbnail = async (videoFile, pageName) => {
  await ensureTempDir();

  const timestamp = Date.now();
  const videoFilename = `${timestamp}-video.mp4`;
  const thumbnailFilename = `${timestamp}-thumbnail.jpg`;
  const localVideoPath = path.join(tempDir, videoFilename);
  const localThumbnailPath = path.join(tempDir, thumbnailFilename);

  try {
    console.log(`🎬 Starting thumbnail generation for ${videoFile.originalname}`);
    console.log(`Video S3 URL: ${videoFile.location}`);

    // Step 1: Download video from S3 to local temp file
    console.log('📥 Downloading video from S3...');
    await downloadVideoFromS3(videoFile.location, localVideoPath);

    // Check if file was downloaded
    const stats = await fs.stat(localVideoPath);
    console.log(`Video file size: ${stats.size} bytes`);

    // Step 2: Generate thumbnail using ffmpeg from local file
    console.log('🖼️ Generating thumbnail with ffmpeg...');
    await new Promise((resolve, reject) => {
      ffmpeg(localVideoPath)
        .screenshots({
          timestamps: ['00:00:02'], // Take screenshot at 2 seconds
          filename: thumbnailFilename,
          folder: tempDir,
          size: '1280x720', // HD thumbnail
        })
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('FFmpeg progress:', progress.percent + '% done');
        })
        .on('end', () => {
          console.log('✅ Thumbnail generated successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err);
          reject(err);
        });
    });

    // Step 3: Verify thumbnail was created
    const thumbnailStats = await fs.stat(localThumbnailPath);
    console.log(`Thumbnail file size: ${thumbnailStats.size} bytes`);

    // Step 4: Read the generated thumbnail
    console.log('📖 Reading generated thumbnail...');
    const thumbnailBuffer = await fs.readFile(localThumbnailPath);

    // Step 5: Upload thumbnail to S3
    console.log('☁️ Uploading thumbnail to S3...');
    const s3Key = `${pageName}/thumbnails/${thumbnailFilename}`;
    const uploadParams = {
      Bucket: bucketName,
      Key: s3Key,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
    };

    const uploadResult = await s3.upload(uploadParams).promise();
    console.log('✅ Thumbnail uploaded successfully:', uploadResult.Location);

    // Step 6: Clean up local files
    await fs.unlink(localVideoPath).catch(console.error);
    await fs.unlink(localThumbnailPath).catch(console.error);
    console.log('🧹 Temp files cleaned up');

    return uploadResult.Location;
  } catch (error) {
    console.error('💥 Thumbnail generation failed:', error);

    // Clean up local files on error
    await fs.unlink(localVideoPath).catch(() => {});
    await fs.unlink(localThumbnailPath).catch(() => {});

    // Don't throw error - let video upload succeed without thumbnail
    console.log('⚠️ Continuing without thumbnail');
    return null;
  }
};

/**
 * Generate thumbnail from video URL (for existing videos)
 * @param {string} videoUrl - S3 URL of the video
 * @param {string} pageName - Page name for S3 folder structure
 * @returns {Promise<string>} - S3 URL of uploaded thumbnail
 */
const generateThumbnailFromUrl = async (videoUrl, pageName) => {
  await ensureTempDir();

  const timestamp = Date.now();
  const videoFilename = `${timestamp}-video.mp4`;
  const thumbnailFilename = `${timestamp}-thumbnail.jpg`;
  const localVideoPath = path.join(tempDir, videoFilename);
  const localThumbnailPath = path.join(tempDir, thumbnailFilename);

  try {
    console.log(`🎬 Generating thumbnail from URL: ${videoUrl}`);

    // Download video from S3
    await downloadVideoFromS3(videoUrl, localVideoPath);

    // Generate thumbnail
    await new Promise((resolve, reject) => {
      ffmpeg(localVideoPath)
        .screenshots({
          timestamps: ['00:00:02'],
          filename: thumbnailFilename,
          folder: tempDir,
          size: '1280x720',
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Read and upload thumbnail
    const thumbnailBuffer = await fs.readFile(localThumbnailPath);
    const s3Key = `${pageName}/thumbnails/${thumbnailFilename}`;
    const uploadParams = {
      Bucket: bucketName,
      Key: s3Key,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
    };

    const uploadResult = await s3.upload(uploadParams).promise();

    // Clean up
    await fs.unlink(localVideoPath).catch(console.error);
    await fs.unlink(localThumbnailPath).catch(console.error);

    return uploadResult.Location;
  } catch (error) {
    console.error('Thumbnail generation from URL failed:', error);

    // Clean up on error
    await fs.unlink(localVideoPath).catch(() => {});
    await fs.unlink(localThumbnailPath).catch(() => {});

    return null;
  }
};

/**
 * Delete thumbnail from S3
 * @param {string} thumbnailUrl - S3 URL of the thumbnail
 */
const deleteThumbnail = async (thumbnailUrl) => {
  if (!thumbnailUrl) return;

  try {
    // Extract key from URL
    let key;
    const bucketUrl1 = `https://${bucketName}.s3.amazonaws.com/`;
    const bucketUrl2 = `https://s3.amazonaws.com/${bucketName}/`;
    const bucketUrl3 = `https://${bucketName}.s3.${
      process.env.AWS_REGION || 'eu-north-1'
    }.amazonaws.com/`;

    if (thumbnailUrl.includes(bucketUrl1)) {
      key = thumbnailUrl.replace(bucketUrl1, '');
    } else if (thumbnailUrl.includes(bucketUrl2)) {
      key = thumbnailUrl.replace(bucketUrl2, '');
    } else if (thumbnailUrl.includes(bucketUrl3)) {
      key = thumbnailUrl.replace(bucketUrl3, '');
    } else {
      console.error('Cannot extract key from thumbnail URL:', thumbnailUrl);
      return;
    }

    await s3
      .deleteObject({
        Bucket: bucketName,
        Key: key,
      })
      .promise();

    console.log('✅ Thumbnail deleted successfully:', key);
  } catch (error) {
    console.error('Error deleting thumbnail:', error);
  }
};

module.exports = {
  generateThumbnail,
  generateThumbnailFromUrl,
  deleteThumbnail,
};
