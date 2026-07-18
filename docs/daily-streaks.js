(function initDailyStreaks(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapDailyStreaks = api;
})(typeof window !== "undefined" ? window : globalThis, function createDailyStreaks() {
  const JUNIOR_KEYWORDS = ["初一", "初二", "初三", "初中"];
  const SENIOR_KEYWORDS = ["高一", "高二", "高三"];

  function matchesAny(grade, keywords) {
    return keywords.some((k) => grade.includes(k));
  }

  function getCheckinThreshold(kind, grade) {
    if (kind === "quiz") return matchesAny(grade, JUNIOR_KEYWORDS) ? 100 : null;
    if (kind !== "train") return null;
    if (grade === "小学六年级" || matchesAny(grade, JUNIOR_KEYWORDS)) return 200;
    if (matchesAny(grade, SENIOR_KEYWORDS)) return 300;
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
