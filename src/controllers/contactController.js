const db = require('../config/db');
const { activityLoggers } = require('../middlewares/activityLogger');

// Get contact page with all information and messages
const getContactPage = async (req, res) => {
  try {
    const pageResult = await db.query(
      'SELECT id, name, title, background_video_url, background_thumbnail_url, status FROM pages WHERE name = $1',
      ['contact']
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact page not found',
      });
    }

    const page = pageResult.rows[0];
    const pageId = page.id;

    // Get contact information
    const contactInfoResult = await db.query(`SELECT * FROM contact_info WHERE page_id = $1`, [
      pageId,
    ]);

    // Get contact messages with pagination
    const page_num = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page_num - 1) * limit;
    const status = req.query.status; // 'contacted', 'acknowledged', or undefined for all

    let messagesQuery = `
      SELECT 
        id, name, email, subject, message, status, 
        created_at, acknowledged_at, ip_address
      FROM contact_messages
    `;
    let countQuery = `SELECT COUNT(*) FROM contact_messages`;
    let queryParams = [];

    if (status) {
      messagesQuery += ` WHERE status = $1`;
      countQuery += ` WHERE status = $1`;
      queryParams.push(status);
    }

    messagesQuery += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${
      queryParams.length + 2
    }`;
    queryParams.push(limit, offset);

    const messagesResult = await db.query(messagesQuery, queryParams);

    const countParams = status ? [status] : [];
    const totalResult = await db.query(countQuery, countParams);
    const total = parseInt(totalResult.rows[0].count);

    // Get status counts
    const statusCountsResult = await db.query(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM contact_messages 
      GROUP BY status
    `);

    const statusCounts = {
      contacted: 0,
      acknowledged: 0,
    };

    statusCountsResult.rows.forEach((row) => {
      statusCounts[row.status] = parseInt(row.count);
    });

    res.json({
      success: true,
      id: page.id,
      name: page.name,
      title: page.title,
      backgroundVideoUrl: page.background_video_url,
      backgroundThumbnailUrl: page.background_thumbnail_url,
      status: page.status,
      contactInfo: contactInfoResult.rows[0] || null,
      messages: messagesResult.rows,
      pagination: {
        page: page_num,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts,
      totalMessages: messagesResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching contact page:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching contact page',
    });
  }
};

// Get contact information only
const getContactInfo = async (req, res) => {
  try {
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['contact']);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    const contactInfoResult = await db.query(`SELECT * FROM contact_info WHERE page_id = $1`, [
      pageId,
    ]);

    if (contactInfoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact information not found',
      });
    }

    res.json({
      success: true,
      contactInfo: contactInfoResult.rows[0],
    });
  } catch (error) {
    console.error('Error fetching contact info:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching contact information',
    });
  }
};

// Update contact information
const updateContactInfo = async (req, res) => {
  const {
    email,
    phone,
    office_location,
    company_name,
    address_line_1,
    address_line_2,
    city,
    postal_code,
    country,
  } = req.body;

  // Validation
  if (
    !email ||
    !phone ||
    !office_location ||
    !company_name ||
    !address_line_1 ||
    !city ||
    !country
  ) {
    return res.status(400).json({
      success: false,
      error:
        'Required fields: email, phone, office_location, company_name, address_line_1, city, country',
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address',
    });
  }

  try {
    // Get contact page
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['contact']);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact page not found',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Check if contact info exists
    const existingResult = await db.query('SELECT * FROM contact_info WHERE page_id = $1', [
      pageId,
    ]);

    let result;
    let isUpdate = false;

    if (existingResult.rows.length === 0) {
      // Create new contact info
      result = await db.query(
        `INSERT INTO contact_info 
         (page_id, email, phone, office_location, company_name, address_line_1, address_line_2, city, postal_code, country)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          pageId,
          email,
          phone,
          office_location,
          company_name,
          address_line_1,
          address_line_2,
          city,
          postal_code,
          country,
        ]
      );

      // Log creation activity
      await activityLoggers.contact?.logCreate?.(req, result.rows[0].id, 'Contact Information', {
        email,
        phone,
        office_location,
        company_name,
        address_line_1,
        address_line_2,
        city,
        postal_code,
        country,
      });
    } else {
      // Update existing contact info
      isUpdate = true;
      const oldData = existingResult.rows[0];

      result = await db.query(
        `UPDATE contact_info 
         SET email = $2, phone = $3, office_location = $4, company_name = $5, 
             address_line_1 = $6, address_line_2 = $7, city = $8, postal_code = $9, 
             country = $10, updated_at = CURRENT_TIMESTAMP
         WHERE page_id = $1
         RETURNING *`,
        [
          pageId,
          email,
          phone,
          office_location,
          company_name,
          address_line_1,
          address_line_2,
          city,
          postal_code,
          country,
        ]
      );

      // Log update activity
      await activityLoggers.contact?.logUpdate?.(
        req,
        result.rows[0].id,
        'Contact Information',
        oldData,
        result.rows[0]
      );
    }

    // Set page to draft when content is modified
    await db.query(
      "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [pageId]
    );

    // Log page status change to draft
    await activityLoggers.pageContent?.logStatusChange?.(req, 'contact', 'published', 'draft');

    res.json({
      success: true,
      message: `Contact information ${
        isUpdate ? 'updated' : 'created'
      } successfully. Page saved as draft.`,
      contactInfo: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating contact info:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating contact information',
    });
  }
};

// Get single message by ID
const getSingleMessage = async (req, res) => {
  const { messageId } = req.params;

  try {
    const messageResult = await db.query(
      `SELECT 
        id, name, email, subject, message, status, 
        created_at, acknowledged_at, ip_address, user_agent
       FROM contact_messages 
       WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    res.json({
      success: true,
      message: messageResult.rows[0],
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching message',
    });
  }
};

// Update message status
const updateMessageStatus = async (req, res) => {
  const { messageId } = req.params;
  const { status } = req.body;

  if (!status || !['contacted', 'acknowledged'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Status must be either "contacted" or "acknowledged"',
    });
  }

  try {
    // Get old message data for logging
    const oldMessageResult = await db.query('SELECT * FROM contact_messages WHERE id = $1', [
      messageId,
    ]);
    if (oldMessageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    const oldMessage = oldMessageResult.rows[0];

    const acknowledgedAt = status === 'acknowledged' ? 'CURRENT_TIMESTAMP' : 'NULL';

    const result = await db.query(
      `UPDATE contact_messages 
       SET status = $1, acknowledged_at = ${acknowledgedAt}
       WHERE id = $2
       RETURNING *`,
      [status, messageId]
    );

    const updatedMessage = result.rows[0];

    // Log the status update activity
    await activityLoggers.contact?.logStatusUpdate?.(
      req,
      updatedMessage.id,
      `Message from ${updatedMessage.name}`,
      oldMessage.status,
      updatedMessage.status
    );

    res.json({
      success: true,
      message: `Message status updated to ${status} successfully`,
      contactMessage: updatedMessage,
    });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating message status',
    });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  const { messageId } = req.params;

  try {
    // Get message details for logging
    const messageResult = await db.query('SELECT * FROM contact_messages WHERE id = $1', [
      messageId,
    ]);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    const messageData = messageResult.rows[0];

    // Delete from database
    const deleteResult = await db.query('DELETE FROM contact_messages WHERE id = $1 RETURNING id', [
      messageId,
    ]);

    // Log the deletion activity
    await activityLoggers.contact?.logDelete?.(
      req,
      messageData.id,
      `Message from ${messageData.name}`,
      {
        name: messageData.name,
        email: messageData.email,
        subject: messageData.subject,
        message: messageData.message,
        status: messageData.status,
        created_at: messageData.created_at,
      }
    );

    res.json({
      success: true,
      message: `Message from "${messageData.name}" deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting message',
    });
  }
};

// Bulk update message statuses
const bulkUpdateMessageStatus = async (req, res) => {
  const { messageIds, status } = req.body;

  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'messageIds must be a non-empty array',
    });
  }

  if (!status || !['contacted', 'acknowledged'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Status must be either "contacted" or "acknowledged"',
    });
  }

  try {
    const acknowledgedAt = status === 'acknowledged' ? 'CURRENT_TIMESTAMP' : 'NULL';
    const placeholders = messageIds.map((_, index) => `$${index + 2}`).join(',');

    const result = await db.query(
      `UPDATE contact_messages 
       SET status = $1, acknowledged_at = ${acknowledgedAt}
       WHERE id IN (${placeholders})
       RETURNING id, name, status`,
      [status, ...messageIds]
    );

    // Log bulk update activity
    await activityLoggers.contact?.logBulkUpdate?.(req, messageIds, status, result.rows);

    res.json({
      success: true,
      message: `${result.rows.length} messages updated to ${status} successfully`,
      updatedCount: result.rows.length,
      updated: result.rows,
    });
  } catch (error) {
    console.error('Error bulk updating messages:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating messages',
    });
  }
};

// Get messages by status
const getMessagesByStatus = async (req, res) => {
  const { status } = req.params;

  if (!['contacted', 'acknowledged'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Status must be either "contacted" or "acknowledged"',
    });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const messagesResult = await db.query(
      `SELECT 
        id, name, email, subject, message, status, 
        created_at, acknowledged_at, ip_address
       FROM contact_messages 
       WHERE status = $1
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    const totalResult = await db.query(`SELECT COUNT(*) FROM contact_messages WHERE status = $1`, [
      status,
    ]);
    const total = parseInt(totalResult.rows[0].count);

    res.json({
      success: true,
      messages: messagesResult.rows,
      status: status,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      total: messagesResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching messages by status:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching messages by status',
    });
  }
};

// Get message statistics
const getMessageStats = async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        DATE_TRUNC('day', created_at) as date
      FROM contact_messages 
      GROUP BY status, DATE_TRUNC('day', created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    const totalResult = await db.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_count,
        COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_count
      FROM contact_messages
    `);

    res.json({
      success: true,
      dailyStats: statsResult.rows,
      summary: totalResult.rows[0],
    });
  } catch (error) {
    console.error('Error fetching message stats:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching message statistics',
    });
  }
};

module.exports = {
  getContactPage,
  getContactInfo,
  updateContactInfo,
  getSingleMessage,
  updateMessageStatus,
  deleteMessage,
  bulkUpdateMessageStatus,
  getMessagesByStatus,
  getMessageStats,
};
