const DEFAULT_MODEL = "gpt-5.4-mini";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.OPENAI_API_KEY) {
    return json({ error: "Cloudflare Secret OPENAI_API_KEY is not configured." }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const images = Array.isArray(payload.images) ? payload.images.slice(0, 12) : [];
  if (!images.length) {
    return json({ error: "No images provided." }, 400);
  }

  const inputContent = [
    {
      type: "input_text",
      text: [
        "你是初高中英语老师。请从讲义图片中抽取适合加入背单词词库的英文词条。",
        "只抽取真实英语单词或常见短语中的核心单词，忽略页码、题号、姓名、班级、无意义装饰文字。",
        "中文释义要短，适合学生训练时快速反应。notes 放搭配、变形、易混辨析或讲义中的考点。",
        `目标阶段：${payload.stage || "未指定"}。资料名称：${payload.sourceName || "未命名资料"}。`
      ].join("\n")
    },
    ...images.map((image) => ({
      type: "input_image",
      image_url: image.dataUrl,
      detail: "high"
    }))
  ];

  const body = {
    model: env.OPENAI_MODEL || DEFAULT_MODEL,
    input: [{ role: "user", content: inputContent }],
    text: {
      format: {
        type: "json_schema",
        name: "recognized_vocabulary",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["words", "warnings"],
          properties: {
            words: {
              type: "array",
              maxItems: 300,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["en", "zh", "pos", "notes", "confidence"],
                properties: {
                  en: { type: "string" },
                  zh: { type: "string" },
                  pos: { type: "string" },
                  notes: { type: "string" },
                  confidence: { type: "number" }
                }
              }
            },
            warnings: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      }
    }
  };

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return json({ error: data.error?.message || "OpenAI recognition failed." }, upstream.status);
  }

  const parsed = parseModelJson(data);
  return json({
    words: sanitizeWords(parsed.words || []),
    warnings: parsed.warnings || []
  });
}

export function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

function parseModelJson(data) {
  const text = data.output_text || collectOutputText(data.output);
  if (!text) return { words: [], warnings: ["AI returned no text output."] };
  try {
    return JSON.parse(text);
  } catch {
    return { words: [], warnings: ["AI output was not valid JSON."] };
  }
}

function collectOutputText(output) {
  if (!Array.isArray(output)) return "";
  return output.flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text" && part.text)
    .map((part) => part.text)
    .join("\n");
}

function sanitizeWords(words) {
  const seen = new Set();
  return words.map((word) => ({
    en: String(word.en || "").trim().toLowerCase(),
    zh: String(word.zh || "").trim(),
    pos: String(word.pos || "").trim(),
    notes: String(word.notes || "").trim(),
    confidence: Number(word.confidence || 0)
  })).filter((word) => {
    if (!/^[a-z][a-z'-]{1,30}$/.test(word.en)) return false;
    if (seen.has(word.en)) return false;
    seen.add(word.en);
    return true;
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
