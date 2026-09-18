import type { IncomingMessage, ServerResponse } from "node:http";
import { generateSalt, hashPassword, verifyPassword } from "./crypto";
import {
  addSolvedExample,
  createUserLevelFiles,
  findUserByLogin,
  getAllExpressionsForLevel,
  getUnsolvedExamplesFromLevel,
  INITIAL_WEIGHT,
  readSolvedExamples,
  readUserCurrentWeights,
  readUsers,
  updateUser,
  writeUserCurrentWeights,
  addUser,
} from "./csv";
import { createSession, extractLoginByToken } from "./session";
import { logLogin } from "../logger.js";
import type {
  LoginResponse,
  MeResponse,
  RegisterResponse,
  SaveScoreResponse,
  SubmitAnswerResponse,
  WeightEntry,
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
    level: 1,
  });

  // Создаём папку пользователя с current.csv и solved.csv
  const examples = getAllExpressionsForLevel(1);
  createUserLevelFiles(login, examples);

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
      level: user.level,
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
      level: user.level,
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

/**
 * POST /api/submit-answer
 * Обновляет веса примеров после ответа пользователя. Требует Bearer токен.
 */
export async function handleSubmitAnswer(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: "Требуется авторизация" });
    return;
  }

  const body = (await parseBody(req)) as {
    expression?: string;
    correct?: boolean;
    correctStreak?: number;
  };
  const { expression, correct, correctStreak } = body;

  if (typeof expression !== "string" || typeof correct !== "boolean") {
    sendJson(res, 400, { error: "Укажите выражение и результат ответа" });
    return;
  }

  const login = extractLoginByToken(token);
  if (!login) {
    sendJson(res, 401, { error: "Сессия истекла или токен недействителен" });
    return;
  }

  // Читаем текущие веса
  let currentEntries = readUserCurrentWeights(login);

  // Корректируем вес примера
  adjustWeightEntries(currentEntries, expression, correct);

  // Применяем глобальное снижение (correctStreak уже инкрементирован на клиенте)
  const streak = typeof correctStreak === "number" ? correctStreak : 0;
  applyGlobalReductionEntries(currentEntries, streak);

  // Получаем уровень пользователя
  const user = findUserByLogin(login);
  const currentLevel = user?.level ?? 1;

  // Собираем ВСЕ примеры с весом 0
  const zeroWeightExpressions = new Set<string>();
  for (const e of currentEntries) {
    if (e.weight === 0) {
      zeroWeightExpressions.add(e.expression);
    }
  }

  // Переносим все примеры с весом 0 в solved и удаляем из current
  if (zeroWeightExpressions.size > 0) {
    for (const expr of zeroWeightExpressions) {
      const e = currentEntries.find((e) => e.expression === expr);
      if (e) {
        addSolvedExample(login, expr, e.level);
      }
    }
    currentEntries = currentEntries.filter((e) => !zeroWeightExpressions.has(e.expression));
  }

  // Проверяем, все ли примеры текущего уровня «использованы»:
  // «Использован» = был в current.csv → сейчас в current.csv или solved.csv
  const allExprsForLevel = new Set(getAllExpressionsForLevel(currentLevel));
  const solvedExamples = readSolvedExamples(login);
  const solvedForLevel = new Set(
    solvedExamples.filter((e) => e.level === currentLevel).map((e) => e.expression)
  );
  const currentForLevel = new Set(
    currentEntries.filter((e) => e.level === currentLevel).map((e) => e.expression)
  );
  const allUsed = [...allExprsForLevel].every(
    (expr) => solvedForLevel.has(expr) || currentForLevel.has(expr)
  );

  if (allUsed && zeroWeightExpressions.size > 0) {
    // Все примеры уровня использованы + есть вес 0 → переход на уровень
    // Добавляем по одному примеру из следующего уровня на каждый удалённый
    for (let i = 0; i < zeroWeightExpressions.size; i++) {
      const newExamples = getUnsolvedExamplesFromLevel(
        login,
        currentLevel + 1,
        new Set(currentEntries.map((e) => e.expression))
      );
      if (newExamples.length > 0) {
        currentEntries.push({ expression: newExamples[0], weight: INITIAL_WEIGHT, level: currentLevel + 1 });
      }
    }
    updateUser(login, { level: currentLevel + 1 });
  } else if (zeroWeightExpressions.size > 0) {
    // Не все примеры уровня использованы, но есть вес 0 → добавляем N новых (по одному на каждый удалённый)
    for (let i = 0; i < zeroWeightExpressions.size; i++) {
      const currentLevelEntries = currentEntries.filter((e) => e.level === currentLevel);
      const newExamples = getUnsolvedExamplesFromLevel(
        login,
        currentLevel,
        new Set(currentLevelEntries.map((e) => e.expression))
      );
      if (newExamples.length > 0) {
        currentEntries.push({ expression: newExamples[0], weight: INITIAL_WEIGHT, level: currentLevel });
      }
    }
  }

  writeUserCurrentWeights(login, currentEntries);

  // Обновляем user, чтобы получить актуальный уровень
  const updatedUser = findUserByLogin(login);

  // Формируем ответ — все примеры из current.csv
  const newWeights: WeightEntry[] = currentEntries.map(
    ({ expression, weight }) => ({ expression, weight })
  );

  const response: SubmitAnswerResponse = { newWeights, level: updatedUser?.level };
  sendJson(res, 200, response);
}

/**
 * GET /api/weights
 * Возвращает веса примеров текущего пользователя. Требует Bearer токен.
 */
export async function handleGetWeights(
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

  let currentEntries = readUserCurrentWeights(login);

  // Очищаем веса = 0 — переносим в solved
  const zeroWeightExpressions = new Set<string>();
  for (const entry of currentEntries) {
    if (entry.weight === 0) {
      addSolvedExample(login, entry.expression, entry.level);
      zeroWeightExpressions.add(entry.expression);
    }
  }
  if (zeroWeightExpressions.size > 0) {
    currentEntries = currentEntries.filter((e) => !zeroWeightExpressions.has(e.expression));
    writeUserCurrentWeights(login, currentEntries);
  }

  const weightEntries: WeightEntry[] = currentEntries.map(
    ({ expression, weight }) => ({ expression, weight })
  );

  console.log(`[handleGetWeights] ${login}: ${weightEntries.length} entries, expressions: ${weightEntries.map(e => e.expression).join(", ")}`);

  sendJson(res, 200, { weights: weightEntries });
}

/** Корректирует вес примера в массиве записей: верный ответ -1, неверный +2 (максимум 10). */
function adjustWeightEntries(
  entries: import("./csv").CurrentEntry[],
  expression: string,
  correct: boolean,
): void {
  const entry = entries.find((e) => e.expression === expression);
  if (!entry) return;
  const newWeight = correct ? entry.weight - 1 : Math.min(10, entry.weight + 2);
  entry.weight = Math.max(0, newWeight);
}

/** Применяет глобальное снижение весов каждые N верных ответов.
 * correctStreak уже инкрементирован на клиенте, поэтому инкремент здесь не нужен. */
function applyGlobalReductionEntries(
  entries: import("./csv").CurrentEntry[],
  correctStreak: number,
  reductionEvery: number = 10,
): number {
  if (correctStreak > 0 && correctStreak % reductionEvery === 0) {
    for (const entry of entries) {
      entry.weight = Math.max(0, entry.weight - 1);
    }
  }
  return correctStreak % reductionEvery;
}
