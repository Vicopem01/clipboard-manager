const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer -> Main
  sendItemSelected: (item) => ipcRenderer.send('item-selected', item),
  closeModal: () => ipcRenderer.send('close-modal'),

  // Main -> Renderer
  onShowHistory: (callback) => ipcRenderer.on('show-history', (_event, history) => callback(history))
}); 