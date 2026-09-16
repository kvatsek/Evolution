import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { User } from "./types";

const DATA_DIR = join(process.cwd(), "data");
const HEADER = "login,passwordHash,lastLogin,totalScore";

/** Возвращает путь к CSV-файлу (тестовый или продакшн). */
function getUsersCsvPath(): string {
  return join(DATA_DIR, process.env.TEST_USERS_CSV ?? "users.csv");
}

/** Гарантирует, что директория data/ существует. */
function ensureDataDir(): void {
  const csvPath = getUsersCsvPath();
  if (!existsSync(DATA_DIR)) {
    appendFileSync(csvPath, HEADER + "\n");
  }
}

/** Читает всех пользователей из CSV. */
export function readUsers(): User[] {
  ensureDataDir();
  const content = readFileSync(getUsersCsvPath(), "utf-8");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== HEADER);

  return lines.map((line) => {
    const [login, passwordHash, lastLogin, totalScore] = line.split(",");
    return {
      login: login ?? "",
      passwordHash: passwordHash ?? "",
      lastLogin: lastLogin ?? "",
      totalScore: Number(totalScore) || 0,
    };
  });
}

/** Записывает всех пользователей в CSV (перезаписывает файл). */
export function writeUsers(users: User[]): void {
  ensureDataDir();
  const csvPath = getUsersCsvPath();
  const lines = [HEADER];
  for (const user of users) {
    lines.push(`${user.login},${user.passwordHash},${user.lastLogin},${user.totalScore}`);
  }
  writeFileSync(csvPath, lines.join("\n") + "\n", "utf-8");
}

/** Ищет пользователя по логину. Возвращает undefined, если не найден. */
export function findUserByLogin(login: string): User | undefined {
  const users = readUsers();
  return users.find((u) => u.login === login);
}

/** Добавляет нового пользователя в CSV. */
export function addUser(user: User): void {
  const users = readUsers();
  users.push(user);
  writeUsers(users);
}

/** Обновляет существующего пользователя в CSV. */
export function updateUser(login: string, updates: Partial<User>): void {
  const users = readUsers();
  const index = users.findIndex((u) => u.login === login);
  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
    writeUsers(users);
  }
}

// --- Функции для работы с весами примеров ---

const EXAMPLES_CSV = "examples.csv";
const WEIGHTS_HEADER = "expression,weight";
const INITIAL_WEIGHT = 5;

/** Возвращает путь к CSV-файлу весов для пользователя. */
export function getUserWeightsPath(login: string): string {
  return join(DATA_DIR, `weights_${login}.csv`);
}

/** Читает все примеры из общего файла examples.csv. */
export function getAllExpressions(): string[] {
  ensureDataDir();
  const examplesPath = join(DATA_DIR, EXAMPLES_CSV);
  const content = readFileSync(examplesPath, "utf-8");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== WEIGHTS_HEADER);
  return lines;
}

/** Читает веса примеров для пользователя. */
export function readUserWeights(login: string): Map<string, number> {
  ensureDataDir();
  const weightsPath = getUserWeightsPath(login);
  if (!existsSync(weightsPath)) {
    return new Map();
  }
  const content = readFileSync(weightsPath, "utf-8");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== WEIGHTS_HEADER);

  const weights = new Map<string, number>();
  for (const line of lines) {
    const [expression, weightStr] = line.split(",");
    weights.set(expression ?? "", Number(weightStr) || 0);
  }
  return weights;
}

/** Записывает веса примеров для пользователя. */
export function writeUserWeights(login: string, weights: Map<string, number>): void {
  ensureDataDir();
  const weightsPath = getUserWeightsPath(login);
  const lines = [WEIGHTS_HEADER];
  for (const [expression, weight] of weights) {
    lines.push(`${expression},${weight}`);
  }
  writeFileSync(weightsPath, lines.join("\n") + "\n", "utf-8");
}

/** Создаёт файл весов для нового пользователя (все веса = INITIAL_WEIGHT). */
export function createUserWeights(login: string, examples: string[]): void {
  const weights = new Map<string, number>();
  for (const expression of examples) {
    weights.set(expression, INITIAL_WEIGHT);
  }
  writeUserWeights(login, weights);
}
