import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AuthConfig {
  username?: string;
  password?: string;
}

export function createAuthMiddleware(config: AuthConfig) {
  const isAuthEnabled = config.username && config.password;

  if (isAuthEnabled) {
    logger.info('Basic authentication enabled');
  } else {
    logger.info('Authentication disabled - set AUTH_USERNAME and AUTH_PASSWORD to enable');
  }

  return (req: Request, res: Response, next: NextFunction) => {
    if (!isAuthEnabled) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Obsidian Tunnel"');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (username === config.username && password === config.password) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Obsidian Tunnel"');
    return res.status(401).json({ error: 'Invalid credentials' });
  };
}
