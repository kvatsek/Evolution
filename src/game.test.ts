import { describe, expect, it, vi } from "vitest";
import {
  formatGameEndMessage,
  formatProblem,
  hideError,
  isValidNumber,
  pickOperands,
  processSubmit,
  showError,
  updateScore,
  parseExpression,
  pickWeightedProblem,
  adjustWeight,
  applyGlobalReduction,
} from "./game";

describe("isValidNumber", () => {
  it("принимает целые положительные числа", () => {
    expect(isValidNumber("0")).toBe(true);
    expect(isValidNumber("10")).toBe(true);
    expect(isValidNumber("  7  ")).toBe(true);
  });

  it("принимает отрицательные целые числа", () => {
    expect(isValidNumber("-3")).toBe(true);
  });

  it("отклоняет пустую строку и нечисловой ввод", () => {
    expect(isValidNumber("")).toBe(false);
    expect(isValidNumber("   ")).toBe(false);
    expect(isValidNumber("3.5")).toBe(false);
    expect(isValidNumber("abc")).toBe(false);
  });
});

describe("pickOperands", () => {
  it("возвращает сумму не больше 10", () => {
    const random = vi
      .fn()
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5);

    const { a, b } = pickOperands(random);
    expect(a + b).toBeLessThanOrEqual(10);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
  });

  it("использует детерминированный random", () => {
    const random = vi
      .fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    expect(pickOperands(random)).toEqual({ a: 0, b: 0 });
  });
});

describe("formatProblem", () => {
  it("форматирует пример сложения", () => {
    expect(formatProblem(3, 7)).toBe("3 + 7 = ?");
  });
});

describe("showError", () => {
  it("показывает текст ошибки", () => {
    const errorEl = document.createElement("p");
    errorEl.hidden = true;

    showError(errorEl, "Введите число");

    expect(errorEl.textContent).toBe("Введите число");
    expect(errorEl.hidden).toBe(false);
  });
});

describe("hideError", () => {
  it("скрывает и очищает сообщение об ошибке", () => {
    const errorEl = document.createElement("p");
    errorEl.textContent = "Ошибка";
    errorEl.hidden = false;

    hideError(errorEl);

    expect(errorEl.textContent).toBe("");
    expect(errorEl.hidden).toBe(true);
  });
});

describe("updateScore", () => {
  it("обновляет отображение счёта", () => {
    const scoreEl = document.createElement("span");

    updateScore(scoreEl, 5);

    expect(scoreEl.textContent).toBe("5");
  });
});

describe("processSubmit", () => {
  it("возвращает invalid для нечислового ввода", () => {
    expect(processSubmit("abc", 2, 3, 0, "+")).toEqual({ kind: "invalid" });
  });

  it("возвращает wrong для неверного ответа", () => {
    expect(processSubmit("4", 2, 3, 2, "+")).toEqual({ kind: "wrong" });
  });

  it("проверяет правильный ответ для сложения", () => {
    const result = processSubmit("5", 2, 3, 0, "+");
    expect(result.kind).toBe("correct");
    if (result.kind === "correct") {
      expect(result.score).toBe(1);
      expect(result.operator).toBe("+");
      expect(result.a).toBeTypeOf("number");
      expect(result.b).toBeTypeOf("number");
    }
  });

  it("проверяет правильный ответ для вычитания", () => {
    const result = processSubmit("2", 5, 3, 0, "-");
    expect(result.kind).toBe("correct");
    if (result.kind === "correct") {
      expect(result.score).toBe(1);
      expect(result.operator).toBe("+");
      expect(result.a).toBeTypeOf("number");
      expect(result.b).toBeTypeOf("number");
    }
  });

  it("возвращает wrong для неверного ответа при вычитании", () => {
    expect(processSubmit("8", 5, 3, 0, "-")).toEqual({ kind: "wrong" });
  });

  it("возвращает correct и увеличивает счёт", () => {
    const random = vi.fn().mockReturnValue(0);

    const result = processSubmit("5", 2, 3, 2, "+", random);
    expect(result.kind).toBe("correct");
    if (result.kind === "correct") {
      expect(result.score).toBe(3);
      expect(result.operator).toBe("+");
    }
  });
});

describe("formatGameEndMessage", () => {
  it("формирует сообщение об окончании игры", () => {
    expect(formatGameEndMessage(7)).toBe("Игра завершена. Итоговый счёт: 7");
  });
});

describe("parseExpression", () => {
  it("парсит выражение вида a+b", () => {
    expect(parseExpression("2+3")).toEqual({ a: 2, b: 3 });
  });

  it("парсит выражения с нулями", () => {
    expect(parseExpression("0+0")).toEqual({ a: 0, b: 0 });
    expect(parseExpression("0+10")).toEqual({ a: 0, b: 10 });
  });

  it("парсит максимальные значения", () => {
    expect(parseExpression("5+5")).toEqual({ a: 5, b: 5 });
    expect(parseExpression("10+0")).toEqual({ a: 10, b: 0 });
  });
});

describe("pickWeightedProblem", () => {
  it("возвращает null когда все веса 0", () => {
    const expressions = ["1+2", "3+4"];
    const weights = new Map<string, number>();
    weights.set("1+2", 0);
    weights.set("3+4", 0);

    const result = pickWeightedProblem(expressions, weights);
    expect(result).toBeNull();
  });

  it("выбирает пример с весом > 0", () => {
    const expressions = ["1+2", "3+4"];
    const weights = new Map<string, number>();
    weights.set("1+2", 5);
    weights.set("3+4", 0);

    const result = pickWeightedProblem(expressions, weights);
    expect(result).not.toBeNull();
    expect(result?.expression).toBe("1+2");
  });

  it("выбирает пример пропорционально весу", () => {
    const expressions = ["1+2", "3+4"];
    const weights = new Map<string, number>();
    weights.set("1+2", 9);
    weights.set("3+4", 1);

    // При 100 итерациях с random() = 0 должен выбирать "1+2" (вес 9 из 10)
    const random = vi.fn().mockReturnValue(0);
    const result = pickWeightedProblem(expressions, weights, random);
    expect(result?.expression).toBe("1+2");
  });

  it("выбирает пример с меньшим весом при случайном значении", () => {
    const expressions = ["1+2", "3+4"];
    const weights = new Map<string, number>();
    weights.set("1+2", 5);
    weights.set("3+4", 5);

    // random = 0.9 -> 0.9 * 10 = 9, 9 >= 5 (первый), значит выбираем второй
    const random = vi.fn().mockReturnValue(0.9);
    const result = pickWeightedProblem(expressions, weights, random);
    expect(result?.expression).toBe("3+4");
  });

  it("возвращает правильные операнды из выражения", () => {
    const expressions = ["0+0", "1+2", "3+4", "5+5", "10+0"];
    const weights = new Map<string, number>();
    for (const expr of expressions) {
      weights.set(expr, 5);
    }

    const random = vi.fn().mockReturnValue(0);
    const result = pickWeightedProblem(expressions, weights, random);
    expect(result).not.toBeNull();
    expect(result!.a + result!.b).toBeLessThanOrEqual(10);
  });
});

describe("adjustWeight", () => {
  it("уменьшает вес на 1 при верном ответе", () => {
    const weights = new Map<string, number>();
    weights.set("2+3", 5);

    adjustWeight(weights, "2+3", true);
    expect(weights.get("2+3")).toBe(4);
  });

  it("увеличивает вес на 2 при неверном ответе", () => {
    const weights = new Map<string, number>();
    weights.set("2+3", 5);

    adjustWeight(weights, "2+3", false);
    expect(weights.get("2+3")).toBe(7);
  });

  it("не опускает вес ниже 0", () => {
    const weights = new Map<string, number>();
    weights.set("2+3", 0);

    adjustWeight(weights, "2+3", true);
    expect(weights.get("2+3")).toBe(0);
  });

  it("не поднимает вес выше 10", () => {
    const weights = new Map<string, number>();
    weights.set("2+3", 10);

    adjustWeight(weights, "2+3", false);
    expect(weights.get("2+3")).toBe(10);
  });

  it("обрабатывает выражение с весом по умолчанию 0", () => {
    const weights = new Map<string, number>();

    adjustWeight(weights, "2+3", false);
    expect(weights.get("2+3")).toBe(2);
  });
});

describe("applyGlobalReduction", () => {
  it("снижает все веса на 1 при streak = 10 (10 верных подряд)", () => {
    const weights = new Map<string, number>();
    weights.set("1+2", 5);
    weights.set("3+4", 7);
    weights.set("5+5", 3);

    const result = applyGlobalReduction(weights, 10);
    expect(result).toBe(true); // Снижение применено
    expect(weights.get("1+2")).toBe(4);
    expect(weights.get("3+4")).toBe(6);
    expect(weights.get("5+5")).toBe(2);
  });

  it("не снижает веса при streak < 10", () => {
    const weights = new Map<string, number>();
    weights.set("1+2", 5);

    const result = applyGlobalReduction(weights, 5);
    expect(result).toBe(false); // Снижение не применено
    expect(weights.get("1+2")).toBe(5); // Вес не изменился
  });

  it("не снижает веса при streak = 0", () => {
    const weights = new Map<string, number>();
    weights.set("1+2", 5);

    const result = applyGlobalReduction(weights, 0);
    expect(result).toBe(false);
    expect(weights.get("1+2")).toBe(5);
  });

  it("не опускает веса ниже 0 при глобальном снижении", () => {
    const weights = new Map<string, number>();
    weights.set("1+2", 0);
    weights.set("3+4", 5);

    const result = applyGlobalReduction(weights, 10);
    expect(result).toBe(true);
    expect(weights.get("1+2")).toBe(0); // Не ниже 0
    expect(weights.get("3+4")).toBe(4);
  });

  it("снижает веса при streak = 20 (два цикла по 10)", () => {
    const weights = new Map<string, number>();
    weights.set("1+2", 5);
    weights.set("3+4", 3);

    const result = applyGlobalReduction(weights, 20);
    expect(result).toBe(true);
    expect(weights.get("1+2")).toBe(4);
    expect(weights.get("3+4")).toBe(2);
  });

  it("не снижает при streak = 15 (не кратно 10)", () => {
    const weights = new Map<string, number>();
    weights.set("1+2", 5);

    const result = applyGlobalReduction(weights, 15);
    expect(result).toBe(false);
    expect(weights.get("1+2")).toBe(5);
  });
});

describe("parseExpression", () => {
  it("парсит сложение", () => {
    const result = parseExpression("3+5");
    expect(result).toEqual({ a: 3, b: 5 });
  });

  it("парсит вычитание", () => {
    const result = parseExpression("10-3");
    expect(result).toEqual({ a: 10, b: 3 });
  });

  it("парсит числа с нулём", () => {
    expect(parseExpression("0+0")).toEqual({ a: 0, b: 0 });
    expect(parseExpression("0-0")).toEqual({ a: 0, b: 0 });
  });

  it("парсит двузначные числа", () => {
    expect(parseExpression("10+10")).toEqual({ a: 10, b: 10 });
    expect(parseExpression("20-5")).toEqual({ a: 20, b: 5 });
  });

  it("возвращает { a: 0, b: 0 } для некорректной строки", () => {
    expect(parseExpression("invalid")).toEqual({ a: 0, b: 0 });
    expect(parseExpression("")).toEqual({ a: 0, b: 0 });
  });
});
