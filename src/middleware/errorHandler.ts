import { Request, Response, NextFunction } from 'express';

// Global error handler — catches unhandled errors from routes/middleware
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Prisma known request errors
  if ((err as any).code === 'P2002') {
    return res.status(409).json({ error: 'A record with that value already exists.' });
  }

  if ((err as any).code === 'P2025') {
    return res.status(404).json({ error: 'Record not found.' });
  }

  // JSON parse errors
  if ((err as any).type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }

  // Default 500
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
}
