const db = require('../config/db');
const { activityLoggers } = require('../middlewares/activityLogger');

// ==================== PUBLISH PAGE AND ALL SECTIONS ====================
const publishPageWithSections = async (req, res) => {
  const { pageName } = req.params;

  console.log(`🚀 Publishing page "${pageName}" with all sections...`);

  try {
    // Start transaction
    await db.query('BEGIN');

    // Get page
    const pageResult = await db.query(
      'SELECT * FROM isb_films_pages WHERE name = $1',
      [pageName]
    );

    if (pageResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = pageResult.rows[0];
    const pageId = page.id;

    // Publish the page itself
    await db.query(
      "UPDATE isb_films_pages SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    let publishedCounts = {
      page: pageName,
      crew: 0,
      movies: 0,
      news: 0,
      awards: 0,
    };

    // Publish sections based on page name
    if (pageName === 'home') {
      // Publish all crew members
      const crewResult = await db.query(
        "UPDATE isb_films_crew SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE page_id = $1 AND status = 'draft' RETURNING id",
        [pageId]
      );
      publishedCounts.crew = crewResult.rowCount;
    }

    if (pageName === 'filmography') {
      // Publish all movies
      const moviesResult = await db.query(
        "UPDATE isb_films_movies SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE page_id = $1 AND status = 'draft' RETURNING id",
        [pageId]
      );
      publishedCounts.movies = moviesResult.rowCount;

      // Publish awards for published movies
      const awardsResult = await db.query(
        `UPDATE isb_films_movie_awards SET updated_at = CURRENT_TIMESTAMP 
         WHERE movie_id IN (SELECT id FROM isb_films_movies WHERE page_id = $1 AND status = 'published')
         RETURNING id`,
        [pageId]
      );
      publishedCounts.awards = awardsResult.rowCount;
    }

    if (pageName === 'news') {
      // Publish all news articles
      const newsResult = await db.query(
        "UPDATE isb_films_news_articles SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE page_id = $1 AND status = 'draft' RETURNING id",
        [pageId]
      );
      publishedCounts.news = newsResult.rowCount;
    }

    // Commit transaction
    await db.query('COMMIT');

    // Log activity
    try {
      if (req.user && activityLoggers && activityLoggers.pageContent) {
        await activityLoggers.pageContent.logPublish(
          req,
          pageName,
          page.title
        );
      }
    } catch (logError) {
      console.error('⚠️ Error logging activity:', logError.message);
    }

    console.log('✅ Published:', publishedCounts);

    res.json({
      message: `Page "${pageName}" and all sections published successfully`,
      published: publishedCounts,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error publishing page:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==================== UNPUBLISH/REVERT TO DRAFT ====================
const unpublishPage = async (req, res) => {
  const { pageName } = req.params;

  console.log(`📝 Reverting page "${pageName}" to draft...`);

  try {
    await db.query('BEGIN');

    const pageResult = await db.query(
      'SELECT * FROM isb_films_pages WHERE name = $1',
      [pageName]
    );

    if (pageResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Page not found' });
    }

    const pageId = pageResult.rows[0].id;

    // Revert page to draft
    await db.query(
      "UPDATE isb_films_pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Revert sections to draft
    if (pageName === 'home') {
      await db.query(
        "UPDATE isb_films_crew SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE page_id = $1",
        [pageId]
      );
    }

    if (pageName === 'filmography') {
      await db.query(
        "UPDATE isb_films_movies SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE page_id = $1",
        [pageId]
      );
    }

    if (pageName === 'news') {
      await db.query(
        "UPDATE isb_films_news_articles SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE page_id = $1",
        [pageId]
      );
    }

    await db.query('COMMIT');

    res.json({
      message: `Page "${pageName}" and all sections reverted to draft`,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error unpublishing page:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  publishPageWithSections,
  unpublishPage,
};
