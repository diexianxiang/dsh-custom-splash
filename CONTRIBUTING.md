# 参与开发

## 本地跑起来

```bash
# 装到当前 DSH 的 profile（link 方式，改代码不用重装）
dsh plugin --profile web add link:<本仓库绝对路径>

# 跑测试
npm test
```

Host 半侧（`lib/index.js`）改动要**重启 DSH** 才生效；浏览器半侧（`lib/boot-video.js`、
`lib/client.js`、`lib/splash.js`、`lib/splash.css`）刷新页面即可。

## 代码结构

| 文件 | 干什么 |
|---|---|
| `lib/index.js` | Host：配置读写、`tapIndex` 注入、六条路由（splash.css / splash.js / boot-video.js / media / asset / config） |
| `lib/boot-video.js` | 视频模式的浏览器运行时（零依赖，样式内联） |
| `lib/splash.js` | 内置六幕序列运行时（来自上游） |
| `lib/splash.css` | 内置六幕序列样式（来自上游） |
| `lib/client.js` | 设置页「启动动画」面板 |
| `lib/assets/video/boot.mp4` | 自带示例视频（1080p60，15.5 MB） |

## 测试

四套冒烟测试，全部不依赖浏览器，直接 node 跑：

```bash
node test/smoke-host.mjs          # Host：路由、配置、注入
node test/smoke-splash.mjs        # 内置序列运行时
node test/smoke-client.mjs        # 设置面板渲染
node test/smoke-desktop-boot.mjs  # 桌面端自举路径
```

改路由或注入逻辑时，同步更新对应断言——测试就是这套代码的说明书。

## 提交

- 一个提交做一件事，提交信息用中文或英文都行，首行说清改了什么；
- 涉及用户可见行为时更新 `README.md` / `README.zh.md` 与 `CHANGELOG.md`；
- 不要提交 `node_modules/`、`release/`、`*.tgz`（`.gitignore` 已挡）。
- Windows 上改文件请用编辑器或 node 写，**不要**用 PowerShell 的 `Set-Content`（会把 UTF-8 写成乱码）。
