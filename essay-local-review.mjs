import { normalizeErrorType } from "./essay-core.mjs";

const SUMMARY_META = {
  tense: { titleZh: "时态", explanationZh: "注意根据上下文统一时态，特别是叙事中的过去时。" },
  subject_verb_agreement: { titleZh: "主谓一致", explanationZh: "注意主语和谓语在人称、数上的一致。" },
  plural: { titleZh: "单复数", explanationZh: "注意名词单复数和固定搭配中的形式变化。" },
  article: { titleZh: "冠词", explanationZh: "注意冠词的取舍和常见固定表达。" },
  preposition: { titleZh: "介词/搭配", explanationZh: "注意固定搭配和介词的自然用法。" },
  pronoun: { titleZh: "代词/指代", explanationZh: "注意代词前后指代要一致。" },
  sentence_structure: { titleZh: "句式结构", explanationZh: "注意完整句、从句和句子衔接的准确性。" },
  spelling: { titleZh: "拼写", explanationZh: "注意单词拼写和大小写细节。" },
  punctuation: { titleZh: "标点", explanationZh: "注意断句、逗号和句号的使用。" },
  other: { titleZh: "表达", explanationZh: "注意让表达更自然、更符合英语习惯。" }
};

const RULES = [
  createRule(/in their studies/gi, "students' studies", "pronoun", "指代不一致", "Use a consistent subject reference"),
  createRule(/the technology of ai/gi, "AI technology", "other", "更自然", "Use a more natural English expression"),
  createRule(/developing fast/gi, "developing rapidly", "other", "副词", "Use an adverb here"),
  createRule(/\babo can make\b/gi, "also can make", "spelling", "拼写", "Correct the spelling of 'also'"),
  createRule(/got beneficial marks/gi, "got better marks", "other", "搭配", "Use a more natural collocation"),
  createRule(/care about more than 50 students/gi, "help more than 50 students", "other", "表达", "Use a natural verb for support"),
  createRule(/study wisely/gi, "study more wisely", "other", "更自然", "Use a more natural adverbial phrase"),
  createRule(/the reason why i think that is easy/gi, "The reason why I think so is simple", "sentence_structure", "表达", "Rewrite this sentence more naturally"),
  createRule(/ai is improved a lot/gi, "AI has improved a lot", "tense", "时态/语态", "Use the present perfect active voice"),
  createRule(/it is increased to many useful skills are present/gi, "many useful functions have been developed", "sentence_structure", "句式", "Rewrite the whole sentence"),
  createRule(/our skills which are good for writing and reading/gi, "our writing and reading skills", "sentence_structure", "更自然", "Use a shorter noun phrase"),
  createRule(/study at a high speed than before/gi, "study faster than before", "other", "比较级", "Use a comparative adverb"),
  createRule(/the best partner who whenever can help you/gi, "the best partner that can help us whenever we are in trouble", "sentence_structure", "从句", "Fix the relative clause and word order"),
  createRule(/depend on it a lot/gi, "depend on it too much", "other", "更自然", "Use a more natural English phrase"),
  createRule(/a model tool/gi, "a useful tool", "other", "用词", "Choose a more accurate word"),
  createRule(/in a vast field/gi, "in many fields", "other", "更自然", "Use a common English phrase"),
  createRule(/require to exercise more/gi, "need to practise more", "sentence_structure", "句式", "Use the correct verb pattern"),
  createRule(/build our knowledge better/gi, "build a stronger knowledge base", "other", "表达", "Use a more natural noun phrase"),
  createRule(/make a plan in detail/gi, "make detailed plans", "other", "搭配", "Use a natural collocation"),
  createRule(/If we didn't use it correctly/gi, "If we do not use it correctly", "tense", "条件句", "Use the correct tense in a general condition"),
  createRule(/would become our enemy/gi, "might become harmful", "other", "更自然", "Use a more natural expression"),
  createRule(/ought use ai/gi, "ought to use AI", "preposition", "固定搭配", "Use 'ought to'"),
  createRule(/how ai works in studies/gi, "how AI works in students' studies", "other", "更自然", "Use a more natural expression"),
  createRule(/offer huge methods/gi, "offer many methods", "other", "搭配", "Use a natural collocation"),
  createRule(/in numerous way/gi, "in numerous ways", "plural", "单复数", "Use the plural form"),
  createRule(/a fig of switch/gi, "a sign of change", "other", "错误表达", "Replace with a natural phrase"),
  createRule(/update the future/gi, "keep up with the future", "other", "表达", "Use a natural English phrase"),
  createRule(/big tree ,it/gi, "big tree. It", "punctuation", "标点", "Split the sentence correctly"),
  createRule(/one day at the school sports meeting i fell down/gi, "One day, during the school sports meeting, I fell down", "sentence_structure", "句子更自然", "Add time phrases and punctuation"),
  createRule(/my leg was painful/gi, "my leg hurt", "other", "更自然", "Use a natural English expression"),
  createRule(/let me learn we should/gi, "made me realize that we should", "sentence_structure", "从句", "Add the correct clause connector"),
  createRule(/our school,\s*we can have/gi, "our school. We can have", "punctuation", "标点/大小写", "Split the sentence correctly"),
  createRule(/fun activities about helping each other/gi, "meaningful activities that encourage students to help one another", "other", "表达", "Use a more natural phrase"),
  createRule(/She explain/gi, "She explained", "tense", "时态", "Use the past tense"),
  createRule(/do better in it/gi, "do better in English", "other", "搭配", "Use the correct collocation"),
  createRule(/have troubles/gi, "have difficulties", "other", "更自然", "Use a more natural phrase"),
  createRule(/fearless/gi, "fearlessly", "other", "词性", "Use an adverb here"),
  createRule(/take challenges on impossible/gi, "take on seemingly impossible challenges", "other", "搭配", "Use a natural collocation"),
  createRule(/but also to unlock/gi, "but also unlock", "sentence_structure", "平行结构", "Keep the parallel structure"),
  createRule(/the life/gi, "life", "article", "冠词", "No article is needed here"),
  createRule(/Coner/gi, "Corner", "spelling", "拼写", "Correct the spelling"),
  createRule(/It also can/gi, "It can also", "sentence_structure", "语序", "Put the adverb after the modal")
];

export function buildLocalEssayReview(payload = {}) {
  const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
  const reviewedSubmissions = submissions.map((submission, submissionIndex) => reviewSubmission(submission, submissionIndex));
  return {
    submissions: reviewedSubmissions,
    classSummary: buildClassSummary(reviewedSubmissions.flatMap((submission) => submission.issues || [])),
    warnings: ["当前为本地规则批改模式：未配置 OPENAI_API_KEY，结果可用于本地演示与兜底，但精度不如真实 AI 批改。"]
  };
}

function reviewSubmission(submission, submissionIndex) {
  const pages = Array.isArray(submission.pages) ? submission.pages : [];
  const recognizedText = pages.map((page) => normalizeOcrText(page.ocrText || "")).filter(Boolean).join("\n");
  const issues = [];
  pages.forEach((page, pageIndex) => {
    const pageText = normalizeOcrText(page.ocrText || "");
    const used = new Set();
    RULES.forEach((rule) => {
      const matches = pageText.matchAll(rule.pattern);
      for (const match of matches) {
        const sourceText = match[0];
        if (!sourceText || used.has(`${rule.replacement}:${sourceText}`)) continue;
        used.add(`${rule.replacement}:${sourceText}`);
        issues.push({
          issueId: `${submission.submissionId || `sub-${submissionIndex + 1}`}-issue-${issues.length + 1}`,
          pageId: page.pageId || `page-${pageIndex + 1}`,
          sourceText,
          correctedText: rule.replacement,
          errorType: rule.errorType,
          noteZh: `${rule.titleZh}: ${rule.replacement}`,
          noteEn: `${rule.noteEn}: ${rule.replacement}`,
          confidence: 0.72,
          anchorQuote: sourceText,
          nearbyText: extractNearbyText(pageText, sourceText)
        });
      }
    });
  });

  const theme = inferTheme(recognizedText);
  return {
    submissionId: submission.submissionId,
    recognizedText,
    introRewrite: buildRewrite(theme, "intro"),
    outroRewrite: buildRewrite(theme, "outro"),
    personalSummary: buildClassSummary(issues),
    issues,
    warnings: recognizedText ? ["已使用本地 OCR + 规则批改。建议后续接入 OpenAI Key 获取更准确结果。"] : ["OCR 文本较少，当前结果可能不完整。"]
  };
}

function buildClassSummary(issues) {
  const groups = new Map();
  issues.forEach((issue) => {
    const errorType = normalizeErrorType(issue.errorType);
    if (!groups.has(errorType)) groups.set(errorType, []);
    groups.get(errorType).push(issue);
  });
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([errorType, groupedIssues]) => ({
      errorType,
      titleZh: SUMMARY_META[errorType]?.titleZh || SUMMARY_META.other.titleZh,
      explanationZh: SUMMARY_META[errorType]?.explanationZh || SUMMARY_META.other.explanationZh,
      examples: groupedIssues.slice(0, 4).map((issue) => `${issue.sourceText} -> ${issue.correctedText}`)
    }));
}

function inferTheme(text) {
  const lower = text.toLowerCase();
  if (lower.includes("school") && (lower.includes("memory") || lower.includes("sports meeting") || lower.includes("my dear school"))) {
    return "school_memory";
  }
  return "ai_study";
}

function buildRewrite(theme, part) {
  const bank = {
    ai_study: {
      intro: "In my opinion, students can make good use of AI in their studies, because it can improve both learning efficiency and understanding.",
      outro: "To sum up, AI can be a helpful learning partner as long as students use it wisely and do not depend on it completely."
    },
    school_memory: {
      intro: "When I think of a warm memory at school, one unforgettable experience still comes clearly to my mind.",
      outro: "I believe that more caring and meaningful activities will make our school an even warmer and better place for every student."
    }
  };
  return bank[theme]?.[part] || bank.ai_study[part];
}

function normalizeOcrText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function extractNearbyText(text, sourceText) {
  const index = text.toLowerCase().indexOf(String(sourceText || "").toLowerCase());
  if (index === -1) return sourceText;
  return text.slice(Math.max(0, index - 24), Math.min(text.length, index + sourceText.length + 24)).trim();
}

function createRule(pattern, replacement, errorType, titleZh, noteEn) {
  return {
    pattern,
    replacement,
    errorType,
    titleZh,
    noteEn
  };
}
