(function exposeRotationQueue(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.WordSnapRotation = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ROTATION_STATE_VERSION = 2;

  function uniqueIds(items, validIds) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((id) => {
      if (!validIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function shuffleIds(items, random = Math.random) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function createRotationState(poolIds, random) {
    const ids = [...new Set(poolIds)];
    return {
      version: ROTATION_STATE_VERSION,
      cycle: 1,
      knownIds: ids,
      remaining: shuffleIds(ids, random),
      deferred: [],
      active: []
    };
  }

  function reconcileRotationState(savedState, poolIds, random) {
    const ids = [...new Set(poolIds)];
    const validIds = new Set(ids);
    if (!savedState || savedState.version !== ROTATION_STATE_VERSION) {
      return createRotationState(ids, random);
    }

    const active = uniqueIds(savedState.active, validIds);
    const activeSet = new Set(active);
    const deferred = uniqueIds(savedState.deferred, validIds)
      .filter((id) => !activeSet.has(id));
    const reserved = new Set([...active, ...deferred]);
    const remaining = uniqueIds(savedState.remaining, validIds)
      .filter((id) => !reserved.has(id));
    remaining.forEach((id) => reserved.add(id));

    const knownIds = new Set(Array.isArray(savedState.knownIds) ? savedState.knownIds : []);
    const addedIds = ids.filter((id) => !knownIds.has(id) && !reserved.has(id));

    return {
      version: ROTATION_STATE_VERSION,
      cycle: Math.max(1, Number(savedState.cycle || 1)),
      knownIds: ids,
      remaining: [...remaining, ...shuffleIds(addedIds, random)],
      deferred,
      active
    };
  }

  function prepareRotationBatch(savedState, poolIds, sizeValue, options = {}) {
    const random = options.random || Math.random;
    const ids = [...new Set(poolIds)].filter(Boolean);
    const state = reconcileRotationState(savedState, ids, random);

    if (state.active.length) {
      const deferredSet = new Set(state.deferred);
      state.active.forEach((id) => {
        if (!deferredSet.has(id)) {
          state.deferred.push(id);
          deferredSet.add(id);
        }
      });
      state.active = [];
    }

    if (!state.remaining.length && !state.deferred.length && ids.length) {
      state.cycle += 1;
      state.remaining = shuffleIds(ids, random);
    }

    let batch;
    if (sizeValue === "all") {
      batch = [...state.remaining, ...state.deferred];
      state.remaining = [];
      state.deferred = [];
    } else {
      const requestedSize = Math.max(1, Number(sizeValue) || 1);
      const source = state.remaining.length ? state.remaining : state.deferred;
      batch = source.splice(0, Math.min(requestedSize, source.length));
    }

    state.active = [...batch];
    return { state, batch };
  }

  function completeRotationItem(savedState, itemId) {
    if (!savedState || savedState.version !== ROTATION_STATE_VERSION) return savedState;
    return {
      ...savedState,
      active: savedState.active.filter((id) => id !== itemId)
    };
  }

  return {
    ROTATION_STATE_VERSION,
    prepareRotationBatch,
    completeRotationItem
  };
}));
