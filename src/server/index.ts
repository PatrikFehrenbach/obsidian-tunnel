import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadConfig, validateConfig } from '../config/index.js';
import { ObsidianAPI } from '../obsidian-api.js';
import { createRoutes } from './routes.js';
import { requestLogger, errorHandler, notFoundHandler } from './middleware.js';
import { createAuthMiddleware } from './auth.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function startServer() {
  try {
    const config = loadConfig();
    validateConfig(config);

    logger.info('Starting Obsidian Tunnel server...');
    logger.info(`Obsidian API URL: ${config.baseUrl}`);

    const api = new ObsidianAPI({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl
    });

    try {
      await api.listVaultFiles();
      logger.info('Successfully connected to Obsidian API');
    } catch (error) {
      logger.warn('Could not connect to Obsidian API - the app will start but API calls will fail');
      logger.warn('Make sure Obsidian is running with the Local REST API plugin enabled');
    }

    const app = express();

    app.use(express.json());
    app.use(requestLogger);

    const authMiddleware = createAuthMiddleware({
      username: config.authUsername,
      password: config.authPassword
    });
    app.use(authMiddleware);

    const publicPath = join(__dirname, '../public');
    app.use(express.static(publicPath));

    app.use('/api', createRoutes(api));

    app.get('/', (req, res) => {
      res.sendFile(join(publicPath, 'index.html'));
    });

    app.use(notFoundHandler);
    app.use(errorHandler);

    app.listen(config.port, () => {
      logger.info(`Server running at http://localhost:${config.port}`);
      if (config.cloudflareHostname) {
        logger.info(`Public URL: https://${config.cloudflareHostname}`);
      }
      logger.info('Press Ctrl+C to stop');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
