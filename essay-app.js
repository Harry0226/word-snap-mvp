import {
  buildEssayExportPayload,
  REVIEW_LAYOUT,
  placeIssueOnPage,
  sanitizeEssayReviewResponse
} from "./essay-core.mjs";

const DB_NAME = "essay-review-v1";
const DB_VERSION = 1;
const MAX_PDF_PAGES = 12;

const state = {
  db: null,
  batches: [],
  submissions: [],
  uploadItems: [],
  currentBatchId: "",
  currentSubmissionId: "",
  currentPageId: "",
  selectedIssueId: "",
  viewMode: "annotated",
  drawerTab: "parent",
  zoom: 1,
  drag: null
};

const els = {
  batchName: document.querySelector("#batchName"),
  essayFiles: document.querySelector("#essayFiles"),
  addFilesBtn: document.querySelector("#addFilesBtn"),
  startReviewBtn: document.querySelector("#startReviewBtn"),
  exportEssayDataBtn: document.querySelector("#exportEssayDataBtn"),
  importEssayData: document.querySelector("#importEssayData"),
  uploadStatus: document.querySelector("#uploadStatus"),
  draftList: document.querySelector("#draftList"),
  batchList: document.querySelector("#batchList"),
  prevPageBtn: document.querySelector("#prevPageBtn"),
  nextPageBtn: document.querySelector("#nextPageBtn"),
  viewOriginalBtn: document.querySelector("#viewOriginalBtn"),
  viewAnnotatedBtn: document.querySelector("#viewAnnotatedBtn"),
  viewFocusBtn: document.querySelector("#viewFocusBtn"),
  zoomOutBtn: document.querySelector("#zoomOutBtn"),
  zoomInBtn: document.querySelector("#zoomInBtn"),
  resetZoomBtn: document.querySelector("#resetZoomBtn"),
  exportCurrentBtn: document.querySelector("#exportCurrentBtn"),
  canvasTitle: document.querySelector("#canvasTitle"),
  canvasMeta: document.querySelector("#canvasMeta"),
  canvasEmpty: document.querySelector("#canvasEmpty"),
  essayViewport: document.querySelector("#essayViewport"),
  essayStage: document.querySelector("#essayStage"),
  essayImageWrap: document.querySelector("#essayImageWrap"),
  essayImage: document.querySelector("#essayImage"),
  annotationLayer: document.querySelector("#annotationLayer"),
  issueList: document.querySelector("#issueList"),
  studentTitle: document.querySelector("#studentTitle"),
  studentMeta: document.querySelector("#studentMeta"),
  introRewrite: document.querySelector("#introRewrite"),
  outroRewrite: document.querySelector("#outroRewrite"),
  personalSummary: document.querySelector("#personalSummary"),
  classSummary: document.querySelector("#classSummary"),
  recognizedText: document.querySelector("#recognizedText"),
  copyPersonalBtn: document.querySelector("#copyPersonalBtn"),
  copyClassBtn: document.querySelector("#copyClassBtn"),
  drawerTabs: [...document.querySelectorAll("[data-drawer-tab]")],
  drawerPanes: [...document.querySelectorAll("[data-drawer-pane]")]
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("batches")) db.createObjectStore("batches", { keyPath: "batchId" });
      if (!db.objectStoreNames.contains("submissions")) db.createObjectStore("submissions", { keyPath: "submissionId" });
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

function getMeta(key) {
  return new Promise((resolve, reject) => {
    const request = tx("meta").get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function loadPersistedState() {
  const [batches, submissions, meta] = await Promise.all([
    getAll("batches"),
    getAll("submissions"),
    getAll("meta")
  ]);
  state.batches = batches.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  state.submissions = submissions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  state.uploadItems = meta.find((item) => item.key === "draftUploadItems")?.value || [];
  const lastBatchId = meta.find((item) => item.key === "lastBatchId")?.value || "";
  const batch = state.batches.find((item) => item.batchId === lastBatchId) || state.batches[0] || null;
  if (batch) {
    state.currentBatchId = batch.batchId;
    const batchSubmission = getBatchSubmissions(batch)[0] || null;
    if (batchSubmission) {
      state.currentSubmissionId = batchSubmission.submissionId;
      state.currentPageId = batchSubmission.pages?.[0]?.pageId || "";
    }
  }
  renderAll();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCurrentBatch() {
  return state.batches.find((batch) => batch.batchId === state.currentBatchId) || null;
}

function getCurrentSubmission() {
  return state.submissions.find((submission) => submission.submissionId === state.currentSubmissionId) || null;
}

function getCurrentPage() {
  const submission = getCurrentSubmission();
  return submission?.pages?.find((page) => page.pageId === state.currentPageId) || submission?.pages?.[0] || null;
}

function getBatchSubmissions(batch) {
  if (!batch) return [];
  const ids = new Set(batch.submissionIds || []);
  return state.submissions.filter((submission) => ids.has(submission.submissionId)).sort((a, b) => {
    const nameOrder = String(a.studentName || "").localeCompare(String(b.studentName || ""), "zh-CN");
    return nameOrder || (a.updatedAt || 0) - (b.updatedAt || 0);
  });
}

function getCurrentPageIssues() {
  const submission = getCurrentSubmission();
  const page = getCurrentPage();
  if (!submission || !page) return [];
  return (submission.issues || []).filter((issue) => issue.pageId === page.pageId);
}

function setStatus(message) {
  els.uploadStatus.textContent = message;
}

function renderAll() {
  renderDraftList();
  renderBatchList();
  renderCanvas();
  renderIssueList();
  renderDrawer();
  renderToolbar();
}

function renderDraftList() {
  if (state.uploadItems.length) {
    els.draftList.innerHTML = state.uploadItems.map((item, index) => `
      <article class="draft-card" data-draft-id="${item.draftId}">
        <h3>${escapeHtml(item.fileName)}${item.pageNo > 1 ? ` · 第 ${item.pageNo} 页` : ""}</h3>
        <p class="draft-meta">图片尺寸 ${item.width} × ${item.height} · ${item.ocrBlocks?.length ? `OCR ${item.ocrBlocks.length} 个词块` : "待 OCR"}</p>
        <div class="draft-grid">
          <label>学生姓名
            <input type="text" data-draft-field="studentName" data-draft-id="${item.draftId}" value="${escapeAttr(item.studentName)}" placeholder="例如：王同学">
          </label>
          <label>作文分组编号
            <input type="text" data-draft-field="essayGroupId" data-draft-id="${item.draftId}" value="${escapeAttr(item.essayGroupId)}" placeholder="同一学生多页时填写相同编号">
          </label>
        </div>
        <div class="draft-actions">
          <button type="button" class="secondary" data-remove-draft="${item.draftId}">移除</button>
        </div>
      </article>
    `).join("");
    return;
  }

  const batch = getCurrentBatch();
  const submissions = getBatchSubmissions(batch);
  if (!submissions.length) {
    els.draftList.innerHTML = "<div class='empty-state'>还没有待批改图片，也没有历史作文任务。</div>";
    return;
  }

  els.draftList.innerHTML = submissions.map((submission) => {
    const issueCount = (submission.issues || []).filter((issue) => !issue.deleted).length;
    return `
      <article class="draft-card ${submission.submissionId === state.currentSubmissionId ? "active" : ""}" data-open-submission="${submission.submissionId}">
        <h3>${escapeHtml(submission.studentName || "未命名学生")}</h3>
        <p class="draft-meta">分组 ${escapeHtml(submission.essayGroupId || "essay")} · ${submission.pages?.length || 0} 页 · ${issueCount} 处问题</p>
        <p class="draft-meta">状态：${escapeHtml(submission.status || "reviewed")} · ${formatDateTime(submission.updatedAt)}</p>
      </article>
    `;
  }).join("");
}

function renderBatchList() {
  if (!state.batches.length) {
    els.batchList.innerHTML = "<div class='empty-state'>还没有历史批改任务。完成一次批改后会自动保存到这里。</div>";
    return;
  }

  els.batchList.innerHTML = state.batches.map((batch) => `
    <article class="batch-card ${batch.batchId === state.currentBatchId ? "active" : ""}" data-open-batch="${batch.batchId}">
      <h3>${escapeHtml(batch.name || "未命名任务")}</h3>
      <p class="batch-meta">${batch.submissionIds?.length || 0} 位学生 · ${batch.classSummary?.length || 0} 类共性错误</p>
      <p class="batch-meta">${formatDateTime(batch.updatedAt)}</p>
    </article>
  `).join("");
}

function renderToolbar() {
  const submission = getCurrentSubmission();
  const page = getCurrentPage();
  const pages = submission?.pages || [];
  const pageIndex = page ? pages.findIndex((item) => item.pageId === page.pageId) : -1;
  els.prevPageBtn.disabled = !submission || pageIndex <= 0;
  els.nextPageBtn.disabled = !submission || pageIndex === -1 || pageIndex >= pages.length - 1;
  els.exportCurrentBtn.disabled = !submission;
  els.viewOriginalBtn.classList.toggle("active", state.viewMode === "original");
  els.viewAnnotatedBtn.classList.toggle("active", state.viewMode === "annotated");
  els.viewFocusBtn.classList.toggle("active", state.viewMode === "focus-issues");
}

function renderCanvas() {
  const submission = getCurrentSubmission();
  const page = getCurrentPage();
  if (!submission || !page) {
    els.canvasEmpty.hidden = false;
    els.essayViewport.hidden = true;
    els.canvasTitle.textContent = "还没有批改结果";
    els.canvasMeta.textContent = "上传图片并开始批改后，这里会显示原图与圈错批注。";
    return;
  }

  els.canvasEmpty.hidden = true;
  els.essayViewport.hidden = false;
  const pageIndex = submission.pages.findIndex((item) => item.pageId === page.pageId) + 1;
  const issues = getCurrentPageIssues();
  const metrics = getStageMetrics(page, issues);
  els.canvasTitle.textContent = `${submission.studentName || "未命名学生"} · 第 ${pageIndex}/${submission.pages.length} 页`;
  els.canvasMeta.textContent = `${submission.warnings?.length ? `提示：${submission.warnings.join("；")}` : "拖动红圈或边缘批注即可微调位置，原图文字不会被改写。"} 缩放倍率 ${Math.round(metrics.renderScale * 100)}%`;
  els.essayImage.src = page.imageDataUrl;
  els.essayImageWrap.style.left = `${metrics.imageX * metrics.renderScale}px`;
  els.essayImageWrap.style.top = `${metrics.imageY * metrics.renderScale}px`;
  els.essayImage.style.width = `${page.width * metrics.renderScale}px`;
  els.essayImage.style.height = `${page.height * metrics.renderScale}px`;
  els.essayStage.style.width = `${metrics.stageWidth * metrics.renderScale}px`;
  els.essayStage.style.height = `${metrics.stageHeight * metrics.renderScale}px`;
  els.essayStage.dataset.viewMode = state.viewMode;
  renderAnnotations(page, issues, metrics);
}

function renderAnnotations(page, issues, metrics) {
  const visibleIssues = state.viewMode === "annotated"
    ? issues.filter((issue) => !issue.deleted)
    : state.viewMode === "focus-issues"
      ? issues.filter((issue) => !issue.deleted)
    : [];
  const svgLines = [];
  const issueNodes = visibleIssues.map((issue, index) => {
    const geometry = getIssueGeometry(issue, page, index);
    const anchor = geometry.anchorBox || { x: metrics.imageX + 18, y: 18, width: 120, height: 36 };
    const note = geometry.noteBox || { x: metrics.imageX + page.width + 18, y: 18, width: 240, height: 64 };
    const selectedClass = issue.issueId === state.selectedIssueId ? "issue-selected" : "";
    const noteSide = note.x < metrics.imageX ? "note-left" : "note-right";
    const line = buildLeaderPath(anchor, note, noteSide === "note-left" ? "left" : "right");
    svgLines.push(`<polyline points="${line.map((point) => `${toStagePixel(point.x, metrics)} ${toStagePixel(point.y, metrics)}`).join(" ")}"></polyline>`);
    return `
      <div class="issue-circle ${selectedClass}" data-issue-id="${issue.issueId}" data-drag-kind="anchor" style="${boxStyle(anchor, metrics)}"></div>
      <div class="issue-note ${noteSide} ${selectedClass} ${issue.needsManualPlacement ? "needs-manual" : ""}" data-issue-id="${issue.issueId}" data-drag-kind="label" style="${boxStyle(note, metrics)}">
        ${noteSide === "note-left"
          ? `<strong>${escapeHtml(issue.noteZh || "待补充中文说明")}<span class="issue-index">${index + 1}</span></strong>`
          : `<strong><span class="issue-index">${index + 1}</span>${escapeHtml(issue.noteZh || "待补充中文说明")}</strong>`}
        <div class="issue-mini">${escapeHtml(issue.noteEn || "Add an English note")}</div>
      </div>
    `;
  }).join("");
  els.annotationLayer.innerHTML = `
    <svg class="leader-layer" aria-hidden="true" viewBox="0 0 ${Math.max(1, Math.round(metrics.stageWidth * metrics.renderScale))} ${Math.max(1, Math.round(metrics.stageHeight * metrics.renderScale))}" preserveAspectRatio="none">
      ${svgLines.join("")}
    </svg>
    ${issueNodes}
  `;
}

function renderIssueList() {
  const issues = getCurrentPageIssues();
  if (!issues.length) {
    els.issueList.innerHTML = "<div class='empty-state'>当前页暂无错误，或还没有完成批改。</div>";
    return;
  }

  els.issueList.innerHTML = issues.map((issue) => `
    <article class="issue-card ${issue.issueId === state.selectedIssueId ? "active" : ""}" data-open-issue="${issue.issueId}">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(issue.sourceTextForReview || issue.sourceText || "未识别原句")} → ${escapeHtml(issue.correctedText || "待修改")}</h3>
          <p><span class="issue-badge">${escapeHtml(issue.errorType)}</span> ${issue.needsManualPlacement ? "<span class='muted-note'>需要手动校正位置</span>" : ""}</p>
        </div>
      </div>
      <label>中文小注释
        <textarea data-issue-field="noteZh" data-issue-id="${issue.issueId}">${escapeHtmlTextarea(issue.noteZh)}</textarea>
      </label>
      <label>English note
        <textarea data-issue-field="noteEn" data-issue-id="${issue.issueId}">${escapeHtmlTextarea(issue.noteEn)}</textarea>
      </label>
      <div class="issue-actions">
        <button type="button" class="secondary" data-toggle-confirm="${issue.issueId}">${issue.confirmed ? "取消确认" : "标记确认"}</button>
        <button type="button" class="secondary" data-toggle-delete="${issue.issueId}">${issue.deleted ? "恢复" : "删除误判"}</button>
      </div>
    </article>
  `).join("");
}

function renderDrawer() {
  const submission = getCurrentSubmission();
  const batch = getCurrentBatch();
  if (!submission) {
    els.studentTitle.textContent = "学生反馈";
    els.studentMeta.textContent = "选择一篇已批改作文后，这里会展示家长沟通、总结和批注编辑内容。";
    els.introRewrite.textContent = "暂无内容";
    els.outroRewrite.textContent = "暂无内容";
    els.personalSummary.innerHTML = "<div class='empty-state'>暂无个人总结。</div>";
    els.classSummary.innerHTML = "<div class='empty-state'>暂无全班总结。</div>";
    els.recognizedText.value = "";
    renderDrawerTabs();
    return;
  }

  els.studentTitle.textContent = `${submission.studentName || "未命名学生"} 的反馈`;
  els.studentMeta.textContent = `${submission.pages?.length || 0} 页作文 · ${formatDateTime(submission.updatedAt)}`;
  els.introRewrite.textContent = submission.introRewrite || "暂无开头优化句";
  els.outroRewrite.textContent = submission.outroRewrite || "暂无结尾优化句";
  els.recognizedText.value = submission.recognizedText || "";
  els.personalSummary.innerHTML = renderSummaryCards(submission.personalSummary, "这位学生暂时没有可归类的常见错误。");
  const batchSubmissions = getBatchSubmissions(batch);
  const classSummary = batchSubmissions.length > 1 ? batch?.classSummary || [] : [];
  els.classSummary.innerHTML = renderSummaryCards(classSummary, "当前只有一位学生时，不展示全班共性错误。");
  renderDrawerTabs();
}

function renderSummaryCards(items, emptyText) {
  if (!items?.length) return `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  return items.map((item) => `
    <article class="summary-card">
      <h3>${escapeHtml(item.titleZh || item.errorType)}</h3>
      <p>${escapeHtml(item.explanationZh || "")}</p>
      ${item.examples?.length ? `<ul>${item.examples.map((example) => `<li>${escapeHtml(example)}</li>`).join("")}</ul>` : ""}
    </article>
  `).join("");
}

async function addFilesFromInput() {
  const files = [...(els.essayFiles.files || [])];
  if (!files.length) {
    setStatus("请先选择至少一张作文图片或 PDF。");
    return;
  }

  els.addFilesBtn.disabled = true;
  try {
    let added = 0;
    for (const file of files) {
      const pages = isPdf(file)
        ? await pdfFileToPageEntries(file)
        : [await imageFileToPageEntry(file)];
      pages.forEach((page, pageIndex) => {
        state.uploadItems.push({
          draftId: makeId("draft"),
          pageId: makeId("page"),
          fileName: file.name,
          pageNo: page.pageNo || pageIndex + 1,
          studentName: "",
          essayGroupId: `essay-${state.uploadItems.length + added + 1}`,
          imageDataUrl: page.imageDataUrl,
          width: page.width,
          height: page.height,
          ocrBlocks: []
        });
        added += 1;
      });
    }
    els.essayFiles.value = "";
    await saveDraftUploadItems();
    renderAll();
    setStatus(`已加入 ${added} 张待批改页面。填写学生姓名后即可开始批改。`);
  } catch (error) {
    setStatus(`加入文件失败：${error.message || error}`);
  } finally {
    els.addFilesBtn.disabled = false;
  }
}

async function startReview() {
  if (!state.uploadItems.length) {
    setStatus("请先加入待批改页面。");
    return;
  }

  els.startReviewBtn.disabled = true;
  try {
    const preparedItems = await prepareUploadItems();
    const grouped = groupUploadItems(preparedItems);
    const payload = {
      batchName: els.batchName.value.trim(),
      submissions: grouped.map((submission) => ({
        submissionId: submission.submissionId,
        studentName: submission.studentName,
        essayGroupId: submission.essayGroupId,
        pages: submission.pages.map((page) => ({
          pageId: page.pageId,
          fileName: page.fileName,
          dataUrl: page.imageDataUrl,
          ocrText: page.ocrText || ocrTextFromBlocks(page.ocrBlocks || []),
          width: page.width,
          height: page.height
        }))
      })),
      options: {
        annotationLanguage: "bilingual",
        rewriteStyle: "light-polish",
        summaryScope: "grammar-spelling-punctuation"
      }
    };

    setStatus(`正在请求 AI 批改 ${payload.submissions.length} 篇作文，请稍候。`);
    const response = await fetch("/api/essay-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(formatApiError(response.status, data));

    const reviewed = sanitizeEssayReviewResponse(data);
    await persistReviewResults(grouped, reviewed, payload.batchName);
    state.uploadItems = [];
    await saveDraftUploadItems();
    els.batchName.value = "";
    setStatus(`批改完成，共生成 ${grouped.length} 位学生的反馈。可以继续微调圈错位置并导出图片。`);
    await loadPersistedState();
  } catch (error) {
    setStatus(`批改失败：${error.message || error}`);
  } finally {
    els.startReviewBtn.disabled = false;
  }
}

async function prepareUploadItems() {
  const nextItems = [];
  for (let index = 0; index < state.uploadItems.length; index += 1) {
    const item = state.uploadItems[index];
    const studentName = item.studentName.trim() || `学生${index + 1}`;
    const essayGroupId = item.essayGroupId.trim() || `essay-${index + 1}`;
    setStatus(`正在做本地 OCR 定位：第 ${index + 1}/${state.uploadItems.length} 张。`);
    const ocrBlocks = item.ocrBlocks?.length ? item.ocrBlocks : await extractOcrBlocks(item.imageDataUrl);
    nextItems.push({ ...item, studentName, essayGroupId, ocrBlocks, ocrText: item.ocrText || ocrTextFromBlocks(ocrBlocks) });
  }
  state.uploadItems = nextItems;
  await saveDraftUploadItems();
  renderAll();
  return nextItems;
}

function groupUploadItems(items) {
  const groups = new Map();
  items.forEach((item) => {
    const key = `${item.studentName}::${item.essayGroupId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        submissionId: makeId("submission"),
        studentName: item.studentName,
        essayGroupId: item.essayGroupId,
        pages: []
      });
    }
    groups.get(key).pages.push({
      pageId: item.pageId,
      fileName: item.fileName,
      pageNo: item.pageNo,
      imageDataUrl: item.imageDataUrl,
      width: item.width,
      height: item.height,
      ocrBlocks: item.ocrBlocks,
      ocrText: item.ocrText || ocrTextFromBlocks(item.ocrBlocks || []),
      exportedAt: 0
    });
  });
  return [...groups.values()].map((group) => ({
    ...group,
    pages: group.pages.sort((a, b) => a.pageNo - b.pageNo)
  }));
}

function ocrTextFromBlocks(blocks) {
  return blocks.map((block) => String(block.text || "").trim()).filter(Boolean).join(" ");
}

async function persistReviewResults(groupedSubmissions, reviewedData, batchName) {
  const batchId = makeId("batch");
  const createdAt = Date.now();
  const submissions = groupedSubmissions.map((group) => {
    const reviewed = reviewedData.submissions.find((item) => item.submissionId === group.submissionId) || {};
    const issueIndexByPage = new Map();
    const issues = (reviewed.issues || []).map((issue) => {
      const targetPage = group.pages.find((page) => page.pageId === issue.pageId) || group.pages[0];
      const issueIndex = issueIndexByPage.get(targetPage.pageId) || 0;
      issueIndexByPage.set(targetPage.pageId, issueIndex + 1);
      return placeIssueOnPage({ ...issue, pageId: targetPage.pageId }, targetPage, issueIndex);
    });
    return {
      submissionId: group.submissionId,
      batchId,
      essayGroupId: group.essayGroupId,
      studentName: group.studentName,
      pages: group.pages,
      recognizedText: reviewed.recognizedText || "",
      issues,
      introRewrite: reviewed.introRewrite || "",
      outroRewrite: reviewed.outroRewrite || "",
      personalSummary: reviewed.personalSummary || [],
      warnings: reviewed.warnings || [],
      status: "reviewed",
      updatedAt: createdAt
    };
  });

  const batch = {
    batchId,
    name: batchName || `作文批改 ${new Date(createdAt).toLocaleString("zh-CN", { hour12: false })}`,
    submissionIds: submissions.map((item) => item.submissionId),
    classSummary: reviewedData.classSummary || [],
    warnings: reviewedData.warnings || [],
    createdAt,
    updatedAt: createdAt
  };

  for (const submission of submissions) await put("submissions", submission);
  await put("batches", batch);
  await put("meta", { key: "lastBatchId", value: batchId, updatedAt: createdAt });
}

async function extractOcrBlocks(imageDataUrl) {
  if (!window.Tesseract) return [];
  const result = await Tesseract.recognize(imageDataUrl, "eng", {
    logger: (message) => {
      if (message.status === "recognizing text" && Number.isFinite(message.progress)) {
        setStatus(`正在做本地 OCR 定位：${Math.round(message.progress * 100)}%`);
      }
    }
  });
  return (result.data?.words || [])
    .map((word) => ({
      text: String(word.text || "").trim(),
      x: Number(word.bbox?.x0 || 0),
      y: Number(word.bbox?.y0 || 0),
      width: Math.max(0, Number(word.bbox?.x1 || 0) - Number(word.bbox?.x0 || 0)),
      height: Math.max(0, Number(word.bbox?.y1 || 0) - Number(word.bbox?.y0 || 0))
    }))
    .filter((word) => word.text && word.width > 0 && word.height > 0);
}

async function imageFileToPageEntry(file) {
  const canvas = await imageFileToCanvas(file);
  return {
    pageNo: 1,
    imageDataUrl: compressCanvasToDataUrl(canvas),
    width: canvas.width,
    height: canvas.height
  };
}

async function pdfFileToPageEntries(file) {
  if (!window.pdfjsLib) throw new Error("PDF 识别库加载失败，请检查网络。");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, MAX_PDF_PAGES); pageNo += 1) {
    setStatus(`正在提取 PDF：第 ${pageNo}/${Math.min(pdf.numPages, MAX_PDF_PAGES)} 页`);
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    pages.push({
      pageNo,
      imageDataUrl: compressCanvasToDataUrl(canvas),
      width: canvas.width,
      height: canvas.height
    });
  }
  return pages;
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

function compressCanvasToDataUrl(canvas) {
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / canvas.width);
  if (scale < 1) {
    const resized = document.createElement("canvas");
    resized.width = Math.round(canvas.width * scale);
    resized.height = Math.round(canvas.height * scale);
    resized.getContext("2d").drawImage(canvas, 0, 0, resized.width, resized.height);
    return resized.toDataURL("image/jpeg", 0.9);
  }
  return canvas.toDataURL("image/jpeg", 0.9);
}

function isPdf(file) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function openBatch(batchId) {
  const batch = state.batches.find((item) => item.batchId === batchId);
  if (!batch) return;
  state.currentBatchId = batchId;
  const firstSubmission = getBatchSubmissions(batch)[0] || null;
  state.currentSubmissionId = firstSubmission?.submissionId || "";
  state.currentPageId = firstSubmission?.pages?.[0]?.pageId || "";
  state.selectedIssueId = "";
  put("meta", { key: "lastBatchId", value: batchId, updatedAt: Date.now() }).catch(() => {});
  renderAll();
}

function openSubmission(submissionId) {
  const submission = state.submissions.find((item) => item.submissionId === submissionId);
  if (!submission) return;
  state.currentSubmissionId = submissionId;
  state.currentBatchId = submission.batchId;
  state.currentPageId = submission.pages?.[0]?.pageId || "";
  state.selectedIssueId = "";
  put("meta", { key: "lastBatchId", value: submission.batchId, updatedAt: Date.now() }).catch(() => {});
  renderAll();
}

function movePage(direction) {
  const submission = getCurrentSubmission();
  const page = getCurrentPage();
  if (!submission || !page) return;
  const pageIndex = submission.pages.findIndex((item) => item.pageId === page.pageId);
  const next = submission.pages[pageIndex + direction];
  if (!next) return;
  state.currentPageId = next.pageId;
  state.selectedIssueId = "";
  renderAll();
}

function setViewMode(mode) {
  state.viewMode = mode;
  renderAll();
}

function adjustZoom(delta) {
  state.zoom = Math.max(0.55, Math.min(1.85, Number((state.zoom + delta).toFixed(2))));
  renderCanvas();
  renderToolbar();
}

function resetZoom() {
  state.zoom = 1;
  renderCanvas();
  renderToolbar();
}

function updateDraftField(draftId, field, value) {
  const item = state.uploadItems.find((draft) => draft.draftId === draftId);
  if (!item) return;
  item[field] = value;
  saveDraftUploadItems().catch(() => {});
}

function removeDraft(draftId) {
  state.uploadItems = state.uploadItems.filter((draft) => draft.draftId !== draftId);
  saveDraftUploadItems().catch(() => {});
  renderAll();
  setStatus(state.uploadItems.length ? "已更新待批改页面列表。" : "待批改页面已清空。");
}

function findMutableIssue(issueId) {
  const submission = getCurrentSubmission();
  if (!submission) return null;
  const issue = submission.issues.find((item) => item.issueId === issueId);
  return issue ? { submission, issue } : null;
}

async function updateIssueField(issueId, field, value) {
  const pair = findMutableIssue(issueId);
  if (!pair) return;
  pair.issue[field] = value;
  pair.submission.updatedAt = Date.now();
  await persistSubmission(pair.submission);
  renderAll();
}

async function toggleIssueFlag(issueId, field) {
  const pair = findMutableIssue(issueId);
  if (!pair) return;
  pair.issue[field] = !pair.issue[field];
  pair.submission.updatedAt = Date.now();
  await persistSubmission(pair.submission);
  renderAll();
}

async function persistSubmission(submission) {
  await put("submissions", submission);
  const batch = state.batches.find((item) => item.batchId === submission.batchId);
  if (batch) {
    batch.updatedAt = Date.now();
    await put("batches", batch);
  }
  const index = state.submissions.findIndex((item) => item.submissionId === submission.submissionId);
  if (index >= 0) state.submissions[index] = submission;
}

function startDrag(event) {
  const target = event.target.closest("[data-drag-kind]");
  if (!target) return;
  const issueId = target.dataset.issueId;
  const kind = target.dataset.dragKind;
  const pair = findMutableIssue(issueId);
  const page = getCurrentPage();
  if (!pair || !page) return;
  const geometry = getIssueGeometry(pair.issue, page, getCurrentPageIssues().findIndex((issue) => issue.issueId === issueId));
  const box = kind === "anchor" ? geometry.anchorBox : geometry.noteBox;
  if (!box) return;
  if (kind === "anchor") {
    pair.issue.anchorBox = { ...box };
    pair.issue.circleBox = { ...box };
  } else {
    pair.issue.labelBox = { ...box };
    pair.issue.noteBox = { ...box };
  }

  const rect = els.essayStage.getBoundingClientRect();
  const metrics = getStageMetrics(page, getCurrentPageIssues());
  const x = (event.clientX - rect.left) / metrics.renderScale;
  const y = (event.clientY - rect.top) / metrics.renderScale;
  state.drag = {
    issueId,
    kind,
    metrics,
    dx: x - box.x,
    dy: y - box.y
  };
  state.selectedIssueId = issueId;
  renderAll();
}

async function onPointerMove(event) {
  if (!state.drag) return;
  const pair = findMutableIssue(state.drag.issueId);
  const page = getCurrentPage();
  if (!pair || !page) return;
  const rect = els.essayStage.getBoundingClientRect();
  const currentX = (event.clientX - rect.left) / state.drag.metrics.renderScale - state.drag.dx;
  const currentY = (event.clientY - rect.top) / state.drag.metrics.renderScale - state.drag.dy;
  const targetBox = state.drag.kind === "anchor" ? pair.issue.anchorBox : pair.issue.labelBox;
  if (!targetBox) return;
  const width = targetBox.width;
  const height = targetBox.height;
  const bounds = state.drag.kind === "anchor"
    ? {
      minX: REVIEW_LAYOUT.leftGutter,
      maxX: REVIEW_LAYOUT.leftGutter + page.width - width,
      minY: REVIEW_LAYOUT.topPad,
      maxY: REVIEW_LAYOUT.topPad + page.height - height
    }
    : {
      minX: 12,
      maxX: REVIEW_LAYOUT.leftGutter + page.width + REVIEW_LAYOUT.rightGutter - width - 12,
      minY: 12,
      maxY: Math.max(12, page.height - height - 12)
    };
  targetBox.x = clamp(currentX, bounds.minX, Math.max(bounds.minX, bounds.maxX));
  targetBox.y = clamp(currentY, bounds.minY, Math.max(bounds.minY, bounds.maxY));
  if (state.drag.kind === "anchor") pair.issue.circleBox = { ...targetBox };
  if (state.drag.kind === "label") pair.issue.noteBox = { ...targetBox };
  pair.issue.needsManualPlacement = false;
  renderCanvas();
}

async function onPointerUp() {
  if (!state.drag) return;
  const pair = findMutableIssue(state.drag.issueId);
  state.drag = null;
  if (!pair) return;
  pair.submission.updatedAt = Date.now();
  await persistSubmission(pair.submission);
  renderAll();
}

async function exportCurrentSubmissionImages() {
  const submission = getCurrentSubmission();
  if (!submission) return;
  setStatus(`正在导出 ${submission.studentName || "当前学生"} 的批改图片。`);
  for (let index = 0; index < submission.pages.length; index += 1) {
    const page = submission.pages[index];
    const issues = (submission.issues || []).filter((issue) => issue.pageId === page.pageId && !issue.deleted);
    const blob = await buildAnnotatedImageBlob(page, issues);
    downloadBlob(blob, `${sanitizeFileName(submission.studentName || "student")}-page-${index + 1}.png`);
  }
  setStatus("当前学生的批改图片已开始下载。");
}

async function buildAnnotatedImageBlob(page, issues) {
  const image = await loadImage(page.imageDataUrl);
  const metrics = getStageMetrics(page, issues);
  const canvas = document.createElement("canvas");
  canvas.width = metrics.stageWidth;
  canvas.height = metrics.stageHeight;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffdf9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, metrics.imageX, metrics.imageY, page.width, page.height);
  issues.forEach((issue, index) => drawIssue(ctx, issue, page, index));
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function drawIssue(ctx, issue, page, issueIndex) {
  const geometry = getIssueGeometry(issue, page, issueIndex);
  const anchor = geometry.anchorBox;
  const label = geometry.noteBox;
  if (!anchor || !label) return;
  const line = buildLeaderPath(anchor, label, label.x < REVIEW_LAYOUT.leftGutter ? "left" : "right");
  ctx.save();
  ctx.strokeStyle = "rgba(192,57,43,0.96)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2, Math.max(anchor.width / 2, 18), Math.max(anchor.height / 2, 12), 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  line.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  roundRect(ctx, label.x, label.y, label.width, label.height, 14, "rgba(255,255,255,0.98)", "rgba(220,38,38,0.18)");
  ctx.fillStyle = "rgba(220,38,38,0.96)";
  ctx.beginPath();
  ctx.arc(label.x + 18, label.y + 18, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8ef";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(issueIndex + 1), label.x + 18, label.y + 18);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#c0392b";
  ctx.font = "bold 17px sans-serif";
  drawWrappedText(ctx, issue.noteZh || "待补充中文说明", label.x + 36, label.y + 24, label.width - 48, 20, 3);
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawWrappedText(ctx, text, x, startY, maxWidth, lineHeight, maxLines) {
  const segments = String(text || "")
    .split(/(\s+)/)
    .flatMap((part) => /\s+/.test(part) ? [part] : [...part]);
  const lines = [];
  let current = "";
  segments.forEach((segment) => {
    const attempt = `${current}${segment}`;
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current.trimEnd());
      current = segment.trimStart();
    } else {
      current = attempt;
    }
  });
  if (current) lines.push(current.trimEnd());
  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight, maxWidth);
  });
}

async function exportEssayData() {
  const payload = buildEssayExportPayload({
    batches: state.batches,
    submissions: state.submissions,
    meta: await getAll("meta")
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `essay-review-${new Date().toISOString().slice(0, 10)}.json`);
  setStatus("批改记录已导出。");
}

async function importEssayData(file) {
  const data = JSON.parse(await file.text());
  const batches = Array.isArray(data.batches) ? data.batches : [];
  const submissions = Array.isArray(data.submissions) ? data.submissions : [];
  const meta = Array.isArray(data.meta) ? data.meta : [];
  for (const batch of batches) await put("batches", batch);
  for (const submission of submissions) await put("submissions", submission);
  for (const item of meta) await put("meta", item);
  setStatus(`已导入 ${batches.length} 个历史任务和 ${submissions.length} 篇作文记录。`);
  await loadPersistedState();
}

async function saveDraftUploadItems() {
  if (!state.db) return;
  await put("meta", {
    key: "draftUploadItems",
    value: state.uploadItems,
    updatedAt: Date.now()
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function copyTargetText(targetId) {
  const text = document.querySelector(`#${targetId}`)?.textContent?.trim() || "";
  if (!text || text === "暂无内容") {
    setStatus("当前还没有可复制的内容。");
    return;
  }
  await navigator.clipboard.writeText(text);
  setStatus("已复制到剪贴板。");
}

async function copySummary(kind) {
  const submission = getCurrentSubmission();
  const batch = getCurrentBatch();
  const text = kind === "personal"
    ? buildSummaryText(submission?.personalSummary || [])
    : buildSummaryText((getBatchSubmissions(batch).length > 1 ? batch?.classSummary : []) || []);
  if (!text.trim()) {
    setStatus("当前没有可复制的总结。");
    return;
  }
  await navigator.clipboard.writeText(text);
  setStatus("总结已复制到剪贴板。");
}

function buildSummaryText(items) {
  return (items || []).map((item) => {
    const examples = item.examples?.length ? `例子：${item.examples.join("；")}` : "";
    return [item.titleZh || item.errorType, item.explanationZh || "", examples].filter(Boolean).join("：");
  }).join("\n");
}

function bindEvents() {
  els.addFilesBtn.addEventListener("click", addFilesFromInput);
  els.startReviewBtn.addEventListener("click", startReview);
  els.exportEssayDataBtn.addEventListener("click", exportEssayData);
  els.importEssayData.addEventListener("change", () => {
    const file = els.importEssayData.files?.[0];
    if (file) importEssayData(file);
  });
  els.prevPageBtn.addEventListener("click", () => movePage(-1));
  els.nextPageBtn.addEventListener("click", () => movePage(1));
  els.viewOriginalBtn.addEventListener("click", () => setViewMode("original"));
  els.viewAnnotatedBtn.addEventListener("click", () => setViewMode("annotated"));
  els.viewFocusBtn.addEventListener("click", () => setViewMode("focus-issues"));
  els.zoomOutBtn.addEventListener("click", () => adjustZoom(-0.15));
  els.zoomInBtn.addEventListener("click", () => adjustZoom(0.15));
  els.resetZoomBtn.addEventListener("click", resetZoom);
  els.exportCurrentBtn.addEventListener("click", exportCurrentSubmissionImages);

  els.draftList.addEventListener("input", (event) => {
    const draftId = event.target.dataset.draftId;
    const field = event.target.dataset.draftField;
    if (draftId && field) updateDraftField(draftId, field, event.target.value);
  });
  els.draftList.addEventListener("click", (event) => {
    const removeId = event.target.dataset.removeDraft;
    if (removeId) {
      removeDraft(removeId);
      return;
    }
    const submissionId = event.target.closest("[data-open-submission]")?.dataset.openSubmission;
    if (submissionId) openSubmission(submissionId);
  });
  els.batchList.addEventListener("click", (event) => {
    const batchId = event.target.closest("[data-open-batch]")?.dataset.openBatch;
    if (batchId) openBatch(batchId);
  });
  els.issueList.addEventListener("click", (event) => {
    const issueId = event.target.closest("[data-open-issue]")?.dataset.openIssue;
    if (issueId) state.selectedIssueId = issueId;
    if (event.target.dataset.toggleConfirm) toggleIssueFlag(event.target.dataset.toggleConfirm, "confirmed");
    if (event.target.dataset.toggleDelete) toggleIssueFlag(event.target.dataset.toggleDelete, "deleted");
    renderAll();
  });
  els.issueList.addEventListener("change", (event) => {
    const issueId = event.target.dataset.issueId;
    const field = event.target.dataset.issueField;
    if (issueId && field) updateIssueField(issueId, field, event.target.value.trim());
  });
  els.annotationLayer.addEventListener("pointerdown", startDrag);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => copyTargetText(button.dataset.copyTarget));
  });
  els.drawerTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.drawerTab = button.dataset.drawerTab || "parent";
      renderDrawerTabs();
    });
  });
  els.copyPersonalBtn.addEventListener("click", () => copySummary("personal"));
  els.copyClassBtn.addEventListener("click", () => copySummary("class"));
  window.addEventListener("resize", () => renderCanvas());
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  const text = await response.text().catch(() => "");
  return { rawText: text };
}

function formatApiError(status, payload) {
  if (status === 501) {
    return "当前页面是静态预览服务器，不支持 POST 接口。请改用 `node dev-server.mjs` 启动本地开发服务，或部署到 Cloudflare Pages 后再点“开始批改”。";
  }
  if (status === 503 && /OPENAI_API_KEY/i.test(String(payload?.error || ""))) {
    return "本地开发服务已经能处理接口请求，但还没有配置 OPENAI_API_KEY。请在项目根目录放置 `.dev.vars` 或 `.env`，写入 `OPENAI_API_KEY=你的Key` 后重试。";
  }
  if (payload?.error) return payload.error;
  if (payload?.rawText) return payload.rawText.slice(0, 220);
  return `AI 接口返回 ${status}`;
}

async function init() {
  bindEvents();
  try {
    state.db = await openDb();
    await loadPersistedState();
  } catch (error) {
    setStatus(`初始化失败：${error.message || error}`);
  }
}

function formatDateTime(value) {
  if (!value) return "未保存";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function renderDrawerTabs() {
  els.drawerTabs.forEach((button) => {
    const active = button.dataset.drawerTab === state.drawerTab;
    button.classList.toggle("active", active);
  });
  els.drawerPanes.forEach((pane) => {
    const active = pane.dataset.drawerPane === state.drawerTab;
    pane.classList.toggle("active", active);
    pane.hidden = !active;
  });
}

function getStageMetrics(page) {
  const viewportWidth = Math.max(320, els.essayViewport.clientWidth - 28);
  const viewportHeight = Math.max(420, window.innerHeight * 0.72);
  const stageWidth = REVIEW_LAYOUT.leftGutter + page.width + REVIEW_LAYOUT.rightGutter;
  const stageHeight = REVIEW_LAYOUT.topPad + page.height;
  const fitScale = Math.min(viewportWidth / stageWidth, viewportHeight / stageHeight, 1);
  return {
    stageWidth,
    stageHeight,
    imageX: REVIEW_LAYOUT.leftGutter,
    imageY: REVIEW_LAYOUT.topPad,
    renderScale: Number((fitScale * state.zoom).toFixed(4))
  };
}

function getIssueGeometry(issue, page, issueIndex = 0) {
  const upgraded = placeIssueOnPage({
    ...issue,
    anchorBox: issue.layoutVersion === 2 ? issue.anchorBox : issue.circleBox || issue.anchorBox,
    labelBox: issue.layoutVersion === 2 ? issue.labelBox : null,
    noteBox: issue.layoutVersion === 2 ? issue.noteBox : null
  }, page, Math.max(0, issueIndex));

  const anchorBox = issue.layoutVersion === 2
    ? (issue.circleBox || issue.anchorBox || upgraded.circleBox || upgraded.anchorBox)
    : upgraded.circleBox || upgraded.anchorBox;
  const noteBox = issue.layoutVersion === 2
    ? (issue.noteBox || issue.labelBox || upgraded.noteBox || upgraded.labelBox)
    : upgraded.noteBox || upgraded.labelBox;

  return {
    anchorBox,
    noteBox
  };
}

function buildLeaderPath(anchor, note, side) {
  const anchorPoint = {
    x: side === "left" ? anchor.x : anchor.x + anchor.width,
    y: anchor.y + anchor.height / 2
  };
  const notePoint = {
    x: side === "left" ? note.x + note.width : note.x,
    y: note.y + Math.min(30, note.height / 2)
  };
  const middleX = side === "left"
    ? notePoint.x + 16
    : notePoint.x - 16;
  return [
    anchorPoint,
    { x: middleX, y: anchorPoint.y },
    notePoint
  ];
}

function boxStyle(box, metrics) {
  return `left:${toStagePixel(box.x, metrics)}px;top:${toStagePixel(box.y, metrics)}px;width:${toStagePixel(box.width, metrics)}px;height:${toStagePixel(box.height, metrics)}px;`;
}

function toStagePixel(value, metrics) {
  return Number((value * metrics.renderScale).toFixed(2));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeFileName(value) {
  return String(value || "essay-review").replace(/[^\w\u4e00-\u9fa5-]+/g, "-");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeHtmlTextarea(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

init();
