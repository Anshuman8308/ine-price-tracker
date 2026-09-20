/**
 * Express application setup
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { testConnection } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// ── Security ──
app.use(helmet());

// ── CORS ──
app.use(cors({
  origin: [config.frontendUrl, 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Cron-Secret'],
  credentials: true,
}));

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Body Parsing ──
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──
if (config.nodeEnv !== 'test') {
  app.use(morgan('short'));
}

// ── Routes ──
app.use('/api', routes);

// ── Error Handling ──
app.use(errorHandler);

// ── Start Server ──
const startServer = async () => {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('[APP] WARNING: Database connection failed. Some features may not work.');
  }

  app.listen(config.port, () => {
    console.log(`[APP] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[APP] Frontend URL: ${config.frontendUrl}`);
    console.log(`[APP] INE Store URL: ${config.ineStoreUrl}`);
  });
};

// Only start if this file is run directly (not imported for tests)
if (require.main === module) {
  startServer();
}

module.exports = app;
