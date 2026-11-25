(function initStorage(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapStorage = api;
})(typeof window !== "undefined" ? window : globalThis, function createStorage() {
  const DB_NAME = "word-snap-v2";
  const DB_VERSION = 4;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("words")) {
          const words = db.createObjectStore("words", { keyPath: "id" });
          words.createIndex("stage", "grade", { unique: false });
          words.createIndex("sourceType", "sourceType", { unique: false });
        }
        if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "wordId" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
        if (!db.objectStoreNames.contains("quizWrongAnswers")) db.createObjectStore("quizWrongAnswers", { keyPath: "questionId" });
        if (!db.objectStoreNames.contains("streaks")) db.createObjectStore("streaks", { keyPath: "key" });
        if (db.objectStoreNames.contains("achievements")) db.deleteObjectStore("achievements");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function storeTx(db, storeName, mode = "readonly") {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function getAll(db, storeName) {
    return new Promise((resolve, reject) => {
      const request = storeTx(db, storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function getWordsByStage(db, stage) {
    return new Promise((resolve, reject) => {
      const request = storeTx(db, "words").index("stage").getAll(stage);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function getMeta(db, key) {
    return new Promise((resolve) => {
      const request = storeTx(db, "meta").get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  function put(db, storeName, value) {
    return new Promise((resolve, reject) => {
      const request = storeTx(db, storeName, "readwrite").put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function putBatch(db, storeName, values) {
    if (!values.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      values.forEach((value) => store.put(value));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function remove(db, storeName, key) {
    return new Promise((resolve, reject) => {
      const request = storeTx(db, storeName, "readwrite").delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function clearStore(db, storeName) {
    return new Promise((resolve, reject) => {
      const request = storeTx(db, storeName, "readwrite").clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function deleteWordsBySourceType(db, sourceType) {
    return new Promise((resolve, reject) => {
      const request = storeTx(db, "words", "readwrite").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve();
        if (cursor.value.sourceType === sourceType) cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  function deleteWordsByIds(db, wordIds) {
    if (!wordIds.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("words", "readwrite");
      const store = transaction.objectStore("words");
      wordIds.forEach((id) => store.delete(id));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function deleteRecordsByWordIds(db, wordIds) {
    if (!wordIds.size) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const request = storeTx(db, "records", "readwrite").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve();
        if (wordIds.has(cursor.value.wordId)) cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  function replaceBuiltinStageWords(db, stage, words) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("words", "readwrite");
      const store = transaction.objectStore("words");
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (cursor.value.sourceType === "builtin" && cursor.value.grade === stage) cursor.delete();
          cursor.continue();
          return;
        }
        words.forEach((word) => store.put(word));
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  return {
    DB_NAME,
    DB_VERSION,
    openDb,
    storeTx,
    getAll,
    getWordsByStage,
    getMeta,
    put,
    putBatch,
    remove,
    clearStore,
    deleteWordsBySourceType,
    deleteWordsByIds,
    deleteRecordsByWordIds,
    replaceBuiltinStageWords
  };
});
