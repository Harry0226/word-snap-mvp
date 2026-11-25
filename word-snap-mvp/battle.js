(function initBattleModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapBattle = api;
})(typeof window !== "undefined" ? window : globalThis, function createBattleModule() {
  const { escapeHtml, shuffle, uniqueById } = typeof window !== "undefined" && window.WordSnapUtils
    ? window.WordSnapUtils
    : require("./utils.js");

  function setBattleState(els, battleState) {
    if (els.views?.battle) els.views.battle.dataset.battleState = battleState;
  }

  function setBattleStatus(els, text) {
    if (!els.battleStatus) return;
    els.battleStatus.textContent = text;
    els.battleStatus.hidden = !text;
  }

  function setBattleHint(els, text) {
    if (!els.battleHint) return;
    els.battleHint.textContent = text;
    els.battleHint.hidden = !text;
  }

  function getBattleWords(state, stageMatches, stage) {
    return state.words.filter((word) => stageMatches(word, stage) && word.en && word.zh);
  }

  function buildBattleQueue(ctx) {
    const words = getBattleWords(ctx.state, ctx.stageMatches, ctx.els.battleStage.value);
    const sizeValue = ctx.els.battleSize.value;
    const size = sizeValue === "all" ? words.length : Math.min(Number(sizeValue), words.length);
    return shuffle(words).slice(0, size);
  }

  function makeBattleChoices(ctx, answer) {
    const { state, els, stageMatches, selectRankedDistractors, buildChoiceSet } = ctx;
    const mode = state.battle?.mode || "enToZhChoice";
    const stagePool = getBattleWords(state, stageMatches, els.battleStage.value).filter((word) => word.id !== answer.id);
    const fallbackPool = state.words.filter((word) => word.id !== answer.id && word.en && word.zh);
    const distractors = selectRankedDistractors(answer, 3, mode, uniqueById([...stagePool, ...fallbackPool]));
    return shuffle(buildChoiceSet(answer, distractors, mode));
  }

  function renderBattleScore(ctx) {
    const { state, els } = ctx;
    const battle = state.battle;
    els.leftBattleScore.textContent = battle?.scores.left || 0;
    els.rightBattleScore.textContent = battle?.scores.right || 0;
    els.battleProgress.textContent = battle ? `${Math.min(battle.done + 1, battle.total)} / ${battle.total}` : "";
    els.battleProgress.hidden = !battle;
  }

  function markBattleResolved(ctx, winner) {
    const { state, els } = ctx;
    ["left", "right"].forEach((player) => {
      const container = player === "left" ? els.leftBattleChoices : els.rightBattleChoices;
      [...container.children].forEach((button) => {
        button.disabled = true;
        if (button.dataset.wordId === state.battle.current.id) button.classList.add("correct");
        if (player === winner && button.dataset.wordId === state.battle.current.id) button.classList.add("winner");
      });
    });
  }

  function renderBattleChoices(ctx, player) {
    const { state, els, CHOICE_KEYS } = ctx;
    const battle = state.battle;
    const container = player === "left" ? els.leftBattleChoices : els.rightBattleChoices;
    container.innerHTML = "";
    battle.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "battle-choice";
      button.type = "button";
      button.dataset.wordId = choice.id;
      button.innerHTML = `<span>${CHOICE_KEYS[index]}</span><strong>${escapeHtml(battle.mode === "zhToEnChoice" ? choice.en : choice.zh)}</strong>`;
      button.addEventListener("click", () => answerBattle(ctx, player, choice, button));
      container.append(button);
    });
  }

  function answerBattle(ctx, player, choice, button) {
    const { state, els } = ctx;
    const battle = state.battle;
    if (!battle || battle.answered || battle.playerLocked[player]) return;
    const isCorrect = choice.id === battle.current.id;
    if (!isCorrect) {
      battle.playerLocked[player] = true;
      button.classList.add("wrong");
      [...(player === "left" ? els.leftBattleChoices : els.rightBattleChoices).children].forEach((item) => {
        item.disabled = true;
      });
      setBattleStatus(els, `${player === "left" ? "左方" : "右方"}答错，另一方继续`);
      if (battle.playerLocked.left && battle.playerLocked.right) {
        setBattleStatus(els, "双方都答错了，可跳过");
      }
      return;
    }
    battle.answered = true;
    battle.scores[player] += 1;
    battle.done += 1;
    markBattleResolved(ctx, player);
    renderBattleScore(ctx);
    setBattleStatus(els, `${player === "left" ? "左方" : "右方"} +1`);
    setTimeout(() => nextBattleWord(ctx), 900);
  }

  function finishBattle(ctx) {
    const { state, els } = ctx;
    const battle = state.battle;
    const left = battle.scores.left;
    const right = battle.scores.right;
    const result = left === right ? "平局" : left > right ? "左方获胜" : "右方获胜";
    setBattleState(els, "completed");
    els.battlePrompt.textContent = result;
    setBattleHint(els, `${left} : ${right}`);
    const skipText = battle.skipped > 0 ? ` · 跳过 ${battle.skipped}` : "";
    els.battleProgress.textContent = `完成 ${battle.total} 题${skipText}`;
    els.battleProgress.hidden = false;
    setBattleStatus(els, "");
    els.leftBattleChoices.innerHTML = "";
    els.rightBattleChoices.innerHTML = "";
    els.skipBattleBtn.disabled = true;
    els.skipBattleBtn.hidden = true;
    state.battle = null;
  }

  function nextBattleWord(ctx) {
    const { state, els } = ctx;
    const battle = state.battle;
    if (!battle) return;
    battle.current = battle.queue.shift();
    battle.answered = false;
    battle.playerLocked = { left: false, right: false };
    if (!battle.current) return finishBattle(ctx);

    const isPromptChinese = battle.mode === "zhToEnChoice";
    battle.choices = makeBattleChoices(ctx, battle.current);
    els.battlePrompt.textContent = isPromptChinese ? battle.current.zh : battle.current.en;
    setBattleHint(els, "");
    setBattleStatus(els, "");
    renderBattleScore(ctx);
    renderBattleChoices(ctx, "left");
    renderBattleChoices(ctx, "right");
  }

  async function startBattle(ctx) {
    const { state, els, ensureStageLoaded, loadState, stageLoadMessage } = ctx;
    const stage = els.battleStage.value;
    try {
      setBattleStatus(els, stageLoadMessage(stage));
      await ensureStageLoaded(stage);
      await loadState();
    } catch (error) {
      setBattleStatus(els, stageLoadMessage(stage, true));
      return;
    }
    const queue = buildBattleQueue(ctx);
    if (!queue.length) {
      setBattleStatus(els, "当前阶段暂无词汇");
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
    setBattleState(els, "playing");
    els.skipBattleBtn.disabled = false;
    els.skipBattleBtn.hidden = false;
    nextBattleWord(ctx);
  }

  function skipBattleWord(ctx) {
    if (!ctx.state.battle?.current) return;
    ctx.state.battle.done += 1;
    ctx.state.battle.skipped += 1;
    setBattleStatus(ctx.els, "已跳过");
    nextBattleWord(ctx);
  }

  function resetBattle(ctx) {
    const { state, els } = ctx;
    state.battle = null;
    setBattleState(els, "idle");
    els.leftBattleScore.textContent = "0";
    els.rightBattleScore.textContent = "0";
    els.battleProgress.textContent = "";
    els.battleProgress.hidden = true;
    els.battlePrompt.textContent = "—";
    setBattleHint(els, "");
    setBattleStatus(els, "");
    els.leftBattleChoices.innerHTML = "";
    els.rightBattleChoices.innerHTML = "";
    els.skipBattleBtn.disabled = true;
    els.skipBattleBtn.hidden = true;
  }

  function bindBattleEvents(ctx) {
    const { els } = ctx;
    els.startBattleBtn.addEventListener("click", () => startBattle(ctx));
    els.resetBattleBtn.addEventListener("click", () => resetBattle(ctx));
    els.skipBattleBtn.addEventListener("click", () => skipBattleWord(ctx));
    [els.battleStage, els.battleSize, els.battleMode].forEach((el) => {
      el.addEventListener("change", () => resetBattle(ctx));
    });
    resetBattle(ctx);
  }

  return {
    getBattleWords,
    buildBattleQueue,
    makeBattleChoices,
    renderBattleScore,
    markBattleResolved,
    renderBattleChoices,
    answerBattle,
    finishBattle,
    nextBattleWord,
    startBattle,
    skipBattleWord,
    resetBattle,
    bindBattleEvents
  };
});
