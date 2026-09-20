/**
 * Centralized error handling middleware.
 * Never expose stack traces or secrets in production.
 */
const config = require('../config');

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, _next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Log the error (technical details for backend)
  console.error(`[ERROR] ${statusCode} ${code}: ${message}`);
  if (config.nodeEnv === 'development' && err.stack) {
    console.error(err.stack);
  }

  // Don't expose internal errors to clients in production
  if (!err.isOperational && config.nodeEnv === 'production') {
    message = 'An unexpected error occurred';
    code = 'INTERNAL_ERROR';
    details = null;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  });
};

module.exports = errorHandler;
module.exports.AppError = AppError;
