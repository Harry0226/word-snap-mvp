const assert = require("assert");
const {
  getCheckinThreshold,
  makeProgressKey,
  advanceDailyProgress
} = require("../daily-streaks.js");

assert.strictEqual(getCheckinThreshold("train", "小学六年级"), 200);
assert.strictEqual(getCheckinThreshold("train", "初三"), 200);
assert.strictEqual(getCheckinThreshold("train", "高二"), 300);
assert.strictEqual(getCheckinThreshold("quiz", "初一"), 100);
assert.strictEqual(getCheckinThreshold("quiz", "高一"), null);
assert.strictEqual(getCheckinThreshold("train", "中考常考词组总复习"), null);
assert.strictEqual(getCheckinThreshold("train", "高考冲刺"), null);

assert.strictEqual(makeProgressKey("train", "初一"), "train:初一");
assert.strictEqual(makeProgressKey("quiz", "初一"), "quiz:初一");

let juniorTrain = advanceDailyProgress(null, 199, 200, "2026-06-08", "2026-06-07");
assert.strictEqual(juniorTrain.todayCount, 199);
assert.strictEqual(juniorTrain.lastCheckIn, "");
juniorTrain = advanceDailyProgress(juniorTrain, 1, 200, "2026-06-08", "2026-06-07");
assert.strictEqual(juniorTrain.lastCheckIn, "2026-06-08");
assert.strictEqual(juniorTrain.currentStreak, 1);
assert.strictEqual(juniorTrain.justCheckedIn, true);

let seniorTrain = advanceDailyProgress(null, 299, 300, "2026-06-08", "2026-06-07");
assert.strictEqual(seniorTrain.lastCheckIn, "");
seniorTrain = advanceDailyProgress(seniorTrain, 1, 300, "2026-06-08", "2026-06-07");
assert.strictEqual(seniorTrain.lastCheckIn, "2026-06-08");

let juniorQuiz = advanceDailyProgress(null, 99, 100, "2026-06-08", "2026-06-07");
assert.strictEqual(juniorQuiz.lastCheckIn, "");
juniorQuiz = advanceDailyProgress(juniorQuiz, 1, 100, "2026-06-08", "2026-06-07");
assert.strictEqual(juniorQuiz.lastCheckIn, "2026-06-08");

const nextDay = advanceDailyProgress(juniorTrain, 1, 200, "2026-06-09", "2026-06-08");
assert.strictEqual(nextDay.todayCount, 1, "daily count should reset on a new local date");
assert.strictEqual(nextDay.currentStreak, 1, "streak should only advance after the next threshold is reached");

const secondCheckIn = advanceDailyProgress(nextDay, 199, 200, "2026-06-09", "2026-06-08");
assert.strictEqual(secondCheckIn.currentStreak, 2);
assert.strictEqual(secondCheckIn.lastCheckIn, "2026-06-09");

console.log("daily streak checks passed");
