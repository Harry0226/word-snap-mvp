# AGENTS.md — 代老师带你秒懂词 (Word Snap)

本文件面向人类开发者（DX）与 AI 智能体（AX），说明仓库边界、架构约定与验证指令。

## 1. 仓库约定
- 唯一网页源码位于 `docs/`，部署镜像位于 `word-snap-mvp/`（禁止手工修改 `word-snap-mvp/`，统一通过 `npm run sync` 同步）。
- 顶级 JS 文件直接位于 `docs/*.js` 并携带 `?v=` 查询参数，以便匹配 `docs/_headers` 中的 `/*.js` 长期不可变缓存规则。
- 内置词库与音频按需懒加载（`word-data/builtin-manifest.js` + `word-data/stages/*.js` + `audio/en-gb-v1/*.mp3`），禁止将全量词库塞回首屏 `<script>`。

## 2. 六大功能域
1. **训练 (`train`)**：每日 100 词任务（到期复习优先 + 新词补足）、自由训练（听音/看英/看中/双选）、2 秒秒选与 3.5 秒慢词判定、FSRS 复习调度、七日检测、轮后错词拼写判断与今日结算。
2. **对战 (`battle`)**：双人同屏抢答，错答仅锁定单方，绝不写入个人学习记录。
3. **单词书 (`decks`)**：3372 条内置释义检索、难词收藏、个人记忆备注，以及折叠区内的文本解析导入 / JSON 导入导出。
4. **错词 (`wrong`)**：错词 / 慢词独立筛选与一键专项训练。
5. **报告 (`report`)**：今日统计、待复习数量及各阶段进度可视化。
6. **刷题 (`quiz`)**：五选一刷题、累计统计、错题本复盘。

## 3. UI 与文案规范
- 保持 Linear / Apple Notes 风格的极简界面：以布局、留白与颜色层级传达语义，不添加标语、说明性段落或装饰性次要标签。
- 保留主品牌名称：**代老师带你秒懂词**。
- 所有互动状态均通过 `data-*` 状态属性同步至 DOM，并在 `window.WordSnapInspector.getSnapshot()` 暴露只读状态。

## 4. 必跑检查
改动 `docs/` 后必须依次执行：
1. `npm run sync`
2. `npm test`
3. `npm run check:sync`
4. 如改动 UI 或交互逻辑，运行 `node tools/browser_smoke_check.js` 检查桌面与移动端真实渲染与交互。
