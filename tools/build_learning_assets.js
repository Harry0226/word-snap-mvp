const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');
const source = '/Volumes/备课盘/2026秋季班课程/单词书整理.html';
const corpus = process.argv[2] || '/tmp/word-snap-verification/cmn-eng.zip';
const html = fs.readFileSync(source, 'utf8');
const match = html.match(/const WORDS = (\[[\s\S]*?\]);\s*const resultsEl/);
if (!match) throw new Error('Wordbook data not found');
const unsafe = /杀|血|死|暴力|自杀|强奸|性侵|色情|裸体|做爱|性交|乳房|阴茎|傻逼|妈的|操你|他妈|婊子|屠|砍|枪|毒品|吸毒|恐怖|仇恨|虐待|残忍|冷血|贱人|变态|侮辱|偷窥|猥亵|淫|肛|屎|屁|尿|赌场|赌博|酗酒/;
const book = JSON.parse(match[1]).map((row) => ({
  word: row.word,
  phonetic: row.phonetic,
  definition: row.definition,
  mnemonic: unsafe.test(row.mnemonic) ? '' : row.mnemonic.replace(/\s+/g, ' ').trim()
}));
fs.writeFileSync(path.join(docs, 'word-data/wordbook.js'),
  `window.WORD_SNAP_WORDBOOK = ${JSON.stringify(book)};\n`);

const context = {window: {}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(docs, 'word-data/builtin-manifest.js'), 'utf8'), context);
const stages = context.window.WORD_SNAP_BUILTIN_MANIFEST.stages;
for (const info of Object.values(stages)) vm.runInContext(fs.readFileSync(path.join(docs, info.src), 'utf8'), context);
const text = cp.execFileSync('unzip', ['-p', corpus, 'cmn.txt'], {encoding: 'utf8', maxBuffer: 20_000_000});
const pairs = text.split('\n').map((line) => {
  const [english, chinese, credit] = line.split('\t');
  return {english: english?.trim(), chinese: chinese?.trim(), credit: credit?.trim()};
}).filter((p) => p.english && p.chinese && /^[A-Za-z,' ?!.\-]+$/.test(p.english)
  && p.english.split(/\s+/).length >= 5 && p.english.split(/\s+/).length <= 14
  && p.chinese.length >= 4 && p.chinese.length <= 42
  && !unsafe.test(p.chinese) && !/\b(Tom|Mary|Sami|Boston|Japan|China)\b/.test(p.english));
const byWord = new Map();
for (const pair of pairs) {
  for (const token of new Set(pair.english.toLowerCase().match(/[a-z]+/g) || [])) {
    if (!byWord.has(token)) byWord.set(token, []);
    byWord.get(token).push(pair);
  }
}
const result = {};
const allAudio = new Map();
for (const [stage, info] of Object.entries(stages)) {
  const words = context.window.WORD_SNAP_STAGE_LISTS[stage].words;
  const options = [];
  for (const word of words) {
    const key = word.en.toLowerCase().trim();
    if (!/^[a-z]{3,}$/.test(key)) continue;
    const candidates = byWord.get(key) || [];
    const zhSenses = (word.zh || '').split(/[；;、，,（(]/).map((s) => s.replace(/^(n\.|v\.|adj\.|adv\.|vt\.|vi\.)/, '').trim()).filter((s) => s.length >= 2 && s.length <= 7);
    const scored = candidates.map((p) => {
      const count = p.english.split(/\s+/).length;
      const sense = zhSenses.some((s) => p.chinese.includes(s));
      const score = (sense ? 8 : 0) - Math.abs(count - 8) * 0.6 - (p.english.includes('?') ? 0.5 : 0) - p.english.length / 100;
      return {p, score};
    }).sort((a, b) => b.score - a.score);
    if (!scored.length) continue;
    const chosen = scored[0];
    // Gloss-match pairs are preferred, but short ordinary sentences remain useful for the least-covered stages.
    options.push({word: key, english: chosen.p.english, chinese: chosen.p.chinese, credit: chosen.p.credit, score: chosen.score});
  }
  options.sort((a, b) => b.score - a.score);
  const used = new Set();
  result[stage] = [];
  for (const item of options) {
    if (used.has(item.english)) continue;
    used.add(item.english);
    const hash = crypto.createHash('sha1').update(item.english).digest('hex').slice(0, 16);
    const audio = `./audio/sentences-en-gb-v1/${hash}.mp3`;
    result[stage].push({word: item.word, english: item.english, chinese: item.chinese, audio, credit: item.credit});
    allAudio.set(hash, item.english);
    if (result[stage].length >= 150) break;
  }
  if (result[stage].length < 25) throw new Error(`${stage}: too few listening sentences (${result[stage].length})`);
}
fs.writeFileSync(path.join(docs, 'word-data/listening-bank.js'), `window.WORD_SNAP_LISTENING_BANK = ${JSON.stringify(result)};\n`);
fs.writeFileSync('/tmp/word-snap-verification/listening-audio-manifest.json', JSON.stringify(Object.fromEntries(allAudio)));
console.log(JSON.stringify({wordbook: book.length, hiddenMnemonic: book.filter((x) => !x.mnemonic).length, listening: Object.fromEntries(Object.entries(result).map(([k,v])=>[k,v.length])), uniqueAudio: allAudio.size}, null, 2));
