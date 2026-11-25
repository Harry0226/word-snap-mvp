const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const battle = fs.readFileSync("battle.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert(index.includes('data-view="battle"'), "index.html should add a battle tab");
assert(index.includes('id="view-battle"'), "index.html should add the battle view");
assert(index.includes('id="battleStage"'), "battle view should let teachers choose a stage");
assert(index.includes('id="battleSize"'), "battle view should let teachers choose a round size");
assert(index.includes('id="battleMode"'), "battle view should let teachers choose the prompt mode");
assert(index.includes('id="leftBattleChoices"'), "battle view should render left-side choices");
assert(index.includes('id="rightBattleChoices"'), "battle view should render right-side choices");

assert(app.includes("battle: null"), "state should include isolated battle state");
assert(battle.includes("buildBattleQueue"), "battle.js should build a battle-only queue");
assert(battle.includes("startBattle"), "battle.js should start battle rounds");
assert(battle.includes("answerBattle"), "battle.js should score battle answers");
assert(battle.includes("finishBattle"), "battle.js should finish battle rounds");
assert(battle.includes("battle.playerLocked"), "battle answers should lock only the player who misses");
assert(battle.includes("battle.choices = makeBattleChoices"), "both players should share the same options per word");
assert(!/function answerBattle[\s\S]*recordAnswer/.test(battle), "battle mode must not write normal practice records");

assert(styles.includes(".battle-arena"), "styles.css should define the battle arena layout");
assert(styles.includes(".battle-player"), "styles.css should define player panels");
assert(styles.includes(".battle-choice"), "styles.css should define touch-friendly battle choices");

console.log("battle mode checks passed");
