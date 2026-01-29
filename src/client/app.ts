interface VaultFile {
  name: string;
  path: string;
  size: number;
  mtime: number;
  ctime: number;
  isFolder?: boolean;
}

interface Command {
  id: string;
  name: string;
}

interface SearchResult {
  results: VaultFile[];
}

interface ApiErrorResponse {
  error: string;
  status: number;
  message: string;
  endpoint?: string;
}

let currentFile: string | null = null;
let codeMirrorEditor: any = null;
let fileContent: string = '';
let selectedFileElement: HTMLElement | null = null;
let saveTimeout: any = null;
let allFolders: string[] = [];
let fileToRename: string | null = null;

async function loadFiles(): Promise<void> {
  const filesList = document.getElementById('files-list');
  if (!filesList) return;
  
  filesList.innerHTML = '<div class="text-sm text-gray-500 py-12 text-center">Loading...</div>';
  
  try {
    const response = await fetch('/api/vault');
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status 
      })) as ApiErrorResponse;
      throw new Error(errorData.message || 'Failed to load files');
    }
    
    const files = await response.json() as VaultFile[];
    
    allFolders = files
      .filter(f => f.isFolder)
      .map(f => f.path)
      .sort((a, b) => a.localeCompare(b));
    
    if (files.length === 0) {
      filesList.innerHTML = '<div class="text-sm text-gray-500 py-12 text-center">No files found in vault</div>';
      return;
    }
    
    filesList.innerHTML = files
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(file => {
        const fileName = file.name || file.path.split('/').pop() || file.path;
        const clickable = !file.isFolder;
        const depth = (file.path.match(/\//g) || []).length - (file.isFolder ? 1 : 0);
        const indent = depth * 16;
        const cursorClass = clickable ? 'cursor-pointer' : 'cursor-default opacity-60';
        const onclick = clickable ? `data-file-path="${escapeHtml(file.path)}" onclick="handleFileClick(event)"` : '';
        const fontWeight = file.isFolder ? 'font-medium' : 'font-normal';
        
        return `
          <div class="file-item py-2 ${cursorClass} transition border-l-2 border-transparent" ${onclick} style="padding-left: ${12 + indent}px;">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm ${fontWeight} text-black truncate flex-1">
                ${file.isFolder ? '▸ ' : ''}${escapeHtml(fileName)}
              </div>
              ${!file.isFolder ? `
                <div class="file-actions flex gap-1 pr-2">
                  <button class="action-btn rename" onclick="renameFile('${escapeHtml(file.path).replace(/'/g, "\\'")}', event)">Rename</button>
                  <button class="action-btn delete" onclick="deleteFile('${escapeHtml(file.path).replace(/'/g, "\\'")}', event)">Delete</button>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    filesList.innerHTML = `<div class="text-sm text-red-600 py-12 text-center">${escapeHtml(errorMsg)}</div>`;
  }
}

function handleFileClick(event: Event): void {
  const target = event.currentTarget as HTMLElement;
  const filePath = target.getAttribute('data-file-path');
  if (filePath) {
    document.querySelectorAll('.file-item').forEach(el => {
      el.classList.remove('bg-blue-50', 'border-blue-500');
      el.classList.add('border-transparent');
    });
    target.classList.add('bg-blue-50', 'border-blue-500');
    target.classList.remove('border-transparent');
    selectedFileElement = target;
    
    openFileInEditor(filePath);
  }
}

async function openFileInEditor(filePath: string): Promise<void> {
  currentFile = filePath;
  const editorContainer = document.getElementById('editor-container');
  const editorHeader = document.getElementById('editor-header');
  const editorEmpty = document.getElementById('editor-empty');
  const fileName = document.getElementById('editor-file-name');
  const filePathEl = document.getElementById('editor-file-path');
  
  if (!editorContainer || !editorHeader || !editorEmpty) return;
  
  editorEmpty.classList.add('hidden');
  editorHeader.classList.remove('hidden');
  
  if (fileName) fileName.textContent = filePath.split('/').pop() || filePath;
  if (filePathEl) filePathEl.textContent = filePath;
  
  try {
    const response = await fetch(`/api/vault/${encodeURIComponent(filePath)}`);
    if (!response.ok) {
      throw new Error('Failed to load file');
    }
    
    fileContent = await response.text();
    
    if (!codeMirrorEditor) {
      editorContainer.innerHTML = '';
      codeMirrorEditor = (window as any).CodeMirror(editorContainer, {
        mode: 'markdown',
        theme: 'default',
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 2,
        tabSize: 2,
        autoCloseBrackets: true,
        matchBrackets: true,
        styleActiveLine: true,
        viewportMargin: Infinity,
        extraKeys: {
          'Cmd-S': () => { saveFile(); return false; },
          'Ctrl-S': () => { saveFile(); return false; },
          'Enter': 'newlineAndIndentContinueMarkdownList'
        }
      });
      
      codeMirrorEditor.on('change', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          autoSave();
        }, 1000);
      });
    }
    
    codeMirrorEditor.setValue(fileContent);
    codeMirrorEditor.refresh();
    codeMirrorEditor.focus();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    editorContainer.innerHTML = `<div class="p-4 text-red-600">${escapeHtml(errorMsg)}</div>`;
  }
}

function closeEditor(): void {
  const editorHeader = document.getElementById('editor-header');
  const editorEmpty = document.getElementById('editor-empty');
  
  if (editorHeader) editorHeader.classList.add('hidden');
  if (editorEmpty) editorEmpty.classList.remove('hidden');
  
  currentFile = null;
  fileContent = '';
  
  if (selectedFileElement) {
    selectedFileElement.classList.remove('bg-blue-50', 'border-blue-500');
    selectedFileElement.classList.add('border-transparent');
    selectedFileElement = null;
  }
}

function createNewNote(): void {
  const modal = document.getElementById('new-note-modal');
  const folderSelect = document.getElementById('new-note-folder') as HTMLSelectElement;
  const nameInput = document.getElementById('new-note-name') as HTMLInputElement;
  
  if (!modal || !folderSelect || !nameInput) return;
  
  folderSelect.innerHTML = '<option value="">Root folder</option>';
  allFolders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder;
    option.textContent = folder.replace(/\/$/, '');
    folderSelect.appendChild(option);
  });
  
  nameInput.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => nameInput.focus(), 100);
  
  nameInput.onkeypress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitNewNote();
    }
  };
}

function submitNewNote(): void {
  const nameInput = document.getElementById('new-note-name') as HTMLInputElement;
  const folderSelect = document.getElementById('new-note-folder') as HTMLSelectElement;
  
  if (!nameInput || !folderSelect) return;
  
  const fileName = nameInput.value.trim();
  if (!fileName) {
    showNotification('Please enter a note name', 'error');
    return;
  }
  
  const cleanName = fileName.replace(/\.md$/, '');
  const folder = folderSelect.value;
  const filePath = folder ? `${folder}${cleanName}.md` : `${cleanName}.md`;
  const initialContent = `# ${cleanName}\n\n`;
  
  fetch(`/api/vault/${encodeURIComponent(filePath)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: initialContent })
  })
  .then(async response => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to create note');
    }
    
    closeNewNoteModal();
    loadFiles();
    setTimeout(() => {
      openFileInEditor(filePath);
    }, 500);
  })
  .catch(error => {
    showNotification('Error: ' + error.message, 'error');
  });
}

function closeNewNoteModal(): void {
  const modal = document.getElementById('new-note-modal');
  if (modal) modal.classList.add('hidden');
}

async function deleteFile(filePath: string, event: Event): Promise<void> {
  event.stopPropagation();
  
  try {
    const response = await fetch(`/api/vault/${encodeURIComponent(filePath)}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete file');
    }
    
    showNotification(`Deleted: ${filePath}`, 'success');
    
    if (currentFile === filePath) {
      closeEditor();
    }
    
    loadFiles();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    showNotification(`Error deleting file: ${errorMsg}`, 'error');
  }
}

function renameFile(filePath: string, event: Event): void {
  event.stopPropagation();
  
  fileToRename = filePath;
  const fileName = filePath.split('/').pop() || filePath;
  
  const modal = document.getElementById('rename-modal');
  const input = document.getElementById('rename-input') as HTMLInputElement;
  
  if (!modal || !input) return;
  
  input.value = fileName;
  modal.classList.remove('hidden');
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
  
  input.onkeypress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitRename();
    } else if (e.key === 'Escape') {
      closeRenameModal();
    }
  };
}

async function submitRename(): Promise<void> {
  if (!fileToRename) return;
  
  const input = document.getElementById('rename-input') as HTMLInputElement;
  if (!input) return;
  
  const newName = input.value.trim();
  const fileName = fileToRename.split('/').pop() || fileToRename;
  
  if (!newName || newName === fileName) {
    closeRenameModal();
    return;
  }
  
  const directory = fileToRename.substring(0, fileToRename.lastIndexOf('/'));
  const newPath = directory ? `${directory}/${newName}` : newName;
  
  try {
    const response = await fetch('/api/vault/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath: fileToRename, newPath })
    });
    
    if (!response.ok) {
      throw new Error('Failed to rename file');
    }
    
    const result = await response.json();
    showNotification(`Renamed to: ${result.newPath}`, 'success');
    
    if (currentFile === fileToRename) {
      currentFile = result.newPath;
    }
    
    closeRenameModal();
    loadFiles();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    showNotification(`Error renaming file: ${errorMsg}`, 'error');
  }
}

function closeRenameModal(): void {
  const modal = document.getElementById('rename-modal');
  if (modal) modal.classList.add('hidden');
  fileToRename = null;
}

async function autoSave(): Promise<void> {
  if (!currentFile || !codeMirrorEditor) return;
  
  const content = codeMirrorEditor.getValue();
  if (content === fileContent) return;
  
  try {
    const response = await fetch(`/api/vault/${encodeURIComponent(currentFile)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    
    if (response.ok) {
      fileContent = content;
    }
  } catch (error) {
    console.error('Auto-save failed:', error);
  }
}

async function saveFile(): Promise<void> {
  if (!currentFile || !codeMirrorEditor) return;
  
  const content = codeMirrorEditor.getValue();
  
  try {
    const response = await fetch(`/api/vault/${encodeURIComponent(currentFile)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save file');
    }
    
    fileContent = content;
    showNotification('Saved', 'success');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    showNotification(`Error: ${errorMsg}`, 'error');
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message: string, type: 'success' | 'error' = 'success'): void {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 px-6 py-3 rounded shadow-lg text-white z-50 ${
    type === 'success' ? 'bg-green-600' : 'bg-red-600'
  }`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

async function checkConnection(): Promise<void> {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  if (!statusIndicator || !statusText) return;
  
  try {
    const response = await fetch('/api/health');
    if (response.ok) {
      statusIndicator.className = 'inline-block w-2 h-2 rounded-full bg-green-500 mr-1';
      statusText.textContent = 'Connected';
    } else {
      statusIndicator.className = 'inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1';
      statusText.textContent = 'Error';
    }
  } catch (error) {
    statusIndicator.className = 'inline-block w-2 h-2 rounded-full bg-red-500 mr-1';
    statusText.textContent = 'Disconnected';
  }
}

(window as any).loadFiles = loadFiles;
(window as any).handleFileClick = handleFileClick;
(window as any).openFileInEditor = openFileInEditor;
(window as any).closeEditor = closeEditor;
(window as any).createNewNote = createNewNote;
(window as any).submitNewNote = submitNewNote;
(window as any).closeNewNoteModal = closeNewNoteModal;
(window as any).deleteFile = deleteFile;
(window as any).renameFile = renameFile;
(window as any).submitRename = submitRename;
(window as any).closeRenameModal = closeRenameModal;
(window as any).saveFile = saveFile;

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (currentFile && codeMirrorEditor) {
      saveFile();
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  checkConnection();
  loadFiles();
});
