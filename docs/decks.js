(function initDecksModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapDecks = api;
})(typeof window !== "undefined" ? window : globalThis, function createDecksModule() {
  const { escapeHtml, escapeAttr } = typeof window !== "undefined" && window.WordSnapUtils
    ? window.WordSnapUtils
    : require("./utils.js");
  const COMMON_NOISE = new Set(["the", "and", "for", "with", "from", "this", "that", "page", "unit", "name", "class"]);

  function isSectionHeader(line) {
    return /^[A-Z](?:-[A-Z])?$/.test(line);
  }

  function matchCompactWordLine(line) {
    const match = line.match(/^([A-Za-z][A-Za-z'-]{0,24})([\u4e00-\u9fff].*)$/);
    if (!match) return null;
    return [match[0], match[1], "", "", match[2]];
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

  function setImportStatus(els, text) {
    if (!els.importStatus) return;
    els.importStatus.textContent = text;
    els.importStatus.hidden = !text;
  }

  function renderReviewRows(state, els) {
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

  function syncReviewRowsFromDom(state, els) {
    els.reviewBody.querySelectorAll("input").forEach((input) => {
      const index = Number(input.dataset.index);
      state.reviewRows[index][input.dataset.field] = input.value.trim();
    });
  }

  async function saveReviewDeck(ctx) {
    const { state, els, putBatch, loadState } = ctx;
    syncReviewRowsFromDom(state, els);
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
      goals: [stage],
      source,
      sourceType: "custom",
      frequency: 0,
      createdAt,
      order: index + 1
    }));
    if (!rows.length) {
      setImportStatus(els, "没有可保存的英文词条。");
      return;
    }
    await putBatch("words", rows);
    state.reviewRows = [];
    els.reviewPanel.hidden = true;
    els.textImport.value = "";
    setImportStatus(els, `已保存 ${rows.length} 个词到 ${stage}。`);
    await loadState();
  }

  async function exportData(state) {
    const payload = { version: 2, exportedAt: new Date().toISOString(), words: state.words, records: [...state.records.values()] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `秒懂词词库-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file, ctx) {
    const { state, els, putBatch, loadState } = ctx;
    const data = JSON.parse(await file.text());
    const words = Array.isArray(data.words) ? data.words : [];
    const records = Array.isArray(data.records) ? data.records : [];
    const existingIds = new Set(state.words.map((w) => w.id));
    const conflictCount = words.filter((w) => existingIds.has(w.id)).length;
    if (conflictCount > 0 && !confirm(`导入的词库中有 ${conflictCount} 个词与已有词库 ID 重复，将被覆盖。确定继续？`)) return;
    await putBatch("words", words);
    await putBatch("records", records);
    await loadState();
    setImportStatus(els, `已导入 ${words.length} 个词、${records.length} 条记录。${conflictCount > 0 ? `（覆盖 ${conflictCount} 条）` : ""}`);
  }

  function renderDecks(state, els) {
    const groups = new Map();
    state.words.forEach((word) => {
      const key = `${word.sourceType}|${word.source}|${word.grade}`;
      if (!groups.has(key)) groups.set(key, { ...word, count: 0 });
      groups.get(key).count += 1;
    });
    if (!groups.size) {
      els.deckList.innerHTML = "<p class='empty-state'>暂无词库</p>";
      return;
    }
    els.deckList.innerHTML = [...groups.values()].sort((a, b) => a.grade.localeCompare(b.grade, "zh")).map((deck) => `
      <div class="deck-card">
        <div class="deck-card-main">
          <strong>${escapeHtml(deck.source)}</strong>
          <span class="meta">${escapeHtml(deck.grade)}</span>
        </div>
        <div class="deck-card-aside">
          <span class="deck-count">${deck.count} 词</span>
          <span class="deck-type">${deck.sourceType === "builtin" ? "内置" : "自定义"}</span>
        </div>
      </div>
    `).join("");
  }

  function renderWeakList(ctx) {
    const { state, els, isWrongWord, isSlowWord, priorityScore, getRecord } = ctx;
    els.weakFilterBtns.forEach((button) => {
      button.classList.toggle("active", button.dataset.weakFilter === state.weakFilter);
    });
    const isTarget = state.weakFilter === "slow" ? isSlowWord : isWrongWord;
    const label = state.weakFilter === "slow" ? "慢词" : "错词";
    const words = state.words.filter(isTarget).sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 120);
    if (!words.length) {
      els.weakList.innerHTML = `<p class='empty-state'>暂无${label}</p>`;
      return;
    }
    els.weakList.innerHTML = words.map((word) => {
      const record = getRecord(word.id);
      const countText = state.weakFilter === "slow" ? `慢 ${record.slow}` : `错 ${record.wrong}`;
      return `<div class="word-chip">
        <div class="word-chip-head">
          <strong>${escapeHtml(word.en)}</strong>
          <span class="word-chip-badge">${countText}</span>
        </div>
        <span class="word-chip-zh">${escapeHtml(word.zh)}</span>
        <span class="word-chip-meta">${escapeHtml(word.grade)} · 掌握 ${record.mastery}%</span>
      </div>`;
    }).join("");
  }

  function renderReport(ctx) {
    const { state, els, STAGES, stageMatches, priorityScore, percent } = ctx;
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
      for (const stage of STAGES) {
        if (stageMatches(word, stage)) {
          const stat = stageStats.get(stage);
          stat.total += 1;
          if (record?.seen > 0) stat.practiced += 1;
          if ((record?.mastery || 0) >= 80) stat.mastered += 1;
        }
      }
      if (!record) continue;
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

    const overviewHtml = `
      <div class="report-summary-row">
        <div class="report-card"><strong>${todaySeen}</strong><span>今日练习</span></div>
        <div class="report-card"><strong>${todayAccuracy}</strong><span>今日正确率</span></div>
        <div class="report-card"><strong>${due}</strong><span>待复习</span></div>
        <div class="report-card report-card-wide"><strong>${topReview.length ? topReview.map((w) => escapeHtml(w.en)).slice(0, 5).join(" · ") : "—"}</strong><span>优先复习</span></div>
      </div>
    `;

    const stagesHtml = byStage.length ? `
      <div class="report-stage-list">
        ${byStage.map((item) => {
          const pct = item.total ? Math.round((item.practiced / item.total) * 100) : 0;
          return `<div class="report-stage-row">
            <div class="report-stage-info">
              <strong>${escapeHtml(item.stage)}</strong>
              <span>${item.practiced}/${item.total} 已练 · ${item.mastered} 已掌握</span>
            </div>
            <div class="report-stage-bar"><div style="width:${pct}%"></div></div>
            <span class="report-stage-pct">${pct}%</span>
          </div>`;
        }).join("")}
      </div>
    ` : "";

    els.reportContent.innerHTML = overviewHtml + stagesHtml;
  }

  function bindDecksEvents(ctx) {
    const { state, els, storage, loadState, switchView, startSession, resetStreak, renderWeakListFn } = ctx;
    els.parseTextBtn.addEventListener("click", () => {
      state.reviewRows = parseWordsFromText(els.textImport.value);
      if (!state.reviewRows.length) state.reviewRows = [{ en: "", zh: "", pos: "", notes: "" }];
      renderReviewRows(state, els);
      els.reviewPanel.hidden = false;
      setImportStatus(els, `从文字中解析到 ${state.reviewRows.length} 条候选词，请确认后保存。`);
    });
    els.addRowBtn.addEventListener("click", () => {
      syncReviewRowsFromDom(state, els);
      state.reviewRows.push({ en: "", zh: "", pos: "", notes: "" });
      renderReviewRows(state, els);
    });
    els.reviewBody.addEventListener("click", (event) => {
      const remove = event.target.dataset.remove;
      if (remove === undefined) return;
      syncReviewRowsFromDom(state, els);
      state.reviewRows.splice(Number(remove), 1);
      renderReviewRows(state, els);
    });
    els.saveDeckBtn.addEventListener("click", () => saveReviewDeck(ctx));
    els.clearCustomDecksBtn.addEventListener("click", async () => {
      if (!confirm("确定清空所有自定义词库吗？内置词库和练习记录会保留。")) return;
      await storage.deleteWordsBySourceType(state.db, "custom");
      await loadState();
    });
    els.resetRecordsBtn.addEventListener("click", async () => {
      if (!confirm(`确定清空所有练习记录吗？词库会保留，${els.stageSelect.value}的刷词火花将从 0 开始。`)) return;
      await storage.clearStore(state.db, "records");
      await resetStreak("train", els.stageSelect.value);
      await loadState();
    });
    els.exportBtn.addEventListener("click", () => exportData(state));
    els.importJson.addEventListener("change", () => {
      const file = els.importJson.files?.[0];
      if (file) importData(file, ctx);
    });
    els.weakFilterBtns.forEach((button) => {
      button.addEventListener("click", () => {
        state.weakFilter = button.dataset.weakFilter;
        renderWeakListFn();
      });
    });
    els.trainWeakBtn.addEventListener("click", () => {
      switchView("train");
      els.trainingScope.value = state.weakFilter === "slow" ? "slow" : "wrong";
      els.sessionSize.value = "all";
      startSession();
    });
  }

  return {
    COMMON_NOISE,
    isSectionHeader,
    matchCompactWordLine,
    parseWordsFromText,
    renderReviewRows,
    syncReviewRowsFromDom,
    saveReviewDeck,
    exportData,
    importData,
    renderDecks,
    renderWeakList,
    renderReport,
    bindDecksEvents
  };
});
