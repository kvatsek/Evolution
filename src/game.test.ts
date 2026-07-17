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
    expect(processSubmit("abc", 2, 3, 0)).toEqual({ kind: "invalid" });
  });

  it("возвращает wrong для неверного ответа", () => {
    expect(processSubmit("4", 2, 3, 2)).toEqual({ kind: "wrong" });
  });

  it("возвращает correct и увеличивает счёт", () => {
    const random = vi.fn().mockReturnValue(0);

    expect(processSubmit("5", 2, 3, 2, random)).toEqual({
      kind: "correct",
      score: 3,
      a: 0,
      b: 0,
    });
  });
});

describe("formatGameEndMessage", () => {
  it("формирует сообщение об окончании игры", () => {
    expect(formatGameEndMessage(7)).toBe("Игра завершена. Итоговый счёт: 7");
  });
});
