import {
  formatGameEndMessage,
  formatProblem,
  hideError,
  pickWeightedProblem,
  processSubmit,
  showError,
  updateScore,
} from "./game.js";
import {
  getLoginElements,
  hideLoginError,
  hideRegisterError,
  loadWeights,
  login,
  me,
  populateUserSelect,
  register,
  saveScore,
  showLoginError,
  showRegisterError,
  submitAnswer,
} from "./auth-client.js";

const scoreEl = document.getElementById("score")!;
const levelEl = document.getElementById("level")!;
const problemEl = document.getElementById("problem")!;
const formEl = document.getElementById("answer-form") as HTMLFormElement;
const inputEl = document.getElementById("answer-input") as HTMLInputElement;
const errorEl = document.getElementById("error")!;
const gameEl = document.getElementById("game")!;
const gameEndEl = document.getElementById("game-end")!;
const finalScoreEl = document.getElementById("final-score")!;
const saveErrorEl = document.getElementById("save-error") as HTMLElement | null;
const userLoginEl = document.getElementById("user-login")!;
const restartButton = document.getElementById("restart-button") as HTMLButtonElement;
const switchUserButton = document.getElementById("switch-user-button") as HTMLButtonElement;
const finishButton = document.getElementById("finish-button") as HTMLButtonElement;
const loginScreen = document.getElementById("login-screen")!;
const registerScreen = document.getElementById("register-screen")!;

let score = 0;
let a = 0;
let b = 0;
let currentOperator: "+" | "-" = "+";
let currentExpression = "";
let isGameOver = false;
let weights = new Map<string, number>();
let expressions: string[] = [];
let correctStreak = 0;
let currentLevel = 1;

/** Генерирует новый пример на сложение на основе весов. */
async function generateProblem(): Promise<void> {
  // Обновляем expressions — только примеры, которые есть в weights
  expressions = Array.from(weights.keys());
  const result = pickWeightedProblem(expressions, weights);
  if (result) {
    a = result.a;
    b = result.b;
    currentOperator = result.operator;
    currentExpression = result.expression;
    problemEl.textContent = formatProblem(a, b, currentOperator);
  }
}

/** Загружает веса примеров с сервера. */
async function loadWeightsForGame(): Promise<void> {
  const weightEntries = await loadWeights();
  weights = new Map<string, number>();
  expressions = [];
  for (const entry of weightEntries) {
    // Фильтруем только примеры с весом > 0
    if (entry.weight > 0) {
      weights.set(entry.expression, entry.weight);
    }
  }
  expressions = Array.from(weights.keys());
}

/** Обрабатывает отправку формы: проверяет ответ и начисляет очки. */
formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(errorEl);

  const outcome = processSubmit(inputEl.value, a, b, score, currentOperator);

  if (outcome.kind === "invalid") {
    showError(errorEl, "Введите число");
    return;
  }

  if (outcome.kind === "correct") {
    score = outcome.score;
    correctStreak++;

    // Отправляем результат на сервер для обновления весов
    const result = await submitAnswer(currentExpression, true, correctStreak);

    // Обновляем веса из ответа сервера
    if (result.weights) {
      weights = new Map<string, number>();
      for (const w of result.weights) {
        if (w.weight > 0) {
          weights.set(w.expression, w.weight);
        }
      }
    }

    // Обновляем уровень, если сервер вернул новый
    if (result.level !== undefined) {
      currentLevel = result.level;
      localStorage.setItem("authLevel", String(currentLevel));
      levelEl.textContent = `Уровень: ${currentLevel}`;
    }

    // Счётчик верных ответов подряд сохраняется (сбрасывается при ошибке)

    // Генерируем новый пример
    await generateProblem();
    updateScore(scoreEl, score);
    inputEl.value = "";
    inputEl.focus();
    return;
  }

  // Неверный ответ — сбрасываем streak и отправляем на сервер
  correctStreak = 0;
  const wrongResult = await submitAnswer(currentExpression, false, correctStreak);
  if (wrongResult.weights) {
    weights = new Map<string, number>();
    for (const w of wrongResult.weights) {
      if (w.weight > 0) {
        weights.set(w.expression, w.weight);
      }
    }
  }

  showError(errorEl, "Неверный ответ, попробуйте ещё раз");
  inputEl.select();
});

/** Завершает игру: показывает экран с результатом и выводит сообщение в консоль. */
async function endGame(): Promise<void> {
  if (isGameOver) return;
  isGameOver = true;

  // Сохраняем счёт на сервере
  try {
    await saveScore(score, (msg) => {
      if (saveErrorEl) {
        saveErrorEl.textContent = msg;
        saveErrorEl.hidden = false;
      }
    });
  } catch {
    // Ошибка уже обработана в saveScore через onError
  }

  console.log(formatGameEndMessage(score));
  finalScoreEl.textContent = String(score);
  gameEl.hidden = true;
  formEl.hidden = true;
  errorEl.hidden = true;
  gameEndEl.hidden = false;
}

/** Перезапускает игру, сбрасывая счёт и возвращая игровой интерфейс. */
function restartGame(): void {
  score = 0;
  correctStreak = 0;
  isGameOver = false;
  updateScore(scoreEl, score);
  generateProblem();
  gameEl.hidden = false;
  formEl.hidden = false;
  gameEndEl.hidden = true;
  inputEl.value = "";
  inputEl.focus();
}

restartButton.addEventListener("click", restartGame);
finishButton.addEventListener("click", endGame);

/** Переключает на экран входа, очищая данные текущей сессии. */
switchUserButton.addEventListener("click", () => {
  score = 0;
  isGameOver = false;
  localStorage.removeItem("authToken");
  localStorage.removeItem("authLogin");
  showLogin();
});

/** Завершает игру при нажатии клавиши Escape. */
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !isGameOver) {
    endGame();
  }
});

/** Завершает игру при закрытии окна браузера. */
window.addEventListener("beforeunload", () => {
  if (!isGameOver) {
    endGame();
  }
});

/** Показывает экран игры и скрывает экраны входа и регистрации. */
async function showGame(): Promise<void> {
  gameEl.hidden = false;
  loginScreen.hidden = true;
  registerScreen.hidden = true;
  formEl.hidden = false;
  errorEl.hidden = true;
  gameEndEl.hidden = true;
  userLoginEl.textContent = localStorage.getItem("authLogin") ?? "";
  currentLevel = parseInt(localStorage.getItem("authLevel") || "1", 10);
  levelEl.textContent = `Уровень: ${currentLevel}`;
  await loadWeightsForGame();
  await generateProblem();
  updateScore(scoreEl, score);
  inputEl.focus();
}

/** Показывает экран входа и скрывает экраны игры и регистрации. */
function showLogin(): void {
  gameEl.hidden = true;
  registerScreen.hidden = true;
  loginScreen.hidden = false;
  formEl.hidden = true;
  gameEndEl.hidden = true;
}

/** Показывает экран регистрации и скрывает экраны входа и игры. */
function showRegister(): void {
  loginScreen.hidden = true;
  gameEl.hidden = true;
  registerScreen.hidden = false;
}

/** Обрабатывает вход пользователя. */
async function handleLoginSubmit(
  loginInputEl: HTMLInputElement,
  passwordEl: HTMLInputElement,
  errorEl: HTMLElement
): Promise<void> {
  hideLoginError(errorEl);
  const loginName = loginInputEl.value;
  const password = passwordEl.value;

  if (!loginName || !password) {
    showLoginError(errorEl, "Введите логин и пароль");
    return;
  }

  try {
    const user = await login(loginName, password);
    localStorage.setItem("authLogin", loginName);
    localStorage.setItem("authLevel", String(user.level));
    currentLevel = user.level;
    await showGame();
  } catch (err) {
    showLoginError(errorEl, (err as Error).message);
  }
}

/** Обрабатывает регистрацию нового пользователя. */
async function handleRegisterSubmit(
  loginInputEl: HTMLInputElement,
  passwordEl: HTMLInputElement,
  errorEl: HTMLElement
): Promise<void> {
  hideRegisterError(errorEl);
  const loginName = loginInputEl.value;
  const password = passwordEl.value;

  if (!loginName || !password) {
    showRegisterError(errorEl, "Введите логин и пароль");
    return;
  }

  try {
    await register(loginName, password);
    // Автоматический вход после регистрации
    const user = await login(loginName, password);
    localStorage.setItem("authLogin", loginName);
    localStorage.setItem("authLevel", String(user.level));
    currentLevel = user.level;
    await showGame();
  } catch (err) {
    showRegisterError(errorEl, (err as Error).message);
  }
}

/** Проверяет, авторизован ли пользователь. */
async function checkAuth(): Promise<void> {
  const elements = getLoginElements();
  const {
    loginInput,
    loginSelect,
    loginPassword,
    loginSubmit,
    loginRegister,
    loginError,
    registerLogin,
    registerPassword,
    registerSubmit,
    registerBack,
    registerError,
  } = elements;

  // Проверяем, есть ли токен
  const token = localStorage.getItem("authToken");
  if (token) {
    // Пытаемся загрузить пользователя
    try {
      const user = await me();
      if (user) {
        localStorage.setItem("authLogin", user.login);
        localStorage.setItem("authLevel", String(user.level));
        currentLevel = user.level;
        await showGame();
        return;
      }
    } catch {
      // Токен недействителен — показываем вход
    }
  }

  // Показываем экран входа
  try {
    if (loginInput && loginSelect) {
      await populateUserSelect(loginInput, loginSelect);
    }
  } catch {
    // Если не удалось загрузить пользователей — всё равно показываем вход
  }

  if (loginSubmit) {
    loginSubmit.addEventListener("click", () => {
      handleLoginSubmit(loginInput!, loginPassword!, loginError);
    });
  }

  if (loginRegister) {
    loginRegister.addEventListener("click", () => {
      showRegister();
    });
  }

  if (registerSubmit) {
    registerSubmit.addEventListener("click", () => {
      handleRegisterSubmit(registerLogin!, registerPassword!, registerError);
    });
  }

  if (registerBack) {
    registerBack.addEventListener("click", () => {
      showLogin();
    });
  }

  if (loginScreen) {
    loginScreen.hidden = false;
  }
  showLogin();
}

// Запускаем проверку авторизации
checkAuth();
