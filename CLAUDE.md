# 秒懂词 (Word Snap) 项目

## 项目结构
- `docs/` - 网页版唯一源码 (vanilla JS + IndexedDB)
- `word-snap-mvp/` - 由脚本生成的 Cloudflare 部署镜像，不直接编辑
- `word-snap-miniapp/` - 微信小程序版 (wx.setStorage)

## 网页开发流程
- 所有网页代码只修改 `docs/`
- 修改完成后运行 `npm run sync` 自动同步部署镜像
- 提交前运行 `npm test` 和 `npm run check:sync`

## 核心功能
6个Tab：训练、刷题、对战、词库、错词、报告

## 技术栈
- 网页版：纯 JS/CSS/HTML，IndexedDB，Cloudflare Pages
- 小程序版：WXML/WXSS/JS，wx.setStorage，微信开发者工具

## 词库
- 内置分年级词库，并包含从用户 PDF 校对接入的“初中688高频词”独立训练阶段

## 沟通
- 使用中文
- 直接执行，减少确认
