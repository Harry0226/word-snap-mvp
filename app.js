const STAGES = ["小学六年级", "初一", "初二", "初三", "高一", "高二", "高三", "中考冲刺", "高考冲刺"];
const DB_NAME = "word-snap-v2";
const DB_VERSION = 1;
const BUILTIN_SEED_VERSION = 4;
const FAST_PICK_LIMIT = 1500;
const CHOICE_KEYS = ["A", "B", "C", "D"];
const PDF_JS_SOURCES = [
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js"
];
const TESSERACT_SOURCES = [
  "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
  "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js"
];
const lazyScriptPromises = new Map();

const state = {
  db: null,
  words: [],
  records: new Map(),
  session: null,
  reviewRows: [],
  lastReport: null,
  weakFilter: "wrong",
  queueNotice: ""
};

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  views: {
    train: document.querySelector("#view-train"),
    decks: document.querySelector("#view-decks"),
    wrong: document.querySelector("#view-wrong"),
    report: document.querySelector("#view-report")
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
  typingPanel: document.querySelector("#typingPanel"),
  typingAnswer: document.querySelector("#typingAnswer"),
  feedback: document.querySelector("#feedback"),
  skipBtn: document.querySelector("#skipBtn"),
  sessionReport: document.querySelector("#sessionReport"),
  uploadStage: document.querySelector("#uploadStage"),
  sourceName: document.querySelector("#sourceName"),
  fileInput: document.querySelector("#fileInput"),
  recognizeBtn: document.querySelector("#recognizeBtn"),
  ocrStatus: document.querySelector("#ocrStatus"),
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

function slugWord(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "word";
}

function normalizeBuiltinWord(word, index, list) {
  const grade = list.grade || "初三";
  const source = list.source || "近五年中考结合最新一模";
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
      goals: ["初三", "中考冲刺"],
      source: "近五年中考结合最新一模",
      legacyIds: true,
      words: window.WORD_SNAP_WORDS || []
    },
    ...(window.WORD_SNAP_BUILTIN_LISTS || [])
  ];
  const words = builtinLists.flatMap((list) => (list.words || [])
    .map((word, index) => normalizeBuiltinWord(word, index, list))
    .filter((word) => word.en && word.zh));
  if (Number(seedMeta?.value || 0) < 3) {
    await deleteBuiltinDecks([
      { grade: "高一", source: "高一内置词库" },
      { grade: "高二", source: "高二内置词库" },
      { grade: "高三", source: "高三高频词库" },
      { grade: "初三", source: "初三刷题词库" }
    ]);
  }
  const store = tx("words", "readwrite");
  await Promise.all(words.map((word) => new Promise((resolve, reject) => {
    const request = store.put(word);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  })));
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

async function loadState() {
  state.words = await getAll("words");
  const records = await getAll("records");
  state.records = new Map(records.map((record) => [record.wordId, record]));
  renderAll();
}

function switchView(view) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  Object.entries(els.views).forEach(([name, el]) => el.classList.toggle("active", name === view));
  renderAll();
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
  return record.wrong > 0 || record.slow > 0 || (record.seen > 0 && record.mastery < 60);
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

function fillQueueToSize(preferred, fallback, size) {
  return uniqueById([
    ...preferred,
    ...weightedPick(fallback, size)
  ]).slice(0, size);
}

function buildQueue() {
  state.queueNotice = "";
  const words = getEligibleWords();
  const sizeValue = els.sessionSize.value;
  const size = sizeValue === "all" ? words.length : Number(sizeValue);
  const newWords = words.filter((word) => getRecord(word.id).seen === 0);
  const weakWords = words.filter(isWeak);
  const wrongWords = words.filter(isWrongWord);
  const slowWords = words.filter(isSlowWord);
  const dueWords = words.filter((word) => {
    const record = getRecord(word.id);
    return record.seen > 0 && record.nextReviewAt <= Date.now() && !isWeak(word);
  });
  const regular = words.filter((word) => !newWords.includes(word) && !weakWords.includes(word) && !dueWords.includes(word));
  const scope = els.trainingScope.value;

  if (!words.length) {
    state.queueNotice = "当前阶段没有可训练词。请切换阶段，或先在词库页上传词表。";
    return [];
  }

  if (sizeValue !== "all" && words.length < size) {
    state.queueNotice = `当前筛选只有 ${words.length} 个词，本轮会练完这些词。`;
  }

  if (scope === "wrong" || scope === "weak") {
    if (!wrongWords.length) state.queueNotice = "还没有错词。请先完成一轮训练，或把训练范围切回智能混合。";
    return weightedPick(wrongWords, size);
  }
  if (scope === "slow") {
    if (!slowWords.length) state.queueNotice = "还没有慢词。请先完成一轮训练，或把训练范围切回智能混合。";
    return weightedPick(slowWords, size);
  }
  if (scope === "new") {
    if (!newWords.length) state.queueNotice = "当前阶段没有新词了。可以改练错词、慢词或全部单词。";
    return weightedPick(newWords, size);
  }
  if (scope === "all" || sizeValue === "all") {
    return randomizedPrioritySort(uniqueById([...weakWords, ...dueWords, ...newWords, ...regular]));
  }

  const picked = [
    ...weightedPick(newWords, Math.ceil(size * 0.4)),
    ...weightedPick(weakWords, Math.ceil(size * 0.4)),
    ...weightedPick(dueWords, Math.ceil(size * 0.2))
  ];
  return fillQueueToSize(picked, words, size);
}

function updateTrainingEstimate() {
  if (state.session) return;
  const queue = buildQueue();
  if (!queue.length) {
    els.progressText.textContent = state.queueNotice || "当前设置下暂无可练单词";
    return;
  }
  const suffix = state.queueNotice ? ` · ${state.queueNotice}` : "";
  els.progressText.textContent = `本轮预计 ${queue.length} 词${suffix}`;
}

function resolvePracticeMode() {
  const selected = els.practiceMode.value;
  if (selected !== "auto") return selected;
  const stage = els.stageSelect.value;
  if (stage.startsWith("高") || stage === "高考冲刺") {
    return Math.random() < 0.45 ? "zhToEnType" : "zhToEnChoice";
  }
  return Math.random() < 0.25 ? "zhToEnChoice" : "enToZhChoice";
}

function startSession() {
  const queue = buildQueue();
  if (!queue.length) {
    els.feedback.textContent = state.queueNotice || "当前设置下暂无可练单词。";
    els.progressText.textContent = els.feedback.textContent;
    return;
  }
  state.session = {
    queue,
    total: queue.length,
    current: null,
    mode: "enToZhChoice",
    startedAt: 0,
    timerId: 0,
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
  const isPromptChinese = session.mode === "zhToEnChoice" || session.mode === "zhToEnType";
  const isTyping = session.mode === "enToZhType" || session.mode === "zhToEnType";
  els.word.textContent = isPromptChinese ? word.zh : word.en;
  els.tag.textContent = `${word.grade} · ${word.sourceType === "builtin" ? "内置" : "自定义"}`;
  els.hint.textContent = hintForMode(session.mode, word);
  els.feedback.textContent = "计时中。";
  els.choices.innerHTML = "";
  els.choices.hidden = isTyping;
  els.typingPanel.hidden = !isTyping;
  els.typingAnswer.value = "";
  els.typingAnswer.disabled = false;
  els.typingAnswer.placeholder = session.mode === "enToZhType" ? "输入中文意思" : "输入英文单词";
  if (isTyping) {
    setTimeout(() => els.typingAnswer.focus(), 0);
  } else {
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
  }
  session.startedAt = performance.now();
  startTimer();
  updateProgress();
}

function hintForMode(mode, word) {
  const detail = [word.pos, word.notes].filter(Boolean).join(" · ");
  if (mode === "enToZhChoice") return detail || "看英文选中文。1.5 秒内答对算秒选。";
  if (mode === "zhToEnChoice") return "看中文选英文。1.5 秒内答对算秒选。";
  if (mode === "enToZhType") return "看英文说中文，也可以输入中文。1.5 秒内答对算秒选。";
  return "看中文说英文，也可以输入英文。1.5 秒内答对算秒选。";
}

function startTimer() {
  clearInterval(state.session.timerId);
  els.timer.classList.remove("fast");
  els.timer.textContent = "用时 0.0 秒 · 1.5 秒内答对算秒选";
  state.session.timerId = setInterval(() => {
    const elapsed = performance.now() - state.session.startedAt;
    els.timer.textContent = `用时 ${(elapsed / 1000).toFixed(1)} 秒 · 1.5 秒内答对算秒选`;
  }, 100);
}

function makeChoices(answer) {
  const pool = getEligibleWords().filter((word) => word.id !== answer.id && word.zh);
  return shuffle([answer, ...shuffle(pool).slice(0, 3)]);
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
  els.timer.textContent = `用时 ${(elapsed / 1000).toFixed(2)} 秒 · ${isFast ? "秒选成功" : "未达秒选"}`;
  els.timer.classList.toggle("fast", isFast);
  session.done += 1;
  session.correct += isCorrect ? 1 : 0;
  session.fast += isFast ? 1 : 0;
  if (!isCorrect) session.wrongWords.push(word);
  if (isCorrect && !isFast) session.slowWords.push(word);
  if (session.mode === "enToZhChoice" || session.mode === "zhToEnChoice") paintChoices(value, button);
  if (session.mode === "enToZhType" || session.mode === "zhToEnType") els.typingAnswer.disabled = true;
  els.feedback.textContent = feedbackText(word, isCorrect, isFast, elapsed);
  await recordAnswer(word, isCorrect, isFast);
  renderAll();
  updateProgress();
  setTimeout(nextWord, isCorrect ? 750 : 1350);
}

function isCorrectAnswer(value, word, mode) {
  if (mode === "enToZhChoice" || mode === "zhToEnChoice") return value?.id === word.id;
  if (mode === "zhToEnType") return normalizeEnglish(value) === normalizeEnglish(word.en);
  const input = normalizeChinese(value);
  return input && normalizeChinese(word.zh).includes(input);
}

function paintChoices(answerWord, clickedButton) {
  [...els.choices.children].forEach((button) => {
    const isCorrectChoice = button.dataset.wordId === state.session.current.id;
    button.classList.toggle("correct", isCorrectChoice);
    button.disabled = true;
  });
  if (answerWord?.id !== state.session.current.id && clickedButton) clickedButton.classList.add("wrong");
}

function feedbackText(word, isCorrect, isFast, elapsed) {
  const seconds = (elapsed / 1000).toFixed(2);
  const detail = [word.pos, word.notes].filter(Boolean).join(" · ");
  if (!isCorrect) return `错词：${word.en} = ${word.zh}${detail ? `｜${detail}` : ""}`;
  if (isFast) return `秒选成功：${seconds} 秒`;
  return `答对了，用时 ${seconds} 秒，已记为慢词。`;
}

async function recordAnswer(word, isCorrect, isFast) {
  const record = getRecord(word.id);
  record.seen += 1;
  record.correct += isCorrect ? 1 : 0;
  record.wrong += isCorrect ? 0 : 1;
  record.fast += isFast ? 1 : 0;
  record.slow += isCorrect && !isFast ? 1 : 0;
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

function finishSession() {
  const session = state.session;
  clearInterval(session.timerId);
  const tomorrow = uniqueById([...session.wrongWords, ...session.slowWords]).length || Math.ceil(session.total * 0.25);
  state.lastReport = {
    total: session.total,
    correct: session.correct,
    fast: session.fast,
    wrong: session.wrongWords.length,
    slow: session.slowWords.length,
    tomorrow
  };
  els.word.textContent = "Done";
  els.tag.textContent = "本轮完成";
  els.hint.textContent = "建议明天优先复习本轮错词和慢词。";
  els.timer.textContent = "本轮已完成";
  els.timer.classList.remove("fast");
  els.choices.innerHTML = "";
  els.choices.hidden = false;
  els.typingPanel.hidden = true;
  els.skipBtn.disabled = true;
  els.feedback.textContent = `完成 ${session.total} 词，正确率 ${percent(session.correct, session.total)}，秒选率 ${percent(session.fast, session.total)}。`;
  els.progressText.textContent = "本轮已完成";
  els.progressBar.style.width = "100%";
  renderSessionReport();
  renderAll();
  state.session = null;
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

function normalizeEnglish(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeChinese(value) {
  return String(value || "").replace(/[，。；;、\s]/g, "").trim();
}

async function recognizeFile() {
  const file = els.fileInput.files?.[0];
  if (!file) {
    els.ocrStatus.textContent = "请先选择一个图片、PDF 或文本文件。";
    return;
  }
  els.recognizeBtn.disabled = true;
  els.ocrStatus.textContent = "正在准备文件，优先使用 AI 识别。";
  try {
    const rows = await recognizeWithAi(file);
    state.reviewRows = rows.slice(0, 300);
    if (!state.reviewRows.length) state.reviewRows = [{ en: "", zh: "", pos: "", notes: "" }];
    renderReviewRows();
    els.reviewPanel.hidden = false;
    els.ocrStatus.textContent = `AI 识别到 ${state.reviewRows.length} 条候选词，请确认后保存。`;
  } catch (error) {
    els.ocrStatus.textContent = `AI 识别失败，正在切换本地识别：${error.message || error}`;
    try {
      let text = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        text = await extractPdfText(file);
        if (!text.trim()) text = await ocrPdf(file);
      } else if (file.type.startsWith("image/")) {
        text = await ocrImage(file);
      } else {
        text = await file.text();
      }
      state.reviewRows = parseWordsFromText(text).slice(0, 300);
      if (!state.reviewRows.length) state.reviewRows = [{ en: "", zh: "", pos: "", notes: "" }];
      renderReviewRows();
      els.reviewPanel.hidden = false;
      els.ocrStatus.textContent = `本地识别到 ${state.reviewRows.length} 条候选词，请确认后保存。`;
    } catch (fallbackError) {
      els.ocrStatus.textContent = `识别失败：${fallbackError.message || fallbackError}`;
    }
  } finally {
    els.recognizeBtn.disabled = false;
  }
}

async function recognizeWithAi(file) {
  const images = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    ? await pdfToDataUrls(file)
    : file.type.startsWith("image/")
      ? [{ dataUrl: await imageFileToDataUrl(file), page: 1 }]
      : [];
  if (!images.length) return parseWordsFromText(await file.text());
  els.ocrStatus.textContent = `正在请求 AI 识别 ${images.length} 张页面图片。`;
  const response = await fetch("/api/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images,
      stage: els.uploadStage.value,
      sourceName: els.sourceName.value.trim() || file.name
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `AI 接口返回 ${response.status}`);
  return sanitizeRows(data.words || []);
}

function loadExternalScript(key, sources, isReady) {
  if (isReady()) return Promise.resolve();
  if (lazyScriptPromises.has(key)) return lazyScriptPromises.get(key);
  const promise = new Promise((resolve, reject) => {
    let index = 0;
    const tryNextSource = () => {
      const src = sources[index];
      if (!src) {
        reject(new Error(`${key} 识别库加载失败，请检查网络后重试。`));
        return;
      }
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        script.remove();
        index += 1;
        tryNextSource();
      }, 15000);
      script.src = src;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => {
        window.clearTimeout(timeout);
        if (isReady()) resolve();
        else {
          script.remove();
          index += 1;
          tryNextSource();
        }
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        script.remove();
        index += 1;
        tryNextSource();
      };
      document.head.append(script);
    };
    tryNextSource();
  }).catch((error) => {
    lazyScriptPromises.delete(key);
    throw error;
  });
  lazyScriptPromises.set(key, promise);
  return promise;
}

async function loadPdfJs() {
  if (!window.pdfjsLib) els.ocrStatus.textContent = "正在加载 PDF 识别库，仅首次使用需要等待。";
  await loadExternalScript("PDF.js", PDF_JS_SOURCES, () => Boolean(window.pdfjsLib));
}

async function loadTesseract() {
  if (!window.Tesseract) els.ocrStatus.textContent = "正在加载 OCR 识别库，仅首次使用需要等待。";
  await loadExternalScript("OCR", TESSERACT_SOURCES, () => Boolean(window.Tesseract));
}

async function extractPdfText(file) {
  await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), disableWorker: true }).promise;
  const chunks = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    els.ocrStatus.textContent = `正在提取 PDF 文本：第 ${pageNo}/${pdf.numPages} 页`;
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    chunks.push(content.items.map((item) => item.str).join(" "));
  }
  return chunks.join("\n");
}

async function ocrPdf(file) {
  const pages = await pdfToCanvases(file);
  const chunks = [];
  for (let i = 0; i < pages.length; i += 1) {
    els.ocrStatus.textContent = `扫描版 PDF OCR：第 ${i + 1}/${pages.length} 页`;
    chunks.push(await ocrCanvas(pages[i]));
  }
  return chunks.join("\n");
}

async function pdfToCanvases(file) {
  await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), disableWorker: true }).promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 12); pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    pages.push(canvas);
  }
  return pages;
}

async function pdfToDataUrls(file) {
  const canvases = await pdfToCanvases(file);
  return canvases.map((canvas, index) => ({ dataUrl: compressCanvasToDataUrl(canvas), page: index + 1 }));
}

async function ocrImage(file) {
  return ocrCanvas(await imageFileToCanvas(file));
}

async function imageFileToCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function imageFileToDataUrl(file) {
  return compressCanvasToDataUrl(await imageFileToCanvas(file));
}

function compressCanvasToDataUrl(canvas) {
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / canvas.width);
  if (scale < 1) {
    const resized = document.createElement("canvas");
    resized.width = Math.round(canvas.width * scale);
    resized.height = Math.round(canvas.height * scale);
    resized.getContext("2d").drawImage(canvas, 0, 0, resized.width, resized.height);
    return resized.toDataURL("image/jpeg", 0.82);
  }
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function ocrCanvas(canvas) {
  await loadTesseract();
  const result = await Tesseract.recognize(canvas, "eng+chi_sim", {
    logger: (message) => {
      if (message.status) {
        const progress = message.progress ? ` ${Math.round(message.progress * 100)}%` : "";
        els.ocrStatus.textContent = `OCR ${message.status}${progress}`;
      }
    }
  });
  return result.data.text || "";
}

function parseWordsFromText(text) {
  const rows = [];
  const seen = new Set();
  String(text || "").split(/\n|;/).forEach((raw) => {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) return;
    const pipeParts = line.split("|").map((part) => part.trim());
    if (pipeParts.length >= 2 && /^[A-Za-z][A-Za-z'-]{1,24}$/.test(pipeParts[0])) {
      const en = pipeParts[0].toLowerCase();
      if (!seen.has(en) && !COMMON_NOISE.has(en)) {
        seen.add(en);
        rows.push({ en, zh: pipeParts[1] || "", pos: pipeParts[2] || "", notes: pipeParts.slice(3).join(" | ") });
      }
      return;
    }
    const match = line.match(/^([A-Za-z][A-Za-z'-]{1,24})\s*(?:\(([^)]{1,12})\)|\b(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.)\b)?\s*[:：\-—]?\s*(.*)$/i);
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
  const source = els.sourceName.value.trim() || els.fileInput.files?.[0]?.name || "自定义词库";
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
    els.ocrStatus.textContent = "没有可保存的英文词条。";
    return;
  }
  for (const row of rows) await put("words", row);
  state.reviewRows = [];
  els.reviewPanel.hidden = true;
  els.ocrStatus.textContent = `已保存 ${rows.length} 个词到 ${stage}。`;
  await loadState();
}

function renderAll() {
  renderStats();
  renderDecks();
  renderWeakList();
  renderReport();
  updateTrainingEstimate();
}

function renderStats() {
  const eligible = getEligibleWords();
  const records = [...state.records.values()];
  const seen = records.reduce((sum, record) => sum + record.seen, 0);
  const correct = records.reduce((sum, record) => sum + record.correct, 0);
  const fast = records.reduce((sum, record) => sum + record.fast, 0);
  els.totalWords.textContent = eligible.length;
  els.doneCount.textContent = seen;
  els.accuracy.textContent = percent(correct, seen);
  els.fastRate.textContent = percent(fast, seen);
  els.weakCount.textContent = state.words.filter(isWeak).length;
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
  els.typingPanel.addEventListener("submit", (event) => {
    event.preventDefault();
    answer(els.typingAnswer.value, null);
  });
  els.recognizeBtn.addEventListener("click", recognizeFile);
  els.parseTextBtn.addEventListener("click", () => {
    state.reviewRows = parseWordsFromText(els.textImport.value).slice(0, 300);
    if (!state.reviewRows.length) state.reviewRows = [{ en: "", zh: "", pos: "", notes: "" }];
    renderReviewRows();
    els.reviewPanel.hidden = false;
    els.ocrStatus.textContent = `从文字中解析到 ${state.reviewRows.length} 条候选词，请确认后保存。`;
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
  document.addEventListener("keydown", (event) => {
    if (!els.views.train.classList.contains("active") || !state.session || state.session.answered) return;
    if (state.session.mode === "enToZhChoice" || state.session.mode === "zhToEnChoice") {
      const key = event.key.toUpperCase();
      const choiceIndex = /^[1-4]$/.test(key) ? Number(key) - 1 : CHOICE_KEYS.indexOf(key);
      const button = choiceIndex >= 0 ? els.choices.children[choiceIndex] : null;
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
  } catch (error) {
    els.feedback.textContent = `初始化失败：${error.message || error}`;
  }
}

init();
