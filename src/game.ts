/** Проверяет, что строка содержит целое число (допускается знак минус). */
export function isValidNumber(value: string): boolean {
  return value.trim() !== "" && /^-?\d+$/.test(value.trim());
}

/** Выбирает слагаемые: сумма не превышает 10. */
export function pickOperands(random: () => number = Math.random): {
  a: number;
  b: number;
} {
  const a = Math.floor(random() * 11);
  const b = Math.floor(random() * (11 - a));
  return { a, b };
}

/** Форматирует текст примера для отображения. */
export function formatProblem(a: number, b: number): string {
  return `${a} + ${b} = ?`;
}

/** Показывает сообщение об ошибке под полем ввода. */
export function showError(errorEl: HTMLElement, message: string): void {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

/** Скрывает и очищает сообщение об ошибке. */
export function hideError(errorEl: HTMLElement): void {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

/** Обновляет отображение текущего счёта на экране. */
export function updateScore(scoreEl: HTMLElement, score: number): void {
  scoreEl.textContent = String(score);
}

export type SubmitOutcome =
  | { kind: "invalid" }
  | { kind: "wrong" }
  | { kind: "correct"; score: number; a: number; b: number };

/** Обрабатывает ответ игрока и возвращает результат без привязки к DOM. */
export function processSubmit(
  value: string,
  a: number,
  b: number,
  score: number,
  random: () => number = Math.random,
): SubmitOutcome {
  if (!isValidNumber(value)) {
    return { kind: "invalid" };
  }

  const answer = Number(value.trim());

  if (answer === a + b) {
    const next = pickOperands(random);
    return { kind: "correct", score: score + 1, a: next.a, b: next.b };
  }

  return { kind: "wrong" };
}

/** Формирует сообщение об окончании игры для консоли. */
export function formatGameEndMessage(score: number): string {
  return `Игра завершена. Итоговый счёт: ${score}`;
}
