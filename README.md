# dsh-custom-splash

A startup-screen plugin for [DeepSeek Harness](https://github.com/deepseek-ai) (DSH):
play **your own video** full-screen while DSH boots, then fade into the app.

中文详细说明：[README.zh.md](README.zh.md)

![video splash](docs/screenshots/video-splash.png)

---

## Features

- **Video mode (default)** — a local MP4 covering the window, auto-fading into the app when it ends.
- **Swap the video without reinstalling** — drop any MP4 at
  `%USERPROFILE%\.dsh\startup-video\boot.mp4` (or `~/.dsh/startup-video/boot.mp4`),
  or point the setting at any absolute path (file or directory).
- **No first-frame flash** — the lock class is added synchronously in `<head>` and the
  black overlay is the first child of `<body>`, so the app never paints before the video.
- **Streams with HTTP Range** — `/dsh-startup/media/<file>` supports `206`, `HEAD` and
  seeking, and is served with `Cache-Control: no-store`.
- **Never hangs the boot** — autoplay rejection falls back to muted + an "unmute" button;
  decode errors, a 25 s watchdog and script failures all release the page immediately.
- **Skippable** — bottom-right skip button, `Esc`, or click (after 0.9 s).
- **Per-session by default** — a refresh in the same tab does not replay it;
  `always` / `daily` are also available.

> **Note**: The built-in six-act interactive sequence from the upstream project is currently disabled in this v1.0.0 fork due to a DOM mounting compatibility issue. It will be restored in a future update.

---

## Install

```bash
dsh plugin --profile web add ./dsh-custom-splash-1.0.0.tgz
```

On Windows, unzip the release and double-click `安装.cmd`.

For **DeepSeek Harness Desktop**, install the `.tgz` through its plugin manager
(the desktop profile cannot be managed from the CLI), then fully quit from the tray
and relaunch — closing the window is not enough.

Requirements: DSH web profile or Desktop, Node `>= 20`, no runtime dependencies.

Uninstall:

```bash
dsh plugin --profile web remove dsh-custom-splash
```

---

## Use your own video

Fastest path — overwrite one file:

```
%USERPROFILE%\.dsh\startup-video\boot.mp4
```

If that file is missing the plugin falls back to its own `lib/assets/video/boot.mp4`,
so deleting it never leaves you with a black screen.

Prefer another location? **Settings → Startup screen → Video absolute path** accepts a
file or a directory (relative paths are rejected). Leave it empty to use the bundled clip.

Encode for the browser (H.264 + yuv420p + AAC, `faststart`):

```bash
ffmpeg -i source.mov -vf scale=1920:1080:flags=lanczos \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart boot.mp4
```

---

## Settings

**DSH Settings → "Startup screen"** (labels are in Chinese).

Playback: enabled · source (`video` / `builtin`) · video absolute path · video file name ·
fit (`cover` / `contain`) · muted · volume · mode (`session` / `always` / `daily`) · allow skip.

Builtin sequence only: theme · speed · require confirmation · identity name/id/clearance ·
voice (on/off, source, voice, rate, pitch, volume, cue sound, intro delay) · UI sounds ·
accent and glitch colors · all copy fields.

The builtin-only fields are hidden automatically in video mode.

---

## FAQ

- **Nothing shows up** — check that the "Startup screen" section exists in Settings
  (otherwise the bundle is not mounted), that "Enabled" is on, and that mode is not
  `session` with the tab already visited. On Desktop, quit from the tray.
- **Video does not play** — verify H.264/yuv420p/AAC, or enable "Muted" (muted autoplay is
  exempt from browser autoplay policies). Failures release the page instead of hanging it.
- **No sound** — browsers require a user gesture before audio; a muted fallback with an
  "unmute" button is provided.
- **401 from `/dsh-startup/*`** — expected: those routes only trust loopback requests
  carrying the host's trust marker.

---

## How it works

```
Host (lib/index.js)
  tapIndex → <head>: critical CSS + config + EARLY_LOCK_JS
           → <body>: #dsh-startup-root overlay + BOOTSTRAP_JS (mode checks, 9 s fallback)
  routes (/dsh-startup): splash.css · splash.js · boot-video.js · media/<file> · asset/<file>.mp3 · config
Browser
  lib/boot-video.js  overlay + <video> + skip/unmute + watchdog
  lib/client.js      settings panel (self-boots the overlay if the host did not inject it)
```

---

## Development

```bash
npm test               # four smoke suites (254 assertions)
npm run pack:release   # npm pack into release/
```

Repo layout:

```
lib/index.js       host half: config, injection, six routes
lib/boot-video.js  video runtime (zero deps, all styles inline)
lib/splash.js      builtin six-act runtime
lib/splash.css     builtin six-act styles
lib/client.js      settings panel
lib/assets/        audio + video assets
test/              smoke suites
preview/           offline preview page (not published)
docs/              screenshots and publishing notes
```

---

## License & credits

MIT. Based on [`6shenhonghong9/dsh-startup-screen`]
(MIT) — the builtin six-act sequence, its styles, audio assets and copy come from there.
This fork adds the video mode, replaceable video path, first-frame flash fix and the
related settings.


