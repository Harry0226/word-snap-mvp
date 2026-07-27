(function initDailyLearning(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapDailyLearning = api;
})(typeof window !== "undefined" ? window : globalThis, function createDailyLearning() {
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;
  const DAILY_TASK_LIMIT = 300;
  const DUE_REVIEW_LIMIT = 100;
  const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30];

  function recordFor(records, wordId) {
    if (records instanceof Map) return records.get(wordId) || null;
    return records?.[wordId] || null;
  }

  function isDueRecord(record, now = Date.now()) {
    return Boolean(record?.seen > 0 && Number(record.nextReviewAt || 0) > 0 && Number(record.nextReviewAt) <= now);
  }

  function isSevenDayEligible(record, now = Date.now()) {
    return Boolean(
      Number(record?.firstLearnedAt || 0) > 0
      && now >= Number(record.firstLearnedAt) + 7 * DAY_MS
      && !Number(record.sevenDayTestedAt || 0)
    );
  }

  function dateKey(now = Date.now()) {
    const date = new Date(now);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function stableHash(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function uniqueWords(words) {
    const seen = new Set();
    return (Array.isArray(words) ? words : []).filter((word) => {
      if (!word?.id || seen.has(word.id)) return false;
      seen.add(word.id);
      return true;
    });
  }

  function duePriority(word, records, now, seed) {
    const record = recordFor(records, word.id) || {};
    const sevenDayBoost = isSevenDayEligible(record, now) ? 1_000_000_000 : 0;
    const overdue = Math.max(0, now - Number(record.nextReviewAt || now));
    const weakBoost = (Number(record.wrong || 0) * 10 + Number(record.slow || 0) * 5) * HOUR_MS;
    return sevenDayBoost + overdue + weakBoost + stableHash(`${seed}:${word.id}`) % HOUR_MS;
  }

  function sortedDueWords(words, records, now) {
    const seed = dateKey(now);
    return uniqueWords(words)
      .filter((word) => {
        const record = recordFor(records, word.id);
        return isDueRecord(record, now) || isSevenDayEligible(record, now);
      })
      .sort((left, right) => duePriority(right, records, now, seed) - duePriority(left, records, now, seed));
  }

  function sortedNewWords(words, records, now) {
    const seed = dateKey(now);
    return uniqueWords(words)
      .filter((word) => Number(recordFor(records, word.id)?.seen || 0) === 0)
      .sort((left, right) => stableHash(`${seed}:${left.id}`) - stableHash(`${seed}:${right.id}`));
  }

  function planDailyTask(words, records, options = {}) {
    const now = Number(options.now || Date.now());
    const limit = Math.max(1, Number(options.limit || DAILY_TASK_LIMIT));
    const dueWords = sortedDueWords(words, records, now);
    const selectedDue = dueWords.slice(0, limit);
    const newWords = sortedNewWords(words, records, now);
    const selectedNew = newWords.slice(0, Math.max(0, limit - selectedDue.length));
    return {
      wordIds: [...selectedDue, ...selectedNew].map((word) => word.id),
      dueWordIds: selectedDue.map((word) => word.id),
      newWordIds: selectedNew.map((word) => word.id),
      dueCount: selectedDue.length,
      newCount: selectedNew.length,
      total: selectedDue.length + selectedNew.length,
      dueAvailable: dueWords.length,
      newAvailable: newWords.length
    };
  }

  function getDueReviewWordIds(words, records, options = {}) {
    const now = Number(options.now || Date.now());
    const limit = Math.max(1, Number(options.limit || DUE_REVIEW_LIMIT));
    return sortedDueWords(words, records, now).slice(0, limit).map((word) => word.id);
  }

  function creditDailyTask(savedTask, wordId, options = {}) {
    if (!savedTask || !wordId) return { task: savedTask || null, changed: false };
    let wordIds = [...(savedTask.wordIds || [])];
    let newWordIds = [...(savedTask.newWordIds || [])];
    const completedSet = new Set(savedTask.completedIds || []);
    if (completedSet.has(wordId)) return { task: savedTask, changed: false };

    if (!wordIds.includes(wordId)) {
      if (!options.allowExternal) return { task: savedTask, changed: false };
      const replaceIndex = newWordIds.findIndex((id) => !completedSet.has(id));
      if (replaceIndex < 0) return { task: savedTask, changed: false };
      const replacedId = newWordIds[replaceIndex];
      newWordIds[replaceIndex] = wordId;
      wordIds = wordIds.map((id) => id === replacedId ? wordId : id);
    }

    completedSet.add(wordId);
    const completedIds = [...completedSet];
    const now = Number(options.now || Date.now());
    return {
      changed: true,
      task: {
        ...savedTask,
        wordIds,
        newWordIds,
        completedIds,
        completedAt: completedIds.length >= wordIds.length ? now : 0
      }
    };
  }

  function applyLearningResult(savedRecord, result = {}, now = Date.now()) {
    const previous = savedRecord || {};
    const seenBefore = Number(previous.seen || 0);
    const firstLearnedAt = Number(previous.firstLearnedAt || 0) || now;
    const sevenDayDue = now >= firstLearnedAt + 7 * DAY_MS && !Number(previous.sevenDayTestedAt || 0);
    const correct = Boolean(result.isCorrect);
    const priorStep = Number.isFinite(Number(previous.reviewStep))
      ? Math.max(-1, Number(previous.reviewStep))
      : (seenBefore > 0 ? 0 : -1);
    const reviewStep = correct
      ? Math.min(REVIEW_INTERVAL_DAYS.length - 1, priorStep + 1)
      : Math.max(0, priorStep - 1);
    const nextReviewAt = correct
      ? now + REVIEW_INTERVAL_DAYS[reviewStep] * DAY_MS
      : now + 4 * HOUR_MS;

    return {
      firstLearnedAt,
      reviewStep,
      nextReviewAt,
      sevenDayTestedAt: sevenDayDue ? now : Number(previous.sevenDayTestedAt || 0),
      sevenDayCorrect: sevenDayDue ? correct : Boolean(previous.sevenDayCorrect),
      sevenDayTestMode: sevenDayDue ? String(result.mode || "") : String(previous.sevenDayTestMode || "")
    };
  }

  function getSevenDayRetentionStats(words, records, now = Date.now()) {
    let tested = 0;
    let retained = 0;
    let pending = 0;
    uniqueWords(words).forEach((word) => {
      const record = recordFor(records, word.id);
      if (!record) return;
      if (Number(record.sevenDayTestedAt || 0) > 0) {
        tested += 1;
        if (record.sevenDayCorrect) retained += 1;
      } else if (isSevenDayEligible(record, now)) {
        pending += 1;
      }
    });
    return {
      tested,
      retained,
      pending,
      rate: tested > 0 ? Math.round((retained / tested) * 100) : null
    };
  }

  function getTodayStageCompletion(words, records, now = Date.now()) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const totalWords = uniqueWords(words);
    const completed = totalWords.reduce((count, word) => {
      const record = recordFor(records, word.id);
      return count + (Number(record?.lastSeenAt || 0) >= dayStart.getTime() ? 1 : 0);
    }, 0);
    return {
      total: totalWords.length,
      completed,
      remaining: Math.max(0, totalWords.length - completed),
      isComplete: totalWords.length > 0 && completed === totalWords.length
    };
  }

  return {
    HOUR_MS,
    DAY_MS,
    DAILY_TASK_LIMIT,
    DUE_REVIEW_LIMIT,
    REVIEW_INTERVAL_DAYS,
    dateKey,
    isDueRecord,
    isSevenDayEligible,
    planDailyTask,
    getDueReviewWordIds,
    creditDailyTask,
    applyLearningResult,
    getSevenDayRetentionStats,
    getTodayStageCompletion
  };
});
