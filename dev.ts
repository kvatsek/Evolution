import { logEnd, logStart } from "./src/logger.js";
import { spawn } from "node:child_process";

logStart();

const child = spawn("vite", ["--port", "3000"], {
  stdio: "inherit",
  shell: true,
});

let isShuttingDown = false;

function shutdown(code?: number): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logEnd();
  process.exit(code ?? 0);
}

child.on("close", (code) => {
  shutdown(code);
});

process.on("SIGINT", () => {
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});
