import { createServer as createViteServer, type ViteDevServer } from "vite";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { logEnd, logStart } from "./logger.js";
import {
  handleGetWeights,
  handleLogin,
  handleMe,
  handleRegister,
  handleSaveScore,
  handleUsers,
  handleSubmitAnswer,
} from "./auth/api.js";
import { ensureUserLevelMigration } from "./auth/csv.js";

/** Маршрутизирует API запросы к соответствующим обработчикам. */
async function handleApiRequest(
  method: string,
  url: string,
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse
): Promise<void> {
  const [path, query] = url.split("?");
  const fullPath = query ? `${path}?${query}` : path;

  if (method === "POST" && fullPath === "/api/register") {
    await handleRegister(req, res);
  } else if (method === "POST" && fullPath === "/api/login") {
    await handleLogin(req, res);
  } else if (method === "POST" && fullPath === "/api/save-score") {
    await handleSaveScore(req, res);
  } else if (method === "POST" && fullPath === "/api/submit-answer") {
    await handleSubmitAnswer(req, res);
  } else if (method === "GET" && fullPath === "/api/me") {
    await handleMe(req, res);
  } else if (method === "GET" && fullPath === "/api/weights") {
    await handleGetWeights(req, res);
  } else if (method === "GET" && fullPath === "/api/users") {
    await handleUsers(req, res);
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
}

/** Создаёт и настраивает HTTP сервер с Vite и API маршрутами. */
export async function createApp(): Promise<{
  server: import("node:http").Server;
  vite: ViteDevServer;
}> {
  const viteServer = await createViteServer({
    server: {
      port: 3000,
      middlewareMode: true,
    },
    appType: "custom",
  });

  const viteMiddleware = viteServer.middlewares;

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${3000}`);

    // Обрабатываем API маршруты
    if (url.pathname.startsWith("/api/")) {
      try {
        await handleApiRequest(req.method!, url.pathname, req, res);
        return;
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
        return;
      }
    }

    // Пропускаем статические файлы через Vite middleware
    viteMiddleware.handle(req, res, async () => {
      // Если Vite не обработал — возвращаем index.html
      try {
        const indexPath = join(viteServer.config.root, "index.html");
        const template = readFileSync(indexPath, "utf-8");
        const transformed = await viteServer.transformIndexHtml(
          url.pathname,
          template
        );
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(transformed);
      } catch (err) {
        console.error("Ошибка обработки запроса:", err);
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("Internal Server Error");
      }
    });
  });

  return { server: httpServer, vite: viteServer };
}

/** Запускает приложение. */
export async function startServer(): Promise<void> {
  logStart();

  // Миграция существующих пользователей
  ensureUserLevelMigration();

  const { server, vite: viteServer } = await createApp();

  server.listen(3000, () => {
    console.log("Сервер запущен на http://localhost:3000");
  });

  process.on("SIGINT", () => {
    viteServer.close().then(() => {
      logEnd();
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    viteServer.close().then(() => {
      logEnd();
      process.exit(0);
    });
  });
}
