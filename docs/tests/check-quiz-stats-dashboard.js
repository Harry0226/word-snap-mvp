const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const quizView = index.match(/<section id="view-quiz"[\s\S]*?<\/section>/)?.[0] || "";

assert(quizView.includes('id="quizBankTotal"'), "quiz page should show current bank total");
assert(quizView.includes('id="quizDoneCount"'), "quiz page should show cumulative quiz count");
assert(quizView.includes('id="quizAccuracy"'), "quiz page should show cumulative accuracy");
assert(quizView.includes('id="quizFastRate"'), "quiz page should show cumulative fast rate");
assert(quizView.includes('id="quizWrongCount"'), "quiz page should show wrong question count");
assert(quizView.indexOf('class="stats quiz-stats"') < quizView.indexOf('class="panel quiz-controls"'), "quiz stats should sit above quiz controls");

assert(app.includes("quizStats: new Map()"), "quiz cumulative stats should live in state");
assert(app.includes('entry.key?.startsWith("quizStats:")'), "quiz cumulative stats should load from IndexedDB meta");
assert(app.includes("function renderQuizStats"), "quiz stats should have a renderer");
assert(app.includes("function getQuizBankTotal"), "quiz stats should calculate the selected bank size");
assert(app.includes("function recordQuizAnswer"), "quiz answers should update cumulative stats");
assert(app.includes('put("meta", { key: `quizStats:${grade}`'), "quiz cumulative stats should persist in IndexedDB meta");
assert(app.includes("renderQuizStats();"), "quiz stats should refresh during app rendering");
assert(app.includes("await recordQuizAnswer(q, isCorrect, isFast);"), "answering a quiz question should update cumulative stats");

console.log("quiz stats dashboard checks passed");
