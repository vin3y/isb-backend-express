const db = require('../config/db');

// ==================== GET ALL ISB FILMS PAGES (PUBLISHED ONLY) ====================
// ==================== GET ALL ISB FILMS PAGES (PUBLISHED ONLY) ====================
const getAllPublicISBFilmsPages = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        id, 
        name, 
        title, 
        background_video_url, 
        background_thumbnail_url, 
        status, 
        updated_at 
       FROM isb_films_pages 
       WHERE status = 'published' 
       ORDER BY 
         CASE name 
           WHEN 'home' THEN 1 
           WHEN 'filmography' THEN 2 
           WHEN 'sustainability' THEN 3
           WHEN 'news' THEN 4
           ELSE 5 
         END, 
         name`
    );

    const pages = [];

    for (const page of result.rows) {
      const pageData = { ...page };

      // ⭐ CASE 1: CONTACT PAGE → fetch background from MAIN pages table
      if (page.name === 'contact') {
        const bgResult = await db.query(
          `SELECT 
            background_video_url,
            background_thumbnail_url
           FROM pages
           WHERE name = 'contact' AND status = 'published'`
        );

        if (bgResult.rows.length > 0) {
          pageData.background_video_url = bgResult.rows[0].background_video_url;
          pageData.background_thumbnail_url = bgResult.rows[0].background_thumbnail_url;
        }
      }

      // ⭐ CASE 2: normal ISB Films pages
      switch (page.name) {
        case 'home':
          const crewResult = await db.query(
            `SELECT 
              id, 
              name, 
              designation, 
              photo_url, 
              about,
              order_index 
             FROM isb_films_crew 
             WHERE page_id = $1 AND status = 'published'
             ORDER BY order_index, id`,
            [page.id]
          );
          pageData.crew = crewResult.rows;
          pageData.totalCrew = crewResult.rows.length;
          break;

        case 'filmography':
          const moviesResult = await db.query(
            `SELECT 
              m.id,
              m.film_name,
              m.poster_url,
              m.trailer_url,
              m.year_of_release,
              m.director,
              m.format,
              m.description,
              m.synopsis,
              m.cast_members,
              m.production_company,
              m.sales_agent_name,
              m.imdb_link,
              m.vimeo_youtube_link,
              m.order_index,
              m.created_at,
              m.updated_at,
              (SELECT COUNT(*) FROM isb_films_movie_awards WHERE movie_id = m.id) as awards_count
             FROM isb_films_movies m
             WHERE m.page_id = $1 AND m.status = 'published'
             ORDER BY m.order_index, m.year_of_release DESC, m.created_at DESC`,
            [page.id]
          );
          pageData.movies = moviesResult.rows;
          pageData.totalMovies = moviesResult.rows.length;

          const yearsResult = await db.query(
            `SELECT DISTINCT year_of_release as year, COUNT(*) as movie_count
             FROM isb_films_movies
             WHERE page_id = $1 AND status = 'published'
             GROUP BY year_of_release
             ORDER BY year_of_release DESC`,
            [page.id]
          );
          pageData.years = yearsResult.rows;
          break;

        case 'sustainability':
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
             WHERE page_id = $1 AND status = 'published'
             ORDER BY order_index, created_at DESC`,
            [page.id]
          );
          pageData.vows = vowsResult.rows;
          pageData.totalVows = vowsResult.rows.length;
          break;

        case 'news':
          const newsResult = await db.query(
            `SELECT 
              id,
              title,
              description,
              image_url,
              publish_date,
              author,
              category,
              order_index,
              created_at,
              updated_at
             FROM isb_films_news_articles 
             WHERE page_id = $1 AND status = 'published'
             ORDER BY order_index, publish_date DESC, created_at DESC`,
            [page.id]
          );
          pageData.news = newsResult.rows;
          pageData.totalNews = newsResult.rows.length;

          const categoriesResult = await db.query(
            `SELECT DISTINCT category, COUNT(*) as article_count
             FROM isb_films_news_articles
             WHERE page_id = $1 AND status = 'published' AND category IS NOT NULL
             GROUP BY category
             ORDER BY category`,
            [page.id]
          );
          pageData.categories = categoriesResult.rows;
          break;

        default:
          break;
      }

      pages.push(pageData);
    }

    res.json({
      success: true,
      pages: pages,
      total: pages.length,
    });
  } catch (error) {
    console.error('Error fetching public ISB Films pages:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};
// ==================== GET SPECIFIC PAGE DETAILS (PUBLISHED ONLY) ====================
const getPublicISBFilmsPageDetails = async (req, res) => {
  const { pageName } = req.params;

  try {
    let pageResult;

    // ⭐ SPECIAL CASE: Contact page → Fetch from main pages table
    if (pageName === 'contact') {
      pageResult = await db.query(
        `SELECT 
          id,
          name,
          title,
          background_video_url,
          background_thumbnail_url,
          status,
          updated_at
         FROM pages
         WHERE name = $1 AND status = 'published'`,
        [pageName]
      );
    } else {
      // ⭐ Normal ISB Films pages → Fetch from isb_films_pages
      pageResult = await db.query(
        `SELECT 
          id, 
          name, 
          title, 
          background_video_url, 
          background_thumbnail_url, 
          status, 
          updated_at 
         FROM isb_films_pages 
         WHERE name = $1 AND status = 'published'`,
        [pageName]
      );
    }

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Page not found or not published',
      });
    }

    const page = pageResult.rows[0];

    // ⭐ For CONTACT page, no ISB Films–specific data is needed → return immediately
    if (pageName === 'contact') {
      return res.json({
        success: true,
        page: {
          ...page,
          contactInfo: null, // Optional: if you want you can attach contact info here too
        },
      });
    }

    // ⭐ Add ISB Films specific sections for non-contact pages
    switch (pageName) {
      case 'home':
        const crewResult = await db.query(
          `SELECT 
            id, 
            name, 
            designation, 
            photo_url, 
            about,
            order_index 
           FROM isb_films_crew 
           WHERE page_id = $1 AND status = 'published'
           ORDER BY order_index, id`,
          [page.id]
        );
        page.crew = crewResult.rows;
        page.totalCrew = crewResult.rows.length;

        const homeSectionsResult = await db.query(
          `SELECT 
            id,
            section_type,
            content
           FROM isb_films_home_multiple
           WHERE films_page_id = $1
           ORDER BY id ASC`,
          [page.id]
        );

        page.sections = homeSectionsResult.rows;
        break;

      case 'filmography':
        const moviesResult = await db.query(
          `SELECT 
            m.id,
            m.film_name,
            m.poster_url,
            m.trailer_url,
            m.year_of_release,
            m.director,
            m.format,
            m.description,
            m.synopsis,
            m.cast_members,
            m.production_company,
            m.sales_agent_name,
            m.imdb_link,
            m.vimeo_youtube_link,
            m.order_index,
            m.created_at,
            m.updated_at,
            (SELECT COUNT(*) FROM isb_films_movie_awards WHERE movie_id = m.id) as awards_count
           FROM isb_films_movies m
           WHERE m.page_id = $1 AND m.status = 'published'
           ORDER BY m.order_index, m.year_of_release DESC, m.created_at DESC`,
          [page.id]
        );
        page.movies = moviesResult.rows;
        page.totalMovies = moviesResult.rows.length;

        const yearsResult = await db.query(
          `SELECT DISTINCT year_of_release as year, COUNT(*) as movie_count
           FROM isb_films_movies
           WHERE page_id = $1 AND status = 'published'
           GROUP BY year_of_release
           ORDER BY year_of_release DESC`,
          [page.id]
        );
        page.years = yearsResult.rows;
        break;

      case 'sustainability':
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
           WHERE page_id = $1 AND status = 'published'
           ORDER BY order_index, created_at DESC`,
          [page.id]
        );
        page.vows = vowsResult.rows;
        page.totalVows = vowsResult.rows.length;
        break;

      case 'news':
        const newsResult = await db.query(
          `SELECT 
            id,
            title,
            description,
            image_url,
            publish_date,
            author,
            category,
            order_index,
            created_at,
            updated_at
           FROM isb_films_news_articles 
           WHERE page_id = $1 AND status = 'published'
           ORDER BY order_index, publish_date DESC, created_at DESC`,
          [page.id]
        );
        page.news = newsResult.rows;
        page.totalNews = newsResult.rows.length;

        const categoriesResult = await db.query(
          `SELECT DISTINCT category, COUNT(*) as article_count
           FROM isb_films_news_articles
           WHERE page_id = $1 AND status = 'published' AND category IS NOT NULL
           GROUP BY category
           ORDER BY category`,
          [page.id]
        );
        page.categories = categoriesResult.rows;
        break;

      default:
        break;
    }

    res.json({
      success: true,
      page: page,
    });
  } catch (error) {
    console.error('Error fetching public ISB Films page details:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
}; // ==================== GET ALL PAGES BACKGROUND DATA ====================
const getAllISBFilmsPagesBackground = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        name, 
        title, 
        background_video_url, 
        background_thumbnail_url 
       FROM isb_films_pages 
       WHERE status = 'published' 
       ORDER BY 
         CASE name 
           WHEN 'home' THEN 1 
           WHEN 'filmography' THEN 2 
           WHEN 'news' THEN 3
           ELSE 4 
         END, 
         name`
    );

    res.json({
      success: true,
      pages: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching ISB Films pages background data:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// ==================== GET SINGLE PAGE BACKGROUND DATA ====================
const getISBFilmsPageBackground = async (req, res) => {
  const { pageName } = req.params;

  try {
    let result;

    if (pageName === 'contact') {
      // ⭐ Fetch background from MAIN pages table
      result = await db.query(
        `SELECT 
          name, 
          title, 
          background_video_url, 
          background_thumbnail_url 
         FROM pages 
         WHERE name = $1 AND status = 'published'`,
        [pageName]
      );
    } else {
      // ⭐ Default: fetch from ISB Films table
      result = await db.query(
        `SELECT 
          name, 
          title, 
          background_video_url, 
          background_thumbnail_url 
         FROM isb_films_pages 
         WHERE name = $1 AND status = 'published'`,
        [pageName]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Page not found or not published',
      });
    }

    res.json({
      success: true,
      page: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching ISB Films page background:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// ==================== GET SINGLE MOVIE WITH AWARDS (PUBLIC) ====================
const getPublicMovieDetails = async (req, res) => {
  const { movieId } = req.params;

  try {
    const movieResult = await db.query(
      'SELECT * FROM isb_films_movies WHERE id = $1 AND status = $2',
      [movieId, 'published']
    );

    if (movieResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found or not published',
      });
    }

    const movie = movieResult.rows[0];

    // Get awards
    const awardsResult = await db.query(
      `SELECT 
        id,
        award_name,
        award_logo_url,
        award_year,
        order_index,
        created_at
       FROM isb_films_movie_awards 
       WHERE movie_id = $1 
       ORDER BY order_index, award_year DESC`,
      [movieId]
    );

    res.json({
      success: true,
      movie: {
        ...movie,
        awards: awardsResult.rows,
        awards_count: awardsResult.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching public movie details:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// ==================== GET MOVIES BY YEAR (PUBLIC) ====================
const getPublicMoviesByYear = async (req, res) => {
  const { year } = req.params;

  const releaseYear = parseInt(year);
  if (isNaN(releaseYear) || releaseYear < 1900 || releaseYear > 2100) {
    return res.status(400).json({
      success: false,
      error: 'Invalid year parameter',
    });
  }

  try {
    const pageResult = await db.query(
      "SELECT id FROM isb_films_pages WHERE name = 'filmography' AND status = 'published'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Filmography page not found or not published',
      });
    }

    const pageId = pageResult.rows[0].id;

    const moviesResult = await db.query(
      `SELECT 
        m.id,
        m.film_name,
        m.poster_url,
        m.trailer_url,
        m.year_of_release,
        m.director,
        m.format,
        m.description,
        m.synopsis,
        m.cast_members,
        m.order_index,
        (SELECT COUNT(*) FROM isb_films_movie_awards WHERE movie_id = m.id) as awards_count
       FROM isb_films_movies m
       WHERE m.page_id = $1 AND m.status = 'published' AND m.year_of_release = $2
       ORDER BY m.order_index, m.created_at DESC`,
      [pageId, releaseYear]
    );

    res.json({
      success: true,
      movies: moviesResult.rows,
      year: releaseYear,
      total: moviesResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching public movies by year:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// ==================== GET LATEST 4 MOVIES (PUBLIC) ====================
const getLatestMovies = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        id, 
        film_name, 
        poster_url, 
        year_of_release, 
        director, 
        description
       FROM isb_films_movies
       WHERE status = 'published'
       ORDER BY year_of_release DESC, created_at DESC
       LIMIT 4`
    );

    res.json({
      success: true,
      movies: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching latest movies:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// ==================== GET NEWS ARTICLES BY CATEGORY (PUBLIC) ====================
const getPublicNewsByCategory = async (req, res) => {
  const { category } = req.params;

  try {
    const pageResult = await db.query(
      "SELECT id FROM isb_films_pages WHERE name = 'news' AND status = 'published'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'News page not found or not published',
      });
    }

    const pageId = pageResult.rows[0].id;

    const newsResult = await db.query(
      `SELECT 
        id,
        title,
        description,
        image_url,
        publish_date,
        author,
        category,
        order_index,
        created_at,
        updated_at
       FROM isb_films_news_articles
       WHERE page_id = $1 AND status = 'published' AND category = $2
       ORDER BY order_index, publish_date DESC, created_at DESC`,
      [pageId, category]
    );

    res.json({
      success: true,
      articles: newsResult.rows,
      category: category,
      total: newsResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching public news by category:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// ==================== GET SINGLE NEWS ARTICLE (PUBLIC) ====================
const getPublicNewsArticle = async (req, res) => {
  const { newsId } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM isb_films_news_articles WHERE id = $1 AND status = $2',
      [newsId, 'published']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'News article not found or not published',
      });
    }

    res.json({
      success: true,
      article: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching public news article:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// ==================== GET ALL CREW MEMBERS (PUBLIC) ====================
const getPublicCrew = async (req, res) => {
  try {
    const pageResult = await db.query(
      "SELECT id FROM isb_films_pages WHERE name = 'home' AND status = 'published'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Home page not found or not published',
      });
    }

    const pageId = pageResult.rows[0].id;

    const crewResult = await db.query(
      `SELECT 
        id, 
        name, 
        designation, 
        photo_url, 
        about,
        order_index 
       FROM isb_films_crew 
       WHERE page_id = $1 AND status = 'published'
       ORDER BY order_index, id`,
      [pageId]
    );

    res.json({
      success: true,
      crew: crewResult.rows,
      total: crewResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching public crew:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

const getPublicSustainabilityVows = async (req, res) => {
  try {
    const pageResult = await db.query(
      "SELECT id FROM isb_films_pages WHERE name = 'sustainability' AND status = 'published'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sustainability page not found or not published',
      });
    }

    const pageId = pageResult.rows[0].id;

    const vowsResult = await db.query(
      `SELECT 
        id, 
        vow_heading, 
        description, 
        image_url,
        order_index,
        created_at
       FROM isb_films_sustainability_vows 
       WHERE page_id = $1 AND status = 'published'
       ORDER BY order_index, created_at DESC`,
      [pageId]
    );

    res.json({
      success: true,
      vows: vowsResult.rows,
      total: vowsResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching public sustainability vows:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// ==================== GET SINGLE SUSTAINABILITY VOW (PUBLIC) ====================
const getPublicSustainabilityVow = async (req, res) => {
  const { vowId } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM isb_films_sustainability_vows WHERE id = $1 AND status = $2',
      [vowId, 'published']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sustainability vow not found or not published',
      });
    }

    res.json({
      success: true,
      vow: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching public sustainability vow:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

module.exports = {
  getAllPublicISBFilmsPages,
  getPublicISBFilmsPageDetails,
  getAllISBFilmsPagesBackground,
  getISBFilmsPageBackground,
  getPublicMovieDetails,
  getPublicMoviesByYear,
  getLatestMovies,
  getPublicNewsByCategory,
  getPublicNewsArticle,
  getPublicCrew,
  getPublicSustainabilityVows,
  getPublicSustainabilityVow,
};
