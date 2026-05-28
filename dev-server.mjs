import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"]
]);

const env = loadEnvFile(path.join(ROOT, ".dev.vars"));
const envFallback = loadEnvFile(path.join(ROOT, ".env"));
const runtimeEnv = { ...envFallback, ...env, ...process.env };

const apiRoutes = new Map([
  ["/api/recognize", "./functions/api/recognize.js"],
  ["/api/essay-review", "./functions/api/essay-review.js"]
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (apiRoutes.has(url.pathname)) {
      await handleApiRequest(req, res, url);
      return;
    }
    await handleStaticRequest(req, res, url.pathname);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error?.stack || String(error));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Dev server running at http://${HOST}:${PORT}`);
  if (!runtimeEnv.OPENAI_API_KEY && !runtimeEnv.OPENAI_ESSAY_API_KEY) {
    console.log("Warning: no AI API key is set. Essay review will use the local fallback mode until you provide OPENAI_API_KEY or OPENAI_ESSAY_API_KEY.");
  }
});

async function handleApiRequest(nodeReq, nodeRes, url) {
  const modulePath = apiRoutes.get(url.pathname);
  const handlerModule = await import(`${pathToFileURL(path.join(ROOT, modulePath)).href}?t=${Date.now()}`);
  const method = nodeReq.method || "GET";
  const handlerName = method === "OPTIONS" ? "onRequestOptions" : `onRequest${capitalize(method.toLowerCase())}`;
  const handler = handlerModule[handlerName];
  if (typeof handler !== "function") {
    nodeRes.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
    nodeRes.end(JSON.stringify({ error: `Method ${method} not supported.` }));
    return;
  }

  const body = await readRequestBody(nodeReq);
  const request = new Request(url, {
    method,
    headers: nodeReq.headers,
    body: method === "GET" || method === "HEAD" || method === "OPTIONS" ? undefined : body
  });
  const response = await handler({ request, env: runtimeEnv });

  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  nodeRes.writeHead(response.status, headers);
  const buffer = Buffer.from(await response.arrayBuffer());
  nodeRes.end(buffer);
}

async function handleStaticRequest(nodeReq, nodeRes, pathname) {
  let safePath = decodeURIComponent(pathname);
  if (safePath === "/") safePath = "/index.html";
  const candidate = path.join(ROOT, safePath);
  const resolved = resolveStaticPath(candidate);
  if (!resolved) {
    nodeRes.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    nodeRes.end("Not found");
    return;
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_TYPES.get(ext) || "application/octet-stream";
  nodeRes.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache"
  });
  if (nodeReq.method === "HEAD") {
    nodeRes.end();
    return;
  }
  fs.createReadStream(resolved).pipe(nodeRes);
}

function resolveStaticPath(candidate) {
  const normalized = path.normalize(candidate);
  if (!normalized.startsWith(ROOT)) return null;
  if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) return normalized;
  if (fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()) {
    const indexFile = path.join(normalized, "index.html");
    if (fs.existsSync(indexFile)) return indexFile;
  }
  return null;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .reduce((acc, line) => {
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      acc[key] = value;
      return acc;
    }, {});
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
