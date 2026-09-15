import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { User } from "./types";

const DATA_DIR = join(process.cwd(), "data");
const USERS_CSV = join(DATA_DIR, "users.csv");
const HEADER = "login,passwordHash,lastLogin,totalScore";

/** Гарантирует, что директория data/ существует. */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    appendFileSync(USERS_CSV, HEADER + "\n");
  }
}

/** Читает всех пользователей из CSV. */
export function readUsers(): User[] {
  ensureDataDir();
  const content = readFileSync(USERS_CSV, "utf-8");
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
  const lines = [HEADER];
  for (const user of users) {
    lines.push(`${user.login},${user.passwordHash},${user.lastLogin},${user.totalScore}`);
  }
  writeFileSync(USERS_CSV, lines.join("\n") + "\n", "utf-8");
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
