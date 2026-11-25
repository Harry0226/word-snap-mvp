const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");

assert(!index.includes("<b>更多设置：</b>"), "learning notice should not include the old 更多设置 line");
assert(index.includes("<b>奖励机制：</b>"), "learning notice should include the reward mechanism");
assert(index.includes("<b>惩罚机制：</b>"), "learning notice should include the penalty mechanism");

console.log("notice copy checks passed");
