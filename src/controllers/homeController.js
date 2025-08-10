const db = require('../config/db');
const { deleteFile } = require('../utils/s3');
const { activityLoggers } = require('../middlewares/activityLogger');

const getAllPartners = async (req, res) => {
  try {
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['home']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Home page not found' });
    }

    const pageId = pageResult.rows[0].id;

    // Get all partners for home page
    const partnersResult = await db.query(
      'SELECT * FROM partners WHERE page_id = $1 ORDER BY order_index, created_at',
      [pageId]
    );

    res.json({
      partners: partnersResult.rows,
      total: partnersResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const addPartner = async (req, res) => {
  const { name, orderIndex } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: 'Logo file is required' });
  }
  try {
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['home']);
    const pageId = pageResult.rows[0].id;

    const result = await db.query(
      'INSERT INTO partners (page_id, name, logo_url, order_index) VALUES ($1, $2, $3, $4) RETURNING *',
      [pageId, name, req.file.location, orderIndex || 0]
    );

    const newPartner = result.rows[0];

    // Log the partner creation activity
    await activityLoggers.partner.logCreate(req, newPartner.id, newPartner.name, {
      logo_url: newPartner.logo_url,
      order_index: newPartner.order_index,
    });

    // Log file upload
    await activityLoggers.partner.logFileUpload(
      req,
      newPartner.id,
      newPartner.name,
      'partner_logo',
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
    await activityLoggers.pageContent.logStatusChange(req, 'home', 'published', 'draft');

    res.status(201).json({
      ...newPartner,
      message: 'Partner added. Page saved as draft.',
    });
  } catch (error) {
    console.error('Error adding partner:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update partner
const updatePartner = async (req, res) => {
  const { partnerId } = req.params;
  const { name, orderIndex } = req.body;

  try {
    // Get old data for logging
    const oldDataQuery = 'SELECT * FROM partners WHERE id = $1';
    const oldDataResult = await db.query(oldDataQuery, [partnerId]);
    const oldPartner = oldDataResult.rows[0];

    if (!oldPartner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Get page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['home']);
    const pageId = pageResult.rows[0].id;

    let updateQuery, updateParams;

    if (req.file) {
      // Delete old logo from S3
      if (oldPartner.logo_url) {
        await deleteFile(oldPartner.logo_url);
      }

      updateQuery =
        'UPDATE partners SET name = $1, logo_url = $2, order_index = $3 WHERE id = $4 RETURNING *';
      updateParams = [name, req.file.location, orderIndex || 0, partnerId];
    } else {
      updateQuery = 'UPDATE partners SET name = $1, order_index = $2 WHERE id = $3 RETURNING *';
      updateParams = [name, orderIndex || 0, partnerId];
    }

    const result = await db.query(updateQuery, updateParams);
    const updatedPartner = result.rows[0];

    // Log the update activity
    await activityLoggers.partner.logUpdate(
      req,
      updatedPartner.id,
      updatedPartner.name,
      {
        name: oldPartner.name,
        logo_url: oldPartner.logo_url,
        order_index: oldPartner.order_index,
      },
      {
        name: updatedPartner.name,
        logo_url: updatedPartner.logo_url,
        order_index: updatedPartner.order_index,
      }
    );

    // Log file upload if new logo was uploaded
    if (req.file) {
      await activityLoggers.partner.logFileUpload(
        req,
        updatedPartner.id,
        updatedPartner.name,
        'partner_logo',
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
    await activityLoggers.pageContent.logStatusChange(req, 'home', 'published', 'draft');

    res.json({
      ...updatedPartner,
      message: 'Partner updated. Page saved as draft.',
    });
  } catch (error) {
    console.error('Error updating partner:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete partner
const deletePartner = async (req, res) => {
  const { partnerId } = req.params;

  try {
    // Get page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['home']);
    const pageId = pageResult.rows[0].id;

    // Get partner data before deletion for logging
    const partnerQuery = 'SELECT * FROM partners WHERE id = $1';
    const partnerResult = await db.query(partnerQuery, [partnerId]);
    const partner = partnerResult.rows[0];

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Delete logo from S3
    if (partner.logo_url) {
      await deleteFile(partner.logo_url);
    }

    // Delete from database
    const deleteResult = await db.query('DELETE FROM partners WHERE id = $1 RETURNING *', [
      partnerId,
    ]);

    // Log the deletion activity
    await activityLoggers.partner.logDelete(req, partner.id, partner.name, {
      logo_url: partner.logo_url,
      order_index: partner.order_index,
    });

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change to draft
    await activityLoggers.pageContent.logStatusChange(req, 'home', 'published', 'draft');

    res.json({
      message: 'Partner deleted successfully. Page saved as draft.',
    });
  } catch (error) {
    console.error('Error deleting partner:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  addPartner,
  updatePartner,
  getAllPartners,
  deletePartner,
};
