const db = require('../config/db');

// Get all pages with basic info (only published pages)
const getAllPublicPages = async (req,res)=>{
    try{
        const result =  await db.query(`SELECT 
                id, 
                name, 
                title, 
                background_video_url, 
                background_thumbnail_url, 
                status, 
                updated_at 
            FROM pages 
            WHERE status = 'published' 
            ORDER BY 
                CASE name 
                    WHEN 'home' THEN 1 
                    WHEN 'about' THEN 2 
                    ELSE 3 
                END, 
                name`);

        res.json({
            pages: result.rows,
            total: result.rows.length
        });

    }catch (error) {
        console.error('Error fetching public pages:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Get specific page details (only if published)
const getPublicPageDetails = async (req, res) => {
    const { pageName } = req.params;

    try {
        // Get page data
        const pageResult = await db.query(`
            SELECT 
                id, 
                name, 
                title, 
                background_video_url, 
                background_thumbnail_url, 
                status, 
                updated_at 
            FROM pages 
            WHERE name = $1 AND status = 'published'
        `, [pageName]);

        if (pageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Page not found or not published' });
        }

        const page = pageResult.rows[0];

        // Add page-specific data based on page name
        switch (pageName) {
            case 'home':
                // Fetch partners for home page
                const partnersResult = await db.query(`
                    SELECT 
                        id, 
                        name, 
                        logo_url, 
                        order_index 
                    FROM partners 
                    WHERE page_id = $1 
                    ORDER BY order_index, created_at
                `, [page.id]);
                page.partners = partnersResult.rows;
                break;

            case 'about':
                // Fetch vision and mission sections
                const sectionsResult = await db.query(`
                    SELECT 
                        section_type, 
                        content 
                    FROM about_sections 
                    WHERE page_id = $1
                `, [page.id]);

                // Fetch team members
                const teamResult = await db.query(`
                    SELECT 
                        id, 
                        name, 
                        designation, 
                        photo_url, 
                        order_index 
                    FROM team_members 
                    WHERE page_id = $1 
                    ORDER BY order_index, created_at
                `, [page.id]);

                // Structure the about page data
                page.sections = {};
                sectionsResult.rows.forEach(section => {
                    page.sections[section.section_type] = section.content;
                });
                page.team = teamResult.rows;
                break;

            default:
                // For other pages, no additional data needed
                break;
        }

        res.json(page);
    } catch (error) {
        console.error('Error fetching public page details:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get page background and title data only
const getPageBackground = async (req, res) => {
    const { pageName } = req.params;

    try {
        const result = await db.query(`
            SELECT 
                name, 
                title, 
                background_video_url, 
                background_thumbnail_url 
            FROM pages 
            WHERE name = $1 AND status = 'published'
        `, [pageName]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Page not found or not published' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching page background:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Get all pages background and title data
const getAllPagesBackground = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                name, 
                title, 
                background_video_url, 
                background_thumbnail_url 
            FROM pages 
            WHERE status = 'published' 
            ORDER BY 
                CASE name 
                    WHEN 'home' THEN 1 
                    WHEN 'about' THEN 2 
                    ELSE 3 
                END, 
                name
        `);

        res.json({
            pages: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching pages background data:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports={
    getAllPublicPages,
    getPageBackground,
    getPublicPageDetails,
    getAllPagesBackground
}
