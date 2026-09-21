/**
 * Модуль управления временем жизни мира
 * Каждые 10 правильных ответов = +1 час мира
 */

/** Состояние времени мира для пользователя */
export interface WorldTimeState {
  correctAnswers: number;
  totalHours: number;
}

/**
 * Форматирует общее количество часов в строку вида:
 * "Г годы, Д дни, Ч часы"
 */
export function getWorldTimeDisplay(totalHours: number): string {
  const totalDays = Math.floor(totalHours / 24);
  const years = Math.floor(totalDays / 365);
  const days = totalDays % 365;
  const hours = totalHours % 24;

  const yearsStr = years > 0 ? `${years} ${declension(years, ['год', 'года', 'лет'])}` : '';
  const daysStr = days > 0 ? `${days} ${declension(days, ['день', 'дня', 'дней'])}` : '';
  const hoursStr = hours > 0 ? `${hours} ${declension(hours, ['час', 'часа', 'часов'])}` : '';

  const parts = [yearsStr, daysStr, hoursStr].filter(Boolean);
  if (parts.length === 0) return '0 часов';
  return parts.join(', ');
}

/**
 * Добавляет 1 правильный ответ
 * Каждые 10 правильных ответов = +1 час
 */
export function addCorrectAnswer(state: WorldTimeState): void {
  state.correctAnswers++;
  state.totalHours = Math.floor(state.correctAnswers / 10);
}

/**
 * Возвращает количество часов, прошедших в мире
 */
export function getHoursElapsed(state: WorldTimeState): number {
  return Math.floor(state.correctAnswers / 10);
}

/**
 * Загружает состояние времени мира из localStorage
 */
export function loadWorldTime(login: string): WorldTimeState {
  const key = `worldTime_${login}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Если ошибка парсинга, возвращаем начальное состояние
    }
  }
  return { correctAnswers: 0, totalHours: 0 };
}

/**
 * Сохраняет состояние времени мира в localStorage
 */
export function saveWorldTime(login: string, state: WorldTimeState): void {
  const key = `worldTime_${login}`;
  localStorage.setItem(key, JSON.stringify(state));
}

/**
 * Обновляет отображение времени в DOM-элементе
 */
export function updateWorldTimeDisplay(totalHours: number): void {
  const el = document.getElementById('world-time');
  if (el) {
    el.textContent = getWorldTimeDisplay(totalHours);
  }
}

/**
 * Склонение существительных по числительному
 */
function declension(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;

  if (abs > 10 && abs < 20) return forms[2];
  if (lastDigit > 1 && lastDigit < 5) return forms[1];
  if (lastDigit === 1) return forms[0];
  return forms[2];
}
