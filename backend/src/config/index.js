require('dotenv').config();

const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // INE Store
  ineStoreUrl: process.env.INE_STORE_URL || 'https://demo.inelabteamdev.com',
  
  // Scraper
  scraperTimeoutMs: parseInt(process.env.SCRAPER_TIMEOUT_MS || '15000', 10),
  scraperMaxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES || '3', 10),
  scraperConcurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '3', 10),
  
  // Scheduler
  cronSecret: process.env.CRON_SECRET,
  defaultScrapeFrequencyMinutes: 120,
  
  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // SendGrid (optional)
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  alertFromEmail: process.env.ALERT_FROM_EMAIL,
  alertToEmail: process.env.ALERT_TO_EMAIL,
  
  // Retry backoff multipliers (in ms)
  retryBaseDelayMs: 2000,
  retryMaxDelayMs: 16000,
};

module.exports = config;
