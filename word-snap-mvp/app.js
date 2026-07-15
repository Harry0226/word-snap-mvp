const STAGES = ["初一课内词汇", "初一考试词汇", "初二课内词汇", "初二考试词汇", "初三课内词汇", "初三考试词汇", "高一课内词汇", "高一考试词汇", "高一课改词库", "高二课内词汇", "高二考试词汇", "高三考试词汇"];
const DB_NAME = "word-snap-v2";
const DB_VERSION = 4;
const BUILTIN_SEED_VERSION = 18;
const FAST_PICK_LIMIT = 2000;
const SLOW_PICK_LIMIT = 3500;
const CHOICE_KEYS = ["A", "B", "C", "D", "E"];
const QUIZ_FAST = 5000;
const QUIZ_SLOW = 12000;
const GRADE7_QUIZ_COUNT = 186;
const ROTATION_META_PREFIX = "rotation:v2:";
const { prepareRotationBatch, completeRotationItem } = window.WordSnapRotation;
const {
  normalizeDisplayedChoiceText: normalizeChoiceDisplayText,
  normalizeEnglishWord,
  splitChineseSenses,
  hasMeaningConflict
} = window.WordSnapChoiceUtils;
const { getCheckinThreshold, makeProgressKey, advanceDailyProgress } = window.WordSnapDailyStreaks;
const { loadScriptWithRetry } = window.WordSnapAssetLoader;
const BACKUP_SITE_URL = "https://word-snap-mvp.pages.dev/";

const GRADE8_QUIZ_COUNT = 239;
const GRADE10_QUIZ_COUNT = 153;
const GRADE11_QUIZ_COUNT = 129;
const QUIZ_BANK_SCRIPTS = {
  "初一课内词汇": "./word-data/quiz-grade7-sentences.js?v=20260524-grade7",
  "初一考试词汇": "./word-data/quiz-grade7-sentences.js?v=20260524-grade7",
  "初二课内词汇": "./word-data/quiz-grade8-sentences.js?v=20260525-grade8",
  "初二考试词汇": "./word-data/quiz-grade8-sentences.js?v=20260525-grade8",
  "初三课内词汇": "./word-data/quiz-sentences.js?v=20260601-quiz340",
  "初三考试词汇": "./word-data/quiz-sentences.js?v=20260601-quiz340",
  "高一课内词汇": "./word-data/quiz-grade10-sentences.js?v=20260530-senior-quiz",
  "高一考试词汇": "./word-data/quiz-grade10-sentences.js?v=20260530-senior-quiz",
  "高二课内词汇": "./word-data/quiz-grade11-sentences.js?v=20260530-senior-quiz",
  "高二考试词汇": "./word-data/quiz-grade11-sentences.js?v=20260530-senior-quiz"
};

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
  stageLoads: new Map()
};

const els = {
  // Nav & views
  tabs: [...document.querySelectorAll(".tab")],
  views: {
    train: document.querySelector("#view-train"),
    battle: document.querySelector("#view-battle"),
    decks: document.querySelector("#view-decks"),
    wrong: document.querySelector("#view-wrong"),
    report: document.querySelector("#view-report"),
    quiz: document.querySelector("#view-quiz")
  },
  // Training
  totalWords: document.querySelector("#totalWords"),
  doneCount: document.querySelector("#doneCount"),
  accuracy: document.querySelector("#accuracy"),
  fastRate: document.querySelector("#fastRate"),
  weakCount: document.querySelector("#weakCount"),
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
  hint: document.querySelector("#hint"),
  timer: document.querySelector("#timer"),
  choices: document.querySelector("#choices"),
  feedback: document.querySelector("#feedback"),
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
  trainQuizBankTotal: document.querySelector("#trainQuizBankTotal"),
  trainQuizDoneCount: document.querySelector("#trainQuizDoneCount"),
  trainQuizAccuracy: document.querySelector("#trainQuizAccuracy"),
  trainQuizFastRate: document.querySelector("#trainQuizFastRate"),
  trainQuizWrongCount: document.querySelector("#trainQuizWrongCount"),
  // Streaks
  trainStreakCard: document.querySelector("#trainStreakCard"),
  trainStreak: document.querySelector("#trainStreak"),
  trainTodayProgress: document.querySelector("#trainTodayProgress"),
  trainCheckinStatus: document.querySelector("#trainCheckinStatus"),
  weeklyFireCount: document.querySelector("#weeklyFireCount"),
  streakIcon: document.querySelector("#streakIcon"),
  flameWrap: document.querySelector("#flameWrap"),
  quizStreakCard: document.querySelector("#quizStreakCard"),
  quizStreak: document.querySelector("#quizStreak"),
  quizTodayProgress: document.querySelector("#quizTodayProgress"),
  quizCheckinStatus: document.querySelector("#quizCheckinStatus"),
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

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("words")) {
        const words = db.createObjectStore("words", { keyPath: "id" });
        words.createIndex("stage", "grade", { unique: false });
        words.createIndex("sourceType", "sourceType", { unique: false });
      }
      if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "wordId" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      if (!db.objectStoreNames.contains("quizWrongAnswers")) db.createObjectStore("quizWrongAnswers", { keyPath: "questionId" });
      if (!db.objectStoreNames.contains("streaks")) db.createObjectStore("streaks", { keyPath: "key" });
      if (db.objectStoreNames.contains("achievements")) db.deleteObjectStore("achievements");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(storeName, mode = "readonly") {
  return state.db.transaction(storeName, mode).objectStore(storeName);
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function getAllKeys(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName).getAllKeys();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function getWordsByStage(stage) {
  return new Promise((resolve, reject) => {
    const request = tx("words").index("stage").getAll(stage);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function put(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function putBatch(storeName, values) {
  if (!values.length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    values.forEach((value) => store.put(value));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteWordsBySourceType(sourceType) {
  return new Promise((resolve, reject) => {
    const request = tx("words", "readwrite").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      if (cursor.value.sourceType === sourceType) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function deleteRecordsForMissingWords(validWordIds) {
  return new Promise((resolve, reject) => {
    const request = tx("records", "readwrite").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      if (!validWordIds.has(cursor.value.wordId)) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function deleteRecordsByWordIds(wordIds) {
  if (!wordIds.size) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const request = tx("records", "readwrite").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      if (wordIds.has(cursor.value.wordId)) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function slugWord(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "word";
}

function normalizeBuiltinWord(word, index, list) {
  const grade = list.grade || "初三课内词汇";
  const source = list.source || "初三课内词汇";
  const stageKey = encodeURIComponent(grade).replace(/%/g, "").toLowerCase();
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
    choiceOptions: Array.isArray(word.choiceOptions) ? word.choiceOptions : null
  };
}

function replaceBuiltinStageWords(stage, words) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction("words", "readwrite");
    const store = transaction.objectStore("words");
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (cursor.value.sourceType === "builtin" && cursor.value.grade === stage) cursor.delete();
        cursor.continue();
        return;
      }
      words.forEach((word) => store.put(word));
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function stageLoadMessage(stage, failed = false) {
  if (failed) return `${stage}词库加载失败。请点击"开始训练"重试，或使用备用入口：${BACKUP_SITE_URL}`;
  return `正在加载${stage}词库，请稍候...`;
}

async function seedStageWords(stage, list, version) {
  const metaKey = `builtinStageVersion:${stage}`;
  const seedMeta = await new Promise((resolve) => {
    const request = tx("meta").get(metaKey);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  const existing = await getWordsByStage(stage);
  const hasBuiltinWords = existing.some((word) => word.sourceType === "builtin");
  if (seedMeta?.value === version && hasBuiltinWords) return;
  const words = (list.words || [])
    .map((word, index) => normalizeBuiltinWord(word, index, list))
    .filter((word) => word.en && word.zh);
  await replaceBuiltinStageWords(stage, words);
  await put("meta", { key: metaKey, value: version, at: Date.now() });
}

async function isStageSeeded(stage, version) {
  const metaKey = `builtinStageVersion:${stage}`;
  const seedMeta = await new Promise((resolve) => {
    const request = tx("meta").get(metaKey);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  if (seedMeta?.value !== version) return false;
  return (await getWordsByStage(stage)).some((word) => word.sourceType === "builtin");
}

async function ensureStageLoaded(stage) {
  if (state.stageLoads.has(stage)) return state.stageLoads.get(stage);
  const entry = window.WORD_SNAP_BUILTIN_MANIFEST?.stages?.[stage];
  if (!entry) return false;
  const promise = (async () => {
    if (await isStageSeeded(stage, entry.version)) return true;
    els.feedback.textContent = stageLoadMessage(stage);
    try {
      await loadScriptWithRetry(entry.src);
      const list = window.WORD_SNAP_STAGE_LISTS?.[stage];
      if (!list?.words?.length) throw new Error(`${stage}词库数据为空`);
      await seedStageWords(stage, list, entry.version);
      if (!state.session && els.feedback.textContent === stageLoadMessage(stage)) {
        els.feedback.textContent = "练习记录只保存在本机浏览器，不会上传。";
      }
      return true;
    } catch (error) {
      els.feedback.textContent = stageLoadMessage(stage, true);
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
    const legacyIds = new Set(legacyBuiltinWords.map((word) => word.id));
    await new Promise((resolve, reject) => {
      const transaction = state.db.transaction("words", "readwrite");
      const store = transaction.objectStore("words");
      legacyBuiltinWords.forEach((word) => store.delete(word.id));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    await deleteRecordsByWordIds(legacyIds);
  }
  await put("meta", { key: "builtinSeedVersion", value: BUILTIN_SEED_VERSION, at: Date.now() });
  await put("meta", { key: "builtinSeeded", value: true, at: Date.now() });
}

function deleteBuiltinDecks(decks) {
  return new Promise((resolve, reject) => {
    const request = tx("words", "readwrite").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      const word = cursor.value;
      const shouldDelete = word.sourceType === "builtin" && decks.some((deck) => word.grade === deck.grade && word.source === deck.source);
      if (shouldDelete) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

// ============ 打卡系统 ============

async function loadStreaks() {
  const streaks = await getAll("streaks");
  state.streaks = new Map(streaks.map((streak) => [streak.key, streak]));
}

async function saveStreak(streak) {
  // 先写入 IndexedDB，再更新内存，避免竞争条件
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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayStr() {
  const now = new Date(Date.now() - 86400000);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  if (next.justCheckedIn) showToast(`🔥 ${kind === "train" ? "刷词" : "刷题"}达标，自动打卡成功！`);
  renderDailyProgress();
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function getWeekFireCount(streak) {
  if (!streak?.checkInDates?.length) return 0;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  return streak.checkInDates.filter((d) => d >= mondayStr).length;
}

function renderStreakCard(card, progressEl, kind, grade) {
  const threshold = getCheckinThreshold(kind, grade);
  card.hidden = !threshold;
  card.parentElement?.classList.toggle("without-streak", !threshold);
  if (!threshold) return;
  const streak = getStreak(kind, grade) || {};
  const todayCount = streak.progressDate === getTodayStr() ? Number(streak.todayCount || 0) : 0;
  const checked = streak.lastCheckIn === getTodayStr();
  progressEl.textContent = `今日 ${Math.min(todayCount, threshold)}/${threshold}`;
  card.classList.toggle("checked-in", checked);
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
  await loadStreaks();

  renderAll();
}

function switchView(view) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  Object.entries(els.views).forEach(([name, el]) => el.classList.toggle("active", name === view));
  renderAll();
  if (view === "quiz") updateQuizSizeOptions();
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
    nextReviewAt: 0
  };
}

function isWeak(word) {
  const record = getRecord(word.id);
  return record.wrong > 0 || record.slow > 0;
}

function isWrongWord(word) {
  return getRecord(word.id).wrong > 0;
}

function isSlowWord(word) {
  return getRecord(word.id).slow > 0;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function priorityScore(word) {
  const record = getRecord(word.id);
  const due = record.nextReviewAt && record.nextReviewAt <= Date.now() ? 20 : 0;
  return (word.frequency || 0) + record.wrong * 10 + record.slow * 5 - record.mastery + due;
}

function randomizedPrioritySort(items) {
  return shuffle(items).sort((a, b) => priorityScore(b) - priorityScore(a));
}

function weightedPick(items, count) {
  return randomizedPrioritySort(items).slice(0, count);
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
    state.queueNotice = "当前阶段没有可训练词。请切换阶段，或先在词库页上传词表。";
    return { queue: [], rotationKey: null, rotationState: null };
  }

  if (!candidates.length) {
    if (scope === "wrong" || scope === "weak") state.queueNotice = "还没有错词。请先完成一轮训练，或把训练范围切回智能混合。";
    if (scope === "slow") state.queueNotice = "还没有慢词。请先完成一轮训练，或把训练范围切回智能混合。";
    if (scope === "new") state.queueNotice = "当前阶段没有新词了。可以改练错词、慢词或全部单词。";
    return { queue: [], rotationKey: null, rotationState: null };
  }

  if (sizeValue !== "all" && candidates.length < Number(sizeValue)) {
    state.queueNotice = `当前筛选只有 ${candidates.length} 个词，本轮会练完这些词。`;
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

function buildExactTrainingQueue(wordIds, notice) {
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
  return { queue: shuffle(queue), rotationKey: null, rotationState: null };
}

function updateTrainingEstimate() {
  if (state.session) return;
  const { queue } = buildQueue();
  if (!queue.length) {
    els.progressText.textContent = state.queueNotice || "当前设置下暂无可练单词";
    return;
  }
  const suffix = state.queueNotice ? ` · ${state.queueNotice}` : "";
  els.progressText.textContent = `本轮预计 ${queue.length} 词${suffix}`;
}

function updateSessionSizeOptions() {
  const previous = els.sessionSize.value || "200";
  const options = [
    ["50", "50 词"],
    ["100", "100 词"],
    ["200", "200 词"],
    ["300", "300 词"],
    ["all", "全部单词"]
  ];
  els.sessionSize.innerHTML = options
    .map(([value, label], index) => `<option value="${value}"${index === 0 ? " selected" : ""}>${label}</option>`)
    .join("");
  els.sessionSize.value = options.some(([value]) => value === previous) ? previous : "200";
}

function resolvePracticeMode(word) {
  if (word?.fixedMode === "customChoice") return "customChoice";
  const selected = els.practiceMode.value;
  if (selected === "zhToEnChoice" || selected === "enToZhChoice") return selected;
  return Math.random() < 0.5 ? "zhToEnChoice" : "enToZhChoice";
}

async function startSession(options = {}) {
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
    ? buildExactTrainingQueue(options.wordIds, options.notice)
    : buildQueue();
  const { queue, rotationKey, rotationState } = queueResult;
  if (!queue.length) {
    els.feedback.textContent = state.queueNotice || "当前设置下暂无可练单词。";
    els.progressText.textContent = els.feedback.textContent;
    return;
  }
  await persistRotationState(rotationKey, rotationState);
  state.session = {
    queue,
    total: queue.length,
    grade: els.stageSelect.value,
    current: null,
    mode: "enToZhChoice",
    sessionStartedAt: performance.now(),
    startedAt: 0,
    timerId: 0,
    rotationKey,
    answered: false,
    done: 0,
    correct: 0,
    fast: 0,
    wrongWords: [],
    slowWords: [],
    notice: state.queueNotice
  };
  els.skipBtn.disabled = false;
  els.sessionReport.hidden = true;
  els.sessionReport.innerHTML = "";
  nextWord();
}

function nextWord() {
  const session = state.session;
  hideTrainContinueButton();
  session.answered = false;
  session.current = session.queue.shift();
  if (!session.current) return finishSession();

  session.mode = resolvePracticeMode(session.current);
  const word = session.current;
  const isPromptChinese = session.mode === "zhToEnChoice";
  els.word.textContent = word.promptText || (isPromptChinese ? word.zh : word.en);
  els.tag.textContent = `${word.grade} · ${word.promptLabel || (word.sourceType === "builtin" ? "内置" : "自定义")}`;
  els.hint.textContent = hintForMode(session.mode, word);
  els.feedback.textContent = "计时中。";
  els.choices.innerHTML = "";
  els.choices.hidden = false;
  makeChoices(word).forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.dataset.choiceId = choice.id;
    const key = document.createElement("span");
    key.className = "choice-key";
    key.textContent = CHOICE_KEYS[index];
    const text = document.createElement("span");
    text.className = "choice-text";
    text.textContent = choiceText(choice, session.mode);
    button.append(key, text);
    button.addEventListener("click", () => answer(choice, button));
    els.choices.append(button);
  });
  session.startedAt = performance.now();
  startTimer();
  updateProgress();
}

function hintForMode(mode, word) {
  if (mode === "customChoice") return word.notes || "根据题干选择最匹配的答案。2 秒内算秒选，超过 3.5 秒为慢词。";
  const detail = [word.pos, word.notes].filter(Boolean).join(" · ");
  if (mode === "enToZhChoice") return detail || "看英文选中文。2 秒内算秒选，超过 3.5 秒为慢词。";
  return "看中文选英文。2 秒内算秒选，超过 3.5 秒为慢词。";
}

function startTimer() {
  clearInterval(state.session.timerId);
  els.timer.classList.remove("fast");
  els.timer.textContent = "用时 0.0 秒 · 2 秒内算秒选，超过 3.5 秒为慢词";
  state.session.timerId = setInterval(() => {
    const elapsed = performance.now() - state.session.startedAt;
    els.timer.textContent = `用时 ${(elapsed / 1000).toFixed(1)} 秒 · 2 秒内算秒选，超过 3.5 秒为慢词`;
  }, 100);
}

function getTrainingChoiceCount(answer) {
  return 4;
}

function getGradeWordPool(grade) {
  return state.words.filter((word) => stageMatches(word, grade) && word.en && word.zh);
}

function isSimilarWordShape(a, b) {
  const left = String(a || "").toLowerCase();
  const right = String(b || "").toLowerCase();
  const samePhraseShape = left.includes(" ") === right.includes(" ");
  const sameHyphenShape = left.includes("-") === right.includes("-");
  const closeLength = Math.abs(left.length - right.length) <= 3;
  return (samePhraseShape && closeLength) || (sameHyphenShape && closeLength);
}

function normalizeDisplayedChoiceText(value) {
  return normalizeChoiceDisplayText(value);
}

function choiceDisplayKey(choice, mode) {
  return normalizeDisplayedChoiceText(choiceText(choice, mode));
}

function isUsableDistractor(candidate, answer, mode, usedDisplayKeys, usedChoices = []) {
  if (!candidate || candidate.id === answer.id || !candidate.en || !candidate.zh) return false;
  const candidateDisplayKey = choiceDisplayKey(candidate, mode);
  const answerDisplayKey = choiceDisplayKey(answer, mode);
  if (!candidateDisplayKey || candidateDisplayKey === answerDisplayKey || usedDisplayKeys.has(candidateDisplayKey)) return false;

  // 中文释义按义项去重，避免“种类，善良的 / 种类 / 善良”同时成为可选答案。
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
    .filter((candidate) => candidate?.id !== answer.id && candidate?.zh)
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

function scoreDistractorChoice(candidate, answer, mode) {
  if (!candidate?.en || !answer?.en) return 0;
  let score = 0;
  if (sameInitial(candidate, answer)) score += 6;
  if (similarWordShape(candidate, answer)) score += 5;
  const lengthGap = Math.abs(normalizeChoiceText(candidate.en).length - normalizeChoiceText(answer.en).length);
  if (lengthGap <= 1) score += 2;
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

async function answer(value, button) {
  const session = state.session;
  if (!session || session.answered || !session.current) return;
  session.answered = true;
  clearInterval(session.timerId);
  const elapsed = performance.now() - session.startedAt;
  const word = session.current;
  const isCorrect = isCorrectAnswer(value, word, session.mode);
  const isFast = isCorrect && elapsed <= FAST_PICK_LIMIT;
  const isSlow = isCorrect && elapsed > SLOW_PICK_LIMIT;
  els.timer.textContent = `用时 ${(elapsed / 1000).toFixed(2)} 秒 · ${isFast ? "秒选成功" : isSlow ? "已记慢词" : "答对未秒选"}`;
  els.timer.classList.toggle("fast", isFast);
  session.done += 1;
  session.correct += isCorrect ? 1 : 0;
  session.fast += isFast ? 1 : 0;
  if (!isCorrect) session.wrongWords.push(word);
  if (isSlow) session.slowWords.push(word);
  paintChoices(value, button);
  els.feedback.textContent = feedbackText(word, isCorrect, isFast, isSlow, elapsed);
  await recordAnswer(word, isCorrect, isFast, isSlow);
  await recordDailyActivity("train", session.grade);
  await completePersistentRotationItem(session.rotationKey, word.id);
  renderAllDebounced();
  updateProgress();
  if (isCorrect) {
    setTimeout(nextWord, 500);
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
  return value?.id === word.id;
}

function paintChoices(answerWord, clickedButton) {
  [...els.choices.children].forEach((button) => {
    const current = state.session.current;
    const isCorrectChoice = state.session.mode === "customChoice" && Array.isArray(current.choiceOptions) && current.choiceOptions.length
      ? current.choiceOptions.some((choice) => choice.isAnswer && choice.id === button.dataset.choiceId)
      : button.dataset.choiceId === current.id;
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
  const answer = word.answerFeedback || `${word.en} = ${word.zh}${detail ? `｜${detail}` : ""}`;
  if (!isCorrect) return `错题：${answer}`;
  if (isFast) return `秒选成功：${seconds} 秒`;
  if (isSlow) return `答对了，用时 ${seconds} 秒，已记为慢词。`;
  return `答对了，用时 ${seconds} 秒，未记为慢词。`;
}

async function recordAnswer(word, isCorrect, isFast, isSlow) {
  const record = getRecord(word.id);
  record.seen += 1;
  record.correct += isCorrect ? 1 : 0;
  record.wrong += isCorrect ? 0 : 1;
  record.fast += isFast ? 1 : 0;
  record.slow += isSlow ? 1 : 0;
  record.lastSeenAt = Date.now();
  const delta = isCorrect ? (isFast ? 18 : 8) : -24;
  record.mastery = Math.max(0, Math.min(100, Math.round((record.mastery || 0) + delta)));
  const intervalHours = isCorrect ? (isFast ? 48 : 24) : 4;
  record.nextReviewAt = Date.now() + intervalHours * 60 * 60 * 1000;
  state.records.set(word.id, record);
  await put("records", record);
}

async function skipWord() {
  const session = state.session;
  if (!session || session.answered || !session.current) return;
  session.answered = true;
  clearInterval(session.timerId);
  const word = session.current;
  els.timer.textContent = "已跳过，不计入错误。";
  els.timer.classList.remove("fast");
  paintChoices(null, null);
  els.feedback.textContent = `跳过：${word.en} = ${word.zh}`;
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
  state.lastReport = {
    grade: session.grade,
    total: session.total,
    correct: session.correct,
    fast: session.fast,
    wrong: wrongWords.length,
    wrongWordIds: wrongWords.map((word) => word.id),
    slow: session.slowWords.length,
    tomorrow,
    totalSeconds
  };
  els.word.textContent = "Done";
  els.tag.textContent = "本轮完成";
  els.hint.textContent = "建议明天优先复习本轮错词和慢词。";
  els.timer.textContent = "本轮已完成";
  els.timer.classList.remove("fast");
  els.choices.innerHTML = "";
  els.choices.hidden = false;
  els.skipBtn.disabled = true;
  els.feedback.textContent = `完成 ${session.total} 词，正确率 ${percent(session.correct, session.total)}，秒选率 ${percent(session.fast, session.total)}。`;
  els.progressText.textContent = "本轮已完成";
  els.progressBar.style.width = "100%";
  hideTrainContinueButton();
  renderSessionReport();
  renderAll();

  showSessionCompleteModal(state.lastReport);
  state.session = null;
}

function showSessionCompleteModal(report) {
  const modal = document.getElementById("sessionCompleteModal");
  const header = document.getElementById("modalHeader");
  const icon = document.getElementById("modalIcon");
  const title = document.getElementById("modalTitle");
  const datetimeEl = document.getElementById("modalDatetime");
  const sessionInfoEl = document.getElementById("modalSessionInfo");
  const totalEl = document.getElementById("modalTotal");
  const accuracyEl = document.getElementById("modalAccuracy");
  const fastRateEl = document.getElementById("modalFastRate");
  const resultEl = document.getElementById("modalResult");
  const againBtn = document.getElementById("modalAgainBtn");
  const nextBtn = document.getElementById("modalNextBtn");
  const closeBtn = document.getElementById("modalCloseBtn");

  const accuracyNum = report.total ? Math.round((report.correct / report.total) * 100) : 0;
  const fastNum = report.total ? Math.round((report.fast / report.total) * 100) : 0;
  const passed = accuracyNum >= 90;

  // 设置日期和时间
  const now = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  datetimeEl.textContent = `${dateStr} ${timeStr}`;

  // 设置年级段和用时信息
  const grade = state.lastReport?.grade || els.stageSelect?.value || "未知年级";
  const totalSeconds = report.totalSeconds || 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeText = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  sessionInfoEl.textContent = `本次${grade}刷词共用时${timeText}`;

  totalEl.textContent = report.total;
  accuracyEl.textContent = `${accuracyNum}%`;
  fastRateEl.textContent = `${fastNum}%`;

  // 设置正确率颜色
  if (accuracyNum >= 90) {
    accuracyEl.style.color = "#075f3c";
  } else if (accuracyNum >= 80) {
    accuracyEl.style.color = "#d97706";
  } else {
    accuracyEl.style.color = "#dc2626";
  }

  // 设置头部样式
  header.className = "modal-header " + (passed ? "pass" : "fail");
  icon.textContent = passed ? "🎉" : "💪";
  title.textContent = passed ? "恭喜，已通过！" : "继续加油！";

  // 设置结果提示
  if (passed) {
    resultEl.className = "modal-result pass";
    resultEl.innerHTML = "✅ 正确率 90% 以上，已通过！<br>📸 请截图发给代老师或学长学姐";
  } else {
    resultEl.className = "modal-result fail";
    resultEl.innerHTML = "❌ 正确率未达 90%，请再来一遍！<br>🎯 达到 90% 后再截图发给代老师或学长学姐";
  }

  // 按钮事件
  const closeModal = () => { modal.hidden = true; };
  closeBtn.onclick = closeModal;
  againBtn.disabled = !report.wrongWordIds?.length;
  againBtn.textContent = report.wrongWordIds?.length ? "再练一遍" : "本轮没有错词";
  againBtn.onclick = () => {
    if (!report.wrongWordIds?.length) return;
    closeModal();
    startSession({ wordIds: report.wrongWordIds, grade: report.grade, notice: "仅练本轮新增错词。" });
  };
  nextBtn.onclick = () => { closeModal(); els.trainingScope.value = "smart"; startSession(); };

  modal.hidden = false;
}

function getBattleWords(stage) {
  return state.words.filter((word) => stageMatches(word, stage) && word.en && word.zh);
}

function buildBattleQueue() {
  const words = getBattleWords(els.battleStage.value);
  const sizeValue = els.battleSize.value;
  const size = sizeValue === "all" ? words.length : Math.min(Number(sizeValue), words.length);
  return shuffle(words).slice(0, size);
}

async function startBattle() {
  const stage = els.battleStage.value;
  try {
    els.battleStatus.textContent = stageLoadMessage(stage);
    await ensureStageLoaded(stage);
    await loadState();
  } catch (error) {
    els.battleStatus.textContent = stageLoadMessage(stage, true);
    return;
  }
  const queue = buildBattleQueue();
  if (!queue.length) {
    els.battleStatus.textContent = "当前年级没有可对战单词，请换一个年级或先导入词库。";
    return;
  }
  state.battle = {
    queue,
    total: queue.length,
    current: null,
    done: 0,
    skipped: 0,
    mode: els.battleMode.value,
    scores: { left: 0, right: 0 },
    playerLocked: { left: false, right: false },
    choices: [],
    answered: false
  };
  els.skipBattleBtn.disabled = false;
  nextBattleWord();
}

function nextBattleWord() {
  const battle = state.battle;
  if (!battle) return;
  battle.current = battle.queue.shift();
  battle.answered = false;
  battle.playerLocked = { left: false, right: false };
  if (!battle.current) return finishBattle();

  const isPromptChinese = battle.mode === "zhToEnChoice";
  battle.choices = makeBattleChoices(battle.current);
  els.battlePrompt.textContent = isPromptChinese ? battle.current.zh : battle.current.en;
  els.battleHint.textContent = isPromptChinese ? "看中文，抢选正确英文。" : "看英文，抢选正确中文。";
  els.battleStatus.textContent = "本题开始，左右双方各自点击答案。";
  renderBattleScore();
  renderBattleChoices("left");
  renderBattleChoices("right");
}

function makeBattleChoices(answer) {
  const mode = state.battle?.mode || "enToZhChoice";
  const stagePool = getBattleWords(els.battleStage.value).filter((word) => word.id !== answer.id);
  const fallbackPool = state.words.filter((word) => word.id !== answer.id && word.en && word.zh);
  const distractors = selectRankedDistractors(answer, 3, mode, uniqueById([...stagePool, ...fallbackPool]));
  return shuffle(buildChoiceSet(answer, distractors, mode));
}

function renderBattleChoices(player) {
  const battle = state.battle;
  const container = player === "left" ? els.leftBattleChoices : els.rightBattleChoices;
  container.innerHTML = "";
  battle.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "battle-choice";
    button.type = "button";
    button.dataset.wordId = choice.id;
    button.innerHTML = `<span>${CHOICE_KEYS[index]}</span><strong>${escapeHtml(battle.mode === "zhToEnChoice" ? choice.en : choice.zh)}</strong>`;
    button.addEventListener("click", () => answerBattle(player, choice, button));
    container.append(button);
  });
}

function answerBattle(player, choice, button) {
  const battle = state.battle;
  if (!battle || battle.answered || battle.playerLocked[player]) return;
  const isCorrect = choice.id === battle.current.id;
  if (!isCorrect) {
    battle.playerLocked[player] = true;
    button.classList.add("wrong");
    [...(player === "left" ? els.leftBattleChoices : els.rightBattleChoices).children].forEach((item) => {
      item.disabled = true;
    });
    els.battleStatus.textContent = `${player === "left" ? "左方" : "右方"}点错，本题不扣分，另一方还能继续答。`;
    if (battle.playerLocked.left && battle.playerLocked.right) {
      els.battleStatus.textContent = "双方本题都点错了，可以跳过进入下一题。";
    }
    return;
  }
  battle.answered = true;
  battle.scores[player] += 1;
  battle.done += 1;
  markBattleResolved(player);
  renderBattleScore();
  els.battleStatus.textContent = `${player === "left" ? "左方" : "右方"}抢答正确，得 1 分。`;
  setTimeout(nextBattleWord, 900);
}

function markBattleResolved(winner) {
  ["left", "right"].forEach((player) => {
    const container = player === "left" ? els.leftBattleChoices : els.rightBattleChoices;
    [...container.children].forEach((button) => {
      button.disabled = true;
      if (button.dataset.wordId === state.battle.current.id) button.classList.add("correct");
      if (player === winner && button.dataset.wordId === state.battle.current.id) button.classList.add("winner");
    });
  });
}

function skipBattleWord() {
  if (!state.battle?.current) return;
  state.battle.done += 1;
  state.battle.skipped += 1;
  els.battleStatus.textContent = "已跳过本题。";
  nextBattleWord();
}

function renderBattleScore() {
  const battle = state.battle;
  els.leftBattleScore.textContent = battle?.scores.left || 0;
  els.rightBattleScore.textContent = battle?.scores.right || 0;
  els.battleProgress.textContent = battle ? `题号 ${Math.min(battle.done + 1, battle.total)}/${battle.total}` : "请选择年级后开始";
}

async function finishBattle() {
  const battle = state.battle;
  const left = battle.scores.left;
  const right = battle.scores.right;
  const result = left === right ? "平局" : left > right ? "左方获胜" : "右方获胜";
  els.battlePrompt.textContent = result;
  els.battleHint.textContent = `最终比分 左方 ${left} : ${right} 右方`;
  els.battleStatus.textContent = `对战结束：${result}。本模式不会写入个人练习记录。`;
  const skipText = battle.skipped > 0 ? `（跳过 ${battle.skipped} 题）` : "";
  els.battleProgress.textContent = `完成 ${battle.total} 题${skipText}`;
  els.leftBattleChoices.innerHTML = "";
  els.rightBattleChoices.innerHTML = "";
  els.skipBattleBtn.disabled = true;

  state.battle = null;
}

function resetBattle() {
  state.battle = null;
  els.leftBattleScore.textContent = "0";
  els.rightBattleScore.textContent = "0";
  els.battleProgress.textContent = "请选择年级后开始";
  els.battlePrompt.textContent = "Ready?";
  els.battleHint.textContent = "左右两边各自点击答案，先点对的一方得分。";
  els.battleStatus.textContent = "对战结果不会写入个人练习记录。";
  els.leftBattleChoices.innerHTML = "";
  els.rightBattleChoices.innerHTML = "";
  els.skipBattleBtn.disabled = true;
}

function getQuizSentenceData(grade) {
  if (grade === "初一课内词汇" || grade === "初一考试词汇") return window.WORD_SNAP_GRADE7_QUIZ_SENTENCES || [];
  if (grade === "初二课内词汇" || grade === "初二考试词汇") return window.WORD_SNAP_GRADE8_QUIZ_SENTENCES || [];
  if (grade === "初三课内词汇" || grade === "初三考试词汇") return window.WORD_SNAP_QUIZ_SENTENCES || [];
  if (grade === "高一课内词汇" || grade === "高一考试词汇" || grade === "高一课改词库") return window.WORD_SNAP_GRADE10_QUIZ_SENTENCES || [];
  if (grade === "高二课内词汇" || grade === "高二考试词汇") return window.WORD_SNAP_GRADE11_QUIZ_SENTENCES || [];
  return [];
}

function loadScriptOnce(src) {
  return loadScriptWithRetry(src);
}

async function ensureQuizBankLoaded(grade) {
  if (getQuizSentenceData(grade).length) return true;
  const src = QUIZ_BANK_SCRIPTS[grade];
  if (!src) return false;
  els.quizStatusText.textContent = `正在加载${grade}刷题题库...`;
  try {
    await loadScriptOnce(src);
    return true;
  } catch (error) {
    els.quizStatusText.textContent = `${grade}刷题题库加载失败，请刷新重试，或使用备用入口：${BACKUP_SITE_URL}`;
    return false;
  }
}

function getExpectedQuizCount(grade) {
  if (grade === "初一课内词汇" || grade === "初一考试词汇") return GRADE7_QUIZ_COUNT;
  if (grade === "初二课内词汇" || grade === "初二考试词汇") return GRADE8_QUIZ_COUNT;
  if (grade === "初三课内词汇" || grade === "初三考试词汇") return 340;
  if (grade === "高一课内词汇" || grade === "高一考试词汇" || grade === "高一课改词库") return GRADE10_QUIZ_COUNT;
  if (grade === "高二课内词汇" || grade === "高二考试词汇") return GRADE11_QUIZ_COUNT;
  return 0;
}

function getQuizBankTotal(grade) {
  const sentenceTotal = getQuizSentenceData(grade).length;
  if (sentenceTotal) return sentenceTotal;
  const expectedTotal = getExpectedQuizCount(grade);
  if (expectedTotal) return expectedTotal;
  return generateWordQuiz(grade).length;
}

function getQuizWrongCount(grade) {
  return [...state.quizWrongRecords.values()].filter((record) => {
    if (record.grade) return record.grade === grade;
    if (grade === "初一课内词汇" || grade === "初一考试词汇") return String(record.questionId || "").startsWith("g7-");
    if (grade === "初二课内词汇" || grade === "初二考试词汇") return String(record.questionId || "").startsWith("g8-");
    if (grade === "初三课内词汇" || grade === "初三考试词汇") return String(record.questionId || "").startsWith("g9-");
    if (grade === "高一课内词汇" || grade === "高一考试词汇" || grade === "高一课改词库") return String(record.questionId || "").startsWith("g10-");
    if (grade === "高二课内词汇" || grade === "高二考试词汇") return String(record.questionId || "").startsWith("g11-");
    if (grade === "高三考试词汇") return String(record.questionId || "").startsWith("g12-");
    return false;
  }).length;
}

function renderQuizStats() {
  const grade = els.quizStage.value;
  const stats = state.quizStats.get(grade) || { attempted: 0, correct: 0, fast: 0 };
  els.quizBankTotal.textContent = getQuizBankTotal(grade);
  els.quizDoneCount.textContent = stats.attempted || 0;
  els.quizAccuracy.textContent = percent(stats.correct || 0, stats.attempted || 0);
  els.quizFastRate.textContent = percent(stats.fast || 0, stats.attempted || 0);
  els.quizWrongCount.textContent = getQuizWrongCount(grade);
}

function renderTrainQuizStats() {
  // Quiz stats display removed from home page - function kept for compatibility
}

async function recordQuizAnswer(q, isCorrect, isFast) {
  const grade = state.quiz?.grade || q.grade || els.quizStage.value;
  const stats = state.quizStats.get(grade) || { attempted: 0, correct: 0, fast: 0 };
  stats.attempted += 1;
  stats.correct += isCorrect ? 1 : 0;
  stats.fast += isCorrect && isFast ? 1 : 0;
  state.quizStats.set(grade, stats);
  await put("meta", { key: `quizStats:${grade}`, value: stats, at: Date.now() });
  await recordDailyActivity("quiz", grade);
  renderQuizStats();
  renderTrainQuizStats();
}

function generateWordQuiz(grade) {
  const words = state.words.filter((word) => stageMatches(word, grade) && word.en && word.zh);
  if (!words.length) return [];
  return words
    .filter((w) => w.en && w.zh)
    .map((w, i) => ({ id: `w-${grade}-${i}`, sentence: w.zh, answer: w.en, type: "word" }));
}

async function updateQuizSizeOptions() {
  const grade = els.quizStage.value;
  const sel = els.quizSize;
  const prev = sel.value;
  sel.innerHTML = "";
  await ensureQuizBankLoaded(grade);
  const sentenceQuizTotal = getQuizSentenceData(grade).length;
  const expectedQuizTotal = getExpectedQuizCount(grade);
  if (expectedQuizTotal && sentenceQuizTotal !== expectedQuizTotal) {
    sel.innerHTML = `<option value="all">暂无${grade}题库</option>`;
  } else if (sentenceQuizTotal) {
    const opts = [];
    if (sentenceQuizTotal > 50) opts.push('<option value="50" selected>50 题</option>');
    if (sentenceQuizTotal > 100) opts.push('<option value="100">100 题</option>');
    if (sentenceQuizTotal > 150) opts.push('<option value="150">150 题</option>');
    opts.push(`<option value="all">全部 ${sentenceQuizTotal} 题</option>`);
    sel.innerHTML = opts.join("");
  } else {
    const total = state.words.filter((word) => stageMatches(word, grade) && word.en && word.zh).length;
    const opts = [];
    if (total > 50) opts.push('<option value="50" selected>50 词</option>');
    if (total > 100) opts.push('<option value="100">100 词</option>');
    if (total > 150) opts.push('<option value="150">150 词</option>');
    opts.push(`<option value="all">全部 ${total} 词</option>`);
    sel.innerHTML = opts.join("");
  }
  renderQuizStats();
}

function getQuizDistractorsForSentence(answer, vocabPool) {
  const pool = [];
  const used = new Set([answer.toLowerCase()]);
  const firstLetter = answer[0].toLowerCase();

  const sameFirst = vocabPool.filter((w) => w.en && w.en[0].toLowerCase() === firstLetter && !used.has(w.en.toLowerCase()));
  shuffle(sameFirst).forEach((w) => {
    if (pool.length < 4) { pool.push(w.en); used.add(w.en.toLowerCase()); }
  });

  if (pool.length < 4) {
    const others = vocabPool.filter((w) => w.en && !used.has(w.en.toLowerCase()));
    shuffle(others).forEach((w) => {
      if (pool.length < 4) { pool.push(w.en); used.add(w.en.toLowerCase()); }
    });
  }

  return shuffle(pool).slice(0, 4);
}

function normalizeQuizChoiceKey(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isQuizAnswerChoice(value, question) {
  return normalizeQuizChoiceKey(value) === normalizeQuizChoiceKey(question.answer);
}

function buildQuizChoices(question, vocabPool) {
  const choices = [];
  const used = new Set();
  const addChoice = (value) => {
    const text = String(value || "").trim();
    const key = normalizeQuizChoiceKey(text);
    if (!key || used.has(key)) return;
    used.add(key);
    choices.push(text);
  };

  (question.options?.length ? question.options : [question.answer, ...getQuizDistractorsForSentence(question.answer, vocabPool)])
    .forEach(addChoice);

  // 固定题库若存在重复选项，先去重，再从同阶段候选词中补足选项数量。
  if (choices.length < 5) {
    getQuizDistractorsForSentence(question.answer, vocabPool).forEach(addChoice);
  }
  if (!choices.some((choice) => isQuizAnswerChoice(choice, question))) addChoice(question.answer);
  const correctChoice = choices.find((choice) => isQuizAnswerChoice(choice, question));
  const distractors = choices.filter((choice) => !isQuizAnswerChoice(choice, question));
  return shuffle([correctChoice, ...distractors]).slice(0, 5);
}

async function startQuiz(isReview) {
  const grade = els.quizStage.value;
  let allData;
  let vocabPool;
  if (state.quiz) {
    clearInterval(state.quiz.timerId);
    clearTimeout(state.quiz.advanceTimerId);
  }
  hideQuizContinueButton();

  await ensureQuizBankLoaded(grade);
  const sentenceQuizData = getQuizSentenceData(grade);
  const expectedQuizTotal = getExpectedQuizCount(grade);
  if (expectedQuizTotal && sentenceQuizData.length !== expectedQuizTotal) {
    els.quizStatusText.textContent = `${grade}题库应为 ${expectedQuizTotal} 题，当前未正确加载。请刷新页面后再试。`;
    return;
  }

  if (sentenceQuizData.length) {
    allData = sentenceQuizData;
    vocabPool = sentenceQuizData
      .flatMap((q) => q.options?.length ? q.options : [q.answer])
      .filter(Boolean)
      .map((en, index) => ({ id: `quiz-${grade}-${index}`, en, zh: "" }));
  } else {
    try {
      await ensureStageLoaded(grade);
      await loadState();
    } catch (error) {
      els.quizStatusText.textContent = stageLoadMessage(grade, true);
      return;
    }
    allData = generateWordQuiz(grade);
    vocabPool = state.words.filter((word) => stageMatches(word, grade) && word.en && word.zh);
  }

  if (!allData.length) {
    els.quizStatusText.textContent = "暂无题目数据。";
    return;
  }

  let queue;
  if (isReview) {
    const wrongIds = [...state.quizWrongRecords.keys()];
    queue = allData.filter((q) => wrongIds.includes(q.id));
    if (!queue.length) {
      els.quizStatusText.textContent = "没有错题，无需复盘。";
      return;
    }
    queue = shuffle(queue);
  } else {
    const rotationKey = buildQuizRotationKey(grade);
    const prepared = prepareRotationBatch(
      state.rotationQueues.get(rotationKey),
      allData.map((question) => question.id),
      els.quizSize.value
    );
    await persistRotationState(rotationKey, prepared.state);
    const questionsById = new Map(allData.map((question) => [question.id, question]));
    queue = prepared.batch.map((id) => questionsById.get(id)).filter(Boolean);
  }

  state.quiz = {
    queue,
    vocabPool,
    grade,
    total: queue.length,
    done: 0,
    correct: 0,
    fast: 0,
    slow: 0,
    wrongList: [],
    isReview,
    rotationKey: isReview ? null : buildQuizRotationKey(grade),
    sessionStartedAt: performance.now(),
    currentQ: null,
    currentIndex: 0,
    startedAt: 0,
    timerId: 0,
    advanceTimerId: 0,
    answered: false
  };

  els.quizArea.hidden = false;
  els.quizReport.hidden = true;
  els.quizReport.innerHTML = "";
  els.quizStatusText.textContent = isReview ? `错题复盘模式：${queue.length} 题` : `${grade} 刷题模式：${queue.length} 题`;
  nextQuizQuestion();
}

function nextQuizQuestion() {
  const quiz = state.quiz;
  if (!quiz) return;
  clearTimeout(quiz.advanceTimerId);
  clearInterval(quiz.timerId);
  quiz.advanceTimerId = 0;
  quiz.timerId = 0;
  hideQuizContinueButton();
  quiz.answered = false;
  quiz.currentQ = quiz.queue.shift();

  if (!quiz.currentQ) return finishQuiz();
  quiz.currentIndex = quiz.done + 1;

  const q = quiz.currentQ;
  const allChoices = buildQuizChoices(q, quiz.vocabPool);

  els.quizTag.textContent = `第 ${quiz.done + 1}/${quiz.total} 题`;
  els.quizSentence.textContent = q.sentence;
  els.quizHint.textContent = q.type === "word" ? "选择正确的英文单词" : q.type === "multiple-choice" ? "选择最佳答案" : `首字母：${q.answer[0]}`;
  els.quizFeedback.textContent = "计时中。";
  els.quizChoices.innerHTML = "";

  allChoices.forEach((word, index) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.dataset.isCorrect = isQuizAnswerChoice(word, q) ? "1" : "0";
    const key = document.createElement("span");
    key.className = "choice-key";
    key.textContent = CHOICE_KEYS[index];
    const text = document.createElement("span");
    text.className = "choice-text";
    text.textContent = word;
    button.append(key, text);
    button.addEventListener("click", () => answerQuizChoice(isQuizAnswerChoice(word, q), button));
    els.quizChoices.append(button);
  });

  quiz.startedAt = performance.now();
  startQuizTimer();
  updateQuizProgress();
}

function hideQuizContinueButton() {
  els.quizContinueBtn.hidden = true;
}

function showQuizContinueButton() {
  const quiz = state.quiz;
  els.quizContinueBtn.textContent = quiz?.queue.length ? "继续做题" : "查看结果";
  els.quizContinueBtn.hidden = false;
  els.quizContinueBtn.focus();
}

function startQuizTimer() {
  clearInterval(state.quiz.timerId);
  els.quizTimer.classList.remove("fast", "slow");
  els.quizTimer.textContent = "用时 0.0 秒 · 5 秒内算快题，超过 12 秒记慢题";
  state.quiz.timerId = setInterval(() => {
    const elapsed = performance.now() - state.quiz.startedAt;
    els.quizTimer.textContent = `用时 ${(elapsed / 1000).toFixed(1)} 秒 · 5 秒内算快题，超过 12 秒记慢题`;
    els.quizTimer.classList.toggle("fast", elapsed < QUIZ_FAST);
    els.quizTimer.classList.toggle("slow", elapsed > QUIZ_SLOW);
  }, 100);
}

async function answerQuizChoice(isCorrect, button) {
  const quiz = state.quiz;
  if (!quiz || quiz.answered || !quiz.currentQ) return;
  quiz.answered = true;
  clearInterval(quiz.timerId);

  const elapsed = performance.now() - quiz.startedAt;
  const q = quiz.currentQ;
  const isFast = elapsed < QUIZ_FAST;
  const isSlow = elapsed > QUIZ_SLOW && isCorrect;

  quiz.done += 1;
  quiz.correct += isCorrect ? 1 : 0;
  if (isCorrect && isFast) quiz.fast += 1;
  if (isCorrect && isSlow) quiz.slow += 1;
  await recordQuizAnswer(q, isCorrect, isFast);

  els.quizTimer.textContent = `用时 ${(elapsed / 1000).toFixed(2)} 秒`;
  els.quizTimer.classList.toggle("fast", isCorrect && isFast);
  els.quizTimer.classList.toggle("slow", isCorrect && isSlow);

  [...els.quizChoices.children].forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.isCorrect === "1") btn.classList.add("correct");
  });
  if (!isCorrect) button.classList.add("wrong");

  if (!isCorrect) {
    quiz.wrongList.push(q);
    await saveQuizWrongAnswer(q, button.querySelector(".choice-text").textContent);
  } else if (quiz.isReview) {
    await removeQuizWrongAnswer(q.id);
  }
  await completePersistentRotationItem(quiz.rotationKey, q.id);
  renderAllDebounced();

  if (isCorrect && isFast) {
    els.quizFeedback.textContent = "秒选！";
  } else if (isCorrect && isSlow) {
    els.quizFeedback.textContent = "正确（慢题）";
  } else if (isCorrect) {
    els.quizFeedback.textContent = "正确！";
  } else {
    els.quizFeedback.textContent = `错误！正确答案：${q.answer}`;
  }

  updateQuizProgress();
  pulseQuizProgress();
  if (isCorrect) {
    quiz.advanceTimerId = setTimeout(nextQuizQuestion, 500);
  } else {
    showQuizContinueButton();
  }
}

function updateQuizProgress() {
  const quiz = state.quiz;
  if (!quiz) return;
  const current = getQuizProgressValue(quiz);
  els.quizProgressText.textContent = `题号 ${current}/${quiz.total}`;
  els.quizProgressBar.style.width = `${Math.round((current / quiz.total) * 100)}%`;
}

function getQuizProgressValue(quiz) {
  if (!quiz.total) return 0;
  if (quiz.done >= quiz.total) return quiz.total;
  return Math.max(quiz.currentIndex || 1, quiz.done);
}

function pulseQuizProgress() {
  els.quizProgressBar.classList.remove("quiz-progress-pulse");
  void els.quizProgressBar.offsetWidth;
  els.quizProgressBar.classList.add("quiz-progress-pulse");
  window.setTimeout(() => els.quizProgressBar.classList.remove("quiz-progress-pulse"), 260);
}

async function saveQuizWrongAnswer(q, userAnswer) {
  const existing = state.quizWrongRecords.get(q.id);
  const record = {
    questionId: q.id,
    grade: state.quiz?.grade || q.grade || els.quizStage.value,
    sentence: q.sentence,
    answer: q.answer,
    wrongCount: (existing?.wrongCount || 0) + 1,
    lastWrongAt: Date.now(),
    userAnswer
  };
  state.quizWrongRecords.set(q.id, record);
  await put("quizWrongAnswers", record);
  renderQuizStats();
}

async function removeQuizWrongAnswer(qId) {
  state.quizWrongRecords.delete(qId);
  await new Promise((resolve, reject) => {
    const request = tx("quizWrongAnswers", "readwrite").delete(qId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  renderQuizStats();
}

async function finishQuiz() {
  const quiz = state.quiz;
  clearInterval(quiz.timerId);
  clearTimeout(quiz.advanceTimerId);
  hideQuizContinueButton();
  const totalSeconds = Math.max(1, Math.round((performance.now() - quiz.sessionStartedAt) / 1000));

  els.quizArea.hidden = true;
  els.quizReport.hidden = false;
  const fastRate = quiz.correct > 0 ? Math.round(quiz.fast / quiz.correct * 100) : 0;
  els.quizReport.innerHTML = `
    <div class="session-report-card"><strong>${quiz.total}</strong><span>总题数</span></div>
    <div class="session-report-card"><strong>${percent(quiz.correct, quiz.total)}</strong><span>正确率</span></div>
    <div class="session-report-card"><strong>${fastRate}%</strong><span>快题率</span></div>
    <div class="session-report-card"><strong>${formatDuration(totalSeconds)}</strong><span>总用时</span></div>
    <div class="session-report-card"><strong>${quiz.correct}</strong><span>正确</span></div>
    <div class="session-report-card"><strong>${quiz.wrongList.length}</strong><span>错误</span></div>
    <div class="session-report-card"><strong>${quiz.fast}</strong><span>快题</span></div>
    <div class="session-report-card"><strong>${quiz.slow}</strong><span>慢题</span></div>
    <button id="quizAgainBtn" type="button">${quiz.wrongList.length ? "错题复盘" : "再刷一次"}</button>
    <button id="quizNewBtn" type="button" class="secondary">重新开始</button>
  `;

  document.querySelector("#quizAgainBtn").addEventListener("click", () => {
    if (quiz.wrongList.length) startQuiz(true);
    else startQuiz(false);
  });
  document.querySelector("#quizNewBtn").addEventListener("click", () => startQuiz(false));

  els.quizStatusText.textContent = quiz.isReview
    ? `复盘完成！正确率 ${percent(quiz.correct, quiz.total)}。`
    : `刷题完成！正确率 ${percent(quiz.correct, quiz.total)}，错题 ${quiz.wrongList.length} 道。`;

  state.quiz = null;
  renderQuizWrongList();
}

function renderQuizWrongList() {
  const wrongs = [...state.quizWrongRecords.values()].sort((a, b) => b.lastWrongAt - a.lastWrongAt);
  if (!wrongs.length) {
    els.quizWrongList.innerHTML = "<p class='status-text'>暂无错题记录。完成一轮刷题后这里会显示答错的题目。</p>";
    return;
  }
  els.quizWrongList.innerHTML = wrongs.map((r) => `
    <div class="quiz-wrong-item">
      <div class="quiz-wrong-header">
        <span>错 ${r.wrongCount} 次 · 正确答案: <strong>${escapeHtml(r.answer)}</strong></span>
        <button type="button" class="secondary danger quiz-wrong-delete" data-delete-wrong="${escapeAttr(r.questionId)}">删除</button>
      </div>
      <span class="quiz-wrong-sentence">${escapeHtml(r.sentence)}</span>
    </div>
  `).join("");
}

function updateProgress() {
  const session = state.session;
  if (!session) return;
  const currentNo = session.current && !session.answered ? Math.min(session.done + 1, session.total) : session.done;
  els.progressText.textContent = `题号 ${currentNo}/${session.total}`;
  els.progressBar.style.width = `${Math.round((session.done / session.total) * 100)}%`;
}

function percent(value, total) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizeEnglish(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeChinese(value) {
  return String(value || "").replace(/[，。；;、\s]/g, "").trim();
}

function parseWordsFromText(text) {
  const rows = [];
  const seen = new Set();
  String(text || "").split(/\n|;/).forEach((raw) => {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || isSectionHeader(line)) return;
    const pipeParts = line.split("|").map((part) => part.trim());
    if (pipeParts.length >= 2 && /^[A-Za-z][A-Za-z'-]{0,24}$/.test(pipeParts[0])) {
      const en = pipeParts[0].toLowerCase();
      if (!seen.has(en) && !COMMON_NOISE.has(en)) {
        seen.add(en);
        rows.push({ en, zh: pipeParts[1] || "", pos: pipeParts[2] || "", notes: pipeParts.slice(3).join(" | ") });
      }
      return;
    }
    const compactMatch = matchCompactWordLine(line);
    const match = compactMatch || line.match(/^([A-Za-z][A-Za-z'-]{0,24})\s*(?:\(([^)]{1,12})\)|\b(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.)\b)?\s*[:：\-—]?\s*(.*)$/i);
    if (!match) return;
    const en = match[1].toLowerCase();
    if (seen.has(en) || COMMON_NOISE.has(en)) return;
    seen.add(en);
    const pos = (match[2] || match[3] || "").trim();
    const rest = (match[4] || "").trim();
    const zhMatch = rest.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5，、；;（）() ]{0,50}/);
    rows.push({ en, zh: zhMatch ? zhMatch[0].trim() : "", pos, notes: rest.slice(0, 120) });
  });
  return rows;
}

function isSectionHeader(line) {
  return /^[A-Z](?:-[A-Z])?$/.test(line);
}

function matchCompactWordLine(line) {
  const match = line.match(/^([A-Za-z][A-Za-z'-]{0,24})([\u4e00-\u9fff].*)$/);
  if (!match) return null;
  return [match[0], match[1], "", "", match[2]];
}

const COMMON_NOISE = new Set(["the", "and", "for", "with", "from", "this", "that", "page", "unit", "name", "class"]);

function sanitizeRows(rows) {
  const seen = new Set();
  return rows.map((row) => ({
    en: String(row.en || "").trim().toLowerCase(),
    zh: String(row.zh || "").trim(),
    pos: String(row.pos || "").trim(),
    notes: String(row.notes || "").trim(),
    confidence: Number(row.confidence || 0)
  })).filter((row) => {
    if (!/^[a-z][a-z'-]{1,24}$/.test(row.en)) return false;
    if (seen.has(row.en) || COMMON_NOISE.has(row.en)) return false;
    seen.add(row.en);
    return true;
  });
}

function renderReviewRows() {
  els.reviewBody.innerHTML = "";
  state.reviewRows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input data-field="en" data-index="${index}" value="${escapeAttr(row.en)}"></td>
      <td><input data-field="zh" data-index="${index}" value="${escapeAttr(row.zh)}"></td>
      <td><input data-field="pos" data-index="${index}" value="${escapeAttr(row.pos)}"></td>
      <td><input data-field="notes" data-index="${index}" value="${escapeAttr(row.notes)}"></td>
      <td><button type="button" class="secondary danger" data-remove="${index}">删除</button></td>
    `;
    els.reviewBody.append(tr);
  });
}

function syncReviewRowsFromDom() {
  els.reviewBody.querySelectorAll("input").forEach((input) => {
    const index = Number(input.dataset.index);
    state.reviewRows[index][input.dataset.field] = input.value.trim();
  });
}

async function saveReviewDeck() {
  syncReviewRowsFromDom();
  const stage = els.uploadStage.value;
  const source = els.sourceName.value.trim() || "自定义词库";
  const createdAt = Date.now();
  const rows = state.reviewRows.filter((row) => row.en.trim()).map((row, index) => ({
    id: `custom-${createdAt}-${index}-${row.en.toLowerCase()}`,
    en: row.en.trim(),
    zh: row.zh.trim() || "待补充中文",
    pos: row.pos.trim(),
    notes: row.notes.trim(),
    grade: stage,
    goals: stage.includes("考") ? [stage] : [stage],
    source,
    sourceType: "custom",
    frequency: 0,
    createdAt,
    order: index + 1
  }));
  if (!rows.length) {
    els.importStatus.textContent = "没有可保存的英文词条。";
    return;
  }
  await putBatch("words", rows);
  state.reviewRows = [];
  els.reviewPanel.hidden = true;
  els.textImport.value = "";
  els.importStatus.textContent = `已保存 ${rows.length} 个词到 ${stage}。`;
  await loadState();
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

function renderAll() {
  const active = getActiveView();
  renderStats();
  renderDailyProgress();
  if (active === "train") {
    updateSessionSizeOptions();
    renderTrainQuizStats();
    updateTrainingEstimate();
  }
  if (active === "quiz") {
    renderQuizStats();
  }
  if (active === "decks") {
    renderDecks();
  }
  if (active === "wrong") {
    renderWeakList();
  }
  if (active === "report") {
    renderReport();
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

function renderDecks() {
  const groups = new Map();
  state.words.forEach((word) => {
    const key = `${word.sourceType}|${word.source}|${word.grade}`;
    if (!groups.has(key)) groups.set(key, { ...word, count: 0 });
    groups.get(key).count += 1;
  });
  if (!groups.size) {
    els.deckList.innerHTML = "<p class='status-text'>还没有词库。</p>";
    return;
  }
  els.deckList.innerHTML = [...groups.values()].sort((a, b) => a.grade.localeCompare(b.grade, "zh")).map((deck) => `
    <div class="deck-card">
      <strong>${escapeHtml(deck.source)}</strong>
      <p class="meta">${deck.grade} · ${deck.sourceType === "builtin" ? "内置词库" : "自定义词库"} · ${deck.count} 词</p>
    </div>
  `).join("");
}

function renderWeakList() {
  els.weakFilterBtns.forEach((button) => {
    button.classList.toggle("active", button.dataset.weakFilter === state.weakFilter);
  });
  const isTarget = state.weakFilter === "slow" ? isSlowWord : isWrongWord;
  const label = state.weakFilter === "slow" ? "慢词" : "错词";
  const words = state.words.filter(isTarget).sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 120);
  if (!words.length) {
    els.weakList.innerHTML = `<p class='status-text'>还没有${label}。完成一轮训练后这里会自动更新。</p>`;
    return;
  }
  els.weakList.innerHTML = words.map((word) => {
    const record = getRecord(word.id);
    const countText = state.weakFilter === "slow" ? `慢 ${record.slow}` : `错 ${record.wrong}`;
    return `<div class="word-chip">
      <strong>${escapeHtml(word.en)}</strong>
      <span>${escapeHtml(word.zh)} · ${word.grade}</span><br>
      <span>${countText} · 掌握 ${record.mastery}%</span>
    </div>`;
  }).join("");
}

function renderReport() {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = todayStart.getTime();
  const stageStats = new Map();
  STAGES.forEach((stage) => stageStats.set(stage, { stage, total: 0, practiced: 0, mastered: 0 }));
  let due = 0;
  let todaySeen = 0;
  let todayCorrect = 0;
  const seenWords = [];
  for (const word of state.words) {
    const record = state.records.get(word.id);
    if (!record) continue;
    for (const stage of STAGES) {
      if (stageMatches(word, stage)) {
        const stat = stageStats.get(stage);
        stat.total += 1;
        if (record.seen > 0) stat.practiced += 1;
        if (record.mastery >= 80) stat.mastered += 1;
      }
    }
    if (record.seen > 0) {
      if (record.nextReviewAt <= now) due += 1;
      seenWords.push(word);
    }
    if (record.lastSeenAt >= todayTs) {
      todaySeen += record.seen;
      todayCorrect += record.correct;
    }
  }
  const byStage = [...stageStats.values()].filter((item) => item.total > 0);
  seenWords.sort((a, b) => priorityScore(b) - priorityScore(a));
  const topReview = seenWords.slice(0, 10);
  const todayAccuracy = todaySeen > 0 ? percent(todayCorrect, todaySeen) : "—";
  els.reportContent.innerHTML = [
    `<div class="report-card"><strong>${todaySeen}</strong><span>今日练习次数</span></div>`,
    `<div class="report-card"><strong>${todayAccuracy}</strong><span>今日正确率</span></div>`,
    `<div class="report-card"><strong>${due}</strong><span>今日到期复习词</span></div>`,
    `<div class="report-card"><strong>今日最该复习</strong><span>${topReview.length ? topReview.map((word) => `${escapeHtml(word.en)}(${escapeHtml(word.zh)})`).join("、") : "完成一轮训练后生成"}</span></div>`,
    ...byStage.map((item) => `<div class="report-card"><strong>${item.stage}</strong><span>${item.practiced}/${item.total} 已练 · ${item.mastered} 已掌握</span></div>`)
  ].join("");
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
    <div class="session-report-card"><strong>${report.tomorrow}</strong><span>建议明天复习</span></div>
    <button id="againWeakBtn" type="button"${report.wrongWordIds?.length ? "" : " disabled"}>${report.wrongWordIds?.length ? "再练本轮错词" : "本轮没有错词"}</button>
    <button id="nextSessionBtn" type="button" class="secondary">继续下一组</button>
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

async function exportData() {
  const payload = { version: 2, exportedAt: new Date().toISOString(), words: state.words, records: [...state.records.values()] };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `秒懂词词库-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  const data = JSON.parse(await file.text());
  const words = Array.isArray(data.words) ? data.words : [];
  const records = Array.isArray(data.records) ? data.records : [];
  const existingIds = new Set(state.words.map((w) => w.id));
  const conflictCount = words.filter((w) => existingIds.has(w.id)).length;
  if (conflictCount > 0 && !confirm(`导入的词库中有 ${conflictCount} 个词与已有词库 ID 重复，将被覆盖。确定继续？`)) return;
  await putBatch("words", words);
  await putBatch("records", records);
  await loadState();
  els.importStatus.textContent = `已导入 ${words.length} 个词、${records.length} 条记录。${conflictCount > 0 ? `（覆盖 ${conflictCount} 条）` : ""}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
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
  els.skipBtn.addEventListener("click", skipWord);
  els.trainContinueBtn.addEventListener("click", nextWord);

  els.parseTextBtn.addEventListener("click", () => {
    state.reviewRows = parseWordsFromText(els.textImport.value);
    if (!state.reviewRows.length) state.reviewRows = [{ en: "", zh: "", pos: "", notes: "" }];
    renderReviewRows();
    els.reviewPanel.hidden = false;
    els.importStatus.textContent = `从文字中解析到 ${state.reviewRows.length} 条候选词，请确认后保存。`;
  });
  els.addRowBtn.addEventListener("click", () => {
    syncReviewRowsFromDom();
    state.reviewRows.push({ en: "", zh: "", pos: "", notes: "" });
    renderReviewRows();
  });
  els.reviewBody.addEventListener("click", (event) => {
    const remove = event.target.dataset.remove;
    if (remove === undefined) return;
    syncReviewRowsFromDom();
    state.reviewRows.splice(Number(remove), 1);
    renderReviewRows();
  });
  els.saveDeckBtn.addEventListener("click", saveReviewDeck);
  els.clearCustomDecksBtn.addEventListener("click", async () => {
    if (!confirm("确定清空所有自定义词库吗？内置词库和练习记录会保留。")) return;
    await deleteWordsBySourceType("custom");
    await loadState();
  });
  els.resetRecordsBtn.addEventListener("click", async () => {
    if (!confirm(`确定清空所有练习记录吗？词库会保留，${els.stageSelect.value}的刷词火花将从 0 开始。`)) return;
    await clearStore("records");
    await resetStreak("train", els.stageSelect.value);
    await loadState();
  });
  els.exportBtn.addEventListener("click", exportData);
  els.startBattleBtn.addEventListener("click", startBattle);
  els.resetBattleBtn.addEventListener("click", resetBattle);
  els.skipBattleBtn.addEventListener("click", skipBattleWord);
  [els.battleStage, els.battleSize, els.battleMode].forEach((el) => {
    el.addEventListener("change", resetBattle);
  });
  els.weakFilterBtns.forEach((button) => {
    button.addEventListener("click", () => {
      state.weakFilter = button.dataset.weakFilter;
      renderWeakList();
    });
  });
  els.trainWeakBtn.addEventListener("click", () => {
    switchView("train");
    els.trainingScope.value = state.weakFilter === "slow" ? "slow" : "wrong";
    els.sessionSize.value = "all";
    startSession();
  });
  els.importJson.addEventListener("change", () => {
    const file = els.importJson.files?.[0];
    if (file) importData(file);
  });
  els.startQuizBtn.addEventListener("click", () => startQuiz(false));
  els.reviewQuizWrongBtn.addEventListener("click", () => startQuiz(true));
  els.quizContinueBtn.addEventListener("click", nextQuizQuestion);
  els.quizStage.addEventListener("change", async () => {
    await updateQuizSizeOptions();
    renderAll();
  });
  els.clearQuizWrongBtn.addEventListener("click", async () => {
    if (!confirm(`确定清空所有刷题错题记录吗？${els.quizStage.value}的刷题火花将从 0 开始。`)) return;
    await clearStore("quizWrongAnswers");
    await resetStreak("quiz", els.quizStage.value);
    state.quizWrongRecords.clear();
    renderQuizStats();
    renderQuizWrongList();
  });
  els.quizWrongList.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-delete-wrong]");
    if (!btn) return;
    const qId = btn.dataset.deleteWrong;
    await removeQuizWrongAnswer(qId);
    renderQuizWrongList();
  });
  document.addEventListener("keydown", (event) => {
    if (els.views.train.classList.contains("active") && state.session && !state.session.answered) {
      if (state.session.mode === "enToZhChoice" || state.session.mode === "zhToEnChoice" || state.session.mode === "customChoice") {
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
  if (state.quiz?.timerId) { clearInterval(state.quiz.timerId); state.quiz.timerId = 0; }
  if (state.quiz?.advanceTimerId) { clearTimeout(state.quiz.advanceTimerId); state.quiz.advanceTimerId = 0; }
}

async function init() {
  bindEvents();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearAllTimers();
  });
  try {
    state.db = await openDb();
    await seedBuiltinWords();
    await ensureStageLoaded(els.stageSelect.value);
    await loadState();
  } catch (error) {
    els.feedback.textContent = `初始化失败：${error.message || error}`;
  }
}

init();
