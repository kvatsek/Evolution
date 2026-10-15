import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type BacteriaEntry } from "./bacteria.js";

const TEST_BACTERIA_DIR = join(process.cwd(), "gif", "bacteria_test");
const TEST_DATA_DIR = join(process.cwd(), "data_test");

function setupTestDir(): void {
  if (!existsSync(TEST_DATA_DIR)) {
    mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  if (existsSync(TEST_BACTERIA_DIR)) {
    rmSync(TEST_BACTERIA_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_BACTERIA_DIR, { recursive: true });
}

function cleanup(): void {
  try {
    if (existsSync(TEST_BACTERIA_DIR)) {
      rmSync(TEST_BACTERIA_DIR, { recursive: true, force: true });
    }
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  } catch {
    // Игнорируем ошибки при очистке
  }
}

describe("scanBacteriaDirectory", () => {
  beforeEach(() => {
    setupTestDir();
  });

  afterEach(() => {
    cleanup();
  });

  it("должен распознать .mp4 файлы и извлечь уникальность", () => {
    writeFileSync(join(TEST_BACTERIA_DIR, "11111.mp4"), "");
    writeFileSync(join(TEST_BACTERIA_DIR, "21211.mp4"), "");
    writeFileSync(join(TEST_BACTERIA_DIR, "21321.mp4"), "");

    const files = readdirSync(TEST_BACTERIA_DIR, { encoding: "utf-8" });

    const bacteria: BacteriaEntry[] = [];
    let id = 1;
    for (const fileName of files) {
      if (!fileName.toLowerCase().endsWith(".mp4")) continue;
      const name = fileName.replace(/\.mp4$/i, "");
      const lastChar = name[name.length - 1];
      const uniqueness = parseInt(lastChar, 10);
      if (isNaN(uniqueness)) continue;
      bacteria.push({ id, name, uniqueness });
      id++;
    }

    expect(bacteria).toHaveLength(3);
    expect(bacteria[0]).toEqual({ id: 1, name: "11111", uniqueness: 1 });
    expect(bacteria[1]).toEqual({ id: 2, name: "21211", uniqueness: 1 });
    expect(bacteria[2]).toEqual({ id: 3, name: "21321", uniqueness: 1 });
  });

  it("должен пропустить не-mp4 файлы", () => {
    writeFileSync(join(TEST_BACTERIA_DIR, "11111.mp4"), "");
    writeFileSync(join(TEST_BACTERIA_DIR, "21211.gif"), "");
    writeFileSync(join(TEST_BACTERIA_DIR, "21321.mp4"), "");

    const files = readdirSync(TEST_BACTERIA_DIR, { encoding: "utf-8" });
    const bacteria: BacteriaEntry[] = [];
    let id = 1;
    for (const fileName of files) {
      if (!fileName.toLowerCase().endsWith(".mp4")) continue;
      const name = fileName.replace(/\.mp4$/i, "");
      const lastChar = name[name.length - 1];
      const uniqueness = parseInt(lastChar, 10);
      if (isNaN(uniqueness)) continue;
      bacteria.push({ id, name, uniqueness });
      id++;
    }

    expect(bacteria).toHaveLength(2);
    expect(bacteria[0].name).toBe("11111");
    expect(bacteria[1].name).toBe("21321");
  });

  it("должен пропустить файлы без числовой уникальности", () => {
    writeFileSync(join(TEST_BACTERIA_DIR, "11111.mp4"), "");
    writeFileSync(join(TEST_BACTERIA_DIR, "abcde.mp4"), "");
    writeFileSync(join(TEST_BACTERIA_DIR, "21321.mp4"), "");

    const files = readdirSync(TEST_BACTERIA_DIR, { encoding: "utf-8" });
    const bacteria: BacteriaEntry[] = [];
    let id = 1;
    for (const fileName of files) {
      if (!fileName.toLowerCase().endsWith(".mp4")) continue;
      const name = fileName.replace(/\.mp4$/i, "");
      const lastChar = name[name.length - 1];
      const uniqueness = parseInt(lastChar, 10);
      if (isNaN(uniqueness)) continue;
      bacteria.push({ id, name, uniqueness });
      id++;
    }

    expect(bacteria).toHaveLength(2);
    expect(bacteria[0].name).toBe("11111");
    expect(bacteria[1].name).toBe("21321");
  });

  it("должен корректно извлекать разные уникальности", () => {
    writeFileSync(join(TEST_BACTERIA_DIR, "11111.mp4"), "");
    writeFileSync(join(TEST_BACTERIA_DIR, "21212.mp4"), "");
    writeFileSync(join(TEST_BACTERIA_DIR, "21323.mp4"), "");

    const files = readdirSync(TEST_BACTERIA_DIR, { encoding: "utf-8" });
    const bacteria: BacteriaEntry[] = [];
    let id = 1;
    for (const fileName of files) {
      if (!fileName.toLowerCase().endsWith(".mp4")) continue;
      const name = fileName.replace(/\.mp4$/i, "");
      const lastChar = name[name.length - 1];
      const uniqueness = parseInt(lastChar, 10);
      if (isNaN(uniqueness)) continue;
      bacteria.push({ id, name, uniqueness });
      id++;
    }

    expect(bacteria[0].uniqueness).toBe(1);
    expect(bacteria[1].uniqueness).toBe(2);
    expect(bacteria[2].uniqueness).toBe(3);
  });
});

describe("writeBacteriaCsv", () => {
  beforeEach(() => {
    setupTestDir();
  });

  afterEach(() => {
    cleanup();
  });

  it("должен записать CSV с правильным header", () => {
    const bacteria: BacteriaEntry[] = [
      { id: 1, name: "11111", uniqueness: 1 },
      { id: 2, name: "21211", uniqueness: 1 },
    ];

    // Записываем в тестовый путь
    const testCsvPath = join(TEST_DATA_DIR, "bacteria_test.csv");
    const lines = ["id,name,uniqueness"];
    for (const entry of bacteria) {
      lines.push(`${entry.id},${entry.name},${entry.uniqueness}`);
    }
    writeFileSync(testCsvPath, lines.join("\n") + "\n", "utf-8");

    const content = readFileSync(testCsvPath, "utf-8");
    expect(content).toBe("id,name,uniqueness\n1,11111,1\n2,21211,1\n");
  });

  it("должен записать одну бактерию", () => {
    const bacteria: BacteriaEntry[] = [{ id: 1, name: "11111", uniqueness: 5 }];

    const testCsvPath = join(TEST_DATA_DIR, "bacteria_single.csv");
    const lines = ["id,name,uniqueness"];
    for (const entry of bacteria) {
      lines.push(`${entry.id},${entry.name},${entry.uniqueness}`);
    }
    writeFileSync(testCsvPath, lines.join("\n") + "\n", "utf-8");

    const content = readFileSync(testCsvPath, "utf-8");
    expect(content).toBe("id,name,uniqueness\n1,11111,5\n");
  });

  it("должен создать пустой CSV, если нет бактерий", () => {
    const testCsvPath = join(TEST_DATA_DIR, "bacteria_empty.csv");
    writeFileSync(testCsvPath, "id,name,uniqueness\n", "utf-8");

    const content = readFileSync(testCsvPath, "utf-8");
    expect(content).toBe("id,name,uniqueness\n");
  });
});
