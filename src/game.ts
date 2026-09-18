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
export function formatProblem(a: number, b: number, operator: "+" | "-" = "+"): string {
  return `${a} ${operator} ${b} = ?`;
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
  | { kind: "correct"; score: number; a: number; b: number; operator: "+" | "-" };

/** Обрабатывает ответ игрока и возвращает результат без привязки к DOM. */
export function processSubmit(
  value: string,
  a: number,
  b: number,
  score: number,
  operator: "+" | "-" = "+",
  random: () => number = Math.random,
): SubmitOutcome {
  if (!isValidNumber(value)) {
    return { kind: "invalid" };
  }

  const answer = Number(value.trim());

  const expected = operator === "-" ? a - b : a + b;
  if (answer === expected) {
    const next = pickOperands(random);
    return { kind: "correct", score: score + 1, a: next.a, b: next.b, operator: "+" };
  }

  return { kind: "wrong" };
}

/** Формирует сообщение об окончании игры для консоли. */
export function formatGameEndMessage(score: number): string {
  return `Игра завершена. Итоговый счёт: ${score}`;
}

/** Парсит строку выражения вида "a+b" или "a-b" в объект { a, b }. */
export function parseExpression(expression: string): { a: number; b: number } {
  const match = expression.match(/^(\d+)\s*([+\-])\s*(\d+)$/);
  if (!match) {
    return { a: 0, b: 0 };
  }
  return {
    a: Number(match[1]),
    b: Number(match[3]),
  };
}

/** Выбирает пример на основе весов (вероятность пропорциональна весу). */
export function pickWeightedProblem(
  expressions: string[],
  weights: Map<string, number>,
  random: () => number = Math.random,
): { expression: string; a: number; b: number; operator: "+" | "-" } | null {
  // Собираем список выражений с весом > 0
  const available: { expression: string; weight: number }[] = [];
  for (const expression of expressions) {
    const weight = weights.get(expression) ?? 0;
    if (weight > 0) {
      available.push({ expression, weight });
    }
  }

  // Если нет доступных примеров, возвращаем null
  if (available.length === 0) {
    return null;
  }

  // Вычисляем общий вес
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);

  // Выбираем случайное значение в диапазоне [0, totalWeight)
  let rand = random() * totalWeight;

  // Находим выбранное выражение
  for (const item of available) {
    rand -= item.weight;
    if (rand <= 0) {
      const parsed = parseExpression(item.expression);
      const operator = item.expression.includes("-") ? "-" : "+";
      return { expression: item.expression, ...parsed, operator };
    }
  }

  // На случай погрешностей округления — возвращаем последнее
  const last = available[available.length - 1];
  const parsed = parseExpression(last.expression);
  const operator = last.expression.includes("-") ? "-" : "+";
  return { expression: last.expression, ...parsed, operator };
}

/** Корректирует вес примера: верный ответ -1, неверный +2 (максимум 10). */
export function adjustWeight(
  weights: Map<string, number>,
  expression: string,
  correct: boolean,
): void {
  const current = weights.get(expression) ?? 0;
  const newWeight = correct ? current - 1 : Math.min(10, current + 2);
  // Ограничиваем диапазон [0, 10]
  weights.set(expression, Math.max(0, newWeight));
}

/** Применяет глобальное снижение весов каждые N верных ответов. */
export function applyGlobalReduction(
  weights: Map<string, number>,
  correctCount: number,
  reductionEvery: number = 10,
): number {
  const newCount = correctCount + 1;

  // Если достигли порога — снижаем все веса и сбрасываем счётчик
  if (newCount >= reductionEvery) {
    for (const [expression, weight] of weights) {
      const newWeight = Math.max(0, weight - 1);
      weights.set(expression, newWeight);
    }
    return 0; // Сбрасываем счётчик
  }
  return newCount;
}
