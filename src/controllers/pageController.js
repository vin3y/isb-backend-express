// const db = require('../config/db');
// const { deleteFile } = require('../utils/s3');
// const {
//   generateThumbnail,
//   deleteThumbnail,
//   generateThumbnailFromUrl,
// } = require('../services/thumbanailServices');
// const { activityLoggers } = require('../middlewares/activityLogger');

// const getAllPages = async (req, res) => {
//   try {
//     const result = await db.query(
//       'SELECT id, name, title, status, background_thumbnail_url, updated_at FROM pages ORDER BY id'
//     );
//     res.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching pages:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

// // Get specific page details
// const getPageDetails = async (req, res) => {
//   const { pageName } = req.params;

//   try {
//     const pageResult = await db.query('SELECT * FROM pages WHERE name = $1', [pageName]);

//     if (pageResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Page not found' });
//     }

//     const page = pageResult.rows[0];

//     // If it's the home page, also fetch partners
//     if (pageName === 'home') {
//       const partnersResult = await db.query(
//         'SELECT * FROM partners WHERE page_id = $1 ORDER BY order_index',
//         [page.id]
//       );
//       page.partners = partnersResult.rows;
//     }

//     res.json(page);
//   } catch (error) {
//     console.error('Error fetching page:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

// // Save page as draft
// const savePage = async (req, res) => {
//   const { pageName } = req.params;
//   const { title } = req.body;

//   try {
//     const result = await db.query(
//       `UPDATE pages
//        SET title = $1, status = 'draft', updated_at = CURRENT_TIMESTAMP
//        WHERE name = $2
//        RETURNING *`,
//       [title, pageName]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Page not found' });
//     }

//     res.json({
//       ...result.rows[0],
//       message: 'Page saved as draft',
//     });
//   } catch (error) {
//     console.error('Error saving page:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

// // Publish page
// const publishPage = async (req, res) => {
//   const { pageName } = req.params;
//   const { title } = req.body;

//   try {
//     let query, params;
//     if (title !== undefined) {
//       query = `UPDATE pages
//                SET title = $1, status = 'published', updated_at = CURRENT_TIMESTAMP
//                WHERE name = $2
//                RETURNING *`;
//       params = [title, pageName];
//     } else {
//       query = `UPDATE pages
//                SET status = 'published', updated_at = CURRENT_TIMESTAMP
//                WHERE name = $1
//                RETURNING *`;
//       params = [pageName];
//     }

//     const result = await db.query(query, params);

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Page not found' });
//     }

//     res.json({
//       ...result.rows[0],
//       message: 'Page published successfully',
//     });
//   } catch (error) {
//     console.error('Error publishing page:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

// // Update page status
// const updatePageStatus = async (req, res) => {
//   const { pageName } = req.params;
//   const { status } = req.body;

//   if (!['draft', 'published'].includes(status)) {
//     return res.status(400).json({ error: 'Invalid status' });
//   }

//   try {
//     const result = await db.query(
//       'UPDATE pages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
//       [status, pageName]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Page not found' });
//     }

//     res.json(result.rows[0]);
//   } catch (error) {
//     console.error('Error updating page status:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

// // Update page title
// const updatePageTitle = async (req, res) => {
//   const { pageName } = req.params;
//   const { title } = req.body;

//   try {
//     const result = await db.query(
//       'UPDATE pages SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
//       [title, pageName]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Page not found' });
//     }

//     res.json(result.rows[0]);
//   } catch (error) {
//     console.error('Error updating page title:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

// // Upload background video
// const uploadBackgroundVideo = async (req, res) => {
//   const { pageName } = req.params;
//   if (!req.file) {
//     return res.status(400).json({ error: 'No video file provided' });
//   }
//   try {
//     // Get the old video and thumbnail URLs to delete them
//     const oldDataResult = await db.query(
//       'SELECT background_video_url, background_thumbnail_url FROM pages WHERE name = $1',
//       [pageName]
//     );

//     // Generate thumbnail for the new video
//     let thumbnailUrl;
//     try {
//       thumbnailUrl = await generateThumbnail(req.file, pageName);
//     } catch (thumbnailError) {
//       console.error('Thumbnail generation error:', thumbnailError);
//     }

//     // Update with new video and thumbnail URLs
//     const result = await db.query(
//       `UPDATE pages
//        SET background_video_url = $1,
//            background_thumbnail_url = $2,
//            status = 'draft',
//            updated_at = CURRENT_TIMESTAMP
//        WHERE name = $3
//        RETURNING *`,
//       [req.file.location, thumbnailUrl || null, pageName]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Page not found' });
//     }

//     // Delete old files after successful update
//     if (oldDataResult.rows.length > 0) {
//       const oldData = oldDataResult.rows[0];
//       if (oldData.background_video_url) {
//         await deleteFile(oldData.background_video_url);
//       }
//       if (oldData.background_thumbnail_url) {
//         await deleteThumbnail(oldData.background_thumbnail_url);
//       }
//     }

//     res.json({
//       ...result.rows[0],
//       message: 'Background video uploaded successfully. Page saved as draft.',
//     });
//   } catch (error) {
//     console.error('Error uploading background video:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

// // Generate thumbnail for existing video
// const generatePageThumbnail = async (req, res) => {
//   const { pageName } = req.params;

//   try {
//     const pageResult = await db.query(
//       'SELECT background_video_url, background_thumbnail_url FROM pages WHERE name = $1',
//       [pageName]
//     );

//     if (pageResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Page not found' });
//     }

//     const page = pageResult.rows[0];

//     if (!page.background_video_url) {
//       return res.status(400).json({ error: 'No video found for this page' });
//     }

//     // Delete old thumbnail if exists
//     if (page.background_thumbnail_url) {
//       await deleteThumbnail(page.background_thumbnail_url);
//     }

//     // Generate new thumbnail
//     const thumbnailUrl = await generateThumbnailFromUrl(page.background_video_url, pageName);

//     // Update database
//     const result = await db.query(
//       'UPDATE pages SET background_thumbnail_url = $1 WHERE name = $2 RETURNING *',
//       [thumbnailUrl, pageName]
//     );

//     res.json(result.rows[0]);
//   } catch (error) {
//     console.error('Error generating thumbnail:', error);
//     res.status(500).json({ error: 'Failed to generate thumbnail' });
//   }
// };

// module.exports = {
//   getAllPages,
//   getPageDetails,
//   savePage,
//   publishPage,
//   updatePageStatus,
//   updatePageTitle,
//   uploadBackgroundVideo,
//   generatePageThumbnail,
// };

const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const {
  generateThumbnail,
  deleteThumbnail,
  generateThumbnailFromUrl,
} = require('../services/thumbanailServices');
const { activityLoggers } = require('../middlewares/activityLogger');

const getAllPages = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, title, status, background_thumbnail_url, updated_at FROM pages ORDER BY id'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get specific page details
const getPageDetails = async (req, res) => {
  const { pageName } = req.params;

  try {
    const pageResult = await db.query('SELECT * FROM pages WHERE name = $1', [pageName]);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = pageResult.rows[0];

    // If it's the home page, also fetch partners
    if (pageName === 'home') {
      const partnersResult = await db.query(
        'SELECT * FROM partners WHERE page_id = $1 ORDER BY order_index',
        [page.id]
      );
      page.partners = partnersResult.rows;
    }

    res.json(page);
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Save page as draft
const savePage = async (req, res) => {
  const { pageName } = req.params;
  const { title } = req.body;

  try {
    // Get old data for logging
    const oldDataResult = await db.query('SELECT * FROM pages WHERE name = $1', [pageName]);
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const result = await db.query(
      `UPDATE pages 
       SET title = $1, status = 'draft', updated_at = CURRENT_TIMESTAMP 
       WHERE name = $2 
       RETURNING *`,
      [title, pageName]
    );

    const updatedPage = result.rows[0];

    // Log the page save activity
    const changedFields = [];
    if (oldPage.title !== title) changedFields.push('title');
    if (oldPage.status !== 'draft') changedFields.push('status');

    await activityLoggers.pageContent.logPageSave(
      req,
      pageName,
      changedFields,
      { title: oldPage.title, status: oldPage.status },
      { title: updatedPage.title, status: updatedPage.status }
    );

    // Log title update specifically if title changed
    if (oldPage.title !== title) {
      await activityLoggers.pageContent.logTitleUpdate(req, pageName, oldPage.title, title);
    }

    res.json({
      ...updatedPage,
      message: 'Page saved as draft',
    });
  } catch (error) {
    console.error('Error saving page:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Publish page
const publishPage = async (req, res) => {
  const { pageName } = req.params;
  const { title } = req.body;

  try {
    // Get old data for logging
    const oldDataResult = await db.query('SELECT * FROM pages WHERE name = $1', [pageName]);
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    let query, params;
    if (title !== undefined) {
      query = `UPDATE pages 
               SET title = $1, status = 'published', updated_at = CURRENT_TIMESTAMP 
               WHERE name = $2 
               RETURNING *`;
      params = [title, pageName];
    } else {
      query = `UPDATE pages 
               SET status = 'published', updated_at = CURRENT_TIMESTAMP 
               WHERE name = $1 
               RETURNING *`;
      params = [pageName];
    }

    const result = await db.query(query, params);
    const updatedPage = result.rows[0];

    // Log the publish activity
    await activityLoggers.pageContent.logPublish(req, pageName, updatedPage.title || pageName);

    // Log status change if it was different
    if (oldPage.status !== 'published') {
      await activityLoggers.pageContent.logStatusChange(req, pageName, oldPage.status, 'published');
    }

    // Log title update if title was provided and changed
    if (title !== undefined && oldPage.title !== title) {
      await activityLoggers.pageContent.logTitleUpdate(req, pageName, oldPage.title, title);
    }

    res.json({
      ...updatedPage,
      message: 'Page published successfully',
    });
  } catch (error) {
    console.error('Error publishing page:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update page status
const updatePageStatus = async (req, res) => {
  const { pageName } = req.params;
  const { status } = req.body;

  if (!['draft', 'published'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Get old data for logging
    const oldDataResult = await db.query('SELECT * FROM pages WHERE name = $1', [pageName]);
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const result = await db.query(
      'UPDATE pages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
      [status, pageName]
    );

    const updatedPage = result.rows[0];

    // Log the status change activity
    await activityLoggers.pageContent.logStatusChange(req, pageName, oldPage.status, status);

    res.json(updatedPage);
  } catch (error) {
    console.error('Error updating page status:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update page title
const updatePageTitle = async (req, res) => {
  const { pageName } = req.params;
  const { title } = req.body;

  try {
    // Get old data for logging
    const oldDataResult = await db.query('SELECT * FROM pages WHERE name = $1', [pageName]);
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const result = await db.query(
      'UPDATE pages SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
      [title, pageName]
    );

    const updatedPage = result.rows[0];

    // Log the title update activity
    await activityLoggers.pageContent.logTitleUpdate(req, pageName, oldPage.title, title);

    res.json(updatedPage);
  } catch (error) {
    console.error('Error updating page title:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Upload background video
const uploadBackgroundVideo = async (req, res) => {
  const { pageName } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }
  try {
    // Get the old video and thumbnail URLs to delete them and for logging
    const oldDataResult = await db.query('SELECT * FROM pages WHERE name = $1', [pageName]);

    const oldPage = oldDataResult.rows[0];
    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Generate thumbnail for the new video
    let thumbnailUrl;
    try {
      thumbnailUrl = await generateThumbnail(req.file, pageName);
    } catch (thumbnailError) {
      console.error('Thumbnail generation error:', thumbnailError);
    }

    // Update with new video and thumbnail URLs
    const result = await db.query(
      `UPDATE pages 
       SET background_video_url = $1, 
           background_thumbnail_url = $2,
           status = 'draft',
           updated_at = CURRENT_TIMESTAMP 
       WHERE name = $3 
       RETURNING *`,
      [req.file.location, thumbnailUrl || null, pageName]
    );

    const updatedPage = result.rows[0];

    // Log the background video upload activity
    await activityLoggers.pageContent.logBackgroundVideoUpload(
      req,
      pageName,
      oldPage.background_video_url,
      req.file.location,
      req.file.originalname,
      req.file.size
    );

    // Log the thumbnail generation if successful
    if (thumbnailUrl) {
      await activityLoggers.pageContent.logThumbnailGeneration(
        req,
        pageName,
        oldPage.background_thumbnail_url,
        thumbnailUrl
      );
    }

    // Log status change to draft if it was published
    if (oldPage.status === 'published') {
      await activityLoggers.pageContent.logStatusChange(req, pageName, 'published', 'draft');
    }

    // Delete old files after successful update and logging
    if (oldPage.background_video_url) {
      try {
        await deleteFile(oldPage.background_video_url);
      } catch (deleteError) {
        console.error('Error deleting old video file:', deleteError);
      }
    }
    if (oldPage.background_thumbnail_url) {
      try {
        await deleteThumbnail(oldPage.background_thumbnail_url);
      } catch (deleteError) {
        console.error('Error deleting old thumbnail:', deleteError);
      }
    }

    res.json({
      ...updatedPage,
      message: 'Background video uploaded successfully. Page saved as draft.',
    });
  } catch (error) {
    console.error('Error uploading background video:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Generate thumbnail for existing video
const generatePageThumbnail = async (req, res) => {
  const { pageName } = req.params;

  try {
    const pageResult = await db.query('SELECT * FROM pages WHERE name = $1', [pageName]);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = pageResult.rows[0];

    if (!page.background_video_url) {
      return res.status(400).json({ error: 'No video found for this page' });
    }

    const oldThumbnailUrl = page.background_thumbnail_url;

    // Delete old thumbnail if exists
    if (oldThumbnailUrl) {
      try {
        await deleteThumbnail(oldThumbnailUrl);
      } catch (deleteError) {
        console.error('Error deleting old thumbnail:', deleteError);
      }
    }

    // Generate new thumbnail
    const thumbnailUrl = await generateThumbnailFromUrl(page.background_video_url, pageName);

    // Update database
    const result = await db.query(
      'UPDATE pages SET background_thumbnail_url = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
      [thumbnailUrl, pageName]
    );

    const updatedPage = result.rows[0];

    // Log the thumbnail generation activity
    await activityLoggers.pageContent.logThumbnailGeneration(
      req,
      pageName,
      oldThumbnailUrl,
      thumbnailUrl
    );

    res.json(updatedPage);
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
};

module.exports = {
  getAllPages,
  getPageDetails,
  savePage,
  publishPage,
  updatePageStatus,
  updatePageTitle,
  uploadBackgroundVideo,
  generatePageThumbnail,
};
