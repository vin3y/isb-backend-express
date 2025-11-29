const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const router = require('../routes');
const { activityLoggers } = require('../middlewares/activityLogger');

const getAboutPageData = async (req, res) => {
  try {
    // 1. Get the About page ID
    const pageResult = await db.query(`SELECT id FROM pages WHERE name = 'about' LIMIT 1`);
    const pageId = pageResult.rows[0].id;

    // 2. Get all sections (vision, mission, who we are)
    const sectionsResult = await db.query(
      `
        SELECT 
          section_type,
          content
        FROM about_sections 
        WHERE page_id = $1
      `,
      [pageId]
    );

    // 3. Get team members
    const teamResult = await db.query(
      `
        SELECT 
          id, 
          name, 
          designation, 
          photo_url, 
          order_index,
          created_at
        FROM team_members
        WHERE page_id = $1
        ORDER BY order_index ASC, created_at ASC
      `,
      [pageId]
    );

    // 4. Get events (⭐ NEW)
    const eventsResult = await db.query(
      `
        SELECT
          id,
          event_title,
          event_year,
          event_video_link,
          order_index,
          created_at
        FROM about_events
        WHERE page_id = $1
        ORDER BY event_year DESC, order_index ASC
      `,
      [pageId]
    );

    // 5. Construct response object
    const sections = {};
    sectionsResult.rows.forEach((sec) => {
      sections[sec.section_type] = sec.content;
    });

    return res.json({
      success: true,
      page_id: pageId,

      sections: sections,
      totalSections: sectionsResult.rows.length,

      team: teamResult.rows,
      totalTeam: teamResult.rows.length,

      events: eventsResult.rows, // ⭐ NEW
      totalEvents: eventsResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching About Page Data:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
};

// Update vision section
const updateVision = async (req, res) => {
  try {
    const { content } = req.body;
    const pageId = 2; // About page ID
    const sectionType = 'vision';

    // Get old content for logging
    const oldDataQuery = 'SELECT * FROM about_sections WHERE page_id = $1 AND section_type = $2';
    const oldDataResult = await db.query(oldDataQuery, [pageId, sectionType]);
    const oldSection = oldDataResult.rows[0];

    let result;
    let operation = 'updated';

    if (oldSection) {
      // Update existing vision section
      const updateQuery = `
          UPDATE about_sections 
          SET content = $1, updated_at = CURRENT_TIMESTAMP
          WHERE page_id = $2 AND section_type = $3
          RETURNING *
        `;
      result = await db.query(updateQuery, [content, pageId, sectionType]);
    } else {
      // Insert new vision section (first time setup)
      const insertQuery = `
          INSERT INTO about_sections (page_id, section_type, content)
          VALUES ($1, $2, $3)
          RETURNING *
        `;
      result = await db.query(insertQuery, [pageId, sectionType, content]);
      operation = 'added';
    }

    const updatedSection = result.rows[0];

    // Log the section update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'about',
      'vision_section',
      `${operation.charAt(0).toUpperCase() + operation.slice(1)} vision section in about page`,
      oldSection ? { content: oldSection.content } : null,
      { content: updatedSection.content }
    );

    res.json({
      success: true,
      message: `Vision section ${operation} successfully`,
      data: updatedSection,
    });
  } catch (error) {
    console.error('Error updating vision:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vision section',
      error: error.message,
    });
  }
};

// Update mission section
const updateMission = async (req, res) => {
  try {
    const { content } = req.body;
    const pageId = 2; // About page ID
    const sectionType = 'mission';

    // Get old content for logging
    const oldDataQuery = 'SELECT * FROM about_sections WHERE page_id = $1 AND section_type = $2';
    const oldDataResult = await db.query(oldDataQuery, [pageId, sectionType]);
    const oldSection = oldDataResult.rows[0];

    let result;
    let operation = 'updated';

    if (oldSection) {
      // Update existing mission section
      const updateQuery = `
          UPDATE about_sections 
          SET content = $1, updated_at = CURRENT_TIMESTAMP
          WHERE page_id = $2 AND section_type = $3
          RETURNING *
        `;
      result = await db.query(updateQuery, [content, pageId, sectionType]);
    } else {
      // Insert new mission section (first time setup)
      const insertQuery = `
          INSERT INTO about_sections (page_id, section_type, content)
          VALUES ($1, $2, $3)
          RETURNING *
        `;
      result = await db.query(insertQuery, [pageId, sectionType, content]);
      operation = 'added';
    }

    const updatedSection = result.rows[0];

    // Log the section update activity
    await activityLoggers.pageContent.logContentUpdate(
      req,
      'about',
      'mission_section',
      `${operation.charAt(0).toUpperCase() + operation.slice(1)} mission section in about page`,
      oldSection ? { content: oldSection.content } : null,
      { content: updatedSection.content }
    );

    res.json({
      success: true,
      message: `Mission section ${operation} successfully`,
      data: updatedSection,
    });
  } catch (error) {
    console.error('Error updating mission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mission section',
      error: error.message,
    });
  }
};

// TEAM MEMBER CRUD OPERATIONS

// Get all team members
const getAllTeamMembers = async (req, res) => {
  try {
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['about']);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'About page not found' });
    }

    const pageId = pageResult.rows[0].id;

    const teamResult = await db.query(
      'SELECT * FROM team_members WHERE page_id = $1 ORDER BY order_index, created_at',
      [pageId]
    );

    res.json({
      teamMembers: teamResult.rows,
      total: teamResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get single team member
const getTeamMember = async (req, res) => {
  const { memberId } = req.params;

  try {
    const result = await db.query('SELECT * FROM team_members WHERE id = $1', [memberId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching team member:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Add team member
const addTeamMember = async (req, res) => {
  try {
    const { name, designation } = req.body;
    const pageId = 2; // About page ID

    // Get photo URL if uploaded
    const photo_url = req.file ? req.file.location : null;

    const insertQuery = `
        INSERT INTO team_members (page_id, name, designation, photo_url)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

    const values = [pageId, name, designation, photo_url];
    const result = await db.query(insertQuery, values);
    const newTeamMember = result.rows[0];

    // Log the team member creation activity
    await activityLoggers.teamMember.logCreate(req, newTeamMember.id, newTeamMember.name, {
      designation: newTeamMember.designation,
      photo_url: newTeamMember.photo_url,
    });

    // Log file upload if photo was uploaded
    if (req.file) {
      await activityLoggers.teamMember.logFileUpload(
        req,
        newTeamMember.id,
        newTeamMember.name,
        'team_photo',
        req.file.originalname,
        req.file.location,
        req.file.size
      );
    }

    res.status(201).json({
      success: true,
      message: 'Team member added successfully',
      data: newTeamMember,
    });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add team member',
      error: error.message,
    });
  }
};

// Update team member
const updateTeamMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { name, designation } = req.body;

    // Get old data for logging
    const oldDataQuery = 'SELECT * FROM team_members WHERE id = $1';
    const oldDataResult = await db.query(oldDataQuery, [memberId]);
    const oldTeamMember = oldDataResult.rows[0];

    if (!oldTeamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    // Prepare update data
    let photo_url = oldTeamMember.photo_url;
    if (req.file) {
      photo_url = req.file.location;
    }

    const updateQuery = `
        UPDATE team_members 
        SET name = $1, designation = $2, photo_url = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `;

    const values = [name, designation, photo_url, memberId];
    const result = await db.query(updateQuery, values);
    const updatedTeamMember = result.rows[0];

    // Log the update activity
    await activityLoggers.teamMember.logUpdate(
      req,
      updatedTeamMember.id,
      updatedTeamMember.name,
      {
        name: oldTeamMember.name,
        designation: oldTeamMember.designation,
        photo_url: oldTeamMember.photo_url,
      },
      {
        name: updatedTeamMember.name,
        designation: updatedTeamMember.designation,
        photo_url: updatedTeamMember.photo_url,
      }
    );

    // Log file upload if new photo was uploaded
    if (req.file) {
      await activityLoggers.teamMember.logFileUpload(
        req,
        updatedTeamMember.id,
        updatedTeamMember.name,
        'team_photo',
        req.file.originalname,
        req.file.location,
        req.file.size
      );
    }

    res.json({
      success: true,
      message: 'Team member updated successfully',
      data: updatedTeamMember,
    });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update team member',
      error: error.message,
    });
  }
};

// Delete team member
// const deleteTeamMember = async (req, res) => {
//   const { memberId } = req.params;

//   try {
//     // Get about page ID
//     const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['about']);
//     const pageId = pageResult.rows[0].id;

//     // Get photo URL to delete from S3
//     const photoResult = await db.query('SELECT photo_url FROM team_members WHERE id = $1', [
//       memberId,
//     ]);

//     if (photoResult.rows.length > 0 && photoResult.rows[0].photo_url) {
//       await deleteFile(photoResult.rows[0].photo_url);
//     }

//     // Delete from database
//     const result = await db.query('DELETE FROM team_members WHERE id = $1 RETURNING *', [memberId]);

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Team member not found' });
//     }

//     // Set page to draft
//     await db.query(
//       "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
//       [pageId]
//     );

//     res.json({
//       message: 'Team member deleted successfully. Page saved as draft.',
//     });
//   } catch (error) {
//     console.error('Error deleting team member:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

const deleteTeamMember = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Get team member data before deletion for logging
    const teamMemberQuery = 'SELECT * FROM team_members WHERE id = $1';
    const teamMemberResult = await db.query(teamMemberQuery, [memberId]);
    const teamMember = teamMemberResult.rows[0];

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    const photoResult = await db.query('SELECT photo_url FROM team_members WHERE id = $1', [
      memberId,
    ]);

    if (photoResult.rows.length > 0 && photoResult.rows[0].photo_url) {
      await deleteFile(photoResult.rows[0].photo_url);
    }

    // Delete the team member
    const deleteQuery = 'DELETE FROM team_members WHERE id = $1 RETURNING *';
    const deleteResult = await db.query(deleteQuery, [memberId]);

    // Log the deletion activity
    await activityLoggers.teamMember.logDelete(req, teamMember.id, teamMember.name, {
      designation: teamMember.designation,
      photo_url: teamMember.photo_url,
    });

    res.json({
      success: true,
      message: 'Team member removed successfully',
      data: deleteResult.rows[0],
    });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove team member',
      error: error.message,
    });
  }
};

//get events data

const getAllEvents = async (req, res) => {
  try {
    const pageIdResult = await db.query(`SELECT id FROM pages WHERE name = 'about'`);
    const pageId = pageIdResult.rows[0].id;

    const result = await db.query(
      `
        SELECT * FROM about_events
        WHERE page_id = $1
        ORDER BY event_year DESC, order_index ASC
      `,
      [pageId]
    );

    res.json({ events: result.rows, total: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const addEvent = async (req, res) => {
  try {
    const { event_title, event_year, event_video_link, order_index } = req.body;

    const pageIdResult = await db.query(`SELECT id FROM pages WHERE name = 'about'`);
    const pageId = pageIdResult.rows[0].id;

    const insert = await db.query(
      `
        INSERT INTO about_events (page_id, event_title, event_year, event_video_link, order_index)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [pageId, event_title, event_year, event_video_link, order_index || 0]
    );

    res.json({ success: true, message: 'Event added', data: insert.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update event
const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { event_title, event_year, event_video_link, order_index } = req.body;

    const update = await db.query(
      `
        UPDATE about_events
        SET event_title = $1,
            event_year = $2,
            event_video_link = $3,
            order_index = $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [event_title, event_year, event_video_link, order_index, eventId]
    );

    res.json({ success: true, message: 'Event updated', data: update.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete event
const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const del = await db.query(`DELETE FROM about_events WHERE id = $1 RETURNING *`, [eventId]);

    res.json({ success: true, message: 'Event deleted', data: del.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAboutPageData,
  updateVision,
  updateMission,
  getAllTeamMembers,
  getTeamMember,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
  getAllEvents,
  addEvent,
  updateEvent,
  deleteEvent,
};
