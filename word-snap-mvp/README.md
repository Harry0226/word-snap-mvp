# 秒懂词 v3

面向初一到高三学生的分层刷词 MVP。

## 功能

- 初一、初二、初三的“暑期必背词汇”均整合本年级课内外词汇和初中 688 高频词；高一、高二整合本年级课内外词汇，高三汇总高一至高三全部词汇；初中 688 高频词同时保持独立入口
- 新增“高中3500刷词专栏”，接入 List 1 至 List 48 的原表词汇；“高一课改词库”恢复为独立入口
- 每天自动生成 300 词“今日任务”，优先安排到期复习，再用新词补足；自由训练中答对的词也会同步计入，中断后可继续完成
- 答对按 1/3/7/14/30 天安排复习，答错 4 小时后重现，并统计首次七日检测的记忆率
- 默认使用“听发音选中文”：全部内置词汇采用同一套预生成美式女声 MP3，不依赖手机或电脑的系统语音
- 音频播放器兼容微信、Android、iOS、平板和桌面浏览器；自动播放被拦截时，会保留题目并提示学生点击播放
- 支持看英文选中文、看中文选英文、听发音选中文和智能双选
- 支持 100 词、200 词、300 词、400 词、全部词训练
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
