const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert(app.includes("const QUIZ_FAST = 5000"), "quiz fast threshold should be 5 seconds");
assert(app.includes("const QUIZ_SLOW = 12000"), "quiz slow threshold should be 12 seconds");
assert(app.includes("5 秒内算快题，超过 12 秒记慢题"), "quiz timer copy should explain the new thresholds");
assert(app.includes("getQuizProgressValue"), "quiz progress should use a current-question helper");
assert(app.includes("quiz.currentIndex"), "quiz progress should track current question number");
assert(!app.includes("els.quizProgressText.textContent = `题号 ${quiz.done}/${quiz.total}`"), "quiz progress should not stay on completed count only");
assert(styles.includes("#quizProgressBar"), "quiz progress bar should have its own visible fill style");
assert(styles.includes("quiz-progress-pulse"), "quiz progress should support a short color feedback pulse");
assert(app.includes("quiz-progress-pulse"), "answering a quiz question should trigger visible progress feedback");

assert(!app.includes('if (stage === "初二") return 5650;'), "初二 should no longer have a hardcoded count");
assert(!app.includes('if (stage === "初三") return 18870;'), "初三 should no longer have a hardcoded count");
assert(!app.includes("return 10000"), "高一/高二 should no longer use the 10000 display easter egg");
assert(app.includes("const realTotal = eligible.length"), "real eligible word count should remain available for training logic");
assert(app.includes("els.totalWords.textContent = realTotal"), "stats should display the real eligible word count");
assert(index.includes("<span>当前词汇</span>"), "the existing stats card label should remain unchanged");

console.log("senior quiz UI rule checks passed");
