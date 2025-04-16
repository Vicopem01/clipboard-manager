const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Renderer -> Main
  sendItemSelected: (item) => ipcRenderer.send("item-selected", item),
  closeModal: () => ipcRenderer.send("close-modal"),
  notifyDragStart: () => ipcRenderer.send("drag-started"),
  notifyDragEnd: (success) => ipcRenderer.send("drag-ended", success),
  openExternalLink: (url) => ipcRenderer.send("open-external-link", url),
  clearHistory: () => ipcRenderer.send("clear-history"),

  // Main -> Renderer
  onShowHistory: (callback) =>
    ipcRenderer.on("show-history", (_event, history) => callback(history)),
});
