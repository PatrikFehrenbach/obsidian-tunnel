#!/usr/bin/env node

import { Command } from 'commander';
import { ObsidianAPI } from './obsidian-api.js';
import { loadConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import * as fs from 'fs';

const program = new Command();

logger.transports.forEach(transport => transport.silent = true);

program
  .name('obsidian-tunnel')
  .description('CLI tool for interacting with Obsidian vault via Local REST API')
  .version('1.0.0');

program
  .command('list')
  .alias('ls')
  .description('List all files in the vault')
  .option('-f, --format <format>', 'Output format (json, table)', 'table')
  .action(async (options) => {
    try {
      const config = loadConfig();
      const api = new ObsidianAPI({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl
      });
      const files = await api.listVaultFiles();

      if (options.format === 'json') {
        console.log(JSON.stringify(files, null, 2));
      } else {
        console.log(`\nFound ${files.length} files:\n`);
        files.forEach((file) => {
          const date = new Date(file.mtime * 1000).toLocaleDateString();
          console.log(`  ${file.path.padEnd(50)} ${(file.size / 1024).toFixed(1)}KB  ${date}`);
        });
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('read <path>')
  .description('Read a file from the vault')
  .action(async (filePath) => {
    try {
      const config = loadConfig();
      const api = new ObsidianAPI(config);
      const content = await api.readFile(filePath);
      console.log(content);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('write <path>')
  .description('Write content to a file in the vault')
  .option('-c, --content <content>', 'Content to write')
  .option('-f, --file <file>', 'Read content from a local file')
  .action(async (filePath, options) => {
    try {
      const config = loadConfig();
      const api = new ObsidianAPI({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl
      });

      let content = '';
      if (options.file) {
        content = fs.readFileSync(options.file, 'utf-8');
      } else if (options.content) {
        content = options.content;
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        content = Buffer.concat(chunks).toString('utf-8');
      }

      await api.writeFile(filePath, content);
      console.log(`✓ Successfully wrote to ${filePath}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('delete <path>')
  .alias('rm')
  .description('Delete a file from the vault')
  .action(async (filePath) => {
    try {
      const config = loadConfig();
      const api = new ObsidianAPI({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl
      });
      await api.deleteFile(filePath);
      console.log(`✓ Successfully deleted ${filePath}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .description('Search the vault')
  .option('-s, --simple', 'Use simple search instead of full-text search')
  .action(async (query, options) => {
    try {
      const config = loadConfig();
      const api = new ObsidianAPI({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl
      });
      const results = options.simple
        ? await api.simpleSearch(query)
        : await api.search(query);

      console.log(`\nFound ${results.length} results for "${query}":\n`);
      results.forEach((file) => {
        console.log(`  ${file.path}`);
      });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('open <path>')
  .description('Open a file in Obsidian')
  .action(async (filePath) => {
    try {
      const config = loadConfig();
      const api = new ObsidianAPI({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl
      });
      await api.openFile(filePath);
      console.log(`✓ Opened ${filePath} in Obsidian`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('active')
  .description('Get the currently active file')
  .action(async () => {
    try {
      const config = loadConfig();
      const api = new ObsidianAPI({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl
      });
      const activeFile = await api.getActiveFile();
      
      if (activeFile) {
        console.log(`Active file: ${activeFile.path}`);
        console.log(`Size: ${(activeFile.size / 1024).toFixed(1)}KB`);
        console.log(`Modified: ${new Date(activeFile.mtime * 1000).toLocaleString()}`);
      } else {
        console.log('No active file');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('commands')
  .description('List available Obsidian commands')
  .action(async () => {
    try {
      const config = loadConfig();
      const api = new ObsidianAPI({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl
      });
      const commands = await api.listCommands();

      console.log(`\nAvailable commands:\n`);
      commands.forEach((cmd) => {
        console.log(`  ${cmd.id.padEnd(40)} ${cmd.name}`);
      });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('exec <commandId>')
  .description('Execute an Obsidian command')
  .action(async (commandId) => {
    try {
      const config = loadConfig();
      const api = new ObsidianAPI({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl
      });
      await api.executeCommand(commandId);
      console.log(`✓ Executed command: ${commandId}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
