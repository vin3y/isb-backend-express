const db = require('../config/db');
const { deleteFile } = require('../utils/s3');

// Get all services page data
const getServicesPage = async (req, res) => {
  try {
    const pageResult = await db.query(
      'SELECT id, name, title, background_video_url, background_thumbnail_url, status FROM pages WHERE name = $1',
      ['services']
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Services page not found' });
    }

    const page = pageResult.rows[0];
    const pageId = page.id;

    // Get key offerings
    const keyOfferingsResult = await db.query(
      `SELECT id, title, description, image_url, order_index, created_at, updated_at
       FROM key_offerings
       WHERE page_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [pageId]
    );

    // Get case studies
    const caseStudiesResult = await db.query(
      `SELECT id, title, description, image_url, order_index, created_at, updated_at
       FROM case_studies
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
      keyOfferings: keyOfferingsResult.rows,
      caseStudies: caseStudiesResult.rows,
      totalKeyOfferings: keyOfferingsResult.rows.length,
      totalCaseStudies: caseStudiesResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching services page:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching services page',
    });
  }
};

// ============ KEY OFFERINGS ENDPOINTS ============

// Get all key offerings
const getAllKeyOfferings = async (req, res) => {
  try {
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['services']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Services page not found' });
    }

    const pageId = pageResult.rows[0].id;

    const result = await db.query(
      `SELECT id, title, description, image_url, order_index, created_at, updated_at
       FROM key_offerings
       WHERE page_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [pageId]
    );

    res.json({
      success: true,
      keyOfferings: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching key offerings:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching key offerings',
    });
  }
};

// Get single key offering
const getSingleKeyOffering = async (req, res) => {
  const { offeringId } = req.params;

  try {
    const result = await db.query(
      `SELECT ko.id, ko.title, ko.description, ko.image_url, ko.order_index, ko.created_at, ko.updated_at, p.name as page_name
       FROM key_offerings ko
       JOIN pages p ON ko.page_id = p.id
       WHERE ko.id = $1`,
      [offeringId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Key offering not found',
      });
    }

    res.json({
      success: true,
      keyOffering: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching key offering:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching key offering',
    });
  }
};

// Add new key offering
const addKeyOffering = async (req, res) => {
  const { title, description, orderIndex } = req.body;

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
    // Get services page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['services']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Services page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Insert new key offering
    const result = await db.query(
      `INSERT INTO key_offerings (page_id, title, description, image_url, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        pageId,
        title.trim(),
        description ? description.trim() : null,
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
      message: 'Key offering added successfully. Page saved as draft.',
      keyOffering: result.rows[0],
    });
  } catch (error) {
    console.error('Error adding key offering:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding key offering',
    });
  }
};

// Update key offering
const updateKeyOffering = async (req, res) => {
  const { offeringId } = req.params;
  const { title, description, orderIndex } = req.body;

  // Validation
  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'Title is required',
    });
  }

  try {
    // Get services page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['services']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Services page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    let updateQuery, updateParams;

    if (req.file) {
      // Get old image URL to delete from S3
      const oldImageResult = await db.query('SELECT image_url FROM key_offerings WHERE id = $1', [
        offeringId,
      ]);

      if (oldImageResult.rows.length > 0 && oldImageResult.rows[0].image_url) {
        await deleteFile(oldImageResult.rows[0].image_url);
      }

      // Update with new image
      updateQuery = `
        UPDATE key_offerings
        SET title = $1, description = $2, image_url = $3, order_index = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *`;
      updateParams = [
        title.trim(),
        description ? description.trim() : null,
        req.file.location,
        orderIndex ? parseInt(orderIndex) : 0,
        offeringId,
      ];
    } else {
      // Update without changing image
      updateQuery = `
        UPDATE key_offerings
        SET title = $1, description = $2, order_index = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *`;
      updateParams = [
        title.trim(),
        description ? description.trim() : null,
        orderIndex ? parseInt(orderIndex) : 0,
        offeringId,
      ];
    }

    const result = await db.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Key offering not found',
      });
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      success: true,
      message: 'Key offering updated successfully. Page saved as draft.',
      keyOffering: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating key offering:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating key offering',
    });
  }
};

// Delete key offering
const deleteKeyOffering = async (req, res) => {
  const { offeringId } = req.params;

  try {
    // Get services page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['services']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Services page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Get key offering details to delete image from S3
    const offeringResult = await db.query(
      'SELECT title, image_url FROM key_offerings WHERE id = $1',
      [offeringId]
    );

    if (offeringResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Key offering not found',
      });
    }

    const offeringData = offeringResult.rows[0];

    // Delete image from S3
    if (offeringData.image_url) {
      await deleteFile(offeringData.image_url);
    }

    // Delete from database
    await db.query('DELETE FROM key_offerings WHERE id = $1', [offeringId]);

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      success: true,
      message: `Key offering "${offeringData.title}" deleted successfully. Page saved as draft.`,
    });
  } catch (error) {
    console.error('Error deleting key offering:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting key offering',
    });
  }
};

// ============ CASE STUDIES ENDPOINTS ============

// Get all case studies
const getAllCaseStudies = async (req, res) => {
  try {
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['services']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Services page not found' });
    }

    const pageId = pageResult.rows[0].id;

    const result = await db.query(
      `SELECT id, title, description, image_url, order_index, created_at, updated_at
       FROM case_studies
       WHERE page_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [pageId]
    );

    res.json({
      success: true,
      caseStudies: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching case studies:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching case studies',
    });
  }
};

// Get single case study
const getSingleCaseStudy = async (req, res) => {
  const { studyId } = req.params;

  try {
    const result = await db.query(
      `SELECT cs.id, cs.title, cs.description, cs.image_url, cs.order_index, cs.created_at, cs.updated_at, p.name as page_name
       FROM case_studies cs
       JOIN pages p ON cs.page_id = p.id
       WHERE cs.id = $1`,
      [studyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Case study not found',
      });
    }

    res.json({
      success: true,
      caseStudy: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching case study:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching case study',
    });
  }
};

// Add new case study
const addCaseStudy = async (req, res) => {
  const { title, description, orderIndex } = req.body;

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
    // Get services page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['services']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Services page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Insert new case study
    const result = await db.query(
      `INSERT INTO case_studies (page_id, title, description, image_url, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        pageId,
        title.trim(),
        description ? description.trim() : null,
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
      message: 'Case study added successfully. Page saved as draft.',
      caseStudy: result.rows[0],
    });
  } catch (error) {
    console.error('Error adding case study:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding case study',
    });
  }
};

// Update case study
const updateCaseStudy = async (req, res) => {
  const { studyId } = req.params;
  const { title, description, orderIndex } = req.body;

  // Validation
  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'Title is required',
    });
  }

  try {
    // Get services page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['services']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Services page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    let updateQuery, updateParams;

    if (req.file) {
      // Get old image URL to delete from S3
      const oldImageResult = await db.query('SELECT image_url FROM case_studies WHERE id = $1', [
        studyId,
      ]);

      if (oldImageResult.rows.length > 0 && oldImageResult.rows[0].image_url) {
        await deleteFile(oldImageResult.rows[0].image_url);
      }

      // Update with new image
      updateQuery = `
        UPDATE case_studies
        SET title = $1, description = $2, image_url = $3, order_index = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *`;
      updateParams = [
        title.trim(),
        description ? description.trim() : null,
        req.file.location,
        orderIndex ? parseInt(orderIndex) : 0,
        studyId,
      ];
    } else {
      // Update without changing image
      updateQuery = `
        UPDATE case_studies
        SET title = $1, description = $2, order_index = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *`;
      updateParams = [
        title.trim(),
        description ? description.trim() : null,
        orderIndex ? parseInt(orderIndex) : 0,
        studyId,
      ];
    }

    const result = await db.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Case study not found',
      });
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      success: true,
      message: 'Case study updated successfully. Page saved as draft.',
      caseStudy: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating case study:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating case study',
    });
  }
};

// Delete case study
const deleteCaseStudy = async (req, res) => {
  const { studyId } = req.params;

  try {
    // Get services page ID
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['services']);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Services page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Get case study details to delete image from S3
    const studyResult = await db.query('SELECT title, image_url FROM case_studies WHERE id = $1', [
      studyId,
    ]);

    if (studyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Case study not found',
      });
    }

    const studyData = studyResult.rows[0];

    // Delete image from S3
    if (studyData.image_url) {
      await deleteFile(studyData.image_url);
    }

    // Delete from database
    await db.query('DELETE FROM case_studies WHERE id = $1', [studyId]);

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    res.json({
      success: true,
      message: `Case study "${studyData.title}" deleted successfully. Page saved as draft.`,
    });
  } catch (error) {
    console.error('Error deleting case study:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting case study',
    });
  }
};

module.exports = {
  getServicesPage,
  getAllKeyOfferings,
  getSingleKeyOffering,
  addKeyOffering,
  updateKeyOffering,
  deleteKeyOffering,
  getAllCaseStudies,
  getSingleCaseStudy,
  addCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
};
