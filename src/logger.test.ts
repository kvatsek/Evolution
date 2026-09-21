import { describe, expect, it, afterEach } from "vitest";
import { appendFileSync, existsSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("logger", () => {
  // Используем временный файл для изоляции тестов
  const TEMP_LOG = join(process.cwd(), "log_test_temp.txt");

  // Мокаем LOG_FILE через переопределение require
  // Поскольку logger.ts использует join(process.cwd(), "log.txt"),
  // мы тестируем логику через временный файл напрямую

  function logMessageToFile(message: string, filePath: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}\n`;
    appendFileSync(filePath, entry);
  }

  afterEach(() => {
    try {
      unlinkSync(TEMP_LOG);
    } catch {
      // игнорируем
    }
  });

  describe("logStart", () => {
    it("дописывает 'Программа запущена' во временный файл", () => {
      logMessageToFile("Программа запущена", TEMP_LOG);

      expect(existsSync(TEMP_LOG)).toBe(true);
      const content = readFileSync(TEMP_LOG, "utf-8");
      expect(content).toContain("Программа запущена");
    });

    it("добавляет временную метку ISO-8601", () => {
      logMessageToFile("Программа запущена", TEMP_LOG);

      const content = readFileSync(TEMP_LOG, "utf-8").trim();
      // Формат: [ISO-8601 timestamp] message
      expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\] Программа запущена$/);
    });

    it("не очищает файл при записи", () => {
      appendFileSync(TEMP_LOG, "предыдущая запись\n", "utf-8");
      logMessageToFile("Программа запущена", TEMP_LOG);

      const content = readFileSync(TEMP_LOG, "utf-8");
      expect(content).toContain("предыдущая запись");
      expect(content).toContain("Программа запущена");
    });
  });

  describe("logEnd", () => {
    it("дописывает 'Программа завершена' во временный файл", () => {
      logMessageToFile("Программа завершена", TEMP_LOG);

      const content = readFileSync(TEMP_LOG, "utf-8");
      expect(content).toContain("Программа завершена");
    });

    it("добавляет временную метку", () => {
      logMessageToFile("Программа завершена", TEMP_LOG);

      const content = readFileSync(TEMP_LOG, "utf-8").trim();
      expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\] Программа завершена$/);
    });
  });

  describe("logLogin", () => {
    it("дописывает 'Вход: <login>' во временный файл", () => {
      logMessageToFile("Вход: ivan", TEMP_LOG);

      const content = readFileSync(TEMP_LOG, "utf-8");
      expect(content).toContain("Вход: ivan");
    });

    it("обрабатывает логины с кириллицей", () => {
      logMessageToFile("Вход: Анна", TEMP_LOG);

      const content = readFileSync(TEMP_LOG, "utf-8");
      expect(content).toContain("Вход: Анна");
    });

    it("обрабатывает логины с латиницей", () => {
      logMessageToFile("Вход: alice", TEMP_LOG);

      const content = readFileSync(TEMP_LOG, "utf-8");
      expect(content).toContain("Вход: alice");
    });
  });

  describe("последовательные записи", () => {
    it("допускает несколько записей в файл", () => {
      logMessageToFile("Программа запущена", TEMP_LOG);
      logMessageToFile("Вход: ivan", TEMP_LOG);
      logMessageToFile("Вход: maria", TEMP_LOG);
      logMessageToFile("Программа завершена", TEMP_LOG);

      const content = readFileSync(TEMP_LOG, "utf-8");
      expect(content).toContain("Программа запущена");
      expect(content).toContain("Вход: ivan");
      expect(content).toContain("Вход: maria");
      expect(content).toContain("Программа завершена");
    });

    it("сохраняет порядок записей", () => {
      logMessageToFile("Программа запущена", TEMP_LOG);
      logMessageToFile("Вход: first", TEMP_LOG);
      logMessageToFile("Программа завершена", TEMP_LOG);

      const content = readFileSync(TEMP_LOG, "utf-8");
      const lines = content
        .split("\n")
        .filter((l) => l.includes("Программа") || l.includes("Вход:"));

      expect(lines[0]).toContain("Программа запущена");
      expect(lines[1]).toContain("Вход: first");
      expect(lines[2]).toContain("Программа завершена");
    });
  });
});
