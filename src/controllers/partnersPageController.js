const db = require('../config/db');

// Get complete partners page data
const getPartnersPage = async (req, res) => {
    try {
        const pageResult = await db.query(
            'SELECT id, name, title, background_video_url, background_thumbnail_url, status FROM pages WHERE name = $1',
            ['partners']
        );

        if (pageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Partners page not found' });
        }

        const page = pageResult.rows[0];
        const pageId = page.id;

        // Get valued partners
        const valuedPartnersResult = await db.query(
            `SELECT id, event_name, event_year, short_description, order_index, created_at, updated_at
       FROM valued_partners
       WHERE page_id = $1
       ORDER BY event_year DESC, order_index ASC, created_at DESC`,
            [pageId]
        );

        // Get unique years for filtering
        const yearsResult = await db.query(
            `SELECT DISTINCT event_year, COUNT(*) as event_count
       FROM valued_partners
       WHERE page_id = $1
       GROUP BY event_year
       ORDER BY event_year DESC`,
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
            valuedPartners: valuedPartnersResult.rows,
            totalValuedPartners: valuedPartnersResult.rows.length,
            years: yearsResult.rows,
        });
    } catch (error) {
        console.error('Error fetching partners page:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching partners page',
        });
    }
};

// ============ VALUED PARTNERS ENDPOINTS ============

// Get all valued partners
const getAllValuedPartners = async (req, res) => {
    try {
        const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['partners']);
        if (pageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Partners page not found' });
        }

        const pageId = pageResult.rows[0].id;

        const result = await db.query(
            `SELECT id, event_name, event_year, short_description, order_index, created_at, updated_at
       FROM valued_partners
       WHERE page_id = $1
       ORDER BY event_year DESC, order_index ASC, created_at DESC`,
            [pageId]
        );

        res.json({
            success: true,
            valuedPartners: result.rows,
            total: result.rows.length,
        });
    } catch (error) {
        console.error('Error fetching valued partners:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching valued partners',
        });
    }
};

// Get single valued partner
const getSingleValuedPartner = async (req, res) => {
    const { partnerId } = req.params;

    try {
        const result = await db.query(
            `SELECT vp.id, vp.event_name, vp.event_year, vp.short_description, vp.order_index, 
              vp.created_at, vp.updated_at, p.name as page_name
       FROM valued_partners vp
       JOIN pages p ON vp.page_id = p.id
       WHERE vp.id = $1`,
            [partnerId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Valued partner not found',
            });
        }

        res.json({
            success: true,
            valuedPartner: result.rows[0],
        });
    } catch (error) {
        console.error('Error fetching valued partner:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching valued partner',
        });
    }
};

// Add new valued partner
const addValuedPartner = async (req, res) => {
    const { eventName, eventYear, shortDescription, orderIndex } = req.body;

    // Validation
    if (!eventName) {
        return res.status(400).json({
            success: false,
            error: 'Event name is required',
        });
    }

    if (!eventYear) {
        return res.status(400).json({
            success: false,
            error: 'Event year is required',
        });
    }

    // Validate year
    const year = parseInt(eventYear);
    if (isNaN(year) || year < 1900 || year > 2100) {
        return res.status(400).json({
            success: false,
            error: 'Event year must be between 1900 and 2100',
        });
    }

    try {
        // Get partners page ID
        const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['partners']);
        if (pageResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Partners page not found',
            });
        }

        const pageId = pageResult.rows[0].id;

        // Insert new valued partner
        const result = await db.query(
            `INSERT INTO valued_partners (page_id, event_name, event_year, short_description, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [
                pageId,
                eventName.trim(),
                year,
                shortDescription ? shortDescription.trim() : null,
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
            message: 'Valued partner added successfully. Page saved as draft.',
            valuedPartner: result.rows[0],
        });
    } catch (error) {
        console.error('Error adding valued partner:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while adding valued partner',
        });
    }
};

// Update valued partner
const updateValuedPartner = async (req, res) => {
    const { partnerId } = req.params;
    const { eventName, eventYear, shortDescription, orderIndex } = req.body;

    // Validation
    if (!eventName) {
        return res.status(400).json({
            success: false,
            error: 'Event name is required',
        });
    }

    if (!eventYear) {
        return res.status(400).json({
            success: false,
            error: 'Event year is required',
        });
    }

    // Validate year
    const year = parseInt(eventYear);
    if (isNaN(year) || year < 1900 || year > 2100) {
        return res.status(400).json({
            success: false,
            error: 'Event year must be between 1900 and 2100',
        });
    }

    try {
        // Get partners page ID
        const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['partners']);
        if (pageResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Partners page not found',
            });
        }

        const pageId = pageResult.rows[0].id;

        // Update valued partner
        const result = await db.query(
            `UPDATE valued_partners
       SET event_name = $1, event_year = $2, short_description = $3, order_index = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
            [
                eventName.trim(),
                year,
                shortDescription ? shortDescription.trim() : null,
                orderIndex ? parseInt(orderIndex) : 0,
                partnerId,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Valued partner not found',
            });
        }

        // Set page to draft when content is modified
        await db.query(
            "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [pageId]
        );

        res.json({
            success: true,
            message: 'Valued partner updated successfully. Page saved as draft.',
            valuedPartner: result.rows[0],
        });
    } catch (error) {
        console.error('Error updating valued partner:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while updating valued partner',
        });
    }
};

// Delete valued partner
const deleteValuedPartner = async (req, res) => {
    const { partnerId } = req.params;

    try {
        // Get partners page ID
        const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['partners']);
        if (pageResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Partners page not found',
            });
        }

        const pageId = pageResult.rows[0].id;

        // Get valued partner details before deletion
        const partnerResult = await db.query(
            'SELECT event_name FROM valued_partners WHERE id = $1',
            [partnerId]
        );

        if (partnerResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Valued partner not found',
            });
        }

        const partnerData = partnerResult.rows[0];

        // Delete from database
        await db.query('DELETE FROM valued_partners WHERE id = $1', [partnerId]);

        // Set page to draft when content is modified
        await db.query(
            "UPDATE pages SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [pageId]
        );

        res.json({
            success: true,
            message: `Valued partner "${partnerData.event_name}" deleted successfully. Page saved as draft.`,
        });
    } catch (error) {
        console.error('Error deleting valued partner:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while deleting valued partner',
        });
    }
};

// Get valued partners by year
const getValuedPartnersByYear = async (req, res) => {
    const { year } = req.params;

    // Validate year
    const eventYear = parseInt(year);
    if (isNaN(eventYear) || eventYear < 1900 || eventYear > 2100) {
        return res.status(400).json({
            success: false,
            error: 'Invalid year parameter',
        });
    }

    try {
        // Get partners page ID
        const pageResult = await db.query('SELECT id FROM pages WHERE name = $1', ['partners']);
        if (pageResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Partners page not found',
            });
        }

        const pageId = pageResult.rows[0].id;

        const result = await db.query(
            `SELECT id, event_name, event_year, short_description, order_index, created_at, updated_at
       FROM valued_partners
       WHERE page_id = $1 AND event_year = $2
       ORDER BY order_index ASC, created_at DESC`,
            [pageId, eventYear]
        );

        res.json({
            success: true,
            valuedPartners: result.rows,
            year: eventYear,
            total: result.rows.length,
        });
    } catch (error) {
        console.error('Error fetching valued partners by year:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching valued partners by year',
        });
    }
};

module.exports = {
    getPartnersPage,
    getAllValuedPartners,
    getSingleValuedPartner,
    addValuedPartner,
    updateValuedPartner,
    deleteValuedPartner,
    getValuedPartnersByYear,
};
