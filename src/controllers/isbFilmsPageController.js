const db = require('../config/db');
const {deleteFile} = require('../utils/s3')
const {generateThumbnail, deleteThumbnail, generateThumbnailFromUrl} = require('../services/thumbanailServices');
const {activityLoggers} = require('../middlewares/activityLogger');


// Get all ISB Films pages
const getAllISBFilmsPages = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, title, status, background_thumbnail_url, updated_at FROM isb_films_pages ORDER BY id'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ISB Films pages:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get specific ISB Films page details
const getISBFilmsPageDetails = async (req, res) => {
  const { pageName } = req.params;

  try {
    const pageResult = await db.query(
      'SELECT * FROM isb_films_pages WHERE name = $1',
      [pageName]
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = pageResult.rows[0];

    // If it's the home page, also fetch crew members
    if (pageName === 'home') {
      const crewResult = await db.query(
        'SELECT * FROM isb_films_crew WHERE page_id = $1 AND is_active = true ORDER BY order_index',
        [page.id]
      );
      page.crew = crewResult.rows;
    }

    res.json(page);
  } catch (error) {
    console.error('Error fetching ISB Films page:', error);
    res.status(500).json({ error: 'Server error' });
  }
};


// Save ISB Films page as draft
const saveISBFilmsPage = async (req, res) => {
  const { pageName } = req.params;
  const { title } = req.body;

  try {
    // Get old data for logging
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_pages WHERE name = $1',
      [pageName]
    );
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const result = await db.query(
      `UPDATE isb_films_pages 
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
      `ISB Films - ${pageName}`,
      changedFields,
      { title: oldPage.title, status: oldPage.status },
      { title: updatedPage.title, status: updatedPage.status }
    );

    res.json({
      ...updatedPage,
      message: 'ISB Films page saved as draft',
    });
  } catch (error) {
    console.error('Error saving ISB Films page:', error);
    res.status(500).json({ error: 'Server error' });
  }
};


// Publish ISB Films page
const publishISBFilmsPage = async (req, res) => {
  const { pageName } = req.params;
  const { title } = req.body;

  try {
    // Get old data for logging
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_pages WHERE name = $1',
      [pageName]
    );
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    let query, params;
    if (title !== undefined) {
      query = `UPDATE isb_films_pages 
               SET title = $1, status = 'published', updated_at = CURRENT_TIMESTAMP 
               WHERE name = $2 
               RETURNING *`;
      params = [title, pageName];
    } else {
      query = `UPDATE isb_films_pages 
               SET status = 'published', updated_at = CURRENT_TIMESTAMP 
               WHERE name = $1 
               RETURNING *`;
      params = [pageName];
    }

    const result = await db.query(query, params);
    const updatedPage = result.rows[0];

    // Log the publish activity
    await activityLoggers.pageContent.logPublish(
      req,
      `ISB Films - ${pageName}`,
      updatedPage.title || pageName
    );

    res.json({
      ...updatedPage,
      message: 'ISB Films page published successfully',
    });
  } catch (error) {
    console.error('Error publishing ISB Films page:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update ISB Films page status
const updateISBFilmsPageStatus = async (req, res) => {
  const { pageName } = req.params;
  const { status } = req.body;

  if (!['draft', 'published'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_pages WHERE name = $1',
      [pageName]
    );
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const result = await db.query(
      'UPDATE isb_films_pages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
      [status, pageName]
    );

    const updatedPage = result.rows[0];

    await activityLoggers.pageContent.logStatusChange(
      req,
      `ISB Films - ${pageName}`,
      oldPage.status,
      status
    );

    res.json(updatedPage);
  } catch (error) {
    console.error('Error updating ISB Films page status:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update ISB Films page title
const updateISBFilmsPageTitle = async (req, res) => {
  const { pageName } = req.params;
  const { title } = req.body;

  try {
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_pages WHERE name = $1',
      [pageName]
    );
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const result = await db.query(
      'UPDATE isb_films_pages SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
      [title, pageName]
    );

    const updatedPage = result.rows[0];

    await activityLoggers.pageContent.logTitleUpdate(
      req,
      `ISB Films - ${pageName}`,
      oldPage.title,
      title
    );

    res.json(updatedPage);
  } catch (error) {
    console.error('Error updating ISB Films page title:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Upload background video for ISB Films page
const uploadISBFilmsBackgroundVideo = async (req, res) => {
  const { pageName } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  try {
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_pages WHERE name = $1',
      [pageName]
    );
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Generate thumbnail for the new video
    let thumbnailUrl = null;
    try {
      console.log('🎬 Generating thumbnail for ISB Films video...');
      thumbnailUrl = await generateThumbnail(req.file, `isbfilms-${pageName}`);
      if (thumbnailUrl) {
        console.log('✅ Thumbnail generated successfully:', thumbnailUrl);
      }
    } catch (thumbnailError) {
      console.error('❌ Thumbnail generation error:', thumbnailError);
      console.log('📹 Continuing upload without thumbnail');
    }

    // Update with new video and thumbnail URLs
    const result = await db.query(
      `UPDATE isb_films_pages 
       SET background_video_url = $1, 
           background_thumbnail_url = $2,
           status = 'draft',
           updated_at = CURRENT_TIMESTAMP 
       WHERE name = $3 
       RETURNING *`,
      [req.file.location, thumbnailUrl || null, pageName]
    );

    const updatedPage = result.rows[0];

    // Log the activity
    await activityLoggers.pageContent.logBackgroundVideoUpload(
      req,
      `ISB Films - ${pageName}`,
      oldPage.background_video_url,
      req.file.location,
      req.file.originalname,
      req.file.size
    );

    // Delete old files
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
    console.error('Error uploading ISB Films background video:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Generate thumbnail for existing ISB Films video
const generateISBFilmsPageThumbnail = async (req, res) => {
  const { pageName } = req.params;

  try {
    const pageResult = await db.query(
      'SELECT * FROM isb_films_pages WHERE name = $1',
      [pageName]
    );

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
    const thumbnailUrl = await generateThumbnailFromUrl(
      page.background_video_url,
      `isbfilms-${pageName}`
    );

    // Update database
    const result = await db.query(
      'UPDATE isb_films_pages SET background_thumbnail_url = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
      [thumbnailUrl, pageName]
    );

    const updatedPage = result.rows[0];

    await activityLoggers.pageContent.logThumbnailGeneration(
      req,
      `ISB Films - ${pageName}`,
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
  getAllISBFilmsPages,
  getISBFilmsPageDetails,
  saveISBFilmsPage,
  publishISBFilmsPage,
  updateISBFilmsPageStatus,
  updateISBFilmsPageTitle,
  uploadISBFilmsBackgroundVideo,
  generateISBFilmsPageThumbnail,
};
