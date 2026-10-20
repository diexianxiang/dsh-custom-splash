/* ============================================================================
 * Host 半侧冒烟测试 —— 不装进 DSH，直接用假 ctx 把 apply() 跑一遍。
 * 覆盖：路由注册 / 信任栅栏 / 配置读写落盘 / index.html 注入结果。
 * 用法：node smoke-host.mjs
 * ========================================================================== */
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 找一份真实的 DSH dist/index.html 来做注入测试；找不到就用等价的最小样本。
 *  跨平台：Windows 的 npx 缓存在 %LOCALAPPDATA%，POSIX 在 ~/.npm 或 ~/.cache。 */
function findRealIndex() {
  const candidates = []
  if (process.env.DSH_FRONTEND_INDEX) candidates.push(process.env.DSH_FRONTEND_INDEX)
  const caches = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'),
    path.join(os.homedir(), '.npm', '_npx'),
    path.join(os.homedir(), '.cache', 'npm', '_npx'),
  ].filter(Boolean)
  for (const npx of caches) {
    try {
      for (const d of fs.readdirSync(npx)) {
        candidates.push(path.join(npx, d, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html'))
      }
    } catch { /* 这个缓存目录不存在，换下一个 */ }
  }
  for (const c of candidates) if (fs.existsSync(c)) return { path: c, html: fs.readFileSync(c, 'utf8') }
  /* 样本严格照 DSH dist/index.html 的形状写（属性都带引号），
     这样没装 DSH 的机器上跑到的断言和真机完全一致 */
  return { path: '(内置样本，形状等同 DSH dist/index.html)', html: [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <title>DeepSeek Harness</title>',
    '    <script type="module" crossorigin src="./assets/index-XXX.js"></script>',
    '    <link rel="stylesheet" crossorigin href="./assets/vendor-XXX.css">',
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    '  </body>',
    '</html>',
    '',
  ].join('\n') }
}
const REAL_INDEX = findRealIndex()
const SMOKE_HOME = path.join(os.tmpdir(), 'dsh-startup-smoke-' + Date.now())
fs.mkdirSync(SMOKE_HOME, { recursive: true })
process.env.DSH_HOME = SMOKE_HOME

const ROUTES = new Map()
const TAPS = []
let effects = 0
let rejectNext = undefined

const ctx = {
  webServer: {
    register(route) {
      if (ROUTES.has(route.kind + ' ' + route.path)) throw new Error('duplicate route ' + route.path)
      ROUTES.set(route.kind + ' ' + route.path, route)
      return () => ROUTES.delete(route.kind + ' ' + route.path)
    },
    tapIndex(fn) { TAPS.push(fn); return () => TAPS.splice(TAPS.indexOf(fn), 1) },
  },
  get(name) {
    if (name !== 'connection') return undefined
    return {
      // 官方 dsh-host-open-in-app 同款栅栏：返回 undefined = 放行
      requestRejection() { return rejectNext },
    }
  },
  effect(fn) { effects++; const d = fn(); return () => { if (typeof d === 'function') d() } },
}

class FakeReq extends EventEmitter {
  constructor(method, body, url, headers) {
    super()
    this.method = method
    this.headers = headers || { host: '127.0.0.1:3080' }
    this.url = url || '/'
    process.nextTick(() => {
      if (body !== undefined) this.emit('data', Buffer.from(body))
      this.emit('end')
    })
  }
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(code, headers) { this.statusCode = code; this.headers = headers || {}; return this },
    end(buf) { this.body = buf === undefined ? '' : Buffer.from(buf).toString('utf8') },
  }
}

async function call(kindPath, method = 'GET', body, url, headers) {
  const route = ROUTES.get(kindPath)
  if (!route) throw new Error('route missing: ' + kindPath)
  const res = fakeRes()
  await route.handler(new FakeReq(method, body, url, headers), res)
  return res
}

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  → ' + extra : '')) }
}

console.log('\n[1] 模块导出形状（对齐 cordis-plugin-loader 的 unwrapExports）')
const mod = await import(pathToFileURL(path.join(PLUGIN_ROOT, 'lib', 'index.js')).href)
check('有具名 name', typeof mod.name === 'string', mod.name)
check('name 与 cordis.patch.yml 的 id 一致', mod.name === 'dsh-custom-splash', mod.name)
check('有具名 inject', Array.isArray(mod.inject), JSON.stringify(mod.inject))
check('inject 含 webServer + connection', mod.inject.includes('webServer') && mod.inject.includes('connection'))
check('有具名 apply', typeof mod.apply === 'function')
check('没有 default 导出（避免 unwrapExports 只认 default）', mod.default === undefined, String(mod.default))
check('没有 Config 导出（普通对象不是 schemastery schema）', mod.Config === undefined, String(mod.Config))

console.log('\n[2] apply(ctx)：路由与注入')
mod.apply(ctx)
check('注册了 6 条路由', ROUTES.size === 6, [...ROUTES.keys()].join(' | '))
check('注册了 1 个 tapIndex', TAPS.length === 1)
check('用了 ctx.effect 管理生命周期', effects === 1, String(effects))

console.log('\n[3] 静态路由')
let r = await call('exact /dsh-startup/splash.css')
check('splash.css 200 + 正确 MIME', r.statusCode === 200 && /text\/css/.test(r.headers['Content-Type']), r.headers['Content-Type'])
check('splash.css 非空', r.body.length > 10000, r.body.length + ' bytes')
r = await call('exact /dsh-startup/splash.js')
check('splash.js 200 + 正确 MIME', r.statusCode === 200 && /javascript/.test(r.headers['Content-Type']), r.headers['Content-Type'])
check('splash.js 非空', r.body.length > 20000, r.body.length + ' bytes')

console.log('\n[3b] 音频素材路由')
r = await call('prefix /dsh-startup/asset')
check('请求 /asset 无文件名 -> 404', r.statusCode === 404, String(r.statusCode))
r = await call('prefix /dsh-startup/asset', 'GET', undefined, '/dsh-startup/asset/sfx-tick.mp3')
check('sfx-tick.mp3 -> 200 + audio/mpeg', r.statusCode === 200 && r.headers['Content-Type'] === 'audio/mpeg', r.headers['Content-Type'])
check('sfx-tick.mp3 有内容', r.body.length > 500, r.body.length + ' bytes')
r = await call('prefix /dsh-startup/asset', 'GET', undefined, '/dsh-startup/asset/../../package.json')
check('目录穿越被拒 -> 404', r.statusCode === 404, String(r.statusCode))
r = await call('prefix /dsh-startup/asset', 'GET', undefined, '/dsh-startup/asset/nope.mp3')
check('不存在的素材 -> 404', r.statusCode === 404, String(r.statusCode))
for (const f of ['line-1', 'line-2', 'line-3', 'line-4', 'line-5']) {
  const rr = await call('prefix /dsh-startup/asset', 'GET', undefined, '/dsh-startup/asset/' + f + '.mp3')
  check('真声素材 ' + f + '.mp3 -> 200', rr.statusCode === 200 && rr.body.length > 5000, rr.statusCode + ' ' + rr.body.length)
}

console.log('\n[3c] 视频素材路由（HEAD，不拉流）')
r = await call('exact /dsh-startup/boot-video.js')
check('boot-video.js 200 + javascript', r.statusCode === 200 && /javascript/.test(r.headers['Content-Type']), r.headers['Content-Type'])
check('boot-video.js 非空', r.body.length > 1000, r.body.length + ' bytes')
const videoBytes = fs.statSync(path.join(PLUGIN_ROOT, 'lib', 'assets', 'video', 'boot.mp4')).size
r = await call('prefix /dsh-startup/media', 'HEAD', undefined, '/dsh-startup/media/boot.mp4')
check('boot.mp4 HEAD -> 200', r.statusCode === 200, String(r.statusCode))
check('boot.mp4 -> video/mp4 + 完整 Content-Length', r.headers['Content-Type'] === 'video/mp4' && r.headers['Content-Length'] === String(videoBytes), r.headers['Content-Type'] + ' ' + r.headers['Content-Length'])
check('声明 Accept-Ranges: bytes', r.headers['Accept-Ranges'] === 'bytes', r.headers['Accept-Ranges'])
check('媒体路由不缓存（换视频后刷新即生效）', r.headers['Cache-Control'] === 'no-store', r.headers['Cache-Control'])
r = await call('prefix /dsh-startup/media', 'HEAD', undefined, '/dsh-startup/media/boot.mp4', { range: 'bytes=0-1023' })
check('Range HEAD -> 206 + Content-Range', r.statusCode === 206 && r.headers['Content-Range'] === 'bytes 0-1023/' + videoBytes, String(r.statusCode) + ' ' + r.headers['Content-Range'])
check('Range HEAD 的 Content-Length = 1024', r.headers['Content-Length'] === '1024', r.headers['Content-Length'])
r = await call('prefix /dsh-startup/media', 'GET', undefined, '/dsh-startup/media/../../package.json')
check('媒体目录穿越被拒 -> 404', r.statusCode === 404, String(r.statusCode))
r = await call('prefix /dsh-startup/media', 'HEAD', undefined, '/dsh-startup/media/nope.mp4')
check('不存在的视频 -> 404', r.statusCode === 404, String(r.statusCode))
/* 自定义路径失效时必须回落到插件自带素材，绝不能 404 把启动界面变成纯黑 */
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { videoPath: 'C:\\nonexistent-dsh\\nope.mp4' } }))
r = await call('prefix /dsh-startup/media', 'HEAD', undefined, '/dsh-startup/media/boot.mp4')
check('videoPath 指向不存在的文件 -> 回落自带素材 200', r.statusCode === 200 && r.headers['Content-Length'] === String(videoBytes), String(r.statusCode) + ' ' + r.headers['Content-Length'])
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ action: 'reset' }))

console.log('\n[4] 配置读写落盘')
r = await call('exact /dsh-startup/config')
let cfg = JSON.parse(r.body)
check('GET config ok', cfg.ok === true)
check('默认身份名称 = JOYCE MOORE', cfg.config.identity === 'JOYCE MOORE', cfg.config.identity)
check('默认身份编号 = 0087', cfg.config.identityId === '0087', cfg.config.identityId)
check('返回了配置文件路径', typeof cfg.file === 'string' && cfg.file.startsWith(SMOKE_HOME), cfg.file)
check('返回了插件版本号（设置面板顶部要显示它）', typeof cfg.version === 'string' && /^\d+\.\d+\.\d+/.test(cfg.version), cfg.version)
check('默认视频路径 = <DSH_HOME>/startup-video/boot.mp4（可直接替换的那个固定位置）',
  String(cfg.config.videoPath || '').replace(/\\/g, '/') ===
    path.join(SMOKE_HOME, 'startup-video', 'boot.mp4').replace(/\\/g, '/'), String(cfg.config.videoPath))

// 升级兼容：新文件名不存在时回退读旧包名留下的 dsh-startup.json
try { fs.unlinkSync(path.join(SMOKE_HOME, 'dsh-custom-splash.json')) } catch (err) {}
fs.writeFileSync(path.join(SMOKE_HOME, 'dsh-startup.json'), JSON.stringify({ identity: '旧配置' }))
r = await call('exact /dsh-startup/config')
check('升级兼容：读旧 dsh-startup.json', JSON.parse(r.body).config.identity === '旧配置', JSON.parse(r.body).config.identity)
check('升级兼容：file 仍报旧文件', String(JSON.parse(r.body).file).endsWith('dsh-startup.json'), JSON.parse(r.body).file)
fs.unlinkSync(path.join(SMOKE_HOME, 'dsh-startup.json'))

r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { videoPath: 'C:\\Users\\me\\clip.mp4' } }))
check('videoPath 允许绝对路径', JSON.parse(r.body).config.videoPath === 'C:\\Users\\me\\clip.mp4', JSON.parse(r.body).config.videoPath)
r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { videoPath: 'relative\\clip.mp4' } }))
check('videoPath 拒绝相对路径（回落空 = 用自带素材）', JSON.parse(r.body).config.videoPath === '', String(JSON.parse(r.body).config.videoPath))
r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { videoPath: 12345 } }))
check('videoPath 非字符串不炸', typeof JSON.parse(r.body).config.videoPath === 'string', String(JSON.parse(r.body).config.videoPath))
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ action: 'reset' }))

r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { identity: '琉璃', speed: 99, enabled: 'true' } }))
cfg = JSON.parse(r.body)
check('POST config ok', cfg.ok === true)
check('身份名称写入成功（中文）', cfg.config.identity === '琉璃', cfg.config.identity)
check('speed 被夹到上限 3', cfg.config.speed === 3, String(cfg.config.speed))
check('enabled 字符串 "true" 被转成 boolean true', cfg.config.enabled === true, String(cfg.config.enabled))
check('配置已落盘', fs.existsSync(path.join(SMOKE_HOME, 'dsh-custom-splash.json')))

r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { identityId: '' } }))
check('身份编号留空 + 纯中文名 → 兜底 OPERATOR', JSON.parse(r.body).config.identityId === 'OPERATOR', JSON.parse(r.body).config.identityId)
r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { identity: 'Ada Lovelace', identityId: '' } }))
check('身份编号留空 + 英文名 → 自动派生 ADALOVELACE', JSON.parse(r.body).config.identityId === 'ADALOVELACE', JSON.parse(r.body).config.identityId)
r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { speed: 0.01, theme: 'neon', accent: 'javascript:alert(1)' } }))
cfg = JSON.parse(r.body)
check('speed 低于下限被夹到 0.35', cfg.config.speed === 0.35, String(cfg.config.speed))
check('非法 theme 回落到 light', cfg.config.theme === 'light', cfg.config.theme)
check('非法颜色回落到默认橙', cfg.config.accent === '#ff7500', cfg.config.accent)

r = await call('exact /dsh-startup/config', 'POST', JSON.stringify({ action: 'reset' }))
check('reset 恢复默认', JSON.parse(r.body).config.identity === 'JOYCE MOORE')

r = await call('exact /dsh-startup/config', 'POST', '{ not json')
check('非法 JSON 返回 400', r.statusCode === 400, String(r.statusCode))
r = await call('exact /dsh-startup/config', 'DELETE')
check('不支持的方法返回 405', r.statusCode === 405, String(r.statusCode))

console.log('\n[5] 信任栅栏（DNS 重绑定 / 未认证请求）')
rejectNext = 403
r = await call('exact /dsh-startup/config')
check('connection 拒绝时返回 403 且不吐配置', r.statusCode === 403 && r.body === '', r.statusCode + ' body=' + JSON.stringify(r.body.slice(0, 40)))
rejectNext = undefined

/** 从注入结果里精确抠出内联 JSON 载荷（window.__DSH_STARTUP__= ... ;BOOTSTRAP） */
function inlinePayload(html) {
  const a = html.indexOf('window.__DSH_STARTUP__=')
  const b = html.indexOf(';(function(){try{', a)
  return a === -1 || b === -1 ? '' : html.slice(a + 'window.__DSH_STARTUP__='.length, b)
}

console.log('\n[6] index.html 注入（源: ' + REAL_INDEX.path + '）')
const before = REAL_INDEX.html
const after = TAPS[0](before)
check('默认走视频模式', inlinePayload(after).includes('"source":"video"'), inlinePayload(after).slice(0, 80))
check('视频模式不加载 splash.css', !after.includes('/dsh-startup/splash.css'), '')
check('视频模式注入 boot-video.js', after.includes('<script defer src="/dsh-startup/boot-video.js"></script>'), '')
check('注入了首屏兜底 <style>', after.includes('id="dsh-startup-critical"') && after.includes('dsu-video'))
check('挂载点带 dsu-video 标记 + 内联定位样式', /<div id="dsh-startup-root" class="dsu-root dsu-video dsu-boot" style="[^"]*position:fixed[^"]*">/.test(after), '')
check('挂载点自带内联黑底（样式表失效也遮得住主界面）', /id="dsh-startup-root"[^>]*background:#000/.test(after), '')
check('挂载点 z-index 顶到最高层', /id="dsh-startup-root"[^>]*z-index:2147483647/.test(after), '')
check('关键 CSS 里 html.dsu-lock 是纯黑', /html\.dsu-lock,html\.dsu-lock body\{[^}]*background:#000!important/.test(after), '')
check('提前加锁脚本进了 <head>（首帧就是黑的）', /<head>[\s\S]*classList\.add\('dsu-lock'\)[\s\S]*<\/head>/.test(after), '')
check('注入了 window.__DSH_STARTUP__ 配置', /^\{"enabled":/.test(inlinePayload(after)), inlinePayload(after).slice(0, 60))
check('内联载荷是合法 JSON', (() => { try { JSON.parse(inlinePayload(after)); return true } catch { return false } })())
/* 设置面板顶部的版本号：Host 从自己的 package.json 读出来，再交给浏览器半侧 */
const pkgVersion = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'package.json'), 'utf8')).version
check('注入了 window.__DSH_STARTUP_VERSION__', after.includes('window.__DSH_STARTUP_VERSION__='), '')
check('注入的版本号 = package.json 的 version', after.includes('window.__DSH_STARTUP_VERSION__=' + JSON.stringify(pkgVersion)), pkgVersion)
check('注入了 defer 运行时脚本', after.includes('<script defer src="/dsh-startup/boot-video.js"></script>'))
check('配置落在 </head> 之前', after.indexOf('dsh-startup-critical') < after.indexOf('</head>'))
check('挂载点紧跟 <body>', /<body>\s*<div id="dsh-startup-root"/.test(after))
/* 真实页面里 <body> 常带 class/style，注入必须按标签匹配，否则黑幕会掉到 body 之外 */
const attrAfter = TAPS[0](before.replace('<body>', '<body class="theme-dark" data-ready="1">'))
check('带属性的 <body class=...> 也把黑幕塞成第一个孩子', /<body class="theme-dark" data-ready="1">\s*<div id="dsh-startup-root"/.test(attrAfter), '')
check('幂等：二次调用不重复注入', TAPS[0](after) === after)
check('原 <div id="root"></div> 仍在（应用照常挂载）', after.includes('<div id="root"></div>'))
check('内联载荷里没有裸的 < （防 </script> 提前闭合）', !inlinePayload(after).includes('<'))

console.log('\n[6b] 切回内置序列（source: builtin）')
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { source: 'builtin' } }))
const builtinHtml = TAPS[0](before)
check('内置模式注入 splash.css', builtinHtml.includes('<link rel="stylesheet" href="/dsh-startup/splash.css">'))
check('内置模式注入 splash.js', builtinHtml.includes('<script defer src="/dsh-startup/splash.js"></script>'))
check('内置模式不注入 boot-video.js', !builtinHtml.includes('/dsh-startup/boot-video.js'))
check('内置模式挂载点不带 dsu-video（不抢 splash.css 的样式）', !builtinHtml.includes('dsu-root dsu-video'), '')
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { source: 'video' } }))

console.log('\n[7] XSS 边界：身份名称里的尖括号不会逃出内联脚本')
await call('exact /dsh-startup/config', 'POST', JSON.stringify({ patch: { identity: '</script><img src=x onerror=alert(1)>' } }))
const payload = inlinePayload(TAPS[0](before))
check('尖括号被转义成 \\u003c', payload.includes('\\u003c'), payload.slice(0, 120))
check('载荷里没有 </script>', !payload.includes('</script>'))
check('转义后仍是合法 JSON 且值可还原', (() => {
  try { return JSON.parse(payload).identity === '</script><img src=x onerror=alert(1)>' } catch { return false }
})())

fs.rmSync(SMOKE_HOME, { recursive: true, force: true })
console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
