const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const storage = fs.readFileSync("storage.js", "utf8");
const decks = fs.readFileSync("decks.js", "utf8");
const battle = fs.readFileSync("battle.js", "utf8");
const quiz = fs.readFileSync("quiz.js", "utf8");

// 1. Preserve essential brand wording while removing secondary slogans & labels
assert(html.includes("代老师带你秒懂词"), "main brand phrase '代老师带你秒懂词' must be preserved");
for (const clutter of [
  "WORD SNAP",
  "DAILY PRACTICE",
  "每天一点，记得更牢。",
  "分层训练",
  "词组刷题",
  "未达标",
  "2 秒内算秒选，超过 3.5 秒为慢词",
  "练习记录只保存在本机浏览器，不会上传。",
  "对战结果不会写入个人练习记录。"
]) {
  assert(!html.includes(clutter), `index.html should remove unnecessary slogan/hint/label: ${clutter}`);
  assert(!app.includes(clutter), `app.js should remove unnecessary slogan/hint/label: ${clutter}`);
}

// 2. Modular zero-build architecture (DX)
[
  "utils.js",
  "storage.js",
  "decks.js",
  "battle.js",
  "quiz.js",
  "learning-flow.js",
  "app.js"
].forEach((file) => {
  assert(fs.existsSync(file), `module ${file} should exist`);
  assert(html.includes(`./${file}?v=`), `index.html should load ${file} with cache-busting version`);
});

assert(storage.includes("openDb"), "storage.js should own IndexedDB initialization");
assert(decks.includes("parseWordsFromText"), "decks.js should own text import parsing");
assert(battle.includes("startBattle"), "battle.js should own battle mode");
assert(quiz.includes("startQuiz"), "quiz.js should own quiz mode");

// 3. Semantic AX state hooks & inspector
assert(html.includes('data-active-view="train"'), "body should declare active view attribute");
assert(html.includes('data-session-state="idle"'), "training view should expose session state attribute");
assert(html.includes('data-battle-state="idle"'), "battle view should expose battle state attribute");
assert(html.includes('data-quiz-state="idle"'), "quiz view should expose quiz state attribute");
assert(app.includes("window.WordSnapInspector"), "app.js should expose read-only agent inspector snapshot");
assert(app.includes("setTrainingSessionState"), "training state transitions should update semantic data attributes");

console.log("architecture, clean UI, and AX checks passed");
