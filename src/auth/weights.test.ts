import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appendFileSync, existsSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  readUserCurrentWeights,
  writeUserCurrentWeights,
  readSolvedExamples,
  addSolvedExample,
  removeFromCurrent,
  getAllExpressionsForLevel,
  getUnsolvedExamplesFromLevel,
  createUserLevelFiles,
  advanceLevel,
} from "./csv";

describe("user level files", () => {
  const testLogin = "testleveluser";
  const testDir = join(process.cwd(), "data", testLogin);
  const currentPath = join(testDir, "current.csv");
  const solvedPath = join(testDir, "solved.csv");

  beforeEach(() => {
    // Очищаем тестовую папку
    try {
      unlinkSync(currentPath);
    } catch {
      // файл может отсутствовать
    }
    try {
      unlinkSync(solvedPath);
    } catch {
      // файл может отсутствовать
    }
  });

  afterEach(() => {
    // Очищаем тестовую папку
    try {
      unlinkSync(currentPath);
    } catch {
      // файл может отсутствовать
    }
    try {
      unlinkSync(solvedPath);
    } catch {
      // файл может отсутствовать
    }
  });

  describe("readUserCurrentWeights", () => {
    it("возвращает пустой массив для несуществующего пользователя", () => {
      const entries = readUserCurrentWeights("nonexistent_user_xyz");
      expect(entries).toEqual([]);
    });

    it("читает current.csv пользователя", () => {
      writeFileSync(currentPath, "expression,weight,level\n2+3,5,1\n1+4,3,1\n", "utf-8");
      const entries = readUserCurrentWeights(testLogin);
      expect(entries).toHaveLength(2);
      expect(entries[0].expression).toBe("2+3");
      expect(entries[0].weight).toBe(5);
      expect(entries[0].level).toBe(1);
    });

    it("обрабатывает веса со значением 0", () => {
      writeFileSync(currentPath, "expression,weight,level\n1+1,0,1\n2+2,5,1\n", "utf-8");
      const entries = readUserCurrentWeights(testLogin);
      expect(entries[0].weight).toBe(0);
      expect(entries[1].weight).toBe(5);
    });
  });

  describe("writeUserCurrentWeights", () => {
    it("создаёт файл current.csv с правильной структурой", () => {
      const entries = [
        { expression: "1+2", weight: 5, level: 1 },
        { expression: "3+4", weight: 7, level: 1 },
      ];
      writeUserCurrentWeights(testLogin, entries);

      const content = readFileSync(currentPath, "utf-8");
      expect(content).toContain("expression,weight,level");
      expect(content).toContain("1+2,5,1");
      expect(content).toContain("3+4,7,1");
    });
  });

  describe("readSolvedExamples", () => {
    it("возвращает пустой массив для несуществующего пользователя", () => {
      const entries = readSolvedExamples("nonexistent_user_xyz");
      expect(entries).toEqual([]);
    });

    it("читает solved.csv пользователя", () => {
      writeFileSync(solvedPath, "expression,level\n1+2,1\n3+4,1\n", "utf-8");
      const entries = readSolvedExamples(testLogin);
      expect(entries).toHaveLength(2);
      expect(entries[0].expression).toBe("1+2");
      expect(entries[0].level).toBe(1);
    });
  });

  describe("addSolvedExample", () => {
    it("добавляет решённый пример в solved.csv", () => {
      writeFileSync(solvedPath, "expression,level\n", "utf-8");
      addSolvedExample(testLogin, "5+5", 1);

      const entries = readSolvedExamples(testLogin);
      expect(entries).toHaveLength(1);
      expect(entries[0].expression).toBe("5+5");
      expect(entries[0].level).toBe(1);
    });

    it("не добавляет дубликаты", () => {
      writeFileSync(solvedPath, "expression,level\n5+5,1\n", "utf-8");
      addSolvedExample(testLogin, "5+5", 1);

      const entries = readSolvedExamples(testLogin);
      expect(entries).toHaveLength(1);
    });
  });

  describe("removeFromCurrent", () => {
    it("удаляет пример из current.csv", () => {
      writeFileSync(currentPath, "expression,weight,level\n1+2,5,1\n3+4,3,1\n", "utf-8");
      removeFromCurrent(testLogin, "1+2");

      const entries = readUserCurrentWeights(testLogin);
      expect(entries).toHaveLength(1);
      expect(entries[0].expression).toBe("3+4");
    });
  });

  describe("getAllExpressionsForLevel", () => {
    it("читает примеры из 1_example.csv", () => {
      const expressions = getAllExpressionsForLevel(1);
      expect(expressions.length).toBeGreaterThan(0);
      expect(expressions).toContain("0+0");
      expect(expressions).toContain("5+5");
    });

    it("читает примеры из 2_example.csv", () => {
      const expressions = getAllExpressionsForLevel(2);
      expect(expressions.length).toBeGreaterThan(0);
      expect(expressions).toContain("0-0");
      expect(expressions).toContain("10-10");
    });

    it("читает примеры из 3_example.csv", () => {
      const expressions = getAllExpressionsForLevel(3);
      expect(expressions.length).toBeGreaterThan(0);
    });

    it("читает примеры из 4_example.csv", () => {
      const expressions = getAllExpressionsForLevel(4);
      expect(expressions.length).toBeGreaterThan(0);
    });

    it("возвращает пустой массив для несуществующего уровня", () => {
      const expressions = getAllExpressionsForLevel(5);
      expect(expressions).toEqual([]);
    });
  });

  describe("createUserLevelFiles", () => {
    it("создаёт папку пользователя с current.csv и solved.csv", () => {
      createUserLevelFiles(testLogin, ["1+2", "3+4"]);

      expect(existsSync(currentPath)).toBe(true);
      expect(existsSync(solvedPath)).toBe(true);

      const entries = readUserCurrentWeights(testLogin);
      expect(entries).toHaveLength(2);
      expect(entries[0].weight).toBe(5);
      expect(entries[0].level).toBe(1);
    });
  });

  describe("advanceLevel", () => {
    it("добавляет примеры следующего уровня", () => {
      writeFileSync(currentPath, "expression,weight,level\n1+2,5,1\n", "utf-8");
      // Создаём пользователя в users.csv с level=1
      appendFileSync(
        join(process.cwd(), "data", "users.test.csv"),
        "testleveluser,salt:hash,,0\n",
        "utf-8"
      );

      advanceLevel(testLogin, ["5-2", "8-3"]);

      const entries = readUserCurrentWeights(testLogin);
      expect(entries).toHaveLength(3);
      // Проверяем, что есть примеры уровня 2
      const level2Entries = entries.filter((e) => e.level === 2);
      expect(level2Entries.length).toBe(2);
    });
  });

  describe("getUnsolvedExamplesFromLevel", () => {
    it("возвращает примеры, которых нет в current и solved", () => {
      writeFileSync(currentPath, "expression,weight,level\n1+2,5,1\n", "utf-8");
      writeFileSync(solvedPath, "expression,level\n3+4,1\n", "utf-8");

      const currentExpressions = new Set(["1+2"]);
      const unsolved = getUnsolvedExamplesFromLevel(testLogin, 1, currentExpressions);

      // 1+2 — в current, 3+4 — в solved, остальные должны быть нерешёнными
      expect(unsolved).not.toContain("1+2");
      expect(unsolved).not.toContain("3+4");
      expect(unsolved.length).toBeGreaterThan(0);
    });
  });
});
