const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middlewares/auth');

const getRecentActivities = async (req, res) => {
  try {
    let activities = [];
    try {
      const activityLogQuery = `SELECT 
          al.id,
          al.action_type,
          al.entity_type,
          al.entity_id,
          al.entity_name,
          al.description,
          al.created_at as timestamp,
          u.email as user_email,
          al.ip_address,
          p.name as page_name,
          p.title as page_title
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN pages p ON (
          CASE 
            WHEN al.entity_type = 'page' OR al.entity_type = 'page_content' THEN 
              CASE 
                WHEN al.entity_name ~ '^(home|about|services|awards|musicalevents|politicalevents|partners|contact)' THEN 
                  p.name = SPLIT_PART(al.entity_name, ' ', 1)
                ELSE p.name = al.entity_name
              END
            WHEN al.entity_type = 'award' THEN p.name = 'awards'
            WHEN al.entity_type = 'team_member' OR al.entity_type = 'about_section' THEN p.name = 'about'
            WHEN al.entity_type = 'partner' THEN p.name = 'home'
            WHEN al.entity_type = 'key_offering' OR al.entity_type = 'case_study' THEN p.name = 'services'
            WHEN al.entity_type = 'why_watch' THEN p.name = 'musicalevents'
            WHEN al.entity_type = 'standout' THEN p.name = 'politicalevents'
            WHEN al.entity_type = 'valued_partner' THEN p.name = 'partners'
            ELSE false
          END
        )
        ORDER BY al.created_at DESC
        LIMIT 4`;

      const result = await pool.query(activityLogQuery);
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
            name: row.page_name,
            title: row.page_title || getPageDisplayName(row.page_name),
          },
          source: 'activity_log',
        }));
      }
    } catch (activityLogError) {
      console.log('Activity log table not found, using fallback method');
    }

    // If no activity log data or table doesn't exist, use fallback method
    if (activities.length === 0) {
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

      const fallbackResult = await pool.query(fallbackQuery);
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
          al.ip_address,
          p.name as page_name,
          p.title as page_title
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN pages p ON (
          CASE 
            WHEN al.entity_type = 'page' OR al.entity_type = 'page_content' THEN 
              CASE 
                WHEN al.entity_name ~ '^(home|about|services|awards|musicalevents|politicalevents|partners|contact)' THEN 
                  p.name = SPLIT_PART(al.entity_name, ' ', 1)
                ELSE p.name = al.entity_name
              END
            WHEN al.entity_type = 'award' THEN p.name = 'awards'
            WHEN al.entity_type = 'team_member' OR al.entity_type = 'about_section' THEN p.name = 'about'
            WHEN al.entity_type = 'partner' THEN p.name = 'home'
            WHEN al.entity_type = 'key_offering' OR al.entity_type = 'case_study' THEN p.name = 'services'
            WHEN al.entity_type = 'why_watch' THEN p.name = 'musicalevents'
            WHEN al.entity_type = 'standout' THEN p.name = 'politicalevents'
            WHEN al.entity_type = 'valued_partner' THEN p.name = 'partners'
            ELSE false
          END
        )
        ORDER BY al.created_at DESC
        LIMIT $1
      `;

      const result = await pool.query(activityLogQuery, [limit]);

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
            name: row.page_name,
            title: row.page_title || getPageDisplayName(row.page_name),
          },
          source: 'activity_log',
        }));
      }
    } catch (activityLogError) {
      console.log('Activity log table not found, using fallback method');
    }

    // Fallback method if activity_log doesn't exist
    if (activities.length === 0) {
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
        UNION ALL
        (
          SELECT 
            'content_added' as action_type,
            'award' as entity_type,
            a.id as entity_id,
            CONCAT('Added award "', a.award_name, '"') as description,
            a.award_name as entity_name,
            a.created_at as timestamp,
            'system' as user_email,
            null as ip_address,
            'awards' as page_name,
            'Awards' as page_title
          FROM awards a
          ORDER BY a.created_at DESC
          LIMIT 2
        )
        UNION ALL
        (
          SELECT 
            'content_added' as action_type,
            'team_member' as entity_type,
            tm.id as entity_id,
            CONCAT('Added team member "', tm.name, '"') as description,
            tm.name as entity_name,
            tm.created_at as timestamp,
            'system' as user_email,
            null as ip_address,
            'about' as page_name,
            'About' as page_title
          FROM team_members tm
          ORDER BY tm.created_at DESC
          LIMIT 2
        )
        UNION ALL
        (
          SELECT 
            'content_added' as action_type,
            'partner' as entity_type,
            p.id as entity_id,
            CONCAT('Added partner "', p.name, '"') as description,
            p.name as entity_name,
            p.created_at as timestamp,
            'system' as user_email,
            null as ip_address,
            'home' as page_name,
            'Home' as page_title
          FROM partners p
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        ORDER BY timestamp DESC
        LIMIT $1
      `;

      const fallbackResult = await pool.query(fallbackQuery, [limit]);

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
        al.ip_address,
        p.name as page_name,
        p.title as page_title
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN pages p ON (
        CASE 
          WHEN al.entity_type = 'page' OR al.entity_type = 'page_content' THEN 
            CASE 
              WHEN al.entity_name ~ '^(home|about|services|awards|musicalevents|politicalevents|partners|contact)' THEN 
                p.name = SPLIT_PART(al.entity_name, ' ', 1)
              ELSE p.name = al.entity_name
            END
          WHEN al.entity_type = 'award' THEN p.name = 'awards'
          WHEN al.entity_type = 'team_member' OR al.entity_type = 'about_section' THEN p.name = 'about'
          WHEN al.entity_type = 'partner' THEN p.name = 'home'
          WHEN al.entity_type = 'key_offering' OR al.entity_type = 'case_study' THEN p.name = 'services'
          WHEN al.entity_type = 'why_watch' THEN p.name = 'musicalevents'
          WHEN al.entity_type = 'standout' THEN p.name = 'politicalevents'
          WHEN al.entity_type = 'valued_partner' THEN p.name = 'partners'
          ELSE false
        END
      )
      WHERE p.name = $1
      ORDER BY al.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [pageName, limit]);

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
        name: row.page_name,
        title: row.page_title || getPageDisplayName(row.page_name),
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

    const result = await pool.query(query, [actionType.toUpperCase(), limit]);

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
      pool.query(statsQuery),
      pool.query(totalQuery),
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

    const result = await pool.query(query, values);

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
};
