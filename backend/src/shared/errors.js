export class AppError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message); Object.assign(this, { status, code, fields });
  }
}
export function fail(status, code, message, fields) { throw new AppError(status, code, message, fields); }
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const malformed = err.type === 'entity.parse.failed';
  const tooLarge = err.type === 'entity.too.large';
  const status = malformed ? 400 : tooLarge ? 413 : err.status || 500;
  res.status(status).json({ error: {
    code: malformed ? 'INVALID_JSON' : tooLarge ? 'BODY_TOO_LARGE' : err.code || 'INTERNAL_ERROR',
    message: status === 500 ? 'Unexpected server error.' : malformed ? 'Body must be valid JSON.' : err.message,
    fields: err.fields || {},
  } });
}
