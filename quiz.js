(function initQuizModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapQuiz = api;
})(typeof window !== "undefined" ? window : globalThis, function createQuizModule() {
  const { escapeHtml, escapeAttr, shuffle, percent, formatDuration } = typeof window !== "undefined" && window.WordSnapUtils
    ? window.WordSnapUtils
    : require("./utils.js");

  const QUIZ_FAST = 5000;
  const QUIZ_SLOW = 12000;
  const GRADE7_QUIZ_COUNT = 186;
  const GRADE8_QUIZ_COUNT = 239;
  const GRADE10_QUIZ_COUNT = 153;
  const GRADE11_QUIZ_COUNT = 129;
  const QUIZ_BANK_SCRIPTS = {
    "初一课本单元词汇": "./word-data/quiz-grade7-sentences.js?v=20260524-grade7",
    "初二课本单元词汇": "./word-data/quiz-grade8-sentences.js?v=20260525-grade8",
    "初三课本单元词汇": "./word-data/quiz-sentences.js?v=20260601-quiz340",
    "高一课本单元词汇": "./word-data/quiz-grade10-sentences.js?v=20260530-senior-quiz",
    "高一课改词库": "./word-data/quiz-grade10-sentences.js?v=20260530-senior-quiz",
    "高二课本单元词汇": "./word-data/quiz-grade11-sentences.js?v=20260530-senior-quiz"
  };

  function setQuizState(els, quizState) {
    if (els.views?.quiz) els.views.quiz.dataset.quizState = quizState;
  }

  function setQuizStatus(els, text) {
    if (!els.quizStatusText) return;
    els.quizStatusText.textContent = text;
    els.quizStatusText.hidden = !text;
  }

  function getQuizSentenceData(grade) {
    if (grade === "初一课本单元词汇") return window.WORD_SNAP_GRADE7_QUIZ_SENTENCES || [];
    if (grade === "初二课本单元词汇") return window.WORD_SNAP_GRADE8_QUIZ_SENTENCES || [];
    if (grade === "初三课本单元词汇") return window.WORD_SNAP_QUIZ_SENTENCES || [];
    if (grade === "高一课本单元词汇") return window.WORD_SNAP_GRADE10_QUIZ_SENTENCES || [];
    if (grade === "高一课改词库") return window.WORD_SNAP_GRADE10_QUIZ_SENTENCES || [];
    if (grade === "高二课本单元词汇") return window.WORD_SNAP_GRADE11_QUIZ_SENTENCES || [];
    return [];
  }

  function loadScriptOnce(ctx, src) {
    return ctx.loadScriptWithRetry(src);
  }

  async function ensureQuizBankLoaded(ctx, grade, isCurrent = () => true) {
    if (isCurrent()) setQuizStatus(ctx.els, "");
    if (getQuizSentenceData(grade).length) return true;
    const src = QUIZ_BANK_SCRIPTS[grade];
    if (!src) return false;
    if (isCurrent()) setQuizStatus(ctx.els, `正在加载 ${grade} 题库...`);
    try {
      await loadScriptOnce(ctx, src);
      if (isCurrent()) setQuizStatus(ctx.els, "");
      return true;
    } catch (error) {
      if (isCurrent()) {
        setQuizStatus(ctx.els, `${grade} 题库加载失败，请刷新重试，或使用备用入口：${ctx.BACKUP_SITE_URL}`);
      }
      return false;
    }
  }

  function getExpectedQuizCount(grade) {
    if (grade === "初一课本单元词汇") return GRADE7_QUIZ_COUNT;
    if (grade === "初二课本单元词汇") return GRADE8_QUIZ_COUNT;
    if (grade === "初三课本单元词汇") return 340;
    if (grade === "高一课本单元词汇") return GRADE10_QUIZ_COUNT;
    if (grade === "高一课改词库") return GRADE10_QUIZ_COUNT;
    if (grade === "高二课本单元词汇") return GRADE11_QUIZ_COUNT;
    return 0;
  }

  function generateWordQuiz(ctx, grade) {
    const words = ctx.state.words.filter((word) => ctx.stageMatches(word, grade) && word.en && word.zh);
    if (!words.length) return [];
    return words
      .filter((w) => w.en && w.zh)
      .map((w, i) => ({ id: `w-${grade}-${i}`, sentence: w.zh, answer: w.en, type: "word" }));
  }

  function getQuizBankTotal(ctx, grade) {
    const sentenceTotal = getQuizSentenceData(grade).length;
    if (sentenceTotal) return sentenceTotal;
    const expectedTotal = getExpectedQuizCount(grade);
    if (expectedTotal) return expectedTotal;
    return generateWordQuiz(ctx, grade).length;
  }

  function getQuizWrongCount(state, grade) {
    return [...state.quizWrongRecords.values()].filter((record) => {
      if (record.grade) return record.grade === grade;
      if (grade === "初一课本单元词汇") return String(record.questionId || "").startsWith("g7-");
      if (grade === "初二课本单元词汇") return String(record.questionId || "").startsWith("g8-");
      if (grade === "初三课本单元词汇") return String(record.questionId || "").startsWith("g9-");
      if (grade === "高一课本单元词汇") return String(record.questionId || "").startsWith("g10-");
      if (grade === "高一课改词库") return String(record.questionId || "").startsWith("g10-");
      if (grade === "高二课本单元词汇") return String(record.questionId || "").startsWith("g11-");
      return false;
    }).length;
  }

  function renderQuizStats(ctx) {
    const { state, els } = ctx;
    const grade = els.quizStage.value;
    const stats = state.quizStats.get(grade) || { attempted: 0, correct: 0, fast: 0 };
    els.quizBankTotal.textContent = getQuizBankTotal(ctx, grade);
    els.quizDoneCount.textContent = stats.attempted || 0;
    els.quizAccuracy.textContent = percent(stats.correct || 0, stats.attempted || 0);
    els.quizFastRate.textContent = percent(stats.fast || 0, stats.attempted || 0);
    els.quizWrongCount.textContent = getQuizWrongCount(state, grade);
  }

  async function recordQuizAnswer(ctx, q, isCorrect, isFast) {
    const { state, els, put, recordDailyActivity } = ctx;
    const grade = state.quiz?.grade || q.grade || els.quizStage.value;
    const stats = state.quizStats.get(grade) || { attempted: 0, correct: 0, fast: 0 };
    stats.attempted += 1;
    stats.correct += isCorrect ? 1 : 0;
    stats.fast += isCorrect && isFast ? 1 : 0;
    state.quizStats.set(grade, stats);
    await put("meta", { key: `quizStats:${grade}`, value: stats, at: Date.now() });
    await recordDailyActivity("quiz", grade);
    renderQuizStats(ctx);
  }

  let quizOptionsToken = 0;

  async function updateQuizSizeOptions(ctx) {
    const { state, els, stageMatches } = ctx;
    const token = ++quizOptionsToken;
    const grade = els.quizStage.value;
    const sel = els.quizSize;
    sel.innerHTML = "";
    await ensureQuizBankLoaded(ctx, grade, () => token === quizOptionsToken);
    if (token !== quizOptionsToken) return;
    const sentenceQuizTotal = getQuizSentenceData(grade).length;
    const expectedQuizTotal = getExpectedQuizCount(grade);
    if (expectedQuizTotal && sentenceQuizTotal !== expectedQuizTotal) {
      sel.innerHTML = `<option value="all">暂无 ${grade} 题库</option>`;
    } else if (sentenceQuizTotal) {
      const opts = [];
      if (sentenceQuizTotal > 50) opts.push('<option value="50" selected>50 题</option>');
      if (sentenceQuizTotal > 100) opts.push('<option value="100">100 题</option>');
      if (sentenceQuizTotal > 150) opts.push('<option value="150">150 题</option>');
      opts.push(`<option value="all">全部 ${sentenceQuizTotal} 题</option>`);
      sel.innerHTML = opts.join("");
    } else {
      try {
        await ctx.ensureStageLoaded(grade);
        await ctx.loadState();
      } catch {}
      if (token !== quizOptionsToken) return;
      const total = state.words.filter((word) => stageMatches(word, grade) && word.en && word.zh).length;
      const opts = [];
      if (total > 50) opts.push('<option value="50" selected>50 词</option>');
      if (total > 100) opts.push('<option value="100">100 词</option>');
      if (total > 150) opts.push('<option value="150">150 词</option>');
      opts.push(`<option value="all">全部 ${total} 词</option>`);
      sel.innerHTML = opts.join("");
    }
    renderQuizStats(ctx);
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

  function hideQuizContinueButton(els) {
    els.quizContinueBtn.hidden = true;
  }

  function showQuizContinueButton(state, els) {
    const quiz = state.quiz;
    els.quizContinueBtn.textContent = quiz?.queue.length ? "继续" : "查看结果";
    els.quizContinueBtn.hidden = false;
    els.quizContinueBtn.focus();
  }

  function startQuizTimer(state, els) {
    clearInterval(state.quiz.timerId);
    els.quizTimer.classList.remove("fast", "slow");
    els.quizTimer.textContent = "用时 0.0 秒";
    state.quiz.timerId = setInterval(() => {
      const elapsed = performance.now() - state.quiz.startedAt;
      els.quizTimer.textContent = `用时 ${(elapsed / 1000).toFixed(1)} 秒`;
      els.quizTimer.classList.toggle("fast", elapsed < QUIZ_FAST);
      els.quizTimer.classList.toggle("slow", elapsed > QUIZ_SLOW);
    }, 100);
  }

  function getQuizProgressValue(quiz) {
    if (!quiz.total) return 0;
    if (quiz.done >= quiz.total) return quiz.total;
    return Math.max(quiz.currentIndex || 1, quiz.done);
  }

  function updateQuizProgress(state, els) {
    const quiz = state.quiz;
    if (!quiz) return;
    const current = getQuizProgressValue(quiz);
    els.quizProgressText.textContent = `${current} / ${quiz.total}`;
    els.quizProgressBar.style.width = `${Math.round((current / quiz.total) * 100)}%`;
  }

  function pulseQuizProgress(els) {
    els.quizProgressBar.classList.remove("quiz-progress-pulse");
    void els.quizProgressBar.offsetWidth;
    els.quizProgressBar.classList.add("quiz-progress-pulse");
    window.setTimeout(() => els.quizProgressBar.classList.remove("quiz-progress-pulse"), 260);
  }

  async function saveQuizWrongAnswer(ctx, q, userAnswer) {
    const { state, els, put } = ctx;
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
    renderQuizStats(ctx);
  }

  async function removeQuizWrongAnswer(ctx, qId) {
    const { state, remove } = ctx;
    state.quizWrongRecords.delete(qId);
    await remove("quizWrongAnswers", qId);
    renderQuizStats(ctx);
  }

  function renderQuizWrongList(state, els) {
    const wrongs = [...state.quizWrongRecords.values()].sort((a, b) => b.lastWrongAt - a.lastWrongAt);
    if (!wrongs.length) {
      els.quizWrongList.innerHTML = "<p class='empty-state'>暂无错题</p>";
      return;
    }
    els.quizWrongList.innerHTML = wrongs.map((r) => `
      <div class="quiz-wrong-item">
        <div class="quiz-wrong-header">
          <span>错 ${r.wrongCount} 次 · <strong>${escapeHtml(r.answer)}</strong></span>
          <button type="button" class="secondary danger quiz-wrong-delete" data-delete-wrong="${escapeAttr(r.questionId)}">删除</button>
        </div>
        <span class="quiz-wrong-sentence">${escapeHtml(r.sentence)}</span>
      </div>
    `).join("");
  }

  async function finishQuiz(ctx) {
    const { state, els } = ctx;
    const quiz = state.quiz;
    clearInterval(quiz.timerId);
    clearTimeout(quiz.advanceTimerId);
    hideQuizContinueButton(els);
    const totalSeconds = Math.max(1, Math.round((performance.now() - quiz.sessionStartedAt) / 1000));

    setQuizState(els, "completed");
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
      <div class="session-report-actions">
        <button id="quizAgainBtn" type="button">${quiz.wrongList.length ? "错题复盘" : "再刷一次"}</button>
        <button id="quizNewBtn" type="button" class="secondary">重新开始</button>
      </div>
    `;

    document.querySelector("#quizAgainBtn").addEventListener("click", () => {
      startQuiz(ctx, Boolean(quiz.wrongList.length));
    });
    document.querySelector("#quizNewBtn").addEventListener("click", () => startQuiz(ctx, false));

    setQuizStatus(
      els,
      quiz.isReview
        ? `复盘完成 · 正确率 ${percent(quiz.correct, quiz.total)}`
        : `完成 · 正确率 ${percent(quiz.correct, quiz.total)} · 错 ${quiz.wrongList.length} 题`
    );

    state.quiz = null;
    renderQuizWrongList(state, els);
  }

  function nextQuizQuestion(ctx) {
    const { state, els, CHOICE_KEYS } = ctx;
    const quiz = state.quiz;
    if (!quiz) return;
    clearTimeout(quiz.advanceTimerId);
    clearInterval(quiz.timerId);
    quiz.advanceTimerId = 0;
    quiz.timerId = 0;
    hideQuizContinueButton(els);
    quiz.answered = false;
    quiz.currentQ = quiz.queue.shift();

    if (!quiz.currentQ) return finishQuiz(ctx);
    quiz.currentIndex = quiz.done + 1;
    setQuizState(els, "playing");

    const q = quiz.currentQ;
    const allChoices = buildQuizChoices(q, quiz.vocabPool);

    els.quizTag.textContent = `${quiz.done + 1} / ${quiz.total}`;
    els.quizSentence.textContent = q.sentence;
    const hintText = q.type !== "word" && q.type !== "multiple-choice" && q.answer?.[0] ? `首字母 ${q.answer[0]}` : "";
    els.quizHint.textContent = hintText;
    els.quizHint.hidden = !hintText;
    els.quizFeedback.textContent = "";
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
      button.addEventListener("click", () => answerQuizChoice(ctx, isQuizAnswerChoice(word, q), button));
      els.quizChoices.append(button);
    });

    quiz.startedAt = performance.now();
    startQuizTimer(state, els);
    updateQuizProgress(state, els);
  }

  async function answerQuizChoice(ctx, isCorrect, button) {
    const { state, els, completePersistentRotationItem, renderAllDebounced } = ctx;
    const quiz = state.quiz;
    if (!quiz || quiz.answered || !quiz.currentQ) return;
    quiz.answered = true;
    clearInterval(quiz.timerId);
    setQuizState(els, "answered");

    const elapsed = performance.now() - quiz.startedAt;
    const q = quiz.currentQ;
    const isFast = elapsed < QUIZ_FAST;
    const isSlow = elapsed > QUIZ_SLOW && isCorrect;

    quiz.done += 1;
    quiz.correct += isCorrect ? 1 : 0;
    if (isCorrect && isFast) quiz.fast += 1;
    if (isCorrect && isSlow) quiz.slow += 1;
    await recordQuizAnswer(ctx, q, isCorrect, isFast);

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
      await saveQuizWrongAnswer(ctx, q, button.querySelector(".choice-text").textContent);
    } else if (quiz.isReview) {
      await removeQuizWrongAnswer(ctx, q.id);
    }
    await completePersistentRotationItem(quiz.rotationKey, q.id);
    renderAllDebounced();

    if (isCorrect && isFast) {
      els.quizFeedback.textContent = "秒选";
    } else if (isCorrect && isSlow) {
      els.quizFeedback.textContent = "正确 · 慢题";
    } else if (isCorrect) {
      els.quizFeedback.textContent = "正确";
    } else {
      els.quizFeedback.textContent = `正确答案：${q.answer}`;
    }

    updateQuizProgress(state, els);
    pulseQuizProgress(els);
    if (isCorrect) {
      quiz.advanceTimerId = setTimeout(() => nextQuizQuestion(ctx), 500);
    } else {
      showQuizContinueButton(state, els);
    }
  }

  async function startQuiz(ctx, isReview) {
    const {
      state, els, ensureStageLoaded, loadState, stageMatches, stageLoadMessage,
      buildQuizRotationKey, prepareRotationBatch, persistRotationState
    } = ctx;
    const grade = els.quizStage.value;
    let allData;
    let vocabPool;
    if (state.quiz) {
      clearInterval(state.quiz.timerId);
      clearTimeout(state.quiz.advanceTimerId);
    }
    hideQuizContinueButton(els);

    await ensureQuizBankLoaded(ctx, grade);
    const sentenceQuizData = getQuizSentenceData(grade);
    const expectedQuizTotal = getExpectedQuizCount(grade);
    if (expectedQuizTotal && sentenceQuizData.length !== expectedQuizTotal) {
      setQuizStatus(els, `${grade} 题库应为 ${expectedQuizTotal} 题，当前未加载`);
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
        setQuizStatus(els, stageLoadMessage(grade, true));
        return;
      }
      allData = generateWordQuiz(ctx, grade);
      vocabPool = state.words.filter((word) => stageMatches(word, grade) && word.en && word.zh);
    }

    if (!allData.length) {
      setQuizStatus(els, "暂无题目");
      return;
    }

    let queue;
    if (isReview) {
      const wrongIds = [...state.quizWrongRecords.keys()];
      queue = allData.filter((q) => wrongIds.includes(q.id));
      if (!queue.length) {
        setQuizStatus(els, "暂无错题");
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
    setQuizStatus(els, "");
    nextQuizQuestion(ctx);
  }

  function bindQuizEvents(ctx) {
    const { state, els, clearStore, resetStreak } = ctx;
    els.startQuizBtn.addEventListener("click", () => startQuiz(ctx, false));
    els.reviewQuizWrongBtn.addEventListener("click", () => startQuiz(ctx, true));
    els.quizContinueBtn.addEventListener("click", () => nextQuizQuestion(ctx));
    els.quizStage.addEventListener("change", async () => {
      await updateQuizSizeOptions(ctx);
      ctx.renderAll();
    });
    els.clearQuizWrongBtn.addEventListener("click", async () => {
      if (!confirm(`确定清空所有刷题错题记录吗？${els.quizStage.value}的刷题火花将从 0 开始。`)) return;
      await clearStore("quizWrongAnswers");
      await resetStreak("quiz", els.quizStage.value);
      state.quizWrongRecords.clear();
      renderQuizStats(ctx);
      renderQuizWrongList(state, els);
    });
    els.quizWrongList.addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-delete-wrong]");
      if (!btn) return;
      await removeQuizWrongAnswer(ctx, btn.dataset.deleteWrong);
      renderQuizWrongList(state, els);
    });
    setQuizState(els, "idle");
  }

  return {
    QUIZ_FAST,
    QUIZ_SLOW,
    QUIZ_BANK_SCRIPTS,
    getQuizSentenceData,
    ensureQuizBankLoaded,
    generateWordQuiz,
    getQuizBankTotal,
    renderQuizStats,
    recordQuizAnswer,
    updateQuizSizeOptions,
    getQuizDistractorsForSentence,
    normalizeQuizChoiceKey,
    isQuizAnswerChoice,
    buildQuizChoices,
    startQuiz,
    nextQuizQuestion,
    answerQuizChoice,
    renderQuizWrongList,
    bindQuizEvents
  };
});
