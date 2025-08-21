const express = require('express');
const cors = require('cors');

const { swaggerUi, swaggerSpec } = require('./src/config/swagger');

// Only use dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 8080;

console.log('=== STARTUP DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', PORT);
console.log('DB_HOST:', process.env.DB_HOST ? 'SET' : 'MISSING');
console.log('AWS_BUCKETNAME:', process.env.AWS_BUCKETNAME ? 'SET' : 'MISSING');
console.log('AWS_REGION:', process.env.AWS_REGION ? 'SET' : 'MISSING');
console.log('====================');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins =
      process.env.NODE_ENV === 'production'
        ? [
            'http://isb-admin-prod.eba-5darypkj.eu-north-1.elasticbeanstalk.com',
            'https://isb-admin-prod.eba-5darypkj.eu-north-1.elasticbeanstalk.com',
            'http://isb-admin-client.eba-zfrf236m.eu-north-1.elasticbeanstalk.com',
            'https://isb-admin-client.eba-zfrf236m.eu-north-1.elasticbeanstalk.com',
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    region: process.env.AWS_REGION,
    database: process.env.DB_HOST ? 'configured' : 'missing',
    s3bucket: process.env.AWS_BUCKETNAME ? 'configured' : 'missing',
  });
});

// Basic test endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ISB Admin Backend is running!',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Conditional route loading
if (process.env.AWS_BUCKETNAME && process.env.DB_HOST) {
  console.log('✅ Environment variables found - loading API routes');
  try {
    app.use('/api', require('./src/routes'));
    console.log('✅ API routes loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load API routes:', error.message);
  }
} else {
  console.log('⚠️ Missing environment variables - API routes disabled');
  app.get('/api/*', (req, res) => {
    res.status(503).json({
      error: 'API temporarily unavailable',
      reason: 'Environment configuration pending',
    });
  });
}

app.get('/test-ffmpeg', (req, res) => {
  const { execSync } = require('child_process');

  try {
    // Check if FFmpeg is installed
    const version = execSync('ffmpeg -version', { encoding: 'utf8' });
    const whichFFmpeg = execSync('which ffmpeg', { encoding: 'utf8' });

    res.json({
      success: true,
      ffmpeg_version: version.split('\n')[0],
      ffmpeg_path: whichFFmpeg.trim(),
      message: 'FFmpeg is working correctly',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'FFmpeg is not available',
    });
  }
});

// Error handlers
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Application error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
  console.log(`✅ Server successfully started on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

module.exports = app;
