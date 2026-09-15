import { randomBytes } from "node:crypto";
import type { Session } from "./types";

const TOKEN_BYTES = 32;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

/** Маппинг токен → сессия. */
const sessionsByToken = new Map<string, Session>();

/** Генерирует случайный токен в виде hex-строки. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** Создаёт сессию с токеном и временем истечения. */
export function createSession(login: string): Session {
  const now = Date.now();
  const token = generateToken();
  const session: Session = {
    token,
    login,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessionsByToken.set(token, session);
  return session;
}

/** Проверяет, не истёк ли срок действия сессии. */
export function isSessionValid(session: Session): boolean {
  return Date.now() < session.expiresAt;
}

/** Извлекает логин по токену. Возвращает null, если токен не найден или истёк. */
export function extractLoginByToken(token: string): string | null {
  const session = sessionsByToken.get(token);
  if (!session || !isSessionValid(session)) {
    sessionsByToken.delete(token);
    return null;
  }
  return session.login;
}
