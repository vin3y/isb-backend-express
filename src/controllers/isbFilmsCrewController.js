const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const { activityLoggers } = require('../middlewares/activityLogger');

// Get all crew members for ISB Films home page
const getAllISBFilmsCrew = async (req, res) => {
  try {
    // Get the home page ID
    const pageResult = await db.query(
      "SELECT id FROM isb_films_pages WHERE name = 'home'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Home page not found' });
    }

    const pageId = pageResult.rows[0].id;

    // Get all crew members
    const result = await db.query(
      `SELECT * FROM isb_films_crew 
       WHERE page_id = $1 
       ORDER BY order_index, id`,
      [pageId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ISB Films crew:', error);
    res.status(500).json({ error: 'Server error' });
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
      return res.status(404).json({ error: 'Crew member not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching crew member:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Add new crew member
const addISBFilmsCrewMember = async (req, res) => {
  const { name, designation, about, order_index, is_active } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // Get the home page ID
    const pageResult = await db.query(
      "SELECT id FROM isb_films_pages WHERE name = 'home'"
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Home page not found' });
    }

    const pageId = pageResult.rows[0].id;

    // Get photo URL from uploaded file
    const photoUrl = req.file ? req.file.location : null;

    // Insert new crew member
    const result = await db.query(
      `INSERT INTO isb_films_crew 
       (page_id, name, photo_url, designation, about, order_index, is_active, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [
        pageId,
        name,
        photoUrl,
        designation || null,
        about || null,
        order_index || 0,
        is_active !== undefined ? is_active : true,
      ]
    );

    const newCrew = result.rows[0];

    // Log activity - Use the correct logger
    if (req.user) {
      await activityLoggers.pageContent.logContentUpdate(
        req,
        'ISB Films - Home',
        'crew',
        `Added crew member "${name}" to ISB Films`,
        null,
        {
          crew_id: newCrew.id,
          name: newCrew.name,
          designation: newCrew.designation,
          has_photo: !!photoUrl,
        }
      );
    }

    res.status(201).json({
      ...newCrew,
      message: 'Crew member added successfully',
    });
  } catch (error) {
    console.error('Error adding ISB Films crew member:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update crew member
const updateISBFilmsCrewMember = async (req, res) => {
  const { crewId } = req.params;
  const { name, designation, about, order_index, is_active } = req.body;

  try {
    // Get old data for logging
    const oldDataResult = await db.query(
      'SELECT * FROM isb_films_crew WHERE id = $1',
      [crewId]
    );

    if (oldDataResult.rows.length === 0) {
      return res.status(404).json({ error: 'Crew member not found' });
    }

    const oldCrew = oldDataResult.rows[0];

    // Get photo URL from uploaded file, or keep old one
    const photoUrl = req.file ? req.file.location : oldCrew.photo_url;

    // Update crew member
    const result = await db.query(
      `UPDATE isb_films_crew 
       SET name = $1, 
           photo_url = $2, 
           designation = $3, 
           about = $4, 
           order_index = $5, 
           is_active = $6,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7 
       RETURNING *`,
      [
        name || oldCrew.name,
        photoUrl,
        designation !== undefined ? designation : oldCrew.designation,
        about !== undefined ? about : oldCrew.about,
        order_index !== undefined ? order_index : oldCrew.order_index,
        is_active !== undefined ? is_active : oldCrew.is_active,
        crewId,
      ]
    );

    const updatedCrew = result.rows[0];

    // Delete old photo if new one was uploaded
    if (req.file && oldCrew.photo_url) {
      try {
        await deleteFile(oldCrew.photo_url);
      } catch (deleteError) {
        console.error('Error deleting old photo:', deleteError);
      }
    }

    // Log activity
    if (req.user) {
      const changedFields = [];
      if (oldCrew.name !== updatedCrew.name) changedFields.push('name');
      if (oldCrew.designation !== updatedCrew.designation) changedFields.push('designation');
      if (oldCrew.about !== updatedCrew.about) changedFields.push('about');
      if (oldCrew.photo_url !== updatedCrew.photo_url) changedFields.push('photo');
      if (oldCrew.order_index !== updatedCrew.order_index) changedFields.push('order');
      if (oldCrew.is_active !== updatedCrew.is_active) changedFields.push('status');

      const fieldsText = changedFields.length > 0 ? changedFields.join(', ') : 'no changes';

      await activityLoggers.pageContent.logContentUpdate(
        req,
        'ISB Films - Home',
        'crew',
        `Updated crew member "${updatedCrew.name}" (${fieldsText})`,
        {
          name: oldCrew.name,
          designation: oldCrew.designation,
          photo_updated: req.file ? true : false,
        },
        {
          name: updatedCrew.name,
          designation: updatedCrew.designation,
          changes: changedFields,
        }
      );
    }

    res.json({
      ...updatedCrew,
      message: 'Crew member updated successfully',
    });
  } catch (error) {
    console.error('Error updating ISB Films crew member:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete crew member
const deleteISBFilmsCrewMember = async (req, res) => {
  const { crewId } = req.params;

  try {
    // Get crew data before deletion
    const crewResult = await db.query(
      'SELECT * FROM isb_films_crew WHERE id = $1',
      [crewId]
    );

    if (crewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Crew member not found' });
    }

    const crew = crewResult.rows[0];

    // Delete from database
    await db.query('DELETE FROM isb_films_crew WHERE id = $1', [crewId]);

    // Delete photo from S3
    if (crew.photo_url) {
      try {
        await deleteFile(crew.photo_url);
      } catch (deleteError) {
        console.error('Error deleting photo from S3:', deleteError);
      }
    }

    // Log activity
    if (req.user) {
      await activityLoggers.pageContent.logContentUpdate(
        req,
        'ISB Films - Home',
        'crew',
        `Removed crew member "${crew.name}" from ISB Films`,
        {
          crew_id: crew.id,
          name: crew.name,
          designation: crew.designation,
        },
        null
      );
    }

    res.json({ message: 'Crew member deleted successfully' });
  } catch (error) {
    console.error('Error deleting ISB Films crew member:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Reorder crew members
const reorderISBFilmsCrew = async (req, res) => {
  const { crewMembers } = req.body;

  if (!Array.isArray(crewMembers) || crewMembers.length === 0) {
    return res.status(400).json({ error: 'Invalid crew members array' });
  }

  try {
    // Update order_index for each crew member
    const promises = crewMembers.map((member) =>
      db.query(
        'UPDATE isb_films_crew SET order_index = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [member.order_index, member.id]
      )
    );

    await Promise.all(promises);

    // Log activity
    if (req.user) {
      await activityLoggers.pageContent.logContentUpdate(
        req,
        'ISB Films - Home',
        'crew',
        `Reordered ${crewMembers.length} crew members`,
        null,
        {
          crew_count: crewMembers.length,
          reorder_ids: crewMembers.map(m => m.id),
        }
      );
    }

    res.json({ message: 'Crew members reordered successfully' });
  } catch (error) {
    console.error('Error reordering ISB Films crew:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAllISBFilmsCrew,
  getISBFilmsCrewMember,
  addISBFilmsCrewMember,
  updateISBFilmsCrewMember,
  deleteISBFilmsCrewMember,
  reorderISBFilmsCrew,
};
