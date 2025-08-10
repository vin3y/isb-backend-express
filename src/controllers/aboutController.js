const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const router = require('../routes');
const { activityLoggers } = require('../middlewares/activityLogger');

const getAboutPageData = async (req, res) => {
  try {
    // Get about page ID
    const pageResult = await db.query(
      'SELECT id, name, title, background_video_url, background_thumbnail_url, status FROM pages WHERE name = $1',
      ['about']
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'About page not found' });
    }

    const page = pageResult.rows[0];
    const pageId = page.id;

    // Get vision and mission sections
    const sectionsResult = await db.query(
      'SELECT section_type, content FROM about_sections WHERE page_id = $1',
      [pageId]
    );

    // Get team members
    const teamResult = await db.query(
      'SELECT * FROM team_members WHERE page_id = $1 ORDER BY order_index, created_at',
      [pageId]
    );

    // Structure the response
    const sections = {};
    sectionsResult.rows.forEach((section) => {
      sections[section.section_type] = section.content;
    });

    res.json({
      // Page info
      id: page.id,
      name: page.name,
      title: page.title,
      backgroundVideoUrl: page.background_video_url,
      backgroundThumbnailUrl: page.background_thumbnail_url,
      status: page.status,
      vision: sections.vision || '',
      mission: sections.mission || '',
      team: teamResult.rows,
      totalTeamMembers: teamResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching about page data:', error);
    res.status(500).json({ error: 'Server error' });
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

module.exports = {
  getAboutPageData,
  updateVision,
  updateMission,
  getAllTeamMembers,
  getTeamMember,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
};
