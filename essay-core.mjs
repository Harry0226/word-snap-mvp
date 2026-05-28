export const ERROR_TYPE_OPTIONS = [
  "tense",
  "subject_verb_agreement",
  "plural",
  "article",
  "preposition",
  "pronoun",
  "sentence_structure",
  "spelling",
  "punctuation",
  "other"
];

export const REVIEW_LAYOUT = Object.freeze({
  leftGutter: 126,
  rightGutter: 346,
  topPad: 0,
  noteWidth: 252,
  noteHeight: 70,
  noteGap: 18,
  noteStep: 86
});

const ERROR_TYPE_ALIASES = new Map([
  ["grammar", "other"],
  ["tense", "tense"],
  ["subject-verb agreement", "subject_verb_agreement"],
  ["subject_verb_agreement", "subject_verb_agreement"],
  ["sv agreement", "subject_verb_agreement"],
  ["plural", "plural"],
  ["plural form", "plural"],
  ["article", "article"],
  ["articles", "article"],
  ["preposition", "preposition"],
  ["pronoun", "pronoun"],
  ["sentence structure", "sentence_structure"],
  ["sentence_structure", "sentence_structure"],
  ["clause", "sentence_structure"],
  ["spelling", "spelling"],
  ["punctuation", "punctuation"],
  ["other", "other"]
]);

export function normalizeErrorType(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, " ");
  const direct = raw.replace(/\s+/g, "_");
  if (ERROR_TYPE_OPTIONS.includes(direct)) return direct;
  return ERROR_TYPE_ALIASES.get(raw) || "other";
}

export function normalizeIssue(issue = {}) {
  return {
    issueId: String(issue.issueId || "").trim(),
    pageId: String(issue.pageId || "").trim(),
    sourceText: String(issue.sourceText || "").trim(),
    sourceTextForReview: String(issue.sourceTextForReview || issue.sourceText || "").trim(),
    correctedText: String(issue.correctedText || "").trim(),
    errorType: normalizeErrorType(issue.errorType),
    noteZh: String(issue.noteZh || "").trim(),
    noteEn: String(issue.noteEn || "").trim(),
    confidence: clamp(Number(issue.confidence ?? 0.72), 0, 1),
    anchorQuote: String(issue.anchorQuote || issue.sourceText || "").trim(),
    anchorQuoteFromImage: String(issue.anchorQuoteFromImage || issue.anchorQuote || issue.sourceText || "").trim(),
    nearbyText: String(issue.nearbyText || "").trim(),
    anchorBox: normalizeBox(issue.anchorBox),
    circleBox: normalizeBox(issue.circleBox || issue.anchorBox),
    labelBox: normalizeBox(issue.labelBox),
    noteBox: normalizeBox(issue.noteBox || issue.labelBox),
    leaderPath: Array.isArray(issue.leaderPath)
      ? issue.leaderPath.map((point) => normalizePoint(point)).filter(Boolean)
      : [],
    overlayOnly: issue.overlayOnly !== false,
    layoutVersion: Number(issue.layoutVersion || 2),
    needsManualPlacement: Boolean(issue.needsManualPlacement),
    deleted: Boolean(issue.deleted),
    confirmed: Boolean(issue.confirmed)
  };
}

export function normalizeSummaryItem(item = {}) {
  return {
    errorType: normalizeErrorType(item.errorType),
    titleZh: String(item.titleZh || "").trim(),
    explanationZh: String(item.explanationZh || "").trim(),
    examples: Array.isArray(item.examples)
      ? item.examples.map((example) => String(example || "").trim()).filter(Boolean).slice(0, 6)
      : []
  };
}

export function sanitizeEssayReviewResponse(payload = {}) {
  return {
    submissions: Array.isArray(payload.submissions)
      ? payload.submissions.map((submission) => sanitizeSubmission(submission)).filter(Boolean)
      : [],
    classSummary: Array.isArray(payload.classSummary)
      ? payload.classSummary.map(normalizeSummaryItem).filter(hasSummaryContent)
      : [],
    warnings: Array.isArray(payload.warnings)
      ? payload.warnings.map((warning) => String(warning || "").trim()).filter(Boolean)
      : []
  };
}

export function findAnchorBox(blocks = [], anchorQuote = "") {
  const tokens = tokenizeForMatch(anchorQuote);
  if (!tokens.length || !Array.isArray(blocks) || !blocks.length) return null;
  const normalizedBlocks = blocks.map((block) => ({
    ...block,
    matchTokens: tokenizeForMatch(block.text)
  })).filter((block) => block.matchTokens.length);

  for (let startIndex = 0; startIndex < normalizedBlocks.length; startIndex += 1) {
    let tokenIndex = 0;
    let endIndex = startIndex - 1;
    for (let blockIndex = startIndex; blockIndex < normalizedBlocks.length && tokenIndex < tokens.length; blockIndex += 1) {
      const blockTokens = normalizedBlocks[blockIndex].matchTokens;
      for (let i = 0; i < blockTokens.length && tokenIndex < tokens.length; i += 1) {
        if (blockTokens[i] !== tokens[tokenIndex]) {
          tokenIndex = -1;
          break;
        }
        tokenIndex += 1;
        endIndex = blockIndex;
      }
      if (tokenIndex === -1) break;
    }
    if (tokenIndex === tokens.length && endIndex >= startIndex) {
      const matched = normalizedBlocks.slice(startIndex, endIndex + 1);
      return mergeBoxes(matched);
    }
  }
  return null;
}

export function placeIssueOnPage(issue, page, issueIndex = 0) {
  const pageWidth = page.width || 1200;
  const pageHeight = page.height || 1600;
  const baseAnchor = issue.circleBox || issue.anchorBox || findAnchorBox(page.ocrBlocks || [], issue.anchorQuoteFromImage || issue.anchorQuote || issue.sourceText);
  const anchorBox = baseAnchor
    ? {
      x: baseAnchor.x + REVIEW_LAYOUT.leftGutter,
      y: baseAnchor.y + REVIEW_LAYOUT.topPad,
      width: baseAnchor.width,
      height: baseAnchor.height
    }
    : null;
  const columnSide = issueIndex % 7 < 6 ? "right" : "left";
  const stackIndex = columnSide === "right" ? issueIndex : issueIndex - 6;
  const fallbackY = Math.min(
    REVIEW_LAYOUT.noteGap + Math.max(0, stackIndex) * REVIEW_LAYOUT.noteStep,
    Math.max(REVIEW_LAYOUT.noteGap, pageHeight - REVIEW_LAYOUT.noteHeight - REVIEW_LAYOUT.noteGap)
  );
  const noteBox = issue.noteBox || issue.labelBox || {
    x: columnSide === "right"
      ? REVIEW_LAYOUT.leftGutter + pageWidth + 18
      : Math.max(18, REVIEW_LAYOUT.leftGutter - REVIEW_LAYOUT.noteWidth - 18),
    y: fallbackY,
    width: REVIEW_LAYOUT.noteWidth,
    height: REVIEW_LAYOUT.noteHeight
  };
  return {
    ...issue,
    sourceTextForReview: issue.sourceTextForReview || issue.sourceText || "",
    anchorQuoteFromImage: issue.anchorQuoteFromImage || issue.anchorQuote || issue.sourceText || "",
    anchorBox,
    circleBox: anchorBox,
    labelBox: noteBox,
    noteBox,
    overlayOnly: true,
    layoutVersion: 2,
    needsManualPlacement: !anchorBox
  };
}

export function buildEssayExportPayload({ batches = [], submissions = [], meta = [] } = {}) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    batches,
    submissions,
    meta
  };
}

function sanitizeSubmission(submission = {}) {
  const issues = Array.isArray(submission.issues)
    ? submission.issues.map(normalizeIssue).filter(hasIssueContent)
    : [];
  return {
    submissionId: String(submission.submissionId || "").trim(),
    recognizedText: String(submission.recognizedText || "").trim(),
    introRewrite: String(submission.introRewrite || "").trim(),
    outroRewrite: String(submission.outroRewrite || "").trim(),
    personalSummary: Array.isArray(submission.personalSummary)
      ? submission.personalSummary.map(normalizeSummaryItem).filter(hasSummaryContent)
      : [],
    issues,
    warnings: Array.isArray(submission.warnings)
      ? submission.warnings.map((warning) => String(warning || "").trim()).filter(Boolean)
      : []
  };
}

function hasIssueContent(issue) {
  return Boolean(issue.sourceText && issue.correctedText && issue.noteZh && issue.noteEn);
}

function hasSummaryContent(item) {
  return Boolean(item.titleZh || item.explanationZh || item.examples.length);
}

function tokenizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeBox(box) {
  if (!box || typeof box !== "object") return null;
  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width);
  const height = Number(box.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

function normalizePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (![x, y].every(Number.isFinite)) return null;
  return { x, y };
}

function mergeBoxes(blocks) {
  const x1 = Math.min(...blocks.map((block) => Number(block.x) || 0));
  const y1 = Math.min(...blocks.map((block) => Number(block.y) || 0));
  const x2 = Math.max(...blocks.map((block) => (Number(block.x) || 0) + (Number(block.width) || 0)));
  const y2 = Math.max(...blocks.map((block) => (Number(block.y) || 0) + (Number(block.height) || 0)));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
