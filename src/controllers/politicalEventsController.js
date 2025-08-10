const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const { activityLoggers } = require('../middlewares/activityLogger');

const getPoliticalEventsPage = async (req, res) => {
  try {
    const pageResult = await db.query(
      'SELECT id, name, title, background_video_url, background_thumbnail_url, status FROM pages WHERE name = $1',
      ['politicalevents']
    );
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Political events page not found' });
    }

    const page = pageResult.rows[0];
    const pageId = page.id;

    // Get ISBC standout items
    const standoutResult = await db.query(
      `SELECT id, title, image_url, order_index, created_at, updated_at
       FROM isbc_standout
       WHERE page_id = $1
       ORDER BY order_index ASC, created_at ASC`,
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
      standoutItems: standoutResult.rows,
      totalStandoutItems: standoutResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching political events page:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching political events page',
    });
  }
};

// ============ ISBC STANDOUT ENDPOINTS ============

// Get all ISBC standout items
const getAllStandoutItems = async (req, res) => {
  try {
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['politicalevents']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Political events page not found' });
    }

    const pageId = pageResult.rows[0].id;

    const result = await db.query(
      `SELECT id, title, image_url, order_index, created_at, updated_at
       FROM isbc_standout
       WHERE page_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [pageId]
    );

    res.json({
      success: true,
      standoutItems: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching standout items:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching standout items',
    });
  }
};

// Get single standout item
const getSingleStandoutItem = async (req, res) => {
  const { itemId } = req.params;

  try {
    const result = await db.query(
      `SELECT st.id, st.title, st.image_url, st.order_index, st.created_at, st.updated_at, p.name as page_name
       FROM isbc_standout st
       JOIN pages p ON st.page_id = p.id
       WHERE st.id = $1`,
      [itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Standout item not found',
      });
    }

    res.json({
      success: true,
      standoutItem: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching standout item:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching standout item',
    });
  }
};

// Add new standout item
const addStandoutItem = async (req, res) => {
  const { title, orderIndex } = req.body;

  // Validation
  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'Title is required',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Image file is required',
    });
  }

  try {
    // Get political events page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['politicalevents']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Political events page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Check if we already have 4 items for this page
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM isbc_standout WHERE page_id = $1',
      [pageId]
    );

    if (parseInt(countResult.rows[0].count) >= 4) {
      return res.status(400).json({
        success: false,
        error: 'Maximum of 4 standout items allowed per page',
      });
    }

    // Insert new standout item
    const result = await db.query(
      `INSERT INTO isbc_standout (page_id, title, image_url, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [pageId, title.trim(), req.file.location, orderIndex ? parseInt(orderIndex) : 0]
    );

    const newItem = result.rows[0];

    // Log the standout item creation activity
    await activityLoggers.standout.logCreate(req, newItem.id, newItem.title, {
      image_url: newItem.image_url,
      order_index: newItem.order_index,
    });

    // Log file upload
    await activityLoggers.standout.logFileUpload(
      req,
      newItem.id,
      newItem.title,
      'standout_image',
      req.file.originalname,
      req.file.location,
      req.file.size
    );

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change to draft
    await activityLoggers.pageContent.logStatusChange(req, 'politicalevents', 'published', 'draft');

    res.status(201).json({
      success: true,
      message: 'Standout item added successfully. Page saved as draft.',
      standoutItem: newItem,
    });
  } catch (error) {
    console.error('Error adding standout item:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding standout item',
    });
  }
};

// Update standout item
const updateStandoutItem = async (req, res) => {
  const { itemId } = req.params;
  const { title, orderIndex } = req.body;

  // Validation
  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'Title is required',
    });
  }

  try {
    // Get old data for logging
    const oldDataQuery = 'SELECT * FROM isbc_standout WHERE id = $1';
    const oldDataResult = await db.query(oldDataQuery, [itemId]);
    const oldItem = oldDataResult.rows[0];

    if (!oldItem) {
      return res.status(404).json({
        success: false,
        error: 'Standout item not found',
      });
    }

    // Get political events page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['politicalevents']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Political events page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    let updateQuery, updateParams;

    if (req.file) {
      // Delete old image from S3
      if (oldItem.image_url) {
        await deleteFile(oldItem.image_url);
      }

      // Update with new image
      updateQuery = `
        UPDATE isbc_standout
        SET title = $1, image_url = $2, order_index = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *`;
      updateParams = [
        title.trim(),
        req.file.location,
        orderIndex ? parseInt(orderIndex) : 0,
        itemId,
      ];
    } else {
      // Update without changing image
      updateQuery = `
        UPDATE isbc_standout
        SET title = $1, order_index = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *`;
      updateParams = [title.trim(), orderIndex ? parseInt(orderIndex) : 0, itemId];
    }

    const result = await db.query(updateQuery, updateParams);
    const updatedItem = result.rows[0];

    // Log the update activity
    await activityLoggers.standout.logUpdate(
      req,
      updatedItem.id,
      updatedItem.title,
      {
        title: oldItem.title,
        image_url: oldItem.image_url,
        order_index: oldItem.order_index,
      },
      {
        title: updatedItem.title,
        image_url: updatedItem.image_url,
        order_index: updatedItem.order_index,
      }
    );

    // Log file upload if new image was uploaded
    if (req.file) {
      await activityLoggers.standout.logFileUpload(
        req,
        updatedItem.id,
        updatedItem.title,
        'standout_image',
        req.file.originalname,
        req.file.location,
        req.file.size
      );
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change to draft
    await activityLoggers.pageContent.logStatusChange(req, 'politicalevents', 'published', 'draft');

    res.json({
      success: true,
      message: 'Standout item updated successfully. Page saved as draft.',
      standoutItem: updatedItem,
    });
  } catch (error) {
    console.error('Error updating standout item:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating standout item',
    });
  }
};

// Delete standout item
const deleteStandoutItem = async (req, res) => {
  const { itemId } = req.params;

  try {
    // Get political events page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['politicalevents']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Political events page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Get standout item details for logging and to delete image from S3
    const itemResult = await db.query('SELECT * FROM isbc_standout WHERE id = $1', [itemId]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Standout item not found',
      });
    }

    const itemData = itemResult.rows[0];

    // Delete image from S3
    if (itemData.image_url) {
      await deleteFile(itemData.image_url);
    }

    // Delete from database
    await db.query('DELETE FROM isbc_standout WHERE id = $1', [itemId]);

    // Log the deletion activity
    await activityLoggers.standout.logDelete(req, itemData.id, itemData.title, {
      image_url: itemData.image_url,
      order_index: itemData.order_index,
    });

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change to draft
    await activityLoggers.pageContent.logStatusChange(req, 'politicalevents', 'published', 'draft');

    res.json({
      success: true,
      message: `Standout item "${itemData.title}" deleted successfully. Page saved as draft.`,
    });
  } catch (error) {
    console.error('Error deleting standout item:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting standout item',
    });
  }
};

module.exports = {
  getPoliticalEventsPage,
  getAllStandoutItems,
  getSingleStandoutItem,
  addStandoutItem,
  updateStandoutItem,
  deleteStandoutItem,
};
