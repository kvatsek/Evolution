import {
  formatGameEndMessage,
  formatProblem,
  hideError,
  pickOperands,
  processSubmit,
  showError,
  updateScore,
} from "./game";

const scoreEl = document.getElementById("score")!;
const problemEl = document.getElementById("problem")!;
const formEl = document.getElementById("answer-form") as HTMLFormElement;
const inputEl = document.getElementById("answer-input") as HTMLInputElement;
const errorEl = document.getElementById("error")!;
const gameEndEl = document.getElementById("game-end")!;
const finalScoreEl = document.getElementById("final-score")!;
const restartButton = document.getElementById("restart-button") as HTMLButtonElement;
const finishButton = document.getElementById("finish-button") as HTMLButtonElement;

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
function endGame(): void {
  if (isGameOver) return;
  isGameOver = true;

  console.log(formatGameEndMessage(score));
  finalScoreEl.textContent = String(score);
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
  formEl.hidden = false;
  gameEndEl.hidden = true;
  inputEl.value = "";
  inputEl.focus();
}

restartButton.addEventListener("click", restartGame);
finishButton.addEventListener("click", endGame);

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

generateProblem();
updateScore(scoreEl, score);
