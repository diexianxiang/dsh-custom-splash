/* ============================================================================
 * dsh-custom-splash — Host 半侧
 * ----------------------------------------------------------------------------
 * 做三件事：
 *   1) 在 index.html 里注入「启动界面」：首屏兜底黑幕 + 关键 CSS + 配置 + 运行时
 *   2) 提供 /dsh-startup/splash.css · splash.js · config 三个路由
 *   3) 把配置持久化到 ~/.dsh/dsh-custom-splash.json（设置页经 /dsh-startup/config 读写）
 *
 * 说明：配置刻意不走 settings 命名空间，而是自带一份 JSON + 自带设置面板
 * （与 dsh-meme 同款做法），这样不受 dsh-settings 版本变更影响。
 * ========================================================================== */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-custom-splash.json')
/* 旧包名（dsh-startup-screen）的配置文件：第一次升级时不丢用户已有设置。 */
const LEGACY_CONFIG_FILE = path.join(DSH_HOME, 'dsh-startup.json')

const NS = 'dsh-custom-splash'
const ROUTE_BASE = '/dsh-startup'

/** 插件版本：读自己的 package.json，避免源码与版本号两处各写一份。
    读不到就退回占位符（设置页会显示它，不会显示 undefined）。 */
const PLUGIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    const v = String(pkg.version || '').trim()
    return v || '0.0.0'
  } catch (err) {
    return '0.0.0'
  }
})()

/** 默认配置：字段与 lib/splash.js 的 DEFAULTS 一一对应。 */
const DEFAULTS = {
  enabled: true,
  mode: 'session',            // always | session | daily
  source: 'video',            // video=自己的动画视频 / builtin=内置六幕序列
  videoFile: 'boot.mp4',      // lib/assets/video/ 下的文件名
  /* 可替换视频的固定位置：把任意 mp4 放到这里（或填别的绝对路径）就换掉了启动动画，
     不用重装插件。文件不存在时自动回落插件自带的 lib/assets/video/<videoFile>。
     跟着 DSH_HOME 走：默认就是 ~/.dsh/startup-video/boot.mp4。 */
  videoPath: path.join(DSH_HOME, 'startup-video', 'boot.mp4'),
  videoFit: 'cover',          // cover=铺满裁切 / contain=完整显示（黑边）
  videoMuted: false,
  videoVolume: 0.8,
  theme: 'light',             // light | dark
  speed: 1,
  requireInteraction: true,
  allowSkip: true,
  sound: true,                // 界面音效（WebAudio 合成，无音频文件）
  soundVolume: 0.5,
  voice: true,                // 女声播报（Web Speech API）
  voiceLang: 'en',            // en | zh | both
  voiceName: '',              // '' = 自动挑（按分数优先神经网络女声）
  voiceRate: 0.88,            // 电影旁白档：比朗读慢，字与字之间才有重量
  voicePitch: 0.85,           // 压低音调，深沉的 AI 女声
  voiceVolume: 0.9,
  voiceCue: true,             // 念台词前的一声轻提示
  sfx: 'audio',               // 音效来源：audio=lib/assets 里的真素材 / synth=现场合成
  voiceSource: 'asset',       // 语音来源：asset=优先用真声素材（拿不到自动回落 TTS）/ tts=全 TTS
  voiceLead: 240,             // 提示音之后留一小段空白再开口
  identity: 'JOYCE MOORE',    // ← 设置页里可改的「身份名称」
  identityId: '0087',
  accessLevel: '3',
  brand1: 'DEEPSEEK',
  brand2: 'SYNTHESIZE INTELLIGENCE',
  brand3a: 'HARNESS',
  brand3b: 'OS',
  orgZh: '深度求索',
  orgEn: 'DEEPSEEK',
  orgSub: 'DEEPSEEK HARNESS',
  welcomeBox: 'DEEPSEEK HARNESS',
  footer: 'POWERED BY DEEPSEEK',
  accent: '#ff7500',
  glitchA: '#ff3b30',
  glitchB: '#2971b8'
}

const TEXT_KEYS = [
  'identity', 'identityId', 'accessLevel',
  'brand1', 'brand2', 'brand3a', 'brand3b',
  'orgZh', 'orgEn', 'orgSub', 'welcomeBox', 'footer', 'voiceName'
]
const COLOR_KEYS = ['accent', 'glitchA', 'glitchB']
const ENUMS = {
  mode: ['always', 'session', 'daily'],
  source: ['video', 'builtin'],
  videoFit: ['cover', 'contain'],
  theme: ['light', 'dark'],
  voiceLang: ['en', 'zh', 'both'],
  sfx: ['audio', 'synth'],
  voiceSource: ['asset', 'tts']
}
const BOOL_KEYS = ['enabled', 'requireInteraction', 'allowSkip', 'sound', 'voice', 'voiceCue', 'videoMuted']
/** 数值字段的合法区间（越界即夹取）。 */
const RANGES = {
  speed: [0.35, 3],
  soundVolume: [0, 1],
  voiceRate: [0.5, 2],
  voiceLead: [0, 1200],
  voicePitch: [0, 2],
  voiceVolume: [0, 1],
  videoVolume: [0, 1]
}
/** 视频文件名：只认 lib/assets/video/ 下的单层文件名，杜绝目录穿越。 */
const VIDEO_FILE_RE = /^[A-Za-z0-9._-]+\.(mp4|webm|m4v)$/

function normalize(input) {
  const out = { ...DEFAULTS }
  const src = input && typeof input === 'object' ? input : {}
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in src) || src[key] === undefined || src[key] === null) continue
    const value = src[key]
    if (BOOL_KEYS.includes(key)) {
      out[key] = value === true || value === 'true' || value === 1 || value === '1'
    } else if (ENUMS[key]) {
      out[key] = ENUMS[key].includes(value) ? value : DEFAULTS[key]
    } else if (key === 'speed' || RANGES[key]) {
      const [lo, hi] = RANGES[key] || RANGES.speed
      const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[key]
    } else if (key === 'videoFile') {
      const s = String(value).trim()
      out[key] = VIDEO_FILE_RE.test(s) ? s : DEFAULTS[key]
    } else if (key === 'videoPath') {
      const s = String(value).trim().slice(0, 1024)
      out[key] = s && path.isAbsolute(s) ? s : ''
    } else if (COLOR_KEYS.includes(key)) {
      const s = String(value).trim()
      out[key] = /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : DEFAULTS[key]
    } else if (TEXT_KEYS.includes(key)) {
      out[key] = String(value).slice(0, 64)
    } else {
      out[key] = value
    }
  }
  if (!String(out.identity).trim()) out.identity = DEFAULTS.identity
  if (!String(out.identityId).trim()) {
    out.identityId = String(out.identity).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  }
  if (!String(out.identityId).trim()) out.identityId = 'OPERATOR'
  return out
}

/** 真实生效的配置文件：新文件优先；升级到 1.0.0 时旧包名的文件仍在用，就继续读它。 */
function configFile() {
  try {
    if (!fs.existsSync(CONFIG_FILE) && fs.existsSync(LEGACY_CONFIG_FILE)) return LEGACY_CONFIG_FILE
  } catch (err) {}
  return CONFIG_FILE
}

function readConfig() {
  const file = configFile()
  try {
    const raw = fs.readFileSync(file, 'utf8')
    return normalize(JSON.parse(raw))
  } catch (err) {
    return { ...DEFAULTS }
  }
}

function writeConfig(next) {
  const cfg = normalize(next)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}

/** 静态文件按 mtime 缓存，改完插件刷新页面即生效。 */
function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        cache = { mtimeMs: st.mtimeMs, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      return ''
    }
  }
}

const readSplashCss = makeReader('lib/splash.css')
const readSplashJs = makeReader('lib/splash.js')
const readBootVideoJs = makeReader('lib/boot-video.js')

/** 内联脚本里绝对不能出现 `</script>`。 */
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '')
}

/** 首屏兜底：在应用挂载前先把窗口盖住，避免闪出界面本体。
 *  只作用于视频模式（根节点带 `.dsu-video`），免得和内置序列自己的 splash.css 抢样式。
 *  三层保险，任何一层单独生效都不会露出主界面：
 *    1) html/body 在黑幕期间是纯黑（连浏览器默认白底那一下也盖掉）
 *    2) 根节点无论有没有 dsu-boot 类都铺满整屏、黑底、顶到最高层
 *    3) 注入的根节点自己还带一份同款内联样式（样式表没解析到时也照样黑） */
const CRITICAL_CSS = [
  'html.dsu-lock,html.dsu-lock body{overflow:hidden!important;background:#000!important}',
  /* 只盖根节点本身：子元素（video / 跳过按钮）都由 boot-video.js 自己写内联样式，
     这里再给一层 width/height:100% 会把按钮撑满整屏。 */
  '#dsh-startup-root.dsu-video{position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;background:#000;margin:0;padding:0;border:0;overflow:hidden}'
].join('')

/** 根节点自带的内联样式：和 CRITICAL_CSS 同款，哪怕 <style> 被 CSP 拦了也黑得住。 */
const ROOT_INLINE_STYLE =
  'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;' +
  'background:#000;margin:0;padding:0;border:0;overflow:hidden'

/** 尽早加锁：这段在 <head> 里同步执行，早于 <body> 解析和第一次绘制。
 *  浏览器在白屏上画第一帧是「默认白底 + 还没跑的样式」——把 html 先锁成黑底，
 *  第一帧就是黑的，不会先闪一下主界面再被黑幕盖住。 */
const EARLY_LOCK_JS = `(function(){try{
var c=window.__DSH_STARTUP__||{};
if(c.enabled!==false)document.documentElement.classList.add('dsu-lock');
}catch(e){}})()`

const BOOTSTRAP_JS = `(function(){try{
var c=window.__DSH_STARTUP__||{};
var root=document.getElementById('dsh-startup-root');
var off=!c.enabled;
if(!off&&c.mode==='session'&&sessionStorage.getItem('dsh-custom-splash:shown')==='1')off=true;
if(!off&&c.mode==='daily'&&localStorage.getItem('dsh-custom-splash:day')===new Date().toISOString().slice(0,10))off=true;
if(off){window.__DSH_STARTUP_SKIP__=true;if(root&&root.parentNode)root.parentNode.removeChild(root);document.documentElement.classList.remove('dsu-lock');try{var cs=document.getElementById('dsh-startup-critical');if(cs&&cs.parentNode)cs.parentNode.removeChild(cs);}catch(e){}}
else{document.documentElement.classList.add('dsu-lock');/* 兜底：连 splash.js 都没跑起来（404/被拦/语法错）时，9 秒后无条件放行，绝不锁黑屏 */setTimeout(function(){try{var r=document.getElementById('dsh-startup-root');if(r&&r.className&&r.className.indexOf('dsu-boot')!==-1){if(r.parentNode)r.parentNode.removeChild(r);document.documentElement.classList.remove('dsu-lock');if(document.body)document.body.style.overflow='';window.__DSH_STARTUP_FAILED__=true;}}catch(e){}},9000);}
}catch(e){} })()`

const name = NS
const inject = ['webServer', 'connection']

/**
 * 取得 HTTP 载体服务。
 *
 * web profile 与桌面端（DeepSeek Harness Desktop）都会挂 `@deepseek-ai/dsh-web-app`，
 * 其中 `webserver` 这一行提供 `webServer`；但 Electron 也可能改成 `file://` + IPC
 * 直接下发前端（`dsh-host-webserver` 的文档注释就写着 "Electron uses file:// plus
 * IPC instead"）。那种情况下没有 webServer，本插件不该把一颗 fiber 炸掉 ——
 * 交给客户端半侧自举（`lib/client.js` 的 selfBoot）。
 */
function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch (err) { /* 取不到就当没有 */ }
  return ctx.webServer
}

function hasRoutes(server) {
  return !!server && typeof server.register === 'function' && typeof server.tapIndex === 'function'
}

function apply(ctx) {
  const disposers = []
  const webServer = resolveWebServer(ctx)

  /** 没有可注册路由的 HTTP 载体：桌面端若走 IPC 下发前端就是这种形态。
      什么都不注册（plugin 仍然 APPLIED，不报错），页面由客户端半侧自举。 */
  if (!hasRoutes(webServer)) {
    try {
      ctx.logger?.warn?.(
        '[' + NS + '] 当前 profile 没有可用的 webServer（桌面端可能用 file:// + IPC 下发前端）；' +
        'Host 半侧跳过路由与首屏注入，改由浏览器半侧自举启动界面。'
      )
    } catch (err) { /* 日志失败不影响加载 */ }
    return
  }

  /** 浏览器信任栅栏：自定义路由必须过一遍，否则可被任意网页读写。 */
  function rejected(req, res) {
    try {
      const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') return false
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch (err) {
      return false
    }
  }

  function registerRoute(route) {
    const inner = route && route.handler
    const wrapped = Object.assign({}, route, {
      handler: async (req, res) => {
        if (rejected(req, res)) return
        return inner(req, res)
      }
    })
    return webServer.register(wrapped)
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function readBody(req, limit = 64 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > limit) {
          req.destroy()
          resolve('')
          return
        }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
  }

  function sendText(res, type, text) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.css',
    handler: (req, res) => sendText(res, 'text/css; charset=utf-8', readSplashCss())
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.js',
    handler: (req, res) => sendText(res, 'application/javascript; charset=utf-8', readSplashJs())
  }))

  /* 视频启动界面运行时（source:'video' 时由 tapIndex 注入这一份） */
  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/boot-video.js',
    handler: (req, res) => sendText(res, 'application/javascript; charset=utf-8', readBootVideoJs())
  }))

  /* 启动动画视频：lib/assets/video/<name>，或设置里指定的绝对路径。
     必须支持 HTTP Range —— <video> 靠它 seek / 边下边播，只回整包会让部分
     浏览器直接放弃播放。文件只读、只允许单层白名单文件名，杜绝目录穿越。
     不缓存（no-store）：换掉视频文件后刷新即生效，不会被浏览器吃旧帧。 */
  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE_BASE + '/media',
    handler: (req, res) => {
      const name = path.basename(decodeURIComponent((req.url || '').split('?')[0]))
      if (!VIDEO_FILE_RE.test(name) || name.includes('..')) {
        res.writeHead(404); res.end(); return
      }
      const cfg = readConfig()
      let file = path.join(PACKAGE_ROOT, 'lib', 'assets', 'video', name)
      const custom = String(cfg.videoPath || '').trim()
      if (custom) {
        /* 绝对路径可指到单个文件，也可指到一个目录（目录里按请求的文件名取）。
           指到文件时只认它的文件名 / 配置里的 videoFile，别的名字仍走 404。 */
        try {
          const st = fs.statSync(custom)
          let target = null
          if (st.isDirectory()) target = path.join(custom, name)
          else if (name === path.basename(custom) || name === cfg.videoFile) target = custom
          if (target && fs.statSync(target).isFile()) file = target
        } catch (err) { /* 自定义路径失效 → 回落插件自带素材 */ }
      }
      let size
      try {
        size = fs.statSync(file).size
      } catch (err) {
        res.writeHead(404); res.end(); return
      }
      const ext = path.extname(file).toLowerCase()
      const type = ext === '.webm' ? 'video/webm'
        : (ext === '.mp4' || ext === '.m4v') ? 'video/mp4'
          : 'application/octet-stream'
      const head = (req.method || 'GET').toUpperCase() === 'HEAD'
      const common = {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store'
      }
      const range = String(req.headers.range || '').trim()
      const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null
      if (range && !m) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + size }); res.end(); return
      }
      if (m) {
        const open = m[1] === ''
        const start = open ? Math.max(0, size - Number(m[2])) : Number(m[1])
        const end = (open || m[2] === '') ? size - 1 : Math.min(Number(m[2]), size - 1)
        if (!Number.isFinite(start) || start < 0 || start >= size || start > end) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + size }); res.end(); return
        }
        res.writeHead(206, Object.assign({}, common, {
          'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
          'Content-Length': String(end - start + 1)
        }))
        if (head) { res.end(); return }
        const stream = fs.createReadStream(file, { start, end })
        stream.on('error', () => { try { res.destroy() } catch (err) { /* noop */ } })
        stream.pipe(res)
        return
      }
      res.writeHead(200, Object.assign({}, common, { 'Content-Length': String(size) }))
      if (head) { res.end(); return }
      const stream = fs.createReadStream(file)
      stream.on('error', () => { try { res.destroy() } catch (err) { /* noop */ } })
      stream.pipe(res)
    }
  }))

  /* 音频素材：从用户提供的音轨里抠出来的音效（选项/确认音）。
     只读、白名单、不含子路径 —— 杜绝目录穿越。素材缺失时浏览器会自动回落到合成音。 */
  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE_BASE + '/asset',
    handler: (req, res) => {
      const name = path.basename(decodeURIComponent((req.url || '').split('?')[0]))
      if (!/^[a-z0-9._-]+\.mp3$/i.test(name) || name.includes('..')) {
        res.writeHead(404); res.end(); return
      }
      const file = path.join(PACKAGE_ROOT, 'lib', 'assets', name)
      let bytes
      try { bytes = fs.readFileSync(file) } catch (err) {
        res.writeHead(404); res.end(); return
      }
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(bytes.length)
      })
      res.end(bytes)
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/config',
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      if (method === 'GET') {
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: readConfig(), defaults: DEFAULTS, file: configFile() })
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const text = await readBody(req)
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      try {
        if (payload && payload.action === 'reset') {
          const cfgNow = writeConfig(DEFAULTS)
          sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
          return
        }
        const current = readConfig()
        const patch = payload && typeof payload.patch === 'object' && payload.patch ? payload.patch : payload
        const cfgNow = writeConfig({ ...current, ...patch })
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  disposers.push(webServer.tapIndex((html) => {
    if (!html) return html
    /* 已经注入过（splash 或 video 任一运行时）就别重复插一份 */
    if (html.includes(ROUTE_BASE + '/splash.js') || html.includes(ROUTE_BASE + '/boot-video.js')) return html
    const cfg = readConfig()
    const useVideo = cfg.source === 'video'
    const critical = '<style id="dsh-startup-critical">' + CRITICAL_CSS + '</style>'
    const runtime = useVideo ? '/boot-video.js' : '/splash.js'
    /* 关键 CSS、配置载荷、提前加锁全部塞 <head>：同步执行，早于 <body> 与首帧，
       这样第一帧就是黑的（顺序：黑底样式 → 配置 → 加锁 → 提前下载运行时）。 */
    const head =
      critical +
      '<script>window.__DSH_STARTUP_BOOT__="index";window.__DSH_STARTUP_VERSION__=' + safeJson(PLUGIN_VERSION) + ';window.__DSH_STARTUP__=' + safeJson(cfg) + ';' + EARLY_LOCK_JS + '</script>' +
      (useVideo ? '' : '<link rel="stylesheet" href="' + ROUTE_BASE + '/splash.css">') +
      '<script defer src="' + ROUTE_BASE + runtime + '"></script>'
    const rootDiv = useVideo
      ? '<div id="dsh-startup-root" class="dsu-root dsu-video dsu-boot" style="' + ROOT_INLINE_STYLE + '"></div>'
      : '<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>'
    const body =
      rootDiv +
      '<script>' + BOOTSTRAP_JS + '</script>'

    let out = html
    if (out.includes('</head>')) out = out.replace('</head>', head + '</head>')
    else out = head + out
    /* 黑幕必须是 body 的第一个孩子：<body> 常带 class/style，所以按标签匹配而不是死找 '<body>' */
    if (/<body[^>]*>/i.test(out)) out = out.replace(/<body[^>]*>/i, (tag) => tag + body)
    else if (out.includes('</body>')) out = out.replace('</body>', body + '</body>')
    else out = out + body
    return out
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* noop */ }
    }
  })
}

/* 导出形状对齐 DSH 内部插件（如 dsh-host-open-in-app）：
   只给具名 name / inject / apply。
   两点刻意不做：
   1) 不导出 default —— cordis-plugin-loader 的 unwrapExports 是
      `exports.default ?? exports`，一旦有 default 就只认 default，
      两边都写反而多一个"改一处忘一处"的坑；
   2) 不导出 Config —— Cordis 约定 Config 是 schemastery schema，
      我这份只是普通默认值对象，当 schema 用会炸。本插件也不吃 profile 配置。 */
export { apply, inject, name }
