import fetch from 'node-fetch';
import https from 'https';
import { ObsidianConfig, VaultFile, SearchResult, Command } from './shared/types.js';
import { ObsidianAPIError } from './utils/errors.js';
import { logger } from './utils/logger.js';

export class ObsidianAPI {
  private apiKey: string;
  private baseUrl: string;
  private httpsAgent?: https.Agent;

  constructor(config: ObsidianConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://127.0.0.1:27124';
    
    if (this.baseUrl.startsWith('https://')) {
      this.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      logger.debug(`API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        agent: this.httpsAgent,
      } as any);

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch {
          errorText = response.statusText;
        }

        let message = errorText;
        if (response.status === 404) {
          message = `Resource not found: ${endpoint}`;
        } else if (response.status === 401 || response.status === 403) {
          message = 'Authentication failed. Check your API key.';
        } else if (response.status >= 500) {
          message = `Obsidian API server error: ${errorText || response.statusText}`;
        }

        throw new ObsidianAPIError(message, response.status, endpoint);
      }

      const contentType = response.headers.get('content-type');
      const text = await response.text();
      
      if (!text) {
        return undefined as unknown as T;
      }
      
      if (contentType && contentType.includes('application/json')) {
        try {
          return JSON.parse(text);
        } catch {
        }
      }
      
      return text as unknown as T;
    } catch (error) {
      if (error instanceof ObsidianAPIError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        throw new ObsidianAPIError(
          `Cannot connect to Obsidian API at ${this.baseUrl}. Make sure the Obsidian Local REST API plugin is enabled and running.`,
          503,
          endpoint
        );
      }

      throw new ObsidianAPIError(
        `Request failed: ${errorMessage}`,
        500,
        endpoint
      );
    }
  }

  async listVaultFiles(): Promise<VaultFile[]> {
    const allItems: VaultFile[] = [];
    
    const listDirectory = async (dirPath: string = ''): Promise<void> => {
      const endpoint = dirPath ? `/vault/${encodeURIComponent(dirPath)}` : '/vault/';
      const response = await this.request<{ files: string[] }>(endpoint);
      
      if (response && typeof response === 'object' && 'files' in response) {
        for (const path of response.files) {
          const fullPath = dirPath ? `${dirPath}${path}` : path;
          const isFolder = path.endsWith('/');
          
          allItems.push({
            name: path.replace(/\/$/, '').split('/').pop() || path,
            path: fullPath,
            size: 0,
            mtime: 0,
            ctime: 0,
            isFolder: isFolder
          });
          
          if (isFolder) {
            try {
              await listDirectory(fullPath);
            } catch (error) {
              logger.debug(`Could not list directory ${fullPath}: ${error}`);
            }
          }
        }
      }
    };
    
    await listDirectory();
    return allItems;
  }

  async getActiveFile(): Promise<VaultFile | null> {
    try {
      return await this.request<VaultFile>('/active/');
    } catch (error) {
      return null;
    }
  }

  async readFile(path: string): Promise<string> {
    const encodedPath = encodeURIComponent(path);
    return this.request<string>(`/vault/${encodedPath}`);
  }

  async writeFile(path: string, content: string): Promise<void> {
    const encodedPath = encodeURIComponent(path);
    await this.request<void>(`/vault/${encodedPath}`, {
      method: 'PUT',
      body: content,
      headers: {
        'Content-Type': 'text/markdown',
      },
    });
  }

  async deleteFile(path: string): Promise<void> {
    const encodedPath = encodeURIComponent(path);
    await this.request<void>(`/vault/${encodedPath}`, {
      method: 'DELETE',
    });
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await this.request<void>('/vault/rename', {
      method: 'POST',
      body: JSON.stringify({
        file: oldPath,
        newPath: newPath
      }),
    });
  }

  async search(query: string): Promise<VaultFile[]> {
    const response = await this.request<SearchResult>('/search/', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    return response.results || [];
  }

  async simpleSearch(query: string): Promise<VaultFile[]> {
    const response = await this.request<SearchResult>('/search/simple/', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    return response.results || [];
  }

  async openFile(path: string): Promise<void> {
    const encodedPath = encodeURIComponent(path);
    await this.request<void>(`/open/${encodedPath}`, {
      method: 'POST',
    });
  }

  async listCommands(): Promise<Command[]> {
    return this.request<Command[]>('/commands/');
  }

  async executeCommand(commandId: string): Promise<void> {
    await this.request<void>(`/commands/${commandId}/`, {
      method: 'POST',
    });
  }
}
