const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {window: {}};
vm.createContext(context);
for (const file of ['word-data/wordbook.js', 'word-data/listening-bank.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
const book = context.window.WORD_SNAP_WORDBOOK;
const bank = context.window.WORD_SNAP_LISTENING_BANK;
assert.equal(book.length, 3372);
assert.equal(Object.keys(bank).length, 9);
assert(fs.statSync(path.join(root, 'assets/teacher-approval.png')).size > 10000);
const audio = new Set();
for (const [stage, entries] of Object.entries(bank)) {
  assert(entries.length >= 25, stage);
  for (const item of entries) {
    assert(new RegExp(`\\b${item.word}\\b`, 'i').test(item.english), `${stage}: ${item.word}`);
    assert(item.chinese.length >= 4 && item.english.split(/\s+/).length >= 5);
    assert(/tatoeba.org/.test(item.credit));
    const expectedHash = crypto.createHash('sha1').update(item.english).digest('hex').slice(0, 16);
    assert(item.audio.endsWith(`${expectedHash}.mp3`), item.english);
    const soundPath = path.join(root, item.audio);
    assert(fs.existsSync(soundPath), soundPath);
    assert(fs.statSync(soundPath).size > 1000, soundPath);
    audio.add(soundPath);
  }
}
console.log(`learning flow assets passed (${book.length} book entries, ${audio.size} British audio clips)`);
