const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
const trainView = index.match(/<section id="view-train"[\s\S]*?<section id="view-battle"/)?.[0] || "";
const quizView = index.match(/<section id="view-quiz"[\s\S]*?<\/section>/)?.[0] || "";

assert(!index.includes('data-view="achievements"'), "achievement navigation should be removed");
assert(!index.includes('id="view-achievements"'), "achievement view should be removed");
assert(!app.includes("ACHIEVEMENTS"), "achievement definitions should be removed");
assert(!app.includes("checkAchievements"), "achievement checks should be removed");
assert(!styles.includes(".achievement-card"), "achievement styles should be removed");

assert(trainView.includes('id="trainWordStats"'), "training view should contain word statistics");
assert(trainView.includes('id="trainQuizStats"'), "training view should contain matching-grade quiz statistics");
assert(trainView.includes('id="trainStreakCard"'), "training view should contain the word streak card");
assert(quizView.includes('id="quizStreakCard"'), "quiz view should contain the quiz streak card");
assert(app.includes("function renderTrainQuizStats"), "training view should render matching-grade quiz stats");

assert(index.includes('id="trainContinueBtn"'), "training feedback should include a continue button");
assert(
  /if \(isCorrect\)[\s\S]*setTimeout\(nextWord,[\s\S]*else[\s\S]*showTrainContinueButton/.test(app),
  "correct training answers should auto advance while wrong answers wait for confirmation"
);
assert(app.includes('els.trainContinueBtn.addEventListener("click", nextWord)'), "continue training button should advance");
assert(styles.includes("border-width: 4px"), "answer feedback borders should be visibly thick");

console.log("stats and answer feedback checks passed");
