const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const router = require('../routes');

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
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Vision content is required' });
  }

  try {
    // Get about page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['about']);
    const pageId = pageResult.rows[0].id;

    // Update or insert vision
    const result = await db.query(
      `INSERT INTO about_sections (page_id, section_type, content)
             VALUES ($1, 'vision', $2)
             ON CONFLICT (page_id, section_type)
             DO UPDATE SET content = $2, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
      [pageId, content]
    );

    // Set page to draft
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      ...result.rows[0],
      message: 'Vision updated successfully. Page saved as draft.',
    });
  } catch (error) {
    console.error('Error updating vision:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update mission section
const updateMission = async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Mission content is required' });
  }

  try {
    // Get about page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['about']);
    const pageId = pageResult.rows[0].id;

    // Update or insert mission
    const result = await db.query(
      `INSERT INTO about_sections (page_id, section_type, content)
             VALUES ($1, 'mission', $2)
             ON CONFLICT (page_id, section_type)
             DO UPDATE SET content = $2, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
      [pageId, content]
    );

    // Set page to draft
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      ...result.rows[0],
      message: 'Mission updated successfully. Page saved as draft.',
    });
  } catch (error) {
    console.error('Error updating mission:', error);
    res.status(500).json({ error: 'Server error' });
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
  const { name, designation, orderIndex } = req.body;

  if (!name || !designation) {
    return res.status(400).json({ error: 'Name and designation are required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Photo is required' });
  }

  try {
    // Get about page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['about']);
    const pageId = pageResult.rows[0].id;

    // Insert team member
    const result = await db.query(
      `INSERT INTO team_members (page_id, name, designation, photo_url, order_index)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
      [pageId, name, designation, req.file.location, orderIndex || 0]
    );

    // Set page to draft
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.status(201).json({
      ...result.rows[0],
      message: 'Team member added successfully. Page saved as draft.',
    });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update team member
const updateTeamMember = async (req, res) => {
  const { memberId } = req.params;
  const { name, designation, orderIndex } = req.body;

  try {
    // Get about page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['about']);
    const pageId = pageResult.rows[0].id;

    let updateQuery, updateParams;

    if (req.file) {
      // Get old photo URL to delete
      const oldPhotoResult = await db.query('SELECT photo_url FROM team_members WHERE id = $1', [
        memberId,
      ]);

      if (oldPhotoResult.rows.length > 0 && oldPhotoResult.rows[0].photo_url) {
        await deleteFile(oldPhotoResult.rows[0].photo_url);
      }

      updateQuery = `UPDATE team_members 
                          SET name = $1, designation = $2, photo_url = $3, order_index = $4, updated_at = CURRENT_TIMESTAMP
                          WHERE id = $5 RETURNING *`;
      updateParams = [name, designation, req.file.location, orderIndex || 0, memberId];
    } else {
      updateQuery = `UPDATE team_members 
                          SET name = $1, designation = $2, order_index = $3, updated_at = CURRENT_TIMESTAMP
                          WHERE id = $4 RETURNING *`;
      updateParams = [name, designation, orderIndex || 0, memberId];
    }

    const result = await db.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Set page to draft
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      ...result.rows[0],
      message: 'Team member updated successfully. Page saved as draft.',
    });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete team member
const deleteTeamMember = async (req, res) => {
  const { memberId } = req.params;

  try {
    // Get about page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['about']);
    const pageId = pageResult.rows[0].id;

    // Get photo URL to delete from S3
    const photoResult = await db.query('SELECT photo_url FROM team_members WHERE id = $1', [
      memberId,
    ]);

    if (photoResult.rows.length > 0 && photoResult.rows[0].photo_url) {
      await deleteFile(photoResult.rows[0].photo_url);
    }

    // Delete from database
    const result = await db.query('DELETE FROM team_members WHERE id = $1 RETURNING *', [memberId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Set page to draft
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      message: 'Team member deleted successfully. Page saved as draft.',
    });
  } catch (error) {
    console.error('Error deleting team member:', error);
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
};
