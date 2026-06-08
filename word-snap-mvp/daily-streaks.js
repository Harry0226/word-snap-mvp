(function initDailyStreaks(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapDailyStreaks = api;
})(typeof window !== "undefined" ? window : globalThis, function createDailyStreaks() {
  const JUNIOR_GRADES = new Set(["初一", "初二", "初三"]);
  const SENIOR_GRADES = new Set(["高一", "高二", "高三"]);

  function getCheckinThreshold(kind, grade) {
    if (kind === "quiz") return JUNIOR_GRADES.has(grade) ? 100 : null;
    if (kind !== "train") return null;
    if (grade === "小学六年级" || JUNIOR_GRADES.has(grade)) return 200;
    if (SENIOR_GRADES.has(grade)) return 300;
    return null;
  }

  function makeProgressKey(kind, grade) {
    return `${kind}:${grade}`;
  }

  function advanceDailyProgress(saved, amount, threshold, today, yesterday) {
    const previous = saved || {};
    const sameDay = previous.progressDate === today;
    const todayCount = (sameDay ? Number(previous.todayCount || 0) : 0) + Number(amount || 0);
    const alreadyChecked = previous.lastCheckIn === today;
    const reachedThreshold = Number.isFinite(threshold) && threshold > 0 && todayCount >= threshold;
    const justCheckedIn = !alreadyChecked && reachedThreshold;
    const consecutive = previous.lastCheckIn === yesterday;
    const currentStreak = justCheckedIn
      ? (consecutive ? Number(previous.currentStreak || 0) + 1 : 1)
      : Number(previous.currentStreak || 0);
    const checkInDates = [...(previous.checkInDates || [])];
    if (justCheckedIn) checkInDates.unshift(today);

    return {
      ...previous,
      todayCount,
      progressDate: today,
      currentStreak,
      longestStreak: Math.max(Number(previous.longestStreak || 0), currentStreak),
      lastCheckIn: justCheckedIn ? today : (previous.lastCheckIn || ""),
      totalDays: Number(previous.totalDays || 0) + (justCheckedIn ? 1 : 0),
      checkInDates: checkInDates.slice(0, 365),
      justCheckedIn
    };
  }

  return { getCheckinThreshold, makeProgressKey, advanceDailyProgress };
});
