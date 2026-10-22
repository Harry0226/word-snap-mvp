const assert = require('assert');
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:8765/', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => Boolean(state.db && state.words.length));
  assert.equal(await page.locator('#view-decks').count(), 1);
  for (const stage of await page.evaluate(() => STAGES)) {
    const result = await page.evaluate(async (stage) => {
      await ensureStageLoaded(stage);
      await loadState();
      const words = state.words.filter((word) => stageMatches(word, stage)).slice(0, 8);
      await startLearningFlow({grade: stage, total: 8, correct: 8}, words, [], []);
      return {spelling: state.learningFlow.spelling.length, fill: state.learningFlow.fill.length,
        listening: state.learningFlow.listening.length,
        valid: state.learningFlow.spelling.filter((item) => item.valid).length,
        unique: new Set(state.learningFlow.listening.map((item) => item.english)).size,
        audio: state.learningFlow.listening.every((item) => item.audio && item.choices.length === 3 && new Set(item.choices).size === 3 && item.choices.includes(item.chinese))};
    }, stage);
    assert.deepEqual(result, {spelling: 10, fill: 3, listening: 20, valid: 5, unique: 20, audio: true}, stage);
    console.log(`${stage}: flow bank ready`);
  }
  await page.evaluate(async () => {
    state.learningFlow = null;
    await saveLearningFlow();
    document.querySelector('#learningFlow').hidden = true;
    await ensureStageLoaded(STAGES[0]);
    await loadState();
    document.querySelector('#practiceMode').value = 'enToZhChoice';
    const word = state.words.find((item) => stageMatches(item, STAGES[0]) && /^[a-z]{4,}$/.test(item.en));
    await startSession({wordIds: [word.id], grade: STAGES[0]});
  });
  await page.waitForFunction(() => state.session?.timingReady);
  await page.evaluate(() => {
    const correct = [...document.querySelectorAll('#choices button')].find((button) => button.dataset.choiceId === state.session.current.id);
    if (!correct) throw new Error('No correct training choice');
    correct.click();
  });
  await page.waitForSelector('#learningFlow:not([hidden])', {timeout: 15000});
  assert.equal(await page.locator('#flowTitle').textContent(), '拼写判断');
  await page.reload({waitUntil: 'networkidle'});
  await page.waitForSelector('#learningFlow:not([hidden])');
  assert.equal(await page.locator('#flowTitle').textContent(), '拼写判断');
  await page.locator('#flowClose').click();
  assert.equal(await page.locator('#resumeFlowBtn').isVisible(), true);
  await page.locator('#resumeFlowBtn').click();
  const wordbook = await page.evaluate(() => bookEntry('achieve'));
  assert(wordbook.definition.length > 1);
  await page.locator('#flowClose').click();
  await page.locator('[data-view="decks"]').first().click();
  await page.locator('#wordbookSearch').fill('achieve');
  assert(await page.locator('.wordbook-entry').count() >= 1);
  const beforeSave = await page.locator('[data-book-save="achieve"]').getAttribute('aria-pressed');
  await page.locator('[data-book-save="achieve"]').click();
  await page.waitForFunction((before) => document.querySelector('[data-book-save="achieve"]')?.getAttribute('aria-pressed') !== before, beforeSave);
  assert.notEqual(await page.locator('[data-book-save="achieve"]').getAttribute('aria-pressed'), beforeSave);
  assert.deepEqual(errors, []);
  await page.evaluate(() => renderLearningFlow(true));
  await page.evaluate(async () => submitFlowAnswer(!flowCurrent().valid));
  assert(await page.locator('.flow-feedback.is-wrong').isVisible());
  assert(await page.locator('#flowContinue').isVisible());
  await page.reload({waitUntil: 'networkidle'});
  await page.waitForSelector('.flow-feedback.is-wrong');
  await page.locator('#flowContinue').click();
  await page.evaluate(async () => {
    while (state.learningFlow.phase === 'spelling') {
      await submitFlowAnswer(flowCurrent().valid);
      await nextFlowQuestion();
    }
  });
  await page.screenshot({path: '/tmp/word-snap-verification/learning-fill-desktop.png'});
  await page.evaluate(async () => {
    await submitFlowAnswer(flowCurrent().map((item, index) => index === 0 ? item.word.slice(item.prefix.length) : item.word));
    await nextFlowQuestion();
    while (state.learningFlow.phase === 'listening') {
      const item = flowCurrent();
      await submitFlowAnswer(item.choices.indexOf(item.chinese));
      await nextFlowQuestion();
    }
  });
  assert.equal(await page.locator('#flowTitle').textContent(), '今日结算');
  assert.match(await page.locator('.flow-summary-weekly').textContent(), /1\/5/);
  assert.match(await page.locator('.flow-summary-meta').textContent(), /本次模式.*所选词汇.*总用时/s);
  assert.match(await page.locator('.flow-summary-meta').textContent(), /总用时.*秒/s);
  assert.match(await page.locator('.flow-summary-banner').textContent(), /\d{4}年\d+月\d+日/);
  assert.equal(await page.locator('.flow-summary img').evaluate((img) => img.naturalWidth > 0), true);
  assert.equal(await page.evaluate(() => state.learningDays.size), 1);
  assert.equal(await page.evaluate(() => state.learningCompletions.has(learningDateKey())), true);
  assert.equal(await page.evaluate(async () => {await recordLearningDay(); return state.learningDays.size;}), 1);
  const weekBoundary = await page.evaluate(() => {
    const existing = state.learningDays;
    state.learningDays = new Set(['2026-10-19', '2026-10-25', '2026-10-26']);
    const result = [weeklyLearningDays(new Date(2026, 9, 25)), weeklyLearningDays(new Date(2026, 9, 26))];
    state.learningDays = existing;
    return result;
  });
  assert.deepEqual(weekBoundary, [2, 1]);
  await page.screenshot({path: '/tmp/word-snap-verification/learning-desktop.png'});
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: '/tmp/word-snap-verification/learning-mobile.png'});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.locator('#flowFinish').click();
  await page.evaluate(() => switchView('train'));
  assert.equal(await page.locator('#todayRecordBtn').isEnabled(), true);
  await page.screenshot({path: '/tmp/word-snap-verification/learning-home-mobile.png'});
  await page.locator('#todayRecordBtn').click();
  assert.equal(await page.locator('#flowTitle').textContent(), '今日结算');
  await page.locator('#flowFinish').click();
  await page.reload({waitUntil: 'networkidle'});
  await page.waitForFunction(() => Boolean(state.db && state.words.length));
  assert.equal(await page.locator('#todayRecordBtn').isEnabled(), true);
  await page.locator('#todayRecordBtn').click();
  assert.equal(await page.locator('#flowTitle').textContent(), '今日结算');
  await page.locator('#flowFinish').click();
  await page.evaluate(async () => {
    const word = state.words.find((item) => stageMatches(item, STAGES[0]) && /^[a-z]{4,}$/.test(item.en));
    await startSession({wordIds: [word.id], grade: STAGES[0]});
  });
  await page.waitForFunction(() => state.session?.timingReady);
  await page.evaluate(() => {
    const wrong = [...document.querySelectorAll('#choices button')].find((button) => button.dataset.choiceId !== state.session.current.id);
    wrong.click();
  });
  await page.waitForSelector('#wordbookExplanation:not([hidden])');
  assert(await page.locator('#trainContinueBtn').isVisible());
  await page.evaluate(async () => {
    window.flowPlayCount = 0;
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      if (this.id === 'flowAudio') window.flowPlayCount += 1;
      return originalPlay.call(this);
    };
    state.session = null;
    await startLearningFlow({grade: STAGES[0], total: 1, correct: 0}, state.words.filter((item) => stageMatches(item, STAGES[0])).slice(0, 8), [], []);
    state.learningFlow.phase = 'listening';
    state.learningFlow.index = 0;
    await saveLearningFlow();
    renderLearningFlow(true);
  });
  await page.waitForFunction(() => window.flowPlayCount >= 1);
  await page.locator('#flowPlayAudio').click();
  await page.waitForFunction(() => document.querySelector('#flowAudio')?.currentTime > 0, {timeout: 10000});
  await page.locator('#flowPlayAudio').click();
  assert((await page.evaluate(() => window.flowPlayCount)) >= 3);
  const correctListening = await page.evaluate(() => flowCurrent().choices.indexOf(flowCurrent().chinese));
  await page.locator(`[data-listening="${correctListening}"]`).click();
  await page.waitForSelector('.flow-transcript');
  assert.equal(await page.locator('#flowContinue').count(), 0);
  await page.locator('#flowClose').click();
  await page.waitForTimeout(2300);
  assert.equal(await page.evaluate(() => state.learningFlow.index), 0);
  await page.locator('#resumeFlowBtn').click();
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(() => state.learningFlow.index), 0);
  await page.waitForFunction(() => state.learningFlow.index === 1, {timeout: 6000});
  await page.waitForFunction(() => window.flowPlayCount >= 4);
  const wrongListening = await page.evaluate(() => flowCurrent().choices.findIndex((choice) => choice !== flowCurrent().chinese));
  await page.locator(`[data-listening="${wrongListening}"]`).click();
  await page.waitForSelector('.flow-feedback.is-wrong');
  await page.waitForTimeout(2300);
  assert.equal(await page.evaluate(() => state.learningFlow.index), 1);
  await page.locator('#flowPlayAudio').click();
  await page.locator('#flowContinue').click();
  await page.waitForFunction(() => state.learningFlow.index === 2);
  await page.waitForFunction(() => window.flowPlayCount >= 6);
  await page.screenshot({path: '/tmp/word-snap-verification/learning-listening-mobile.png'});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Browser flow and wordbook checks passed');
}

run().catch((error) => {console.error(error); process.exit(1);});
