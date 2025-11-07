const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const { activityLoggers } = require('../middlewares/activityLogger');

// ==================== GET ALL NEWS ARTICLES (PUBLISHED ONLY) ====================
const getAllNews = async (req, res) => {
  try {
    // Only fetch published articles for public
    const result = await db.query(
      `SELECT * FROM isb_films_news_articles
       WHERE status = 'published'
       ORDER BY order_index, publish_date DESC, created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==================== GET ALL NEWS ARTICLES (FOR ADMIN - ALL STATUSES) ====================
const getAllNewsAdmin = async (req, res) => {
  try {
    const { status, category, limit, offset } = req.query;

    let query = `
      SELECT * FROM isb_films_news_articles
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      values.push(category);
      paramIndex++;
    }

    query += ` ORDER BY order_index, publish_date DESC, created_at DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(parseInt(limit));
      paramIndex++;
    }

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      values.push(parseInt(offset));
    }

    const result = await db.query(query, values);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM isb_films_news_articles WHERE 1=1';
    const countValues = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND status = $${countParamIndex}`;
      countValues.push(status);
      countParamIndex++;
    }

    if (category) {
      countQuery += ` AND category = $${countParamIndex}`;
      countValues.push(category);
    }

    const countResult = await db.query(countQuery, countValues);

    res.json({
      articles: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: limit ? parseInt(limit) : null,
      offset: offset ? parseInt(offset) : 0,
    });
  } catch (error) {
    console.error('Error fetching news articles:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==================== GET SINGLE NEWS ARTICLE ====================
const getNewsArticle = async (req, res) => {
  const { newsId } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM isb_films_news_articles WHERE id = $1',
      [newsId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching news article:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==================== CREATE NEWS ARTICLE (DEFAULT: DRAFT) ====================
const createNewsArticle = async (req, res) => {
  const {
    title,
    description,
    publish_date,
    author,
    category,
    order_index,
  } = req.body;

  console.log('📰 Creating news article:', { title, category, status: 'draft' });

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    // Get news page ID
    const pageResult = await db.query(
      "SELECT id FROM isb_films_pages WHERE name = 'news'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'News page not found' });
    }

    const pageId = pageResult.rows[0].id;

    // Get image URL from uploaded file
    const imageUrl = req.file ? req.file.location : null;
    console.log('📸 Image URL:', imageUrl);

    const result = await db.query(
      `INSERT INTO isb_films_news_articles (
        page_id, title, description, image_url, publish_date,
        author, category, status, order_index,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        pageId,
        title,
        description || null,
        imageUrl,
        publish_date || new Date(),
        author || null,
        category || null,
        order_index || 0,
      ]
    );

    const newArticle = result.rows[0];
    console.log('✅ News article created with status: draft, ID:', newArticle.id);

    // Log activity
    try {
      if (req.user && activityLoggers && activityLoggers.pageContent) {
        await activityLoggers.pageContent.logContentUpdate(
          req,
          'ISB Films - News',
          'news_article',
          `Added news article "${title}" (draft)`,
          null,
          {
            article_id: newArticle.id,
            title: newArticle.title,
            category: newArticle.category,
            status: 'draft',
            has_image: !!imageUrl,
          }
        );
      }
    } catch (logError) {
      console.error('⚠️ Error logging activity:', logError.message);
    }

    res.status(201).json({
      ...newArticle,
      message: 'News article created as draft successfully',
    });
  } catch (error) {
    console.error('❌ Error creating news article:', error);
    res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== UPDATE NEWS ARTICLE ====================
const updateNewsArticle = async (req, res) => {
  const { newsId } = req.params;
  const {
    title,
    description,
    publish_date,
    author,
    category,
    status,
    order_index,
  } = req.body;

  console.log('✏️ Updating news article:', newsId);

  try {
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_news_articles WHERE id = $1',
      [newsId]
    );

    if (oldDataResult.rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }

    const oldArticle = oldDataResult.rows[0];
    const imageUrl = req.file ? req.file.location : oldArticle.image_url;

    const result = await db.query(
      `UPDATE isb_films_news_articles SET
        title = $1, 
        description = $2, 
        image_url = $3, 
        publish_date = $4,
        author = $5, 
        category = $6, 
        status = $7, 
        order_index = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *`,
      [
        title || oldArticle.title,
        description !== undefined ? description : oldArticle.description,
        imageUrl,
        publish_date || oldArticle.publish_date,
        author || oldArticle.author,
        category || oldArticle.category,
        status || oldArticle.status,
        order_index !== undefined ? order_index : oldArticle.order_index,
        newsId,
      ]
    );

    const updatedArticle = result.rows[0];

    if (req.file && oldArticle.image_url) {
      try {
        await deleteFile(oldArticle.image_url);
      } catch (error) {
        console.error('⚠️ Error deleting old image:', error);
      }
    }

    // Log activity
    try {
      if (req.user && activityLoggers && activityLoggers.pageContent) {
        await activityLoggers.pageContent.logContentUpdate(
          req,
          'ISB Films - News',
          'news_article',
          `Updated news article "${updatedArticle.title}"`,
          oldArticle,
          updatedArticle
        );
      }
    } catch (logError) {
      console.error('⚠️ Error logging activity:', logError.message);
    }

    res.json({
      ...updatedArticle,
      message: 'News article updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating news article:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==================== DELETE NEWS ARTICLE ====================
const deleteNewsArticle = async (req, res) => {
  const { newsId } = req.params;

  try {
    const articleResult = await db.query(
      'SELECT * FROM isb_films_news_articles WHERE id = $1',
      [newsId]
    );

    if (articleResult.rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }

    const article = articleResult.rows[0];

    await db.query('DELETE FROM isb_films_news_articles WHERE id = $1', [newsId]);

    if (article.image_url) {
      try {
        await deleteFile(article.image_url);
      } catch (error) {
        console.error('⚠️ Error deleting image:', error);
      }
    }

    // Log activity
    try {
      if (req.user && activityLoggers && activityLoggers.pageContent) {
        await activityLoggers.pageContent.logContentUpdate(
          req,
          'ISB Films - News',
          'news_article',
          `Deleted news article "${article.title}"`,
          article,
          null
        );
      }
    } catch (logError) {
      console.error('⚠️ Error logging activity:', logError.message);
    }

    res.json({ message: 'News article deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting news article:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==================== REORDER NEWS ARTICLES ====================
const reorderNews = async (req, res) => {
  const { articles } = req.body;

  if (!Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({ error: 'Invalid articles array' });
  }

  try {
    const promises = articles.map((article) =>
      db.query(
        'UPDATE isb_films_news_articles SET order_index = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [article.order_index, article.id]
      )
    );

    await Promise.all(promises);

    res.json({ message: 'News articles reordered successfully' });
  } catch (error) {
    console.error('❌ Error reordering news articles:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAllNews,
  getAllNewsAdmin,
  getNewsArticle,
  createNewsArticle,
  updateNewsArticle,
  deleteNewsArticle,
  reorderNews,
};
