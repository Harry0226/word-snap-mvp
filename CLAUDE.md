# 代老师带你秒懂词 (Word Snap)

## 核心原则
- **源目录**：所有网页代码只修改 `docs/`；`word-snap-mvp/` 为脚本同步生成的部署镜像，不直接编辑
- **零构建架构**：纯静态 HTML/CSS/JS + IndexedDB，直接部署于 GitHub Pages / Cloudflare Pages
- **极简设计**：参照 Linear 官网与 Apple Notes，布局自解释，不堆砌标语、提示文字或次要标签；保留主品牌文案「代老师带你秒懂词」
- **沟通**：使用中文，直接执行，减少确认

## 模块结构 (`docs/`)
| 文件 | 职责 | 全局导出 |
| :--- | :--- | :--- |
| `index.html` / `styles.css` | 6视图壳层与设计系统 | — |
| `utils.js` | 转义、洗牌、格式化等纯工具 | `WordSnapUtils` |
| `storage.js` | IndexedDB 打开与读写封装 | `WordSnapStorage` |
| `daily-learning.js` / `daily-streaks.js` | FSRS 调度、每日 100 词任务、打卡火花 | `WordSnapDailyLearning` / `WordSnapDailyStreaks` |
| `rotation-queue.js` / `choice-distractors.js` | 轮换队列与干扰项语义消歧 | `WordSnapRotation` / `WordSnapChoiceUtils` |
| `asset-loader.js` / `pronunciation-audio.js` | 懒加载重试与英式 MP3 播放器 | `WordSnapAssetLoader` / `WordSnapPronunciationAudio` |
| `decks.js` | 词库解析、导入导出、错词/慢词与阶段报告 | `WordSnapDecks` |
| `battle.js` | 双人对战模式（隔离个人记录） | `WordSnapBattle` |
| `quiz.js` | 句意刷题与刷题错题本 | `WordSnapQuiz` |
| `learning-flow.js` | 轮后拼写巩固、单词书查询、今日结算 | 全局函数 + `WORDBOOK` |
| `app.js` | 路由、词汇训练主引擎与状态协调 | `WordSnapInspector` |

## 智能体可观测状态 (AX)
- `body[data-active-view]`：`train | battle | decks | wrong | report | quiz`
- `#view-train[data-session-state]`：`idle | playing | answered | completed`
- `#view-battle[data-battle-state]`：`idle | playing | completed`
- `#view-quiz[data-quiz-state]`：`idle | playing | answered | completed`
- `#dailyTaskPanel[data-task-state]`：`pending | completed | all-complete`
- `#learningFlow[data-flow-phase]`：`spelling | fill | listening | done`
- `window.WordSnapInspector.getSnapshot()`：返回当前视图与各引擎状态的只读快照

## 开发与验证流程
```bash
npm run sync                  # 将 docs/ 同步到 word-snap-mvp/
npm test                      # 运行全部 37 项静态与单元测试
npm run check:sync            # 校验 docs/ 与 word-snap-mvp/ 一致性
node tools/browser_smoke_check.js  # 本地无头浏览器端到端冒烟验证
```
