const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const {
  generateThumbnail,
  deleteThumbnail,
  generateThumbnailFromUrl,
} = require('../services/thumbanailServices');
const { activityLoggers } = require('../middlewares/activityLogger');

// Get all ISB Films pages
const getAllISBFilmsPages = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, title, status, background_thumbnail_url, updated_at 
       FROM isb_films_pages 
       ORDER BY id`
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
    const pageResult = await db.query('SELECT * FROM isb_films_pages WHERE name = $1', [pageName]);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = pageResult.rows[0];

    // ================= HOME PAGE =================
    if (pageName === 'home') {
      const crewResult = await db.query(
        `SELECT * FROM isb_films_crew 
         WHERE page_id = $1 
         ORDER BY order_index, id`,
        [page.id]
      );
      page.crew = crewResult.rows;

      // ⭐ NEW HOME SECTIONS
      const homeContent = await db.query(
        `SELECT id, section_type, content 
         FROM isb_films_home_multiple
         WHERE films_page_id = $1
         ORDER BY id ASC`,
        [page.id]
      );

      page.sections = homeContent.rows;
    }

    // ================= FILMOGRAPHY PAGE =================
    if (pageName === 'filmography') {
      const moviesResult = await db.query(
        `SELECT m.*, 
           (SELECT COUNT(*) 
            FROM isb_films_movie_awards 
            WHERE movie_id = m.id) AS awards_count
         FROM isb_films_movies m
         WHERE m.page_id = $1
         ORDER BY m.order_index, m.year_of_release DESC`,
        [page.id]
      );
      page.movies = moviesResult.rows;
    }

    // ================= NEWS PAGE =================
    if (pageName === 'news') {
      const newsResult = await db.query(
        `SELECT * FROM isb_films_news_articles 
         WHERE page_id = $1 
         ORDER BY order_index, publish_date DESC`,
        [page.id]
      );
      page.news = newsResult.rows;
    }

    // ================= SUSTAINABILITY PAGE (⭐ NEW) =================
    if (pageName === 'sustainability') {
      const vowsResult = await db.query(
        `SELECT 
            id,
            vow_heading,
            description,
            image_url,
            order_index,
            created_at,
            updated_at
         FROM isb_films_sustainability_vows
         WHERE page_id = $1
         ORDER BY order_index, created_at DESC`,
        [page.id]
      );

      page.vows = vowsResult.rows;
      page.totalVows = vowsResult.rows.length;
    }

    // ================= SEND RESPONSE =================
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
    const oldDataResult = await db.query('SELECT * FROM isb_films_pages WHERE name = $1', [
      pageName,
    ]);
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

    // Log title update specifically if title changed
    if (oldPage.title !== title) {
      await activityLoggers.pageContent.logTitleUpdate(
        req,
        `ISB Films - ${pageName}`,
        oldPage.title,
        title
      );
    }

    res.json({
      ...updatedPage,
      message: 'Page saved as draft',
    });
  } catch (error) {
    console.error('Error saving ISB Films page:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Publish ISB Films page with all sections
const publishISBFilmsPage = async (req, res) => {
  const { pageName } = req.params;
  const { title } = req.body;

  try {
    // Start transaction
    await db.query('BEGIN');

    // Get old data for logging
    const oldDataResult = await db.query('SELECT * FROM isb_films_pages WHERE name = $1', [
      pageName,
    ]);
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Page not found' });
    }

    const pageId = oldPage.id;

    // Update page
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

    let publishedCounts = {
      page: pageName,
      crew: 0,
      movies: 0,
      news: 0,
      awards: 0,
    };

    // Publish all associated content based on page
    if (pageName === 'home') {
      // Publish all crew members
      const crewResult = await db.query(
        `UPDATE isb_films_crew 
         SET status = 'published', updated_at = CURRENT_TIMESTAMP 
         WHERE page_id = $1 AND status = 'draft' 
         RETURNING id`,
        [pageId]
      );
      publishedCounts.crew = crewResult.rowCount;
    }

    if (pageName === 'filmography') {
      // Publish all movies
      const moviesResult = await db.query(
        `UPDATE isb_films_movies 
         SET status = 'published', updated_at = CURRENT_TIMESTAMP 
         WHERE page_id = $1 AND status = 'draft' 
         RETURNING id`,
        [pageId]
      );
      publishedCounts.movies = moviesResult.rowCount;

      // Count awards for published movies
      const awardsResult = await db.query(
        `SELECT COUNT(*) as count FROM isb_films_movie_awards 
         WHERE movie_id IN (
           SELECT id FROM isb_films_movies WHERE page_id = $1 AND status = 'published'
         )`,
        [pageId]
      );
      publishedCounts.awards = parseInt(awardsResult.rows[0].count);
    }

    if (pageName === 'news') {
      // Publish all news articles
      const newsResult = await db.query(
        `UPDATE isb_films_news_articles 
         SET status = 'published', updated_at = CURRENT_TIMESTAMP 
         WHERE page_id = $1 AND status = 'draft' 
         RETURNING id`,
        [pageId]
      );
      publishedCounts.news = newsResult.rowCount;
    }

    // Commit transaction
    await db.query('COMMIT');

    // Log the publish activity
    await activityLoggers.pageContent.logPublish(
      req,
      `ISB Films - ${pageName}`,
      updatedPage.title || pageName
    );

    // Log status change if it was different
    if (oldPage.status !== 'published') {
      await activityLoggers.pageContent.logStatusChange(
        req,
        `ISB Films - ${pageName}`,
        oldPage.status,
        'published'
      );
    }

    // Log title update if title was provided and changed
    if (title !== undefined && oldPage.title !== title) {
      await activityLoggers.pageContent.logTitleUpdate(
        req,
        `ISB Films - ${pageName}`,
        oldPage.title,
        title
      );
    }

    res.json({
      ...updatedPage,
      publishedCounts,
      message: `Page and all sections published successfully`,
    });
  } catch (error) {
    await db.query('ROLLBACK');
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
    // Get old data for logging
    const oldDataResult = await db.query('SELECT * FROM isb_films_pages WHERE name = $1', [
      pageName,
    ]);
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const result = await db.query(
      `UPDATE isb_films_pages 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE name = $2 
       RETURNING *`,
      [status, pageName]
    );

    const updatedPage = result.rows[0];

    // Log the status change activity
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
    // Get old data for logging
    const oldDataResult = await db.query('SELECT * FROM isb_films_pages WHERE name = $1', [
      pageName,
    ]);
    const oldPage = oldDataResult.rows[0];

    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const result = await db.query(
      `UPDATE isb_films_pages 
       SET title = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE name = $2 
       RETURNING *`,
      [title, pageName]
    );

    const updatedPage = result.rows[0];

    // Log the title update activity
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

// Upload ISB Films background video
const uploadISBFilmsBackgroundVideo = async (req, res) => {
  const { pageName } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  try {
    // Get the old video and thumbnail URLs
    const oldDataResult = await db.query('SELECT * FROM isb_films_pages WHERE name = $1', [
      pageName,
    ]);

    const oldPage = oldDataResult.rows[0];
    if (!oldPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Generate thumbnail for the new video
    let thumbnailUrl = null;
    try {
      console.log('🎬 Attempting to generate thumbnail...');
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

    // Log the background video upload activity
    await activityLoggers.pageContent.logBackgroundVideoUpload(
      req,
      `ISB Films - ${pageName}`,
      oldPage.background_video_url,
      req.file.location,
      req.file.originalname,
      req.file.size
    );

    // Log the thumbnail generation if successful
    if (thumbnailUrl) {
      await activityLoggers.pageContent.logThumbnailGeneration(
        req,
        `ISB Films - ${pageName}`,
        oldPage.background_thumbnail_url,
        thumbnailUrl
      );
    }

    // Log status change to draft if it was published
    if (oldPage.status === 'published') {
      await activityLoggers.pageContent.logStatusChange(
        req,
        `ISB Films - ${pageName}`,
        'published',
        'draft'
      );
    }

    // Delete old files after successful update
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

// Generate thumbnail for existing video
const generateISBFilmsPageThumbnail = async (req, res) => {
  const { pageName } = req.params;

  try {
    const pageResult = await db.query('SELECT * FROM isb_films_pages WHERE name = $1', [pageName]);

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
      `UPDATE isb_films_pages 
       SET background_thumbnail_url = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE name = $2 
       RETURNING *`,
      [thumbnailUrl, pageName]
    );

    const updatedPage = result.rows[0];

    // Log the thumbnail generation activity
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
