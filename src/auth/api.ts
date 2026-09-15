import type { IncomingMessage, ServerResponse } from "node:http";
import { generateSalt, hashPassword, verifyPassword } from "./crypto";
import { addUser, findUserByLogin, readUsers, updateUser } from "./csv";
import { createSession, extractLoginByToken } from "./session";
import { logLogin } from "../logger.js";
import type {
  LoginResponse,
  MeResponse,
  RegisterResponse,
  SaveScoreResponse,
} from "./types";

/** Парсит JSON тело запроса. */
function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/** Отправляет JSON ответ. */
function sendJson(
  res: ServerResponse,
  status: number,
  data: unknown
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/** Извлекает Bearer токен из заголовка Authorization. */
function extractBearerToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * POST /api/register
 * Регистрирует нового пользователя.
 */
export async function handleRegister(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = (await parseBody(req)) as { login?: string; password?: string };
  const { login, password } = body;

  if (!login || !password) {
    sendJson(res, 400, { error: "Укажите логин и пароль" });
    return;
  }

  const existing = findUserByLogin(login);
  if (existing) {
    sendJson(res, 400, { error: "Пользователь уже существует" });
    return;
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  addUser({
    login,
    passwordHash,
    lastLogin: "",
    totalScore: 0,
  });

  const response: RegisterResponse = {
    user: {
      login,
      totalScore: 0,
      lastLogin: "",
    },
  };

  sendJson(res, 201, response);
}

/**
 * POST /api/login
 * Аутентифицирует пользователя и возвращает токен сессии.
 */
export async function handleLogin(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = (await parseBody(req)) as { login?: string; password?: string };
  const { login, password } = body;

  if (!login || !password) {
    sendJson(res, 400, { error: "Укажите логин и пароль" });
    return;
  }

  const user = findUserByLogin(login);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    sendJson(res, 401, { error: "Неверный пароль" });
    return;
  }

  const session = createSession(login);

  logLogin(user.login);
  const newLastLogin = new Date().toISOString();
  updateUser(login, {
    lastLogin: newLastLogin,
  });

  const response: LoginResponse = {
    token: session.token,
    user: {
      login: user.login,
      totalScore: user.totalScore,
      lastLogin: newLastLogin,
    },
  };

  sendJson(res, 200, response);
}

/**
 * POST /api/save-score
 * Сохраняет счёт игрока. Требует Bearer токен.
 */
export async function handleSaveScore(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: "Требуется авторизация" });
    return;
  }

  const body = (await parseBody(req)) as { score?: number };
  const { score } = body;
  if (typeof score !== "number" || score < 0) {
    sendJson(res, 400, { error: "Укажите корректный счёт" });
    return;
  }

  const login = extractLoginByToken(token);
  if (!login) {
    sendJson(res, 401, { error: "Сессия истекла или токен недействителен" });
    return;
  }

  const user = findUserByLogin(login);
  if (!user) {
    sendJson(res, 404, { error: "Пользователь не найден" });
    return;
  }

  const newTotalScore = user.totalScore + score;
  updateUser(login, { totalScore: newTotalScore });

  const response: SaveScoreResponse = {
    totalScore: newTotalScore,
  };

  sendJson(res, 200, response);
}

/**
 * GET /api/me
 * Возвращает информацию о текущем пользователе. Требует Bearer токен.
 */
export async function handleMe(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: "Требуется авторизация" });
    return;
  }

  const login = extractLoginByToken(token);
  if (!login) {
    sendJson(res, 401, { error: "Сессия истекла или токен недействителен" });
    return;
  }

  const user = findUserByLogin(login);
  if (!user) {
    sendJson(res, 404, { error: "Пользователь не найден" });
    return;
  }

  const response: MeResponse = {
    user: {
      login: user.login,
      totalScore: user.totalScore,
      lastLogin: user.lastLogin,
    },
  };

  sendJson(res, 200, response);
}

/**
 * GET /api/users
 * Возвращает список логинов всех пользователей.
 */
export async function handleUsers(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const users = readUsers();
  const logins = users.map((u) => u.login);
  sendJson(res, 200, { users: logins });
}
