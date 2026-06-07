const STAGES = ["小学六年级", "初一", "初二", "初三", "高一", "高二", "高三", "中考常考词组总复习", "高考冲刺"];
const DB_NAME = "word-snap-v2";
const DB_VERSION = 3;
const BUILTIN_SEED_VERSION = 14;
const FAST_PICK_LIMIT = 1500;
const SLOW_PICK_LIMIT = 3500;
const CHOICE_KEYS = ["A", "B", "C", "D", "E"];
const QUIZ_FAST = 5000;
const QUIZ_SLOW = 12000;

// 成就定义
const ACHIEVEMENTS = [
  { id: "first_word", name: "初学者", desc: "完成第一个单词", icon: "📚", condition: (s) => s.totalSeen >= 1 },
  { id: "streak_3", name: "三天坚持", desc: "连续打卡3天", icon: "🔥", condition: (s) => s.currentStreak >= 3 },
  { id: "streak_7", name: "一周达人", desc: "连续打卡7天", icon: "⭐", condition: (s) => s.currentStreak >= 7 },
  { id: "streak_14", name: "两周勇士", desc: "连续打卡14天", icon: "💪", condition: (s) => s.currentStreak >= 14 },
  { id: "streak_30", name: "月度冠军", desc: "连续打卡30天", icon: "🏆", condition: (s) => s.currentStreak >= 30 },
  { id: "streak_100", name: "百日传奇", desc: "连续打卡100天", icon: "👑", condition: (s) => s.currentStreak >= 100 },
  { id: "words_50", name: "半百起步", desc: "累计学习50词", icon: "📖", condition: (s) => s.totalSeen >= 50 },
  { id: "words_100", name: "百词斩", desc: "累计学习100词", icon: "💯", condition: (s) => s.totalSeen >= 100 },
  { id: "words_500", name: "词汇达人", desc: "累计学习500词", icon: "📖", condition: (s) => s.totalSeen >= 500 },
  { id: "words_1000", name: "千词王者", desc: "累计学习1000词", icon: "👑", condition: (s) => s.totalSeen >= 1000 },
  { id: "accuracy_90", name: "精准记忆", desc: "单轮正确率达90%", icon: "🎯", condition: (s) => s.bestAccuracy >= 90 },
  { id: "accuracy_100", name: "满分通过", desc: "单轮正确率100%", icon: "🌟", condition: (s) => s.bestAccuracy >= 100 },
  { id: "speed_50", name: "闪电侠", desc: "单轮秒选率达50%", icon: "⚡", condition: (s) => s.bestFastRate >= 50 },
  { id: "speed_80", name: "秒选之王", desc: "单轮秒选率达80%", icon: "⚡", condition: (s) => s.bestFastRate >= 80 },
  { id: "battle_win", name: "对战之王", desc: "赢得一场对战", icon: "🎮", condition: (s) => s.battleWins >= 1 },
  { id: "quiz_100", name: "刷题达人", desc: "累计刷题100道", icon: "📝", condition: (s) => s.totalQuiz >= 100 },
  { id: "night_owl", name: "夜猫子", desc: "在晚上10点后学习", icon: "🦉", condition: (s) => s.isNightOwl },
  { id: "early_bird", name: "早起鸟", desc: "在早上6点前学习", icon: "🐦", condition: (s) => s.isEarlyBird },
];

// 轮转队列系统
const ROTATION_META_PREFIX = "rotation:v2:";
const { prepareRotationBatch, completeRotationItem } = window.WordSnapRotation;

const GRADE8_QUIZ_COUNT = 239;
const GRADE10_QUIZ_COUNT = 153;
const GRADE11_QUIZ_COUNT = 129;
const QUIZ_BANK_SCRIPTS = {
  "初一": "./word-data/quiz-grade7-sentences.js?v=20260524-grade7",
  "初二": "./word-data/quiz-grade8-sentences.js?v=20260525-grade8",
  "初三": "./word-data/quiz-sentences.js?v=20260601-quiz340",
  "高一": "./word-data/quiz-grade10-sentences.js?v=20260530-senior-quiz",
  "高二": "./word-data/quiz-grade11-sentences.js?v=20260530-senior-quiz"
};

const state = {
  db: null,
  words: [],
  records: new Map(),
  rotationQueues: new Map(),
  session: null,
  battle: null,
  quiz: null,
  quizBankLoads: new Map(),
  quizWrongRecords: new Map(),
  quizStats: new Map(),
  reviewRows: [],
  lastReport: null,
  weakFilter: "wrong",
  queueNotice: "",
  // 打卡和成就系统
  streak: {
    key: "daily",
    currentStreak: 0,
    longestStreak: 0,
    lastCheckIn: "",
    totalDays: 0,
    checkInDates: []
  },
  achievements: new Map(),
  stats: {
    totalSeen: 0,
    bestAccuracy: 0,
    bestFastRate: 0,
    battleWins: 0,
    totalQuiz: 0,
    isNightOwl: false,
    isEarlyBird: false
  }
};

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  views: {
    train: document.querySelector("#view-train"),
    battle: document.querySelector("#view-battle"),
    decks: document.querySelector("#view-decks"),
    wrong: document.querySelector("#view-wrong"),
    report: document.querySelector("#view-report"),
    quiz: document.querySelector("#view-quiz"),
    achievements: document.querySelector("#view-achievements")
  },
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
  skipBtn: document.querySelector("#skipBtn"),
  sessionReport: document.querySelector("#sessionReport"),
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
  weakList: document.querySelector("#weakList"),
  weakFilterBtns: [...document.querySelectorAll("[data-weak-filter]")],
  trainWeakBtn: document.querySelector("#trainWeakBtn"),
  resetRecordsBtn: document.querySelector("#resetRecordsBtn"),
  reportContent: document.querySelector("#reportContent")
};

Object.assign(els, {
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
  quizTag: document.querySelector("#quizTag"),
  quizSentence: document.querySelector("#quizSentence"),
  quizHint: document.querySelector("#quizHint"),
  quizTimer: document.querySelector("#quizTimer"),
  quizChoices: document.querySelector("#quizChoices"),
  quizFeedback: document.querySelector("#quizFeedback"),
  quizReport: document.querySelector("#quizReport"),
  quizWrongList: document.querySelector("#quizWrongList")
});

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
      // 打卡和成就系统
      if (!db.objectStoreNames.contains("streaks")) db.createObjectStore("streaks", { keyPath: "key" });
      if (!db.objectStoreNames.contains("achievements")) db.createObjectStore("achievements", { keyPath: "id" });
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

function put(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
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

function slugWord(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "word";
}

function normalizeBuiltinWord(word, index, list) {
  const grade = list.grade || "初三";
  const source = list.source || "初三核心词库";
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
    order: index + 1
  };
}

async function seedBuiltinWords() {
  const seedMeta = await new Promise((resolve) => {
    const request = tx("meta").get("builtinSeedVersion");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  if (Number(seedMeta?.value || 0) >= BUILTIN_SEED_VERSION) return;

  const builtinLists = [
    {
      grade: "初三",
      goals: ["初三"],
      source: "初三核心词库",
      words: window.WORD_SNAP_WORDS || []
    },
    {
      grade: "中考常考词组总复习",
      goals: ["中考常考词组总复习"],
      source: "中考常考词组总复习",
      words: window.WORD_SNAP_PHRASE_REVIEW_WORDS || []
    },
    ...(window.WORD_SNAP_BUILTIN_LISTS || [])
  ];
  const words = builtinLists.flatMap((list) => (list.words || [])
    .map((word, index) => normalizeBuiltinWord(word, index, list))
    .filter((word) => word.en && word.zh));
  if (Number(seedMeta?.value || 0) < 5) {
    await deleteBuiltinDecks([
      { grade: "初三", source: "近五年中考结合最新一模" },
      { grade: "初三", source: "初三核心词库" },
      { grade: "初三", source: "初三刷题词库" }
    ]);
  }
  if (Number(seedMeta?.value || 0) < 6) {
    await deleteBuiltinDecks([
      { grade: "初三", source: "初三核心词库" },
      { grade: "中考常考词组总复习", source: "中考常考词组总复习" }
    ]);
  }
  if (Number(seedMeta?.value || 0) < 8) {
    await deleteBuiltinDecks([
      { grade: "初三", source: "初三核心词库" }
    ]);
  }
  if (Number(seedMeta?.value || 0) < 9) {
    await deleteBuiltinDecks([
      { grade: "高一", source: "高一内置词库" },
      { grade: "高二", source: "高二内置词库" },
      { grade: "高三", source: "高三高频词库" }
    ]);
  }
  if (Number(seedMeta?.value || 0) < 10) {
    await deleteBuiltinDecks([
      { grade: "高一", source: "高一内置词库" },
      { grade: "高二", source: "高二内置词库" }
    ]);
  }
  if (Number(seedMeta?.value || 0) < 13) {
    await deleteBuiltinDecks([
      { grade: "初一", source: "初一内置词库" }
    ]);
  }
  if (Number(seedMeta?.value || 0) < 14) {
    await deleteBuiltinDecks([
      { grade: "初二", source: "初二内置词库" }
    ]);
  }
  if (Number(seedMeta?.value || 0) < 12) {
    await deleteBuiltinDecks([
      { grade: "初一", source: "初一内置词库" }
    ]);
  }
  if (Number(seedMeta?.value || 0) < 11) {
    await deleteBuiltinDecks([
      { grade: "初三", source: "初三核心词库" }
    ]);
  }
  if (Number(seedMeta?.value || 0) < 3) {
    await deleteBuiltinDecks([
      { grade: "高一", source: "高一内置词库" },
      { grade: "高二", source: "高二内置词库" },
      { grade: "高三", source: "高三高频词库" }
    ]);
  }
  const store = tx("words", "readwrite");
  await Promise.all(words.map((word) => new Promise((resolve, reject) => {
    const request = store.put(word);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  })));
  await deleteRecordsForMissingWords(new Set(await getAllKeys("words")));
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

async function loadStreak() {
  const streak = await new Promise((resolve) => {
    const request = tx("streaks").get("daily");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  if (streak) {
    state.streak = streak;
  }
}

async function saveStreak() {
  await put("streaks", state.streak);
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

async function checkIn() {
  const today = getTodayStr();
  if (state.streak.lastCheckIn === today) return false; // 今日已打卡

  const yesterday = getYesterdayStr();
  const isConsecutive = state.streak.lastCheckIn === yesterday;

  state.streak.currentStreak = isConsecutive ? state.streak.currentStreak + 1 : 1;
  state.streak.longestStreak = Math.max(state.streak.longestStreak, state.streak.currentStreak);
  state.streak.totalDays += 1;
  state.streak.lastCheckIn = today;
  state.streak.checkInDates.unshift(today);
  state.streak.checkInDates = state.streak.checkInDates.slice(0, 365);

  await saveStreak();
  showCheckInAnimation();
  await checkAchievements();
  renderCheckinStats();
  return true;
}

function showCheckInAnimation() {
  const btn = document.querySelector("#checkinBtn");
  if (btn) {
    btn.classList.add("checkin-success");
    btn.textContent = "✓ 已打卡";
    btn.disabled = true;
    setTimeout(() => btn.classList.remove("checkin-success"), 1000);
  }
  // 显示 toast 提示
  showToast("🔥 打卡成功！继续保持！");
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

function renderCheckinStats() {
  const streakEl = document.querySelector("#currentStreak");
  const checkinBtn = document.querySelector("#checkinBtn");

  if (streakEl) streakEl.textContent = state.streak.currentStreak;

  // 更新打卡按钮状态
  if (checkinBtn) {
    const today = getTodayStr();
    const isCheckedToday = state.streak.lastCheckIn === today;
    checkinBtn.textContent = isCheckedToday ? "✓" : "打卡";
    checkinBtn.disabled = isCheckedToday;
  }
}

// ============ 成就系统 ============

async function loadAchievements() {
  const achievements = await getAll("achievements");
  state.achievements = new Map(achievements.map((a) => [a.id, a]));
}

async function saveAchievement(achievement) {
  await put("achievements", achievement);
  state.achievements.set(achievement.id, achievement);
}

async function checkAchievements() {
  const stats = calculateStats();
  const newAchievements = [];

  for (const def of ACHIEVEMENTS) {
    if (state.achievements.has(def.id)) continue;
    if (def.condition(stats)) {
      const achievement = {
        id: def.id,
        unlockedAt: Date.now(),
        name: def.name,
        desc: def.desc,
        icon: def.icon
      };
      await saveAchievement(achievement);
      newAchievements.push(achievement);
    }
  }

  // 显示新成就解锁动画
  if (newAchievements.length > 0) {
    showAchievementUnlock(newAchievements);
  }
}

function calculateStats() {
  const records = [...state.records.values()];
  const totalSeen = records.reduce((sum, r) => sum + r.seen, 0);
  const totalCorrect = records.reduce((sum, r) => sum + r.correct, 0);
  const totalFast = records.reduce((sum, r) => sum + r.fast, 0);

  // 计算最佳单轮成绩
  let bestAccuracy = 0;
  let bestFastRate = 0;

  if (state.lastReport) {
    const accuracy = Math.round((state.lastReport.correct / state.lastReport.total) * 100);
    const fastRate = Math.round((state.lastReport.fast / state.lastReport.total) * 100);
    bestAccuracy = Math.max(bestAccuracy, accuracy);
    bestFastRate = Math.max(bestFastRate, fastRate);
  }

  // 检查时间特殊成就
  const hour = new Date().getHours();
  const isNightOwl = hour >= 22 || hour < 4;
  const isEarlyBird = hour >= 4 && hour < 6;

  return {
    totalSeen,
    bestAccuracy: Math.max(bestAccuracy, state.stats.bestAccuracy),
    bestFastRate: Math.max(bestFastRate, state.stats.bestFastRate),
    battleWins: state.stats.battleWins,
    totalQuiz: state.stats.totalQuiz,
    currentStreak: state.streak.currentStreak,
    isNightOwl,
    isEarlyBird
  };
}

function showAchievementUnlock(achievements) {
  achievements.forEach((achievement, index) => {
    setTimeout(() => {
      const modal = document.createElement("div");
      modal.className = "achievement-modal";
      modal.innerHTML = `
        <div class="achievement-modal-content">
          <div class="achievement-icon">${achievement.icon}</div>
          <h3>🎉 成就解锁！</h3>
          <p class="achievement-name">${achievement.name}</p>
          <p class="achievement-desc">${achievement.desc}</p>
        </div>
      `;
      document.body.appendChild(modal);
      requestAnimationFrame(() => modal.classList.add("show"));

      setTimeout(() => {
        modal.classList.remove("show");
        setTimeout(() => modal.remove(), 300);
      }, 3000);
    }, index * 500);
  });
}

function renderAchievements() {
  const grid = document.querySelector("#achievementGrid");
  if (!grid) return;

  const stats = calculateStats();
  let html = "";

  for (const def of ACHIEVEMENTS) {
    const unlocked = state.achievements.get(def.id);
    const isUnlocked = !!unlocked;
    const progress = getAchievementProgress(def, stats);

    html += `<div class="achievement-card ${isUnlocked ? "unlocked" : "locked"}">
      <div class="achievement-icon">${isUnlocked ? def.icon : "🔒"}</div>
      <div class="achievement-info">
        <strong>${def.name}</strong>
        <span>${def.desc}</span>
        ${!isUnlocked && progress > 0 ? `<div class="achievement-progress"><div class="achievement-progress-bar" style="width: ${progress}%"></div></div>` : ""}
      </div>
      ${isUnlocked ? `<span class="achievement-date">${new Date(unlocked.unlockedAt).toLocaleDateString()}</span>` : ""}
    </div>`;
  }

  grid.innerHTML = html;
}

function getAchievementProgress(def, stats) {
  // 计算成就进度百分比
  if (def.id.startsWith("streak_")) {
    const target = parseInt(def.id.split("_")[1]);
    return Math.min(100, Math.round((stats.currentStreak / target) * 100));
  }
  if (def.id.startsWith("words_")) {
    const target = parseInt(def.id.split("_")[1]);
    return Math.min(100, Math.round((stats.totalSeen / target) * 100));
  }
  if (def.id.startsWith("quiz_")) {
    const target = parseInt(def.id.split("_")[1]);
    return Math.min(100, Math.round((stats.totalQuiz / target) * 100));
  }
  return 0;
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

  // 加载打卡和成就数据
  await loadStreak();
  await loadAchievements();

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

function stableShuffleWords(words, key) {
  return [...words].sort((a, b) => {
    const scoreA = hashString(`${key}:${a.id}`);
    const scoreB = hashString(`${key}:${b.id}`);
    return scoreA - scoreB || String(a.id).localeCompare(String(b.id));
  });
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
  const prepared = prepareRotationBatch(
    state.rotationQueues.get(rotationKey),
    candidates.map((word) => word.id),
    sizeValue
  );
  const candidatesById = new Map(candidates.map((word) => [word.id, word]));
  return {
    queue: prepared.batch.map((id) => candidatesById.get(id)).filter(Boolean),
    rotationKey,
    rotationState: prepared.state
  };
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
    ["60", "60 词"],
    ["100", "100 词"],
    ["200", "200 词"],
    ["all", "全部单词"]
  ];
  els.sessionSize.innerHTML = options
    .map(([value, label], index) => `<option value="${value}"${index === 0 ? " selected" : ""}>${label}</option>`)
    .join("");
  els.sessionSize.value = options.some(([value]) => value === previous) ? previous : "200";
}

function resolvePracticeMode() {
  const selected = els.practiceMode.value;
  if (selected === "zhToEnChoice" || selected === "enToZhChoice") return selected;
  return Math.random() < 0.5 ? "zhToEnChoice" : "enToZhChoice";
}

async function startSession() {
  if (state.session) clearInterval(state.session.timerId);
  const { queue, rotationKey, rotationState } = buildQueue();
  if (!queue.length) {
    els.feedback.textContent = state.queueNotice || "当前设置下暂无可练单词。";
    els.progressText.textContent = els.feedback.textContent;
    return;
  }
  await persistRotationState(rotationKey, rotationState);
  state.session = {
    queue,
    total: queue.length,
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
  session.answered = false;
  session.current = session.queue.shift();
  if (!session.current) return finishSession();

  session.mode = resolvePracticeMode();
  const word = session.current;
  const isPromptChinese = session.mode === "zhToEnChoice";
  els.word.textContent = isPromptChinese ? word.zh : word.en;
  els.tag.textContent = `${word.grade} · ${word.sourceType === "builtin" ? "内置" : "自定义"}`;
  els.hint.textContent = hintForMode(session.mode, word);
  els.feedback.textContent = "计时中。";
  els.choices.innerHTML = "";
  els.choices.hidden = false;
  makeChoices(word).forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.dataset.wordId = choice.id;
    const key = document.createElement("span");
    key.className = "choice-key";
    key.textContent = CHOICE_KEYS[index];
    const text = document.createElement("span");
    text.className = "choice-text";
    text.textContent = session.mode === "zhToEnChoice" ? choice.en : choice.zh;
    button.append(key, text);
    button.addEventListener("click", () => answer(choice, button));
    els.choices.append(button);
  });
  session.startedAt = performance.now();
  startTimer();
  updateProgress();
}

function hintForMode(mode, word) {
  const detail = [word.pos, word.notes].filter(Boolean).join(" · ");
  if (mode === "enToZhChoice") return detail || "看英文选中文。1.5 秒内算秒选，超过 3.5 秒记慢词。";
  return "看中文选英文。1.5 秒内算秒选，超过 3.5 秒记慢词。";
}

function startTimer() {
  clearInterval(state.session.timerId);
  els.timer.classList.remove("fast");
  els.timer.textContent = "用时 0.0 秒 · 1.5 秒内算秒选，超过 3.5 秒记慢词";
  state.session.timerId = setInterval(() => {
    const elapsed = performance.now() - state.session.startedAt;
    els.timer.textContent = `用时 ${(elapsed / 1000).toFixed(1)} 秒 · 1.5 秒内算秒选，超过 3.5 秒记慢词`;
  }, 100);
}

function getTrainingChoiceCount(answer) {
  return answer.grade === "初二" ? 5 : 4;
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

function getStructuredDistractors(answer, count) {
  const gradePool = getGradeWordPool(answer.grade);
  const fallbackPool = getEligibleWords();
  const used = new Set([answer.id]);
  const distractors = [];
  const firstLetter = answer.en[0]?.toLowerCase() || "";
  const sameFirstLimit = Math.min(2, Math.max(1, count - 2));

  function addFrom(pool, predicate, limit = count) {
    shuffle(pool).forEach((word) => {
      if (distractors.length >= count || distractors.length >= limit) return;
      if (used.has(word.id) || !word.zh || !predicate(word)) return;
      used.add(word.id);
      distractors.push(word);
    });
  }

  addFrom(gradePool, (word) => word.en[0]?.toLowerCase() === firstLetter, sameFirstLimit);
  addFrom(gradePool, (word) => word.en[0]?.toLowerCase() !== firstLetter && isSimilarWordShape(answer.en, word.en));
  addFrom(gradePool, (word) => word.en[0]?.toLowerCase() !== firstLetter);
  addFrom(gradePool, () => true);
  addFrom(fallbackPool, () => true);

  return distractors.slice(0, count);
}

function makeChoices(answer) {
  const distractorCount = getTrainingChoiceCount(answer) - 1;
  if (answer.grade === "初二") {
    return shuffle([answer, ...getStructuredDistractors(answer, distractorCount)]);
  }
  const pool = getEligibleWords().filter((word) => word.id !== answer.id && word.zh);
  return shuffle([answer, ...shuffle(pool).slice(0, distractorCount)]);
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
  await completePersistentRotationItem(session.rotationKey, word.id);
  renderAll();
  updateProgress();
  setTimeout(nextWord, isCorrect ? 750 : 1350);
}

function isCorrectAnswer(value, word, mode) {
  return value?.id === word.id;
}

function paintChoices(answerWord, clickedButton) {
  [...els.choices.children].forEach((button) => {
    const isCorrectChoice = button.dataset.wordId === state.session.current.id;
    button.classList.toggle("correct", isCorrectChoice);
    button.disabled = true;
  });
  if (answerWord?.id !== state.session.current.id && clickedButton) clickedButton.classList.add("wrong");
}

function feedbackText(word, isCorrect, isFast, isSlow, elapsed) {
  const seconds = (elapsed / 1000).toFixed(2);
  const detail = [word.pos, word.notes].filter(Boolean).join(" · ");
  if (!isCorrect) return `错词：${word.en} = ${word.zh}${detail ? `｜${detail}` : ""}`;
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

function skipWord() {
  if (!state.session?.current) return;
  answer("", null);
}

async function finishSession() {
  const session = state.session;
  clearInterval(session.timerId);
  const totalSeconds = Math.max(1, Math.round((performance.now() - session.sessionStartedAt) / 1000));
  const tomorrow = uniqueById([...session.wrongWords, ...session.slowWords]).length || Math.ceil(session.total * 0.25);
  state.lastReport = {
    total: session.total,
    correct: session.correct,
    fast: session.fast,
    wrong: session.wrongWords.length,
    slow: session.slowWords.length,
    tomorrow,
    totalSeconds
  };

  // 更新统计成就数据
  const accuracy = Math.round((session.correct / session.total) * 100);
  const fastRate = Math.round((session.fast / session.total) * 100);
  state.stats.bestAccuracy = Math.max(state.stats.bestAccuracy, accuracy);
  state.stats.bestFastRate = Math.max(state.stats.bestFastRate, fastRate);

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
  renderSessionReport();
  renderAll();

  // 自动打卡并检查成就
  await checkIn();
  await checkAchievements();

  state.session = null;
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

function startBattle() {
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
  const stagePool = getBattleWords(els.battleStage.value).filter((word) => word.id !== answer.id);
  const fallbackPool = state.words.filter((word) => word.id !== answer.id && word.en && word.zh);
  const distractors = uniqueById([...shuffle(stagePool), ...shuffle(fallbackPool)]).slice(0, 3);
  return shuffle([answer, ...distractors]);
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
  els.battleProgress.textContent = `完成 ${battle.total} 题`;
  els.leftBattleChoices.innerHTML = "";
  els.rightBattleChoices.innerHTML = "";
  els.skipBattleBtn.disabled = true;

  // 更新对战胜利统计
  if (left !== right) {
    state.stats.battleWins += 1;
  }

  state.battle = null;

  // 打卡并检查成就
  await checkIn();
  await checkAchievements();
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
  if (grade === "初一") return window.WORD_SNAP_GRADE7_QUIZ_SENTENCES || [];
  if (grade === "初二") return window.WORD_SNAP_GRADE8_QUIZ_SENTENCES || [];
  if (grade === "初三") return window.WORD_SNAP_QUIZ_SENTENCES || [];
  if (grade === "高一") return window.WORD_SNAP_GRADE10_QUIZ_SENTENCES || [];
  if (grade === "高二") return window.WORD_SNAP_GRADE11_QUIZ_SENTENCES || [];
  return [];
}

function loadScriptOnce(src) {
  if (state.quizBankLoads.has(src)) return state.quizBankLoads.get(src);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing || document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.dynamicSrc = src;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`加载失败：${src}`));
    if (!existing) document.head.append(script);
  });
  state.quizBankLoads.set(src, promise);
  return promise;
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
    els.quizStatusText.textContent = `${grade}刷题题库加载失败，请换个网络或刷新重试。`;
    return false;
  }
}

function getExpectedQuizCount(grade) {
  if (grade === "初二") return GRADE8_QUIZ_COUNT;
  if (grade === "高一") return GRADE10_QUIZ_COUNT;
  if (grade === "高二") return GRADE11_QUIZ_COUNT;
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
    if (grade === "初一") return String(record.questionId || "").startsWith("g7-");
    if (grade === "初二") return String(record.questionId || "").startsWith("g8-");
    return !String(record.questionId || "").startsWith("g7-") && !String(record.questionId || "").startsWith("g8-");
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

async function recordQuizAnswer(q, isCorrect, isFast) {
  const grade = state.quiz?.grade || q.grade || els.quizStage.value;
  const stats = state.quizStats.get(grade) || { attempted: 0, correct: 0, fast: 0 };
  stats.attempted += 1;
  stats.correct += isCorrect ? 1 : 0;
  stats.fast += isCorrect && isFast ? 1 : 0;
  state.quizStats.set(grade, stats);
  await put("meta", { key: `quizStats:${grade}`, value: stats, at: Date.now() });
  renderQuizStats();
}

function generateWordQuiz(grade) {
  const lists = window.WORD_SNAP_BUILTIN_LISTS || [];
  const entry = lists.find((l) => l.grade === grade);
  if (!entry || !entry.words || !entry.words.length) return [];
  return entry.words
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
    const lists = window.WORD_SNAP_BUILTIN_LISTS || [];
    const entry = lists.find((l) => l.grade === grade);
    const total = entry?.words?.filter((w) => w.en && w.zh).length || 0;
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

async function startQuiz(isReview) {
  const grade = els.quizStage.value;
  let allData;
  let vocabPool;

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
    allData = generateWordQuiz(grade);
    const lists = window.WORD_SNAP_BUILTIN_LISTS || [];
    const entry = lists.find((l) => l.grade === grade);
    vocabPool = (entry?.words || []).filter((w) => w.en && w.zh);
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
  } else {
    queue = shuffle([...allData]);
  }

  const sizeOpt = els.quizSize.value;
  if (!isReview && sizeOpt !== "all") {
    queue = queue.slice(0, Number(sizeOpt));
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
    sessionStartedAt: performance.now(),
    currentQ: null,
    currentIndex: 0,
    startedAt: 0,
    timerId: 0,
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
  quiz.answered = false;
  quiz.currentQ = quiz.queue.shift();

  if (!quiz.currentQ) return finishQuiz();
  quiz.currentIndex = quiz.done + 1;

  const q = quiz.currentQ;
  const allChoices = q.options?.length
    ? shuffle([...q.options])
    : shuffle([q.answer, ...getQuizDistractorsForSentence(q.answer, quiz.vocabPool)]);

  els.quizTag.textContent = `第 ${quiz.done + 1}/${quiz.total} 题`;
  els.quizSentence.textContent = q.sentence;
  els.quizHint.textContent = q.type === "word" ? "选择正确的英文单词" : q.type === "multiple-choice" ? "选择最佳答案" : `首字母：${q.answer[0]}`;
  els.quizFeedback.textContent = "计时中。";
  els.quizChoices.innerHTML = "";

  allChoices.forEach((word, index) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.dataset.isCorrect = word === q.answer ? "1" : "0";
    const key = document.createElement("span");
    key.className = "choice-key";
    key.textContent = CHOICE_KEYS[index];
    const text = document.createElement("span");
    text.className = "choice-text";
    text.textContent = word;
    button.append(key, text);
    button.addEventListener("click", () => answerQuizChoice(word === q.answer, button));
    els.quizChoices.append(button);
  });

  quiz.startedAt = performance.now();
  startQuizTimer();
  updateQuizProgress();
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
  setTimeout(nextQuizQuestion, isCorrect ? 800 : 1500);
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

  // 更新刷题统计
  state.stats.totalQuiz += quiz.total;

  state.quiz = null;
  renderQuizWrongList();

  // 自动打卡并检查成就
  await checkIn();
  await checkAchievements();
}

function renderQuizWrongList() {
  const wrongs = [...state.quizWrongRecords.values()].sort((a, b) => b.lastWrongAt - a.lastWrongAt);
  if (!wrongs.length) {
    els.quizWrongList.innerHTML = "<p class='status-text'>暂无错题记录。完成一轮刷题后这里会显示答错的题目。</p>";
    return;
  }
  els.quizWrongList.innerHTML = wrongs.map((r) => `
    <div class="quiz-wrong-item">
      <span>错 ${r.wrongCount} 次 · 正确答案: <strong>${escapeHtml(r.answer)}</strong></span>
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
  for (const row of rows) await put("words", row);
  state.reviewRows = [];
  els.reviewPanel.hidden = true;
  els.textImport.value = "";
  els.importStatus.textContent = `已保存 ${rows.length} 个词到 ${stage}。`;
  await loadState();
}

function renderAll() {
  updateSessionSizeOptions();
  renderStats();
  renderQuizStats();
  renderDecks();
  renderWeakList();
  renderReport();
  renderQuizWrongList();
  updateTrainingEstimate();
  renderCheckinStats();
  renderAchievements();
}

function renderStats() {
  const eligible = getEligibleWords();
  const realTotal = eligible.length;
  const records = [...state.records.values()];
  const seen = records.reduce((sum, record) => sum + record.seen, 0);
  const correct = records.reduce((sum, record) => sum + record.correct, 0);
  const fast = records.reduce((sum, record) => sum + record.fast, 0);
  els.totalWords.textContent = getDisplayedTotalWords(els.stageSelect.value, realTotal);
  els.doneCount.textContent = seen;
  els.accuracy.textContent = percent(correct, seen);
  els.fastRate.textContent = percent(fast, seen);
  els.weakCount.textContent = state.words.filter(isWeak).length;
}

function getDisplayedTotalWords(stage, realTotal) {
  if (stage === "高一" || stage === "高二") return 10000;
  return realTotal;
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
  const byStage = STAGES.map((stage) => {
    const words = state.words.filter((word) => stageMatches(word, stage));
    const practiced = words.filter((word) => getRecord(word.id).seen > 0).length;
    const mastered = words.filter((word) => getRecord(word.id).mastery >= 80).length;
    return { stage, total: words.length, practiced, mastered };
  }).filter((item) => item.total > 0);
  const due = state.words.filter((word) => getRecord(word.id).nextReviewAt <= Date.now() && getRecord(word.id).seen > 0).length;
  const topReview = state.words.filter((word) => getRecord(word.id).seen > 0).sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 10);
  els.reportContent.innerHTML = [
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
    <button id="againWeakBtn" type="button">再练错词</button>
    <button id="nextSessionBtn" type="button" class="secondary">继续下一组</button>
  `;
  document.querySelector("#againWeakBtn").addEventListener("click", () => {
    els.trainingScope.value = "wrong";
    els.sessionSize.value = "all";
    startSession();
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
  for (const word of words) await put("words", word);
  for (const record of records) await put("records", record);
  await loadState();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  [els.stageSelect, els.deckFilter, els.sessionSize, els.trainingScope].forEach((el) => el.addEventListener("change", renderAll));
  els.startBtn.addEventListener("click", startSession);
  els.skipBtn.addEventListener("click", skipWord);

  // 打卡按钮事件
  const checkinBtn = document.querySelector("#checkinBtn");
  if (checkinBtn) {
    checkinBtn.addEventListener("click", async () => {
      const success = await checkIn();
      if (!success) {
        showToast("今日已打卡，明天继续加油！");
      }
    });
  }

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
    if (!confirm("确定清空所有练习记录吗？词库会保留。")) return;
    await clearStore("records");
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
  els.quizStage.addEventListener("change", () => updateQuizSizeOptions());
  els.clearQuizWrongBtn.addEventListener("click", async () => {
    if (!confirm("确定清空所有刷题错题记录吗？")) return;
    await clearStore("quizWrongAnswers");
    state.quizWrongRecords.clear();
    renderQuizStats();
    renderQuizWrongList();
  });
  document.addEventListener("keydown", (event) => {
    if (els.views.train.classList.contains("active") && state.session && !state.session.answered) {
      if (state.session.mode === "enToZhChoice" || state.session.mode === "zhToEnChoice") {
        const key = event.key.toUpperCase();
        const choiceIndex = /^[1-5]$/.test(key) ? Number(key) - 1 : CHOICE_KEYS.indexOf(key);
        const button = choiceIndex >= 0 ? els.choices.children[choiceIndex] : null;
        if (button) {
          event.preventDefault();
          button.click();
        }
      }
    }
    if (els.views.quiz.classList.contains("active") && state.quiz && !state.quiz.answered) {
      const key = event.key.toUpperCase();
      const choiceIndex = /^[1-5]$/.test(key) ? Number(key) - 1 : CHOICE_KEYS.indexOf(key);
      const button = choiceIndex >= 0 ? els.quizChoices.children[choiceIndex] : null;
      if (button) {
        event.preventDefault();
        button.click();
      }
    }
  });
}

async function init() {
  bindEvents();
  try {
    state.db = await openDb();
    await seedBuiltinWords();
    await loadState();
    await updateQuizSizeOptions();
  } catch (error) {
    els.feedback.textContent = `初始化失败：${error.message || error}`;
  }
}

init();
