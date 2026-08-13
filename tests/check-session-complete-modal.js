const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert(app.includes("const passed = accuracyNum >= 80;"), "session pass threshold should be 80 percent");
assert(app.includes('title.textContent = passed ? "太棒了，顺利过关！" : "继续加油呀！";'), "result titles should encourage children");
assert(app.includes('resultEl.className = "modal-result encourage";'), "below-threshold results should use the encouragement state");
assert(!styles.includes(".modal-header.fail"), "completion modal should not retain a red failure header");
assert(!styles.includes(".modal-result.fail"), "completion modal should not retain a red failure result");

[
  ["audioToZhChoice", "听英文选中文"],
  ["enToZhChoice", "看英文选中文"],
  ["zhToEnChoice", "看中文选英文"]
].forEach(([value, label]) => {
  assert(app.includes(`${value}: "${label}"`), `completion modal should label ${label}`);
});

assert(app.includes("const practiceMode = els.practiceMode.value;"), "session should capture the student's selected practice mode before loading begins");
assert(app.includes("practiceMode,"), "session should retain the captured practice mode");
assert(app.includes("practiceMode: session.practiceMode"), "session report should retain the selected practice mode");
assert(index.includes('id="modalPracticeMode"'), "completion modal should render the selected practice mode");
assert(index.includes('id="modalDatetime"'), "completion modal should retain its timestamp");
assert(app.includes("datetimeEl.textContent = `${dateStr} ${timeStr}`;"), "completion modal should populate the timestamp");

console.log("session completion modal checks passed");
