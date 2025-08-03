const db = require('../config/db');

// Get all pages with complete details and their sections (only published pages)
const getAllPublicPages = async (req, res) => {
  try {
    const result = await db.query(`SELECT 
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
                    WHEN 'awards' THEN 3
                    ELSE 4 
                END, 
                name`);

    const pages = [];

    // Process each page and add its specific data
    for (const page of result.rows) {
      const pageData = { ...page };

      switch (page.name) {
        case 'home':
          // Fetch partners for home page
          const partnersResult = await db.query(
            `
                        SELECT 
                            id, 
                            name, 
                            logo_url, 
                            order_index 
                        FROM partners 
                        WHERE page_id = $1 
                        ORDER BY order_index, created_at
                    `,
            [page.id]
          );
          pageData.partners = partnersResult.rows;
          break;

        case 'about':
          // Fetch vision and mission sections
          const sectionsResult = await db.query(
            `
                        SELECT 
                            section_type, 
                            content 
                        FROM about_sections 
                        WHERE page_id = $1
                    `,
            [page.id]
          );

          // Fetch team members
          const teamResult = await db.query(
            `
                        SELECT 
                            id, 
                            name, 
                            designation, 
                            photo_url, 
                            order_index 
                        FROM team_members 
                        WHERE page_id = $1 
                        ORDER BY order_index, created_at
                    `,
            [page.id]
          );

          // Structure the about page data
          pageData.sections = {};
          sectionsResult.rows.forEach((section) => {
            pageData.sections[section.section_type] = section.content;
          });
          pageData.team = teamResult.rows;
          break;

        case 'services':
          // Fetch key offerings for services page (limit to 4 for main website)
          const keyOfferingsResult = await db.query(
            `
                    SELECT 
                        id,
                        title,
                        description,
                        image_url,
                        order_index,
                        created_at,
                        updated_at
                    FROM key_offerings 
                    WHERE page_id = $1 
                    ORDER BY order_index ASC, created_at ASC
                    LIMIT 4
                `,
            [page.id]
          );

          // Fetch case studies for services page (limit to 2 for main website)
          const caseStudiesResult = await db.query(
            `
                    SELECT 
                        id,
                        title,
                        description,
                        image_url,
                        order_index,
                        created_at,
                        updated_at
                    FROM case_studies 
                    WHERE page_id = $1 
                    ORDER BY order_index ASC, created_at ASC
                    LIMIT 2
                `,
            [page.id]
          );

          page.keyOfferings = keyOfferingsResult.rows;
          page.caseStudies = caseStudiesResult.rows;
          page.totalKeyOfferings = keyOfferingsResult.rows.length;
          page.totalCaseStudies = caseStudiesResult.rows.length;
          break;

        case 'awards':
          // Fetch awards for awards page
          const awardsResult = await db.query(
            `
                        SELECT 
                            id,
                            award_name,
                            award_year,
                            award_description,
                            award_image_url,
                            order_index,
                            created_at,
                            updated_at
                        FROM awards 
                        WHERE page_id = $1 
                        ORDER BY award_year DESC, order_index ASC, created_at DESC
                    `,
            [page.id]
          );

          // Fetch unique years for filtering
          const yearsResult = await db.query(
            `
                        SELECT DISTINCT award_year, COUNT(*) as award_count
                        FROM awards
                        WHERE page_id = $1
                        GROUP BY award_year
                        ORDER BY award_year DESC
                    `,
            [page.id]
          );

          pageData.awards = awardsResult.rows;
          pageData.totalAwards = awardsResult.rows.length;
          pageData.years = yearsResult.rows;
          break;

        default:
          // For other pages, no additional data needed
          break;
      }

      pages.push(pageData);
    }

    res.json({
      pages: pages,
      total: pages.length,
    });
  } catch (error) {
    console.error('Error fetching public pages:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get specific page details (only if published)
const getPublicPageDetails = async (req, res) => {
  const { pageName } = req.params;

  try {
    // Get page data
    const pageResult = await db.query(
      `
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
        `,
      [pageName]
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found or not published' });
    }

    const page = pageResult.rows[0];

    // Add page-specific data based on page name
    switch (pageName) {
      case 'home':
        // Fetch partners for home page
        const partnersResult = await db.query(
          `
                    SELECT 
                        id, 
                        name, 
                        logo_url, 
                        order_index 
                    FROM partners 
                    WHERE page_id = $1 
                    ORDER BY order_index, created_at
                `,
          [page.id]
        );
        page.partners = partnersResult.rows;
        break;

      case 'about':
        // Fetch vision and mission sections
        const sectionsResult = await db.query(
          `
                    SELECT 
                        section_type, 
                        content 
                    FROM about_sections 
                    WHERE page_id = $1
                `,
          [page.id]
        );

        // Fetch team members
        const teamResult = await db.query(
          `
                    SELECT 
                        id, 
                        name, 
                        designation, 
                        photo_url, 
                        order_index 
                    FROM team_members 
                    WHERE page_id = $1 
                    ORDER BY order_index, created_at
                `,
          [page.id]
        );

        // Structure the about page data
        page.sections = {};
        sectionsResult.rows.forEach((section) => {
          page.sections[section.section_type] = section.content;
        });
        page.team = teamResult.rows;
        break;

      case 'awards':
        // Fetch awards for awards page
        const awardsResult = await db.query(
          `
                    SELECT 
                        id,
                        award_name,
                        award_year,
                        award_description,
                        award_image_url,
                        order_index,
                        created_at,
                        updated_at
                    FROM awards 
                    WHERE page_id = $1 
                    ORDER BY award_year DESC, order_index ASC, created_at DESC
                `,
          [page.id]
        );

        // Fetch unique years for filtering
        const yearsResult = await db.query(
          `
                    SELECT DISTINCT award_year, COUNT(*) as award_count
                    FROM awards
                    WHERE page_id = $1
                    GROUP BY award_year
                    ORDER BY award_year DESC
                `,
          [page.id]
        );

        page.awards = awardsResult.rows;
        page.totalAwards = awardsResult.rows.length;
        page.years = yearsResult.rows;
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
    const result = await db.query(
      `
            SELECT 
                name, 
                title, 
                background_video_url, 
                background_thumbnail_url 
            FROM pages 
            WHERE name = $1 AND status = 'published'
        `,
      [pageName]
    );

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
                    WHEN 'awards' THEN 3
                    ELSE 4 
                END, 
                name
        `);

    res.json({
      pages: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching pages background data:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get awards by year (public endpoint)
const getPublicAwardsByYear = async (req, res) => {
  const { year } = req.params;

  // Validate year
  const awardYear = parseInt(year);
  if (isNaN(awardYear) || awardYear < 1900 || awardYear > 2100) {
    return res.status(400).json({
      error: 'Invalid year parameter',
    });
  }

  try {
    // Get awards page (only if published)
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1 AND status = $2', [
      'awards',
      'published',
    ]);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Awards page not found or not published',
      });
    }

    const pageId = pageResult.rows[0].id;

    const awardsResult = await db.query(
      `
            SELECT 
                id,
                award_name,
                award_year,
                award_description,
                award_image_url,
                order_index,
                created_at,
                updated_at
            FROM awards
            WHERE page_id = $1 AND award_year = $2
            ORDER BY order_index ASC, created_at DESC
        `,
      [pageId, awardYear]
    );

    res.json({
      awards: awardsResult.rows,
      year: awardYear,
      total: awardsResult.rows.length,
    });
  } catch (error) {
    console.error('Error fetching public awards by year:', error);
    res.status(500).json({
      error: 'Server error while fetching awards by year',
    });
  }
};

module.exports = {
  getAllPublicPages,
  getPageBackground,
  getPublicPageDetails,
  getAllPagesBackground,
  getPublicAwardsByYear,
};
