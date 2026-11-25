const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('word-data/sources/junior-1600.tsv', 'utf8');
const digest = '44e2cebff30f1107e56f0e4942e144a7215ffa0588d95f05fe20904c184ae563';
assert.strictEqual(crypto.createHash('sha256').update(source).digest('hex'), digest);
const rows = source.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
assert.strictEqual(rows.length, 1601, 'the PDF contains 1601 numbered rows');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('word-data/builtin-manifest.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('word-data/stages/junior-1600.js', 'utf8'), context);
const entry = context.window.WORD_SNAP_BUILTIN_MANIFEST.stages['初中1600'];
const list = context.window.WORD_SNAP_STAGE_LISTS['初中1600'];
assert.strictEqual(entry.count, 1601);
assert.strictEqual(list.sourceSha256, digest);
assert.strictEqual(list.words.length, 1601);
rows.forEach((line, index) => {
  const [number, en, zh] = line.split('\t');
  assert.strictEqual(Number(number), index + 1);
  assert.strictEqual(list.words[index].en, en);
  assert.strictEqual(list.words[index].zh, zh);
  assert.ok(list.words[index].contextSentence);
});
assert.strictEqual(list.words.at(-1).en, 'zoo', 'retain the final PDF row');

const html = fs.readFileSync('index.html', 'utf8');
for (const id of ['stageSelect', 'battleStage', 'uploadStage']) {
  const select = html.match(new RegExp(`<select id="${id}">[\\s\\S]*?<\\/select>`))?.[0] || '';
  assert.ok(select.includes('<option value="初中1600">初中1600</option>'), `${id} should expose the stage`);
}
assert.ok(!html.match(/<select id="quizStage">[\s\S]*?<\/select>/)?.[0].includes('初中1600'),
  'the vocabulary stage has no dedicated sentence quiz bank');

console.log('junior 1600 PDF integrity checks passed');
