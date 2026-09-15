import { appendFileSync } from "node:fs";
import { join } from "node:path";

const LOG_FILE = join(process.cwd(), "log.txt");

/** Записывает сообщение в лог-файл с временной меткой. */
function logMessage(message: string): void {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;
  appendFileSync(LOG_FILE, entry);
}

/** Записывает начало работы программы. */
export function logStart(): void {
  try {
    logMessage("Программа запущена");
  } catch (err) {
    console.error("Ошибка при записи в лог (start):", err);
  }
}

/** Записывает завершение работы программы. */
export function logEnd(): void {
  try {
    logMessage("Программа завершена");
  } catch (err) {
    console.error("Ошибка при записи в лог (end):", err);
  }
}

/** Записывает факт входа пользователя. */
export function logLogin(login: string): void {
  try {
    logMessage(`Вход: ${login}`);
  } catch (err) {
    console.error("Ошибка при записи в лог (login):", err);
  }
}
