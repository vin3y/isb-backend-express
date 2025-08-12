// src/middlewares/activityLogger.js
const { pool } = require('../config/db'); // Adjust the path as necessary
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

    const result = await pool.query(query, values);
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
        `Changed ${entityType.replace('_', ' ')} "${entityName}" status from ${oldStatus} to ${newStatus}`,
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
        `Uploaded ${fileType.replace('_', ' ')} for ${entityType.replace('_', ' ')} "${entityName}"`,
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
