import { Router, Request, Response, NextFunction } from 'express';
import { ObsidianAPI } from '../obsidian-api.js';
import { logger } from '../utils/logger.js';

export function createRoutes(api: ObsidianAPI): Router {
  const router = Router();

  const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res)).catch(next);
    };
  };

  router.get('/vault', asyncHandler(async (req, res) => {
    const files = await api.listVaultFiles();
    res.json(files);
  }));

  router.get('/vault/*', asyncHandler(async (req, res) => {
    const path = req.params[0];
    if (!path) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File path is required'
      });
    }

    const content = await api.readFile(path);
    res.send(content);
  }));

  router.put('/vault/*', asyncHandler(async (req, res) => {
    const path = req.params[0];
    if (!path) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File path is required'
      });
    }

    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Content must be a string'
      });
    }

    await api.writeFile(path, content);
    logger.info(`File saved: ${path}`);
    res.status(204).send();
  }));

  router.delete('/vault/*', asyncHandler(async (req, res) => {
    const path = req.params[0];
    if (!path) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File path is required'
      });
    }

    await api.deleteFile(path);
    logger.info(`File deleted: ${path}`);
    res.status(204).send();
  }));

  router.post('/vault/rename', asyncHandler(async (req, res) => {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Both oldPath and newPath are required'
      });
    }

    await api.renameFile(oldPath, newPath);
    logger.info(`File renamed: ${oldPath} -> ${newPath}`);
    res.json({ success: true, newPath });
  }));

  router.get('/active', asyncHandler(async (req, res) => {
    const activeFile = await api.getActiveFile();
    if (!activeFile) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'No file is currently active in Obsidian'
      });
    }
    res.json(activeFile);
  }));

  router.post('/search', asyncHandler(async (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Query string is required'
      });
    }

    const results = await api.search(query);
    res.json({ results });
  }));

  router.post('/search/simple', asyncHandler(async (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Query string is required'
      });
    }

    const results = await api.simpleSearch(query);
    res.json({ results });
  }));

  router.post('/open/*', asyncHandler(async (req, res) => {
    const path = req.params[0];
    if (!path) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File path is required'
      });
    }

    await api.openFile(path);
    logger.info(`File opened in Obsidian: ${path}`);
    res.status(204).send();
  }));

  router.get('/commands', asyncHandler(async (req, res) => {
    const commands = await api.listCommands();
    res.json(commands);
  }));

  router.post('/commands/:commandId', asyncHandler(async (req, res) => {
    const { commandId } = req.params;
    if (!commandId) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Command ID is required'
      });
    }

    await api.executeCommand(commandId);
    logger.info(`Command executed: ${commandId}`);
    res.status(204).send();
  }));

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
