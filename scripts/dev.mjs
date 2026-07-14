import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electron = require("electron");
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"], {
  stdio: "inherit"
});

async function waitForVite() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:5173");
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Vite did not start within 20 seconds.");
}

await waitForVite();
const desktop = spawn(electron, ["."], {
  stdio: "inherit",
  env: { ...process.env, ELECTRON_RENDERER_URL: "http://127.0.0.1:5173" }
});

desktop.on("exit", (code) => {
  vite.kill("SIGTERM");
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  desktop.kill("SIGTERM");
  vite.kill("SIGTERM");
});

