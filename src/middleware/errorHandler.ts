import { Request, Response, NextFunction } from 'express';
import config from '../config';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  // Log all 500-level errors with timestamp
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err);

  const statusCode = (err as { statusCode?: number }).statusCode ?? 500;

  // Never expose stack traces in production
  const message = config.isProduction
    ? statusCode >= 500
      ? 'Internal server error'
      : err.message
    : err.message;

  res.status(statusCode).json({ success: false, error: message });
}
