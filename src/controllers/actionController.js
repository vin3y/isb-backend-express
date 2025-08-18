const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const db = require('../config/db');

const getAllActivitiesWithFilters = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Extract filter parameters
    const search = req.query.search || '';
    const actionType = req.query.action_type || '';
    const entityType = req.query.entity_type || '';
    const date = req.query.date || '';
    const user = req.query.user || '';

    // Build WHERE clause dynamically
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(
        al.entity_name ILIKE $${paramIndex} OR 
        al.description ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (actionType) {
      whereConditions.push(`al.action_type = $${paramIndex}`);
      queryParams.push(actionType.toUpperCase());
      paramIndex++;
    }

    if (entityType) {
      whereConditions.push(`al.entity_type = $${paramIndex}`);
      queryParams.push(entityType.toLowerCase());
      paramIndex++;
    }

    if (date) {
      whereConditions.push(`DATE(al.created_at) = $${paramIndex}`);
      queryParams.push(date);
      paramIndex++;
    }

    if (user) {
      whereConditions.push(`u.email ILIKE $${paramIndex}`);
      queryParams.push(`%${user}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Main query with pagination
    const query = `
      SELECT
        al.id,
        al.user_id,
        al.action_type,
        al.entity_type,
        al.entity_id,
        al.entity_name,
        al.description,
        al.old_data,
        al.new_data,
        al.ip_address,
        al.user_agent,
        al.created_at,
        u.email as user_email
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
    `;

    // Filters query to get unique values
    const filtersQuery = `
      SELECT 
        ARRAY_AGG(DISTINCT al.action_type) as action_types,
        ARRAY_AGG(DISTINCT al.entity_type) as entity_types,
        ARRAY_AGG(DISTINCT u.email) FILTER (WHERE u.email IS NOT NULL) as users
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
    `;

    const [activitiesResult, countResult, filtersResult] = await Promise.all([
      db.query(query, queryParams),
      db.query(countQuery, queryParams.slice(0, -2)), // Remove limit and offset for count
      db.query(filtersQuery),
    ]);

    const activities = activitiesResult.rows.map((row) => ({
      id: row.id.toString(),
      user_id: row.user_id,
      action_type: row.action_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_name: row.entity_name,
      description: row.description,
      old_data: row.old_data,
      new_data: row.new_data,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
      time_ago: getTimeAgo(new Date(row.created_at)),
      user_email: row.user_email,
    }));

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    const filters = filtersResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        filters: {
          actionTypes: filters.action_types || [],
          entityTypes: filters.entity_types || [],
          users: filters.users || [],
        },
      },
    });
  } catch (error) {
    console.error('Error fetching filtered activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities',
      error: error.message,
    });
  }
};

const exportActivities = async (req, res) => {
  try {
    // Extract filter parameters (same as getAllActivitiesWithFilters)
    const search = req.query.search || '';
    const actionType = req.query.action_type || '';
    const entityType = req.query.entity_type || '';
    const date = req.query.date || '';
    const user = req.query.user || '';

    // Build WHERE clause dynamically
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(
        al.entity_name ILIKE $${paramIndex} OR 
        al.description ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (actionType) {
      whereConditions.push(`al.action_type = $${paramIndex}`);
      queryParams.push(actionType.toUpperCase());
      paramIndex++;
    }

    if (entityType) {
      whereConditions.push(`al.entity_type = $${paramIndex}`);
      queryParams.push(entityType.toLowerCase());
      paramIndex++;
    }

    if (date) {
      whereConditions.push(`DATE(al.created_at) = $${paramIndex}`);
      queryParams.push(date);
      paramIndex++;
    }

    if (user) {
      whereConditions.push(`u.email ILIKE $${paramIndex}`);
      queryParams.push(`%${user}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        al.id,
        al.action_type,
        al.entity_type,
        al.entity_id,
        al.entity_name,
        al.description,
        al.created_at,
        al.ip_address,
        u.email as user_email
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
    `;

    const result = await db.query(query, queryParams);

    // Create CSV content
    const csvHeader =
      'ID,Action Type,Entity Type,Entity ID,Entity Name,Description,User Email,IP Address,Created At\n';
    const csvContent = result.rows
      .map((row) => {
        return [
          row.id,
          row.action_type,
          row.entity_type,
          row.entity_id,
          `"${row.entity_name || ''}"`,
          `"${row.description || ''}"`,
          row.user_email || '',
          row.ip_address || '',
          row.created_at,
        ].join(',');
      })
      .join('\n');

    const csv = csvHeader + csvContent;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="activity_log_${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.send(csv);
  } catch (error) {
    console.error('Error exporting activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export activities',
      error: error.message,
    });
  }
};

const getRecentActivities = async (req, res) => {
  try {
    let activities = [];

    // Try to get from activity_log table first
    try {
      // Simplified query to test if the issue is with the complex JOIN
      const activityLogQuery = `
        SELECT
          al.id,
          al.action_type,
          al.entity_type,
          al.entity_id,
          al.entity_name,
          al.description,
          al.created_at as timestamp,
          u.email as user_email,
          al.ip_address
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 4
      `;

      console.log('Executing activity log query...');
      const result = await db.query(activityLogQuery);
      console.log(`Found ${result.rows.length} activity log entries`);

      if (result.rows.length > 0) {
        activities = result.rows.map((row) => ({
          id: `activity_${row.id}`,
          action_type: row.action_type,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          entity_name: row.entity_name,
          description: row.description,
          user_email: row.user_email,
          timestamp: row.timestamp,
          time_ago: getTimeAgo(new Date(row.timestamp)),
          page: {
            name: getPageNameFromEntityType(row.entity_type),
            title: getPageDisplayName(getPageNameFromEntityType(row.entity_type)),
          },
          source: 'activity_log',
        }));
      }
    } catch (activityLogError) {
      console.error('Activity log query error:', activityLogError);
      console.log('Activity log table query failed, using fallback method');
    }

    // If no activity log data or table doesn't exist, use fallback method
    if (activities.length === 0) {
      console.log('Using fallback method for recent activities');
      const fallbackQuery = `
        (
          SELECT
            'login' as action_type,
            'auth' as entity_type,
            lh.id as entity_id,
            CASE WHEN lh.success THEN 'User Login Success' ELSE 'User Login Failed' END as description,
            u.email as entity_name,
            lh.login_time as timestamp,
            u.email as user_email,
            lh.ip_address,
            'auth' as page_name,
            'Authentication' as page_title
          FROM login_history lh
          JOIN users u ON lh.user_id = u.id
          ORDER BY lh.login_time DESC
          LIMIT 2
        )
        UNION ALL
        (
          SELECT
            'content_update' as action_type,
            'page' as entity_type,
            p.id as entity_id,
            CONCAT('Updated "', p.name, '" page content') as description,
            COALESCE(p.title, p.name) as entity_name,
            p.updated_at as timestamp,
            'system' as user_email,
            null as ip_address,
            p.name as page_name,
            p.title as page_title
          FROM pages p
          WHERE p.updated_at IS NOT NULL
          ORDER BY p.updated_at DESC
          LIMIT 2
        )
        ORDER BY timestamp DESC
        LIMIT 4
      `;

      const fallbackResult = await db.query(fallbackQuery);
      activities = fallbackResult.rows.map((row) => ({
        id: `${row.action_type}_${row.entity_id}_${Date.parse(row.timestamp)}`,
        action_type: row.action_type,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        entity_name: row.entity_name,
        description: row.description,
        user_email: row.user_email,
        timestamp: row.timestamp,
        time_ago: getTimeAgo(new Date(row.timestamp)),
        page: {
          name: row.page_name,
          title: row.page_title || getPageDisplayName(row.page_name),
        },
        source: 'fallback',
      }));
    }

    res.json({
      success: true,
      data: activities,
      total: activities.length,
      message:
        activities.length === 0
          ? 'No recent activities found'
          : 'Recent activities retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: error.message,
    });
  }
};

const getPaginatedAcitivites = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    let activities = [];

    // Try to get from activity_log table first
    try {
      // Test if table exists first
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'activity_log'
        );
      `;

      const tableResult = await db.query(tableExistsQuery);
      const tableExists = tableResult.rows[0].exists;

      console.log(`Activity log table exists: ${tableExists}`);

      if (tableExists) {
        const activityLogQuery = `
          SELECT
            al.id,
            al.action_type,
            al.entity_type,
            al.entity_id,
            al.entity_name,
            al.description,
            al.created_at as timestamp,
            u.email as user_email,
            al.ip_address
          FROM activity_log al
          LEFT JOIN users u ON al.user_id = u.id
          ORDER BY al.created_at DESC
          LIMIT $1
        `;

        const result = await db.query(activityLogQuery, [limit]);
        console.log(`Retrieved ${result.rows.length} activities from activity_log`);

        if (result.rows.length > 0) {
          activities = result.rows.map((row) => ({
            id: `activity_${row.id}`,
            action_type: row.action_type,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            entity_name: row.entity_name,
            description: row.description,
            user_email: row.user_email,
            timestamp: row.timestamp,
            time_ago: getTimeAgo(new Date(row.timestamp)),
            page: {
              name: getPageNameFromEntityType(row.entity_type),
              title: getPageDisplayName(getPageNameFromEntityType(row.entity_type)),
            },
            source: 'activity_log',
          }));
        }
      }
    } catch (activityLogError) {
      console.error('Activity log query error:', activityLogError);
      console.log('Activity log table query failed, using fallback method');
    }

    // Fallback method if activity_log doesn't exist or has no data
    if (activities.length === 0) {
      console.log('Using fallback method for paginated activities');
      const fallbackQuery = `
        (
          SELECT
            'login' as action_type,
            'auth' as entity_type,
            lh.id as entity_id,
            CASE WHEN lh.success THEN 'User Login Success' ELSE 'User Login Failed' END as description,
            u.email as entity_name,
            lh.login_time as timestamp,
            u.email as user_email,
            lh.ip_address,
            'auth' as page_name,
            'Authentication' as page_title
          FROM login_history lh
          JOIN users u ON lh.user_id = u.id
          ORDER BY lh.login_time DESC
          LIMIT 3
        )
        UNION ALL
        (
          SELECT
            'content_update' as action_type,
            'page' as entity_type,
            p.id as entity_id,
            CONCAT('Updated "', p.name, '" page content') as description,
            COALESCE(p.title, p.name) as entity_name,
            p.updated_at as timestamp,
            'system' as user_email,
            null as ip_address,
            p.name as page_name,
            p.title as page_title
          FROM pages p
          WHERE p.updated_at IS NOT NULL
          ORDER BY p.updated_at DESC
          LIMIT 3
        )
        ORDER BY timestamp DESC
        LIMIT $1
      `;

      try {
        const fallbackResult = await db.query(fallbackQuery, [limit]);
        activities = fallbackResult.rows.map((row) => ({
          id: `${row.action_type}_${row.entity_id}_${Date.parse(row.timestamp)}`,
          action_type: row.action_type,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          entity_name: row.entity_name,
          description: row.description,
          user_email: row.user_email,
          timestamp: row.timestamp,
          time_ago: getTimeAgo(new Date(row.timestamp)),
          page: {
            name: row.page_name,
            title: row.page_title,
          },
          source: 'fallback',
        }));
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        // Return empty activities if both methods fail
        activities = [];
      }
    }

    res.json({
      success: true,
      data: activities,
      total: activities.length,
      message:
        activities.length === 0
          ? 'No recent activities found'
          : 'Recent activities retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: error.message,
    });
  }
};

const getActivitesByPage = async (req, res) => {
  try {
    const { pageName } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    // Simplified query without complex JOINs
    const query = `
      SELECT
        al.id,
        al.action_type,
        al.entity_type,
        al.entity_id,
        al.entity_name,
        al.description,
        al.created_at as timestamp,
        u.email as user_email,
        al.ip_address
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE (
        -- Direct page matches
        (al.entity_type = 'page' AND al.entity_name = $1)
        OR
        -- Entity type to page mapping
        (al.entity_type = 'award' AND $1 = 'awards')
        OR
        (al.entity_type IN ('team_member', 'about_section') AND $1 = 'about')
        OR
        (al.entity_type = 'partner' AND $1 = 'home')
        OR
        (al.entity_type IN ('key_offering', 'case_study') AND $1 = 'services')
        OR
        (al.entity_type = 'why_watch' AND $1 = 'musicalevents')
        OR
        (al.entity_type = 'standout' AND $1 = 'politicalevents')
        OR
        (al.entity_type = 'valued_partner' AND $1 = 'partners')
      )
      ORDER BY al.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [pageName, limit]);
    const activities = result.rows.map((row) => ({
      id: `activity_${row.id}`,
      action_type: row.action_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_name: row.entity_name,
      description: row.description,
      user_email: row.user_email,
      timestamp: row.timestamp,
      time_ago: getTimeAgo(new Date(row.timestamp)),
      page: {
        name: pageName,
        title: getPageDisplayName(pageName),
      },
    }));

    res.json({
      success: true,
      data: activities,
      total: activities.length,
      page_name: pageName,
      page_title: getPageDisplayName(pageName),
    });
  } catch (error) {
    console.error('Error fetching activities by page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities by page',
      error: error.message,
    });
  }
};

const getByActionType = async (req, res) => {
  try {
    const { actionType } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const query = `
      SELECT
        al.id,
        al.action_type,
        al.entity_type,
        al.entity_id,
        al.entity_name,
        al.description,
        al.created_at as timestamp,
        u.email as user_email,
        al.ip_address
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action_type = $1
      ORDER BY al.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [actionType.toUpperCase(), limit]);
    const activities = result.rows.map((row) => ({
      id: `activity_${row.id}`,
      action_type: row.action_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_name: row.entity_name,
      description: row.description,
      user_email: row.user_email,
      timestamp: row.timestamp,
      time_ago: getTimeAgo(new Date(row.timestamp)),
      ip_address: row.ip_address,
    }));

    res.json({
      success: true,
      data: activities,
      total: activities.length,
    });
  } catch (error) {
    console.error('Error fetching actions by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch actions by type',
      error: error.message,
    });
  }
};

const getDetailedStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        action_type,
        entity_type,
        COUNT(*) as count,
        MAX(created_at) as last_activity
      FROM activity_log
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY action_type, entity_type
      ORDER BY count DESC, last_activity DESC
    `;

    const totalQuery = `
      SELECT
        COUNT(*) as total_activities,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT entity_type) as entity_types_affected
      FROM activity_log
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `;

    const [statsResult, totalResult] = await Promise.all([
      db.query(statsQuery),
      db.query(totalQuery),
    ]);

    res.json({
      success: true,
      data: {
        summary: totalResult.rows[0] || {
          total_activities: 0,
          unique_users: 0,
          entity_types_affected: 0,
        },
        breakdown: statsResult.rows.map((row) => ({
          action_type: row.action_type,
          entity_type: row.entity_type,
          count: parseInt(row.count),
          last_activity: row.last_activity,
          time_ago: getTimeAgo(new Date(row.last_activity)),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity statistics',
      error: error.message,
    });
  }
};

const manualLogActivity = async (req, res) => {
  try {
    const { action_type, entity_type, entity_id, entity_name, description, old_data, new_data } =
      req.body;

    const query = `
      INSERT INTO activity_log (
        user_id, action_type, entity_type, entity_id, entity_name,
        description, old_data, new_data, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      req.user.id,
      action_type.toUpperCase(),
      entity_type.toLowerCase(),
      entity_id,
      entity_name,
      description,
      old_data ? JSON.stringify(old_data) : null,
      new_data ? JSON.stringify(new_data) : null,
      req.ip,
      req.get('User-Agent'),
    ];

    const result = await db.query(query, values);

    res.json({
      success: true,
      message: 'Activity logged successfully',
      data: {
        id: result.rows[0].id,
        action_type: result.rows[0].action_type,
        entity_type: result.rows[0].entity_type,
        entity_name: result.rows[0].entity_name,
        timestamp: result.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log activity',
      error: error.message,
    });
  }
};

// Helper function to map entity types to page names
function getPageNameFromEntityType(entityType) {
  const entityToPageMap = {
    award: 'awards',
    team_member: 'about',
    about_section: 'about',
    partner: 'home',
    key_offering: 'services',
    case_study: 'services',
    why_watch: 'musicalevents',
    standout: 'politicalevents',
    valued_partner: 'partners',
    page: 'page',
    auth: 'auth',
  };

  return entityToPageMap[entityType] || 'unknown';
}

function getPageDisplayName(pageName) {
  const pageDisplayNames = {
    home: 'Home',
    about: 'About',
    services: 'Services',
    awards: 'Awards',
    musicalevents: 'Musical Events',
    politicalevents: 'Political Events',
    partners: 'Partners',
    contact: 'Contact',
    auth: 'Authentication',
    unknown: 'Unknown',
  };

  return pageDisplayNames[pageName] || pageName.charAt(0).toUpperCase() + pageName.slice(1);
}

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return date.toLocaleDateString();
}

module.exports = {
  getRecentActivities,
  getPaginatedAcitivites,
  getActivitesByPage,
  getByActionType,
  getDetailedStats,
  manualLogActivity,
  getAllActivitiesWithFilters,
  exportActivities,
};
