
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const bucketName = process.env.AWS_BUCKETNAME;

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../temp/thumbnails');
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

/**
 * Generate thumbnail from video file
 * @param {Object} videoFile - Multer file object
 * @param {string} pageName - Page name for S3 folder structure
 * @returns {Promise<string>} - S3 URL of uploaded thumbnail
 */
const generateThumbnail = async (videoFile, pageName) => {
    const timestamp = Date.now();
    const thumbnailFilename = `${timestamp}-thumbnail.jpg`;
    const localThumbnailPath = path.join(tempDir, thumbnailFilename);

    try {
        // Generate thumbnail using ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(videoFile.location) // S3 URL from multer-s3
                .screenshots({
                    timestamps: ['10%'], // Take screenshot at 10% of video duration
                    filename: thumbnailFilename,
                    folder: tempDir,
                    size: '640x360'
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Read the generated thumbnail
        const thumbnailBuffer = await fs.readFile(localThumbnailPath);

        // Upload to S3
        const s3Key = `${pageName}/thumbnails/${thumbnailFilename}`;
        const uploadParams = {
            Bucket: bucketName,
            Key: s3Key,
            Body: thumbnailBuffer,
            ContentType: 'image/jpeg',
            // ACL: 'public-read'
        };

        const uploadResult = await s3.upload(uploadParams).promise();

        // Clean up local file
        await fs.unlink(localThumbnailPath).catch(console.error);

        return uploadResult.Location;
    } catch (error) {
        // Clean up on error
        await fs.unlink(localThumbnailPath).catch(() => {});
        throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
};

/**
 * Generate thumbnail from video URL (for existing videos)
 * @param {string} videoUrl - S3 URL of the video
 * @param {string} pageName - Page name for S3 folder structure
 * @returns {Promise<string>} - S3 URL of uploaded thumbnail
 */
const generateThumbnailFromUrl = async (videoUrl, pageName) => {
    const timestamp = Date.now();
    const thumbnailFilename = `${timestamp}-thumbnail.jpg`;
    const localThumbnailPath = path.join(tempDir, thumbnailFilename);

    try {
        await new Promise((resolve, reject) => {
            ffmpeg(videoUrl)
                .screenshots({
                    timestamps: ['10%'],
                    filename: thumbnailFilename,
                    folder: tempDir,
                    size: '640x360'
                })
                .on('end', resolve)
                .on('error', reject);
        });

        const thumbnailBuffer = await fs.readFile(localThumbnailPath);

        const s3Key = `${pageName}/thumbnails/${thumbnailFilename}`;
        const uploadParams = {
            Bucket: bucketName,
            Key: s3Key,
            Body: thumbnailBuffer,
            ContentType: 'image/jpeg',
            // ACL: 'public-read'
        };

        const uploadResult = await s3.upload(uploadParams).promise();

        await fs.unlink(localThumbnailPath).catch(console.error);

        return uploadResult.Location;
    } catch (error) {
        await fs.unlink(localThumbnailPath).catch(() => {});
        throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
};

/**
 * Delete thumbnail from S3
 * @param {string} thumbnailUrl - S3 URL of the thumbnail
 */
const deleteThumbnail = async (thumbnailUrl) => {
    if (!thumbnailUrl) return;

    try {
        const key = thumbnailUrl.split(`${bucketName}.s3.amazonaws.com/`)[1];
        if (key) {
            await s3.deleteObject({
                Bucket: bucketName,
                Key: key
            }).promise();
        }
    } catch (error) {
        console.error('Error deleting thumbnail:', error);
    }
};

module.exports = {
    generateThumbnail,
    generateThumbnailFromUrl,
    deleteThumbnail
};
