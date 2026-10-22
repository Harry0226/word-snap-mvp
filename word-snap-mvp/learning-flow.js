const FLOW_KEY = "learningFlow:v1";
const WORDBOOK_KEY = "wordbook:v1:";
const learningBook = new Map((window.WORD_SNAP_WORDBOOK || []).map((item) => [item.word.toLowerCase(), item]));
let flowAdvanceTimer = 0;
let wordbookLoadPromise = null;

function renderTodayCompletion() {
  const record = state.learningCompletions.get(learningDateKey());
  els.todayRecordBtn.disabled = !record;
  els.todayRecordStatus.textContent = record
    ? `${record.report.grade} · ${formatClockTime(record.completedAt)} 完成`
    : "完成整轮学习后可查看结算";
}

function openTodayCompletion() {
  const record = state.learningCompletions.get(learningDateKey());
  if (!record) return;
  state.viewedCompletion = {...record, phase: "done"};
  renderLearningFlow(true);
}

function formatClockTime(timestamp) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatSessionDate(timestamp) {
  const date = new Date(timestamp);
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday} ${formatClockTime(timestamp)}`;
}

function formatLearningDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return `${hours ? `${hours}小时` : ""}${minutes ? `${minutes}分` : ""}${rest}秒`;
}

function pauseLearningFlow() {
  if (!state.learningFlow || state.learningFlow.phase === "done" || state.learningFlow.pausedAt) return;
  state.learningFlow.pausedAt = Date.now();
  saveLearningFlow();
}

function resumeLearningFlow() {
  const flow = state.learningFlow;
  if (!flow || flow.phase === "done" || !flow.pausedAt) return;
  flow.pausedMs = (flow.pausedMs || 0) + Math.max(0, Date.now() - flow.pausedAt);
  flow.pausedAt = null;
  saveLearningFlow();
}

async function recordLearningCompletion(flow) {
  flow.completedAt = Date.now();
  flow.totalSeconds = Math.max(0, Number(flow.report.totalSeconds) || 0)
    + Math.max(0, Math.round((flow.completedAt - flow.startedAt - (flow.pausedMs || 0)) / 1000));
  const record = {
    report: flow.report,
    scores: {...flow.scores},
    completedAt: flow.completedAt,
    totalSeconds: flow.totalSeconds
  };
  const day = learningDateKey(new Date(flow.completedAt));
  await put("meta", {key: `learningCompletion:v1:${day}`, value: record});
  state.learningCompletions.set(day, record);
  renderTodayCompletion();
}

function prepareWordbookStages() {
  if (wordbookLoadPromise) return wordbookLoadPromise;
  wordbookLoadPromise = (async () => {
    const results = await Promise.allSettled(STAGES.map((stage) => ensureStageLoaded(stage)));
    await loadState();
    renderWordbook();
    if (results.some((result) => result.status === "rejected")) showToast("部分阶段词库暂时无法加载，请稍后重试。", {duration: 3500});
  })();
  return wordbookLoadPromise;
}

function bookKey(word) {
  return String(word || "").trim().toLowerCase();
}

function bookEntry(word) {
  const key = bookKey(word);
  const source = learningBook.get(key);
  const stage = state.words.find((item) => bookKey(item.en) === key);
  return {
    word: source?.word || stage?.en || word,
    phonetic: source?.phonetic || "",
    definition: source?.definition || stage?.zh || "词库暂未收录释义",
    mnemonic: source?.mnemonic || "",
    context: stage?.contextSentence || "",
    note: state.wordbookSaved.get(key)?.note || "",
    saved: state.wordbookSaved.has(key)
  };
}

function showWordbookExplanation(word) {
  const entry = bookEntry(word.en);
  els.wordbookExplanation.hidden = false;
  els.wordbookExplanation.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = `${entry.word} · ${entry.definition}`;
  els.wordbookExplanation.append(title);
  const detail = entry.mnemonic || entry.note || word.contextSentence || word.notes || "记住词义后再继续下一词。";
  const paragraph = document.createElement("p");
  paragraph.textContent = detail.slice(0, 550);
  els.wordbookExplanation.append(paragraph);
}

function renderWordbook() {
  const root = els.wordbookResults;
  if (!root) return;
  const search = bookKey(els.wordbookSearch.value);
  const saved = [...state.wordbookSaved.keys()];
  let keys;
  if (search) {
    const all = new Set([...learningBook.keys(), ...state.words.map((item) => bookKey(item.en)), ...saved]);
    keys = [...all].filter((word) => word.includes(search)).sort((a, b) => {
      const rank = (word) => (word === search ? 0 : word.startsWith(search) ? 1 : 2);
      return rank(a) - rank(b) || a.localeCompare(b);
    }).slice(0, 6);
    if (!all.has(search) && /^[a-z][a-z' -]{2,40}$/.test(search)) keys.unshift(search);
  } else {
    keys = saved.reverse().slice(0, 12);
  }
  if (!keys.length) {
    root.innerHTML = '<p class="wordbook-empty">搜索英文单词，或先收藏一个难词。</p>';
    return;
  }
  root.innerHTML = keys.map((key) => {
    const entry = bookEntry(key);
    return `<article class="wordbook-entry" data-word="${escapeAttr(key)}">
      <div class="wordbook-entry-head"><div><h3>${escapeHtml(entry.word)} <small>${escapeHtml(entry.phonetic)}</small></h3><p>${escapeHtml(entry.definition)}</p></div>
      <button type="button" class="secondary" data-book-save="${escapeAttr(key)}" aria-pressed="${entry.saved}">${entry.saved ? "已收藏" : "收藏"}</button></div>
      ${entry.mnemonic ? entry.mnemonic.length > 220
        ? `<details class="wordbook-memory"><summary>记忆解析</summary><p>${escapeHtml(entry.mnemonic)}</p></details>`
        : `<p class="wordbook-memory">${escapeHtml(entry.mnemonic)}</p>` : ""}
      ${!entry.mnemonic && entry.context ? `<p class="wordbook-memory">${escapeHtml(entry.context)}</p>` : ""}
      <label>我的记忆备注<textarea rows="2" data-book-note="${escapeAttr(key)}" placeholder="写下帮助自己记住这个词的提示">${escapeHtml(entry.note)}</textarea></label>
      <button type="button" class="secondary wordbook-note-save" data-book-note-save="${escapeAttr(key)}">保存备注</button>
    </article>`;
  }).join("");
}

async function handleWordbookClick(event) {
  const save = event.target.closest("[data-book-save]");
  const saveNote = event.target.closest("[data-book-note-save]");
  if (!save && !saveNote) return;
  const key = save?.dataset.bookSave || saveNote.dataset.bookNoteSave;
  if (wordbookLoadPromise) await wordbookLoadPromise;
  const existing = state.wordbookSaved.get(key);
  if (save && existing) {
    state.wordbookSaved.delete(key);
    await put("meta", {key: WORDBOOK_KEY + key, value: null});
    // Null markers are ignored when the collection is reloaded.
  } else {
    const note = saveNote ? event.target.closest(".wordbook-entry").querySelector("[data-book-note]").value.trim().slice(0, 600) : existing?.note || "";
    const value = {note, savedAt: existing?.savedAt || Date.now()};
    state.wordbookSaved.set(key, value);
    await put("meta", {key: WORDBOOK_KEY + key, value});
  }
  renderWordbook();
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prioritizedWords(stage, sourceWords, wrongWords, slowWords) {
  const all = state.words.filter((word) => stageMatches(word, stage));
  const ordered = [...wrongWords, ...slowWords, ...sourceWords, ...shuffled(all)];
  const seen = new Set();
  return ordered.filter((word) => {
    const key = bookKey(word.en);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function incorrectSpelling(word, known) {
  for (let i = 0; i < 40; i++) {
    const at = 1 + Math.floor(Math.random() * (word.length - 2));
    const mode = i % 4;
    const candidate = mode === 0 ? word.slice(0, at) + word[at + 1] + word[at] + word.slice(at + 2)
      : mode === 1 ? word.slice(0, at) + word.slice(at + 1)
        : mode === 2 ? word.slice(0, at) + word[at] + word.slice(at)
          : word.slice(0, at) + "aeiou"[i % 5] + word.slice(at + 1);
    if (candidate !== word && !known.has(candidate) && /^[a-z]+$/.test(candidate)) return candidate;
  }
  return null;
}

function makeSpellingItems(words) {
  const known = new Set([...learningBook.keys(), ...state.words.map((word) => bookKey(word.en))]);
  const candidates = words.filter((word) => /^[a-z]{4,}$/.test(bookKey(word.en)));
  const selected = candidates.slice(0, 10);
  if (selected.length < 10) throw new Error("拼写题词量不足");
  return shuffled(selected.map((word, index) => ({
    word: word.en, zh: word.zh,
    shown: index < 5 ? word.en : incorrectSpelling(bookKey(word.en), known) || word.en,
    valid: index < 5
  })));
}

function makeFillItems(words, bank) {
  const result = [];
  for (const word of words) {
    const key = bookKey(word.en);
    if (!/^[a-z]{3,}$/.test(key)) continue;
    const found = bank.find((item) => item.word === key);
    const sentence = String(word.contextSentence || found?.english || "").trim();
    if (!new RegExp(`\\b${key}\\b`, "i").test(sentence) || sentence.length > 150 || sentence.split(/\s+/).length > 22) continue;
    const prefix = key.slice(0, Math.min(key.length - 1, Math.max(1, Math.floor(key.length / 4))));
    result.push({word: key, zh: word.zh, sentence, prefix});
    if (result.length === 3) return result;
  }
  throw new Error("拼写填空素材不足");
}

function makeListeningItems(stage, words) {
  const bank = window.WORD_SNAP_LISTENING_BANK?.[stage] || [];
  const byWord = new Map(bank.map((item) => [item.word, item]));
  const selected = [];
  const seen = new Set();
  for (const word of words) {
    const item = byWord.get(bookKey(word.en));
    if (item && !seen.has(item.english)) {
      seen.add(item.english);
      selected.push(item);
    }
    if (selected.length === 20) break;
  }
  for (const item of shuffled(bank)) {
    if (selected.length === 20) break;
    if (!seen.has(item.english)) {
      seen.add(item.english);
      selected.push(item);
    }
  }
  if (selected.length < 20) throw new Error("听力题量不足");
  selected.sort((a, b) => a.english.split(/\s+/).length - b.english.split(/\s+/).length || a.english.length - b.english.length);
  return selected.map((item) => {
    const bigrams = (sentence) => new Set([...sentence].map((char, index) => sentence.slice(index, index + 2)).filter((part) => part.length === 2 && /[\u3400-\u9fff]{2}/.test(part)));
    const answerParts = bigrams(item.chinese);
    const alternatives = shuffled(bank.filter((candidate) => candidate.chinese !== item.chinese
      && !candidate.chinese.includes(item.chinese) && !item.chinese.includes(candidate.chinese)
      && [...bigrams(candidate.chinese)].filter((part) => answerParts.has(part)).length <= 1));
    const distinctAlternatives = [...new Map(alternatives.map((candidate) => [candidate.chinese, candidate])).values()];
    if (distinctAlternatives.length < 2) throw new Error("听力选项不足");
    const choices = shuffled([item.chinese, ...distinctAlternatives.slice(0, 2).map((candidate) => candidate.chinese)]);
    return {word: item.word, english: item.english, chinese: item.chinese, audio: item.audio, choices};
  });
}

async function startLearningFlow(report, sourceWords, wrongWords, slowWords) {
  const words = prioritizedWords(report.grade, sourceWords, wrongWords, slowWords);
  const bank = window.WORD_SNAP_LISTENING_BANK?.[report.grade] || [];
  try {
    state.learningFlow = {
      version: 1, phase: "spelling", index: 0, response: null,
      report, startedAt: Date.now(), pausedAt: null, pausedMs: 0,
      scores: {spelling: 0, fill: 0, listening: 0},
      spelling: makeSpellingItems(words), fill: makeFillItems(words, bank),
      listening: makeListeningItems(report.grade, words)
    };
    await saveLearningFlow();
    renderLearningFlow(true);
  } catch (error) {
    els.feedback.textContent = `巩固练习准备失败：${error.message}，请刷新页面重试。`;
    throw error;
  }
}

async function saveLearningFlow() {
  await put("meta", {key: FLOW_KEY, value: state.learningFlow});
  els.resumeFlowBtn.hidden = !state.learningFlow || state.learningFlow.phase === "done";
}

function flowCurrent() {
  const flow = state.learningFlow;
  return flow?.phase === "spelling" ? flow.spelling[flow.index]
    : flow?.phase === "fill" ? flow.fill
      : flow?.phase === "listening" ? flow.listening[flow.index] : null;
}

function flowExplanation(item) {
  const entry = bookEntry(item.word);
  return [entry.definition, entry.mnemonic || entry.note || entry.context].filter(Boolean).join(" · ").slice(0, 480);
}

async function playFlowAudio(replay = false) {
  const flow = state.learningFlow;
  if (!flow || flow.phase !== "listening" || state.viewedCompletion) return;
  const audio = document.querySelector("#flowAudio");
  const item = flowCurrent();
  const source = new URL(item.audio, document.baseURI).href;
  if (audio.src !== source) audio.src = source;
  audio.pause();
  try { audio.currentTime = 0; } catch (error) { /* The new source has not loaded yet. */ }
  const status = document.querySelector("#flowAudioStatus");
  if (replay && flow.response?.correct) {
    clearTimeout(flowAdvanceTimer);
    audio.onended = () => { flowAdvanceTimer = setTimeout(nextFlowQuestion, 2000); };
  } else audio.onended = null;
  try {
    await audio.play();
    if (status) status.textContent = "正在播放 · 可点击重听";
  } catch (error) {
    if (status) status.textContent = "请点播放按钮收听句子";
    if (replay && flow.response?.correct) flowAdvanceTimer = setTimeout(nextFlowQuestion, 2000);
  }
}

function renderLearningFlow(show = false) {
  const flow = state.viewedCompletion || state.learningFlow;
  if (!flow) return;
  if (show && !state.viewedCompletion) resumeLearningFlow();
  const overlay = document.querySelector("#learningFlow");
  if (show) overlay.hidden = false;
  if (overlay.hidden) return;
  const phaseNames = {spelling: "拼写判断", fill: "拼写填空", listening: "听力理解", done: "今日结算"};
  document.querySelector("#flowPhase").textContent = flow.report.grade;
  document.querySelector("#flowTitle").textContent = phaseNames[flow.phase];
  const completed = flow.phase === "spelling" ? flow.index : flow.phase === "fill" ? 10 : flow.phase === "listening" ? 11 + flow.index : 31;
  document.querySelector("#flowProgress").style.width = `${completed / 31 * 100}%`;
  const body = document.querySelector("#flowBody");
  const footer = document.querySelector("#flowFooter");
  const response = flow.response;
  if (flow.phase === "done") {
    const count = weeklyLearningDays(new Date(flow.completedAt || Date.now()));
    const accuracy = flow.report.total ? Math.round(flow.report.correct / flow.report.total * 100) : 0;
    const fastRate = flow.report.total ? Math.round((flow.report.fast || 0) / flow.report.total * 100) : 0;
    const title = accuracy >= 80 ? "太棒了，顺利过关！" : "完成了今天的挑战！";
    body.innerHTML = `<div class="flow-summary">
      <div class="flow-summary-banner"><span>本轮学习已完成</span><h3>${title}</h3><p>${formatSessionDate(flow.completedAt || Date.now())}</p></div>
      <div class="flow-summary-meta"><div><span>本次模式</span><strong>${escapeHtml(practiceModeLabel(flow.report.practiceMode))}</strong></div><div><span>所选词汇</span><strong>${escapeHtml(flow.report.grade)}</strong></div><div><span>总用时</span><strong>${formatLearningDuration(flow.totalSeconds ?? flow.report.totalSeconds)}</strong></div></div>
      <div class="flow-summary-stats"><div><strong>${flow.report.total}</strong><span>刷词数</span></div><div><strong>${accuracy}%</strong><span>正确率</span></div><div><strong>${fastRate}%</strong><span>秒选率</span></div></div>
      <div class="flow-summary-practice"><span>巩固练习</span><div><strong>${flow.scores.spelling}/10</strong><small>拼写判断</small></div><div><strong>${flow.scores.fill}/3</strong><small>拼写填空</small></div><div><strong>${flow.scores.listening}/20</strong><small>听力理解</small></div></div>
      <div class="flow-summary-approval"><img src="./assets/teacher-approval.png" alt="来自代老师的肯定" width="254" height="230"><div><h4>得到代老师的肯定！</h4><p>要每天坚持，继续加油！你所有的努力我们都看得到！</p></div></div>
      <div class="flow-summary-weekly"><strong>本周 ${Math.min(count, 5)}/5 天</strong><p>今日的努力已加入每周结算。完成 5 天完整打卡，就能获得丰富奖励。</p></div>
      <p class="flow-summary-reminder">记得截图发给代老师或学长学姐。今日结算也可以从首页再次打开。</p></div>`;
    footer.innerHTML = '<button type="button" id="flowFinish">返回训练</button>';
    footer.querySelector("#flowFinish").addEventListener("click", async () => {
      overlay.hidden = true;
      if (state.viewedCompletion) state.viewedCompletion = null;
      else { state.learningFlow = null; await saveLearningFlow(); }
      renderTodayCompletion();
    });
    return;
  }
  if (flow.phase === "spelling") {
    const item = flowCurrent();
    body.innerHTML = `<div class="flow-question-head"><span>第 ${flow.index + 1} / 10 题</span><p>这个英文单词拼写正确吗？</p></div><strong class="flow-spelling-word">${escapeHtml(item.shown)}</strong>
      <div class="flow-binary"><button type="button" class="secondary" data-spelling="true">✓ <span>正确</span></button><button type="button" class="secondary" data-spelling="false">× <span>错误</span></button></div>`;
    body.querySelectorAll("[data-spelling]").forEach((button) => button.addEventListener("click", () => submitFlowAnswer(button.dataset.spelling === "true")));
  } else if (flow.phase === "fill") {
    body.innerHTML = `<div class="flow-question-head"><span>第 1 / 1 组 · 共 3 空</span><p>根据首字母和句意，写出完整单词。</p></div>
      <div class="flow-fill-list">${flow.fill.map((item, index) => {
        const markup = escapeHtml(item.sentence).replace(new RegExp(`\\b${item.word}\\b`, "i"), `<label class="flow-inline-input"><span>${escapeHtml(item.prefix)}</span><input data-fill="${index}" aria-label="第 ${index + 1} 空，${escapeAttr(item.zh)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>`);
        return `<div class="flow-fill-sentence"><span class="flow-sentence-number">0${index + 1}</span><p>${markup}</p><small>${escapeHtml(item.zh)}</small></div>`;
      }).join("")}</div>`;
    footer.innerHTML = '<button type="button" id="flowCheckFill">检查答案</button>';
    footer.querySelector("#flowCheckFill").addEventListener("click", () => submitFlowAnswer([...body.querySelectorAll("[data-fill]")].map((input) => input.value.trim())));
  } else {
    const item = flowCurrent();
    body.innerHTML = `<div class="flow-question-head"><span>第 ${flow.index + 1} / 20 题</span><p>听句子，选择它的中文意思。</p></div>
      <div class="flow-audio-control"><button type="button" id="flowPlayAudio" aria-label="播放或重播英式英语句子">▶</button><span id="flowAudioStatus">自动播放中 · 可点击重听</span></div>
      <div class="flow-listening-choices">${item.choices.map((choice, index) => `<button type="button" class="secondary" data-listening="${index}"><span>${"ABC"[index]}</span>${escapeHtml(choice)}</button>`).join("")}</div>
      <p class="flow-credit">句子来源：<a href="https://tatoeba.org/" target="_blank" rel="noopener noreferrer">Tatoeba</a> · 英式发音</p>`;
    body.querySelector("#flowPlayAudio").addEventListener("click", () => playFlowAudio(true));
    body.querySelectorAll("[data-listening]").forEach((button) => button.addEventListener("click", () => submitFlowAnswer(Number(button.dataset.listening))));
    if (!response) playFlowAudio();
  }
  if (flow.phase !== "fill") footer.innerHTML = "";
  if (response) {
    body.querySelectorAll("[data-spelling], [data-listening], [data-fill]").forEach((element) => element.disabled = true);
    if (flow.phase === "listening") {
      const item = flowCurrent();
      body.querySelector(`[data-listening="${item.choices.indexOf(item.chinese)}"]`)?.classList.add("is-answer");
      body.insertAdjacentHTML("beforeend", `<div class="flow-transcript"><strong>${escapeHtml(item.english)}</strong><p>${escapeHtml(item.chinese)}</p></div>`);
    }
    const autoNext = flow.phase === "listening" && response.correct;
    footer.innerHTML = `<div class="flow-feedback ${response.correct ? "is-correct" : "is-wrong"}"><strong>${response.correct ? "答对了" : "再记住这个要点"}</strong><p>${escapeHtml(autoNext ? "完整句子已展示，2 秒后进入下一题。" : response.explanation)}</p></div>${autoNext ? "" : '<button type="button" id="flowContinue">继续</button>'}`;
    footer.querySelector("#flowContinue")?.addEventListener("click", nextFlowQuestion);
    if (show && autoNext) {
      clearTimeout(flowAdvanceTimer);
      flowAdvanceTimer = setTimeout(nextFlowQuestion, 2000);
    }
  }
}

async function submitFlowAnswer(value) {
  const flow = state.learningFlow;
  if (!flow || flow.response || flow.phase === "done") return;
  const item = flowCurrent();
  let correct, explanation, points = 0;
  if (flow.phase === "spelling") {
    correct = value === item.valid;
    points = correct ? 1 : 0;
    explanation = `${item.shown}${item.valid ? " 是正确拼写" : " 拼写有误"}。正确形式：${item.word}。${flowExplanation(item)}`;
  } else if (flow.phase === "fill") {
    const answers = value.map((answer) => answer.toLowerCase().replace(/[^a-z]/g, ""));
    const matches = item.map((row, index) => answers[index] === row.word || row.prefix + answers[index] === row.word);
    points = matches.filter(Boolean).length;
    correct = points === 3;
    explanation = item.map((row, index) => `${index + 1}. ${row.word}（${row.zh}）${matches[index] ? " ✓" : ` · ${flowExplanation(row)}`}`).join("\n");
  } else {
    document.querySelector("#flowAudio")?.pause();
    correct = item.choices[value] === item.chinese;
    points = correct ? 1 : 0;
    explanation = `${item.english}｜${item.chinese}。${item.word}：${flowExplanation(item)}`;
  }
  flow.scores[flow.phase] += points;
  flow.response = {correct, explanation};
  await saveLearningFlow();
  renderLearningFlow();
  if (correct) {
    clearTimeout(flowAdvanceTimer);
    flowAdvanceTimer = setTimeout(nextFlowQuestion, flow.phase === "listening" ? 2000 : 650);
  }
}

async function nextFlowQuestion() {
  clearTimeout(flowAdvanceTimer);
  const flow = state.learningFlow;
  if (!flow?.response) return;
  document.querySelector("#flowAudio")?.pause();
  if (flow.phase === "spelling" && flow.index === 9) { flow.phase = "fill"; flow.index = 0; }
  else if (flow.phase === "fill") { flow.phase = "listening"; flow.index = 0; }
  else if (flow.phase === "listening" && flow.index === 19) {
    flow.phase = "done";
    await recordLearningDay();
    await recordLearningCompletion(flow);
  } else flow.index += 1;
  flow.response = null;
  await saveLearningFlow();
  renderLearningFlow();
}

function learningDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weeklyLearningDays(today = new Date()) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return [...state.learningDays].filter((key) => key >= learningDateKey(monday) && key < learningDateKey(nextMonday)).length;
}

async function recordLearningDay() {
  const key = learningDateKey();
  if (state.learningDays.has(key)) return;
  state.learningDays.add(key);
  await put("meta", {key: `learningDay:v1:${key}`, value: {completedAt: Date.now()}});
}
