const assert = require("assert");

let attempts = 0;
global.document = {
  createElement() {
    return {
      dataset: {},
      remove() {},
      set src(value) { this._src = value; },
      get src() { return this._src; }
    };
  },
  head: {
    append(script) {
      attempts += 1;
      setTimeout(() => {
        if (attempts < 2) script.onerror();
        else script.onload();
      }, 0);
    }
  }
};

delete require.cache[require.resolve("../asset-loader.js")];
const { loadScriptWithRetry } = require("../asset-loader.js");

(async () => {
  await loadScriptWithRetry("./slow-data.js?v=1", { attempts: 3, timeoutMs: 100 });
  assert.strictEqual(attempts, 2, "loader should retry once after an asset failure");
  await loadScriptWithRetry("./slow-data.js?v=1", { attempts: 3, timeoutMs: 100 });
  assert.strictEqual(attempts, 2, "loader should deduplicate completed asset loads");
  console.log("asset loader checks passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
