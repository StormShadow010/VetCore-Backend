import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  // Error de constraint de PostgreSQL
  if ((err as { code?: string }).code === '23505') {
    res.status(409).json({ success: false, message: 'El registro ya existe (duplicado)' });
    return;
  }
  if ((err as { code?: string }).code === '23503') {
    res.status(400).json({ success: false, message: 'Referencia a registro inexistente' });
    return;
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
};
