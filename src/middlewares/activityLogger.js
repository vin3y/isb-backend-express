// src/middlewares/activityLogger.js
const db = require('../config/db'); // Adjust the path as necessary
require('dotenv').config();

// Activity logging utility function
async function logActivity(
  userId,
  actionType,
  entityType,
  entityId,
  entityName,
  description,
  oldData = null,
  newData = null,
  ipAddress = null,
  userAgent = null
) {
  try {
    const query = `
      INSERT INTO activity_log (
        user_id, action_type, entity_type, entity_id, entity_name, 
        description, old_data, new_data, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      userId,
      actionType.toUpperCase(),
      entityType.toLowerCase(),
      entityId,
      entityName,
      description,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      ipAddress,
      userAgent,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error to avoid breaking the main functionality
    return null;
  }
}

// Enhanced middleware factory for different entity types
function createActivityLogger(entityType) {
  return {
    // Log creation (for entities that can be created like awards, team members, etc.)
    logCreate: async (req, entityId, entityName, newData = null) => {
      if (!req.user) return;

      return await logActivity(
        req.user.id,
        'CREATE',
        entityType,
        entityId,
        entityName,
        `Added ${entityType.replace('_', ' ')} "${entityName}"`,
        null,
        newData,
        req.ip,
        req.get('User-Agent')
      );
    },

    // Log update
    logUpdate: async (req, entityId, entityName, oldData = null, newData = null) => {
      if (!req.user) return;

      return await logActivity(
        req.user.id,
        'UPDATE',
        entityType,
        entityId,
        entityName,
        `Updated ${entityType.replace('_', ' ')} "${entityName}"`,
        oldData,
        newData,
        req.ip,
        req.get('User-Agent')
      );
    },

    // Log deletion (only for entities that can be deleted like awards, team members, etc.)
    logDelete: async (req, entityId, entityName, oldData = null) => {
      if (!req.user) return;

      return await logActivity(
        req.user.id,
        'DELETE',
        entityType,
        entityId,
        entityName,
        `Removed ${entityType.replace('_', ' ')} "${entityName}"`,
        oldData,
        null,
        req.ip,
        req.get('User-Agent')
      );
    },

    // Log publish/status changes
    logStatusChange: async (
      req,
      entityId,
      entityName,
      oldStatus,
      newStatus,
      additionalData = null
    ) => {
      if (!req.user) return;

      return await logActivity(
        req.user.id,
        'STATUS_CHANGE',
        entityType,
        entityId,
        entityName,
        `Changed ${entityType.replace(
          '_',
          ' '
        )} "${entityName}" status from ${oldStatus} to ${newStatus}`,
        { status: oldStatus, ...additionalData },
        { status: newStatus, ...additionalData },
        req.ip,
        req.get('User-Agent')
      );
    },

    // Log file uploads
    logFileUpload: async (
      req,
      entityId,
      entityName,
      fileType,
      fileName,
      filePath,
      fileSize = null
    ) => {
      if (!req.user) return;

      return await logActivity(
        req.user.id,
        'FILE_UPLOAD',
        entityType,
        entityId,
        entityName,
        `Uploaded ${fileType.replace('_', ' ')} for ${entityType.replace(
          '_',
          ' '
        )} "${entityName}"`,
        null,
        {
          fileType,
          fileName,
          filePath,
          fileSize: fileSize ? `${Math.round(fileSize / 1024)}KB` : null,
          uploadedAt: new Date().toISOString(),
        },
        req.ip,
        req.get('User-Agent')
      );
    },
  };
}

// Enhanced page content logger with specific methods for different page operations
const pageContentLogger = {
  // Log general content updates
  logContentUpdate: async (
    req,
    pageName,
    sectionType,
    description,
    oldData = null,
    newData = null
  ) => {
    if (!req.user) return;

    return await logActivity(
      req.user.id,
      'CONTENT_UPDATE',
      'page_content',
      null,
      `${pageName} - ${sectionType}`,
      description,
      oldData,
      newData,
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log page title updates specifically
  logTitleUpdate: async (req, pageName, oldTitle, newTitle) => {
    if (!req.user) return;

    return await logActivity(
      req.user.id,
      'TITLE_UPDATE',
      'page',
      null,
      pageName,
      `Updated "${pageName}" page title from "${oldTitle || 'empty'}" to "${newTitle}"`,
      { title: oldTitle },
      { title: newTitle },
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log background video uploads specifically
  logBackgroundVideoUpload: async (req, pageName, oldVideoUrl, newVideoUrl, fileName, fileSize) => {
    if (!req.user) return;

    const description = oldVideoUrl
      ? `Updated background video for "${pageName}" page`
      : `Added background video to "${pageName}" page`;

    return await logActivity(
      req.user.id,
      'BACKGROUND_VIDEO_UPDATE',
      'page',
      null,
      pageName,
      description,
      { background_video_url: oldVideoUrl },
      {
        background_video_url: newVideoUrl,
        video_filename: fileName,
        video_size: fileSize ? `${Math.round(fileSize / (1024 * 1024))}MB` : null,
      },
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log thumbnail generation
  logThumbnailGeneration: async (req, pageName, oldThumbnailUrl, newThumbnailUrl) => {
    if (!req.user) return;

    const description = oldThumbnailUrl
      ? `Updated thumbnail for "${pageName}" page`
      : `Generated thumbnail for "${pageName}" page`;

    return await logActivity(
      req.user.id,
      'THUMBNAIL_UPDATE',
      'page',
      null,
      pageName,
      description,
      { background_thumbnail_url: oldThumbnailUrl },
      { background_thumbnail_url: newThumbnailUrl },
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log page publishing
  logPublish: async (req, pageName, pageTitle) => {
    if (!req.user) return;

    return await logActivity(
      req.user.id,
      'PUBLISH',
      'page',
      null,
      pageName,
      `Published "${pageName}" page`,
      null,
      { page_title: pageTitle, status: 'published' },
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log page status changes
  logStatusChange: async (req, pageName, oldStatus, newStatus) => {
    if (!req.user) return;

    return await logActivity(
      req.user.id,
      'PAGE_STATUS_CHANGE',
      'page',
      null,
      pageName,
      `Changed "${pageName}" page status from ${oldStatus} to ${newStatus}`,
      { status: oldStatus },
      { status: newStatus },
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log page save operations
  logPageSave: async (req, pageName, changedFields, oldData, newData) => {
    if (!req.user) return;

    const fieldsText = changedFields.length > 0 ? changedFields.join(', ') : 'no changes';

    return await logActivity(
      req.user.id,
      'PAGE_SAVE',
      'page',
      null,
      pageName,
      `Saved "${pageName}" page (${fieldsText})`,
      oldData,
      newData,
      req.ip,
      req.get('User-Agent')
    );
  },
};

// Contact activity logger
const contact = {
  // Log contact info creation
  logCreate: async (req, contactId, itemName, newData) => {
    if (!req.user) return;

    return await logActivity(
      req.user.id,
      'CREATE',
      'contact_info',
      contactId,
      itemName,
      `Added contact information for "${itemName}"`,
      null,
      newData,
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log contact info updates
  logUpdate: async (req, contactId, itemName, oldData, newData) => {
    if (!req.user) return;

    // Get changed fields
    const changes = getContactChangedFields(oldData, newData);
    const changedFieldNames = Object.keys(changes);
    const fieldsText = changedFieldNames.length > 0 ? changedFieldNames.join(', ') : 'no changes';

    return await logActivity(
      req.user.id,
      'UPDATE',
      'contact_info',
      contactId,
      itemName,
      `Updated contact information (${fieldsText})`,
      oldData,
      newData,
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log message status updates
  logStatusUpdate: async (req, messageId, messageName, oldStatus, newStatus) => {
    if (!req.user) return;

    return await logActivity(
      req.user.id,
      'STATUS_UPDATE',
      'contact_message',
      messageId,
      messageName,
      `Changed message status from ${oldStatus} to ${newStatus}`,
      { status: oldStatus },
      { status: newStatus, timestamp: new Date().toISOString() },
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log message deletion
  logDelete: async (req, messageId, messageName, messageData) => {
    if (!req.user) return;

    return await logActivity(
      req.user.id,
      'DELETE',
      'contact_message',
      messageId,
      messageName,
      `Deleted message from ${messageData.name}`,
      messageData,
      null,
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log bulk message status updates
  logBulkUpdate: async (req, messageIds, status, updatedMessages) => {
    if (!req.user) return;

    return await logActivity(
      req.user.id,
      'BULK_UPDATE',
      'contact_message',
      null,
      `Bulk Status Update (${messageIds.length} messages)`,
      `Updated ${updatedMessages.length} messages to ${status} status`,
      { message_ids: messageIds, old_status: 'mixed' },
      {
        new_status: status,
        updated_count: updatedMessages.length,
        updated_messages: updatedMessages.map((m) => ({ id: m.id, name: m.name })),
      },
      req.ip,
      req.get('User-Agent')
    );
  },

  // Log public message submissions (no user required)
  logMessageSubmission: async (messageData, ipAddress, userAgent) => {
    try {
      return await logActivity(
        null, // No user for public submissions
        'SUBMIT',
        'contact_message',
        messageData.id,
        `Message from ${messageData.name}`,
        `New contact message submitted by ${messageData.name} (${messageData.email})`,
        null,
        {
          sender_name: messageData.name,
          sender_email: messageData.email,
          subject: messageData.subject,
          submission_time: messageData.created_at,
          message_length: messageData.message?.length || 0,
        },
        ipAddress,
        userAgent
      );
    } catch (error) {
      console.error('Error logging message submission:', error);
      return null;
    }
  },
};

// Helper function to get changed fields between old and new contact data
function getContactChangedFields(oldData, newData) {
  const changes = {};
  const fields = [
    'email',
    'phone',
    'office_location',
    'company_name',
    'address_line_1',
    'address_line_2',
    'city',
    'postal_code',
    'country',
  ];

  fields.forEach((field) => {
    if (oldData[field] !== newData[field]) {
      changes[field] = {
        from: oldData[field] || null,
        to: newData[field] || null,
      };
    }
  });

  return changes;
}

// Pre-defined loggers for your entities
const activityLoggers = {
  page: createActivityLogger('page'),
  award: createActivityLogger('award'),
  teamMember: createActivityLogger('team_member'),
  partner: createActivityLogger('partner'),
  keyOffering: createActivityLogger('key_offering'),
  caseStudy: createActivityLogger('case_study'),
  whyWatch: createActivityLogger('why_watch'),
  standout: createActivityLogger('standout'),
  valuedPartner: createActivityLogger('valued_partner'),
  aboutSection: createActivityLogger('about_section'),

  // Contact logger
  contact: contact,

  // Enhanced page content logger
  pageContent: pageContentLogger,

  // Authentication logger
  auth: {
    logLogin: async (req, success, email, failureReason = null) => {
      const userId = req.user ? req.user.id : null;

      return await logActivity(
        userId,
        'LOGIN',
        'auth',
        null,
        email,
        success
          ? `Successful login for ${email}`
          : `Failed login attempt for ${email}${failureReason ? ': ' + failureReason : ''}`,
        null,
        { success, email, failureReason },
        req.ip,
        req.get('User-Agent')
      );
    },

    logLogout: async (req, email) => {
      if (!req.user) return;

      return await logActivity(
        req.user.id,
        'LOGOUT',
        'auth',
        null,
        email,
        `User ${email} logged out`,
        null,
        { email },
        req.ip,
        req.get('User-Agent')
      );
    },

    logPasswordReset: async (req, email) => {
      if (!req.user) return;

      return await logActivity(
        req.user.id,
        'PASSWORD_RESET',
        'auth',
        null,
        email,
        `Password reset for ${email}`,
        null,
        { email },
        req.ip,
        req.get('User-Agent')
      );
    },
  },
};

// Helper function to get page name from entity type (for mapping activities to pages)
function getPageNameFromEntityType(entityType) {
  const entityToPageMap = {
    award: 'awards',
    team_member: 'about',
    partner: 'home',
    key_offering: 'services',
    case_study: 'services',
    why_watch: 'musicalevents',
    standout: 'politicalevents',
    valued_partner: 'partners',
    about_section: 'about',
    contact_info: 'contact',
    contact_message: 'contact',
    page: null, // Will use actual page name
    auth: 'auth',
  };

  return entityToPageMap[entityType] || 'unknown';
}

// Helper function to format entity type for display
function formatEntityType(entityType) {
  return entityType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// Helper function to format action type for display
function formatActionType(actionType) {
  const actionMap = {
    CREATE: 'Added',
    UPDATE: 'Updated',
    DELETE: 'Removed',
    PUBLISH: 'Published',
    STATUS_CHANGE: 'Status Changed',
    STATUS_UPDATE: 'Status Updated',
    BULK_UPDATE: 'Bulk Updated',
    SUBMIT: 'Submitted',
    FILE_UPLOAD: 'File Uploaded',
    CONTENT_UPDATE: 'Content Updated',
    TITLE_UPDATE: 'Title Updated',
    BACKGROUND_VIDEO_UPDATE: 'Video Updated',
    THUMBNAIL_UPDATE: 'Thumbnail Updated',
    PAGE_STATUS_CHANGE: 'Page Status Changed',
    PAGE_SAVE: 'Page Saved',
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    PASSWORD_RESET: 'Password Reset',
  };

  return actionMap[actionType] || actionType;
}

module.exports = {
  logActivity,
  createActivityLogger,
  activityLoggers,
  getPageNameFromEntityType,
  formatEntityType,
  formatActionType,
};
