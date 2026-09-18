import { describe, expect, it, beforeEach } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  handleRegister,
  handleLogin,
  handleSaveScore,
  handleMe,
  handleUsers,
  handleSubmitAnswer,
  handleGetWeights,
} from "./api";
import { createSession } from "./session";
import { appendFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { readUserCurrentWeights, readSolvedExamples } from "./csv";

const TEST_CSV = join(process.cwd(), "data", "users.test.csv");

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
  appendFileSync(TEST_CSV, "login,passwordHash,lastLogin,totalScore,level\n", "utf-8");
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

  describe("handleUsers", () => {
    it("возвращает список логинов пользователей", async () => {
      // Сначала регистрируем двух пользователей
      const regReq1 = createMockReq({ login: "alice", password: "secret" });
      const regMock1 = createMockRes();
      await handleRegister(regReq1, regMock1.res);

      const regReq2 = createMockReq({ login: "bob", password: "secret" });
      const regMock2 = createMockRes();
      await handleRegister(regReq2, regMock2.res);

      // Теперь запрашиваем список
      const usersReq = createMockReq({});
      const usersMock = createMockRes();
      await handleUsers(usersReq, usersMock.res);

      expect(usersMock._status).toBe(200);
      const parsed = JSON.parse(usersMock._data);
      expect(parsed.users).toContain("alice");
      expect(parsed.users).toContain("bob");
    });

    it("возвращает пустой список, если пользователей нет", async () => {
      const usersReq = createMockReq({});
      const usersMock = createMockRes();
      await handleUsers(usersReq, usersMock.res);

      expect(usersMock._status).toBe(200);
      const parsed = JSON.parse(usersMock._data);
      expect(parsed.users).toEqual([]);
    });
  });

  describe("handleSubmitAnswer", () => {
    it("возвращает 401 без токена", async () => {
      const req = createMockReq({ expression: "2+3", correct: true });
      const mock = createMockRes();
      await handleSubmitAnswer(req, mock.res);

      expect(mock._status).toBe(401);
    });

    it("возвращает 400 при отсутствии выражения", async () => {
      const token = createSession("ivan").token;
      const req = createMockReq({ correct: true }, { authorization: `Bearer ${token}` });
      const mock = createMockRes();
      await handleSubmitAnswer(req, mock.res);

      expect(mock._status).toBe(400);
    });

    it("корректно обрабатывает верный ответ", async () => {
      // Сначала регистрируем пользователя
      const regReq = createMockReq({ login: "ivan", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      // Создаём сессию
      const token = createSession("ivan").token;

      // Отправляем верный ответ
      const submitReq = createMockReq(
        { expression: "2+3", correct: true, correctStreak: 0 },
        { authorization: `Bearer ${token}` }
      );
      const submitMock = createMockRes();
      await handleSubmitAnswer(submitReq, submitMock.res);

      expect(submitMock._status).toBe(200);
      const parsed = JSON.parse(submitMock._data);
      expect(parsed.newWeights).toBeDefined();
      expect(Array.isArray(parsed.newWeights)).toBe(true);

      // Проверяем, что вес для "2+3" уменьшился с 5 до 4
      const weightEntry = parsed.newWeights.find(
        (w: { expression: string }) => w.expression === "2+3"
      );
      expect(weightEntry).toBeDefined();
      expect(weightEntry!.weight).toBe(4);
    });

    it("корректно обрабатывает неверный ответ", async () => {
      // Сначала регистрируем пользователя
      const regReq = createMockReq({ login: "bob", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      const token = createSession("bob").token;

      // Отправляем неверный ответ
      const submitReq = createMockReq(
        { expression: "1+2", correct: false, correctStreak: 0 },
        { authorization: `Bearer ${token}` }
      );
      const submitMock = createMockRes();
      await handleSubmitAnswer(submitReq, submitMock.res);

      expect(submitMock._status).toBe(200);
      const parsed = JSON.parse(submitMock._data);

      // Проверяем, что вес для "1+2" увеличился с 5 до 7
      const weightEntry = parsed.newWeights.find((w: { expression: string }) => w.expression === "1+2");
      expect(weightEntry).toBeDefined();
      expect(weightEntry.weight).toBe(7);
    });

    it("создаёт папку пользователя с current.csv при регистрации", async () => {
      const regReq = createMockReq({ login: "charlie", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      expect(regMock._status).toBe(201);

      // Проверяем, что current.csv создан
      const entries = readUserCurrentWeights("charlie");
      expect(entries.length).toBeGreaterThan(0);

      // Все веса должны быть равны 5
      for (const entry of entries) {
        expect(entry.weight).toBe(5);
      }
    });

    it("применяет глобальное снижение после 10 верных ответов", async () => {
      const regReq = createMockReq({ login: "globaltest", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      const token = createSession("globaltest").token;

      // Отправляем 10 верных ответов разными выражениями,
      // чтобы adjustWeight не обнулил веса до глобального снижения
      const expressions = [
        "0+0", "0+1", "0+2", "0+3", "0+4",
        "1+0", "1+1", "1+2", "1+3", "1+4",
      ];
      for (let i = 0; i < 10; i++) {
        const submitReq = createMockReq(
          { expression: expressions[i], correct: true, correctStreak: i + 1 },
          { authorization: `Bearer ${token}` }
        );
        const submitMock = createMockRes();
        await handleSubmitAnswer(submitReq, submitMock.res);
        expect(submitMock._status).toBe(200);
      }

      // После 10 верных ответов все веса должны быть 3 (5 - 1 adjustWeight - 1 глобальное)
      const currentEntries = readUserCurrentWeights("globaltest");
      const currentMap = new Map(currentEntries.map((e) => [e.expression, e.weight]));
      for (const expression of expressions) {
        expect(currentMap.get(expression)).toBe(3);
      }
      // Неиспользованные выражения: только глобальное снижение 5→4
      let untouchedCount = 0;
      for (const entry of currentEntries) {
        if (!expressions.includes(entry.expression)) {
          expect(entry.weight).toBe(4);
          untouchedCount++;
        }
      }
      expect(untouchedCount).toBeGreaterThan(0);
    });

    it("не применяет глобальное снижение до 10 верных ответов", async () => {
      const regReq = createMockReq({ login: "nostreak", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      const token = createSession("nostreak").token;

      // Отправляем 5 верных ответов
      for (let i = 0; i < 5; i++) {
        const submitReq = createMockReq(
          { expression: "1+2", correct: true, correctStreak: i + 1 },
          { authorization: `Bearer ${token}` }
        );
        const submitMock = createMockRes();
        await handleSubmitAnswer(submitReq, submitMock.res);
        expect(submitMock._status).toBe(200);
      }

      // "1+2" должен быть перенесён в solved и удалён из current (вес достиг 0)
      const currentEntries = readUserCurrentWeights("nostreak");
      expect(currentEntries.some((e) => e.expression === "1+2")).toBe(false);

      // Другие веса должны быть 5
      let otherCount = 0;
      for (const entry of currentEntries) {
        expect(entry.weight).toBe(5);
        otherCount++;
      }
      expect(otherCount).toBeGreaterThan(0);
    });
  });

  describe("handleGetWeights", () => {
    it("возвращает 401 без токена", async () => {
      const req = createMockReq({});
      const mock = createMockRes();
      await handleGetWeights(req, mock.res);

      expect(mock._status).toBe(401);
    });

    it("возвращает веса пользователя", async () => {
      // Сначала регистрируем пользователя
      const regReq = createMockReq({ login: "diana", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      const token = createSession("diana").token;

      // Запрашиваем веса
      const weightsReq = createMockReq({}, { authorization: `Bearer ${token}` });
      const weightsMock = createMockRes();
      await handleGetWeights(weightsReq, weightsMock.res);

      expect(weightsMock._status).toBe(200);
      const parsed = JSON.parse(weightsMock._data);
      expect(parsed.weights).toBeDefined();
      expect(Array.isArray(parsed.weights)).toBe(true);
      expect(parsed.weights.length).toBeGreaterThan(0);

      // Проверяем, что все веса равны 5 (по умолчанию)
      for (const weightEntry of parsed.weights) {
        expect(weightEntry.weight).toBe(5);
      }
    });
  });

  describe("handleRegister with levels", () => {
    it("создаёт папку пользователя с current.csv и solved.csv", async () => {
      const regReq = createMockReq({ login: "leveluser", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      expect(regMock._status).toBe(201);

      // Проверяем, что current.csv создан
      const currentEntries = readUserCurrentWeights("leveluser");
      expect(currentEntries.length).toBeGreaterThan(0);

      // Все примеры должны быть уровня 1
      for (const entry of currentEntries) {
        expect(entry.level).toBe(1);
        expect(entry.weight).toBe(5);
      }

      // Проверяем, что solved.csv создан
      const solved = readSolvedExamples("leveluser");
      expect(solved).toEqual([]);
    });
  });

  describe("handleSubmitAnswer with weight=0", () => {
    it("переносит пример в solved.csv при весе 0", async () => {
      // Сначала регистрируем пользователя
      const regReq = createMockReq({ login: "zeroweight", password: "secret" });
      const regMock = createMockRes();
      await handleRegister(regReq, regMock.res);

      const token = createSession("zeroweight").token;

      // Отправляем много верных ответов, чтобы обнулить вес
      // Вес начинается с 5, каждый верный ответ -1
      for (let i = 0; i < 5; i++) {
        const submitReq = createMockReq(
          { expression: "2+3", correct: true, correctStreak: i + 1 },
          { authorization: `Bearer ${token}` }
        );
        const submitMock = createMockRes();
        await handleSubmitAnswer(submitReq, submitMock.res);
        expect(submitMock._status).toBe(200);
      }

      // Проверяем, что пример перенесён в solved
      const solved = readSolvedExamples("zeroweight");
      expect(solved.some((e) => e.expression === "2+3")).toBe(true);

      // Проверяем, что пример удалён из current
      const currentAfter = readUserCurrentWeights("zeroweight");
      expect(currentAfter.some((e) => e.expression === "2+3")).toBe(false);
    });
  });
});
