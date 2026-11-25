const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const webRoot = path.join(projectRoot, "docs");
const checks = fs.readdirSync(path.join(webRoot, "tests"))
  .filter((name) => /^check-.*\.js$/.test(name))
  .sort();

for (const check of checks) {
  const result = spawnSync(process.execPath, [path.join("tests", check)], {
    cwd: webRoot,
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`全部 ${checks.length} 项网页检查通过。`);
