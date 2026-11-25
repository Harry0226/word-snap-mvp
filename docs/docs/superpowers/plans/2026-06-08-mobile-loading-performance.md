# Mobile Loading Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site open reliably on phones, tablets, and weaker Wi-Fi while keeping the GitHub Pages URL and adding Cloudflare Pages as a backup.

**Architecture:** Replace the single blocking 800KB built-in vocabulary script with a small manifest and one script per stage. Load and seed only the selected stage at startup, then load other stage and quiz assets on demand through one retrying script loader. Keep versioned static assets cacheable for a year on Cloudflare while keeping HTML revalidated.

**Tech Stack:** Static HTML/CSS/JavaScript, IndexedDB, GitHub Pages, Cloudflare Pages.

---

### Task 1: Add performance regression checks

**Files:**
- Create: `tests/check-lazy-stage-loading.js`
- Modify: `tests/check-loading-and-cache.js`

- [ ] Assert that `index.html` loads the small manifest but does not load the full built-in list, junior exam list, or phrase list.
- [ ] Assert that `app.js` exposes retrying stage loading and loads a stage before training or battle starts.
- [ ] Assert that `_headers` gives versioned JS/CSS/data assets long-lived immutable caching.
- [ ] Run the checks and confirm they fail before implementation.

### Task 2: Split built-in vocabulary by stage

**Files:**
- Create: `word-data/builtin-manifest.js`
- Create: `word-data/stages/*.js`
- Create: `tools/split_builtin_lists.js`

- [ ] Generate one browser script per stage from the current source data.
- [ ] Include stage, source, goals, word count, version, and asset path in the manifest.
- [ ] Verify every existing built-in word appears exactly once in the generated stage assets.

### Task 3: Add resilient on-demand loading

**Files:**
- Create: `asset-loader.js`
- Modify: `app.js`
- Modify: `index.html`

- [ ] Implement a shared script loader with timeout, cache-busting retry, and deduplicated in-flight requests.
- [ ] Remove blocking full vocabulary scripts from `index.html`.
- [ ] Load and seed only the selected stage during startup.
- [ ] Ensure stage data is loaded before training, battle, deck filtering, or word-generated quiz fallback.
- [ ] Show a clear loading/error status and backup URL when an asset cannot be loaded.

### Task 4: Improve caching and verify

**Files:**
- Modify: `_headers`
- Modify: `tests/check-loading-and-cache.js`

- [ ] Cache versioned JS, CSS, and word data for one year on Cloudflare Pages.
- [ ] Keep HTML on revalidation so releases appear promptly.
- [ ] Run all static checks and `git diff --check`.
- [ ] Measure initial transferred bytes and verify desktop/mobile/tablet behavior locally.
- [ ] Confirm both GitHub Pages and Cloudflare Pages deployment targets before any deployment.
