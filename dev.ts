import { logEnd, logStart } from "./src/logger.js";
import { startServer } from "./src/server.js";

logStart();

startServer().catch((err) => {
  console.error("Ошибка запуска сервера:", err);
  logEnd();
  process.exit(1);
});

process.on("SIGINT", () => {
  logEnd();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logEnd();
  process.exit(0);
});
