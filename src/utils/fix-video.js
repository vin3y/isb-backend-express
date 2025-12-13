const AWS = require('aws-sdk');

AWS.config.update({
  region: 'eu-north-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const BUCKET = 'isbc-website-master';

const VIDEO_PREFIXES = [
  'home/',
  'about/',
  'isbfilms/',
  'services/',
  'politicalevents/',
  'musicalevents/',
];

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

async function fixMetadata() {
  for (const prefix of VIDEO_PREFIXES) {
    let ContinuationToken;

    do {
      const list = await s3
        .listObjectsV2({
          Bucket: BUCKET,
          Prefix: prefix,
          ContinuationToken,
        })
        .promise();

      for (const obj of list.Contents) {
        if (!obj.Key.endsWith('.mp4')) continue;

        console.log('Fixing →', obj.Key);

        const head = await s3
          .headObject({
            Bucket: BUCKET,
            Key: obj.Key,
          })
          .promise();

        await s3
          .copyObject({
            Bucket: BUCKET,
            CopySource: `${BUCKET}/${obj.Key}`,
            Key: obj.Key,
            ContentType: head.ContentType || 'video/mp4',
            CacheControl: CACHE_CONTROL,
            MetadataDirective: 'REPLACE',
          })
          .promise();
      }

      ContinuationToken = list.NextContinuationToken;
    } while (ContinuationToken);
  }

  console.log('✅ All video metadata fixed');
}

fixMetadata().catch(console.error);
