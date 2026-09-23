import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import type { ApiErrorBody } from '@drms/contracts';

export function notFoundHandler(_req: Request, res: Response) {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } };
  res.status(404).json(body);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors },
    };
    return res.status(err.status).json(body);
  }

  // Anything unrecognised is a bug. Log it fully; tell the client nothing.
  console.error('[unhandled]', err);
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
  };
  res.status(500).json(body);
}
