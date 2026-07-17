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

let score = 0;
let a = 0;
let b = 0;

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

/** Завершает игру при закрытии окна браузера и выводит итоговый счёт в консоль. */
window.addEventListener("beforeunload", () => {
  console.log(formatGameEndMessage(score));
});

generateProblem();
updateScore(scoreEl, score);
