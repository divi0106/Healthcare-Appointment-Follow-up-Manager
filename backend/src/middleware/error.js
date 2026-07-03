function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} -`, err.message);

  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'This slot was just taken by another booking. Please pick a different slot.',
    });
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation failed', details: err.errors });
  }

  const status = err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  return res.status(status).json({ error: message });
}

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, AppError };
