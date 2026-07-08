const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");

assert(!index.includes("<b>更多设置：</b>"), "learning notice should not include the old 更多设置 line");
assert(index.includes("<b>奖励机制：</b>每周完成12张截图（包括刷词和刷题）来找代老师兑换学习用品或者奶茶一杯。"), "learning notice should include the reward mechanism");
assert(index.includes("<b>惩罚机制：</b>未完成的同学周末课后留下罚抄单词和作文例句，完成后方可回家。"), "learning notice should include the penalty mechanism");

console.log("notice copy checks passed");
