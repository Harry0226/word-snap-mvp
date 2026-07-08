(function initAssetLoader(root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapAssetLoader = api;
})(typeof window !== "undefined" ? window : globalThis, function createAssetLoader(root) {
  const loads = new Map();

  function addRetryParam(src, attempt) {
    if (attempt === 0) return src;
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}retry=${Date.now()}-${attempt}`;
  }

  function loadAttempt(src, attempt, timeoutMs) {
    return new Promise((resolve, reject) => {
      const script = root.document.createElement("script");
      const timer = root.setTimeout(() => {
        script.remove();
        reject(new Error(`加载超时：${src}`));
      }, timeoutMs);
      script.async = true;
      script.src = addRetryParam(src, attempt);
      script.dataset.assetSrc = src;
      script.onload = () => {
        root.clearTimeout(timer);
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = () => {
        root.clearTimeout(timer);
        script.remove();
        reject(new Error(`加载失败：${src}`));
      };
      root.document.head.append(script);
    });
  }

  async function loadScriptWithRetry(src, options = {}) {
    if (loads.has(src)) return loads.get(src);
    const attempts = Number(options.attempts || 3);
    const timeoutMs = Number(options.timeoutMs || 12000);
    const promise = (async () => {
      let lastError;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          return await loadAttempt(src, attempt, timeoutMs);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    })();
    loads.set(src, promise);
    try {
      return await promise;
    } catch (error) {
      loads.delete(src);
      throw error;
    }
  }

  return { loadScriptWithRetry };
});
