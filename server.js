// Make sure your server.js has these configurations

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();

// Use port 8080 for Elastic Beanstalk
const PORT = process.env.PORT || 8080;

// Database configuration - make sure your db config reads these variables
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE, // Note: you use DB_DATABASE, not DB_NAME
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
};

// JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET_KEY, // Note: you use JWT_SECRET_KEY, not JWT_SECRET
  refreshSecret: process.env.REFRESH_SECRET_KEY,
};

// AWS S3 configuration
const s3Config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  bucketName: process.env.AWS_BUCKETNAME,
};

console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', PORT);
console.log('Database Host:', process.env.DB_HOST);
console.log('AWS Region:', process.env.AWS_REGION);

// CORS configuration for eu-north-1
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins =
      process.env.NODE_ENV === 'production'
        ? [
            // Add your production frontend domains here
            'https://your-frontend-domain.com',
            // Your EB environment URL (you'll get this after deployment)
            'http://isb-admin-prod.eu-north-1.elasticbeanstalk.com',
            'https://isb-admin-prod.eu-north-1.elasticbeanstalk.com',
            // Temporarily allow localhost for testing
            'http://localhost:5173',
            'http://127.0.0.1:5173',
          ]
        : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint for Elastic Beanstalk
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    region: process.env.AWS_REGION,
    database: process.env.DB_HOST ? 'connected' : 'not configured',
  });
});

// Your routes
app.use('/api', require('./src/routes'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Region: ${process.env.AWS_REGION}`);
});

module.exports = app;
