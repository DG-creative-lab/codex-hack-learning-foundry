const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("foundryMemory", {
  load: () => ipcRenderer.invoke("memory:load"),
  append: (entry) => ipcRenderer.invoke("memory:append", entry),
  reset: () => ipcRenderer.invoke("memory:reset")
});

contextBridge.exposeInMainWorld("foundrySources", {
  extract: (request) => ipcRenderer.invoke("source:extract", request)
});

contextBridge.exposeInMainWorld("foundryExecution", {
  liveAvailability: () => ipcRenderer.invoke("execution:live-availability"),
  runLive: (request) => ipcRenderer.invoke("execution:live-run", request)
});
