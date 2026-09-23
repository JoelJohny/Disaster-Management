import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { validation } from '../lib/errors.js';

/** Turn a ZodError into { fieldName: firstMessage } using dot-joined paths. */
function toFieldErrors(e: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function validateBody<S extends ZodTypeAny>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return next(validation(toFieldErrors(r.error)));
    (req as any).valid = r.data as z.infer<S>;
    next();
  };
}

export function validateQuery<S extends ZodTypeAny>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.query);
    if (!r.success) return next(validation(toFieldErrors(r.error)));
    (req as any).validQuery = r.data as z.infer<S>;
    next();
  };
}

export const body = <T>(req: Request): T => (req as any).valid as T;
export const query = <T>(req: Request): T => (req as any).validQuery as T;
