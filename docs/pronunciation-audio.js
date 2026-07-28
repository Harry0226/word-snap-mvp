(function initPronunciationAudio(global) {
  const WORD_PATTERN = /[A-Za-z]+(?:[-'][A-Za-z]+)*/g;

  function normalizeAudioTerm(value) {
    let cleaned = String(value || "")
      .replace(/\s+(?:(?:n|v|adj|adv|prep|conj|pron|num|int)\.)?All Rights Reserved\..*$/i, "")
      .replace(/\s+copyright.*$/i, "")
      .replace(/\s+(?:n|v|adj|adv|prep|conj|pron|num|int)\.$/i, "")
      .replace(/\s*\([^)]*\)/g, " ")
      .replace(/\.{3,}/g, " ")
      .replace(/[’]/g, "'");
    const words = cleaned.match(WORD_PATTERN) || [];
    return words.join(" ").toLowerCase();
  }

  function fnv1a32(value) {
    let result = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 0x01000193) >>> 0;
    }
    return result >>> 0;
  }

  function djb2xor32(value) {
    let result = 5381;
    for (let index = 0; index < value.length; index += 1) {
      result = (Math.imul(result, 33) ^ value.charCodeAt(index)) >>> 0;
    }
    return result >>> 0;
  }

  function audioFileNameForTerm(value) {
    const term = normalizeAudioTerm(value);
    if (!term) return "";
    const first = `00000000${fnv1a32(term).toString(16)}`.slice(-8);
    const second = `00000000${djb2xor32(term).toString(16)}`.slice(-8);
    return `${first}${second}.mp3`;
  }

  function sourceForWord(word) {
    if (!word || word.sourceType !== "builtin") return "";
    const config = global.WORD_SNAP_AUDIO_CONFIG || {};
    const filename = audioFileNameForTerm(word.en);
    return filename ? `${config.baseUrl || "./audio/en-v1/"}${filename}` : "";
  }

  class PronunciationAudioPlayer {
    constructor(audioElement) {
      this.audio = audioElement;
      this.playToken = 0;
      this.prefetched = new Set();
    }

    stop() {
      this.playToken += 1;
      this.audio.pause();
      try {
        this.audio.currentTime = 0;
      } catch (_) {
        // Older embedded WebViews may reject currentTime updates before metadata loads.
      }
    }

    prime() {
      const config = global.WORD_SNAP_AUDIO_CONFIG || {};
      if (!config.unlockSrc) return Promise.resolve(false);
      this.stop();
      this.audio.src = config.unlockSrc;
      this.audio.preload = "auto";
      this.audio.load();
      try {
        const attempt = this.audio.play();
        if (!attempt || typeof attempt.then !== "function") return Promise.resolve(true);
        return attempt.then(() => true).catch(() => false);
      } catch (_) {
        return Promise.resolve(false);
      }
    }

    playWord(word) {
      const src = sourceForWord(word);
      if (!src) return Promise.resolve({ status: "missing" });
      const token = ++this.playToken;
      this.audio.pause();
      this.audio.src = src;
      this.audio.preload = "auto";
      this.audio.load();

      return new Promise((resolve) => {
        let settled = false;
        const finish = (status, error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          this.audio.removeEventListener("ended", handleEnded);
          this.audio.removeEventListener("error", handleError);
          if (token !== this.playToken) {
            resolve({ status: "cancelled" });
            return;
          }
          resolve({ status, error: error ? String(error.message || error) : "" });
        };
        const handleEnded = () => finish("played");
        const handleError = () => finish("failed", this.audio.error || new Error("Audio load failed"));
        const timeoutId = setTimeout(() => finish("failed", new Error("Audio playback timed out")), 10000);
        this.audio.addEventListener("ended", handleEnded, { once: true });
        this.audio.addEventListener("error", handleError, { once: true });

        try {
          const attempt = this.audio.play();
          if (attempt && typeof attempt.catch === "function") {
            attempt.catch((error) => {
              finish(error?.name === "NotAllowedError" ? "blocked" : "failed", error);
            });
          }
        } catch (error) {
          finish(error?.name === "NotAllowedError" ? "blocked" : "failed", error);
        }
      });
    }

    prefetch(words, limit = 4) {
      const sources = (words || [])
        .map(sourceForWord)
        .filter(Boolean)
        .filter((source) => {
          if (this.prefetched.has(source)) return false;
          this.prefetched.add(source);
          return true;
        })
        .slice(0, limit);
      sources.forEach((source) => {
        if (typeof fetch !== "function") return;
        fetch(source, { cache: "force-cache", credentials: "same-origin" }).catch(() => {
          this.prefetched.delete(source);
        });
      });
    }
  }

  global.WordSnapPronunciationAudio = {
    PronunciationAudioPlayer,
    audioFileNameForTerm,
    normalizeAudioTerm,
    sourceForWord
  };
})(window);
