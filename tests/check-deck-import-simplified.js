const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

assert(!index.includes("fileInput"), "deck page should remove file upload input");
assert(!index.includes("recognizeBtn"), "deck page should remove OCR/AI recognize button");
assert(!index.includes("ocrStatus"), "deck page should remove OCR status text");
assert(!index.includes("选择图片/PDF/文本"), "deck page should not advertise image/PDF imports");
assert(index.includes("文字直接添加"), "deck page should keep direct text adding");
assert(index.indexOf("保存到阶段") > index.indexOf("文字直接添加"), "stage selection should live in direct text add area");
assert(index.indexOf("资料名称") > index.indexOf("文字直接添加"), "deck name should live in direct text add area");

assert(!app.includes("recognizeFile"), "OCR file recognition code should be removed");
assert(!app.includes("recognizeWithAi"), "AI recognition code should be removed from the frontend");
assert(!app.includes("pdfToDataUrls"), "PDF conversion code should be removed from the frontend");
assert(!app.includes("Tesseract.recognize"), "Tesseract OCR code should be removed from the frontend");
assert(!app.includes(".slice(0, 300)"), "text import should not cap parsed decks at 300 rows");
assert(app.includes("isSectionHeader"), "parser should skip A and P-Q style section headers");
assert(app.includes("matchCompactWordLine"), "parser should support compact lines like especially特别");
assert(app.includes('els.importStatus.textContent = `从文字中解析到 ${state.reviewRows.length} 条候选词，请确认后保存。`;'), "text import should use direct import status");

console.log("deck import simplification checks passed");
