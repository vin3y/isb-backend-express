const db = require('../config/db');

// Get all pages with complete details and their sections (only published pages)
const getAllPublicPages = async (req, res) => {
  try {
    // First, let's check all pages regardless of status for debugging
    const debugResult = await db.query(`SELECT 
                id, 
                name, 
                title, 
                background_video_url, 
                background_thumbnail_url, 
                status, 
                updated_at 
            FROM pages 
            ORDER BY name`);

    console.log('🔍 DEBUG: All pages in database:', debugResult.rows);

    // Now get only published pages
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
                    WHEN 'services' THEN 3
                    WHEN 'awards' THEN 4
                    WHEN 'musicalevents' THEN 5
                    WHEN 'politicalevents' THEN 6
                    ELSE 7 
                END, 
                name`);

    console.log(
      '📋 Published pages found:',
      result.rows.map((p) => ({ name: p.name, status: p.status }))
    );

    const pages = [];

    // Process each page and add its specific data
    for (const page of result.rows) {
      console.log(`🔄 Processing page: ${page.name}`);
      const pageData = { ...page };

      switch (page.name) {
        case 'home':
          console.log('🏠 Processing home page');
          const partnersResult = await db.query(
            `SELECT id, name, logo_url, order_index 
             FROM partners 
             WHERE page_id = $1 
             ORDER BY order_index, created_at`,
            [page.id]
          );
          pageData.partners = partnersResult.rows;
          console.log(`🏠 Found ${partnersResult.rows.length} partners`);
          break;

        case 'about':
          console.log('ℹ️ Processing about page');
          const sectionsResult = await db.query(
            `SELECT section_type, content 
             FROM about_sections 
             WHERE page_id = $1`,
            [page.id]
          );

          const teamResult = await db.query(
            `SELECT id, name, designation, photo_url, order_index 
             FROM team_members 
             WHERE page_id = $1 
             ORDER BY order_index, created_at`,
            [page.id]
          );

          pageData.sections = {};
          sectionsResult.rows.forEach((section) => {
            pageData.sections[section.section_type] = section.content;
          });
          pageData.team = teamResult.rows;
          console.log(
            `ℹ️ Found ${sectionsResult.rows.length} sections and ${teamResult.rows.length} team members`
          );
          break;

        case 'services':
          console.log('🛠️ Processing services page');
          const keyOfferingsResult = await db.query(
            `SELECT id, title, description, image_url, order_index, created_at, updated_at
             FROM key_offerings 
             WHERE page_id = $1 
             ORDER BY order_index ASC, created_at ASC
             LIMIT 4`,
            [page.id]
          );

          const caseStudiesResult = await db.query(
            `SELECT id, title, description, image_url, order_index, created_at, updated_at
             FROM case_studies 
             WHERE page_id = $1 
             ORDER BY order_index ASC, created_at ASC
             LIMIT 2`,
            [page.id]
          );

          pageData.keyOfferings = keyOfferingsResult.rows;
          pageData.caseStudies = caseStudiesResult.rows;
          pageData.totalKeyOfferings = keyOfferingsResult.rows.length;
          pageData.totalCaseStudies = caseStudiesResult.rows.length;
          console.log(
            `🛠️ Found ${keyOfferingsResult.rows.length} key offerings and ${caseStudiesResult.rows.length} case studies`
          );
          break;

        case 'awards':
          console.log('🏆 Processing awards page');
          const awardsResult = await db.query(
            `SELECT id, award_name, award_year, award_description, award_image_url, order_index, created_at, updated_at
             FROM awards 
             WHERE page_id = $1 
             ORDER BY award_year DESC, order_index ASC, created_at DESC`,
            [page.id]
          );

          const yearsResult = await db.query(
            `SELECT DISTINCT award_year, COUNT(*) as award_count
             FROM awards
             WHERE page_id = $1
             GROUP BY award_year
             ORDER BY award_year DESC`,
            [page.id]
          );

          pageData.awards = awardsResult.rows;
          pageData.totalAwards = awardsResult.rows.length;
          pageData.years = yearsResult.rows;
          console.log(`🏆 Found ${awardsResult.rows.length} awards`);
          break;

        case 'musicalevents':
          console.log('🎵 Processing musical events page');
          // Check if why_watch_isbc table exists and has data
          try {
            const whyWatchResult = await db.query(
              `SELECT id, title, image_url, order_index, created_at, updated_at
               FROM why_watch_isbc 
               WHERE page_id = $1 
               ORDER BY order_index ASC, created_at ASC
               LIMIT 4`,
              [page.id]
            );

            pageData.whyWatchItems = whyWatchResult.rows;
            pageData.totalWhyWatchItems = whyWatchResult.rows.length;
            console.log(
              `🎵 Found ${whyWatchResult.rows.length} why watch items for musical events`
            );
          } catch (error) {
            console.error('❌ Error fetching why_watch_isbc data:', error.message);
            // Set empty arrays if table doesn't exist yet
            pageData.whyWatchItems = [];
            pageData.totalWhyWatchItems = 0;
          }
          break;

        case 'politicalevents':
          console.log('🏛️ Processing political events page');
          // Check if isbc_standout table exists and has data
          try {
            const standoutResult = await db.query(
              `SELECT id, title, image_url, order_index, created_at, updated_at
               FROM isbc_standout 
               WHERE page_id = $1 
               ORDER BY order_index ASC, created_at ASC
               LIMIT 4`,
              [page.id]
            );

            pageData.standoutItems = standoutResult.rows;
            pageData.totalStandoutItems = standoutResult.rows.length;
            console.log(
              `🏛️ Found ${standoutResult.rows.length} standout items for political events`
            );
          } catch (error) {
            console.error('❌ Error fetching isbc_standout data:', error.message);
            // Set empty arrays if table doesn't exist yet
            pageData.standoutItems = [];
            pageData.totalStandoutItems = 0;
          }
          break;

        default:
          console.log(`❓ Unknown page type: ${page.name}`);
          break;
      }

      pages.push(pageData);
      console.log(`✅ Completed processing page: ${page.name}`);
    }

    console.log(`🎯 Final result: ${pages.length} pages processed`);

    res.json({
      pages: pages,
      total: pages.length,
    });
  } catch (error) {
    console.error('💥 Error fetching public pages:', error);
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

      case 'services':
        // Fetch key offerings for services page
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
                `,
          [page.id]
        );

        // Fetch case studies for services page
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

        page.awards = awardsResult.rows;
        page.totalAwards = awardsResult.rows.length;
        page.years = yearsResult.rows;
        break;

      case 'musicalevents':
        // Fetch why watch ISBC items for musical events page
        const whyWatchResult = await db.query(
          `
                    SELECT 
                        id,
                        title,
                        image_url,
                        order_index,
                        created_at,
                        updated_at
                    FROM why_watch_isbc 
                    WHERE page_id = $1 
                    ORDER BY order_index ASC, created_at ASC
                `,
          [page.id]
        );

        page.whyWatchItems = whyWatchResult.rows;
        page.totalWhyWatchItems = whyWatchResult.rows.length;
        break;

      case 'politicalevents':
        // Fetch ISBC standout items for political events page
        const standoutResult = await db.query(
          `
                    SELECT 
                        id,
                        title,
                        image_url,
                        order_index,
                        created_at,
                        updated_at
                    FROM isbc_standout 
                    WHERE page_id = $1 
                    ORDER BY order_index ASC, created_at ASC
                `,
          [page.id]
        );

        page.standoutItems = standoutResult.rows;
        page.totalStandoutItems = standoutResult.rows.length;
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
                    WHEN 'services' THEN 3
                    WHEN 'awards' THEN 4
                    WHEN 'musicalevents' THEN 5
                    WHEN 'politicalevents' THEN 6
                    ELSE 7 
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
