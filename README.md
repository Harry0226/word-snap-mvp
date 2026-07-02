# 秒懂词 v3

面向初一到高三学生的分层刷词 MVP。

## 功能

- 按初一、初二、初三、高一、高二、高三、中考冲刺、高考冲刺选择训练阶段
- 支持看英文选中文、看中文说英文、按阶段自动训练
- 支持 20 词、50 词、100 词、全部单词训练
- 支持智能混合、只练错词慢词、只练新词、全部单词训练范围
- 支持图片/PDF AI 识别加入词库，结果必须确认后保存
- 支持文字直接粘贴添加词库
- 自定义词库和练习记录保存在浏览器 IndexedDB
- 提供错词/慢词列表、阶段报告、词库导入导出

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

## 部署

这是静态站点 + Cloudflare Pages Function。入口文件是 `index.html`，AI 识别接口是 `functions/api/recognize.js`。

### 日常修改发布

```bash
git pull origin main
git add .
git commit -m "描述这次修改"
git push origin main
wrangler pages deploy . --project-name word-snap-mvp --branch main
```

Cloudflare Pages 当前可以用 Wrangler 手动部署。如果 Dashboard 里完成 GitHub Provider 绑定，推送 `main` 后也可以自动部署。

### 大陆访问稳定性

- 对学生优先发自有域名，不直接发 `word-snap-mvp.pages.dev`。
- 首屏只加载刷词必需资源，PDF/OCR 识别库会在用户上传图片或 PDF 时再加载。
- `_headers` 为词库、样式和脚本设置缓存，降低高频访问时的重复下载。
- 备用静态镜像可以直接部署本仓库根目录；没有 Cloudflare Function 时，AI 识别会降级为本地识别或文字导入，刷词、错词、报告和导入导出仍可使用。
