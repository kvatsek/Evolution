import {
  formatGameEndMessage,
  formatProblem,
  hideError,
  pickOperands,
  processSubmit,
  showError,
  updateScore,
} from "./game.js";
import {
  getLoginElements,
  hideLoginError,
  hideRegisterError,
  login,
  me,
  populateUserSelect,
  register,
  saveScore,
  showLoginError,
  showRegisterError,
} from "./auth-client.js";

const scoreEl = document.getElementById("score")!;
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
let isGameOver = false;

/** Генерирует новый пример на сложение, сумма которого не превышает 10. */
function generateProblem(): void {
  const operands = pickOperands();
  a = operands.a;
  b = operands.b;
  problemEl.textContent = formatProblem(a, b);
}

/** Обрабатывает отправку формы: проверяет ответ и начисляет очки. */
formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  hideError(errorEl);

  const outcome = processSubmit(inputEl.value, a, b, score);

  if (outcome.kind === "invalid") {
    showError(errorEl, "Введите число");
    return;
  }

  if (outcome.kind === "correct") {
    score = outcome.score;
    a = outcome.a;
    b = outcome.b;
    updateScore(scoreEl, score);
    problemEl.textContent = formatProblem(a, b);
    inputEl.value = "";
    inputEl.focus();
    return;
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
function showGame(): void {
  gameEl.hidden = false;
  loginScreen.hidden = true;
  registerScreen.hidden = true;
  formEl.hidden = false;
  errorEl.hidden = true;
  gameEndEl.hidden = true;
  userLoginEl.textContent = localStorage.getItem("authLogin") ?? "";
  generateProblem();
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
    await login(loginName, password);
    localStorage.setItem("authLogin", loginName);
    showGame();
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
    await login(loginName, password);
    localStorage.setItem("authLogin", loginName);
    showGame();
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
        showGame();
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
