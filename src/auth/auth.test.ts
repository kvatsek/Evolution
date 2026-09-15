import { describe, expect, it, beforeEach } from "vitest";
import { generateSalt, hashPassword, verifyPassword } from "./crypto";
import {
  readUsers,
  writeUsers,
  findUserByLogin,
  addUser,
  updateUser,
} from "./csv";
import { generateToken, createSession, isSessionValid, extractLoginByToken } from "./session";
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const TEST_CSV = join(process.cwd(), "data", "users.csv");

function ensureDataDir(): void {
  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function cleanCsv(): void {
  ensureDataDir();
  try {
    unlinkSync(TEST_CSV);
  } catch {
    // файл может отсутствовать
  }
}

function initCsv(): void {
  ensureDataDir();
  appendFileSync(TEST_CSV, "login,passwordHash,lastLogin,totalScore\n", "utf-8");
}

describe("crypto", () => {
  describe("generateSalt", () => {
    it("возвращает строку длиной 32 символа (16 байт в hex)", () => {
      const salt = generateSalt();
      expect(salt).toHaveLength(32);
      expect(salt).toMatch(/^[a-f0-9]+$/);
    });

    it("генерирует уникальные соли", () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe("hashPassword", () => {
    it("возвращает строку в формате salt:hash", () => {
      const salt = generateSalt();
      const hashed = hashPassword("password123", salt);
      const parts = hashed.split(":");
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe(salt);
      expect(parts[1]).toHaveLength(64); // 32 bytes в hex
    });

    it("одинаковый пароль и соль дают одинаковый хэш", () => {
      const salt = generateSalt();
      const hash1 = hashPassword("test", salt);
      const hash2 = hashPassword("test", salt);
      expect(hash1).toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("возвращает true для правильного пароля", () => {
      const salt = generateSalt();
      const hashed = hashPassword("secret", salt);
      expect(verifyPassword("secret", hashed)).toBe(true);
    });

    it("возвращает false для неправильного пароля", () => {
      const salt = generateSalt();
      const hashed = hashPassword("secret", salt);
      expect(verifyPassword("wrong", hashed)).toBe(false);
    });

    it("возвращает false для некорректного формата хэша", () => {
      expect(verifyPassword("test", "invalidhash")).toBe(false);
      expect(verifyPassword("test", "nocolon")).toBe(false);
    });
  });
});

describe("csv", () => {
  beforeEach(() => {
    cleanCsv();
    initCsv();
  });

  describe("readUsers", () => {
    it("возвращает пустой массив для пустого CSV", () => {
      const users = readUsers();
      expect(users).toHaveLength(0);
    });

    it("читает пользователей из CSV", () => {
      appendFileSync(
        TEST_CSV,
        "ivan,s5al7:h4sh,2026-09-14T10:30:00.000Z,42\n",
        "utf-8"
      );
      const users = readUsers();
      expect(users).toHaveLength(1);
      expect(users[0].login).toBe("ivan");
      expect(users[0].totalScore).toBe(42);
    });
  });

  describe("writeUsers", () => {
    it("перезаписывает CSV корректно", () => {
      const users = [
        {
          login: "ivan",
          passwordHash: "salt:hash",
          lastLogin: "2026-09-14T10:30:00.000Z",
          totalScore: 42,
        },
      ];
      writeUsers(users);
      const content = readFileSync(TEST_CSV, "utf-8");
      expect(content).toContain("ivan,salt:hash,2026-09-14T10:30:00.000Z,42");
    });
  });

  describe("findUserByLogin", () => {
    it("возвращает undefined для несуществующего пользователя", () => {
      const result = findUserByLogin("unknown");
      expect(result).toBeUndefined();
    });

    it("находит пользователя по логину", () => {
      appendFileSync(
        TEST_CSV,
        "maria,x9mp2:k3sh1,2026-09-13T15:20:00.000Z,17\n",
        "utf-8"
      );
      const result = findUserByLogin("maria");
      expect(result).toBeDefined();
      expect(result?.login).toBe("maria");
      expect(result?.totalScore).toBe(17);
    });
  });

  describe("addUser", () => {
    it("добавляет пользователя в CSV", () => {
      const user = {
        login: "testuser",
        passwordHash: "salt:hash",
        lastLogin: "",
        totalScore: 0,
      };
      addUser(user);
      const found = findUserByLogin("testuser");
      expect(found).toBeDefined();
      expect(found?.login).toBe("testuser");
    });
  });

  describe("updateUser", () => {
    it("обновляет существующего пользователя", () => {
      appendFileSync(
        TEST_CSV,
        "updateuser,oldhash,,0\n",
        "utf-8"
      );
      updateUser("updateuser", {
        passwordHash: "newhash",
        totalScore: 10,
      });
      const found = findUserByLogin("updateuser");
      expect(found?.passwordHash).toBe("newhash");
      expect(found?.totalScore).toBe(10);
    });
  });
});

describe("session", () => {
  describe("generateToken", () => {
    it("возвращает hex-строку длиной 64 символа (32 байта)", () => {
      const token = generateToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it("генерирует уникальные токены", () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("createSession", () => {
    it("создаёт сессию с токеном и логином", () => {
      const session = createSession("ivan");
      expect(session.token).toHaveLength(64);
      expect(session.login).toBe("ivan");
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe("isSessionValid", () => {
    it("возвращает true для активной сессии", () => {
      const session = createSession("ivan");
      expect(isSessionValid(session)).toBe(true);
    });

    it("возвращает false для истёкшей сессии", () => {
      const session: any = {
        token: "abc123",
        login: "ivan",
        expiresAt: Date.now() - 1000,
      };
      expect(isSessionValid(session)).toBe(false);
    });
  });

  describe("extractLoginByToken", () => {
    it("возвращает логин для валидной сессии", () => {
      const session = createSession("ivan");
      const login = extractLoginByToken(session.token);
      expect(login).toBe("ivan");
    });

    it("возвращает null для несуществующего токена", () => {
      const login = extractLoginByToken("nonexistent");
      expect(login).toBeNull();
    });

    it("возвращает null и удаляет истёкшую сессию", () => {
      const session: any = {
        token: "expired",
        login: "ivan",
        expiresAt: Date.now() - 1000,
      };
      const login = extractLoginByToken(session.token);
      expect(login).toBeNull();
    });
  });
});
