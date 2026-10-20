# Changelog

## 1.0.0 — 2026-10-20

首个自行发布的版本（基于 `dsh-startup-screen` 1.1.1 / MIT 修改）。

新增：

- **视频启动模式**：启动时全屏播放本地视频，播完淡出进入主界面；
  `lib/boot-video.js` 运行时零依赖、样式全内联。
- **可替换视频路径**：默认读 `~/.dsh/startup-video/boot.mp4`，读不到回落自带素材；
  设置页可填任意绝对路径（文件或目录），相对路径被丢弃。
- **首屏防闪**：`<head>` 同步加 `dsu-lock` + `<body>` 首个子节点黑底覆盖层；
  此前会先闪一下主界面。
- **媒体路由**：`/dsh-startup/media/<文件名>`，支持 HTTP Range 206、HEAD、`no-store`，
  白名单文件名 + 目录穿越防护。
- **播放降级链**：带声自动播放被拒 → 静音重试 + 「开启声音」按钮 → 仍失败直接揭幕；
  另有 25 秒看门狗与错误兜底，绝不卡住启动。
- **设置项**：动画来源 / 视频绝对路径 / 视频文件名 / 画面适配 / 静音播放 / 视频音量；
  视频模式下自动隐藏仅内置序列生效的字段。

变更：

- 包名 `dsh-startup-screen` → `dsh-custom-splash`，bundle id 同步改名。
- 配置文件 `~/.dsh/dsh-startup.json` → `~/.dsh/dsh-custom-splash.json`，
  旧文件仍会被读取（升级不丢设置）。
- 前端存储键 `dsh-startup-screen:shown|:day` → `dsh-custom-splash:shown|:day`。
  （升级后第一次启动会重播一次，属预期。）
- 路由基址保持 `/dsh-startup`，设置分组 id 保持 `startup-screen`。

保留（来自上游）：

- 内置六幕交互序列、真声台词、界面音效、配色与文案，及其全部设置项。
