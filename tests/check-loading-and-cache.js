const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const headers = fs.existsSync("_headers") ? fs.readFileSync("_headers", "utf8") : "";

assert(!index.includes("cdnjs.cloudflare.com/ajax/libs/pdf.js"), "index.html must not load PDF.js on first paint");
assert(!index.includes("cdn.jsdelivr.net/npm/tesseract.js"), "index.html must not load Tesseract on first paint");
assert(app.includes("loadPdfJs"), "app.js should lazy-load PDF.js only when needed");
assert(app.includes("loadTesseract"), "app.js should lazy-load Tesseract only when needed");
assert(headers.includes("/\n  Cache-Control: public, max-age=60"), "_headers should define root cache behavior");
assert(headers.includes("/index.html"), "_headers should define index.html cache behavior");
assert(headers.includes("/word-data/*"), "_headers should define word-data cache behavior");
assert(headers.includes("Cache-Control"), "_headers should configure Cache-Control");

console.log("loading and cache checks passed");
