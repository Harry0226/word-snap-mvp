import test from "node:test";
import assert from "node:assert/strict";

import {
  ERROR_TYPE_OPTIONS,
  findAnchorBox,
  normalizeIssue,
  placeIssueOnPage,
  REVIEW_LAYOUT,
  sanitizeEssayReviewResponse
} from "../essay-core.mjs";
import { buildLocalEssayReview } from "../essay-local-review.mjs";
import { onRequestPost as reviewEssay } from "../functions/api/essay-review.js";

test("normalizeIssue coerces unknown types and trims bilingual notes", () => {
  const issue = normalizeIssue({
    issueId: "issue-1",
    pageId: "page-1",
    sourceText: "I goes",
    correctedText: "I go",
    errorType: "grammar",
    noteZh: "  主谓不一致  ",
    noteEn: "  Subject-verb agreement  ",
    anchorQuote: "goes",
    confidence: 1.4
  });

  assert.equal(issue.errorType, "other");
  assert.equal(issue.noteZh, "主谓不一致");
  assert.equal(issue.noteEn, "Subject-verb agreement");
  assert.equal(issue.confidence, 1);
  assert.equal(issue.deleted, false);
  assert.equal(issue.confirmed, false);
});

test("findAnchorBox matches OCR blocks case-insensitively and merges adjacent words", () => {
  const box = findAnchorBox(
    [
      { text: "I", x: 10, y: 20, width: 12, height: 16 },
      { text: "goes", x: 26, y: 20, width: 44, height: 16 },
      { text: "to", x: 78, y: 20, width: 18, height: 16 },
      { text: "school", x: 102, y: 20, width: 64, height: 16 }
    ],
    "goes to"
  );

  assert.deepEqual(box, { x: 26, y: 20, width: 70, height: 16 });
});

test("sanitizeEssayReviewResponse keeps submission mapping and drops unusable issues", () => {
  const payload = sanitizeEssayReviewResponse({
    submissions: [
      {
        submissionId: "sub-1",
        recognizedText: "I goes to school.",
        introRewrite: "To begin with, I usually walk to school.",
        outroRewrite: "All in all, this experience helps me grow.",
        personalSummary: [
          {
            errorType: "subject_verb_agreement",
            titleZh: "主谓一致",
            explanationZh: "第三人称单数动词需要加 s/es",
            examples: ["I goes -> I go"]
          }
        ],
        issues: [
          {
            issueId: "issue-1",
            pageId: "page-1",
            sourceText: "goes",
            correctedText: "go",
            errorType: "subject_verb_agreement",
            noteZh: "主谓一致错误",
            noteEn: "Use the base verb after I",
            anchorQuote: "goes"
          },
          {
            issueId: "issue-2",
            pageId: "page-1",
            sourceText: "",
            correctedText: "go",
            errorType: "subject_verb_agreement",
            noteZh: "无效",
            noteEn: "invalid"
          }
        ],
        warnings: ["低置信度"]
      }
    ],
    classSummary: [
      {
        errorType: "spelling",
        titleZh: "拼写",
        explanationZh: "注意单词拼写",
        examples: ["becuase -> because"]
      }
    ],
    warnings: ["some warning"]
  });

  assert.equal(ERROR_TYPE_OPTIONS.includes(payload.submissions[0].issues[0].errorType), true);
  assert.equal(payload.submissions[0].issues.length, 1);
  assert.equal(payload.submissions[0].warnings[0], "低置信度");
  assert.equal(payload.classSummary[0].errorType, "spelling");
});

test("placeIssueOnPage keeps annotations overlay-only and places notes outside the image body", () => {
  const placed = placeIssueOnPage({
    issueId: "issue-1",
    pageId: "page-1",
    sourceText: "their studies",
    correctedText: "students' studies",
    errorType: "pronoun",
    noteZh: "指代不一致",
    noteEn: "Use a consistent subject reference",
    anchorQuote: "their studies"
  }, {
    width: 1000,
    height: 1400,
    ocrBlocks: [
      { text: "their", x: 420, y: 220, width: 48, height: 24 },
      { text: "studies", x: 478, y: 220, width: 76, height: 24 }
    ]
  }, 0);

  assert.equal(placed.overlayOnly, true);
  assert.equal(placed.layoutVersion, 2);
  assert.equal(placed.anchorBox.x >= REVIEW_LAYOUT.leftGutter, true);
  assert.equal(placed.noteBox.x > REVIEW_LAYOUT.leftGutter + 1000, true);
});

test("buildLocalEssayReview returns local fallback issues and rewrites for AI essay text", () => {
  const result = buildLocalEssayReview({
    submissions: [
      {
        submissionId: "sub-1",
        studentName: "学生1",
        essayGroupId: "essay-1",
        pages: [
          {
            pageId: "page-1",
            fileName: "sample.jpg",
            ocrText: "I hold the view that AI should be used in their studies. Now, the technology of AI is developing fast. I could have got beneficial marks."
          }
        ]
      }
    ]
  });

  assert.equal(result.submissions.length, 1);
  assert.equal(result.submissions[0].issues.length >= 3, true);
  assert.equal(result.submissions[0].issues.some((issue) => issue.correctedText.includes("students' studies")), true);
  assert.equal(result.submissions[0].introRewrite.length > 10, true);
  assert.equal(result.warnings[0].includes("本地规则批改"), true);
});

test("essay review uses MiMo-compatible chat completions when essay-specific base URL is configured", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  let calledBody = null;

  globalThis.fetch = async (url, init) => {
    calledUrl = String(url);
    calledBody = JSON.parse(String(init.body || "{}"));
    return new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              submissions: [
                {
                  submissionId: "sub-1",
                  recognizedText: "I hold the view that AI should be used in students' studies.",
                  introRewrite: "In my opinion, students can use AI wisely in their studies.",
                  outroRewrite: "To sum up, AI can help students learn better when it is used properly.",
                  personalSummary: [],
                  issues: [
                    {
                      issueId: "issue-1",
                      pageId: "page-1",
                      sourceText: "in their studies",
                      correctedText: "in students' studies",
                      errorType: "pronoun",
                      noteZh: "指代不一致",
                      noteEn: "Use a consistent subject reference",
                      confidence: 0.8,
                      anchorQuote: "in their studies",
                      nearbyText: "AI should be used in their studies"
                    }
                  ],
                  warnings: []
                }
              ],
              classSummary: [],
              warnings: []
            })
          }
        }
      ]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const response = await reviewEssay({
      request: new Request("http://localhost/api/essay-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissions: [
            {
              submissionId: "sub-1",
              studentName: "学生1",
              essayGroupId: "essay-1",
              pages: [
                {
                  pageId: "page-1",
                  fileName: "demo.jpg",
                  dataUrl: "data:image/jpeg;base64,abc",
                  ocrText: "I hold the view that AI should be used in their studies.",
                  width: 1000,
                  height: 1200
                }
              ]
            }
          ]
        })
      }),
      env: {
        OPENAI_ESSAY_API_KEY: "tp-demo-key",
        OPENAI_ESSAY_BASE_URL: "https://token-plan-cn.xiaomimimo.com/v1",
        OPENAI_ESSAY_MODEL: "mimo-v2.5-pro"
      }
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calledUrl, "https://token-plan-cn.xiaomimimo.com/v1/chat/completions");
    assert.equal(calledBody.model, "mimo-v2.5-pro");
    assert.equal(typeof calledBody.messages?.[1]?.content, "string");
    assert.match(calledBody.messages?.[1]?.content || "", /ocrText/i);
    assert.equal(payload.submissions[0].issues[0].correctedText, "in students' studies");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("essay review drops style-only issues and keeps only grammar spelling punctuation style errors", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify({
            submissions: [
              {
                submissionId: "sub-1",
                recognizedText: "My school is like a big tree ,it protects me as I grow up.",
                introRewrite: "My school is like a big tree, giving me warmth and protection as I grow up.",
                outroRewrite: "I believe our school can become a warmer place through more meaningful activities.",
                personalSummary: [
                  {
                    errorType: "punctuation",
                    titleZh: "标点",
                    explanationZh: "注意断句。",
                    examples: ["big tree ,it -> big tree. It"]
                  },
                  {
                    errorType: "other",
                    titleZh: "表达",
                    explanationZh: "更自然。",
                    examples: ["grow up -> grow"]
                  }
                ],
                issues: [
                  {
                    issueId: "i1",
                    pageId: "page-1",
                    sourceText: "big tree ,it",
                    correctedText: "big tree. It",
                    errorType: "punctuation",
                    noteZh: "标点错误",
                    noteEn: "Split the sentence correctly",
                    confidence: 0.9,
                    anchorQuote: "big tree ,it",
                    nearbyText: "My school is like a big tree ,it protects me"
                  },
                  {
                    issueId: "i2",
                    pageId: "page-1",
                    sourceText: "grow up",
                    correctedText: "grow",
                    errorType: "other",
                    noteZh: "更自然",
                    noteEn: "Use a more natural expression",
                    confidence: 0.6,
                    anchorQuote: "grow up",
                    nearbyText: "as I grow up"
                  }
                ],
                warnings: []
              }
            ],
            classSummary: [
              {
                errorType: "punctuation",
                titleZh: "标点",
                explanationZh: "注意断句。",
                examples: ["big tree ,it -> big tree. It"]
              },
              {
                errorType: "other",
                titleZh: "表达",
                explanationZh: "更自然。",
                examples: ["grow up -> grow"]
              }
            ],
            warnings: []
          })
        }
      }
    ]
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

  try {
    const response = await reviewEssay({
      request: new Request("http://localhost/api/essay-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissions: [
            {
              submissionId: "sub-1",
              studentName: "学生1",
              essayGroupId: "essay-1",
              pages: [
                {
                  pageId: "page-1",
                  fileName: "demo.jpg",
                  dataUrl: "data:image/jpeg;base64,abc",
                  ocrText: "My school is like a big tree ,it protects me as I grow up.",
                  width: 1000,
                  height: 1200
                }
              ]
            }
          ]
        })
      }),
      env: {
        OPENAI_ESSAY_API_KEY: "tp-demo-key",
        OPENAI_ESSAY_BASE_URL: "https://token-plan-cn.xiaomimimo.com/v1",
        OPENAI_ESSAY_MODEL: "mimo-v2.5-pro"
      }
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(payload.submissions[0].issues.map((item) => item.errorType), ["punctuation"]);
    assert.equal(payload.submissions[0].issues[0].correctedText, "big tree. It");
    assert.deepEqual(payload.submissions[0].personalSummary.map((item) => item.errorType), ["punctuation"]);
    assert.deepEqual(payload.classSummary.map((item) => item.errorType), ["punctuation"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
