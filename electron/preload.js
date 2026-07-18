const { contextBridge, webUtils, clipboard, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  getFilePath: (file) => webUtils.getPathForFile(file),
  readClipboard: () => clipboard.readText(),
  writeClipboard: (text) => clipboard.writeText(text),
  onPaste: (callback) => {
    ipcRenderer.on('sterm-paste', (_event, text) => callback(text));
  },
  onCopyRequest: (callback) => {
    ipcRenderer.on('sterm-copy-request', async () => {
      const selection = await callback();
      ipcRenderer.send('sterm-copy-response', selection || '');
    });
  },
  sendFocusState: (isInput) => {
    ipcRenderer.send('sterm-focus-state', isInput);
  },
  saveSnippets: (snippets) => ipcRenderer.invoke('sterm-save-snippets', snippets),
  loadSnippets: () => ipcRenderer.invoke('sterm-load-snippets'),
});
