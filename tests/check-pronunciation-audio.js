const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const listeners = new Map();
const fakeAudio = {
  pause() {},
  load() {},
  play() { return Promise.resolve(); },
  addEventListener(name, callback) { listeners.set(name, callback); },
  removeEventListener(name) { listeners.delete(name); }
};
const context = {
  window: {},
  TextEncoder,
  setTimeout,
  clearTimeout,
  fetch: () => Promise.resolve(),
};
context.window.WORD_SNAP_AUDIO_CONFIG = {
  baseUrl: "./audio/en-gb-v1/",
  unlockSrc: "./audio/unlock.mp3"
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("pronunciation-audio.js", "utf8"), context);

const audio = context.window.WordSnapPronunciationAudio;
assert.strictEqual(audio.normalizeAudioTerm("Brand"), "brand");
assert.strictEqual(
  audio.normalizeAudioTerm("response All Rights Reserved."),
  "response",
  "source noise should not become pronunciation audio"
);
assert.match(audio.audioFileNameForTerm("brand"), /^[a-f0-9]{16}\.mp3$/);
assert.strictEqual(
  audio.sourceForWord({ en: "brand", sourceType: "custom" }),
  "",
  "custom imports should not pretend to have generated audio"
);

const player = new audio.PronunciationAudioPlayer(fakeAudio);
assert.ok(player, "one reusable audio player should be constructible");

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
assert.strictEqual((html.match(/id="pronunciationAudio"/g) || []).length, 1, "the page should reuse one audio element");
assert.ok(html.includes("pronunciation-audio-config.js"), "audio configuration should load");
assert.ok(html.includes("pronunciation-audio.js"), "audio player should load");
assert.ok(!app.includes("SpeechSynthesisUtterance"), "built-in training should not depend on system voices");

const configContext = { window: {} };
vm.createContext(configContext);
vm.runInContext(fs.readFileSync("pronunciation-audio-config.js", "utf8"), configContext);
const config = configContext.window.WORD_SNAP_AUDIO_CONFIG;
assert.strictEqual(config.voice, "en-GB-SoniaNeural");
assert.match(config.voiceLabel, /英式/, "the built-in audio should be labelled as British English");

const dataContext = { window: {} };
vm.createContext(dataContext);
vm.runInContext(fs.readFileSync("word-data/builtin-manifest.js", "utf8"), dataContext);
const manifest = dataContext.window.WORD_SNAP_BUILTIN_MANIFEST;
for (const entry of Object.values(manifest.stages)) {
  vm.runInContext(fs.readFileSync(entry.src.replace("./word-data/", "word-data/"), "utf8"), dataContext);
}

const missing = new Set();
const names = new Map();
let rows = 0;
for (const [stageName, entry] of Object.entries(manifest.stages)) {
  const list = dataContext.window.WORD_SNAP_STAGE_LISTS[stageName];
  assert.ok(list, `${stageName} should load`);
  assert.strictEqual(list.words.length, entry.count, `${stageName} count should stay unchanged`);
  for (const word of list.words) {
    rows += 1;
    const term = audio.normalizeAudioTerm(word.en);
    const filename = audio.audioFileNameForTerm(term);
    const audioRoot = config.baseUrl.replace(/^\.\//, "").replace(/\/$/, "");
    if (!filename || !fs.existsSync(path.join(audioRoot, filename))) missing.add(term || word.en);
    const previous = names.get(filename);
    assert.ok(!previous || previous === term, `audio hash collision: ${previous} / ${term}`);
    names.set(filename, term);
  }
}
assert.strictEqual(rows, 5931);
assert.deepStrictEqual([...missing], [], `missing built-in audio: ${[...missing].slice(0, 10).join(", ")}`);
assert.strictEqual(config.termCount, names.size, "audio config should report every unique built-in term");
assert.ok(fs.statSync("audio/unlock.mp3").size > 500, "audio unlock file should be a real MP3");
const audioRoot = config.baseUrl.replace(/^\.\//, "").replace(/\/$/, "");
assert.strictEqual(
  fs.readdirSync(audioRoot).filter((filename) => filename.endsWith(".mp3")).length,
  names.size,
  "the audio folder should contain only active built-in terms"
);

const buildScript = fs.readFileSync(path.join("..", "tools", "build_pronunciation_audio.py"), "utf8");
assert.ok(buildScript.includes('return expanded.strip()'), "terms should be synthesized without sentence wrappers");
assert.ok(!buildScript.includes('expanded.strip().capitalize() + "."'), "short terms should not gain a synthetic sentence-start sound");

for (const filename of [...names.keys()].slice(0, 20)) {
  const bytes = fs.readFileSync(path.join(audioRoot, filename));
  assert.ok(bytes.length > 900, `${filename} should contain playable audio`);
  assert.ok(
    bytes.subarray(0, 3).toString("ascii") === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
    `${filename} should have an MP3 header`
  );
}

const blockedAudio = {
  pause() {},
  load() {},
  play() {
    const error = new Error("user gesture required");
    error.name = "NotAllowedError";
    return Promise.reject(error);
  },
  addEventListener() {},
  removeEventListener() {}
};

(async () => {
  const blockedPlayer = new audio.PronunciationAudioPlayer(blockedAudio);
  const result = await blockedPlayer.playWord({ en: "brand", sourceType: "builtin" });
  assert.strictEqual(result.status, "blocked", "autoplay denial should become a recoverable UI state");
  console.log(`pronunciation audio checks passed (${rows} rows, ${names.size} static clips)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
