import { describe, expect, it, beforeEach } from "vitest";
import {
  addCorrectAnswer,
  getWorldTimeDisplay,
  getHoursElapsed,
  loadWorldTime,
  saveWorldTime,
  updateWorldTimeDisplay,
} from "./world-time";

describe("getWorldTimeDisplay", () => {
  it("должен форматировать 0 часов", () => {
    expect(getWorldTimeDisplay(0)).toBe("0 часов");
  });

  it("должен форматировать 1 час", () => {
    expect(getWorldTimeDisplay(1)).toBe("1 час");
  });

  it("должен форматировать 4 часа", () => {
    expect(getWorldTimeDisplay(4)).toBe("4 часа");
  });

  it("должен форматировать 5 часов", () => {
    expect(getWorldTimeDisplay(5)).toBe("5 часов");
  });

  it("должен форматировать 23 часа", () => {
    expect(getWorldTimeDisplay(23)).toBe("23 часа");
  });

  it("должен форматировать 24 часа (1 день)", () => {
    expect(getWorldTimeDisplay(24)).toBe("1 день");
  });

  it("должен форматировать 25 часов (1 день 1 час)", () => {
    expect(getWorldTimeDisplay(25)).toBe("1 день, 1 час");
  });

  it("должен форматировать 48 часов (2 дня)", () => {
    expect(getWorldTimeDisplay(48)).toBe("2 дня");
  });

  it("должен форматировать 365 дней (1 год)", () => {
    expect(getWorldTimeDisplay(365 * 24)).toBe("1 год");
  });

  it("должен форматировать 1 год 1 день 1 час", () => {
    const totalHours = 365 * 24 + 24 + 1;
    expect(getWorldTimeDisplay(totalHours)).toBe("1 год, 1 день, 1 час");
  });

  it("должен форматировать 2 года 45 дней 13 часов", () => {
    const totalHours = 2 * 365 * 24 + 45 * 24 + 13;
    expect(getWorldTimeDisplay(totalHours)).toBe("2 года, 45 дней, 13 часов");
  });

  it("должен форматировать 100 лет", () => {
    const totalHours = 100 * 365 * 24;
    expect(getWorldTimeDisplay(totalHours)).toBe("100 лет");
  });
});

describe("addCorrectAnswer", () => {
  it("должен увеличивать correctAnswers на 1", () => {
    const state = { correctAnswers: 0, totalHours: 0 };
    addCorrectAnswer(state);
    expect(state.correctAnswers).toBe(1);
    expect(state.totalHours).toBe(0);
  });

  it("должен увеличивать totalHours каждые 10 правильных ответов", () => {
    const state = { correctAnswers: 0, totalHours: 0 };

    for (let i = 1; i <= 9; i++) {
      addCorrectAnswer(state);
      expect(state.correctAnswers).toBe(i);
      expect(state.totalHours).toBe(0);
    }

    // 10 правильных ответов = 1 час
    addCorrectAnswer(state);
    expect(state.correctAnswers).toBe(10);
    expect(state.totalHours).toBe(1);

    // Ещё 9 правильных = 1 час (всего 19)
    for (let i = 0; i < 9; i++) {
      addCorrectAnswer(state);
    }
    expect(state.correctAnswers).toBe(19);
    expect(state.totalHours).toBe(1);

    // 20 правильных = 2 часа
    addCorrectAnswer(state);
    expect(state.correctAnswers).toBe(20);
    expect(state.totalHours).toBe(2);
  });

  it("должен работать с большим количеством правильных ответов", () => {
    const state = { correctAnswers: 0, totalHours: 0 };

    for (let i = 0; i < 100; i++) {
      addCorrectAnswer(state);
    }

    expect(state.correctAnswers).toBe(100);
    expect(state.totalHours).toBe(10);
  });
});

describe("getHoursElapsed", () => {
  it("должен возвращать 0 для пустого состояния", () => {
    const state = { correctAnswers: 0, totalHours: 0 };
    expect(getHoursElapsed(state)).toBe(0);
  });

  it("должен возвращать количество часов", () => {
    const state = { correctAnswers: 15, totalHours: 1 };
    expect(getHoursElapsed(state)).toBe(1);
  });

  it("должен корректно считать для большого количества", () => {
    const state = { correctAnswers: 47, totalHours: 4 };
    expect(getHoursElapsed(state)).toBe(4);
  });
});

describe("loadWorldTime / saveWorldTime", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("должен возвращать начальное состояние при отсутствии данных", () => {
    const state = loadWorldTime("testuser");
    expect(state).toEqual({ correctAnswers: 0, totalHours: 0 });
  });

  it("должен сохранять и загружать состояние", () => {
    const state = { correctAnswers: 25, totalHours: 2 };
    saveWorldTime("testuser", state);

    const loaded = loadWorldTime("testuser");
    expect(loaded).toEqual(state);
  });

  it("должен иметь разные состояния для разных пользователей", () => {
    saveWorldTime("user1", { correctAnswers: 10, totalHours: 1 });
    saveWorldTime("user2", { correctAnswers: 20, totalHours: 2 });

    const state1 = loadWorldTime("user1");
    const state2 = loadWorldTime("user2");

    expect(state1.correctAnswers).toBe(10);
    expect(state2.correctAnswers).toBe(20);
  });
});

describe("updateWorldTimeDisplay", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("должен обновлять DOM-элемент с временем", () => {
    const timeEl = document.createElement("div");
    timeEl.id = "world-time";
    document.body.appendChild(timeEl);

    saveWorldTime("testuser", { correctAnswers: 25, totalHours: 2 });
    updateWorldTimeDisplay(2);

    expect(timeEl.textContent).toBe("2 часа");
  });

  it("должен корректно отображать сложный формат", () => {
    const timeEl = document.createElement("div");
    timeEl.id = "world-time";
    document.body.appendChild(timeEl);

    const totalHours = 2 * 365 * 24 + 45 * 24 + 13;
    saveWorldTime("testuser", { correctAnswers: totalHours * 10, totalHours });
    updateWorldTimeDisplay(totalHours);

    expect(timeEl.textContent).toBe("2 года, 45 дней, 13 часов");
  });
});
