const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { mkdir } = require("node:fs/promises");
const { join } = require("node:path");

const memoryPath = () => join(app.getPath("userData"), "learning-foundry", "events.jsonl");

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#f3f4f1",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  const liveExecutionPath = join(app.getPath("userData"), "learning-foundry", "live-execution");
  await mkdir(liveExecutionPath, { recursive: true });
  const { appendMemoryEntry, loadMemoryFile, resetMemoryFile } = await import("./memory.mjs");
  const { createCodexExecutionService } = await import("./codex-execution.mjs");
  const { extractLocalSource, extractOnlineSource, serializeExtractionError } = await import("./source-extraction.mjs");
  const { sourceExtractRequestSchema } = await import("../shared/source-contract.js");
  const codexExecution = createCodexExecutionService({ cwd: liveExecutionPath });

  ipcMain.handle("memory:load", async () => {
    return loadMemoryFile(memoryPath());
  });

  ipcMain.handle("memory:append", async (_event, entry) => {
    await appendMemoryEntry(memoryPath(), entry);
    return true;
  });

  ipcMain.handle("memory:reset", async () => {
    await resetMemoryFile(memoryPath());
    return true;
  });

  ipcMain.handle("source:extract", async (_event, request) => {
    try {
      const parsedRequest = sourceExtractRequestSchema.parse(request);
      const document =
        parsedRequest.origin === "local"
          ? await extractLocalSource(parsedRequest.provenance)
          : await extractOnlineSource(parsedRequest.provenance);
      return { ok: true, document };
    } catch (error) {
      return { ok: false, error: serializeExtractionError(error) };
    }
  });

  ipcMain.handle("execution:live-availability", () => codexExecution.availability());
  ipcMain.handle("execution:live-run", (_event, request) => codexExecution.execute(request));

  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
