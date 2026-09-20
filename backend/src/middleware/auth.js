/**
 * Authentication middleware for cron/scheduler endpoints.
 */
const config = require('../config');
const { AppError } = require('./errorHandler');

const authenticateCron = (req, res, next) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;

  if (!config.cronSecret) {
    return next(new AppError('Cron secret not configured on server', 500, 'CONFIG_ERROR'));
  }

  if (!secret || secret !== config.cronSecret) {
    return next(new AppError('Unauthorized: Invalid cron secret', 401, 'UNAUTHORIZED'));
  }

  next();
};

module.exports = { authenticateCron };
