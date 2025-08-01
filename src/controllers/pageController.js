const db = require('../config/db');
const {deleteFile} = require("../utils/s3");
const {generateThumbnail, deleteThumbnail, generateThumbnailFromUrl} = require("../services/thumbanailServices");


const getAllPages = async(req, res)=>{
    try{
        const result = await db.query('SELECT id, name, title, status, background_thumbnail_url, updated_at FROM pages ORDER BY id');
        res.json(result.rows);

    }catch (error) {
        console.error('Error fetching pages:', error);
        res.status(500).json({ error: 'Server error' });
    }
}


// Get specific page details
const getPageDetails = async (req, res) => {
    const { pageName } = req.params;

    try {
        const pageResult = await db.query(
            'SELECT * FROM pages WHERE name = $1',
            [pageName]
        );

        if (pageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }

        const page = pageResult.rows[0];

        // If it's the home page, also fetch partners
        if (pageName === 'home') {
            const partnersResult = await db.query(
                'SELECT * FROM partners WHERE page_id = $1 ORDER BY order_index',
                [page.id]
            );
            page.partners = partnersResult.rows;
        }

        res.json(page);
    } catch (error) {
        console.error('Error fetching page:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Save page as draft
const savePage = async (req, res) => {
    const { pageName } = req.params;
    const { title } = req.body;

    try {
        const result = await db.query(
            `UPDATE pages 
       SET title = $1, status = 'draft', updated_at = CURRENT_TIMESTAMP 
       WHERE name = $2 
       RETURNING *`,
            [title, pageName]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }

        res.json({
            ...result.rows[0],
            message: 'Page saved as draft'
        });
    } catch (error) {
        console.error('Error saving page:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Publish page
const publishPage = async (req, res) => {
    const { pageName } = req.params;
    const { title } = req.body;

    try {
        let query, params;
        if (title !== undefined) {
            query = `UPDATE pages 
               SET title = $1, status = 'published', updated_at = CURRENT_TIMESTAMP 
               WHERE name = $2 
               RETURNING *`;
            params = [title, pageName];
        } else {
            query = `UPDATE pages 
               SET status = 'published', updated_at = CURRENT_TIMESTAMP 
               WHERE name = $1 
               RETURNING *`;
            params = [pageName];
        }

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }

        res.json({
            ...result.rows[0],
            message: 'Page published successfully'
        });
    } catch (error) {
        console.error('Error publishing page:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update page status
const updatePageStatus = async (req, res) => {
    const { pageName } = req.params;
    const { status } = req.body;

    if (!['draft', 'published'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const result = await db.query(
            'UPDATE pages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
            [status, pageName]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating page status:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Update page title
const updatePageTitle = async (req, res) => {
    const { pageName } = req.params;
    const { title } = req.body;

    try {
        const result = await db.query(
            'UPDATE pages SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
            [title, pageName]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating page title:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Upload background video
const uploadBackgroundVideo = async (req, res) => {
    const { pageName } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
    }
    try {
        // Get the old video and thumbnail URLs to delete them
        const oldDataResult = await db.query(
            'SELECT background_video_url, background_thumbnail_url FROM pages WHERE name = $1',
            [pageName]
        );

        // Generate thumbnail for the new video
        let thumbnailUrl;
        try {
            thumbnailUrl = await generateThumbnail(req.file, pageName);
        } catch (thumbnailError) {
            console.error('Thumbnail generation error:', thumbnailError);
        }

        // Update with new video and thumbnail URLs
        const result = await db.query(
            `UPDATE pages 
       SET background_video_url = $1, 
           background_thumbnail_url = $2,
           status = 'draft',
           updated_at = CURRENT_TIMESTAMP 
       WHERE name = $3 
       RETURNING *`,
            [req.file.location, thumbnailUrl || null, pageName]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }

        // Delete old files after successful update
        if (oldDataResult.rows.length > 0) {
            const oldData = oldDataResult.rows[0];
            if (oldData.background_video_url) {
                await deleteFile(oldData.background_video_url);
            }
            if (oldData.background_thumbnail_url) {
                await deleteThumbnail(oldData.background_thumbnail_url);
            }
        }

        res.json({
            ...result.rows[0],
            message: 'Background video uploaded successfully. Page saved as draft.'
        });
    } catch (error) {
        console.error('Error uploading background video:', error);
        res.status(500).json({ error: 'Server error' });
    }


}


// Generate thumbnail for existing video
const generatePageThumbnail = async (req, res) => {
    const { pageName } = req.params;

    try {
        const pageResult = await db.query(
            'SELECT background_video_url, background_thumbnail_url FROM pages WHERE name = $1',
            [pageName]
        );

        if (pageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }

        const page = pageResult.rows[0];

        if (!page.background_video_url) {
            return res.status(400).json({ error: 'No video found for this page' });
        }

        // Delete old thumbnail if exists
        if (page.background_thumbnail_url) {
            await deleteThumbnail(page.background_thumbnail_url);
        }

        // Generate new thumbnail
        const thumbnailUrl = await generateThumbnailFromUrl(page.background_video_url, pageName);

        // Update database
        const result = await db.query(
            'UPDATE pages SET background_thumbnail_url = $1 WHERE name = $2 RETURNING *',
            [thumbnailUrl, pageName]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error generating thumbnail:', error);
        res.status(500).json({ error: 'Failed to generate thumbnail' });
    }
};



module.exports = {
    getAllPages,
    getPageDetails,
    savePage,
    publishPage,
    updatePageStatus,
    updatePageTitle,
    uploadBackgroundVideo,
    generatePageThumbnail
};
