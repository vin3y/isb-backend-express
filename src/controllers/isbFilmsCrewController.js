const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const { activityLoggers } = require('../middlewares/activityLogger');

// Get all crew members (PUBLISHED ONLY for public)
const getAllISBFilmsCrew = async (req, res) => {
  try {
    const pageResult = await db.query(
      "SELECT id FROM isb_films_pages WHERE name = 'home'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Home page not found'
      });
    }

    const pageId = pageResult.rows[0].id;

    const result = await db.query(
      `SELECT * FROM isb_films_crew 
       WHERE page_id = $1 AND status = 'published'
       ORDER BY order_index, id`,
      [pageId]
    );

    res.json({
      success: true,
      crew: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching ISB Films crew:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Get all crew members for admin (ALL STATUSES)
const getAllISBFilmsCrewAdmin = async (req, res) => {
  try {
    const pageResult = await db.query(
      "SELECT id FROM isb_films_pages WHERE name = 'home'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Home page not found'
      });
    }

    const pageId = pageResult.rows[0].id;

    const result = await db.query(
      `SELECT * FROM isb_films_crew 
       WHERE page_id = $1 
       ORDER BY order_index, id`,
      [pageId]
    );

    res.json({
      success: true,
      crew: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching ISB Films crew:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Get single crew member
const getISBFilmsCrewMember = async (req, res) => {
  const { crewId } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM isb_films_crew WHERE id = $1',
      [crewId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Crew member not found'
      });
    }

    res.json({
      success: true,
      crew: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching crew member:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Add new crew member (DEFAULT: DRAFT)
const addISBFilmsCrewMember = async (req, res) => {
  const { name, designation, about, order_index } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Name is required'
    });
  }

  console.log('👤 Adding crew member:', { name, status: 'draft' });

  try {
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'home'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Home page not found'
      });
    }

    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;
    const photoUrl = req.file ? req.file.location : null;

    const result = await db.query(
      `INSERT INTO isb_films_crew 
       (page_id, name, photo_url, designation, about, order_index, status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [
        pageId,
        name,
        photoUrl,
        designation || null,
        about || null,
        order_index || 0,
      ]
    );

    const newCrew = result.rows[0];
    console.log('✅ Crew member created with status: draft, ID:', newCrew.id);

    // Set page to draft when content is modified
    await db.query(
      "UPDATE isb_films_pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change if it changed
    if (oldPageStatus !== 'draft') {
      await activityLoggers.pageContent.logStatusChange(
        req,
        'ISB Films - Home',
        oldPageStatus,
        'draft'
      );
    }

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Home',
      'crew',
      `Added crew member "${name}" (draft)`,
      null,
      {
        crew_id: newCrew.id,
        name: newCrew.name,
        designation: newCrew.designation,
        status: 'draft',
        has_photo: !!photoUrl,
      }
    );

    res.status(201).json({
      success: true,
      message: 'Crew member created as draft successfully. Page saved as draft.',
      crew: newCrew,
    });
  } catch (error) {
    console.error('❌ Error adding ISB Films crew member:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update crew member
const updateISBFilmsCrewMember = async (req, res) => {
  const { crewId } = req.params;
  const { name, designation, about, order_index, status } = req.body;

  try {
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_crew WHERE id = $1',
      [crewId]
    );

    if (oldDataResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Crew member not found'
      });
    }

    const oldCrew = oldDataResult.rows[0];
    const photoUrl = req.file ? req.file.location : oldCrew.photo_url;

    // Get page status
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'home'"
    );
    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    const result = await db.query(
      `UPDATE isb_films_crew 
       SET name = $1, 
           photo_url = $2, 
           designation = $3, 
           about = $4, 
           order_index = $5,
           status = $6,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7 
       RETURNING *`,
      [
        name || oldCrew.name,
        photoUrl,
        designation !== undefined ? designation : oldCrew.designation,
        about !== undefined ? about : oldCrew.about,
        order_index !== undefined ? order_index : oldCrew.order_index,
        status || oldCrew.status,
        crewId,
      ]
    );

    const updatedCrew = result.rows[0];

    if (req.file && oldCrew.photo_url) {
      try {
        await deleteFile(oldCrew.photo_url);
      } catch (deleteError) {
        console.error('⚠️ Error deleting old photo:', deleteError);
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
        'ISB Films - Home',
        oldPageStatus,
        'draft'
      );
    }

    // Identify changed fields
    const changedFields = [];
    if (oldCrew.name !== updatedCrew.name) changedFields.push('name');
    if (oldCrew.designation !== updatedCrew.designation) changedFields.push('designation');
    if (oldCrew.about !== updatedCrew.about) changedFields.push('about');
    if (oldCrew.photo_url !== updatedCrew.photo_url) changedFields.push('photo');
    if (oldCrew.status !== updatedCrew.status) changedFields.push('status');

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Home',
      'crew',
      `Updated crew member "${updatedCrew.name}" (${changedFields.length > 0 ? changedFields.join(', ') : 'no changes'})`,
      oldCrew,
      updatedCrew
    );

    res.json({
      success: true,
      message: 'Crew member updated successfully. Page saved as draft.',
      crew: updatedCrew,
    });
  } catch (error) {
    console.error('❌ Error updating ISB Films crew member:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Delete crew member
const deleteISBFilmsCrewMember = async (req, res) => {
  const { crewId } = req.params;

  try {
    const crewResult = await db.query(
      'SELECT * FROM isb_films_crew WHERE id = $1',
      [crewId]
    );

    if (crewResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Crew member not found'
      });
    }

    const crew = crewResult.rows[0];

    // Get page status
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'home'"
    );
    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    await db.query('DELETE FROM isb_films_crew WHERE id = $1', [crewId]);

    if (crew.photo_url) {
      try {
        await deleteFile(crew.photo_url);
      } catch (deleteError) {
        console.error('⚠️ Error deleting photo from S3:', deleteError);
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
        'ISB Films - Home',
        oldPageStatus,
        'draft'
      );
    }

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Home',
      'crew',
      `Deleted crew member "${crew.name}"`,
      crew,
      null
    );

    res.json({
      success: true,
      message: `Crew member "${crew.name}" deleted successfully. Page saved as draft.`
    });
  } catch (error) {
    console.error('❌ Error deleting ISB Films crew member:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Reorder crew members
const reorderISBFilmsCrew = async (req, res) => {
  const { crewMembers } = req.body;

  if (!Array.isArray(crewMembers) || crewMembers.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid crew members array'
    });
  }

  try {
    // Get page status
    const pageResult = await db.query(
      "SELECT id, status FROM isb_films_pages WHERE name = 'home'"
    );
    const pageId = pageResult.rows[0].id;
    const oldPageStatus = pageResult.rows[0].status;

    const promises = crewMembers.map((member) =>
      db.query(
        'UPDATE isb_films_crew SET order_index = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [member.order_index, member.id]
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
        'ISB Films - Home',
        oldPageStatus,
        'draft'
      );
    }

    // Log content update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'ISB Films - Home',
      'crew',
      `Reordered ${crewMembers.length} crew members`,
      null,
      {
        crew_count: crewMembers.length,
        reorder_ids: crewMembers.map((m) => m.id),
      }
    );

    res.json({
      success: true,
      message: 'Crew members reordered successfully. Page saved as draft.'
    });
  } catch (error) {
    console.error('❌ Error reordering ISB Films crew:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

module.exports = {
  getAllISBFilmsCrew,
  getAllISBFilmsCrewAdmin,
  getISBFilmsCrewMember,
  addISBFilmsCrewMember,
  updateISBFilmsCrewMember,
  deleteISBFilmsCrewMember,
  reorderISBFilmsCrew,
};
