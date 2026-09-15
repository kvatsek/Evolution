/** Базовый URL API. */
const API_BASE = "";

/** Получает токен из localStorage. */
function getToken(): string | null {
  return localStorage.getItem("authToken");
}

/** Сохраняет токен в localStorage. */
function setToken(token: string): void {
  localStorage.setItem("authToken", token);
}

/** Удаляет токен из localStorage. */
function clearToken(): void {
  localStorage.removeItem("authToken");
}

/** Выполняет POST-запрос к API. */
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Ошибка сервера");
  }
  return data as T;
}

/** Выполняет GET-запрос к API с Bearer-токеном. */
async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Ошибка сервера");
  }
  return data as T;
}

/** Сохраняет счёт игрока на сервере.
 * При ошибке вызывает onError (если передан) и выводит в консоль. */
export async function saveScore(
  score: number,
  onError?: (error: string) => void
): Promise<void> {
  try {
    const token = getToken();
    if (!token) {
      const msg = "Не авторизован — счёт не сохранён";
      console.warn(msg);
      if (onError) onError(msg);
      return;
    }
    const res = await fetch("/api/save-score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ score }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? "Ошибка сервера");
    }
  } catch (err) {
    const message = (err as Error).message ?? "Ошибка сохранения счёта";
    console.error("Не удалось сохранить счёт:", message);
    if (onError) {
      onError("Не удалось сохранить счёт. Убедитесь, что запущен dev-сервер (npm run dev)");
    }
  }
}

/**
 * Регистрирует нового пользователя и выполняет вход.
 * Возвращает { login, totalScore }.
 */
export async function register(login: string, password: string): Promise<{
  login: string;
  totalScore: number;
  lastLogin: string;
}> {
  const data = await apiPost("/api/register", { login, password });
  const { user } = data as {
    user: { login: string; totalScore: number; lastLogin: string };
  };
  return user;
}

/**
 * Выполняет вход пользователя.
 * Возвращает { login, totalScore } и сохраняет токен.
 */
export async function login(
  login: string,
  password: string
): Promise<{ login: string; totalScore: number; lastLogin: string }> {
  const data = await apiPost("/api/login", { login, password });
  const { token, user } = data as {
    token: string;
    user: { login: string; totalScore: number; lastLogin: string };
  };
  setToken(token);
  return user;
}

/**
 * Загружает информацию о текущем пользователе.
 * Возвращает null, если не авторизован.
 */
export async function me(): Promise<
  | { login: string; totalScore: number; lastLogin: string }
  | null
> {
  const token = getToken();
  if (!token) return null;
  try {
    const data = await apiGet<{
      user: { login: string; totalScore: number; lastLogin: string };
    }>("/api/me");
    return data.user;
  } catch {
    clearToken();
    return null;
  }
}

/** Загружает список пользователей для заполнения <select>. */
export async function loadUsers(): Promise<string[]> {
  try {
    const { users } = (await apiGet<{ users: string[] }>("/api/users")) ?? {
      users: [],
    };
    return users;
  } catch {
    return [];
  }
}

/** Получает DOM-элементы экрана входа. */
export function getLoginElements(): {
  loginScreen: HTMLElement;
  loginInput: HTMLInputElement;
  loginSelect: HTMLSelectElement;
  loginPassword: HTMLInputElement;
  loginSubmit: HTMLButtonElement;
  loginRegister: HTMLButtonElement;
  loginError: HTMLElement;
  registerScreen: HTMLElement;
  registerLogin: HTMLInputElement;
  registerPassword: HTMLInputElement;
  registerSubmit: HTMLButtonElement;
  registerBack: HTMLButtonElement;
  registerError: HTMLElement;
} {
  return {
    loginScreen: document.getElementById("login-screen") as HTMLElement,
    loginInput: document.getElementById("login-input") as HTMLInputElement,
    loginSelect: document.getElementById("login-select") as HTMLSelectElement,
    loginPassword: document.getElementById(
      "login-password"
    ) as HTMLInputElement,
    loginSubmit: document.getElementById("login-submit") as HTMLButtonElement,
    loginRegister: document.getElementById(
      "login-register"
    ) as HTMLButtonElement,
    loginError: document.getElementById("login-error") as HTMLElement,
    registerScreen: document.getElementById("register-screen") as HTMLElement,
    registerLogin: document.getElementById("register-login") as HTMLInputElement,
    registerPassword: document.getElementById(
      "register-password"
    ) as HTMLInputElement,
    registerSubmit: document.getElementById("register-submit") as HTMLButtonElement,
    registerBack: document.getElementById("register-back") as HTMLButtonElement,
    registerError: document.getElementById("register-error") as HTMLElement,
  };
}

/** Показывает ошибку на экране входа. */
export function showLoginError(errorEl: HTMLElement, message: string): void {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

/** Скрывает ошибку на экране входа. */
export function hideLoginError(errorEl: HTMLElement): void {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

/** Показывает ошибку на экране регистрации. */
export function showRegisterError(errorEl: HTMLElement, message: string): void {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

/** Скрывает ошибку на экране регистрации. */
export function hideRegisterError(errorEl: HTMLElement): void {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

/** Загружает список пользователей: показывает <select> если есть пользователи. */
export async function populateUserSelect(
  loginInput: HTMLInputElement,
  loginSelect: HTMLSelectElement
): Promise<void> {
  const users = await loadUsers();
  if (users.length > 0) {
    loginSelect.hidden = false;
    for (const user of users) {
      const option = document.createElement("option");
      option.value = user;
      option.textContent = user;
      loginSelect.appendChild(option);
    }
    // При выборе из списка — значение идёт в input
    loginSelect.addEventListener("change", () => {
      loginInput.value = loginSelect.value;
    });
  }
  // При вводе в input — скрываем select
  loginInput.addEventListener("input", () => {
    if (loginInput.value) {
      loginSelect.hidden = true;
    } else {
      loginSelect.hidden = users.length === 0;
    }
  });
}
