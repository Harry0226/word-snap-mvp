const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const sourceWords = fs.readFileSync(path.join(root, "word-data", "sources", "junior-high-frequency-688.txt"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const expectedDigest = "a3590c590ec2a26827133f9b9571b0fe426b07ee0d2a42ef5c66df398473aa1b";

assert.strictEqual(sourceWords.length, 688, "PDF source list should contain exactly 688 words");
assert.strictEqual(new Set(sourceWords).size, 688, "PDF source list should not contain duplicate words");
assert.strictEqual(
  crypto.createHash("sha256").update(sourceWords.join("\n")).digest("hex"),
  expectedDigest,
  "PDF source words or their order changed unexpectedly"
);

for (const selectId of ["stageSelect", "battleStage", "uploadStage"]) {
  const select = index.match(new RegExp(`<select id="${selectId}">[\\s\\S]*?<\\/select>`))?.[0] || "";
  assert(select.includes('<option value="初中688高频词">初中688高频词</option>'), `${selectId} should expose the junior 688 stage`);
}
const quizSelect = index.match(/<select id="quizStage">[\s\S]*?<\/select>/)?.[0] || "";
assert(!quizSelect.includes("初中688高频词"), "quiz should not expose the stage without a matching sentence bank");
assert(app.match(/^const STAGES = .*"初中688高频词"/m), "canonical stages should retain junior 688 data and reports");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "word-data", "builtin-manifest.js"), "utf8"), context);
const manifestEntry = context.window.WORD_SNAP_BUILTIN_MANIFEST.stages["初中688高频词"];
assert(manifestEntry, "manifest should expose the junior 688 stage");
assert.strictEqual(manifestEntry.count, 688, "manifest should declare all 688 words");

vm.runInContext(fs.readFileSync(path.join(root, manifestEntry.src.replace(/^\.\//, "")), "utf8"), context);
const list = context.window.WORD_SNAP_STAGE_LISTS["初中688高频词"];
assert(list, "junior 688 stage asset should load");
assert.strictEqual(list.sourceSha256, expectedDigest, "stage data should retain the PDF source digest");
assert.deepStrictEqual(Array.from(list.words, (word) => word.en), sourceWords, "stage English words should match the PDF source exactly and in order");
assert(list.words.every((word) => typeof word.zh === "string" && /[\u3400-\u9fff]/u.test(word.zh)), "all 688 words should have Chinese meanings");
assert(list.words.every((word) => !/[A-Za-z]{2,}/.test(word.zh)), "Chinese meanings should not contain leaked English text");

console.log("junior 688 vocabulary integrity checks passed");
