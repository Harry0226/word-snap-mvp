const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

[
  "dailyTaskPanel",
  "dailyTaskSummary",
  "dailyDueCount",
  "dailyNewCount",
  "sevenDayRetention",
  "sevenDayPending",
  "startDailyTaskBtn",
  "startDueReviewBtn"
].forEach((id) => assert(html.includes(`id="${id}"`), `missing daily learning UI #${id}`));

const dailyScriptIndex = html.indexOf("daily-learning.js");
const appScriptIndex = html.indexOf("app.js?v=");
assert(dailyScriptIndex >= 0, "daily-learning.js must be loaded");
assert(dailyScriptIndex < appScriptIndex, "daily-learning.js must load before app.js");
assert(html.includes("今日 0/300"), "daily training progress should use the 300-word target");
assert(app.includes('const DAILY_TASK_META_PREFIX = "dailyTask:v2:"'), "daily task persistence must be versioned");
assert(app.includes("async function ensureDailyTask()"), "daily task creation is missing");
assert(app.includes("async function completeDailyTaskItem(key, wordId, options = {})"), "daily task progress persistence is missing");
assert(app.includes("async function syncDailyTaskFromTraining(word, isCorrect, session)"), "free training must sync into the daily task");
assert(app.includes("if (!isCorrect || !word || !session) return"), "only correct training answers should complete daily words");
assert(app.includes("{ allowExternal: true }"), "free-training words should replace unfinished new-word slots");
assert(app.includes("applyLearningResult(record"), "answer recording must use spaced review scheduling");
assert(app.includes("getSevenDayRetentionStats(getEligibleWords(), state.records)"), "seven-day retention must use current stage");
assert(app.includes('? "zhToEnChoice"'), "seven-day checks must use active recall");
assert(app.includes('session.current.fixedMode !== "customChoice"'), "seven-day checks must preserve custom-choice questions");
assert(app.includes("preserveOrder ? queue : shuffle(queue)"), "daily queue must preserve due-first order");
assert(app.includes('els.startBtn.addEventListener("click", startSession)'), "free training entry must remain available");

console.log("daily learning integration checks passed");
