const db = require('../config/db');
const { deleteFile } = require('../utils/s3');

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

// const getSinglePartner = async(req, res)=>{
//     const {partnerId} = req.params;
//     try{
//         const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['home']);
//
//         if (pageResult.rows.length === 0) {
//             return res.status(404).json({ error: 'Home page not found' });
//         }
//     }catch (error) {
//         console.error('Error fetching partners:', error);
//         res.status(500).json({ error: 'Server error' });
//
//     }
// }

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

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.status(201).json({
      ...result.rows[0],
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
    // Get page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['home']);
    const pageId = pageResult.rows[0].id;

    let updateQuery, updateParams;

    if (req.file) {
      // Get old logo URL to delete
      const oldLogoResult = await db.query('SELECT logo_url FROM partners WHERE id = $1', [
        partnerId,
      ]);

      if (oldLogoResult.rows.length > 0) {
        await deleteFile(oldLogoResult.rows[0].logo_url);
      }

      updateQuery =
        'UPDATE partners SET name = $1, logo_url = $2, order_index = $3 WHERE id = $4 RETURNING *';
      updateParams = [name, req.file.location, orderIndex || 0, partnerId];
    } else {
      updateQuery = 'UPDATE partners SET name = $1, order_index = $2 WHERE id = $3 RETURNING *';
      updateParams = [name, orderIndex || 0, partnerId];
    }

    const result = await db.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      ...result.rows[0],
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

    // Get logo URL to delete from S3
    const logoResult = await db.query('SELECT logo_url FROM partners WHERE id = $1', [partnerId]);

    if (logoResult.rows.length > 0) {
      await deleteFile(logoResult.rows[0].logo_url);
    }

    // Delete from database
    const result = await db.query('DELETE FROM partners WHERE id = $1 RETURNING *', [partnerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

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
