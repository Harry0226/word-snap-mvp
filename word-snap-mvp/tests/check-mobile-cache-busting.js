const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const headers = fs.readFileSync("_headers", "utf8");

assert(index.includes('href="./styles.css?v='), "stylesheet should use a versioned URL for mobile cache refresh");
assert(index.includes('src="./word-data/junior-exam-words.js?v='), "junior word data should use a versioned URL");
assert(index.includes('src="./word-data/phrase-review-words.js?v='), "phrase review word data should use a versioned URL");
assert(!index.includes('src="./word-data/quiz-grade8-sentences.js?v='), "quiz data should not block first paint on mobile");
assert(index.includes('src="./word-data/builtin-word-lists.js?v='), "builtin word data should use a versioned URL");
assert(index.includes('src="./app.js?v='), "app script should use a versioned URL");
assert(index.includes("defer"), "scripts should be deferred so mobile browsers can paint the shell sooner");

const app = fs.readFileSync("app.js", "utf8");
assert(app.includes("QUIZ_BANK_SCRIPTS"), "quiz banks should be loaded lazily with versioned URLs");
assert(app.includes("./word-data/quiz-grade8-sentences.js?v="), "lazy grade 8 quiz data should use a versioned URL");
assert(app.includes("loadScriptOnce"), "lazy quiz loader should avoid repeated downloads");

const wordDataHeader = headers.match(/\/word-data\/\*[\s\S]*?(?=\n\/|\n$)/)?.[0] || "";
assert(wordDataHeader.includes("must-revalidate"), "word data should revalidate after deployment");
assert(!wordDataHeader.includes("immutable"), "word data must not be immutable when filenames are reused");
assert(!wordDataHeader.includes("max-age=31536000"), "word data should not be cached for one year with reused filenames");

console.log("mobile cache busting checks passed");
