const { contextBridge, ipcRenderer, shell } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Renderer -> Main
  sendItemSelected: (item) => ipcRenderer.send("item-selected", item),
  closeModal: () => ipcRenderer.send("close-modal"),
  notifyDragStart: () => ipcRenderer.send("drag-started"),
  notifyDragEnd: (success) => ipcRenderer.send("drag-ended", success),
  openExternalLink: (url) => ipcRenderer.send("open-external-link", url),
  clearHistory: () => ipcRenderer.send("clear-history"),
  startWindowDrag: (x, y) => ipcRenderer.send("start-window-drag", { x, y }),
  endWindowDrag: () => ipcRenderer.send("end-window-drag"),

  // Main -> Renderer
  onShowHistory: (callback) =>
    ipcRenderer.on("show-history", (_event, history) => callback(history)),
});
