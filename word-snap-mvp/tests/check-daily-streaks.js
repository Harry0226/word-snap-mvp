const assert = require("assert");
const {
  getCheckinThreshold,
  makeProgressKey,
  advanceDailyProgress,
  reconcileTrainingStreak
} = require("../daily-streaks.js");

assert.strictEqual(getCheckinThreshold("train", "小学六年级"), 100);
assert.strictEqual(getCheckinThreshold("train", "初三"), 100);
assert.strictEqual(getCheckinThreshold("train", "初中688高频词"), 100);
assert.strictEqual(getCheckinThreshold("train", "初中1600"), 100);
assert.strictEqual(getCheckinThreshold("train", "高二"), 100);
assert.strictEqual(getCheckinThreshold("train", "高中3500刷词专栏"), 100);
assert.strictEqual(getCheckinThreshold("quiz", "初一"), 100);
assert.strictEqual(getCheckinThreshold("quiz", "高一"), null);
assert.strictEqual(getCheckinThreshold("train", "中考常考词组总复习"), null);
assert.strictEqual(getCheckinThreshold("train", "高考冲刺"), null);

assert.strictEqual(makeProgressKey("train", "初一"), "train:初一");
assert.strictEqual(makeProgressKey("quiz", "初一"), "quiz:初一");

let juniorTrain = advanceDailyProgress(null, 99, 100, "2026-06-08", "2026-06-07");
assert.strictEqual(juniorTrain.todayCount, 99);
assert.strictEqual(juniorTrain.lastCheckIn, "");
juniorTrain = advanceDailyProgress(juniorTrain, 1, 100, "2026-06-08", "2026-06-07");
assert.strictEqual(juniorTrain.lastCheckIn, "2026-06-08");
assert.strictEqual(juniorTrain.currentStreak, 1);
assert.strictEqual(juniorTrain.justCheckedIn, true);

let seniorTrain = advanceDailyProgress(null, 99, 100, "2026-06-08", "2026-06-07");
assert.strictEqual(seniorTrain.lastCheckIn, "");
seniorTrain = advanceDailyProgress(seniorTrain, 1, 100, "2026-06-08", "2026-06-07");
assert.strictEqual(seniorTrain.lastCheckIn, "2026-06-08");

let juniorQuiz = advanceDailyProgress(null, 99, 100, "2026-06-08", "2026-06-07");
assert.strictEqual(juniorQuiz.lastCheckIn, "");
juniorQuiz = advanceDailyProgress(juniorQuiz, 1, 100, "2026-06-08", "2026-06-07");
assert.strictEqual(juniorQuiz.lastCheckIn, "2026-06-08");

const nextDay = advanceDailyProgress(juniorTrain, 1, 100, "2026-06-09", "2026-06-08");
assert.strictEqual(nextDay.todayCount, 1, "daily count should reset on a new local date");
assert.strictEqual(nextDay.currentStreak, 1, "streak should only advance after the next threshold is reached");

const secondCheckIn = advanceDailyProgress(nextDay, 99, 100, "2026-06-09", "2026-06-08");
assert.strictEqual(secondCheckIn.currentStreak, 2);
assert.strictEqual(secondCheckIn.lastCheckIn, "2026-06-09");

const duplicate = advanceDailyProgress(secondCheckIn, 25, 100, "2026-06-09", "2026-06-08");
assert.strictEqual(duplicate.todayCount, 125);
assert.strictEqual(duplicate.totalDays, 2);
assert.strictEqual(duplicate.justCheckedIn, false);
assert.deepStrictEqual(duplicate.checkInDates, ["2026-06-09", "2026-06-08"]);
const afterGap = advanceDailyProgress(secondCheckIn, 100, 100, "2026-06-11", "2026-06-10");
assert.strictEqual(afterGap.currentStreak, 1);
assert.strictEqual(afterGap.longestStreak, 2);

const today = "2026-10-22";
const yesterday = "2026-10-21";
const old = { key: "train:初中1600", progressDate: today, todayCount: 150,
  lastCheckIn: yesterday, currentStreak: 4, longestStreak: 7, totalDays: 9, checkInDates: [yesterday] };
const migrated = reconcileTrainingStreak(old, today, yesterday);
assert.strictEqual(migrated.todayCount, 150);
assert.strictEqual(migrated.currentStreak, 5);
assert.strictEqual(migrated.longestStreak, 7);
assert.strictEqual(migrated.totalDays, 10);
assert.deepStrictEqual(migrated.checkInDates, [today, yesterday]);
assert.strictEqual(reconcileTrainingStreak(migrated, today, yesterday), migrated, "migration is idempotent");
for (const unchanged of [
  { ...old, todayCount: 99 },
  { ...old, progressDate: yesterday },
  { ...old, key: "quiz:初一" },
  { ...old, key: "train:高考冲刺" }
]) assert.strictEqual(reconcileTrainingStreak(unchanged, today, yesterday), unchanged);
assert.strictEqual(old.totalDays, 9, "migration must not mutate its input");
console.log("daily streak checks passed (100-word target and existing-record migration)");
