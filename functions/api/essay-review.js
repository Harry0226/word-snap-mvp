import { sanitizeEssayReviewResponse } from "../../essay-core.mjs";
import { buildLocalEssayReview } from "../../essay-local-review.mjs";

const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const STRICT_ERROR_TYPES = new Set([
  "tense",
  "subject_verb_agreement",
  "plural",
  "article",
  "preposition",
  "pronoun",
  "sentence_structure",
  "spelling",
  "punctuation"
]);
const SUMMARY_META = {
  tense: { titleZh: "时态", explanationZh: "注意根据上下文统一时态，特别是叙事中的过去时。" },
  subject_verb_agreement: { titleZh: "主谓一致", explanationZh: "注意主语和谓语在人称、数上的一致。" },
  plural: { titleZh: "单复数", explanationZh: "注意名词单复数和固定搭配中的形式变化。" },
  article: { titleZh: "冠词", explanationZh: "注意冠词的取舍和常见固定表达。" },
  preposition: { titleZh: "介词/搭配", explanationZh: "注意固定搭配和介词的基本语法用法。" },
  pronoun: { titleZh: "代词/指代", explanationZh: "注意代词前后指代要一致。" },
  sentence_structure: { titleZh: "句式结构", explanationZh: "注意完整句、从句、平行结构和语序问题。" },
  spelling: { titleZh: "拼写", explanationZh: "注意单词拼写和大小写细节。" },
  punctuation: { titleZh: "标点", explanationZh: "注意断句、逗号、句号和大小写。"}
};

export async function onRequestPost(context) {
  const { request, env } = context;
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
  if (!submissions.length) return json({ error: "No submissions provided." }, 400);

  const cleanedSubmissions = submissions
    .map((submission) => ({
      submissionId: String(submission.submissionId || "").trim(),
      studentName: String(submission.studentName || "").trim(),
      essayGroupId: String(submission.essayGroupId || "").trim(),
      pages: Array.isArray(submission.pages) ? submission.pages.slice(0, 12).map((page) => ({
        pageId: String(page.pageId || "").trim(),
        fileName: String(page.fileName || "").trim(),
        dataUrl: String(page.dataUrl || "").trim(),
        ocrText: String(page.ocrText || "").trim(),
        width: Number(page.width || 0),
        height: Number(page.height || 0)
      })).filter((page) => page.pageId && page.dataUrl) : []
    }))
    .filter((submission) => submission.submissionId && submission.pages.length);

  if (!cleanedSubmissions.length) {
    return json({ error: "No usable submission pages provided." }, 400);
  }

  const provider = resolveEssayProvider(env);
  if (!provider.apiKey) {
    return json(tightenTeacherReview(buildLocalEssayReview({ ...payload, submissions: cleanedSubmissions })));
  }

  const schema = buildSchema();
  const upstream = provider.mode === "mimo-chat"
    ? await callMimoEssayReview(provider, cleanedSubmissions, payload, schema)
    : await callOpenAiEssayReview(provider, cleanedSubmissions, payload, schema);

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return json({ error: data.error?.message || data.message || "AI essay review failed." }, upstream.status);
  }

  const parsed = sanitizeEssayReviewResponse(parseModelJson(data));
  const normalized = alignSubmissionsToRequest(parsed, cleanedSubmissions);
  const merged = provider.mode === "mimo-chat"
    ? mergeWithLocalFallback(normalized, buildLocalEssayReview({ ...payload, submissions: cleanedSubmissions }))
    : normalized;
  return json(tightenTeacherReview(merged));
}

export function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

function buildPrompt(submissions, options, batchName) {
  const summary = submissions.map((submission) => ({
    submissionId: submission.submissionId,
    studentName: submission.studentName,
    essayGroupId: submission.essayGroupId,
    pages: submission.pages.map((page) => ({
      pageId: page.pageId,
      fileName: page.fileName
    }))
  }));

  return [
    "你是一位严谨的中国初高中英语作文老师。",
    "任务：阅读学生作文图片，识别正文，找出需要明确圈出的错误，并输出结构化批改结果。",
    "只圈出三类问题：语法错误、拼写错误、标点错误。",
    "不要把单纯“更高级表达建议”、更地道说法、润色建议当作必须圈出的错误。",
    "每条 issues 都要给出中文小注释 noteZh 和英文小注释 noteEn，适合直接显示在作文图旁边。",
    "introRewrite 和 outroRewrite 只做保留原意的轻润色，不要大改内容。",
    "personalSummary 和 classSummary 按错误类型归类，用中文解释，examples 用错例 -> 正例。",
    "如果页面较模糊、字迹不清或无法确定，请在 warnings 里明确指出低置信度，不要胡乱补全。",
    "pageId 必须使用输入中已经给出的 pageId，submissionId 也必须保持一致。",
    "如果输入里已经附带 OCR 文本，可把它作为辅助参考，但最终仍以图片内容为准。",
    `本次任务名称：${String(batchName || "未命名任务").trim() || "未命名任务"}。`,
    `标注语言：${options.annotationLanguage || "bilingual"}。`,
    `改写风格：${options.rewriteStyle || "light-polish"}。`,
    `总结范围：${options.summaryScope || "grammar-spelling-punctuation"}。`,
    "以下是本次作文的结构，请按此映射输出：",
    JSON.stringify(summary, null, 2)
  ].join("\n");
}

function buildMimoPrompt(submissions, options, batchName) {
  return [
    "你是一位严谨的中国初高中英语作文老师。",
    "任务：基于 OCR 文本完成英语作文批改，并且只返回一个 JSON 对象。",
    "顶层必须有且只能有 3 个字段：submissions、classSummary、warnings。",
    "submissions 必须是数组。每个 submission 必须包含 submissionId、recognizedText、introRewrite、outroRewrite、personalSummary、issues、warnings。",
    "personalSummary 必须是数组。issues 也必须是数组。",
    "issues 每项必须包含 issueId、pageId、sourceText、correctedText、errorType、noteZh、noteEn、confidence、anchorQuote、nearbyText。",
    "只圈出三类问题：语法错误、拼写错误、标点错误。不要把单纯更高级表达建议、更自然表达、润色建议当成必须圈出的错误。",
    "如果 OCR 有噪声，请尽量恢复原句；如果不确定，请在 warnings 里说明。",
    "introRewrite 和 outroRewrite 只做保留原意的轻润色，不要大改。",
    `本次任务名称：${String(batchName || "未命名任务").trim() || "未命名任务"}。`,
    `标注语言：${options.annotationLanguage || "bilingual"}。`,
    `改写风格：${options.rewriteStyle || "light-polish"}。`,
    `总结范围：${options.summaryScope || "grammar-spelling-punctuation"}。`,
    "下面是作文结构和 OCR 文本，请基于这些文本完成批改：",
    JSON.stringify(submissions.map((submission) => ({
      submissionId: submission.submissionId,
      studentName: submission.studentName,
      essayGroupId: submission.essayGroupId,
      pages: submission.pages.map((page) => ({
        pageId: page.pageId,
        fileName: page.fileName,
        ocrText: page.ocrText || ""
      }))
    })), null, 2),
    "只返回 JSON，不要输出 Markdown 代码块，不要添加额外解释，也不要省略任何必须字段。"
  ].join("\n");
}

function flattenSubmissionPages(submissions) {
  return submissions.flatMap((submission) => submission.pages.flatMap((page) => ([
    {
      type: "input_text",
      text: `submissionId=${submission.submissionId}; studentName=${submission.studentName}; essayGroupId=${submission.essayGroupId}; pageId=${page.pageId}; fileName=${page.fileName}; ocrText=${page.ocrText || ""}`
    },
    {
      type: "input_image",
      image_url: page.dataUrl,
      detail: "high"
    }
  ])));
}

async function callOpenAiEssayReview(provider, submissions, payload, schema) {
  const inputContent = [
    {
      type: "input_text",
      text: buildPrompt(submissions, payload.options || {}, payload.batchName)
    },
    ...flattenSubmissionPages(submissions)
  ];

  const body = {
    model: provider.model,
    input: [{ role: "user", content: inputContent }],
    text: {
      format: {
        type: "json_schema",
        name: "essay_review_result",
        strict: true,
        schema
      }
    }
  };

  return fetch(`${provider.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function callMimoEssayReview(provider, submissions, payload, schema) {
  const body = {
    model: provider.model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "你是一位严谨的中国初高中英语作文老师，必须只返回结构化 JSON。"
      },
      {
        role: "user",
        content: buildMimoPrompt(submissions, payload.options || {}, payload.batchName)
      }
    ],
    response_format: {
      type: "json_object"
    }
  };

  return fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function mergeWithLocalFallback(primary, fallback) {
  const fallbackBySubmission = new Map((fallback.submissions || []).map((submission) => [submission.submissionId, submission]));
  let usedCoreFallback = false;
  return {
    submissions: (primary.submissions || []).map((submission) => {
      const backup = fallbackBySubmission.get(submission.submissionId) || {};
      const issueList = hasStrictTeacherIssues(submission.issues) ? submission.issues : (backup.issues || []);
      const usedCurrentCoreFallback = !submission.recognizedText || !hasStrictTeacherIssues(submission.issues) || (!submission.introRewrite && !submission.outroRewrite);
      if (usedCurrentCoreFallback && issueList.length) usedCoreFallback = true;
      return {
        ...submission,
        recognizedText: submission.recognizedText || backup.recognizedText || "",
        introRewrite: submission.introRewrite || backup.introRewrite || "",
        outroRewrite: submission.outroRewrite || backup.outroRewrite || "",
        personalSummary: submission.personalSummary?.length ? submission.personalSummary : (backup.personalSummary || []),
        issues: issueList,
        warnings: submission.warnings || []
      };
    }),
    classSummary: primary.classSummary?.length ? primary.classSummary : (fallback.classSummary || []),
    warnings: uniqueStrings([
      ...(primary.warnings || []),
      ...(usedCoreFallback ? ["MiMo 返回结果不完整，部分字段已使用本地规则补齐。"] : [])
    ])
  };
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["submissions", "classSummary", "warnings"],
    properties: {
      submissions: {
        type: "array",
        maxItems: 24,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["submissionId", "recognizedText", "introRewrite", "outroRewrite", "personalSummary", "issues", "warnings"],
          properties: {
            submissionId: { type: "string" },
            recognizedText: { type: "string" },
            introRewrite: { type: "string" },
            outroRewrite: { type: "string" },
            personalSummary: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["errorType", "titleZh", "explanationZh", "examples"],
                properties: {
                  errorType: { type: "string" },
                  titleZh: { type: "string" },
                  explanationZh: { type: "string" },
                  examples: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            issues: {
              type: "array",
              maxItems: 80,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["issueId", "pageId", "sourceText", "correctedText", "errorType", "noteZh", "noteEn", "confidence", "anchorQuote", "nearbyText"],
                properties: {
                  issueId: { type: "string" },
                  pageId: { type: "string" },
                  sourceText: { type: "string" },
                  correctedText: { type: "string" },
                  errorType: { type: "string" },
                  noteZh: { type: "string" },
                  noteEn: { type: "string" },
                  confidence: { type: "number" },
                  anchorQuote: { type: "string" },
                  nearbyText: { type: "string" }
                }
              }
            },
            warnings: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      },
      classSummary: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["errorType", "titleZh", "explanationZh", "examples"],
          properties: {
            errorType: { type: "string" },
            titleZh: { type: "string" },
            explanationZh: { type: "string" },
            examples: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      },
      warnings: {
        type: "array",
        items: { type: "string" }
      }
    }
  };
}

function alignSubmissionsToRequest(parsed, requestedSubmissions) {
  const alignedSubmissions = requestedSubmissions.map((requested) => {
    const matched = parsed.submissions.find((submission) => submission.submissionId === requested.submissionId) || {};
    const pageIds = new Set(requested.pages.map((page) => page.pageId));
    return {
      submissionId: requested.submissionId,
      recognizedText: String(matched.recognizedText || "").trim(),
      introRewrite: String(matched.introRewrite || "").trim(),
      outroRewrite: String(matched.outroRewrite || "").trim(),
      personalSummary: Array.isArray(matched.personalSummary) ? matched.personalSummary : [],
      issues: Array.isArray(matched.issues)
        ? matched.issues.map((issue, index) => ({
          ...issue,
          issueId: issue.issueId || `${requested.submissionId}-issue-${index + 1}`,
          pageId: pageIds.has(issue.pageId) ? issue.pageId : requested.pages[0].pageId
        }))
        : [],
      warnings: Array.isArray(matched.warnings) ? matched.warnings : []
    };
  });

  return {
    submissions: alignedSubmissions,
    classSummary: Array.isArray(parsed.classSummary) ? parsed.classSummary : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : []
  };
}

function parseModelJson(data) {
  const text = data.output_text || collectOutputText(data.output) || collectChatCompletionText(data);
  if (!text) return { submissions: [], classSummary: [], warnings: ["AI returned no text output."] };
  try {
    return JSON.parse(text);
  } catch {
    return { submissions: [], classSummary: [], warnings: ["AI output was not valid JSON."] };
  }
}

function collectOutputText(output) {
  if (!Array.isArray(output)) return "";
  return output.flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text" && part.text)
    .map((part) => part.text)
    .join("\n");
}

function collectChatCompletionText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && part.text) return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function resolveEssayProvider(env) {
  const apiKey = String(env.OPENAI_ESSAY_API_KEY || env.OPENAI_API_KEY || "").trim();
  const baseUrl = stripTrailingSlash(String(env.OPENAI_ESSAY_BASE_URL || env.OPENAI_BASE_URL || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL);
  const model = String(env.OPENAI_ESSAY_MODEL || env.OPENAI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const mode = /xiaomimimo\.com/i.test(baseUrl) ? "mimo-chat" : "openai-responses";
  return { apiKey, baseUrl, model, mode };
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function uniqueStrings(items) {
  return [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function tightenTeacherReview(review) {
  const submissions = Array.isArray(review?.submissions) ? review.submissions : [];
  const tightenedSubmissions = submissions.map((submission) => {
    const issues = (Array.isArray(submission.issues) ? submission.issues : [])
      .map(toStrictTeacherIssue)
      .filter(Boolean);
    return {
      ...submission,
      issues,
      personalSummary: buildStrictSummary(issues)
    };
  });
  return {
    submissions: tightenedSubmissions,
    classSummary: buildStrictSummary(tightenedSubmissions.flatMap((submission) => submission.issues || [])),
    warnings: Array.isArray(review?.warnings) ? review.warnings : []
  };
}

function buildStrictSummary(issues) {
  const groups = new Map();
  (issues || []).forEach((issue) => {
    const errorType = issue.errorType;
    if (!STRICT_ERROR_TYPES.has(errorType)) return;
    if (!groups.has(errorType)) groups.set(errorType, []);
    groups.get(errorType).push(issue);
  });
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([errorType, groupedIssues]) => ({
      errorType,
      titleZh: SUMMARY_META[errorType]?.titleZh || errorType,
      explanationZh: SUMMARY_META[errorType]?.explanationZh || "",
      examples: groupedIssues.slice(0, 4).map((issue) => `${issue.sourceText} -> ${issue.correctedText}`)
    }));
}

function hasStrictTeacherIssues(issues) {
  return Array.isArray(issues) && issues.some((issue) => Boolean(toStrictTeacherIssue(issue)));
}

function toStrictTeacherIssue(issue) {
  if (!issue || !issue.sourceText || !issue.correctedText) return null;
  const inferredType = inferStrictErrorType(issue);
  if (!inferredType) return null;
  return {
    ...issue,
    errorType: inferredType
  };
}

function inferStrictErrorType(issue) {
  const rawType = String(issue.errorType || "").trim();
  if (STRICT_ERROR_TYPES.has(rawType)) return rawType;

  const text = [
    issue.noteZh,
    issue.noteEn,
    issue.sourceText,
    issue.correctedText,
    issue.anchorQuote,
    issue.nearbyText
  ].map((item) => String(item || "")).join(" ").toLowerCase();

  if (/(拼写|spell|spelling|大小写)/i.test(text)) return "spelling";
  if (/(标点|逗号|句号|punctuation|comma|period|full stop|capital)/i.test(text)) return "punctuation";
  if (/(代词|指代|pronoun)/i.test(text)) return "pronoun";
  if (/(冠词|article)/i.test(text)) return "article";
  if (/(主谓|subject-verb)/i.test(text)) return "subject_verb_agreement";
  if (/(单复数|plural|singular)/i.test(text)) return "plural";
  if (/(介词|preposition|ought to)/i.test(text)) return "preposition";
  if (/(时态|tense|past tense|present perfect|条件句)/i.test(text)) return "tense";
  if (/(句式|从句|语序|平行结构|完整句|sentence structure|clause|word order|parallel)/i.test(text)) return "sentence_structure";
  return null;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
