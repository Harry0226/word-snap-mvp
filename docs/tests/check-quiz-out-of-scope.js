const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("app.js", "utf8");
const quizSection = app.slice(app.indexOf("function getQuizDistractorsForSentence"), app.indexOf("async function startQuiz"));

assert(quizSection.includes("return shuffle(pool).slice(0, 4);"), "quiz should keep its existing four-distractor builder");
assert(quizSection.includes("if (choices.length < 5)"), "quiz should keep filling its existing five-choice questions");
assert(quizSection.includes("return shuffle([correctChoice, ...distractors]).slice(0, 5);"), "quiz should remain five-choice");
assert(!quizSection.includes("hasMeaningConflict"), "the vocabulary semantic filter must not change quiz logic");

console.log("quiz out-of-scope checks passed");
