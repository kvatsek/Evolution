import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Запись о бактерии. */
export interface BacteriaEntry {
  id: number;
  name: string;
  uniqueness: number;
}

const BACTERIA_DIR = join(process.cwd(), "gif", "bacteria");
const BACTERIA_CSV_PATH = join(process.cwd(), "data", "bacteria.csv");
const CSV_HEADER = "id,name,uniqueness";

/** Гарантирует, что директория существует. */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Сканирует папку gif/bacteria/ и возвращает список бактерий. */
export function scanBacteriaDirectory(): BacteriaEntry[] {
  if (!existsSync(BACTERIA_DIR)) {
    return [];
  }

  const files = readdirSync(BACTERIA_DIR, { encoding: "utf-8" })
    .filter((file) => file.trim().length > 0);

  const bacteria: BacteriaEntry[] = [];
  let id = 1;

  for (const fileName of files) {
    // Проверяем, что это .mp4 файл
    if (!fileName.toLowerCase().endsWith(".mp4")) {
      continue;
    }

    // Извлекаем имя файла без расширения
    const name = fileName.replace(/\.mp4$/i, "");

    // Последняя цифра в имени — уникальность
    const lastChar = name[name.length - 1];
    const uniqueness = parseInt(lastChar, 10);

    if (isNaN(uniqueness)) {
      continue; // Пропускаем файлы, у которых последняя цифра не является числом
    }

    bacteria.push({ id, name, uniqueness });
    id++;
  }

  return bacteria;
}

/** Записывает список бактерий в CSV-файл. */
export function writeBacteriaCsv(bacteria: BacteriaEntry[]): void {
  ensureDir(join(process.cwd(), "data"));

  const lines = [CSV_HEADER];
  for (const entry of bacteria) {
    lines.push(`${entry.id},${entry.name},${entry.uniqueness}`);
  }

  writeFileSync(BACTERIA_CSV_PATH, lines.join("\n") + "\n", "utf-8");
}

/** Гарантирует, что CSV-файл с бактериями существует и актуален. */
export function ensureBacteriaCsv(): void {
  try {
    const bacteria = scanBacteriaDirectory();
    writeBacteriaCsv(bacteria);
  } catch (err) {
    console.error("Ошибка при создании bacteria.csv:", err);
  }
}
