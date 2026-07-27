const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "docs");
const mirrorRoot = path.join(projectRoot, "word-snap-mvp");
const checkOnly = process.argv.includes("--check");
const ignoredTopLevel = new Set([".wrangler"]);

function walkFiles(root, relative = "") {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!relative && ignoredTopLevel.has(entry.name)) return [];
    const child = path.join(relative, entry.name);
    return entry.isDirectory() ? walkFiles(root, child) : [child];
  });
}

function digest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const sourceFiles = walkFiles(sourceRoot);
const changed = [];
const missing = [];

for (const relative of sourceFiles) {
  const source = path.join(sourceRoot, relative);
  const mirror = path.join(mirrorRoot, relative);
  if (!fs.existsSync(mirror)) {
    missing.push(relative);
    if (!checkOnly) {
      fs.mkdirSync(path.dirname(mirror), { recursive: true });
      fs.copyFileSync(source, mirror);
    }
  } else if (digest(source) !== digest(mirror)) {
    changed.push(relative);
    if (!checkOnly) fs.copyFileSync(source, mirror);
  }
}

if (!checkOnly) {
  console.log(`网页镜像同步完成：新增 ${missing.length}，更新 ${changed.length}。部署目录中的辅助工具和缓存均已保留。`);
  process.exit(0);
}

if (missing.length || changed.length) {
  console.error("网页镜像与 docs/ 不一致。请运行：npm run sync");
  if (missing.length) console.error(`镜像缺少：${missing.join(", ")}`);
  if (changed.length) console.error(`内容不同：${changed.join(", ")}`);
  process.exit(1);
}

console.log("网页镜像与 docs/ 完全一致。");
