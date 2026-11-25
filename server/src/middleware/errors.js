export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function errorHandler(error, _req, res, _next) {
  const validationError = error?.name === 'ZodError';
  const conflictError = error?.code === 'P2002';
  const status = validationError ? 400 : conflictError ? 409 : Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: { message: status >= 500 ? 'An unexpected server error occurred.' : validationError ? 'Please check the submitted fields.' : conflictError ? 'A record with these details already exists.' : error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(validationError ? { details: error.flatten().fieldErrors } : {}) },
  });
}
