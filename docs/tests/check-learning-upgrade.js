const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert.ok(html.includes('value="audioToZhChoice"'), "audio choice mode should be available");
assert.ok(html.includes('id="audioPromptBtn"'), "audio replay control should exist");
assert.ok(html.includes('id="contextSentence"'), "answer context sentence should exist");
assert.ok(html.includes("vendor/ts-fsrs.umd.js"), "adaptive scheduler should load before daily learning");
assert.ok(html.indexOf('id="dailyTaskPanel"') < html.indexOf('id="trainWordStats"'), "daily CTA should precede secondary stats");
assert.ok(html.includes('class="mobile-nav"'), "mobile bottom navigation should exist");

const promptPreparation = app.indexOf("async function prepareTrainingPrompt");
const painted = app.indexOf("await waitForPaint()", promptPreparation);
const timerStart = app.indexOf("session.startedAt = performance.now()", promptPreparation);
assert.ok(promptPreparation >= 0 && painted > promptPreparation && timerStart > painted, "timer must start after prompt rendering");
assert.ok(app.includes('session.mode === "audioToZhChoice"'), "audio prompt behavior should be implemented");
assert.ok(app.includes("revealContextSentence(word)"), "context sentence should reveal after answering");
const transitionDelay = app.match(/const CORRECT_ADVANCE_DELAY_MS = (\d+);/);
assert.ok(transitionDelay, "correct-answer transition delay should be explicit");
assert.ok(Number(transitionDelay[1]) <= 250, "correct-answer transition should feel immediate");
assert.ok(styles.includes(".mobile-nav"), "mobile navigation should be styled");

console.log("learning upgrade checks passed");
