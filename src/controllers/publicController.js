const db = require('../config/db');
const { activityLoggers } = require('../middlewares/activityLogger');
const nodemailer = require('nodemailer');

// Configure SMTP transporter
const transporter = nodemailer.createTransport({
  host: 'isbtv-es.mail.protection.outlook.com',
  port: 25,
  secure: false, // TLS is optional
  tls: {
    rejectUnauthorized: false, // Accept self-signed certificates
  },
  // No authentication required
});

// Verify transporter configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP configuration error:', error);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

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
                    WHEN 'services' THEN 3
                    WHEN 'awards' THEN 4
                    WHEN 'musicalevents' THEN 5
                    WHEN 'politicalevents' THEN 6
                    WHEN 'partners' THEN 7
                    WHEN 'contact' THEN 8
                    ELSE 9 
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

          // Events (NEW)
          const aboutEventsResult = await db.query(
            `
    SELECT 
      id,
      event_title,
      event_year,
      event_video_link,
      order_index,
      created_at
    FROM about_events
    WHERE page_id = $1
    ORDER BY event_year DESC, order_index ASC
  `,
            [page.id]
          );

          pageData.events = aboutEventsResult.rows;
          pageData.totalEvents = aboutEventsResult.rows.length;

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

          pageData.keyOfferings = keyOfferingsResult.rows;
          pageData.caseStudies = caseStudiesResult.rows;
          pageData.totalKeyOfferings = keyOfferingsResult.rows.length;
          pageData.totalCaseStudies = caseStudiesResult.rows.length;
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

        case 'musicalevents':
          // Fetch why watch ISBC items for musical events page (limit to 4)
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
                    LIMIT 4
                `,
            [page.id]
          );

          pageData.whyWatchItems = whyWatchResult.rows;
          pageData.totalWhyWatchItems = whyWatchResult.rows.length;
          break;

        case 'politicalevents':
          // Fetch ISBC standout items for political events page (limit to 4)
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
                    LIMIT 4
                `,
            [page.id]
          );

          pageData.standoutItems = standoutResult.rows;
          pageData.totalStandoutItems = standoutResult.rows.length;
          break;

        case 'partners':
          // Fetch valued partners for partners page
          const valuedPartnersResult = await db.query(
            `
                    SELECT 
                        id,
                        event_name,
                        event_year,
                        short_description,
                        order_index,
                        created_at,
                        updated_at
                    FROM valued_partners 
                    WHERE page_id = $1 
                    ORDER BY event_year DESC, order_index ASC, created_at DESC
                `,
            [page.id]
          );

          // Fetch unique years for filtering
          const partnerYearsResult = await db.query(
            `
                    SELECT DISTINCT event_year, COUNT(*) as event_count
                    FROM valued_partners
                    WHERE page_id = $1
                    GROUP BY event_year
                    ORDER BY event_year DESC
                `,
            [page.id]
          );

          pageData.valuedPartners = valuedPartnersResult.rows;
          pageData.totalValuedPartners = valuedPartnersResult.rows.length;
          pageData.years = partnerYearsResult.rows;
          break;

        case 'contact':
          // Fetch contact information for contact page
          const contactInfoResult = await db.query(
            `
                    SELECT 
                        email, 
                        phone, 
                        office_location, 
                        company_name, 
                        address_line_1, 
                        address_line_2, 
                        city, 
                        postal_code, 
                        country
                    FROM contact_info 
                    WHERE page_id = $1
                `,
            [page.id]
          );

          pageData.contactInfo = contactInfoResult.rows[0] || null;
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

        const aboutEventsResult = await db.query(
          `
      SELECT 
          id,
          event_title,
          event_year,
          event_video_link,
          order_index,
          created_at
      FROM about_events
      WHERE page_id = $1
      ORDER BY event_year DESC, order_index ASC
  `,
          [page.id]
        );

        page.events = aboutEventsResult.rows;
        page.totalEvents = aboutEventsResult.rows.length;

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

      case 'partners':
        // Fetch valued partners for partners page
        const valuedPartnersResult = await db.query(
          `
                    SELECT 
                        id,
                        event_name,
                        event_year,
                        short_description,
                        order_index,
                        created_at,
                        updated_at
                    FROM valued_partners 
                    WHERE page_id = $1 
                    ORDER BY event_year DESC, order_index ASC, created_at DESC
                `,
          [page.id]
        );

        // Fetch unique years for filtering
        const partnerYearsResult = await db.query(
          `
                    SELECT DISTINCT event_year, COUNT(*) as event_count
                    FROM valued_partners
                    WHERE page_id = $1
                    GROUP BY event_year
                    ORDER BY event_year DESC
                `,
          [page.id]
        );

        page.valuedPartners = valuedPartnersResult.rows;
        page.totalValuedPartners = valuedPartnersResult.rows.length;
        page.years = partnerYearsResult.rows;
        break;

      case 'contact':
        // Fetch contact information for contact page
        const contactInfoResult = await db.query(
          `
                    SELECT 
                        email, 
                        phone, 
                        office_location, 
                        company_name, 
                        address_line_1, 
                        address_line_2, 
                        city, 
                        postal_code, 
                        country
                    FROM contact_info 
                    WHERE page_id = $1
                `,
          [page.id]
        );

        page.contactInfo = contactInfoResult.rows[0] || null;
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
                    WHEN 'partners' THEN 7
                    WHEN 'contact' THEN 8
                    ELSE 9 
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

// Submit contact form (public endpoint)
const submitContactMessage = async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Basic validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      success: false,
      error: 'All fields are required: name, email, subject, message',
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address',
    });
  }

  // Length validation
  if (name.length > 255 || email.length > 255 || subject.length > 255) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and subject must be less than 255 characters',
    });
  }

  if (message.length > 5000) {
    return res.status(400).json({
      success: false,
      error: 'Message must be less than 5000 characters',
    });
  }

  try {
    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    // Insert into database
    const result = await db.query(
      `INSERT INTO contact_messages 
       (name, email, subject, message, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name.trim(), email.trim(), subject.trim(), message.trim(), ipAddress, userAgent]
    );

    const newMessage = result.rows[0];

    // Log the message submission
    await activityLoggers.contact.logMessageSubmission(newMessage, ipAddress, userAgent);

    // Send email via SMTP
    try {
      const mailOptions = {
        from: 'webform@isbtv.es',
        to: 'info@isbtv.es',
        subject: `Contact Form: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
              New Contact Form Submission
            </h2>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 10px 0;"><strong>Name:</strong> ${name}</p>
              <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 10px 0;"><strong>Subject:</strong> ${subject}</p>
            </div>
            
            <div style="margin: 20px 0;">
              <h3 style="color: #555;">Message:</h3>
              <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #007bff; white-space: pre-wrap;">
${message}
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888;">
              <p><strong>Submitted at:</strong> ${new Date(newMessage.created_at).toLocaleString(
                'en-US',
                {
                  timeZone: 'Europe/Madrid',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }
              )}</p>
              <p><strong>IP Address:</strong> ${ipAddress || 'Unknown'}</p>
              <p><strong>User Agent:</strong> ${userAgent || 'Unknown'}</p>
              <p><strong>Message ID:</strong> ${newMessage.id}</p>
            </div>
          </div>
        `,
        text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
Submitted at: ${new Date(newMessage.created_at).toLocaleString('en-US', {
          timeZone: 'Europe/Madrid',
        })}
IP Address: ${ipAddress || 'Unknown'}
User Agent: ${userAgent || 'Unknown'}
Message ID: ${newMessage.id}
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log('Contact form email sent successfully to info@isbtv.es');
    } catch (emailError) {
      // Log email error but don't fail the request
      // The message is already saved in the database
      console.error('Error sending contact form email:', emailError);
      // You might want to implement a retry mechanism or notification system here
    }

    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.',
      id: newMessage.id,
      submittedAt: newMessage.created_at,
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      error: 'There was an error sending your message. Please try again later.',
    });
  }
};

// Get contact information (public endpoint)
const getPublicContactInfo = async (req, res) => {
  try {
    // Get contact page
    const pageResult = await db.query('SELECT id FROM pages WHERE name = $1 AND status = $2', [
      'contact',
      'published',
    ]);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact page not found or not published',
      });
    }

    const pageId = pageResult.rows[0].id;

    // Get contact information
    const contactInfoResult = await db.query(
      `SELECT 
        email, phone, office_location, company_name, 
        address_line_1, address_line_2, city, postal_code, country
       FROM contact_info 
       WHERE page_id = $1`,
      [pageId]
    );

    if (contactInfoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact information not found',
      });
    }

    res.json({
      success: true,
      contactInfo: contactInfoResult.rows[0],
    });
  } catch (error) {
    console.error('Error fetching contact information:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

module.exports = {
  getAllPublicPages,
  getPageBackground,
  getPublicPageDetails,
  getAllPagesBackground,
  getPublicAwardsByYear,
  submitContactMessage,
  getPublicContactInfo,
};
