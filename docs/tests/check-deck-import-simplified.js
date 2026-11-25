const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const decks = fs.readFileSync("decks.js", "utf8");
const { parseWordsFromText } = require("../decks.js");

assert(!index.includes("fileInput"), "deck page should remove file upload input");
assert(!index.includes("recognizeBtn"), "deck page should remove OCR/AI recognize button");
assert(!index.includes("ocrStatus"), "deck page should remove OCR status text");
assert(!index.includes("选择图片/PDF/文本"), "deck page should not advertise image/PDF imports");
assert(index.includes("文字直接添加"), "deck page should keep direct text adding");
assert(index.indexOf("保存到阶段") > index.indexOf("文字直接添加"), "stage selection should live in direct text add area");
assert(index.indexOf("资料名称") > index.indexOf("文字直接添加"), "deck name should live in direct text add area");

assert(!app.includes("recognizeFile") && !decks.includes("recognizeFile"), "OCR file recognition code should be removed");
assert(!app.includes("recognizeWithAi") && !decks.includes("recognizeWithAi"), "AI recognition code should be removed from the frontend");
assert(!app.includes("pdfToDataUrls") && !decks.includes("pdfToDataUrls"), "PDF conversion code should be removed from the frontend");
assert(!app.includes("Tesseract.recognize") && !decks.includes("Tesseract.recognize"), "Tesseract OCR code should be removed from the frontend");
assert(!decks.includes(".slice(0, 300)"), "text import should not cap parsed decks at 300 rows");
assert(decks.includes("isSectionHeader"), "parser should skip A and P-Q style section headers");
assert(decks.includes("matchCompactWordLine"), "parser should support compact lines like especially特别");
assert(decks.includes('setImportStatus(els, `从文字中解析到 ${state.reviewRows.length} 条候选词，请确认后保存。`);'), "text import should use direct import status");

const parsed = parseWordsFromText("A\nachieve 达到，实现\navoid|避免|v.|avoid doing sth.\nespecially特别");
assert.strictEqual(parsed.length, 3);
assert.strictEqual(parsed[0].en, "achieve");
assert.strictEqual(parsed[1].pos, "v.");
assert.strictEqual(parsed[2].zh, "特别");

console.log("deck import simplification checks passed");
