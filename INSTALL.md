# 安装说明

## 一、直接安装（推荐）

```bash
dsh plugin --profile web add ./dsh-custom-splash-1.0.0.tgz
```

Windows 上双击 `安装.cmd` 也一样。

装完 **重启 dsh web**（关掉启动器窗口再重新双击）。刷新页面就能看到启动界面
（默认播 `~/.dsh/startup-video/boot.mp4`，没有就用插件自带的视频）。

桌面端（DeepSeek Harness Desktop）的 profile 不能用命令行管理，见 [DESKTOP.md](DESKTOP.md)。

### 为什么必须用 `dsh plugin add`

DSH 靠 **`dsh.profile.bundles`** 这个层堆栈决定加载哪些插件，而
`dsh plugin add` 是 `pnpm add` 的包装，装完之后 DSH 会自动把
「声明了 `dsh.bundle` 的依赖」并入层堆栈 —— 插件自带的 `cordis.patch.yml`
就是在那时候作为一层被应用的。

**手工把目录拷进 `node_modules` 不会被识别。**

### 装完请检查一次

如果你之前是手工在 profile 的 `cordis.patch.yml` 里加了这类条目：

```yaml
- insert:
    - id: dsh-custom-splash
      name: dsh-custom-splash
```

**必须删掉。** 否则插件被注册两次，`apply` 跑两遍，
`ctx.webServer.register()` 对同一路径重复注册会报错。

`安装.cmd` 会自动检测并提示。

---

## 二、手工安装（不用 pnpm）

1. 把 `plugin/` 目录解压到任意位置
2. 让 profile 能解析到它 —— 在 `~/.dsh/profiles/web/node_modules/` 下建目录联接：

   ```cmd
   mklink /J "%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-custom-splash" "解压路径\plugin"
   ```

3. 在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加：

   ```yaml
   - insert:
       - id: dsh-custom-splash
         name: dsh-custom-splash
   ```

4. 重启 dsh web

---

## 三、验证装好了

重启后，**没带 token** 访问插件路由：

- `/dsh-startup/config` 返回 **401** → 路由已注册（401 是插件自己的信任栅栏，正常）
- 返回 **404** → 没装成功，或没重启

打开页面后：先是一帧黑底，然后是启动视频（或内置六幕序列），播完淡出进主界面。
设置页里会多出 **「启动动画」** 一项。

---

## 四、卸载

```bash
dsh plugin --profile web remove dsh-custom-splash
```

走「二、手工安装」的，删掉目录联接和那两行 patch 条目即可。

---

## 五、配置项

设置页 → **启动动画**（order 26）：

| 分组 | 可调 |
|---|---|
| 播放 | 启用、动画来源（我的动画视频 / 插件内置六幕动画）、视频绝对路径、视频文件名、画面适配、静音播放、视频音量、显示模式、允许跳过 |
| 身份资料 | 身份名称（默认 `JOYCE MOORE`）、编号、权限等级（仅内置序列） |
| 交互 | 是否要求点击按钮确认（仅内置序列） |
| 语音与音效 | 语音开关、**语音来源（真声素材 / 系统 TTS）**、音色、语速、音调、音量、播报前提示音、开口前留白；界面音效开关与音量（仅内置序列） |
| 视觉 | 主题、速度、强调色、故障色（仅内置序列） |
| 文案 | 中文主字 / 英文副标题 / 日志行 / 按钮文字（仅内置序列） |

配置落盘在 `$DSH_HOME/dsh-custom-splash.json`（默认 `~/.dsh/dsh-custom-splash.json`）；
从旧版 `dsh-startup-screen` 升级上来时，旧的 `dsh-startup.json` 仍会被读取。

---

## 六、环境要求

| 项 | 要求 |
|---|---|
| Node | **>= 20** |
| 平台 | DSH **web** profile 或 **Desktop** 桌面端（`dsh.client.platform = "web"`） |
| 运行时依赖 | **零**（`dependencies` / `peerDependencies` 都是空的） |
| 视频 | 浏览器能解的 H.264 + yuv420p + AAC，mp4/webm/m4v |
| 语音（内置序列） | 浏览器 Web Speech API；真声素材已内置，取不到会自动回落 TTS |

---

## 七、包内容

```
lib/index.js          Host 半：路由 + index.html 注入
lib/boot-video.js     视频模式运行时
lib/splash.js         内置六幕动画运行时
lib/splash.css        内置六幕动画样式
lib/client.js         设置面板（浏览器半）
lib/assets/video/     自带示例视频
lib/assets/           真声台词 x5 + 终幕欢迎语 + 界面音效 x2
cordis.patch.yml      bundle 层声明
preview/index.html    离线预览页（不进 npm 包）
test/                 四套冒烟测试（254 项断言，不进 npm 包）
README.md             英文说明
README.zh.md          中文详细说明
CHANGELOG.md          变更日志
docs/                 截图与发布文档
screenshots.json      市场截图声明
```

跑测试：`npm test`
