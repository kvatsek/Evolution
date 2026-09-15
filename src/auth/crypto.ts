import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 32;
const N = 16384;
const R = 8;
const P = 1;

/** Генерирует случайную соль в виде hex-строки. */
export function generateSalt(): string {
  return randomBytes(SALT_BYTES).toString("hex");
}

/** Создаёт хэш пароля с указанной солью через PBKDF2. */
export function hashPassword(password: string, salt: string): string {
  const key = scryptSync(password, salt, KEY_BYTES, {
    N,
    r: R,
    p: P,
  });
  return `${salt}:${key.toString("hex")}`;
}

/** Проверяет пароль, сравнивая его с сохранённым хэшем формата salt:hash. */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }
  const computed = scryptSync(password, salt, KEY_BYTES, {
    N,
    r: R,
    p: P,
  });
  const storedKey = Buffer.from(hash, "hex");
  return timingSafeEqual(computed, storedKey);
}
