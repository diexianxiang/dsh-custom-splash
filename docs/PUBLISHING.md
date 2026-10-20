# 发布与上架

面向维护者：把新版本推出去、并提交到 DSH 插件市场。

## 0. 一次性准备

- 仓库：`https://github.com/6shenhonghong9/dsh-custom-splash`（假设沿用这个账号）
- `package.json` 里已有 `dsh.bundle.patch`、`repository`、`homepage`、`bugs`、`engines`

## 1. 发一个新版本

```bash
# 1) 改版本号（package.json 的 version），补 CHANGELOG.md
# 2) 跑测试
npm test

# 3) 打包（产物在 release/）
npm run pack:release
# 等价于：npm pack --pack-destination release
# 产物：release/dsh-custom-splash-<version>.tgz
```

`npm pack` 的 `files` 白名单在 `package.json` 里：`lib`、`cordis.patch.yml`、文档、
`screenshots.json`、`docs/`、`LICENSE`。`test/` 与 `preview/` **不进包**。

打包前自检：

```bash
tar -tzf release/dsh-custom-splash-<version>.tgz | grep -v node_modules
# 必须包含 lib/assets/video/boot.mp4（约 15.5 MB）
```

## 2. 推到 GitHub

```bash
git add -A
git commit -m "v<version>: ..."
git tag v<version>
git remote add origin https://github.com/6shenhonghong9/dsh-custom-splash.git
git push -u origin main --tags
```

## 3. 建 Release（可选但推荐）

在市场里，**GitHub Release 附带的 tgz 会被优先展示**（比 `npm:` 更靠前）。
在 Releases 页面新建 `v<version>`，附上 `release/dsh-custom-splash-<version>.tgz`，
正文直接贴 `CHANGELOG.md` 的对应段落。

## 4. 上架 DSH 插件市场（awesome-dsh-plugin）

市场条目来自 [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
的 `data/plugins/*.yml`；本站的 `dshmarket` 只装这份精选列表里的东西。

流程：

1. Fork `awesome-dsh-plugin/awesome-dsh-plugin`；
2. 新建 `data/plugins/6shenhonghong9__dsh-custom-splash.yml`，内容用
   `release/awesome-entry/dsh-custom-splash.yml`（本仓库已生成）；
3. 提交 PR，标题用 `release/awesome-entry/PR.md` 里的标题，正文照抄那份正文；
4. **CI 会检查**：每条 PR 最多 3 条、仓库 `package.json` 必须有 `dsh.bundle`、
   仓库年龄至少 1 天（所以先推仓库、隔天再提 PR 最稳）、描述必须与代码一致；
5. 合并后当天夜里构建，站点与市场次日可见。

分类用 `ui`（`theme` 会被塞进市场的「主题」页，启动动画不属于主题）。

## 5. 换截图

截图声明在仓库根的 `screenshots.json`（1–8 张，相对路径，不能跳出插件目录）。
想换图：替换 `docs/screenshots/*.png`（建议 1280×720）并同步 `screenshots.json`，
推到自己仓库即可，不用再提 PR。

## 6. 本地验证「装包是否是发布形态」

```bash
# 在某个 profile 里用 tgz 装一遍（而不是 link 目录）
dsh plugin --profile web remove dsh-custom-splash
dsh plugin --profile web add ./release/dsh-custom-splash-<version>.tgz
```

桌面端：插件管理器里 `file:<tgz 绝对路径>` 安装，然后从托盘完全退出再打开。

## 不上架也能装

```bash
dsh plugin --profile web add github:6shenhonghong9/dsh-custom-splash
dsh plugin --profile web add ./release/dsh-custom-splash-<version>.tgz
```
