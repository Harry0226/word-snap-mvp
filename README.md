# 秒懂词 v3

面向初一到高三学生的分层刷词 MVP，同时新增英语作文图片批改工作台。

## 功能

- 按初一、初二、初三、高一、高二、高三、中考冲刺、高考冲刺选择训练阶段
- 支持看英文选中文、看中文说英文、按阶段自动训练
- 支持 20 词、50 词、100 词、全部单词训练
- 支持智能混合、只练错词慢词、只练新词、全部单词训练范围
- 支持图片/PDF AI 识别加入词库，结果必须确认后保存
- 支持文字直接粘贴添加词库
- 自定义词库和练习记录保存在浏览器 IndexedDB
- 提供错词/慢词列表、阶段报告、词库导入导出
- 新增 `essay.html` 英语作文批改页，支持上传作文图片/PDF、自动找出语法/拼写/标点错误
- 支持在图片上自动圈错并生成中英双语小注释，老师可手动拖拽微调
- 支持输出开头优化句、结尾优化句、个人常见错误总结和全班共性错误总结
- 批改记录保存在单独的浏览器 IndexedDB，可导出/导入 JSON 备份

## AI 识别配置

部署到 Cloudflare Pages 后，设置 Secret：

```bash
wrangler pages secret put OPENAI_API_KEY --project-name word-snap-mvp
```

可选设置模型：

```bash
wrangler pages secret put OPENAI_MODEL --project-name word-snap-mvp
```

默认模型为 `gpt-5.4-mini`。

作文批改页可选单独模型：

```bash
wrangler pages secret put OPENAI_ESSAY_MODEL --project-name word-snap-mvp
```

未配置时会回退到 `OPENAI_MODEL`。

## 部署

这是静态站点 + Cloudflare Pages Function。

- 刷词入口：`index.html`
- 作文批改入口：`essay.html`
- 词库 AI 识别接口：`functions/api/recognize.js`
- 作文批改接口：`functions/api/essay-review.js`

## 本地开发

不要用 `python -m http.server` 预览作文批改页，因为它不支持 `POST /api/*`，浏览器里会看到 `501 Unsupported method`。

请改用：

```bash
node dev-server.mjs
```

默认地址：

```bash
http://127.0.0.1:4173/essay.html
```

如果要在本地真调 AI，请在项目根目录放 `.dev.vars` 或 `.env`：

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
OPENAI_ESSAY_MODEL=gpt-5.4-mini
```

如果只想给作文批改页接入单独的兼容模型，也可以只配置作文专用变量：

```bash
OPENAI_ESSAY_API_KEY=your_key_here
OPENAI_ESSAY_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
OPENAI_ESSAY_MODEL=mimo-v2.5-pro
```

例如接入小米 MiMo 的 Token Plan 时，作文批改接口会自动改走兼容的 `chat/completions` 路径，并优先使用本地 OCR 文本完成批改。
