const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const { activityLoggers } = require('../middlewares/activityLogger');

// ==================== GET LATEST 4 MOVIES (PUBLISHED ONLY) ====================
const getLatestMovies = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        id, film_name, poster_url, year_of_release, 
        director, description, status
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
      error: 'Server error'
    });
  }
};

// ==================== GET ALL MOVIES (PUBLISHED ONLY for public) ====================
const getAllMovies = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*,
        (SELECT COUNT(*) FROM isb_films_movie_awards WHERE movie_id = m.id) as awards_count
      FROM isb_films_movies m
      WHERE m.status = 'published'
      ORDER BY m.order_index, m.year_of_release DESC, m.created_at DESC`
    );

    res.json({
      success: true,
      movies: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== GET ALL MOVIES (FOR ADMIN - ALL STATUSES) ====================
const getAllMoviesAdmin = async (req, res) => {
  try {
    const { status, year, director, limit, offset } = req.query;

    let query = `
      SELECT m.*,
        (SELECT COUNT(*) FROM isb_films_movie_awards WHERE movie_id = m.id) as awards_count
      FROM isb_films_movies m
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    if (year) {
      query += ` AND m.year_of_release = $${paramIndex}`;
      values.push(year);
      paramIndex++;
    }

    if (director) {
      query += ` AND m.director ILIKE $${paramIndex}`;
      values.push(`%${director}%`);
      paramIndex++;
    }

    query += ` ORDER BY m.order_index, m.year_of_release DESC, m.created_at DESC`;

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

    res.json({
      success: true,
      movies: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== GET SINGLE MOVIE WITH AWARDS ====================
const getMovieDetails = async (req, res) => {
  const { movieId } = req.params;

  try {
    const movieResult = await db.query(
      'SELECT * FROM isb_films_movies WHERE id = $1',
      [movieId]
    );

    if (movieResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
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
    console.error('Error fetching movie details:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== CREATE NEW MOVIE (DEFAULT: DRAFT) ====================
const createMovie = async (req, res) => {
  const {
    film_name,
    year_of_release,
    director,
    format,
    description,
    synopsis,
    cast_members,
    production_company,
    sales_agent_name,
    imdb_link,
    vimeo_youtube_link,
    trailer_url,
    order_index,
    awards,
  } = req.body;

  if (!film_name) {
    return res.status(400).json({
      success: false,
      error: 'Film name is required'
    });
  }

  console.log('🎬 Creating movie:', { film_name, status: 'draft' });
  console.log('📁 Received files:', req.files);

  try {
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'filmography'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Filmography page not found'
      });
    }

    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    // FIX: With .any() middleware, files come as array with fieldname property
    const posterFile = req.files ? req.files.find(file => file.fieldname === 'poster') : null;
    const posterUrl = posterFile ? posterFile.location : null;

    console.log('📸 Poster file found:', posterFile ? 'YES' : 'NO');
    console.log('📸 Poster URL:', posterUrl);

    // Insert movie with status = 'draft'
    const movieResult = await db.query(
      `INSERT INTO isb_films_movies (
        page_id, film_name, poster_url, trailer_url,
        year_of_release, director, format, description, synopsis, cast_members,
        production_company, sales_agent_name, imdb_link, vimeo_youtube_link,
        status, order_index, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft', $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        pageId,
        film_name,
        posterUrl,
        trailer_url || null,
        year_of_release || null,
        director || null,
        format || null,
        description || null,
        synopsis || null,
        cast_members || null,
        production_company || null,
        sales_agent_name || null,
        imdb_link || null,
        vimeo_youtube_link || null,
        order_index || 0,
      ]
    );

    const newMovie = movieResult.rows[0];
    console.log('✅ Movie created with status: draft, ID:', newMovie.id);

    // Handle awards (LOGO REQUIRED)
    let createdAwards = [];
    if (awards) {
      try {
        const awardsArray = typeof awards === 'string' ? JSON.parse(awards) : awards;
        console.log('🏆 Processing awards:', awardsArray.length);

        for (let i = 0; i < awardsArray.length; i++) {
          const award = awardsArray[i];

          // FIX: Find award logo file by fieldname
          const awardLogoField = `award_logo_${i}`;
          const awardLogoFile = req.files ? req.files.find(file => file.fieldname === awardLogoField) : null;
          const awardLogoUrl = awardLogoFile ? awardLogoFile.location : null;

          console.log(`🏆 Award ${i} logo field:`, awardLogoField);
          console.log(`🏆 Award ${i} logo found:`, awardLogoFile ? 'YES' : 'NO');

          // AWARD LOGO IS REQUIRED
          if (!awardLogoUrl) {
            console.log(`⚠️ Skipping award "${award.award_name}" - no logo provided`);
            continue;
          }

          const awardResult = await db.query(
            `INSERT INTO isb_films_movie_awards (
              movie_id, award_name, award_logo_url, award_year, order_index,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *`,
            [
              newMovie.id,
              award.award_name,
              awardLogoUrl,
              award.award_year || null,
              award.order_index !== undefined ? award.order_index : i,
            ]
          );

          createdAwards.push(awardResult.rows[0]);
          console.log(`✅ Award ${i + 1} added:`, award.award_name);
        }
      } catch (awardError) {
        console.error('⚠️ Error processing awards:', awardError.message);
      }
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE isb_films_pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change if it changed
    if (oldPageStatus !== 'draft') {
      await activityLoggers.pageContent.logStatusChange(
        req,
        'ISB Films - Filmography',
        oldPageStatus,
        'draft'
      );
    }

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Filmography',
      'movie',
      `Added movie "${film_name}" (draft) with ${createdAwards.length} awards`,
      null,
      {
        movie_id: newMovie.id,
        film_name: newMovie.film_name,
        status: 'draft',
        awards_count: createdAwards.length,
      }
    );

    res.status(201).json({
      success: true,
      message: 'Movie created as draft successfully. Page saved as draft.',
      movie: {
        ...newMovie,
        awards: createdAwards,
        awards_count: createdAwards.length,
      },
    });
  } catch (error) {
    console.error('❌ Error creating movie:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// ==================== UPDATE MOVIE ====================
const updateMovie = async (req, res) => {
  const { movieId } = req.params;
  const {
    film_name,
    year_of_release,
    director,
    format,
    description,
    synopsis,
    cast_members,
    production_company,
    sales_agent_name,
    imdb_link,
    vimeo_youtube_link,
    trailer_url,
    status,
    order_index,
    awards,
  } = req.body;

  console.log('✏️ Updating movie:', movieId);
  console.log('📁 Received files:', req.files);

  try {
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_movies WHERE id = $1',
      [movieId]
    );

    if (oldDataResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    const oldMovie = oldDataResult.rows[0];

    // Get page status
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'filmography'"
    );
    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    // FIX: Find poster file with .any() middleware
    const posterFile = req.files ? req.files.find(file => file.fieldname === 'poster') : null;
    const posterUrl = posterFile ? posterFile.location : oldMovie.poster_url;

    console.log('📸 Poster file found:', posterFile ? 'YES' : 'NO');
    console.log('📸 Poster URL:', posterUrl);

    // Update movie
    const movieResult = await db.query(
      `UPDATE isb_films_movies SET
        film_name = $1, poster_url = $2, trailer_url = $3,
        year_of_release = $4, director = $5, format = $6, 
        description = $7, synopsis = $8, cast_members = $9,
        production_company = $10, sales_agent_name = $11,
        imdb_link = $12, vimeo_youtube_link = $13,
        status = $14, order_index = $15,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
      RETURNING *`,
      [
        film_name || oldMovie.film_name,
        posterUrl,
        trailer_url !== undefined ? trailer_url : oldMovie.trailer_url,
        year_of_release !== undefined ? year_of_release : oldMovie.year_of_release,
        director || oldMovie.director,
        format || oldMovie.format,
        description !== undefined ? description : oldMovie.description,
        synopsis !== undefined ? synopsis : oldMovie.synopsis,
        cast_members !== undefined ? cast_members : oldMovie.cast_members,
        production_company || oldMovie.production_company,
        sales_agent_name || oldMovie.sales_agent_name,
        imdb_link || oldMovie.imdb_link,
        vimeo_youtube_link || oldMovie.vimeo_youtube_link,
        status || oldMovie.status,
        order_index !== undefined ? order_index : oldMovie.order_index,
        movieId,
      ]
    );

    const updatedMovie = movieResult.rows[0];

    // Delete old poster if new one uploaded
    if (posterFile && oldMovie.poster_url) {
      try {
        await deleteFile(oldMovie.poster_url);
      } catch (error) {
        console.error('⚠️ Error deleting old poster:', error);
      }
    }

    // Handle awards update
    let updatedAwards = [];
    if (awards) {
      try {
        const awardsArray = typeof awards === 'string' ? JSON.parse(awards) : awards;

        // Get existing awards
        const existingAwardsResult = await db.query(
          'SELECT * FROM isb_films_movie_awards WHERE movie_id = $1',
          [movieId]
        );
        const existingAwards = existingAwardsResult.rows;

        // Delete awards not in the new list
        const newAwardIds = awardsArray.filter(a => a.id).map(a => a.id);
        const awardsToDelete = existingAwards.filter(ea => !newAwardIds.includes(ea.id));

        for (const awardToDelete of awardsToDelete) {
          await db.query('DELETE FROM isb_films_movie_awards WHERE id = $1', [awardToDelete.id]);

          if (awardToDelete.award_logo_url) {
            try {
              await deleteFile(awardToDelete.award_logo_url);
            } catch (error) {
              console.error('⚠️ Error deleting award logo:', error);
            }
          }
        }

        // Update or create awards
        for (let i = 0; i < awardsArray.length; i++) {
          const award = awardsArray[i];

          // FIX: Find award logo with .any() middleware
          const awardLogoField = `award_logo_${i}`;
          const awardLogoFile = req.files ? req.files.find(file => file.fieldname === awardLogoField) : null;
          let awardLogoUrl = award.award_logo_url;

          if (awardLogoFile) {
            awardLogoUrl = awardLogoFile.location;

            if (award.id && award.award_logo_url) {
              try {
                await deleteFile(award.award_logo_url);
              } catch (error) {
                console.error('⚠️ Error deleting old award logo:', error);
              }
            }
          }

          // LOGO REQUIRED - skip if no logo
          if (!awardLogoUrl) {
            console.log(`⚠️ Skipping award "${award.award_name}" - no logo`);
            continue;
          }

          if (award.id) {
            // Update existing
            const awardResult = await db.query(
              `UPDATE isb_films_movie_awards SET
                award_name = $1,
                award_logo_url = $2,
                award_year = $3,
                order_index = $4,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $5
              RETURNING *`,
              [
                award.award_name,
                awardLogoUrl,
                award.award_year || null,
                award.order_index !== undefined ? award.order_index : i,
                award.id,
              ]
            );
            updatedAwards.push(awardResult.rows[0]);
          } else {
            // Create new
            const awardResult = await db.query(
              `INSERT INTO isb_films_movie_awards (
                movie_id, award_name, award_logo_url, award_year, order_index,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              RETURNING *`,
              [
                movieId,
                award.award_name,
                awardLogoUrl,
                award.award_year || null,
                award.order_index !== undefined ? award.order_index : i,
              ]
            );
            updatedAwards.push(awardResult.rows[0]);
          }
        }
      } catch (awardError) {
        console.error('⚠️ Error processing awards:', awardError.message);
      }
    } else {
      // Get existing awards
      const existingAwardsResult = await db.query(
        'SELECT * FROM isb_films_movie_awards WHERE movie_id = $1 ORDER BY order_index',
        [movieId]
      );
      updatedAwards = existingAwardsResult.rows;
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE isb_films_pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change if it changed
    if (oldPageStatus !== 'draft') {
      await activityLoggers.pageContent.logStatusChange(
        req,
        'ISB Films - Filmography',
        oldPageStatus,
        'draft'
      );
    }

    // Identify changed fields
    const changedFields = [];
    if (oldMovie.film_name !== updatedMovie.film_name) changedFields.push('film_name');
    if (oldMovie.year_of_release !== updatedMovie.year_of_release) changedFields.push('year');
    if (oldMovie.director !== updatedMovie.director) changedFields.push('director');
    if (oldMovie.poster_url !== updatedMovie.poster_url) changedFields.push('poster');
    if (oldMovie.status !== updatedMovie.status) changedFields.push('status');
    if (awards) changedFields.push('awards');

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Filmography',
      'movie',
      `Updated movie "${updatedMovie.film_name}" (${changedFields.length > 0 ? changedFields.join(', ') : 'no changes'})`,
      oldMovie,
      updatedMovie
    );

    res.json({
      success: true,
      message: 'Movie updated successfully. Page saved as draft.',
      movie: {
        ...updatedMovie,
        awards: updatedAwards,
        awards_count: updatedAwards.length,
      },
    });
  } catch (error) {
    console.error('❌ Error updating movie:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== DELETE MOVIE ====================
const deleteMovie = async (req, res) => {
  const { movieId } = req.params;

  try {
    const movieResult = await db.query(
      'SELECT * FROM isb_films_movies WHERE id = $1',
      [movieId]
    );

    if (movieResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    const movie = movieResult.rows[0];

    // Get page status
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'filmography'"
    );
    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    // Get all awards
    const awardsResult = await db.query(
      'SELECT * FROM isb_films_movie_awards WHERE movie_id = $1',
      [movieId]
    );

    // Delete movie
    await db.query('DELETE FROM isb_films_movies WHERE id = $1', [movieId]);

    // Delete poster
    if (movie.poster_url) {
      try {
        await deleteFile(movie.poster_url);
      } catch (error) {
        console.error('⚠️ Error deleting poster:', error);
      }
    }

    // Delete award logos
    for (const award of awardsResult.rows) {
      if (award.award_logo_url) {
        try {
          await deleteFile(award.award_logo_url);
        } catch (error) {
          console.error('⚠️ Error deleting award logo:', error);
        }
      }
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE isb_films_pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change if it changed
    if (oldPageStatus !== 'draft') {
      await activityLoggers.pageContent.logStatusChange(
        req,
        'ISB Films - Filmography',
        oldPageStatus,
        'draft'
      );
    }

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Filmography',
      'movie',
      `Deleted movie "${movie.film_name}" with ${awardsResult.rows.length} awards`,
      movie,
      null
    );

    res.json({
      success: true,
      message: `Movie "${movie.film_name}" deleted successfully. Page saved as draft.`,
      deleted_awards: awardsResult.rows.length
    });
  } catch (error) {
    console.error('❌ Error deleting movie:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== REORDER MOVIES ====================
const reorderMovies = async (req, res) => {
  const { movies } = req.body;

  if (!Array.isArray(movies) || movies.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid movies array'
    });
  }

  try {
    // Get page status
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'filmography'"
    );
    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    const promises = movies.map((movie) =>
      db.query(
        'UPDATE isb_films_movies SET order_index = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [movie.order_index, movie.id]
      )
    );

    await Promise.all(promises);

    // Set page to draft when content is modified
    await db.query(
      "UPDATE isb_films_pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change if it changed
    if (oldPageStatus !== 'draft') {
      await activityLoggers.pageContent.logStatusChange(
        req,
        'ISB Films - Filmography',
        oldPageStatus,
        'draft'
      );
    }

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Filmography',
      'movie',
      `Reordered ${movies.length} movies`,
      null,
      {
        movie_count: movies.length,
        reorder_ids: movies.map((m) => m.id),
      }
    );

    res.json({
      success: true,
      message: 'Movies reordered successfully. Page saved as draft.'
    });
  } catch (error) {
    console.error('❌ Error reordering movies:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

module.exports = {
  getLatestMovies,
  getAllMovies,
  getAllMoviesAdmin,
  getMovieDetails,
  createMovie,
  updateMovie,
  deleteMovie,
  reorderMovies,
};
