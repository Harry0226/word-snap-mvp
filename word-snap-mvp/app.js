const STAGES = ["初一课本单元词汇", "初二课本单元词汇", "初三课本单元词汇", "初中688高频词", "初中1600", "高一课本单元词汇", "高一课改词库", "高二课本单元词汇", "高中3500刷词专栏"];
const RENAMED_STAGE_LEGACY_NAMES = new Set(["初一暑期必背词汇", "初二暑期必背词汇", "初三暑期必背词汇", "高一暑期必背词汇", "高二暑期必背词汇"]);
const BUILTIN_SEED_VERSION = 21;
const FAST_PICK_LIMIT = 2000;
const SLOW_PICK_LIMIT = 3500;
const CORRECT_ADVANCE_DELAY_MS = 180;
const CHOICE_KEYS = ["A", "B", "C", "D", "E"];
const ROTATION_META_PREFIX = "rotation:v2:";
const BACKUP_SITE_URL = "https://word-snap-mvp.pages.dev/";
const DAILY_TASK_META_PREFIX = "dailyTask:v2:";
const FULL_STAGE_CELEBRATION_META_PREFIX = "fullStageCelebration:v1:";

const storage = window.WordSnapStorage;
const { escapeHtml, escapeAttr, shuffle, uniqueById, percent, formatDuration } = window.WordSnapUtils;
const { prepareRotationBatch, completeRotationItem } = window.WordSnapRotation;
const {
  normalizeDisplayedChoiceText: normalizeChoiceDisplayText,
  normalizeEnglishWord,
  dedupeVocabularyEntries,
  isEquivalentVocabularyAnswer,
  splitChineseSenses,
  hasMeaningConflict
} = window.WordSnapChoiceUtils;
const { getCheckinThreshold, makeProgressKey, advanceDailyProgress, reconcileTrainingStreak } = window.WordSnapDailyStreaks;
const {
  DAILY_TASK_LIMIT,
  DUE_REVIEW_LIMIT,
  dateKey: getDailyDateKey,
  isSevenDayEligible,
  planDailyTask,
  resizeDailyTask,
  getDueReviewWordIds,
  creditDailyTask,
  applyLearningResult,
  getSevenDayRetentionStats,
  getTodayStageCompletion
} = window.WordSnapDailyLearning;
const { loadScriptWithRetry } = window.WordSnapAssetLoader;
const decksModule = window.WordSnapDecks;
const battleModule = window.WordSnapBattle;
const quizModule = window.WordSnapQuiz;

const state = {
  db: null,
  words: [],
  records: new Map(),
  rotationQueues: new Map(),
  session: null,
  battle: null,
  quiz: null,
  quizWrongRecords: new Map(),
  quizStats: new Map(),
  reviewRows: [],
  lastReport: null,
  weakFilter: "wrong",
  queueNotice: "",
  streaks: new Map(),
  stageLoads: new Map(),
  dailyTasks: new Map(),
  fullStageCelebrations: new Set(),
  wordbookSaved: new Map(),
  learningFlow: null,
  learningDays: new Set(),
  learningCompletions: new Map(),
  viewedCompletion: null
};

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  mobileViewButtons: [...document.querySelectorAll("[data-mobile-view]")],
  mobileMoreButton: document.querySelector("[data-mobile-more]"),
  mobileMoreMenu: document.querySelector("#mobileMoreMenu"),
  views: {
    train: document.querySelector("#view-train"),
    battle: document.querySelector("#view-battle"),
    decks: document.querySelector("#view-decks"),
    wrong: document.querySelector("#view-wrong"),
    report: document.querySelector("#view-report"),
    quiz: document.querySelector("#view-quiz")
  },
  // Training
  trainerPanel: document.querySelector(".trainer"),
  totalWords: document.querySelector("#totalWords"),
  doneCount: document.querySelector("#doneCount"),
  accuracy: document.querySelector("#accuracy"),
  fastRate: document.querySelector("#fastRate"),
  weakCount: document.querySelector("#weakCount"),
  dailyTaskPanel: document.querySelector("#dailyTaskPanel"),
  dailyTaskSummary: document.querySelector("#dailyTaskSummary"),
  dailyDueCount: document.querySelector("#dailyDueCount"),
  dailyNewCount: document.querySelector("#dailyNewCount"),
  sevenDayRetention: document.querySelector("#sevenDayRetention"),
  sevenDayPending: document.querySelector("#sevenDayPending"),
  startDailyTaskBtn: document.querySelector("#startDailyTaskBtn"),
  startDueReviewBtn: document.querySelector("#startDueReviewBtn"),
  stageSelect: document.querySelector("#stageSelect"),
  sessionSize: document.querySelector("#sessionSize"),
  trainingScope: document.querySelector("#trainingScope"),
  practiceMode: document.querySelector("#practiceMode"),
  deckFilter: document.querySelector("#deckFilter"),
  startBtn: document.querySelector("#startBtn"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  tag: document.querySelector("#tag"),
  word: document.querySelector("#word"),
  audioPromptBtn: document.querySelector("#audioPromptBtn"),
  pronunciationAudio: document.querySelector("#pronunciationAudio"),
  hint: document.querySelector("#hint"),
  contextSentence: document.querySelector("#contextSentence"),
  timer: document.querySelector("#timer"),
  choices: document.querySelector("#choices"),
  feedback: document.querySelector("#feedback"),
  wordbookExplanation: document.querySelector("#wordbookExplanation"),
  resumeFlowBtn: document.querySelector("#resumeFlowBtn"),
  todayRecordBar: document.querySelector("#todayRecordBar"),
  todayRecordBtn: document.querySelector("#todayRecordBtn"),
  todayRecordStatus: document.querySelector("#todayRecordStatus"),
  trainContinueBtn: document.querySelector("#trainContinueBtn"),
  skipBtn: document.querySelector("#skipBtn"),
  sessionReport: document.querySelector("#sessionReport"),
  // Decks
  uploadStage: document.querySelector("#uploadStage"),
  sourceName: document.querySelector("#sourceName"),
  importStatus: document.querySelector("#importStatus"),
  textImport: document.querySelector("#textImport"),
  parseTextBtn: document.querySelector("#parseTextBtn"),
  reviewPanel: document.querySelector("#reviewPanel"),
  reviewBody: document.querySelector("#reviewBody"),
  addRowBtn: document.querySelector("#addRowBtn"),
  saveDeckBtn: document.querySelector("#saveDeckBtn"),
  deckList: document.querySelector("#deckList"),
  clearCustomDecksBtn: document.querySelector("#clearCustomDecksBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importJson: document.querySelector("#importJson"),
  wordbookSearch: document.querySelector("#wordbookSearch"),
  wordbookResults: document.querySelector("#wordbookResults"),
  // Wrong words
  weakList: document.querySelector("#weakList"),
  weakFilterBtns: [...document.querySelectorAll("[data-weak-filter]")],
  trainWeakBtn: document.querySelector("#trainWeakBtn"),
  resetRecordsBtn: document.querySelector("#resetRecordsBtn"),
  // Report
  reportContent: document.querySelector("#reportContent"),
  // Battle
  battleStage: document.querySelector("#battleStage"),
  battleSize: document.querySelector("#battleSize"),
  battleMode: document.querySelector("#battleMode"),
  startBattleBtn: document.querySelector("#startBattleBtn"),
  resetBattleBtn: document.querySelector("#resetBattleBtn"),
  skipBattleBtn: document.querySelector("#skipBattleBtn"),
  battleProgress: document.querySelector("#battleProgress"),
  battlePrompt: document.querySelector("#battlePrompt"),
  battleHint: document.querySelector("#battleHint"),
  battleStatus: document.querySelector("#battleStatus"),
  leftBattleScore: document.querySelector("#leftBattleScore"),
  rightBattleScore: document.querySelector("#rightBattleScore"),
  leftBattleChoices: document.querySelector("#leftBattleChoices"),
  rightBattleChoices: document.querySelector("#rightBattleChoices"),
  // Quiz
  quizStage: document.querySelector("#quizStage"),
  quizSize: document.querySelector("#quizSize"),
  startQuizBtn: document.querySelector("#startQuizBtn"),
  reviewQuizWrongBtn: document.querySelector("#reviewQuizWrongBtn"),
  clearQuizWrongBtn: document.querySelector("#clearQuizWrongBtn"),
  quizStatusText: document.querySelector("#quizStatusText"),
  quizArea: document.querySelector("#quizArea"),
  quizProgressText: document.querySelector("#quizProgressText"),
  quizProgressBar: document.querySelector("#quizProgressBar"),
  quizBankTotal: document.querySelector("#quizBankTotal"),
  quizDoneCount: document.querySelector("#quizDoneCount"),
  quizAccuracy: document.querySelector("#quizAccuracy"),
  quizFastRate: document.querySelector("#quizFastRate"),
  quizWrongCount: document.querySelector("#quizWrongCount"),
  // Streaks
  trainStreakCard: document.querySelector("#trainStreakCard"),
  trainTodayProgress: document.querySelector("#trainTodayProgress"),
  quizStreakCard: document.querySelector("#quizStreakCard"),
  quizTodayProgress: document.querySelector("#quizTodayProgress"),
  // Quiz game
  quizTag: document.querySelector("#quizTag"),
  quizSentence: document.querySelector("#quizSentence"),
  quizHint: document.querySelector("#quizHint"),
  quizTimer: document.querySelector("#quizTimer"),
  quizChoices: document.querySelector("#quizChoices"),
  quizFeedback: document.querySelector("#quizFeedback"),
  quizContinueBtn: document.querySelector("#quizContinueBtn"),
  quizReport: document.querySelector("#quizReport"),
  quizWrongList: document.querySelector("#quizWrongList")
};

const pronunciationPlayer = new window.WordSnapPronunciationAudio.PronunciationAudioPlayer(
  els.pronunciationAudio
);

// Thin storage wrappers preserving clean signatures for sibling modules and tests.
function tx(storeName, mode = "readonly") { return storage.storeTx(state.db, storeName, mode); }
function getAll(storeName) { return storage.getAll(state.db, storeName); }
function getWordsByStage(stage) { return storage.getWordsByStage(state.db, stage); }
function put(storeName, value) { return storage.put(state.db, storeName, value); }
function putBatch(storeName, values) { return storage.putBatch(state.db, storeName, values); }
function remove(storeName, key) { return storage.remove(state.db, storeName, key); }
function clearStore(storeName) { return storage.clearStore(state.db, storeName); }

function setTrainingSessionState(sessionState) {
  if (els.views.train) els.views.train.dataset.sessionState = sessionState;
  if (els.trainerPanel) els.trainerPanel.dataset.sessionState = sessionState;
}

function setTrainingFeedback(text) {
  if (!els.feedback) return;
  els.feedback.textContent = text;
  els.feedback.hidden = !text;
}

function setTrainingHint(text) {
  if (!els.hint) return;
  els.hint.textContent = text;
  els.hint.hidden = !text;
}

function setTrainingTag(text) {
  if (!els.tag) return;
  els.tag.textContent = text;
  els.tag.hidden = !text;
}

function slugWord(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "word";
}

function normalizeBuiltinWord(word, index, list) {
  const grade = list.grade || "初三课本单元词汇";
  const source = list.source || "初三课本单元词汇";
  const idGrade = list.idGrade || grade;
  const stageKey = encodeURIComponent(idGrade).replace(/%/g, "").toLowerCase();
  const id = list.legacyIds
    ? `builtin-${word.en.toLowerCase()}`
    : `builtin-${stageKey}-${String(index + 1).padStart(4, "0")}-${slugWord(word.en)}`;
  return {
    id,
    en: word.en.trim(),
    zh: word.zh.trim(),
    pos: word.pos || "",
    notes: word.notes || "",
    grade,
    goals: list.goals || [grade],
    source,
    sourceType: "builtin",
    frequency: Number(word.frequency || 0),
    createdAt: 0,
    order: index + 1,
    fixedMode: word.fixedMode || "",
    choiceCount: Number(word.choiceCount || 0),
    promptText: word.promptText || "",
    promptLabel: word.promptLabel || "",
    answerText: word.answerText || "",
    answerFeedback: word.answerFeedback || "",
    contextSentence: word.contextSentence || "",
    choiceOptions: Array.isArray(word.choiceOptions) ? word.choiceOptions : null
  };
}

function stageLoadMessage(stage, failed = false) {
  if (failed) return `${stage} 加载失败，点击重试或访问备用入口：${BACKUP_SITE_URL}`;
  return `正在加载 ${stage}...`;
}

function versionedAssetSrc(src, version) {
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}v=${encodeURIComponent(version)}`;
}

async function seedStageWords(stage, list, version) {
  const metaKey = `builtinStageVersion:${stage}`;
  const seedMeta = await storage.getMeta(state.db, metaKey);
  const existing = await getWordsByStage(stage);
  const hasBuiltinWords = existing.some((word) => word.sourceType === "builtin");
  if (seedMeta?.value === version && hasBuiltinWords) return;
  // 先按原始位置生成 ID，再去重，避免清理重复数据时让已有学习记录串到别的单词。
  const words = dedupeVocabularyEntries((list.words || [])
    .map((word, index) => normalizeBuiltinWord(word, index, list))
    .filter((word) => word.en && word.zh));
  await storage.replaceBuiltinStageWords(state.db, stage, words);
  await put("meta", { key: metaKey, value: version, at: Date.now() });
}

async function isStageSeeded(stage, version) {
  const metaKey = `builtinStageVersion:${stage}`;
  const seedMeta = await storage.getMeta(state.db, metaKey);
  if (seedMeta?.value !== version) return false;
  return (await getWordsByStage(stage)).some((word) => word.sourceType === "builtin");
}

async function ensureStageLoaded(stage) {
  if (state.stageLoads.has(stage)) return state.stageLoads.get(stage);
  const entry = window.WORD_SNAP_BUILTIN_MANIFEST?.stages?.[stage];
  if (!entry) return false;
  const promise = (async () => {
    if (await isStageSeeded(stage, entry.version)) return true;
    setTrainingFeedback(stageLoadMessage(stage));
    try {
      await loadScriptWithRetry(versionedAssetSrc(entry.src, entry.version));
      const list = window.WORD_SNAP_STAGE_LISTS?.[stage];
      if (!list?.words?.length) throw new Error(`${stage}词库数据为空`);
      await seedStageWords(stage, list, entry.version);
      if (!state.session && els.feedback.textContent === stageLoadMessage(stage)) {
        setTrainingFeedback("");
      }
      return true;
    } catch (error) {
      setTrainingFeedback(stageLoadMessage(stage, true));
      throw error;
    }
  })();
  state.stageLoads.set(stage, promise);
  try {
    return await promise;
  } catch (error) {
    state.stageLoads.delete(stage);
    throw error;
  }
}

async function seedBuiltinWords() {
  const allWords = await getAll("words");
  const canonicalStages = new Set(STAGES);
  const legacyBuiltinWords = allWords.filter((word) => word.sourceType === "builtin" && !canonicalStages.has(word.grade));
  if (legacyBuiltinWords.length) {
    const staleLegacyIds = new Set(legacyBuiltinWords
      .filter((word) => !RENAMED_STAGE_LEGACY_NAMES.has(word.grade))
      .map((word) => word.id));
    await storage.deleteWordsByIds(state.db, legacyBuiltinWords.map((word) => word.id));
    // Renamed curriculum stages deliberately reuse their old IDs, preserving progress
    // for the in-class words that remain. Removed stages such as grade 12 are cleared.
    await storage.deleteRecordsByWordIds(state.db, staleLegacyIds);
  }
  await put("meta", { key: "builtinSeedVersion", value: BUILTIN_SEED_VERSION, at: Date.now() });
  await put("meta", { key: "builtinSeeded", value: true, at: Date.now() });
}

// ============ 打卡系统 ============

async function loadStreaks() {
  const streaks = await getAll("streaks");
  state.streaks = new Map(streaks.map((streak) => [streak.key, streak]));
  for (const streak of streaks) {
    const updated = reconcileTrainingStreak(streak, getTodayStr(), getYesterdayStr());
    if (updated !== streak) await saveStreak(updated);
  }
}

async function saveStreak(streak) {
  await put("streaks", streak);
  state.streaks.set(streak.key, streak);
}

async function resetStreak(kind, grade) {
  const key = makeProgressKey(kind, grade);
  await new Promise((resolve, reject) => {
    const request = tx("streaks", "readwrite").delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  state.streaks.delete(key);
  renderDailyProgress();
}

function getTodayStr() {
  return getDailyDateKey();
}

function getYesterdayStr() {
  return getDailyDateKey(Date.now() - 86400000);
}

function getStreak(kind, grade) {
  return state.streaks.get(makeProgressKey(kind, grade)) || null;
}

async function recordDailyActivity(kind, grade) {
  const threshold = getCheckinThreshold(kind, grade);
  if (!threshold) return;
  const key = makeProgressKey(kind, grade);
  const next = advanceDailyProgress(getStreak(kind, grade), 1, threshold, getTodayStr(), getYesterdayStr());
  next.key = key;
  await saveStreak(next);
  if (next.justCheckedIn) showToast(`🔥 ${kind === "train" ? "刷词" : "刷题"}达标，今日火花已点亮`);
  renderDailyProgress();
}

function showToast(message, options = {}) {
  const toast = document.createElement("div");
  const variant = String(options.variant || "").trim();
  const duration = Math.max(800, Number(options.duration || 2500));
  toast.className = `toast-notification${variant ? ` ${variant}` : ""}`;
  toast.textContent = message;
  toast.setAttribute("role", variant === "achievement" ? "alert" : "status");
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function renderStreakCard(card, progressEl, kind, grade) {
  const threshold = getCheckinThreshold(kind, grade);
  card.hidden = !threshold;
  card.parentElement?.classList.toggle("without-streak", !threshold);
  if (!threshold) return;
  const streak = getStreak(kind, grade) || {};
  const todayCount = streak.progressDate === getTodayStr() ? Number(streak.todayCount || 0) : 0;
  const checked = streak.lastCheckIn === getTodayStr();
  progressEl.textContent = `今日 ${todayCount}/${threshold}`;
  card.classList.toggle("checked-in", checked);
  card.title = checked ? "今日火花已点亮" : `每日 ${threshold} ${kind === "train" ? "词" : "题"}点亮火花`;
  card.setAttribute("aria-label", `${card.title}，${progressEl.textContent}`);
}

function renderDailyProgress() {
  renderStreakCard(els.trainStreakCard, els.trainTodayProgress, "train", els.stageSelect.value);
  renderStreakCard(els.quizStreakCard, els.quizTodayProgress, "quiz", els.quizStage.value);
}

async function loadState() {
  state.words = await getAll("words");
  const records = await getAll("records");
  const meta = await getAll("meta");
  const quizWrong = await getAll("quizWrongAnswers");
  state.records = new Map(records.map((record) => [record.wordId, record]));
  state.quizWrongRecords = new Map(quizWrong.map((r) => [r.questionId, r]));
  state.quizStats = new Map(meta
    .filter((entry) => entry.key?.startsWith("quizStats:"))
    .map((entry) => [entry.key.replace("quizStats:", ""), entry.value || { attempted: 0, correct: 0, fast: 0 }]));
  state.rotationQueues = new Map(meta
    .filter((entry) => entry.key?.startsWith(ROTATION_META_PREFIX))
    .map((entry) => [entry.key, entry.value]));
  state.dailyTasks = new Map(meta
    .filter((entry) => entry.key?.startsWith(DAILY_TASK_META_PREFIX))
    .map((entry) => [entry.key, entry.value]));
  for (const [key, task] of state.dailyTasks) {
    if (!key.startsWith(`${DAILY_TASK_META_PREFIX}${getDailyDateKey()}:`)) continue;
    const resized = resizeDailyTask(task);
    if (!resized.changed) continue;
    state.dailyTasks.set(key, resized.task);
    await put("meta", { key, value: resized.task, at: Date.now() });
  }
  state.fullStageCelebrations = new Set(meta
    .filter((entry) => entry.key?.startsWith(FULL_STAGE_CELEBRATION_META_PREFIX))
    .map((entry) => entry.key));
  state.wordbookSaved = new Map(meta.filter((entry) => entry.key?.startsWith("wordbook:v1:") && entry.value)
    .map((entry) => [entry.key.slice("wordbook:v1:".length), entry.value]));
  state.learningDays = new Set(meta.filter((entry) => entry.key?.startsWith("learningDay:v1:"))
    .map((entry) => entry.key.slice("learningDay:v1:".length)));
  state.learningCompletions = new Map(meta.filter((entry) => entry.key?.startsWith("learningCompletion:v1:") && entry.value)
    .map((entry) => [entry.key.slice("learningCompletion:v1:".length), entry.value]));
  state.learningFlow = meta.find((entry) => entry.key === "learningFlow:v1")?.value || null;
  if (state.learningFlow && state.learningFlow.version !== 2 && state.learningFlow.phase !== "done") {
    const flow = state.learningFlow;
    const ids = new Set(flow.report?.wrongWordIds || []);
    flow.spelling = makeSpellingItems(state.words.filter((word) => ids.has(word.id)));
    flow.version = 2;
    flow.index = 0;
    flow.response = null;
    flow.scores = { spelling: 0 };
    flow.phase = flow.spelling.length ? "spelling" : "done";
    if (flow.phase === "done") {
      await recordLearningDay();
      await recordLearningCompletion(flow);
    }
    await saveLearningFlow();
  }
  els.resumeFlowBtn.hidden = !state.learningFlow || state.learningFlow.phase === "done";
  await loadStreaks();

  renderAll();
}

function switchView(view) {
  document.body.dataset.activeView = view;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  els.mobileViewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mobileView === view);
  });
  els.mobileMoreButton?.classList.toggle("active", ["battle", "decks", "quiz"].includes(view));
  Object.entries(els.views).forEach(([name, el]) => el.classList.toggle("active", name === view));
  if (els.mobileMoreMenu?.matches(":popover-open")) els.mobileMoreMenu.hidePopover();
  renderAll();
  if (view === "quiz") quizModule.updateQuizSizeOptions(moduleContext());
  if (view === "decks") prepareWordbookStages();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function stageMatches(word, stage) {
  return word.grade === stage || (word.goals || []).includes(stage);
}

function getEligibleWords() {
  const stage = els.stageSelect.value;
  const filter = els.deckFilter.value;
  return state.words.filter((word) => {
    const sourceOk = filter === "all" || (filter === "builtin" && word.sourceType === "builtin") || (filter === "custom" && word.sourceType === "custom");
    return sourceOk && stageMatches(word, stage);
  });
}

function getRecord(wordId) {
  return state.records.get(wordId) || {
    wordId,
    seen: 0,
    correct: 0,
    wrong: 0,
    fast: 0,
    slow: 0,
    mastery: 0,
    lastSeenAt: 0,
    nextReviewAt: 0,
    firstLearnedAt: 0,
    reviewStep: -1,
    fsrsCard: null,
    sevenDayTestedAt: 0,
    sevenDayCorrect: false,
    sevenDayTestMode: ""
  };
}

function buildDailyTaskKey(
  stage = els.stageSelect.value,
  filter = els.deckFilter.value,
  today = getDailyDateKey()
) {
  return `${DAILY_TASK_META_PREFIX}${today}:${encodeURIComponent(stage)}:${filter}`;
}

function getDailyTaskPreview() {
  return planDailyTask(getEligibleWords(), state.records, {
    limit: DAILY_TASK_LIMIT
  });
}

function getPendingDailyTaskIds(task) {
  const existingIds = new Set(state.words.map((word) => word.id));
  const completedIds = new Set(task?.completedIds || []);
  return (task?.wordIds || []).filter((id) => existingIds.has(id) && !completedIds.has(id));
}

function getBuiltinStageWords(stage = els.stageSelect.value) {
  return state.words.filter((word) => {
    return word.sourceType === "builtin" && stageMatches(word, stage) && word.en && word.zh;
  });
}

function getFullStageCompletion(stage = els.stageSelect.value) {
  return getTodayStageCompletion(getBuiltinStageWords(stage), state.records);
}

function buildFullStageCelebrationKey(stage, today = getDailyDateKey()) {
  return `${FULL_STAGE_CELEBRATION_META_PREFIX}${today}:${encodeURIComponent(stage)}`;
}

function showFullStageCelebration() {
  els.dailyTaskPanel?.classList.add("achievement-unlocked");
  setTimeout(() => els.dailyTaskPanel?.classList.remove("achievement-unlocked"), 900);
  showToast("太棒了，一天完成所有单词！", {
    variant: "achievement",
    duration: 1800
  });
}

async function maybeCelebrateFullStage(stage) {
  const completion = getFullStageCompletion(stage);
  if (!completion.isComplete) return false;
  const key = buildFullStageCelebrationKey(stage);
  if (state.fullStageCelebrations.has(key)) return false;
  state.fullStageCelebrations.add(key);
  await put("meta", {
    key,
    value: {
      stage,
      date: getDailyDateKey(),
      total: completion.total,
      completedAt: Date.now()
    },
    at: Date.now()
  });
  renderDailyTask();
  showFullStageCelebration();
  return true;
}

async function ensureDailyTask() {
  const key = buildDailyTaskKey();
  const existing = state.dailyTasks.get(key);
  if (existing) return { key, task: existing };

  const preview = getDailyTaskPreview();
  const task = {
    date: getDailyDateKey(),
    stage: els.stageSelect.value,
    filter: els.deckFilter.value,
    wordIds: preview.wordIds,
    dueWordIds: preview.dueWordIds,
    newWordIds: preview.newWordIds,
    dueCount: preview.dueCount,
    newCount: preview.newCount,
    completedIds: [],
    createdAt: Date.now(),
    completedAt: 0
  };
  state.dailyTasks.set(key, task);
  await put("meta", { key, value: task, at: Date.now() });
  return { key, task };
}

async function completeDailyTaskItem(key, wordId, options = {}) {
  if (!key) return;
  const task = state.dailyTasks.get(key);
  if (!task) return;
  const { task: updated, changed } = creditDailyTask(task, wordId, options);
  if (!changed) return;
  state.dailyTasks.set(key, updated);
  await put("meta", { key, value: updated, at: Date.now() });
}

async function syncDailyTaskFromTraining(word, isCorrect, session) {
  if (!isCorrect || !word || !session) return;
  if (session.dailyTaskKey) {
    await completeDailyTaskItem(session.dailyTaskKey, word.id);
    return;
  }
  const { key } = await ensureDailyTask();
  await completeDailyTaskItem(key, word.id, { allowExternal: true });
}

function renderDailyTask() {
  if (!els.dailyTaskPanel) return;
  const preview = getDailyTaskPreview();
  const key = buildDailyTaskKey();
  const task = state.dailyTasks.get(key);
  const pendingIds = task ? getPendingDailyTaskIds(task) : preview.wordIds;
  const pendingSet = new Set(pendingIds);
  const dueIds = task?.dueWordIds || (task?.wordIds || []).slice(0, task?.dueCount || 0);
  const newIds = task?.newWordIds || (task?.wordIds || []).slice(task?.dueCount || 0);
  const pendingDue = task ? dueIds.filter((id) => pendingSet.has(id)).length : preview.dueCount;
  const pendingNew = task ? newIds.filter((id) => pendingSet.has(id)).length : preview.newCount;
  const retention = getSevenDayRetentionStats(getEligibleWords(), state.records);
  const dueReviewIds = getDueReviewWordIds(getEligibleWords(), state.records, {
    limit: DUE_REVIEW_LIMIT
  });
  const fullStageCompletion = getFullStageCompletion();

  els.dailyDueCount.textContent = pendingDue;
  els.dailyNewCount.textContent = pendingNew;
  els.sevenDayRetention.textContent = retention.rate === null ? "—" : `${retention.rate}%`;
  els.sevenDayPending.textContent = retention.pending;

  const completed = Boolean(task && pendingIds.length === 0);
  els.dailyTaskSummary.textContent = fullStageCompletion.isComplete
    ? `今日已完成本阶段全部 ${fullStageCompletion.total} 词`
    : "";
  els.dailyTaskSummary.hidden = !fullStageCompletion.isComplete;

  els.dailyTaskPanel.dataset.taskState = fullStageCompletion.isComplete
    ? "all-complete"
    : completed
      ? "completed"
      : "pending";
  els.dailyTaskPanel.classList.toggle("completed", completed && !fullStageCompletion.isComplete);
  els.dailyTaskPanel.classList.toggle("all-words-complete", fullStageCompletion.isComplete);
  els.startDailyTaskBtn.disabled = fullStageCompletion.isComplete || pendingIds.length === 0;
  els.startDailyTaskBtn.textContent = fullStageCompletion.isComplete
    ? "本阶段已完成"
    : completed
      ? "今日任务已完成"
      : task
        ? `继续今日任务 (${pendingIds.length})`
        : `开始今日任务 (${preview.total})`;
  els.startDueReviewBtn.disabled = dueReviewIds.length === 0;
  els.startDueReviewBtn.textContent = `复习到期词 (${dueReviewIds.length})`;
}

async function startDailyTask() {
  primePronunciationAudio();
  const { key, task } = await ensureDailyTask();
  const wordIds = getPendingDailyTaskIds(task);
  if (!wordIds.length) {
    renderDailyTask();
    return;
  }
  await startSession({
    wordIds,
    grade: task.stage,
    notice: "今日任务",
    preserveOrder: true,
    sessionKind: "daily",
    dailyTaskKey: key
  });
}

async function startDueReview() {
  primePronunciationAudio();
  const wordIds = getDueReviewWordIds(getEligibleWords(), state.records, {
    limit: DUE_REVIEW_LIMIT
  });
  if (!wordIds.length) {
    renderDailyTask();
    return;
  }
  await startSession({
    wordIds,
    grade: els.stageSelect.value,
    notice: "到期复习",
    preserveOrder: true,
    sessionKind: "due"
  });
}

function isWrongWord(word) {
  return getRecord(word.id).wrong > 0;
}

function isSlowWord(word) {
  return getRecord(word.id).slow > 0;
}

function priorityScore(word) {
  const record = getRecord(word.id);
  const due = record.nextReviewAt && record.nextReviewAt <= Date.now() ? 20 : 0;
  return (word.frequency || 0) + record.wrong * 10 + record.slow * 5 - record.mastery + due;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getTrainingCandidates(words, scope) {
  if (scope === "wrong" || scope === "weak") return words.filter(isWrongWord);
  if (scope === "slow") return words.filter(isSlowWord);
  if (scope === "new") return words.filter((word) => getRecord(word.id).seen === 0);
  return words;
}

function usesPersistentTrainingRotation(scope) {
  return scope !== "wrong" && scope !== "weak" && scope !== "slow";
}

function buildTrainingRotationKey(scope = els.trainingScope.value) {
  const poolType = scope === "new" ? "new" : "regular";
  return `${ROTATION_META_PREFIX}train:${encodeURIComponent(els.stageSelect.value)}:${els.deckFilter.value}:${poolType}`;
}

function buildQuizRotationKey(grade) {
  return `${ROTATION_META_PREFIX}quiz:${encodeURIComponent(grade)}`;
}

async function persistRotationState(key, rotationState) {
  if (!key || !rotationState) return;
  state.rotationQueues.set(key, rotationState);
  await put("meta", { key, value: rotationState, at: Date.now() });
}

async function completePersistentRotationItem(key, itemId) {
  if (!key) return;
  const rotationState = completeRotationItem(state.rotationQueues.get(key), itemId);
  await persistRotationState(key, rotationState);
}

function buildQueue() {
  state.queueNotice = "";
  const words = getEligibleWords();
  const sizeValue = els.sessionSize.value;
  const scope = els.trainingScope.value;
  const candidates = getTrainingCandidates(words, scope);

  if (!words.length) {
    state.queueNotice = "当前阶段暂无词汇";
    return { queue: [], rotationKey: null, rotationState: null };
  }

  if (!candidates.length) {
    if (scope === "wrong" || scope === "weak") state.queueNotice = "暂无错词";
    if (scope === "slow") state.queueNotice = "暂无慢词";
    if (scope === "new") state.queueNotice = "暂无新词";
    return { queue: [], rotationKey: null, rotationState: null };
  }

  if (sizeValue !== "all" && candidates.length < Number(sizeValue)) {
    state.queueNotice = `共 ${candidates.length} 词`;
  }

  if (!usesPersistentTrainingRotation(scope)) {
    const size = sizeValue === "all" ? candidates.length : Math.min(Number(sizeValue), candidates.length);
    return { queue: shuffle(candidates).slice(0, size), rotationKey: null, rotationState: null };
  }

  const rotationKey = buildTrainingRotationKey();
  const candidateIds = candidates.map((word) => word.id);
  const prepared = prepareRotationBatch(
    state.rotationQueues.get(rotationKey),
    candidateIds,
    sizeValue
  );
  const candidatesById = new Map(candidates.map((word) => [word.id, word]));
  const queue = prepared.batch.map((id) => candidatesById.get(id)).filter(Boolean);

  return {
    queue,
    rotationKey,
    rotationState: prepared.state
  };
}

function buildExactTrainingQueue(wordIds, notice, preserveOrder = false) {
  const wordsById = new Map(state.words.map((word) => [word.id, word]));
  const seenIds = new Set();
  const queue = (Array.isArray(wordIds) ? wordIds : [])
    .map((id) => wordsById.get(id))
    .filter((word) => {
      if (!word || seenIds.has(word.id)) return false;
      seenIds.add(word.id);
      return true;
    });
  state.queueNotice = notice || "仅练本轮新增错词。";
  return { queue: preserveOrder ? queue : shuffle(queue), rotationKey: null, rotationState: null };
}

function updateTrainingEstimate() {
  if (state.session) return;
  setTrainingSessionState("idle");
  const { queue } = buildQueue();
  if (!queue.length) {
    els.progressText.textContent = state.queueNotice || "暂无可练词";
    return;
  }
  els.progressText.textContent = state.queueNotice || `${els.stageSelect.value} · ${queue.length} 词`;
}

function updateSessionSizeOptions() {
  const previous = els.sessionSize.value || "200";
  const options = [
    ["50", "50 词"],
    ["100", "100 词"],
    ["200", "200 词"],
    ["300", "300 词"],
    ["400", "400 词"],
    ["all", "全部词"]
  ];
  els.sessionSize.innerHTML = options
    .map(([value, label], index) => `<option value="${value}"${index === 0 ? " selected" : ""}>${label}</option>`)
    .join("");
  els.sessionSize.value = options.some(([value]) => value === previous) ? previous : "200";
}

function resolvePracticeMode(word, selectedMode = state.session?.practiceMode || els.practiceMode.value) {
  if (word?.fixedMode === "customChoice") return "customChoice";
  if (selectedMode === "audioToZhChoice" && word?.sourceType !== "builtin") return "enToZhChoice";
  if (["zhToEnChoice", "enToZhChoice", "audioToZhChoice"].includes(selectedMode)) return selectedMode;
  return Math.random() < 0.5 ? "zhToEnChoice" : "enToZhChoice";
}

function practiceModeLabel(mode) {
  const labels = {
    audioToZhChoice: "听英文选中文",
    enToZhChoice: "看英文选中文",
    zhToEnChoice: "看中文选英文",
    auto: "智能双选",
    customChoice: "专项选择题"
  };
  return labels[mode] || "看英文选中文";
}

function primePronunciationAudio(practiceMode = els.practiceMode.value) {
  if (practiceMode === "audioToZhChoice") pronunciationPlayer.prime();
}

async function startSession(options = {}) {
  if (state.learningFlow && state.learningFlow.phase !== "done") {
    if (!confirm("还有未完成的巩固练习。开始新一轮训练会替换它，确定继续吗？")) {
      renderLearningFlow(true);
      return;
    }
    clearTimeout(flowAdvanceTimer);
    document.querySelector("#learningFlow").hidden = true;
    state.learningFlow = null;
    await saveLearningFlow();
  }
  const practiceMode = els.practiceMode.value;
  primePronunciationAudio(practiceMode);
  if (state.session) clearInterval(state.session.timerId);
  hideTrainContinueButton();
  const stage = Array.isArray(options?.wordIds) && options.grade ? options.grade : els.stageSelect.value;
  if (els.stageSelect.value !== stage) els.stageSelect.value = stage;
  try {
    await ensureStageLoaded(stage);
    await loadState();
  } catch (error) {
    els.progressText.textContent = stageLoadMessage(stage, true);
    return;
  }
  const queueResult = Array.isArray(options?.wordIds)
    ? buildExactTrainingQueue(options.wordIds, options.notice, options.preserveOrder)
    : buildQueue();
  const { queue, rotationKey, rotationState } = queueResult;
  if (!queue.length) {
    setTrainingFeedback(state.queueNotice || "暂无可练单词");
    els.progressText.textContent = els.feedback.textContent;
    return;
  }
  await persistRotationState(rotationKey, rotationState);
  state.session = {
    queue,
    sourceWords: [...queue],
    total: queue.length,
    grade: els.stageSelect.value,
    practiceMode,
    current: null,
    mode: "enToZhChoice",
    sessionStartedAt: performance.now(),
    startedAt: 0,
    timerId: 0,
    advanceTimerId: 0,
    timingReady: false,
    promptToken: 0,
    rotationKey,
    kind: options.sessionKind || "free",
    dailyTaskKey: options.dailyTaskKey || null,
    answered: false,
    done: 0,
    correct: 0,
    fast: 0,
    wrongWords: [],
    slowWords: [],
    notice: state.queueNotice
  };
  setTrainingSessionState("playing");
  els.skipBtn.disabled = false;
  els.skipBtn.hidden = false;
  els.sessionReport.hidden = true;
  els.sessionReport.innerHTML = "";
  nextWord();
}

function nextWord() {
  const session = state.session;
  clearInterval(session.timerId);
  clearTimeout(session.advanceTimerId);
  pronunciationPlayer.stop();
  hideTrainContinueButton();
  els.wordbookExplanation.hidden = true;
  els.wordbookExplanation.textContent = "";
  session.answered = false;
  session.timingReady = false;
  session.lastAnswerCorrect = null;
  session.lastAnswerFeedback = "";
  session.promptToken += 1;
  session.current = session.queue.shift();
  if (!session.current) return finishSession();

  setTrainingSessionState("playing");
  const isSevenDayCheck = session.current.fixedMode !== "customChoice"
    && isSevenDayEligible(getRecord(session.current.id));
  session.mode = resolvePracticeMode(session.current, session.practiceMode);
  const word = session.current;
  const isPromptChinese = session.mode === "zhToEnChoice";
  const isAudioPrompt = session.mode === "audioToZhChoice";
  els.word.textContent = isAudioPrompt ? "听发音" : (word.promptText || (isPromptChinese ? word.zh : word.en));
  els.word.hidden = false;
  const taskLabel = isSevenDayCheck ? "七日检测" : word.promptLabel;
  setTrainingTag(taskLabel || "");
  setTrainingHint(hintForMode(session.mode, word));
  els.audioPromptBtn.hidden = !isAudioPrompt;
  els.audioPromptBtn.disabled = isAudioPrompt;
  els.audioPromptBtn.classList.remove("needs-gesture", "audio-error");
  els.audioPromptBtn.textContent = "播放发音";
  els.contextSentence.hidden = true;
  els.contextSentence.textContent = "";
  setTrainingFeedback("");
  els.choices.innerHTML = "";
  els.choices.hidden = false;
  makeChoices(word).forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.dataset.choiceId = choice.id;
    button.dataset.choiceEnglish = normalizeEnglishWord(choice.en);
    const key = document.createElement("span");
    key.className = "choice-key";
    key.textContent = CHOICE_KEYS[index];
    const text = document.createElement("span");
    text.className = "choice-text";
    text.textContent = choiceText(choice, session.mode);
    button.append(key, text);
    button.disabled = true;
    button.addEventListener("click", () => answer(choice, button));
    els.choices.append(button);
  });
  els.timer.hidden = false;
  els.timer.classList.remove("fast", "slow");
  els.timer.textContent = isAudioPrompt ? "准备发音..." : "用时 0.0 秒";
  updateProgress();
  pronunciationPlayer.prefetch([word, ...session.queue.slice(0, 4)]);
  prepareTrainingPrompt(session.promptToken);
}

function hintForMode(mode, word) {
  if (mode === "customChoice") return word.notes || "";
  if (mode === "enToZhChoice") return [word.pos, word.notes].filter(Boolean).join(" · ");
  return "";
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function setTrainingChoicesEnabled(enabled) {
  [...els.choices.children].forEach((button) => {
    button.disabled = !enabled;
  });
}

function startTrainingTimerAfterAudio(session) {
  if (session.timingReady) return;
  session.startedAt = performance.now();
  session.timingReady = true;
  setTrainingChoicesEnabled(true);
  startTimer();
}

function showAudioRecovery(result) {
  els.audioPromptBtn.disabled = false;
  els.audioPromptBtn.setAttribute("aria-busy", "false");
  if (result.status === "blocked") {
    els.audioPromptBtn.classList.add("needs-gesture");
    els.audioPromptBtn.textContent = "点一下听发音";
    setTrainingFeedback("微信或当前浏览器需点击一下播放发音");
    return;
  }
  if (result.status === "missing") {
    els.audioPromptBtn.classList.add("audio-error");
    els.audioPromptBtn.textContent = "暂无发音";
    els.audioPromptBtn.disabled = true;
    setTrainingFeedback("自定义词暂无发音，可点“不会”跳过");
    return;
  }
  els.audioPromptBtn.classList.add("audio-error");
  els.audioPromptBtn.textContent = "重试发音";
  setTrainingFeedback("音频加载失败，请点击重试");
}

async function prepareTrainingPrompt(promptToken) {
  const session = state.session;
  const card = els.word.closest(".word-card");
  card?.scrollIntoView({ block: "start", behavior: "auto" });
  await waitForPaint();
  if (!state.session || state.session !== session || session.promptToken !== promptToken || session.answered) return;

  if (session.mode === "audioToZhChoice") {
    els.audioPromptBtn.setAttribute("aria-busy", "true");
    const result = await pronunciationPlayer.playWord(session.current);
    if (!state.session || state.session !== session || session.promptToken !== promptToken || session.answered) return;
    if (result.status !== "played") {
      showAudioRecovery(result);
      return;
    }
    els.audioPromptBtn.disabled = false;
    els.audioPromptBtn.setAttribute("aria-busy", "false");
    els.audioPromptBtn.textContent = "再听一次";
    setTrainingFeedback("");
    startTrainingTimerAfterAudio(session);
  } else {
    setTrainingFeedback("");
    startTrainingTimerAfterAudio(session);
  }
}

async function replayAudioPrompt() {
  const session = state.session;
  const isWrongReview = session?.answered && session.lastAnswerCorrect === false;
  if (!session?.current || session.mode !== "audioToZhChoice" || (session.answered && !isWrongReview)) return;
  const feedbackBeforeReplay = session.lastAnswerFeedback || els.feedback.textContent;
  els.audioPromptBtn.classList.remove("needs-gesture", "audio-error");
  els.audioPromptBtn.disabled = true;
  els.audioPromptBtn.setAttribute("aria-busy", "true");
  els.audioPromptBtn.textContent = "播放中...";
  const result = await pronunciationPlayer.playWord(session.current);
  if (!state.session || state.session !== session || (session.answered && !isWrongReview)) return;
  if (result.status !== "played") {
    showAudioRecovery(result);
    return;
  }
  els.audioPromptBtn.disabled = false;
  els.audioPromptBtn.setAttribute("aria-busy", "false");
  els.audioPromptBtn.textContent = "再听一次";
  if (isWrongReview) {
    setTrainingFeedback(feedbackBeforeReplay);
  } else {
    setTrainingFeedback("");
    startTrainingTimerAfterAudio(session);
  }
}

function startTimer() {
  clearInterval(state.session.timerId);
  els.timer.hidden = false;
  els.timer.classList.remove("fast", "slow");
  els.timer.textContent = "用时 0.0 秒";
  state.session.timerId = setInterval(() => {
    const elapsed = performance.now() - state.session.startedAt;
    els.timer.textContent = `用时 ${(elapsed / 1000).toFixed(1)} 秒`;
    els.timer.classList.toggle("fast", elapsed <= FAST_PICK_LIMIT);
    els.timer.classList.toggle("slow", elapsed > SLOW_PICK_LIMIT);
  }, 100);
}

function getTrainingChoiceCount(answer) {
  return 4;
}

function getGradeWordPool(grade) {
  return state.words.filter((word) => stageMatches(word, grade) && word.en && word.zh);
}

function normalizeDisplayedChoiceText(value) {
  return normalizeChoiceDisplayText(value);
}

function choiceDisplayKey(choice, mode) {
  return normalizeDisplayedChoiceText(choiceText(choice, mode));
}

function isUsableDistractor(candidate, answer, mode, usedDisplayKeys, usedChoices = []) {
  if (!candidate || candidate.id === answer.id || !candidate.en || !candidate.zh) return false;
  if (isEquivalentVocabularyAnswer(candidate, answer)) return false;
  const candidateDisplayKey = choiceDisplayKey(candidate, mode);
  const answerDisplayKey = choiceDisplayKey(answer, mode);
  if (!candidateDisplayKey || candidateDisplayKey === answerDisplayKey || usedDisplayKeys.has(candidateDisplayKey)) return false;

  // 中文释义按义项去重，避免同义词同时成为可选答案。
  if (hasMeaningConflict(candidate, answer)) return false;
  if (usedChoices.some((choice) => choice?.id !== answer.id && hasMeaningConflict(candidate, choice))) return false;

  return true;
}

function buildChoiceSet(answer, distractors, mode) {
  const choices = [answer];
  const usedDisplayKeys = new Set([choiceDisplayKey(answer, mode)]);
  distractors.forEach((candidate) => {
    if (!isUsableDistractor(candidate, answer, mode, usedDisplayKeys, choices)) return;
    usedDisplayKeys.add(choiceDisplayKey(candidate, mode));
    choices.push(candidate);
  });
  return choices;
}

function selectRankedDistractors(answer, count, mode, pool, externalUsedKeys = null, externalUsedChoices = null) {
  const usedDisplayKeys = externalUsedKeys || new Set([choiceDisplayKey(answer, mode)]);
  const usedChoices = externalUsedChoices || [answer];
  if (!externalUsedKeys) {
    usedDisplayKeys.add(choiceDisplayKey(answer, mode));
  }
  const ranked = pool
    .filter((candidate) => {
      if (!candidate?.en || !candidate?.zh || candidate.id === answer.id) return false;
      if (isEquivalentVocabularyAnswer(candidate, answer) || hasMeaningConflict(candidate, answer)) return false;
      return choiceDisplayKey(candidate, mode) !== choiceDisplayKey(answer, mode);
    })
    .map((candidate) => ({ candidate, score: scoreDistractorChoice(candidate, answer, mode) }))
    .sort((a, b) => {
      return b.score - a.score || hashString(`${answer.id}:${a.candidate.id}`) - hashString(`${answer.id}:${b.candidate.id}`);
    });
  const bestScore = ranked[0]?.score || 0;
  const preferred = ranked
    .filter((item) => item.score >= Math.max(1, bestScore - 3))
    .map((item) => item.candidate);
  const fallback = ranked.map((item) => item.candidate);
  const distractors = [];

  uniqueById([...shuffle(preferred), ...fallback]).forEach((candidate) => {
    if (distractors.length >= count) return;
    if (!isUsableDistractor(candidate, answer, mode, usedDisplayKeys, usedChoices)) return;
    usedDisplayKeys.add(choiceDisplayKey(candidate, mode));
    usedChoices.push(candidate);
    distractors.push(candidate);
  });

  return distractors;
}

function getStructuredDistractors(answer, count, mode) {
  const gradePool = getGradeWordPool(answer.grade);
  const fallbackPool = uniqueById([...getEligibleWords(), ...state.words]);
  const sharedUsedKeys = new Set([choiceDisplayKey(answer, mode)]);
  const sharedUsedChoices = [answer];
  const primary = selectRankedDistractors(answer, count, mode, gradePool.length ? gradePool : fallbackPool, sharedUsedKeys, sharedUsedChoices);
  if (primary.length >= count) return primary;
  const extra = selectRankedDistractors(answer, count - primary.length, mode, fallbackPool, sharedUsedKeys, sharedUsedChoices);
  return [...primary, ...extra].slice(0, count);
}

function getCustomChoices(answer, mode) {
  const choices = [];
  const usedDisplayKeys = new Set();
  let hasAnswer = false;
  const ordered = [...answer.choiceOptions].sort((left, right) => Number(Boolean(right.isAnswer)) - Number(Boolean(left.isAnswer)));
  ordered.forEach((choice) => {
    const key = choiceDisplayKey(choice, mode);
    if (!key || usedDisplayKeys.has(key)) return;
    if (choice.isAnswer && hasAnswer) return;
    if (choice.isAnswer) hasAnswer = true;
    usedDisplayKeys.add(key);
    choices.push(choice);
  });
  const choiceCount = getTrainingChoiceCount(answer);
  const correctChoice = choices.find((choice) => choice.isAnswer);
  if (!correctChoice) return shuffle(choices).slice(0, choiceCount);
  const distractors = choices.filter((choice) => !choice.isAnswer);
  return shuffle([correctChoice, ...shuffle(distractors).slice(0, choiceCount - 1)]);
}

function makeChoices(answer) {
  const mode = state.session?.mode || els.practiceMode?.value || "enToZhChoice";
  if (mode === "customChoice" && Array.isArray(answer.choiceOptions) && answer.choiceOptions.length) {
    return getCustomChoices(answer, mode);
  }
  const distractorCount = getTrainingChoiceCount(answer) - 1;
  return shuffle(buildChoiceSet(answer, getStructuredDistractors(answer, distractorCount, mode), mode));
}

function choiceText(choice, mode) {
  if (choice?.text !== undefined) return choice.text;
  return mode === "zhToEnChoice" ? choice.en : choice.zh;
}

function sameInitial(candidate, answer) {
  return normalizeChoiceText(candidate.en)[0] === normalizeChoiceText(answer.en)[0];
}

function similarWordShape(candidate, answer) {
  const candidateText = normalizeChoiceText(candidate.en);
  const answerText = normalizeChoiceText(answer.en);
  if (!candidateText || !answerText) return false;
  const lengthClose = Math.abs(candidateText.length - answerText.length) <= 2;
  const prefixClose = candidateText.slice(0, 3) === answerText.slice(0, 3) || candidateText.slice(0, 2) === answerText.slice(0, 2);
  const suffixClose = candidateText.slice(-4) === answerText.slice(-4) || candidateText.slice(-3) === answerText.slice(-3);
  const familyClose = ["ing", "ed", "er", "ly", "tion", "sion", "ment", "able", "ible", "ive", "al", "ous"].some((ending) => {
    return candidateText.endsWith(ending) && answerText.endsWith(ending);
  });
  return (lengthClose && (prefixClose || suffixClose)) || familyClose;
}

function englishEditDistance(leftValue, rightValue) {
  const left = normalizeChoiceText(leftValue);
  const right = normalizeChoiceText(rightValue);
  if (!left) return right.length;
  if (!right) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function scoreDistractorChoice(candidate, answer, mode) {
  if (!candidate?.en || !answer?.en) return 0;
  let score = 0;
  if (sameInitial(candidate, answer)) score += 6;
  if (similarWordShape(candidate, answer)) score += 5;
  const lengthGap = Math.abs(normalizeChoiceText(candidate.en).length - normalizeChoiceText(answer.en).length);
  if (lengthGap <= 1) score += 2;
  const editDistance = englishEditDistance(candidate.en, answer.en);
  if (editDistance === 1) score += 5;
  else if (editDistance === 2) score += 3;
  else if (editDistance === 3) score += 1;
  if (candidate.pos && answer.pos && candidate.pos === answer.pos) score += 3;
  const displayLengthGap = Math.abs(choiceDisplayKey(candidate, mode).length - choiceDisplayKey(answer, mode).length);
  if (displayLengthGap <= 2) score += 3;
  else if (displayLengthGap <= 5) score += 1;
  if (splitChineseSenses(candidate.zh).length === splitChineseSenses(answer.zh).length) score += 1;
  return score;
}

function normalizeChoiceText(value) {
  return normalizeEnglishWord(value);
}

function buildContextSentence(word) {
  const builtInContext = String(word.contextSentence || "").trim();
  if (builtInContext) return builtInContext;

  const english = String(word.en || "").trim();
  const normalized = normalizeEnglishWord(english);
  const notes = String(word.notes || "").trim();
  const noteSentences = notes.match(/[A-Z][^.!?]{5,90}[.!?]/g) || [];
  const fromNotes = noteSentences.find((sentence) => {
    const lowerSentence = sentence.toLowerCase();
    return lowerSentence.includes(normalized) && sentence.split(/\s+/).length <= 16;
  });
  if (fromNotes) return fromNotes;

  if (String(word.pos || "").includes("v.")) return `They decided to ${english} before the lesson ended.`;
  if (String(word.pos || "").includes("adj.")) return `The students found the idea ${english}.`;
  return `We noticed the ${english} during our class project.`;
}

function revealContextSentence(word) {
  els.contextSentence.textContent = buildContextSentence(word);
  els.contextSentence.hidden = false;
}

async function answer(value, button) {
  const session = state.session;
  if (!session || session.answered || !session.current || !session.timingReady) return;
  session.answered = true;
  session.timingReady = false;
  setTrainingSessionState("answered");
  els.skipBtn.hidden = true;
  els.skipBtn.disabled = true;
  pronunciationPlayer.stop();
  clearInterval(session.timerId);
  const elapsed = performance.now() - session.startedAt;
  const word = session.current;
  const isCorrect = isCorrectAnswer(value, word, session.mode);
  session.lastAnswerCorrect = isCorrect;
  const isFast = isCorrect && elapsed <= FAST_PICK_LIMIT;
  const isSlow = isCorrect && elapsed > SLOW_PICK_LIMIT;
  els.timer.textContent = `用时 ${(elapsed / 1000).toFixed(2)} 秒${isFast ? " · 秒选" : isSlow ? " · 慢词" : ""}`;
  els.timer.classList.toggle("fast", isFast);
  els.timer.classList.toggle("slow", isSlow);
  session.done += 1;
  session.correct += isCorrect ? 1 : 0;
  session.fast += isFast ? 1 : 0;
  if (!isCorrect) session.wrongWords.push(word);
  if (isSlow) session.slowWords.push(word);
  paintChoices(value, button);
  session.lastAnswerFeedback = feedbackText(word, isCorrect, isFast, isSlow, elapsed);
  setTrainingFeedback(session.lastAnswerFeedback);
  revealContextSentence(word);
  if (!isCorrect) showWordbookExplanation(word);
  await recordAnswer(word, isCorrect, isFast, isSlow);
  await syncDailyTaskFromTraining(word, isCorrect, session);
  await recordDailyActivity("train", session.grade);
  await completePersistentRotationItem(session.rotationKey, word.id);
  await maybeCelebrateFullStage(session.grade);
  renderAllDebounced();
  updateProgress();
  if (isCorrect) {
    session.advanceTimerId = setTimeout(nextWord, CORRECT_ADVANCE_DELAY_MS);
  } else {
    showTrainContinueButton();
  }
}

function hideTrainContinueButton() {
  els.trainContinueBtn.hidden = true;
}

function showTrainContinueButton() {
  els.trainContinueBtn.textContent = state.session?.queue.length ? "继续刷词" : "查看结果";
  els.trainContinueBtn.hidden = false;
  els.trainContinueBtn.focus();
}

function isCorrectAnswer(value, word, mode) {
  if (mode === "customChoice") return Boolean(value?.isAnswer);
  return isEquivalentVocabularyAnswer(value, word);
}

function paintChoices(answerWord, clickedButton) {
  [...els.choices.children].forEach((button) => {
    const current = state.session.current;
    const isCorrectChoice = state.session.mode === "customChoice" && Array.isArray(current.choiceOptions) && current.choiceOptions.length
      ? current.choiceOptions.some((choice) => choice.isAnswer && choice.id === button.dataset.choiceId)
      : button.dataset.choiceId === current.id || button.dataset.choiceEnglish === normalizeEnglishWord(current.en);
    button.classList.toggle("correct", isCorrectChoice);
    button.disabled = true;
  });
  if (answerWord !== null && clickedButton && !isCorrectAnswer(answerWord, state.session.current, state.session.mode)) {
    clickedButton.classList.add("wrong");
  }
}

function feedbackText(word, isCorrect, isFast, isSlow, elapsed) {
  const seconds = (elapsed / 1000).toFixed(2);
  const detail = [word.pos, word.notes].filter(Boolean).join(" · ");
  const answerText = word.answerFeedback || `${word.en} = ${word.zh}${detail ? ` · ${detail}` : ""}`;
  if (!isCorrect) return `错题：${answerText}`;
  if (isFast) return `秒选 ${seconds} 秒`;
  if (isSlow) return `正确 · ${seconds} 秒 · 慢词`;
  return `正确 · ${seconds} 秒`;
}

async function recordAnswer(word, isCorrect, isFast, isSlow) {
  const record = getRecord(word.id);
  const now = Date.now();
  const learningResult = applyLearningResult(record, {
    isCorrect,
    isFast,
    isSlow,
    mode: state.session?.mode || ""
  }, now);
  record.seen += 1;
  record.correct += isCorrect ? 1 : 0;
  record.wrong += isCorrect ? 0 : 1;
  record.fast += isFast ? 1 : 0;
  record.slow += isSlow ? 1 : 0;
  record.lastSeenAt = now;
  const delta = isCorrect ? (isFast ? 18 : 8) : -24;
  record.mastery = Math.max(0, Math.min(100, Math.round((record.mastery || 0) + delta)));
  Object.assign(record, learningResult);
  state.records.set(word.id, record);
  await put("records", record);
}

async function skipWord() {
  const session = state.session;
  if (!session || session.answered || !session.current) return;
  session.answered = true;
  session.timingReady = false;
  setTrainingSessionState("answered");
  els.skipBtn.hidden = true;
  els.skipBtn.disabled = true;
  window.speechSynthesis?.cancel();
  clearInterval(session.timerId);
  const word = session.current;
  els.timer.textContent = "已跳过";
  els.timer.classList.remove("fast", "slow");
  paintChoices(null, null);
  setTrainingFeedback(`跳过：${word.en} = ${word.zh}`);
  revealContextSentence(word);
  await completePersistentRotationItem(session.rotationKey, word.id);
  renderAll();
  updateProgress();
  showTrainContinueButton();
}

async function finishSession() {
  const session = state.session;
  clearInterval(session.timerId);
  const totalSeconds = Math.max(1, Math.round((performance.now() - session.sessionStartedAt) / 1000));
  const wrongWords = uniqueById(session.wrongWords);
  const tomorrow = uniqueById([...wrongWords, ...session.slowWords]).length || Math.ceil(session.total * 0.25);
  const dailyTask = session.dailyTaskKey ? state.dailyTasks.get(session.dailyTaskKey) : null;
  const dailyRemaining = dailyTask ? getPendingDailyTaskIds(dailyTask).length : 0;
  const dailyCompleted = session.kind === "daily" && dailyRemaining === 0;
  state.lastReport = {
    grade: session.grade,
    total: session.total,
    correct: session.correct,
    fast: session.fast,
    wrong: wrongWords.length,
    wrongWordIds: wrongWords.map((word) => word.id),
    slow: session.slowWords.length,
    tomorrow,
    totalSeconds,
    kind: session.kind,
    dailyCompleted,
    dailyRemaining,
    practiceMode: session.practiceMode
  };
  setTrainingSessionState("completed");
  els.word.textContent = "本轮完成";
  els.word.hidden = false;
  setTrainingTag("");
  setTrainingHint(
    session.kind === "daily" && !dailyCompleted
      ? `今日任务还剩 ${dailyRemaining} 词`
      : ""
  );
  els.timer.hidden = true;
  els.contextSentence.hidden = true;
  els.contextSentence.textContent = "";
  els.choices.innerHTML = "";
  els.choices.hidden = true;
  els.skipBtn.disabled = true;
  els.skipBtn.hidden = true;
  setTrainingFeedback(
    `完成 ${session.total} 词 · 正确率 ${percent(session.correct, session.total)} · 秒选率 ${percent(session.fast, session.total)}`
  );
  els.progressText.textContent = session.kind === "daily" && !dailyCompleted ? `今日剩 ${dailyRemaining} 词` : "已完成";
  els.progressBar.style.width = "100%";
  hideTrainContinueButton();
  renderSessionReport();
  renderAll();

  await startLearningFlow(state.lastReport, session.sourceWords, wrongWords, uniqueById(session.slowWords));
  state.session = null;
}

function showSessionCompleteModal(report) {
  const modal = document.getElementById("sessionCompleteModal");
  const header = document.getElementById("modalHeader");
  const icon = document.getElementById("modalIcon");
  const title = document.getElementById("modalTitle");
  const datetimeEl = document.getElementById("modalDatetime");
  const practiceModeEl = document.getElementById("modalPracticeMode");
  const sessionGradeEl = document.getElementById("modalSessionGrade");
  const sessionDurationEl = document.getElementById("modalSessionDuration");
  const totalEl = document.getElementById("modalTotal");
  const accuracyEl = document.getElementById("modalAccuracy");
  const fastRateEl = document.getElementById("modalFastRate");
  const resultEl = document.getElementById("modalResult");
  const againBtn = document.getElementById("modalAgainBtn");
  const nextBtn = document.getElementById("modalNextBtn");
  const closeBtn = document.getElementById("modalCloseBtn");

  const accuracyNum = report.total ? Math.round((report.correct / report.total) * 100) : 0;
  const fastNum = report.total ? Math.round((report.fast / report.total) * 100) : 0;
  const passed = accuracyNum >= 80;

  const now = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  datetimeEl.textContent = `${dateStr} ${timeStr}`;

  const grade = report.grade || els.stageSelect?.value || "未知阶段";
  const totalSeconds = report.totalSeconds || 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeText = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  practiceModeEl.textContent = practiceModeLabel(report.practiceMode || els.practiceMode?.value);
  sessionGradeEl.textContent = grade;
  sessionDurationEl.textContent = `用时 ${timeText}`;

  totalEl.textContent = report.total;
  accuracyEl.textContent = `${accuracyNum}%`;
  fastRateEl.textContent = `${fastNum}%`;
  accuracyEl.className = `modal-stat-value ${passed ? "pass" : "encourage"}`;

  header.className = "modal-header " + (passed ? "pass" : "encourage");
  icon.textContent = passed ? "🎉" : "🌟";
  title.textContent = passed ? "太棒了，顺利过关！" : "继续加油呀！";

  if (passed) {
    resultEl.className = "modal-result pass";
    resultEl.textContent = "正确率已达 80%，可截图发给代老师或学长学姐";
  } else {
    resultEl.className = "modal-result encourage";
    resultEl.textContent = "再巩固一轮就能达到 80% 过关线";
  }

  const closeModal = () => { modal.hidden = true; };
  closeBtn.onclick = closeModal;
  againBtn.disabled = !report.wrongWordIds?.length;
  againBtn.textContent = report.wrongWordIds?.length ? "再练一遍" : "本轮无错词";
  againBtn.onclick = () => {
    if (!report.wrongWordIds?.length) return;
    closeModal();
    startSession({ wordIds: report.wrongWordIds, grade: report.grade, notice: "仅练本轮新增错词。" });
  };
  nextBtn.onclick = () => { closeModal(); els.trainingScope.value = "smart"; startSession(); };

  modal.hidden = false;
}

function updateProgress() {
  const session = state.session;
  if (!session) return;
  const currentNo = session.current && !session.answered ? Math.min(session.done + 1, session.total) : session.done;
  els.progressText.textContent = `题号 ${currentNo}/${session.total}`;
  els.progressBar.style.width = `${Math.round((session.done / session.total) * 100)}%`;
}

let renderAllTimer = 0;
function renderAllDebounced() {
  clearTimeout(renderAllTimer);
  renderAllTimer = setTimeout(renderAll, 50);
}

function getActiveView() {
  for (const [name, el] of Object.entries(els.views)) {
    if (el.classList.contains("active")) return name;
  }
  return "train";
}

function moduleContext() {
  return {
    state,
    els,
    storage,
    STAGES,
    CHOICE_KEYS,
    BACKUP_SITE_URL,
    stageMatches,
    stageLoadMessage,
    ensureStageLoaded,
    loadState,
    renderAll,
    renderAllDebounced,
    switchView,
    startSession,
    resetStreak,
    put,
    putBatch,
    remove,
    clearStore,
    getRecord,
    isWrongWord,
    isSlowWord,
    priorityScore,
    selectRankedDistractors,
    buildChoiceSet,
    loadScriptWithRetry,
    recordDailyActivity,
    buildQuizRotationKey,
    prepareRotationBatch,
    persistRotationState,
    completePersistentRotationItem,
    renderWeakListFn: () => decksModule.renderWeakList(moduleContext())
  };
}

function renderAll() {
  const active = getActiveView();
  const ctx = moduleContext();
  renderStats();
  renderDailyProgress();
  if (active === "train") {
    renderTodayCompletion();
    renderDailyTask();
    updateSessionSizeOptions();
    updateTrainingEstimate();
  }
  if (active === "quiz") {
    quizModule.renderQuizStats(ctx);
    quizModule.renderQuizWrongList(state, els);
  }
  if (active === "decks") {
    decksModule.renderDecks(state, els);
    renderWordbook();
  }
  if (active === "wrong") {
    decksModule.renderWeakList(ctx);
  }
  if (active === "report") {
    decksModule.renderReport(ctx);
  }
}

function renderStats() {
  const eligible = getEligibleWords();
  const realTotal = eligible.length;
  let seen = 0, correct = 0, fast = 0, weakCount = 0;
  for (const word of eligible) {
    const record = state.records.get(word.id);
    if (record) {
      seen += record.seen;
      correct += record.correct;
      fast += record.fast;
      if (record.wrong > 0 || record.slow > 0) weakCount += 1;
    }
  }
  els.totalWords.textContent = realTotal;
  els.doneCount.textContent = seen;
  els.accuracy.textContent = percent(correct, seen);
  els.fastRate.textContent = percent(fast, seen);
  els.weakCount.textContent = weakCount;
}

function renderSessionReport() {
  const report = state.lastReport;
  if (!report) return;
  els.sessionReport.hidden = false;
  els.sessionReport.innerHTML = `
    <div class="session-report-card"><strong>${report.total}</strong><span>本轮词数</span></div>
    <div class="session-report-card"><strong>${percent(report.correct, report.total)}</strong><span>正确率</span></div>
    <div class="session-report-card"><strong>${percent(report.fast, report.total)}</strong><span>秒选率</span></div>
    <div class="session-report-card"><strong>${formatDuration(report.totalSeconds)}</strong><span>本轮用时</span></div>
    <div class="session-report-card"><strong>${report.wrong}</strong><span>错词</span></div>
    <div class="session-report-card"><strong>${report.slow}</strong><span>慢词</span></div>
    <div class="session-report-card"><strong>${report.tomorrow}</strong><span>明日复习</span></div>
    <div class="session-report-actions">
      <button id="againWeakBtn" type="button"${report.wrongWordIds?.length ? "" : " disabled"}>${report.wrongWordIds?.length ? "再练本轮错词" : "本轮无错词"}</button>
      <button id="nextSessionBtn" type="button" class="secondary">继续下一组</button>
    </div>
  `;
  document.querySelector("#againWeakBtn").addEventListener("click", () => {
    if (!report.wrongWordIds?.length) return;
    startSession({ wordIds: report.wrongWordIds, grade: report.grade, notice: "仅练本轮新增错词。" });
  });
  document.querySelector("#nextSessionBtn").addEventListener("click", () => {
    els.trainingScope.value = "smart";
    startSession();
  });
}

function bindEvents() {
  const ctx = moduleContext();
  els.resumeFlowBtn.addEventListener("click", () => renderLearningFlow(true));
  els.todayRecordBtn.addEventListener("click", openTodayCompletion);
  els.wordbookSearch.addEventListener("input", renderWordbook);
  els.wordbookResults.addEventListener("click", handleWordbookClick);
  document.querySelector("#flowClose").addEventListener("click", () => {
    clearTimeout(flowAdvanceTimer);
    document.querySelector("#flowAudio")?.pause();
    if (!state.viewedCompletion) pauseLearningFlow();
    document.querySelector("#learningFlow").hidden = true;
    state.viewedCompletion = null;
    els.resumeFlowBtn.hidden = !state.learningFlow || state.learningFlow.phase === "done";
  });
  els.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  els.mobileViewButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.mobileView));
  });
  [els.deckFilter, els.sessionSize, els.trainingScope].forEach((el) => el.addEventListener("change", renderAll));
  els.stageSelect.addEventListener("change", async () => {
    const stage = els.stageSelect.value;
    try {
      await ensureStageLoaded(stage);
      await loadState();
    } catch (error) {
      els.progressText.textContent = stageLoadMessage(stage, true);
    }
  });
  els.startBtn.addEventListener("click", startSession);
  els.startDailyTaskBtn.addEventListener("click", startDailyTask);
  els.startDueReviewBtn.addEventListener("click", startDueReview);
  els.skipBtn.addEventListener("click", skipWord);
  els.trainContinueBtn.addEventListener("click", nextWord);
  els.audioPromptBtn.addEventListener("click", replayAudioPrompt);

  decksModule.bindDecksEvents(ctx);
  battleModule.bindBattleEvents(ctx);
  quizModule.bindQuizEvents(ctx);

  document.addEventListener("keydown", (event) => {
    if (els.views.train.classList.contains("active") && state.session && !state.session.answered) {
      if (["enToZhChoice", "zhToEnChoice", "audioToZhChoice", "customChoice"].includes(state.session.mode)) {
        const key = event.key.toUpperCase();
        const choiceIndex = /^[1-5]$/.test(key) ? Number(key) - 1 : CHOICE_KEYS.indexOf(key);
        const button = choiceIndex >= 0 ? els.choices.children[choiceIndex] : null;
        if (button) {
          event.preventDefault();
          button.click();
        }
      }
    } else if (
      els.views.train.classList.contains("active")
      && state.session?.answered
      && !els.trainContinueBtn.hidden
      && (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      els.trainContinueBtn.click();
    }
    if (els.views.quiz.classList.contains("active") && state.quiz && !state.quiz.answered) {
      const key = event.key.toUpperCase();
      const choiceIndex = /^[1-5]$/.test(key) ? Number(key) - 1 : CHOICE_KEYS.indexOf(key);
      const button = choiceIndex >= 0 ? els.quizChoices.children[choiceIndex] : null;
      if (button) {
        event.preventDefault();
        button.click();
      }
    } else if (
      els.views.quiz.classList.contains("active")
      && state.quiz?.answered
      && !els.quizContinueBtn.hidden
      && (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      els.quizContinueBtn.click();
    }
  });
}

function clearAllTimers() {
  if (state.session?.timerId) { clearInterval(state.session.timerId); state.session.timerId = 0; }
  if (state.session?.advanceTimerId) { clearTimeout(state.session.advanceTimerId); state.session.advanceTimerId = 0; }
  if (state.quiz?.timerId) { clearInterval(state.quiz.timerId); state.quiz.timerId = 0; }
  if (state.quiz?.advanceTimerId) { clearTimeout(state.quiz.advanceTimerId); state.quiz.advanceTimerId = 0; }
  pronunciationPlayer.stop();
}

window.WordSnapInspector = {
  getSnapshot() {
    return {
      activeView: getActiveView(),
      stage: els.stageSelect.value,
      totalWords: Number(els.totalWords.textContent || 0),
      sessionState: els.views.train?.dataset.sessionState || "idle",
      battleState: els.views.battle?.dataset.battleState || "idle",
      quizState: els.views.quiz?.dataset.quizState || "idle",
      flowPhase: document.querySelector("#learningFlow")?.hidden ? "closed" : (state.learningFlow?.phase || "open")
    };
  }
};

async function init() {
  document.body.dataset.activeView = getActiveView();
  setTrainingSessionState("idle");
  bindEvents();
  window.addEventListener("pagehide", () => {
    if (!document.querySelector("#learningFlow").hidden && !state.viewedCompletion) pauseLearningFlow();
  });
  document.addEventListener("WeixinJSBridgeReady", () => {
    if (els.practiceMode.value === "audioToZhChoice") pronunciationPlayer.prime();
  }, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (!document.querySelector("#learningFlow").hidden && !state.viewedCompletion) pauseLearningFlow();
      document.querySelector("#flowAudio")?.pause();
      clearAllTimers();
      return;
    }
    if (!document.querySelector("#learningFlow").hidden && !state.viewedCompletion) resumeLearningFlow();
    if (state.session?.mode === "audioToZhChoice" && !state.session.answered && !state.session.timingReady) {
      showAudioRecovery({ status: "blocked" });
    }
  });
  try {
    state.db = await storage.openDb();
    await seedBuiltinWords();
    await ensureStageLoaded(els.stageSelect.value);
    await loadState();
    if (state.learningFlow && state.learningFlow.phase !== "done") renderLearningFlow(true);
  } catch (error) {
    setTrainingFeedback(`初始化失败：${error.message || error}`);
  }
}

init();
