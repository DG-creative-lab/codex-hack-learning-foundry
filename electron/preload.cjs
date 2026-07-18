const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("foundryMemory", {
  load: () => ipcRenderer.invoke("memory:load"),
  append: (entry) => ipcRenderer.invoke("memory:append", entry),
  reset: () => ipcRenderer.invoke("memory:reset")
});
