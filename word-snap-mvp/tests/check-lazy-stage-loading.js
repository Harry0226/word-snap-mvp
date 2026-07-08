const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(index.includes("builtin-manifest.js"), "index should load the small built-in manifest");
assert(index.includes("asset-loader.js"), "index should load the resilient asset loader");
assert(!index.includes("word-data/builtin-word-lists.js"), "index must not block on the complete built-in word list");
assert(!index.includes("word-data/junior-exam-words.js"), "index must not block on the junior exam list");
assert(!index.includes("word-data/phrase-review-words.js"), "index must not block on the phrase list");

assert(app.includes("ensureStageLoaded"), "app should load vocabulary by selected stage");
assert(app.includes("await ensureStageLoaded(els.stageSelect.value)"), "startup should load only the selected stage");
assert(app.includes("await ensureStageLoaded(stage)"), "stage-dependent actions should wait for stage data");
assert(app.includes("isStageSeeded"), "repeat visits should use IndexedDB without downloading the stage again");
const generateWordQuiz = app.slice(app.indexOf("function generateWordQuiz"), app.indexOf("async function updateQuizSizeOptions"));
assert(generateWordQuiz.includes("state.words.filter"), "word-generated quizzes should use loaded stage words");
const init = app.slice(app.indexOf("async function init()"), app.indexOf("\ninit();"));
assert(!init.includes("updateQuizSizeOptions"), "startup must not download a quiz bank before the quiz view is opened");

assert(headers.includes("max-age=31536000, immutable"), "static versioned assets should use long-lived caching");

console.log("lazy stage loading checks passed");
