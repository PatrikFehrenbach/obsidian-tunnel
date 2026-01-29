import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { formatErrorResponse } from '../utils/errors.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });
  
  next();
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error(`Error handling ${req.method} ${req.path}:`, err);
  
  const errorResponse = formatErrorResponse(err, req.path);
  res.status(errorResponse.status).json(errorResponse);
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'NotFound',
    status: 404,
    message: `Cannot ${req.method} ${req.path}`,
    endpoint: req.path
  });
}
