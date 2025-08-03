const db = require('../config/db');
const { deleteFile } = require('../utils/s3');

// Get all awards for awards page
const getAllAwards = async (req, res) => {
  try {
    const pageResult = await db.query(
      'SELECT id, name, title, background_video_url, background_thumbnail_url, status FROM pages WHERE name = $1',
      ['awards']
    );
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Awards page not found' });
    }

    const page = pageResult.rows[0];
    const pageId = page.id;

    // Get all awards for awards page
    const awardsResult = await db.query(
      `
            SELECT id,
                   award_name,
                   award_year,
                   award_description,
                   award_image_url,
                   order_index,
                   created_at,
                   updated_at
            FROM awards
            WHERE page_id = $1
            ORDER BY award_year DESC, order_index ASC, created_at DESC
        `,
      [pageId]
    );

    res.json({
      success: true,
      id: page.id,
      name: page.name,
      title: page.title,
      backgroundVideoUrl: page.background_video_url,
      backgroundThumbnailUrl: page.background_thumbnail_url,
      status: page.status,
      awards: awardsResult.rows,
      total: awardsResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching awards:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching awards',
    });
  }
};

// Get single award by ID
const getSingleAward = async (req, res) => {
  const { awardId } = req.params;

  try {
    const awardResult = await db.query(
      `
            SELECT a.id,
                   a.award_name,
                   a.award_year,
                   a.award_description,
                   a.award_image_url,
                   a.order_index,
                   a.created_at,
                   a.updated_at,
                   p.name as page_name
            FROM awards a
                     JOIN pages p ON a.page_id = p.id
            WHERE a.id = $1
        `,
      [awardId]
    );

    if (awardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Award not found',
      });
    }

    res.json({
      success: true,
      award: awardResult.rows[0],
    });
  } catch (error) {
    console.error('Error fetching award:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching award',
    });
  }
};

// Add new award
const addAward = async (req, res) => {
  const { awardName, awardYear, awardDescription, orderIndex } = req.body;

  // Validation
  if (!awardName || !awardYear) {
    return res.status(400).json({
      success: false,
      error: 'Award name and year are required',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Award image file is required',
    });
  }

  // Validate year
  const year = parseInt(awardYear);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return res.status(400).json({
      success: false,
      error: 'Invalid award year. Must be between 1900 and 2100',
    });
  }

  try {
    // Get awards page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['awards']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Awards page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Insert new award
    const result = await db.query(
      `
            INSERT INTO awards (page_id, award_name, award_year, award_description, award_image_url, order_index)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `,
      [
        pageId,
        awardName.trim(),
        year,
        awardDescription ? awardDescription.trim() : null,
        req.file.location,
        orderIndex ? parseInt(orderIndex) : 0,
      ]
    );

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.status(201).json({
      success: true,
      message: 'Award added successfully. Page saved as draft.',
      award: result.rows[0],
    });
  } catch (error) {
    console.error('Error adding award:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding award',
    });
  }
};

// Update existing award
const updateAward = async (req, res) => {
  const { awardId } = req.params;
  const { awardName, awardYear, awardDescription, orderIndex } = req.body;

  // Validation
  if (!awardName || !awardYear) {
    return res.status(400).json({
      success: false,
      error: 'Award name and year are required',
    });
  }

  // Validate year
  const year = parseInt(awardYear);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return res.status(400).json({
      success: false,
      error: 'Invalid award year. Must be between 1900 and 2100',
    });
  }

  try {
    // Get awards page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['awards']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Awards page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    let updateQuery, updateParams;

    if (req.file) {
      // Get old image URL to delete from S3
      const oldImageResult = await db.query('SELECT award_image_url FROM awards WHERE id = $1', [
        awardId,
      ]);

      if (oldImageResult.rows.length > 0 && oldImageResult.rows[0].award_image_url) {
        await deleteFile(oldImageResult.rows[0].award_image_url);
      }

      // Update with new image
      updateQuery = `
                UPDATE awards
                SET award_name        = $1,
                    award_year        = $2,
                    award_description = $3,
                    award_image_url   = $4,
                    order_index       = $5,
                    updated_at        = CURRENT_TIMESTAMP
                WHERE id = $6
                RETURNING *
            `;
      updateParams = [
        awardName.trim(),
        year,
        awardDescription ? awardDescription.trim() : null,
        req.file.location,
        orderIndex ? parseInt(orderIndex) : 0,
        awardId,
      ];
    } else {
      // Update without changing image
      updateQuery = `
                UPDATE awards
                SET award_name        = $1,
                    award_year        = $2,
                    award_description = $3,
                    order_index       = $4,
                    updated_at        = CURRENT_TIMESTAMP
                WHERE id = $5
                RETURNING *
            `;
      updateParams = [
        awardName.trim(),
        year,
        awardDescription ? awardDescription.trim() : null,
        orderIndex ? parseInt(orderIndex) : 0,
        awardId,
      ];
    }

    const result = await db.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Award not found',
      });
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      success: true,
      message: 'Award updated successfully. Page saved as draft.',
      award: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating award:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating award',
    });
  }
};

// Delete award
const deleteAward = async (req, res) => {
  const { awardId } = req.params;

  try {
    // Get awards page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['awards']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Awards page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Get award details to delete image from S3
    const awardResult = await db.query(
      'SELECT award_name, award_image_url FROM awards WHERE id = $1',
      [awardId]
    );

    if (awardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Award not found',
      });
    }

    const awardData = awardResult.rows[0];

    // Delete image from S3
    if (awardData.award_image_url) {
      await deleteFile(awardData.award_image_url);
    }

    // Delete from database
    const deleteResult = await db.query('DELETE FROM awards WHERE id = $1 RETURNING *', [awardId]);

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      success: true,
      message: `Award "${awardData.award_name}" deleted successfully. Page saved as draft.`,
    });
  } catch (error) {
    console.error('Error deleting award:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting award',
    });
  }
};

// Get awards by year
const getAwardsByYear = async (req, res) => {
  const { year } = req.params;

  // Validate year
  const awardYear = parseInt(year);
  if (isNaN(awardYear) || awardYear < 1900 || awardYear > 2100) {
    return res.status(400).json({
      success: false,
      error: 'Invalid year parameter',
    });
  }

  try {
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['awards']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Awards page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    const awardsResult = await db.query(
      `
            SELECT id,
                   award_name,
                   award_year,
                   award_description,
                   award_image_url,
                   order_index,
                   created_at,
                   updated_at
            FROM awards
            WHERE page_id = $1
              AND award_year = $2
            ORDER BY order_index ASC, created_at DESC
        `,
      [pageId, awardYear]
    );

    res.json({
      success: true,
      awards: awardsResult.rows,
      year: awardYear,
      total: awardsResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching awards by year:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching awards by year',
    });
  }
};

// Get unique years that have awards
const getAwardYears = async (req, res) => {
  try {
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['awards']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Awards page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    const yearsResult = await db.query(
      `
            SELECT DISTINCT award_year, COUNT(*) as award_count
            FROM awards
            WHERE page_id = $1
            GROUP BY award_year
            ORDER BY award_year DESC
        `,
      [pageId]
    );

    res.json({
      success: true,
      years: yearsResult.rows,
      total: yearsResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching award years:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching award years',
    });
  }
};

module.exports = {
  getAllAwards,
  getSingleAward,
  addAward,
  updateAward,
  deleteAward,
  getAwardsByYear,
  getAwardYears,
};
