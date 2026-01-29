export interface ObsidianConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface VaultFile {
  name: string;
  path: string;
  size: number;
  mtime: number;
  ctime: number;
  isFolder?: boolean;
}

export interface Note {
  content: string;
  path: string;
}

export interface SearchResult {
  results: VaultFile[];
}

export interface Command {
  id: string;
  name: string;
}

export interface ApiErrorResponse {
  error: string;
  status: number;
  message: string;
  endpoint?: string;
}

export interface FileContent {
  path: string;
  content: string;
}

export interface SaveFileRequest {
  content: string;
}
