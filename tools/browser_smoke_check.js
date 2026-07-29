const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const siteUrl = process.env.WORD_SNAP_URL || "http://127.0.0.1:8765/";
const outputRoot = process.env.WORD_SNAP_SCREENSHOTS || path.join(os.tmpdir(), "word-snap-browser-check");
const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), "word-snap-edge-"));
const debugPort = 9337;
let localServer;
let localServerReady;

fs.mkdirSync(outputRoot, { recursive: true });

if (!process.env.WORD_SNAP_URL) {
  const siteRoot = path.resolve(__dirname, "..", "docs");
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg"
  };
  localServer = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, siteUrl).pathname);
    const requestedPath = pathname === "/" ? "/index.html" : pathname;
    const filePath = path.resolve(siteRoot, `.${requestedPath}`);
    if (!filePath.startsWith(`${siteRoot}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    const fileSize = fs.statSync(filePath).size;
    const headers = {
      "Accept-Ranges": "bytes",
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    };
    const range = request.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match && match[1] ? Number(match[1]) : 0;
      const end = match && match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1;
      if (!match || start > end || start >= fileSize) {
        response.writeHead(416, { "Content-Range": `bytes */${fileSize}` }).end();
        return;
      }
      response.writeHead(206, {
        ...headers,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`
      });
      fs.createReadStream(filePath, { start, end }).pipe(response);
      return;
    }
    response.writeHead(200, { ...headers, "Content-Length": fileSize });
    fs.createReadStream(filePath).pipe(response);
  });
  localServerReady = new Promise((resolve, reject) => {
    localServer.once("error", reject);
    localServer.listen(8765, "127.0.0.1", resolve);
  });
}

const edge = spawn(edgePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileRoot}`,
  "about:blank"
], { stdio: "ignore", windowsHide: true });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForJson(url, options) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function waitForOk(url) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function run() {
  if (localServer) {
    await localServerReady;
    await waitForOk(siteUrl);
  }
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const target = await waitForJson(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`${siteUrl}?browser-check=${Date.now()}`)}`,
    { method: "PUT" }
  );
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  const browserErrors = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      browserErrors.push(message.params.exceptionDetails.text);
    }
  });

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression, userGesture = false) => {
    const result = await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label, timeout = 15000, interval = 200) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      await delay(interval);
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const screenshot = async (name) => {
    const result = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
    const filePath = path.join(outputRoot, name);
    fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
    return filePath;
  };

  await command("Runtime.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await command("Page.navigate", { url: `${siteUrl}?browser-check=${Date.now()}` });
  await waitFor(
    `document.readyState === "complete" && Number(document.querySelector("#totalWords")?.textContent || 0) > 0`,
    "vocabulary initialization",
    30000
  );

  const initial = await evaluate(`(() => {
    const button = document.querySelector("#startDailyTaskBtn").getBoundingClientRect();
    return {
      buttonTop: Math.round(button.top),
      buttonBottom: Math.round(button.bottom),
      viewportHeight: innerHeight,
      desktopTabs: getComputedStyle(document.querySelector(".tabs")).display,
      mobileNav: getComputedStyle(document.querySelector(".mobile-nav")).display,
      noticeOpen: document.querySelector(".notice-board").open
    };
  })()`);
  if (initial.buttonBottom > initial.viewportHeight || initial.buttonTop < 0) {
    throw new Error(`Daily task button is outside the mobile first screen: ${JSON.stringify(initial)}`);
  }
  if (initial.desktopTabs !== "none" || initial.mobileNav === "none" || initial.noticeOpen) {
    throw new Error(`Mobile hierarchy is incorrect: ${JSON.stringify(initial)}`);
  }
  const initialShot = await screenshot("mobile-first-screen.png");

  await evaluate(`(() => {
    const mode = document.querySelector("#practiceMode");
    mode.value = "audioToZhChoice";
    mode.dispatchEvent(new Event("change", { bubbles: true }));
    window.__originalPronunciationPlayWord = pronunciationPlayer.playWord.bind(pronunciationPlayer);
    pronunciationPlayer.playWord = async () => ({ status: "blocked" });
    document.querySelector("#startDailyTaskBtn").click();
  })()`, true);
  await waitFor(
    `document.querySelector("#word")?.textContent === "听发音" && document.querySelectorAll("#choices button").length === 4`,
    "audio question"
  );
  await waitFor(
    `document.querySelector("#audioPromptBtn")?.textContent.includes("点一下") && [...document.querySelectorAll("#choices button")].every((button) => button.disabled)`,
    "blocked autoplay recovery"
  );
  const recovery = await evaluate(`(() => ({
    button: document.querySelector("#audioPromptBtn").textContent,
    feedback: document.querySelector("#feedback").textContent
  }))()`);
  await evaluate(`(() => {
    pronunciationPlayer.playWord = window.__originalPronunciationPlayWord;
    document.querySelector("#audioPromptBtn").click();
  })()`, true);
  await waitFor(
    `[...document.querySelectorAll("#choices button")].every((button) => !button.disabled)`,
    "audio prompt completion",
    10000
  );

  const training = await evaluate(`(() => {
    const card = document.querySelector(".trainer .word-card").getBoundingClientRect();
    return {
      cardTop: Math.round(card.top),
      cardBottom: Math.round(card.bottom),
      timer: document.querySelector("#timer").textContent,
      replayVisible: !document.querySelector("#audioPromptBtn").hidden
    };
  })()`);
  if (training.cardTop < 0 || training.cardTop >= 300 || !training.replayVisible || !training.timer.includes("用时")) {
    throw new Error(`Training prompt did not auto-position or start correctly: ${JSON.stringify(training)}`);
  }

  await evaluate(`(() => {
    window.__wordSnapWrongWordId = state.session.current.id;
    const wrongChoice = [...document.querySelectorAll("#choices button")].find((button) => (
      button.dataset.choiceId !== state.session.current.id
      && button.dataset.choiceEnglish !== normalizeEnglishWord(state.session.current.en)
    ));
    wrongChoice.click();
  })()`);
  await waitFor(
    `state.session.answered && state.session.lastAnswerCorrect === false && !document.querySelector("#trainContinueBtn").hidden`,
    "wrong answer review state"
  );
  await evaluate(`document.querySelector("#audioPromptBtn").click()`, true);
  await waitFor(
    `document.querySelector("#audioPromptBtn").textContent === "再听一次" && !document.querySelector("#audioPromptBtn").disabled`,
    "wrong answer audio replay",
    10000
  );
  const wrongReplay = await evaluate(`(() => ({
    feedback: document.querySelector("#feedback").textContent,
    choicesLocked: [...document.querySelectorAll("#choices button")].every((button) => button.disabled),
    continueVisible: !document.querySelector("#trainContinueBtn").hidden,
    answered: state.session.answered
  }))()`);
  if (!wrongReplay.feedback.includes("错题") || !wrongReplay.choicesLocked || !wrongReplay.continueVisible || !wrongReplay.answered) {
    throw new Error(`Wrong-answer replay changed the completed answer state: ${JSON.stringify(wrongReplay)}`);
  }
  const wrongReplayShot = await screenshot("mobile-wrong-replay.png");
  await evaluate(`document.querySelector("#trainContinueBtn").click()`, true);
  await waitFor(
    `state.session.current?.id !== window.__wordSnapWrongWordId && [...document.querySelectorAll("#choices button")].every((button) => !button.disabled)`,
    "next audio word after wrong-answer replay",
    10000
  );

  await evaluate(`(() => {
    window.__wordSnapAnswerId = state.session.current.id;
    window.__wordSnapClickedAt = performance.now();
    document.querySelector(\`#choices button[data-choice-id="\${window.__wordSnapAnswerId}"]\`).click();
  })()`);
  await waitFor(
    `state.session.current?.id !== window.__wordSnapAnswerId`,
    "next word after correct answer",
    2000,
    20
  );
  const answered = await evaluate(`(() => {
    return {
      transitionMs: Math.round(performance.now() - window.__wordSnapClickedAt),
      nextPrompt: document.querySelector("#word").textContent,
      progress: document.querySelector("#progressText").textContent
    };
  })()`);
  if (answered.transitionMs > 500) {
    throw new Error(`Correct-answer transition is too slow: ${JSON.stringify(answered)}`);
  }
  const answerShot = await screenshot("mobile-next-word.png");

  if (browserErrors.length) throw new Error(`Browser exceptions: ${browserErrors.join("; ")}`);
  console.log(JSON.stringify({
    initial,
    recovery,
    training,
    wrongReplay,
    answered,
    screenshots: [initialShot, wrongReplayShot, answerShot]
  }, null, 2));
  socket.close();
}

run()
  .catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    edge.kill();
    if (localServer) localServer.close();
    await delay(500);
    fs.rmSync(profileRoot, { recursive: true, force: true });
  });
