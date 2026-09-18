import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { User } from "./types";

/** Запись веса примера с уровнем. */
export interface CurrentEntry {
  expression: string;
  weight: number;
  level: number;
}

/** Решённый пример. */
export interface SolvedEntry {
  expression: string;
  level: number;
}

const DATA_DIR = join(process.cwd(), "data");
const HEADER = "login,passwordHash,lastLogin,totalScore,level";

/** Гарантирует, что директория существует. */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

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
    const parts = line.split(",");
    const [login, passwordHash, lastLogin, totalScoreStr, levelStr] = parts;
    return {
      login: login ?? "",
      passwordHash: passwordHash ?? "",
      lastLogin: lastLogin ?? "",
      totalScore: Number(totalScoreStr) || 0,
      level: Number(levelStr) || 1,
    };
  });
}

/** Записывает всех пользователей в CSV (перезаписывает файл). */
export function writeUsers(users: User[]): void {
  ensureDataDir();
  const csvPath = getUsersCsvPath();
  const lines = [HEADER];
  for (const user of users) {
    lines.push(`${user.login},${user.passwordHash},${user.lastLogin},${user.totalScore},${user.level}`);
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

// --- Константы ---

const WEIGHTS_HEADER = "expression,weight";
const EXAMPLE_HEADER = "expression";
export const INITIAL_WEIGHT = 5;

// --- Функции для работы с папками пользователей ---

const CURRENT_HEADER = "expression,weight,level";
const SOLVED_HEADER = "expression,level";
const EXAMPLES_PER_LEVEL: Record<number, string> = {
  1: "1_example.csv",
  2: "2_example.csv",
  3: "3_example.csv",
  4: "4_example.csv",
};

/** Возвращает путь к папке пользователя. */
export function getUserDataDir(login: string): string {
  return join(DATA_DIR, login);
}

/** Возвращает путь к current.csv пользователя. */
export function getUserCurrentWeightsPath(login: string): string {
  return join(getUserDataDir(login), "current.csv");
}

/** Возвращает путь к solved.csv пользователя. */
export function getUserSolvedPath(login: string): string {
  return join(getUserDataDir(login), "solved.csv");
}

/** Гарантирует, что директория пользователя существует. */
function ensureUserDir(login: string): void {
  const userDir = getUserDataDir(login);
  if (!existsSync(userDir)) {
    mkdirSync(userDir, { recursive: true });
  }
}

/** Читает текущие веса пользователя из current.csv. */
export function readUserCurrentWeights(login: string): CurrentEntry[] {
  ensureDataDir();
  const currentPath = getUserCurrentWeightsPath(login);
  if (!existsSync(currentPath)) {
    return [];
  }
  const content = readFileSync(currentPath, "utf-8");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== CURRENT_HEADER);

  const entries: CurrentEntry[] = [];
  for (const line of lines) {
    const parts = line.split(",");
    const [expression, weightStr, levelStr] = parts;
    entries.push({
      expression: expression ?? "",
      weight: Number(weightStr) || 0,
      level: Number(levelStr) || 1,
    });
  }
  return entries;
}

/** Записывает текущие веса пользователя в current.csv. */
export function writeUserCurrentWeights(login: string, entries: CurrentEntry[]): void {
  ensureUserDir(login);
  const currentPath = getUserCurrentWeightsPath(login);
  const lines = [CURRENT_HEADER];
  for (const entry of entries) {
    lines.push(`${entry.expression},${entry.weight},${entry.level}`);
  }
  writeFileSync(currentPath, lines.join("\n") + "\n", "utf-8");
}

/** Читает решённые примеры из solved.csv. */
export function readSolvedExamples(login: string): SolvedEntry[] {
  ensureDataDir();
  const solvedPath = getUserSolvedPath(login);
  if (!existsSync(solvedPath)) {
    return [];
  }
  const content = readFileSync(solvedPath, "utf-8");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== SOLVED_HEADER);

  const entries: SolvedEntry[] = [];
  for (const line of lines) {
    const parts = line.split(",");
    const [expression, levelStr] = parts;
    entries.push({
      expression: expression ?? "",
      level: Number(levelStr) || 1,
    });
  }
  return entries;
}

/** Добавляет решённый пример в solved.csv. */
export function addSolvedExample(login: string, expression: string, level: number): void {
  ensureUserDir(login);
  const solvedPath = getUserSolvedPath(login);
  const existing = readSolvedExamples(login);
  // Не добавляем дубликаты
  if (existing.some((e) => e.expression === expression)) {
    return;
  }
  appendFileSync(solvedPath, `${expression},${level}\n`, "utf-8");
}

/** Удаляет пример из current.csv. */
export function removeFromCurrent(login: string, expression: string): void {
  const entries = readUserCurrentWeights(login);
  const filtered = entries.filter((e) => e.expression !== expression);
  writeUserCurrentWeights(login, filtered);
}

/** Возвращает все примеры из _level_example.csv. */
export function getAllExpressionsForLevel(level: number): string[] {
  ensureDataDir();
  const examplesFile = EXAMPLES_PER_LEVEL[level];
  if (!examplesFile) {
    return [];
  }
  const examplesPath = join(DATA_DIR, examplesFile);
  if (!existsSync(examplesPath)) {
    return [];
  }
  const content = readFileSync(examplesPath, "utf-8");
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== WEIGHTS_HEADER && line !== EXAMPLE_HEADER);
  return lines;
}

/** Возвращает нерешённые примеры из файла уровня. */
export function getUnsolvedExamplesFromLevel(
  login: string,
  level: number,
  currentExpressions: Set<string>
): string[] {
  const allExpressions = getAllExpressionsForLevel(level);
  const solved = readSolvedExamples(login);
  const solvedExpressions = new Set(solved.map((e) => e.expression));
  return allExpressions.filter(
    (expr) => !currentExpressions.has(expr) && !solvedExpressions.has(expr)
  );
}

/** Проверяет условие перехода на следующий уровень. */
export function checkLevelAdvance(
  login: string,
  currentEntries: CurrentEntry[],
  solvedEntries: SolvedEntry[]
): number | null {
  const user = findUserByLogin(login);
  if (!user || user.level < 1 || user.level >= 4) {
    return null;
  }

  const nextLevel = user.level + 1;
  const currentForLevel = currentEntries.filter((e) => e.level === user.level);

  // Проверяем, есть ли хотя бы один пример текущего уровня с весом 0
  const hasZeroWeight = currentForLevel.some((e) => e.weight === 0);
  if (!hasZeroWeight) {
    return null;
  }

  // Проверяем, решены ли все примеры предыдущих уровней
  for (let lvl = 1; lvl < user.level; lvl++) {
    const allExprs = new Set(getAllExpressionsForLevel(lvl));
    // Решённые примеры предыдущего уровня (из solved.csv с правильным уровнем)
    const solvedForLvl = new Set(
      solvedEntries.filter((e) => e.level === lvl).map((e) => e.expression)
    );
    // Примеры текущего уровня, которые ещё в current.csv (не удалены)
    const currentForPrevLvl = new Set(
      currentEntries.filter((e) => e.level === lvl).map((e) => e.expression)
    );

    // Проверяем, что все примеры предыдущего уровня либо решены, либо ещё в current
    for (const expr of allExprs) {
      if (!solvedForLvl.has(expr) && !currentForPrevLvl.has(expr)) {
        // Пример пропал — считаем что решён (удалён из current и добавлен в solved)
        return null;
      }
    }
  }

  return nextLevel;
}

/** Создаёт папку пользователя с current.csv и solved.csv при регистрации. */
export function createUserLevelFiles(login: string, examples: string[]): void {
  ensureUserDir(login);
  const entries: CurrentEntry[] = [];
  for (const expression of examples) {
    entries.push({ expression, weight: INITIAL_WEIGHT, level: 1 });
  }
  writeUserCurrentWeights(login, entries);
  // Создаём пустой solved.csv
  const solvedPath = getUserSolvedPath(login);
  if (!existsSync(solvedPath)) {
    writeFileSync(solvedPath, SOLVED_HEADER + "\n", "utf-8");
  }
  // Обновляем уровень пользователя
  updateUser(login, { level: 1 });
}



/** Переносит пользователя на следующий уровень. */
export function advanceLevel(
  login: string,
  newExamples: string[],
  entries?: CurrentEntry[],
  targetLevel?: number
): void {
  const currentEntries = entries ?? readUserCurrentWeights(login);
  // Используем targetLevel из checkLevelAdvance, иначе вычисляем из maxLevel
  const newLevel = targetLevel ?? (currentEntries.length > 0
    ? Math.max(...currentEntries.map((e) => e.level)) + 1
    : 2);

  // Обновляем уровень пользователя
  updateUser(login, { level: newLevel });

  // Добавляем новые примеры с новым уровнем
  for (const expression of newExamples) {
    currentEntries.push({ expression, weight: INITIAL_WEIGHT, level: newLevel });
  }

  writeUserCurrentWeights(login, currentEntries);
}

/** Миграция существующих пользователей из старой структуры в новую. */
export function ensureUserLevelMigration(): void {
  const users = readUsers();
  let needsWrite = false;

  for (const user of users) {
    if (!user.level || user.level === 0) {
      migrateUserToLevelStructure(user.login);
      needsWrite = true;
    }
  }

  if (needsWrite) {
    writeUsers(users);
  }

  // Очищаем веса = 0 у всех пользователей при каждом запуске
  cleanZeroWeightsForAllUsers();
}

/** Переносит все примеры с весом 0 в solved.csv для всех пользователей. */
function cleanZeroWeightsForAllUsers(): void {
  const users = readUsers();
  for (const user of users) {
    const currentEntries = readUserCurrentWeights(user.login);
    const zeroWeightExpressions = new Set<string>();
    for (const entry of currentEntries) {
      if (entry.weight === 0) {
        addSolvedExample(user.login, entry.expression, entry.level);
        zeroWeightExpressions.add(entry.expression);
      }
    }
    if (zeroWeightExpressions.size > 0) {
      const filtered = currentEntries.filter((e) => !zeroWeightExpressions.has(e.expression));
      writeUserCurrentWeights(user.login, filtered);
    }
  }
}

function migrateUserToLevelStructure(login: string): void {
  const oldWeightsPath = join(DATA_DIR, `weights_${login}.csv`);
  if (!existsSync(oldWeightsPath)) return;

  const oldWeights = readFileSync(oldWeightsPath, "utf-8");
  const lines = oldWeights
    .split("\n")
    .filter((l) => l.trim() && l.trim() !== WEIGHTS_HEADER)
    .map((l) => {
      const parts = l.split(",");
      return { expression: parts[0], weight: Number(parts[1]) || 0 };
    });

  const currentEntries: CurrentEntry[] = [];
  const solvedExpressions: string[] = [];

  for (const entry of lines) {
    if (entry.weight === 0) {
      solvedExpressions.push(entry.expression);
    } else {
      currentEntries.push({ expression: entry.expression, weight: entry.weight, level: 1 });
    }
  }

  const userDir = join(DATA_DIR, login);
  ensureDir(userDir);

  const currentLines = ["expression,weight,level"];
  for (const entry of currentEntries) {
    currentLines.push(`${entry.expression},${entry.weight},${entry.level}`);
  }
  writeFileSync(join(userDir, "current.csv"), currentLines.join("\n") + "\n", "utf-8");

  const solvedLines = ["expression,level"];
  for (const expr of solvedExpressions) {
    solvedLines.push(`${expr},1`);
  }
  writeFileSync(join(userDir, "solved.csv"), solvedLines.join("\n") + "\n", "utf-8");

  updateUser(login, { level: 1 });
  unlinkSync(oldWeightsPath);
}


