import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  saveScore,
  register,
  login,
  me,
  loadUsers,
  loadWeights,
  submitAnswer,
  getLoginElements,
  showLoginError,
  hideLoginError,
  showRegisterError,
  hideRegisterError,
  populateUserSelect,
} from "./auth-client";

describe("auth-client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("saveScore", () => {
    it("отправляет счёт на сервер при наличии токена", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ totalScore: 42 }),
      });
      vi.stubGlobal("fetch", mockFetch);
      localStorage.setItem("authToken", "test-token");

      await saveScore(10);

      expect(mockFetch).toHaveBeenCalledWith("/api/save-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({ score: 10 }),
      });
    });

    it("не отправляет запрос без токена", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      await saveScore(10);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("вызывает onError при ошибке", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      });
      vi.stubGlobal("fetch", mockFetch);
      localStorage.setItem("authToken", "test-token");

      const onError = vi.fn();
      await saveScore(10, onError);

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("register", () => {
    it("регистрирует пользователя и возвращает данные", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { login: "newuser", totalScore: 0, lastLogin: "" },
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await register("newuser", "password123");

      expect(result.login).toBe("newuser");
      expect(result.totalScore).toBe(0);
      expect(result.level).toBe(1);
    });

    it("использует уровень из ответа сервера", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { login: "newuser", totalScore: 0, lastLogin: "", level: 2 },
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await register("newuser", "password123");

      expect(result.level).toBe(2);
    });

    it("бросает ошибку при неудачной регистрации", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Пользователь уже существует" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(register("existing", "pass")).rejects.toThrow(
        "Пользователь уже существует"
      );
    });
  });

  describe("login", () => {
    it("входит и сохраняет токен в localStorage", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "abc123",
            user: { login: "ivan", totalScore: 42, lastLogin: "2026-01-01T00:00:00.000Z" },
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await login("ivan", "secret");

      expect(localStorage.getItem("authToken")).toBe("abc123");
      expect(result.login).toBe("ivan");
      expect(result.totalScore).toBe(42);
      expect(result.level).toBe(1);
    });

    it("использует уровень из ответа сервера", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "abc123",
            user: { login: "ivan", totalScore: 42, lastLogin: "", level: 3 },
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await login("ivan", "secret");

      expect(result.level).toBe(3);
    });

    it("бросает ошибку при неверном пароле", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Неверный пароль" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(login("ivan", "wrong")).rejects.toThrow("Неверный пароль");
    });
  });

  describe("me", () => {
    it("возвращает профиль при наличии токена", async () => {
      localStorage.setItem("authToken", "test-token");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { login: "ivan", totalScore: 100, lastLogin: "2026-01-01T00:00:00.000Z" },
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await me();

      expect(result?.login).toBe("ivan");
      expect(result?.totalScore).toBe(100);
      expect(result?.level).toBe(1);
    });

    it("возвращает null без токена", async () => {
      const result = await me();
      expect(result).toBeNull();
    });

    it("очищает токен и возвращает null при ошибке", async () => {
      localStorage.setItem("authToken", "invalid-token");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await me();

      expect(result).toBeNull();
      expect(localStorage.getItem("authToken")).toBeNull();
    });
  });

  describe("loadUsers", () => {
    it("возвращает список логинов", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: ["alice", "bob", "charlie"] }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await loadUsers();

      expect(result).toEqual(["alice", "bob", "charlie"]);
    });

    it("возвращает пустой массив при ошибке", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Error" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await loadUsers();

      expect(result).toEqual([]);
    });
  });

  describe("loadWeights", () => {
    it("возвращает веса при наличии токена", async () => {
      localStorage.setItem("authToken", "test-token");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            weights: [
              { expression: "1+2", weight: 5 },
              { expression: "3+4", weight: 3 },
            ],
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await loadWeights();

      expect(result).toHaveLength(2);
      expect(result[0].expression).toBe("1+2");
      expect(result[0].weight).toBe(5);
    });

    it("возвращает пустой массив без токена", async () => {
      const result = await loadWeights();
      expect(result).toEqual([]);
    });

    it("возвращает пустой массив при ошибке", async () => {
      localStorage.setItem("authToken", "test-token");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Error" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await loadWeights();
      expect(result).toEqual([]);
    });
  });

  describe("submitAnswer", () => {
    it("отправляет ответ на сервер", async () => {
      localStorage.setItem("authToken", "test-token");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            newWeights: [{ expression: "1+2", weight: 4 }],
            level: 1,
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await submitAnswer("1+2", true, 1);

      expect(result.weights).toHaveLength(1);
      expect(result.weights[0].expression).toBe("1+2");
      expect(result.weights[0].weight).toBe(4);
      expect(result.level).toBe(1);
    });

    it("возвращает пустые веса без токена", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const result = await submitAnswer("1+2", true, 1);

      expect(result.weights).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("возвращает пустые веса при ошибке", async () => {
      localStorage.setItem("authToken", "test-token");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Error" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await submitAnswer("1+2", true, 1);
      expect(result.weights).toEqual([]);
    });
  });

  describe("getLoginElements", () => {
    it("возвращает все DOM-элементы экрана входа", () => {
      // Создаём элементы
      const loginScreen = document.createElement("div");
      loginScreen.id = "login-screen";
      const loginInput = document.createElement("input");
      loginInput.id = "login-input";
      const loginSelect = document.createElement("select");
      loginSelect.id = "login-select";
      const loginPassword = document.createElement("input");
      loginPassword.id = "login-password";
      const loginSubmit = document.createElement("button");
      loginSubmit.id = "login-submit";
      const loginRegister = document.createElement("button");
      loginRegister.id = "login-register";
      const loginError = document.createElement("p");
      loginError.id = "login-error";
      const registerScreen = document.createElement("div");
      registerScreen.id = "register-screen";
      const registerLogin = document.createElement("input");
      registerLogin.id = "register-login";
      const registerPassword = document.createElement("input");
      registerPassword.id = "register-password";
      const registerSubmit = document.createElement("button");
      registerSubmit.id = "register-submit";
      const registerBack = document.createElement("button");
      registerBack.id = "register-back";
      const registerError = document.createElement("p");
      registerError.id = "register-error";

      // Добавляем в DOM
      document.body.appendChild(loginScreen);
      document.body.appendChild(loginInput);
      document.body.appendChild(loginSelect);
      document.body.appendChild(loginPassword);
      document.body.appendChild(loginSubmit);
      document.body.appendChild(loginRegister);
      document.body.appendChild(loginError);
      document.body.appendChild(registerScreen);
      document.body.appendChild(registerLogin);
      document.body.appendChild(registerPassword);
      document.body.appendChild(registerSubmit);
      document.body.appendChild(registerBack);
      document.body.appendChild(registerError);

      const elements = getLoginElements();

      expect(elements.loginScreen).toBe(loginScreen);
      expect(elements.loginInput).toBe(loginInput);
      expect(elements.loginSelect).toBe(loginSelect);
      expect(elements.loginPassword).toBe(loginPassword);
      expect(elements.loginSubmit).toBe(loginSubmit);
      expect(elements.loginRegister).toBe(loginRegister);
      expect(elements.loginError).toBe(loginError);
      expect(elements.registerScreen).toBe(registerScreen);
      expect(elements.registerLogin).toBe(registerLogin);
      expect(elements.registerPassword).toBe(registerPassword);
      expect(elements.registerSubmit).toBe(registerSubmit);
      expect(elements.registerBack).toBe(registerBack);
      expect(elements.registerError).toBe(registerError);

      // Очищаем DOM
      document.body.innerHTML = "";
    });
  });

  describe("showLoginError", () => {
    it("показывает текст ошибки", () => {
      const errorEl = document.createElement("p");
      errorEl.hidden = true;

      showLoginError(errorEl, "Введите логин и пароль");

      expect(errorEl.textContent).toBe("Введите логин и пароль");
      expect(errorEl.hidden).toBe(false);

      document.body.innerHTML = "";
    });
  });

  describe("hideLoginError", () => {
    it("скрывает и очищает ошибку", () => {
      const errorEl = document.createElement("p");
      errorEl.textContent = "Ошибка";
      errorEl.hidden = false;

      hideLoginError(errorEl);

      expect(errorEl.textContent).toBe("");
      expect(errorEl.hidden).toBe(true);

      document.body.innerHTML = "";
    });
  });

  describe("showRegisterError", () => {
    it("показывает текст ошибки регистрации", () => {
      const errorEl = document.createElement("p");
      errorEl.hidden = true;

      showRegisterError(errorEl, "Пароль слишком короткий");

      expect(errorEl.textContent).toBe("Пароль слишком короткий");
      expect(errorEl.hidden).toBe(false);

      document.body.innerHTML = "";
    });
  });

  describe("hideRegisterError", () => {
    it("скрывает и очищает ошибку регистрации", () => {
      const errorEl = document.createElement("p");
      errorEl.textContent = "Ошибка";
      errorEl.hidden = false;

      hideRegisterError(errorEl);

      expect(errorEl.textContent).toBe("");
      expect(errorEl.hidden).toBe(true);

      document.body.innerHTML = "";
    });
  });

  describe("populateUserSelect", () => {
    it("добавляет пользователей в select", async () => {
      const loginInput = document.createElement("input");
      loginInput.id = "login-input";
      const loginSelect = document.createElement("select");
      loginSelect.id = "login-select";
      loginSelect.hidden = true;
      document.body.appendChild(loginInput);
      document.body.appendChild(loginSelect);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: ["alice", "bob"] }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await populateUserSelect(loginInput as HTMLInputElement, loginSelect as HTMLSelectElement);

      expect(loginSelect.hidden).toBe(false);
      // В тесте select пустой (без placeholder), добавляются 2 пользователя
      expect(loginSelect.options.length).toBe(2);
      expect(loginSelect.options[0].value).toBe("alice");
      expect(loginSelect.options[1].value).toBe("bob");

      document.body.innerHTML = "";
    });

    it("не показывает select, если пользователей нет", async () => {
      const loginInput = document.createElement("input");
      loginInput.id = "login-input";
      const loginSelect = document.createElement("select");
      loginSelect.id = "login-select";
      loginSelect.hidden = true;
      document.body.appendChild(loginInput);
      document.body.appendChild(loginSelect);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await populateUserSelect(loginInput as HTMLInputElement, loginSelect as HTMLSelectElement);

      expect(loginSelect.hidden).toBe(true);

      document.body.innerHTML = "";
    });

    it("скрывает select при вводе в input", async () => {
      const loginInput = document.createElement("input");
      loginInput.id = "login-input";
      const loginSelect = document.createElement("select");
      loginSelect.id = "login-select";
      loginSelect.hidden = false;
      document.body.appendChild(loginInput);
      document.body.appendChild(loginSelect);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: ["alice"] }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await populateUserSelect(loginInput as HTMLInputElement, loginSelect as HTMLSelectElement);

      expect(loginSelect.hidden).toBe(false);

      // Имитируем ввод
      loginInput.value = "alice";
      const inputEvent = new Event("input", { bubbles: true });
      loginInput.dispatchEvent(inputEvent);

      expect(loginSelect.hidden).toBe(true);

      document.body.innerHTML = "";
    });
  });
});
