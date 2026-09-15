import { describe, expect, it, beforeEach } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  handleRegister,
  handleLogin,
  handleSaveScore,
  handleMe,
} from "./api";
import { createSession } from "./session";
import { appendFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
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

/** Создаёт IncomingMessage с JSON телом. */
function createMockReq(
  body: unknown,
  extraHeaders: Record<string, string> = {}
): IncomingMessage {
  const json = JSON.stringify(body);
  const stream = Readable.from([Buffer.from(json)]);
  const req = stream as unknown as IncomingMessage;
  req.headers = { ...extraHeaders, "content-length": `${Buffer.byteLength(json)}` };
  return req;
}

/** Создаёт ServerResponse, собирающий данные. */
function createMockRes(): {
  res: ServerResponse;
  _data: string;
  _status: number;
} {
  let _status = 200;
  let _data = "";
  return {
    res: {
      writeHead(status: number, _headers?: Record<string, string>) {
        _status = status;
      },
      end(data?: string) {
        _data = data ?? "";
      },
      on() {},
      once() {},
      removeListener() {},
      off() {},
      setHeader() {},
      getHeader() { return undefined; },
      removeHeader() {},
      hasHeader() { return false; },
      headersSent: false,
      getHeaderNames() { return []; },
      getHeaders() { return {}; },
      flushHeaders() {},
      write() { return true; },
    } as unknown as ServerResponse,
    get _data() { return _data; },
    get _status() { return _status; },
  };
}

describe("api", () => {
  beforeEach(() => {
    cleanCsv();
    initCsv();
  });

  describe("handleRegister", () => {
    it("создаёт пользователя и возвращает 201", async () => {
      const req = createMockReq({ login: "ivan", password: "secret" });
      const mock = createMockRes();
      await handleRegister(req, mock.res);

      expect(mock._status).toBe(201);
      const parsed = JSON.parse(mock._data);
      expect(parsed.user.login).toBe("ivan");
      expect(parsed.user.totalScore).toBe(0);
    });

    it("возвращает 400 при дубликате", async () => {
      // Сначала регистрируем
      const req1 = createMockReq({ login: "ivan", password: "secret" });
      const mock1 = createMockRes();
      await handleRegister(req1, mock1.res);

      // Пытаемся зарегистрировать того же
      const req2 = createMockReq({ login: "ivan", password: "secret2" });
      const mock2 = createMockRes();
      await handleRegister(req2, mock2.res);

      expect(mock2._status).toBe(400);
      const parsed = JSON.parse(mock2._data);
      expect(parsed.error).toBe("Пользователь уже существует");
    });

    it("возвращает 400 при пустом теле", async () => {
      const req = createMockReq({});
      const mock = createMockRes();
      await handleRegister(req, mock.res);

      expect(mock._status).toBe(400);
      const parsed = JSON.parse(mock._data);
      expect(parsed.error).toBe("Укажите логин и пароль");
    });
  });

  describe("handleLogin", () => {
    it("возвращает токен при правильном пароле", async () => {
      // Сначала регистрируем
      const regReq = createMockReq({ login: "ivan", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      // Теперь входим
      const loginReq = createMockReq({ login: "ivan", password: "secret" });
      const loginMock = createMockRes();
      await handleLogin(loginReq, loginMock.res);

      expect(loginMock._status).toBe(200);
      const parsed = JSON.parse(loginMock._data);
      expect(parsed.token).toBeDefined();
      expect(parsed.token).toHaveLength(64);
      expect(parsed.user.login).toBe("ivan");
    });

    it("возвращает 401 при неверном пароле", async () => {
      // Сначала регистрируем
      const regReq = createMockReq({ login: "ivan", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      // Пытаемся войти с неверным паролем
      const loginReq = createMockReq({ login: "ivan", password: "wrong" });
      const loginMock = createMockRes();
      await handleLogin(loginReq, loginMock.res);

      expect(loginMock._status).toBe(401);
      const parsed = JSON.parse(loginMock._data);
      expect(parsed.error).toBe("Неверный пароль");
    });
  });

  describe("handleSaveScore", () => {
    it("возвращает 401 без токена", async () => {
      const req = createMockReq({ score: 5 });
      const mock = createMockRes();
      await handleSaveScore(req, mock.res);

      expect(mock._status).toBe(401);
    });

    it("возвращает 400 при некорректном счёте", async () => {
      const token = createSession("ivan").token;
      const req = createMockReq({ score: -1 }, { authorization: `Bearer ${token}` });
      const mock = createMockRes();
      await handleSaveScore(req, mock.res);

      expect(mock._status).toBe(400);
    });
  });

  describe("handleMe", () => {
    it("возвращает 401 без токена", async () => {
      const req = createMockReq({});
      const mock = createMockRes();
      await handleMe(req, mock.res);

      expect(mock._status).toBe(401);
    });
  });
});
