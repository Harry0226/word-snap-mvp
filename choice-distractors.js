(function exposeChoiceDistractors(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapChoiceUtils = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const COMMON_CHINESE_CHARS = new Set(["的", "地", "得", "是", "在", "了", "和", "与", "或", "为", "把", "被", "一", "个"]);
  const ENGLISH_SUFFIXES = ["fulness", "lessness", "ability", "ibility", "ation", "ition", "ness", "ment", "ingly", "edly", "ing", "ied", "ies", "ly", "ed", "es", "s"];

  function normalizeDisplayedChoiceText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
  }

  function normalizeEnglishWord(value) {
    return String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  function vocabularyEntryKey(word) {
    return `${normalizeDisplayedChoiceText(word?.en)}\u0000${normalizeDisplayedChoiceText(word?.zh)}`;
  }

  function dedupeVocabularyEntries(entries) {
    const seen = new Set();
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      const key = vocabularyEntryKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sameEnglishWord(leftValue, rightValue) {
    const left = normalizeEnglishWord(leftValue);
    return Boolean(left) && left === normalizeEnglishWord(rightValue);
  }

  function isEquivalentVocabularyAnswer(selected, answer) {
    return Boolean(selected && answer)
      && (selected.id === answer.id || sameEnglishWord(selected.en, answer.en));
  }

  function normalizeChineseSense(value) {
    return String(value || "")
      .replace(/\b(?:n|v|vt|vi|adj|adv|prep|pron|conj|num|art)\.?\b/gi, "")
      .replace(/[“”"'‘’\s]/g, "")
      .replace(/[的地得]+$/u, "")
      .replace(/[^\u3400-\u9fffA-Za-z0-9]/gu, "")
      .toLocaleLowerCase("en-US");
  }

  function splitChineseSenses(value) {
    const text = String(value || "")
      .replace(/[（(][^（）()]*[）)]/gu, " ")
      .replace(/[：:]/gu, "，");
    return [...new Set(text
      .split(/[，,；;、/|｜\n]+/u)
      .map(normalizeChineseSense)
      .filter((sense) => sense.length >= 2))];
  }

  function sensesOverlap(leftValue, rightValue) {
    const leftSenses = splitChineseSenses(leftValue);
    const rightSenses = splitChineseSenses(rightValue);
    return leftSenses.some((left) => rightSenses.some((right) => {
      if (left === right) return true;
      const shorter = left.length <= right.length ? left : right;
      const longer = left.length > right.length ? left : right;
      return shorter.length >= 2 && longer.includes(shorter);
    }));
  }

  function englishFamilyRoot(value) {
    const word = normalizeEnglishWord(value);
    for (const suffix of ENGLISH_SUFFIXES) {
      if (!word.endsWith(suffix)) continue;
      let root = word.slice(0, -suffix.length);
      if (suffix === "ied" || suffix === "ies") root += "y";
      if (root.length >= 4) return root;
    }
    return word;
  }

  function sameEnglishFamily(left, right) {
    const leftWord = normalizeEnglishWord(left);
    const rightWord = normalizeEnglishWord(right);
    if (!leftWord || !rightWord || leftWord === rightWord) return leftWord === rightWord;
    const leftRoot = englishFamilyRoot(leftWord);
    const rightRoot = englishFamilyRoot(rightWord);
    return leftRoot.length >= 4 && leftRoot === rightRoot;
  }

  function hasSharedMeaningfulChineseCharacter(leftValue, rightValue) {
    const leftChars = new Set(splitChineseSenses(leftValue).join("").split("").filter((char) => !COMMON_CHINESE_CHARS.has(char)));
    const rightChars = new Set(splitChineseSenses(rightValue).join("").split("").filter((char) => !COMMON_CHINESE_CHARS.has(char)));
    return [...leftChars].some((char) => rightChars.has(char));
  }

  function hasMeaningConflict(candidate, answer) {
    if (!candidate || !answer) return false;
    // 同一个英文词的不同中文义项都可能是正确答案，绝不能互相充当干扰项。
    if (sameEnglishWord(candidate.en, answer.en)) return true;
    if (sensesOverlap(candidate.zh, answer.zh)) return true;
    return sameEnglishFamily(candidate.en, answer.en)
      && hasSharedMeaningfulChineseCharacter(candidate.zh, answer.zh);
  }

  return {
    normalizeDisplayedChoiceText,
    normalizeEnglishWord,
    vocabularyEntryKey,
    dedupeVocabularyEntries,
    sameEnglishWord,
    isEquivalentVocabularyAnswer,
    splitChineseSenses,
    sensesOverlap,
    sameEnglishFamily,
    hasMeaningConflict
  };
}));
