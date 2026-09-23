/** An error carrying an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest   = (m: string, c = 'BAD_REQUEST')        => new AppError(c, 400, m);
export const unauthorized = (m = 'You are not signed in.')        => new AppError('UNAUTHENTICATED', 401, m);
export const forbidden    = (m = 'You do not have permission to do that.') => new AppError('FORBIDDEN', 403, m);
export const notFound     = (m = 'Not found.')                     => new AppError('NOT_FOUND', 404, m);
export const conflict     = (m: string, c = 'CONFLICT')            => new AppError(c, 409, m);
export const validation   = (fieldErrors: Record<string, string>) =>
  new AppError('VALIDATION_FAILED', 422, 'Please correct the highlighted fields.', fieldErrors);
