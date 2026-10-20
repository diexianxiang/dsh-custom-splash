# 提交说明（提 PR 时用这一份）

## 1. PR 标题（选一个）

```
Add dsh-custom-splash (ui)
```

## 2. PR 内容（直接粘到 GitHub 描述框）

```markdown
### What

`dsh-custom-splash` — a startup screen plugin that plays a video of your choice when DSH boots,
then fades away. Drop an mp4 at `%USERPROFILE%\.dsh\startup-video\boot.mp4` (or point the
`videoPath` setting anywhere) and that is what shows up on launch. The built-in six-scene
animation from the upstream project is still there and can be switched back in
Settings → 启动动画.

- Repo: https://github.com/6shenhonghong9/dsh-custom-splash
- Release (prebuilt tgz): https://github.com/6shenhonghong9/dsh-custom-splash/releases/tag/v1.0.0
- License: MIT. Based on [6shenhonghong9/dsh-startup-screen](https://github.com/6shenhonghong9/dsh-startup-screen) (MIT), with the video mode, the replaceable
  video path, the first-frame blackout and the range-capable media route added on top.

### Checklist

- [x] `package.json` declares `dsh.bundle` (`./cordis.patch.yml`)
- [x] Real, working code — the host registers six routes and injects a runtime that plays the video
- [x] Not a re-export/aggregator: `lib/index.js`, `lib/boot-video.js`, `lib/splash.js`, `lib/client.js` are all first-party
- [x] Dependencies: none
- [x] Category `ui` — it changes the window chrome on boot, not a colour theme
- [x] Description matches what the code does
- [x] Tests: `npm test` → 254 checks, 0 failures (host / splash / client / desktop-boot)
- [x] Screenshots: `screenshots.json` → `docs/screenshots/video-splash.png`, `docs/screenshots/video-splash-2.png`

### Notes

- The repo has existed since before this PR (screenshots and release tarball are pushed with v1.0.0).
- The plugin does not ship a video file of its own beyond a small demo clip; users swap in their own.
```

## 3. 文件放置

把同目录的 `dsh-custom-splash.yml` 复制成：

```
awesome-dsh-plugin/data/plugins/6shenhonghong9__dsh-custom-splash.yml
```

（一个 PR 只加这一个文件，别手改 README / plugins.json —— 那是 CI 生成的。）

## 4. 提 PR 之前的顺序（重要）

1. `git push` 仓库到 `github.com/6shenhonghong9/dsh-custom-splash`（仓库名必须和 yml 里的 `name` 一致）。
2. 打 tag `v1.0.0`，建 Release，把 `release/dsh-custom-splash-1.0.0.tgz` 传上去当附件。
3. fork `awesome-dsh-plugin/awesome-dsh-plugin`，加那个 yml，提 PR。
   顺序不能倒：CI 会检查「仓库建立时间早于 PR」，刚建的仓库会被打回。
