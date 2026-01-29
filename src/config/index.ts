import { ObsidianConfig } from '../shared/types.js';

export interface AppConfig extends ObsidianConfig {
  port: number;
  logLevel: string;
  authUsername?: string;
  authPassword?: string;
  cloudflareHostname?: string;
  cloudflareTunnelId?: string;
}

export function loadConfig(): AppConfig {
  const apiKey = process.env.OBSIDIAN_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'OBSIDIAN_API_KEY environment variable is required.\n' +
      'Get your API key from Obsidian Local REST API plugin settings.\n' +
      'Set it with: export OBSIDIAN_API_KEY=your_api_key'
    );
  }

  return {
    apiKey,
    baseUrl: process.env.OBSIDIAN_BASE_URL || 'https://127.0.0.1:27124',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    authUsername: process.env.AUTH_USERNAME,
    authPassword: process.env.AUTH_PASSWORD,
    cloudflareHostname: process.env.CLOUDFLARE_HOSTNAME,
    cloudflareTunnelId: process.env.CLOUDFLARE_TUNNEL_ID
  };
}

export function validateConfig(config: AppConfig): void {
  if (!config.apiKey || config.apiKey.length < 10) {
    throw new Error('Invalid API key');
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error('Invalid port number');
  }

  if (config.baseUrl && (!config.baseUrl.startsWith('http://') && !config.baseUrl.startsWith('https://'))) {
    throw new Error('Invalid base URL');
  }

  if ((config.authUsername && !config.authPassword) || (!config.authUsername && config.authPassword)) {
    throw new Error('Both AUTH_USERNAME and AUTH_PASSWORD must be set, or neither');
  }
}
