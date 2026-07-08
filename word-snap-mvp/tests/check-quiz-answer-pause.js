const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

assert(index.includes('id="quizContinueBtn"'), "quiz view should include a continue button");
assert(app.includes("showQuizContinueButton"), "quiz logic should expose the continue action after a wrong answer");
assert(app.includes("hideQuizContinueButton"), "quiz logic should hide the continue action for a new question");
assert(
  !app.includes("setTimeout(nextQuizQuestion, isCorrect ? 800 : 1500)"),
  "wrong answers must no longer automatically advance"
);
assert(
  /if \(isCorrect\)[\s\S]*setTimeout\(nextQuizQuestion,\s*500\)[\s\S]*else[\s\S]*showQuizContinueButton/.test(app),
  "correct answers should auto advance while wrong answers wait for confirmation"
);
assert(
  app.includes('els.quizContinueBtn.addEventListener("click", nextQuizQuestion)'),
  "the continue button should advance to the next question"
);

console.log("quiz answer pause checks passed");
