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
