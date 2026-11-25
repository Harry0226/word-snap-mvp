const assert = require("assert");
const {
  prepareRotationBatch,
  completeRotationItem
} = require("../rotation-queue.js");

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function completeBatch(state, batch) {
  return batch.reduce((next, id) => completeRotationItem(next, id), state);
}

const thousand = Array.from({ length: 1000 }, (_, index) => `word-${index}`);
let state = null;
const seen = new Set();

for (let batchNo = 0; batchNo < 5; batchNo += 1) {
  const prepared = prepareRotationBatch(state, thousand, 200, {
    random: seededRandom(batchNo + 10)
  });
  state = prepared.state;
  assert.strictEqual(prepared.batch.length, 200, "each batch should contain 200 words");
  prepared.batch.forEach((id) => {
    assert(!seen.has(id), "a word must not repeat before the full pool is covered");
    seen.add(id);
  });
  state = completeBatch(state, prepared.batch);
}

assert.strictEqual(seen.size, 1000, "five batches should cover the entire 1000-word pool");

const nextCycle = prepareRotationBatch(state, thousand, 200, {
  random: seededRandom(99)
});
assert.strictEqual(nextCycle.state.cycle, 2, "a new shuffled cycle should begin after full coverage");
assert.strictEqual(nextCycle.batch.length, 200, "the next cycle should still respect the selected size");

const pool = Array.from({ length: 1000 }, (_, index) => `item-${index}`);
let interrupted = prepareRotationBatch(null, pool, 200, {
  random: seededRandom(123)
});
const firstBatch = interrupted.batch;
interrupted.state = completeBatch(interrupted.state, firstBatch.slice(0, 50));

const restored = JSON.parse(JSON.stringify(interrupted.state));
const freshBatch = prepareRotationBatch(restored, pool, 200, {
  random: seededRandom(456)
});
assert.strictEqual(freshBatch.batch.length, 200, "an interrupted session should be replaced by a full fresh batch");
assert(
  freshBatch.batch.every((id) => !firstBatch.includes(id)),
  "the next batch should not repeat any item from the abandoned batch"
);
assert.strictEqual(
  freshBatch.state.deferred.length,
  150,
  "unanswered items from the abandoned batch should be deferred"
);

let rollover = freshBatch;
rollover.state = completeBatch(rollover.state, rollover.batch);
while (rollover.state.remaining.length) {
  rollover = prepareRotationBatch(rollover.state, pool, 200, {
    random: seededRandom(789)
  });
  assert(
    rollover.batch.every((id) => !firstBatch.includes(id)),
    "fresh items should be exhausted before deferred items return"
  );
  rollover.state = completeBatch(rollover.state, rollover.batch);
}

const deferredBatch = prepareRotationBatch(rollover.state, pool, 200, {
  random: seededRandom(321)
});
assert.strictEqual(deferredBatch.batch.length, 200, "a selected 200-word batch should stay full across a cycle boundary");
assert.strictEqual(new Set(deferredBatch.batch).size, 200, "a cycle-boundary batch must not repeat a word");
firstBatch.slice(50).forEach((id) => {
  assert(deferredBatch.batch.includes(id), "deferred unanswered items should return before the new cycle fills the batch");
});
assert.strictEqual(deferredBatch.state.cycle, 2, "filling a tail batch should open the next rotation cycle");

const grade9Pool = Array.from({ length: 261 }, (_, index) => `grade9-${index}`);
let grade9 = prepareRotationBatch(null, grade9Pool, 200, { random: seededRandom(901) });
grade9.state = completeBatch(grade9.state, grade9.batch);
const grade9Tail = prepareRotationBatch(grade9.state, grade9Pool, 200, { random: seededRandom(902) });
assert.strictEqual(grade9Tail.batch.length, 200, "a 261-word bank must not produce a short second 200-word session");
assert.strictEqual(new Set(grade9Tail.batch).size, 200, "the filled second session must contain 200 different words");

console.log("persistent rotation checks passed");
