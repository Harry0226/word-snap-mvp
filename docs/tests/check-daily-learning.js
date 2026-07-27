const assert = require("assert");
const {
  HOUR_MS,
  DAY_MS,
  DAILY_TASK_LIMIT,
  planDailyTask,
  creditDailyTask,
  applyLearningResult,
  getSevenDayRetentionStats,
  getTodayStageCompletion
} = require("../daily-learning.js");

const now = new Date(2026, 6, 24, 12, 0, 0).getTime();
assert.strictEqual(DAILY_TASK_LIMIT, 300, "daily task target should be 300 words");
const words = Array.from({ length: 25 }, (_, index) => ({ id: `word-${index + 1}` }));
const records = new Map([
  ["word-1", {
    wordId: "word-1",
    seen: 2,
    wrong: 1,
    nextReviewAt: now - DAY_MS,
    firstLearnedAt: now - 3 * DAY_MS
  }],
  ["word-2", {
    wordId: "word-2",
    seen: 3,
    wrong: 0,
    nextReviewAt: now + 3 * DAY_MS,
    firstLearnedAt: now - 8 * DAY_MS,
    sevenDayTestedAt: 0
  }]
]);

const plan = planDailyTask(words, records, { now, limit: 20 });
assert.strictEqual(plan.total, 20, "today task should be capped at 20 words");
assert.deepStrictEqual(plan.wordIds.slice(0, 2).sort(), ["word-1", "word-2"], "due and seven-day words should come first");
assert.strictEqual(plan.dueCount, 2);
assert.strictEqual(plan.newCount, 18);
assert.strictEqual(new Set(plan.wordIds).size, plan.wordIds.length, "today task must not contain duplicates");

const savedTask = {
  wordIds: ["due-1", "new-1", "new-2"],
  dueWordIds: ["due-1"],
  newWordIds: ["new-1", "new-2"],
  completedIds: ["due-1"],
  completedAt: 0
};
const externalCredit = creditDailyTask(savedTask, "free-training-word", {
  allowExternal: true,
  now
});
assert.strictEqual(externalCredit.changed, true);
assert.deepStrictEqual(externalCredit.task.dueWordIds, ["due-1"], "free training must not replace due reviews");
assert.deepStrictEqual(externalCredit.task.newWordIds, ["free-training-word", "new-2"]);
assert.deepStrictEqual(externalCredit.task.completedIds, ["due-1", "free-training-word"]);
assert.strictEqual(externalCredit.task.completedAt, 0);
assert.strictEqual(
  creditDailyTask(savedTask, "free-training-word").changed,
  false,
  "external words must require explicit free-training credit"
);

const firstCorrect = applyLearningResult({ seen: 0, reviewStep: -1 }, {
  isCorrect: true,
  mode: "enToZhChoice"
}, now);
assert.strictEqual(firstCorrect.firstLearnedAt, now);
assert.strictEqual(firstCorrect.reviewStep, 0);
assert.strictEqual(firstCorrect.nextReviewAt, now + DAY_MS);
assert.ok(firstCorrect.fsrsCard, "adaptive scheduler card should be persisted");

const secondCorrectAt = now + DAY_MS;
const secondCorrect = applyLearningResult({
  ...firstCorrect,
  seen: 1,
  correct: 1,
  wrong: 0,
  slow: 0,
  lastSeenAt: now,
  firstLearnedAt: now,
  reviewStep: 0
}, { isCorrect: true }, secondCorrectAt);
assert.strictEqual(secondCorrect.reviewStep, 1);
assert.ok(secondCorrect.nextReviewAt > secondCorrectAt + 3 * DAY_MS, "successful recall should expand the interval");

const secondFast = applyLearningResult({
  ...firstCorrect,
  seen: 1,
  correct: 1,
  lastSeenAt: now
}, { isCorrect: true, isFast: true }, secondCorrectAt);
const secondSlow = applyLearningResult({
  ...firstCorrect,
  seen: 1,
  correct: 1,
  lastSeenAt: now
}, { isCorrect: true, isSlow: true }, secondCorrectAt);
assert.ok(secondFast.nextReviewAt > secondCorrect.nextReviewAt, "fast recall should schedule later than normal recall");
assert.ok(secondSlow.nextReviewAt < secondCorrect.nextReviewAt, "slow recall should schedule sooner than normal recall");

const wrong = applyLearningResult({
  ...secondCorrect,
  seen: 2,
  firstLearnedAt: now,
  reviewStep: 1
}, { isCorrect: false }, secondCorrectAt);
assert.strictEqual(wrong.nextReviewAt, secondCorrectAt + 4 * HOUR_MS);

const sevenDayAt = now + 7 * DAY_MS;
const sevenDayResult = applyLearningResult({
  ...secondCorrect,
  seen: 4,
  firstLearnedAt: now,
  reviewStep: 2,
  sevenDayTestedAt: 0
}, { isCorrect: true, mode: "zhToEnChoice" }, sevenDayAt);
assert.strictEqual(sevenDayResult.sevenDayTestedAt, sevenDayAt);
assert.strictEqual(sevenDayResult.sevenDayCorrect, true);
assert.strictEqual(sevenDayResult.sevenDayTestMode, "zhToEnChoice");

const laterResult = applyLearningResult({
  seen: 5,
  firstLearnedAt: now,
  reviewStep: sevenDayResult.reviewStep,
  sevenDayTestedAt: sevenDayResult.sevenDayTestedAt,
  sevenDayCorrect: true,
  sevenDayTestMode: "zhToEnChoice"
}, { isCorrect: false, mode: "enToZhChoice" }, sevenDayAt + DAY_MS);
assert.strictEqual(laterResult.sevenDayTestedAt, sevenDayAt, "seven-day result must be immutable after first test");
assert.strictEqual(laterResult.sevenDayCorrect, true);

const retention = getSevenDayRetentionStats(
  [{ id: "kept" }, { id: "lost" }, { id: "pending" }],
  new Map([
    ["kept", { sevenDayTestedAt: sevenDayAt, sevenDayCorrect: true }],
    ["lost", { sevenDayTestedAt: sevenDayAt, sevenDayCorrect: false }],
    ["pending", { firstLearnedAt: now, sevenDayTestedAt: 0 }]
  ]),
  sevenDayAt
);
assert.deepStrictEqual(retention, {
  tested: 2,
  retained: 1,
  pending: 1,
  rate: 50
});

const dayStart = new Date(now);
dayStart.setHours(0, 0, 0, 0);
const completionWords = [
  { id: "stage-1" },
  { id: "stage-2" },
  { id: "stage-3" },
  { id: "stage-3" }
];
const partialCompletion = getTodayStageCompletion(completionWords, new Map([
  ["stage-1", { lastSeenAt: now - HOUR_MS }],
  ["stage-2", { lastSeenAt: dayStart.getTime() - 1 }],
  ["stage-3", { lastSeenAt: now }]
]), now);
assert.deepStrictEqual(partialCompletion, {
  total: 3,
  completed: 2,
  remaining: 1,
  isComplete: false
});
const fullCompletion = getTodayStageCompletion(completionWords, new Map([
  ["stage-1", { lastSeenAt: now }],
  ["stage-2", { lastSeenAt: now }],
  ["stage-3", { lastSeenAt: now }]
]), now);
assert.strictEqual(fullCompletion.isComplete, true, "all distinct stage words seen today should unlock the easter egg");

console.log("daily learning unit checks passed");
