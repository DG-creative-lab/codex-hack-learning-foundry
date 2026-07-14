const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { appendFile, mkdir, readFile, writeFile } = require("node:fs/promises");
const { dirname, join } = require("node:path");

const memoryPath = () => join(app.getPath("userData"), "learning-foundry", "events.jsonl");

async function ensureMemoryFile() {
  const path = memoryPath();
  await mkdir(dirname(path), { recursive: true });
  try {
    await readFile(path, "utf8");
  } catch {
    await writeFile(path, "", "utf8");
  }
  return path;
}

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
  ipcMain.handle("memory:load", async () => {
    const path = await ensureMemoryFile();
    const contents = await readFile(path, "utf8");
    return contents.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  });

  ipcMain.handle("memory:append", async (_event, entry) => {
    const path = await ensureMemoryFile();
    await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
    return true;
  });

  ipcMain.handle("memory:reset", async () => {
    const path = await ensureMemoryFile();
    await writeFile(path, "", "utf8");
    return true;
  });

  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

