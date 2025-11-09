const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const { activityLoggers } = require('../middlewares/activityLogger');

// ==================== GET ALL SUSTAINABILITY VOWS (PUBLISHED ONLY - PUBLIC) ====================
const getAllSustainabilityVows = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        id, vow_heading, description, image_url, order_index, created_at
       FROM isb_films_sustainability_vows
       WHERE status = 'published'
       ORDER BY order_index, created_at DESC`
    );

    res.json({
      success: true,
      vows: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching sustainability vows:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== GET ALL SUSTAINABILITY VOWS (FOR ADMIN - ALL STATUSES) ====================
const getAllSustainabilityVowsAdmin = async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT * FROM isb_films_sustainability_vows
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    query += ` ORDER BY order_index, created_at DESC`;

    const result = await db.query(query, values);

    res.json({
      success: true,
      vows: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching sustainability vows (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== GET SINGLE SUSTAINABILITY VOW ====================
const getSustainabilityVow = async (req, res) => {
  const { vowId } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM isb_films_sustainability_vows WHERE id = $1',
      [vowId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sustainability vow not found'
      });
    }

    res.json({
      success: true,
      vow: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching sustainability vow:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== CREATE NEW SUSTAINABILITY VOW (DEFAULT: DRAFT) ====================
const createSustainabilityVow = async (req, res) => {
  const { vow_heading, description, order_index } = req.body;

  if (!vow_heading) {
    return res.status(400).json({
      success: false,
      error: 'Vow heading is required'
    });
  }

  console.log('🌱 Creating sustainability vow:', { vow_heading, status: 'draft' });

  try {
    // Get sustainability page
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'sustainability'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sustainability page not found'
      });
    }

    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    // Get image URL from upload
    const imageUrl = req.file ? req.file.location : null;

    console.log('🖼️ Image URL:', imageUrl);

    // Insert vow with status = 'draft'
    const result = await db.query(
      `INSERT INTO isb_films_sustainability_vows (
        page_id, vow_heading, description, image_url, 
        status, order_index, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'draft', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        pageId,
        vow_heading,
        description || null,
        imageUrl,
        order_index || 0,
      ]
    );

    const newVow = result.rows[0];
    console.log('✅ Sustainability vow created with status: draft, ID:', newVow.id);

    // Set page to draft when content is modified
    await db.query(
      "UPDATE isb_films_pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change if it changed
    if (oldPageStatus !== 'draft') {
      await activityLoggers.pageContent.logStatusChange(
        req,
        'ISB Films - Sustainability',
        oldPageStatus,
        'draft'
      );
    }

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Sustainability',
      'vow',
      `Added sustainability vow "${vow_heading}" (draft)`,
      null,
      {
        vow_id: newVow.id,
        vow_heading: newVow.vow_heading,
        status: 'draft',
      }
    );

    res.status(201).json({
      success: true,
      message: 'Sustainability vow created as draft successfully. Page saved as draft.',
      vow: newVow,
    });
  } catch (error) {
    console.error('❌ Error creating sustainability vow:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== UPDATE SUSTAINABILITY VOW ====================
const updateSustainabilityVow = async (req, res) => {
  const { vowId } = req.params;
  const { vow_heading, description, status, order_index } = req.body;

  console.log('✏️ Updating sustainability vow:', vowId);

  try {
    // Get old data
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_sustainability_vows WHERE id = $1',
      [vowId]
    );

    if (oldDataResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sustainability vow not found'
      });
    }

    const oldVow = oldDataResult.rows[0];

    // Get page status
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'sustainability'"
    );
    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    // Handle image upload
    const imageUrl = req.file ? req.file.location : oldVow.image_url;

    console.log('🖼️ Image URL:', imageUrl);

    // Update vow
    const result = await db.query(
      `UPDATE isb_films_sustainability_vows SET
        vow_heading = $1,
        description = $2,
        image_url = $3,
        status = $4,
        order_index = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *`,
      [
        vow_heading || oldVow.vow_heading,
        description !== undefined ? description : oldVow.description,
        imageUrl,
        status || oldVow.status,
        order_index !== undefined ? order_index : oldVow.order_index,
        vowId,
      ]
    );

    const updatedVow = result.rows[0];

    // Delete old image if new one uploaded
    if (req.file && oldVow.image_url) {
      try {
        await deleteFile(oldVow.image_url);
      } catch (error) {
        console.error('⚠️ Error deleting old image:', error);
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
        'ISB Films - Sustainability',
        oldPageStatus,
        'draft'
      );
    }

    // Identify changed fields
    const changedFields = [];
    if (oldVow.vow_heading !== updatedVow.vow_heading) changedFields.push('heading');
    if (oldVow.description !== updatedVow.description) changedFields.push('description');
    if (oldVow.image_url !== updatedVow.image_url) changedFields.push('image');
    if (oldVow.status !== updatedVow.status) changedFields.push('status');

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Sustainability',
      'vow',
      `Updated sustainability vow "${updatedVow.vow_heading}" (${changedFields.length > 0 ? changedFields.join(', ') : 'no changes'})`,
      oldVow,
      updatedVow
    );

    res.json({
      success: true,
      message: 'Sustainability vow updated successfully. Page saved as draft.',
      vow: updatedVow,
    });
  } catch (error) {
    console.error('❌ Error updating sustainability vow:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== DELETE SUSTAINABILITY VOW ====================
const deleteSustainabilityVow = async (req, res) => {
  const { vowId } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM isb_films_sustainability_vows WHERE id = $1',
      [vowId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sustainability vow not found'
      });
    }

    const vow = result.rows[0];

    // Get page status
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'sustainability'"
    );
    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    // Delete vow
    await db.query('DELETE FROM isb_films_sustainability_vows WHERE id = $1', [vowId]);

    // Delete image from S3
    if (vow.image_url) {
      try {
        await deleteFile(vow.image_url);
      } catch (error) {
        console.error('⚠️ Error deleting image:', error);
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
        'ISB Films - Sustainability',
        oldPageStatus,
        'draft'
      );
    }

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Sustainability',
      'vow',
      `Deleted sustainability vow "${vow.vow_heading}"`,
      vow,
      null
    );

    res.json({
      success: true,
      message: `Sustainability vow "${vow.vow_heading}" deleted successfully. Page saved as draft.`
    });
  } catch (error) {
    console.error('❌ Error deleting sustainability vow:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// ==================== REORDER SUSTAINABILITY VOWS ====================
const reorderSustainabilityVows = async (req, res) => {
  const { vows } = req.body;

  if (!Array.isArray(vows) || vows.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid vows array'
    });
  }

  try {
    // Get page status
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'sustainability'"
    );
    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    const promises = vows.map((vow) =>
      db.query(
        'UPDATE isb_films_sustainability_vows SET order_index = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [vow.order_index, vow.id]
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
        'ISB Films - Sustainability',
        oldPageStatus,
        'draft'
      );
    }

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Sustainability',
      'vow',
      `Reordered ${vows.length} sustainability vows`,
      null,
      {
        vow_count: vows.length,
        reorder_ids: vows.map((v) => v.id),
      }
    );

    res.json({
      success: true,
      message: 'Sustainability vows reordered successfully. Page saved as draft.'
    });
  } catch (error) {
    console.error('❌ Error reordering sustainability vows:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

module.exports = {
  getAllSustainabilityVows,
  getAllSustainabilityVowsAdmin,
  getSustainabilityVow,
  createSustainabilityVow,
  updateSustainabilityVow,
  deleteSustainabilityVow,
  reorderSustainabilityVows,
};
