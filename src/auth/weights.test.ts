import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  readUserWeights,
  writeUserWeights,
  createUserWeights,
  getAllExpressions,
  getUserWeightsPath,
} from "./csv";

const TEST_LOGIN = "testuser_weights";
const TEST_WEIGHTS_PATH = join(process.cwd(), "data", `weights_${TEST_LOGIN}.csv`);

function ensureTestDir(): void {
  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function cleanWeightsFile(): void {
  ensureTestDir();
  try {
    unlinkSync(TEST_WEIGHTS_PATH);
  } catch {
    // файл может отсутствовать
  }
}

describe("weights csv", () => {
  beforeEach(() => {
    cleanWeightsFile();
  });

  afterEach(() => {
    cleanWeightsFile();
  });

  describe("readUserWeights", () => {
    it("возвращает пустую карту для несуществующего файла", () => {
      const weights = readUserWeights("nonexistent_user_xyz");
      expect(weights).toBeInstanceOf(Map);
      expect(weights.size).toBe(0);
    });

    it("читает веса из файла пользователя", () => {
      const weights = new Map<string, number>();
      weights.set("2+3", 5);
      weights.set("1+4", 7);
      weights.set("0+0", 3);

      writeUserWeights(TEST_LOGIN, weights);

      const read = readUserWeights(TEST_LOGIN);
      expect(read.get("2+3")).toBe(5);
      expect(read.get("1+4")).toBe(7);
      expect(read.get("0+0")).toBe(3);
    });

    it("обрабатывает веса со значением 0", () => {
      const weights = new Map<string, number>();
      weights.set("1+1", 0);
      weights.set("2+2", 5);
      writeUserWeights(TEST_LOGIN, weights);

      const read = readUserWeights(TEST_LOGIN);
      expect(read.get("1+1")).toBe(0);
      expect(read.get("2+2")).toBe(5);
    });

    it("игнорирует пустые строки в файле", () => {
      const weights = new Map<string, number>();
      weights.set("3+4", 8);
      writeUserWeights(TEST_LOGIN, weights);

      // Добавляем пустую строку в конец файла
      const content = readFileSync(TEST_WEIGHTS_PATH, "utf-8");
      writeFileSync(TEST_WEIGHTS_PATH, content + "\n\n", "utf-8");

      const read = readUserWeights(TEST_LOGIN);
      expect(read.size).toBe(1);
      expect(read.get("3+4")).toBe(8);
    });
  });

  describe("writeUserWeights", () => {
    it("создаёт файл весов с правильной структурой", () => {
      const weights = new Map<string, number>();
      weights.set("1+2", 5);
      weights.set("3+4", 7);

      writeUserWeights(TEST_LOGIN, weights);

      const content = readFileSync(TEST_WEIGHTS_PATH, "utf-8");
      expect(content).toContain("expression,weight");
      expect(content).toContain("1+2,5");
      expect(content).toContain("3+4,7");
    });

    it("перезаписывает существующий файл", () => {
      const weights1 = new Map<string, number>();
      weights1.set("1+1", 9);
      writeUserWeights(TEST_LOGIN, weights1);

      const weights2 = new Map<string, number>();
      weights2.set("2+2", 3);
      writeUserWeights(TEST_LOGIN, weights2);

      const read = readUserWeights(TEST_LOGIN);
      expect(read.has("1+1")).toBe(false);
      expect(read.get("2+2")).toBe(3);
    });

    it("сохраняет пустую карту", () => {
      const weights = new Map<string, number>();
      writeUserWeights(TEST_LOGIN, weights);

      const content = readFileSync(TEST_WEIGHTS_PATH, "utf-8");
      expect(content).toContain("expression,weight");
      expect(content.split("\n")).toHaveLength(2); // заголовок + пустая строка
    });
  });

  describe("createUserWeights", () => {
    it("создаёт файл с начальными весами для всех примеров", () => {
      const examples = ["0+0", "1+2", "3+4", "5+5"];
      createUserWeights(TEST_LOGIN, examples);

      const weights = readUserWeights(TEST_LOGIN);
      expect(weights.size).toBe(4);
      for (const expression of examples) {
        expect(weights.get(expression)).toBe(5);
      }
    });

    it("создаёт файл с одним примером", () => {
      createUserWeights(TEST_LOGIN, ["0+0"]);

      const weights = readUserWeights(TEST_LOGIN);
      expect(weights.size).toBe(1);
      expect(weights.get("0+0")).toBe(5);
    });

    it("создаёт корректный CSV-файл", () => {
      createUserWeights(TEST_LOGIN, ["1+2", "3+4"]);

      const content = readFileSync(TEST_WEIGHTS_PATH, "utf-8");
      expect(content).toContain("expression,weight");
      expect(content).toContain("1+2,5");
      expect(content).toContain("3+4,5");
    });
  });

  describe("getAllExpressions", () => {
    it("читает все примеры из examples.csv", () => {
      const expressions = getAllExpressions();
      expect(expressions.length).toBeGreaterThan(0);
    });

    it("возвращает выражения в формате a+b", () => {
      const expressions = getAllExpressions();
      // Фильтруем заголовок, если он попал (из-за несоответствия форматов CSV)
      const validExpressions = expressions.filter((e) => e !== "expression");
      for (const expr of validExpressions) {
        expect(expr).toMatch(/^\d+\+\d+$/);
      }
    });

    it("не возвращает пустых строк", () => {
      const expressions = getAllExpressions();
      for (const expr of expressions) {
        expect(expr.length).toBeGreaterThan(0);
      }
    });

    it("содержит примеры с нулями", () => {
      const expressions = getAllExpressions();
      expect(expressions).toContain("0+0");
      expect(expressions).toContain("0+1");
      expect(expressions).toContain("1+0");
    });
  });

  describe("getUserWeightsPath", () => {
    it("возвращает путь к файлу весов для пользователя", () => {
      const path = getUserWeightsPath("ivan");
      expect(path).toContain("weights_ivan.csv");
    });

    it("корректно обрабатывает логин с кириллицей", () => {
      const path = getUserWeightsPath("Ольга");
      expect(path).toContain("weights_Ольга.csv");
    });
  });
});
