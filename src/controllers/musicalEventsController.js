const db = require('../config/db');
const { deleteFile } = require('../utils/s3');

// Get complete musical events page data
const getMusicalEventsPage = async (req, res) => {
    try {
        const pageResult = await db.query(
            'SELECT id, name, title, background_video_url, background_thumbnail_url, status FROM pages WHERE name = $1',
            ['musicalevents']
        );

        if (pageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Musical events page not found' });
        }

        const page = pageResult.rows[0];
        const pageId = page.id;

        // Get why watch ISBC items
        const whyWatchResult = await db.query(
            `SELECT id, title, image_url, order_index, created_at, updated_at
       FROM why_watch_isbc
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
            whyWatchItems: whyWatchResult.rows,
            totalWhyWatchItems: whyWatchResult.rows.length,
        });
    } catch (error) {
        console.error('Error fetching musical events page:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching musical events page',
        });
    }
};

// ============ WHY WATCH ISBC ENDPOINTS ============

// Get all why watch ISBC items
const getAllWhyWatchItems = async (req, res) => {
    try {
        const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['musicalevents']);
        if (pageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Musical events page not found' });
        }

        const pageId = pageResult.rows[0].id;

        const result = await db.query(
            `SELECT id, title, image_url, order_index, created_at, updated_at
       FROM why_watch_isbc
       WHERE page_id = $1
       ORDER BY order_index ASC, created_at ASC`,
            [pageId]
        );

        res.json({
            success: true,
            whyWatchItems: result.rows,
            total: result.rows.length,
        });
    } catch (error) {
        console.error('Error fetching why watch items:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching why watch items',
        });
    }
};

// Get single why watch item
const getSingleWhyWatchItem = async (req, res) => {
    const { itemId } = req.params;

    try {
        const result = await db.query(
            `SELECT ww.id, ww.title, ww.image_url, ww.order_index, ww.created_at, ww.updated_at, p.name as page_name
       FROM why_watch_isbc ww
       JOIN pages p ON ww.page_id = p.id
       WHERE ww.id = $1`,
            [itemId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Why watch item not found',
            });
        }

        res.json({
            success: true,
            whyWatchItem: result.rows[0],
        });
    } catch (error) {
        console.error('Error fetching why watch item:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching why watch item',
        });
    }
};

// Add new why watch item
const addWhyWatchItem = async (req, res) => {
    const { title, orderIndex } = req.body;

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
        // Get musical events page ID
        const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['musicalevents']);
        if (pageResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Musical events page not found',
            });
        }

        const pageId = pageResult.rows[0].id;

        // Check if we already have 4 items for this page
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM why_watch_isbc WHERE page_id = $1',
            [pageId]
        );

        if (parseInt(countResult.rows[0].count) >= 4) {
            return res.status(400).json({
                success: false,
                error: 'Maximum of 4 why watch items allowed per page',
            });
        }

        // Insert new why watch item
        const result = await db.query(
            `INSERT INTO why_watch_isbc (page_id, title, image_url, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [
                pageId,
                title.trim(),
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
            message: 'Why watch item added successfully. Page saved as draft.',
            whyWatchItem: result.rows[0],
        });
    } catch (error) {
        console.error('Error adding why watch item:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while adding why watch item',
        });
    }
};

// Update why watch item
const updateWhyWatchItem = async (req, res) => {
    const { itemId } = req.params;
    const { title, orderIndex } = req.body;

    // Validation
    if (!title) {
        return res.status(400).json({
            success: false,
            error: 'Title is required',
        });
    }

    try {
        // Get musical events page ID
        const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['musicalevents']);
        if (pageResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Musical events page not found',
            });
        }

        const pageId = pageResult.rows[0].id;

        let updateQuery, updateParams;

        if (req.file) {
            // Get old image URL to delete from S3
            const oldImageResult = await db.query('SELECT image_url FROM why_watch_isbc WHERE id = $1', [
                itemId,
            ]);

            if (oldImageResult.rows.length > 0 && oldImageResult.rows[0].image_url) {
                await deleteFile(oldImageResult.rows[0].image_url);
            }

            // Update with new image
            updateQuery = `
        UPDATE why_watch_isbc
        SET title = $1, image_url = $2, order_index = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *`;
            updateParams = [
                title.trim(),
                req.file.location,
                orderIndex ? parseInt(orderIndex) : 0,
                itemId,
            ];
        } else {
            // Update without changing image
            updateQuery = `
        UPDATE why_watch_isbc
        SET title = $1, order_index = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *`;
            updateParams = [
                title.trim(),
                orderIndex ? parseInt(orderIndex) : 0,
                itemId,
            ];
        }

        const result = await db.query(updateQuery, updateParams);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Why watch item not found',
            });
        }

        // Set page to draft when content is modified
        await db.query(
            "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [pageId]
        );

        res.json({
            success: true,
            message: 'Why watch item updated successfully. Page saved as draft.',
            whyWatchItem: result.rows[0],
        });
    } catch (error) {
        console.error('Error updating why watch item:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while updating why watch item',
        });
    }
};

// Delete why watch item
const deleteWhyWatchItem = async (req, res) => {
    const { itemId } = req.params;

    try {
        // Get musical events page ID
        const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['musicalevents']);
        if (pageResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Musical events page not found',
            });
        }

        const pageId = pageResult.rows[0].id;

        // Get why watch item details to delete image from S3
        const itemResult = await db.query(
            'SELECT title, image_url FROM why_watch_isbc WHERE id = $1',
            [itemId]
        );

        if (itemResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Why watch item not found',
            });
        }

        const itemData = itemResult.rows[0];

        // Delete image from S3
        if (itemData.image_url) {
            await deleteFile(itemData.image_url);
        }

        // Delete from database
        await db.query('DELETE FROM why_watch_isbc WHERE id = $1', [itemId]);

        // Set page to draft when content is modified
        await db.query(
            "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [pageId]
        );

        res.json({
            success: true,
            message: `Why watch item "${itemData.title}" deleted successfully. Page saved as draft.`,
        });
    } catch (error) {
        console.error('Error deleting why watch item:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while deleting why watch item',
        });
    }
};

module.exports = {
    getMusicalEventsPage,
    getAllWhyWatchItems,
    getSingleWhyWatchItem,
    addWhyWatchItem,
    updateWhyWatchItem,
    deleteWhyWatchItem,
};
