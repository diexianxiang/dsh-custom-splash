/* ============================================================================
 * dsh-custom-splash · 视频启动界面运行时
 * ----------------------------------------------------------------------------
 * 开关 `source: 'video'` 时，Host 往 index 里注入的是这一份（而不是 splash.js）。
 * 它只做一件事：把 lib/assets/video/<videoFile> 铺满窗口播一遍，播完 / 跳过就揭幕。
 *
 * 与 splash.js 的分工：
 *   splash.js    内置六幕动画（source: 'builtin'，插件原来那套）
 *   boot-video.js 用户自己的动画视频（source: 'video'，默认）
 *
 * 三条自我约束：
 *   1) 任何一步失败都必须把页面还回去 —— 黑屏是最糟的失败态
 *   2) 不依赖 splash.css：关键样式全内联，桌面端 / 客户端自举 / 裸页面都能跑
 *   3) 滚动锁沿用 html.dsu-lock（Host 关键 CSS 里定义的同一套）
 * ========================================================================== */
(function () {
  'use strict'

  if (window.__DSH_STARTUP_LOADED__) return
  window.__DSH_STARTUP_LOADED__ = true

  var ROOT_ID = 'dsh-startup-root'
  var ROUTE = '/dsh-startup'

  var DEFAULTS = {
    enabled: true,
    mode: 'session',
    source: 'video',
    videoFile: 'boot.mp4',
    videoFit: 'cover',
    videoMuted: false,
    videoVolume: 0.8,
    allowSkip: true
  }

  /* 配置以 Host 注入的 window.__DSH_STARTUP__ 为准；缺字段用本文件的默认值兜底 */
  function cfg() {
    var raw = (window.__DSH_STARTUP__ && typeof window.__DSH_STARTUP__ === 'object')
      ? window.__DSH_STARTUP__
      : {}
    var out = {}
    for (var k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) out[k] = DEFAULTS[k]
    }
    for (var k2 in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, k2) && raw[k2] !== undefined && raw[k2] !== null) {
        out[k2] = raw[k2]
      }
    }
    var vol = Number(out.videoVolume)
    out.videoVolume = isFinite(vol) ? Math.min(1, Math.max(0, vol)) : DEFAULTS.videoVolume
    out.videoFit = out.videoFit === 'contain' ? 'contain' : 'cover'
    out.videoMuted = out.videoMuted === true || out.videoMuted === 'true' || out.videoMuted === 1
    out.allowSkip = !(out.allowSkip === false || out.allowSkip === 'false' || out.allowSkip === 0)
    if (!/^[A-Za-z0-9._-]+\.(mp4|webm|m4v)$/i.test(String(out.videoFile || ''))) {
      out.videoFile = DEFAULTS.videoFile
    }
    return out
  }

  var C = cfg()

  /** 重播：把运行时重新挂一次（设置页「立即预览」用它）。 */
  function injectSelf() {
    window.__DSH_STARTUP_LOADED__ = false
    var old = document.getElementById(ROOT_ID)
    if (old && old.parentNode) old.parentNode.removeChild(old)
    window.__DSH_STARTUP_SKIP__ = false
    var s = document.createElement('script')
    s.src = ROUTE + '/boot-video.js?t=' + Date.now()
    document.head.appendChild(s)
  }

  /* Host 侧兜底脚本已判定「这次不播」：不建 DOM，但照样暴露 API，方便设置页预览 */
  if (window.__DSH_STARTUP_SKIP__ === true) {
    window.__DSH_STARTUP_API__ = {
      replay: injectSelf,
      skip: function () {},
      finish: function () {},
      config: C
    }
    return
  }

  if (!document.body) return

  var finished = false
  var watchdog = null

  /* ── DOM ─────────────────────────────────────────────────────────────── */
  var root = document.getElementById(ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = ROOT_ID
    document.body.appendChild(root)
  }
  root.className = 'dsu-root dsu-video'
  root.setAttribute('role', 'presentation')
  root.style.position = 'fixed'
  root.style.top = '0'
  root.style.left = '0'
  root.style.right = '0'
  root.style.bottom = '0'
  root.style.zIndex = '2147483000'
  root.style.background = '#000'
  root.style.overflow = 'hidden'
  root.style.opacity = '1'
  root.style.pointerEvents = 'auto'
  root.style.transition = 'opacity 520ms cubic-bezier(0.4, 0, 0.2, 1)'
  root.style.cursor = 'default'

  var video = document.createElement('video')
  video.src = ROUTE + '/media/' + encodeURIComponent(String(C.videoFile))
  video.preload = 'auto'
  video.autoplay = true
  video.loop = false
  video.controls = false
  video.muted = !!C.videoMuted
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.setAttribute('aria-hidden', 'true')
  video.style.position = 'absolute'
  video.style.top = '0'
  video.style.left = '0'
  video.style.width = '100%'
  video.style.height = '100%'
  video.style.objectFit = C.videoFit === 'contain' ? 'contain' : 'cover'
  video.style.background = '#000'
  video.style.opacity = '0'
  video.style.transition = 'opacity 460ms ease'
  video.style.outline = 'none'
  video.style.pointerEvents = 'none'
  try { video.volume = C.videoVolume } catch (e) { /* 某些浏览器禁止设 volume */ }
  root.appendChild(video)

  var skip = null
  if (C.allowSkip) {
    skip = document.createElement('button')
    skip.type = 'button'
    skip.textContent = '跳过 SKIP'
    skip.setAttribute('aria-label', '跳过启动动画')
    skip.style.cssText = [
      'position:absolute', 'right:24px', 'bottom:22px', 'z-index:5',
      'padding:8px 15px', 'border:1px solid rgba(255,255,255,.30)', 'border-radius:999px',
      'background:rgba(0,0,0,.30)', 'color:rgba(255,255,255,.88)',
      'font:500 12px/1.2 -apple-system,"Segoe UI",system-ui,sans-serif',
      'letter-spacing:.10em', 'cursor:pointer', 'opacity:0',
      'transition:opacity 320ms ease,background 200ms ease',
      'backdrop-filter:blur(6px)', '-webkit-backdrop-filter:blur(6px)'
    ].join(';')
    skip.addEventListener('mouseenter', function () { skip.style.background = 'rgba(0,0,0,.56)' })
    skip.addEventListener('mouseleave', function () { skip.style.background = 'rgba(0,0,0,.30)' })
    skip.addEventListener('click', function (e) { e.stopPropagation(); skipNow() })
    root.appendChild(skip)
  }

  /* 带声音自动播放被浏览器拦下时，视频会被降成静音继续放。
     这里给一个「点一下恢复声音」的按钮，避免用户以为视频本来就没声。 */
  var unmute = document.createElement('button')
  unmute.type = 'button'
  unmute.textContent = '开启声音'
  unmute.setAttribute('aria-label', '开启启动动画的声音')
  unmute.style.cssText = [
    'position:absolute', 'left:24px', 'bottom:22px', 'z-index:6',
    'display:none', 'padding:8px 15px', 'border:1px solid rgba(255,255,255,.30)',
    'border-radius:999px', 'background:rgba(0,0,0,.42)', 'color:rgba(255,255,255,.92)',
    'font:500 12px/1.2 -apple-system,"Segoe UI",system-ui,sans-serif',
    'letter-spacing:.10em', 'cursor:pointer', 'opacity:0',
    'transition:opacity 320ms ease,background 200ms ease',
    'backdrop-filter:blur(6px)', '-webkit-backdrop-filter:blur(6px)'
  ].join(';')
  unmute.addEventListener('mouseenter', function () { unmute.style.background = 'rgba(0,0,0,.62)' })
  unmute.addEventListener('mouseleave', function () { unmute.style.background = 'rgba(0,0,0,.42)' })
  unmute.addEventListener('click', function (e) {
    e.stopPropagation()
    e.preventDefault()
    try {
      video.muted = false
      video.volume = C.videoVolume
    } catch (err) { /* noop */ }
    unmute.style.display = 'none'
    var p = null
    try { p = video.play() } catch (err) { p = null }
    if (p && typeof p.catch === 'function') p.catch(function () { /* 还是不允许出声就静音放着 */ })
  })
  root.appendChild(unmute)

  function showUnmute() {
    if (finished) return
    unmute.style.display = 'inline-block'
    setTimeout(function () { unmute.style.opacity = '0.94' }, 200)
  }

  /* 脚本已经接管：摘掉 dsu-boot，Host 那 9 秒兜底就不会再把我们拔掉；
     失败态改由本文件的 watchdog 兜（25 秒还没出画面就直接揭幕）。 */
  if (root.classList) root.classList.remove('dsu-boot')

  document.documentElement.classList.add('dsu-lock')
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'

  /* ── 收尾 ─────────────────────────────────────────────────────────────── */
  function unlock() {
    try {
      document.documentElement.classList.remove('dsu-lock')
      document.documentElement.style.overflow = ''
      if (document.body) document.body.style.overflow = ''
    } catch (e) { /* 解锁本身不许抛 */ }
  }

  function stamp() {
    try {
      if (C.mode === 'session') window.sessionStorage.setItem('dsh-custom-splash:shown', '1')
      if (C.mode === 'daily') {
        window.localStorage.setItem('dsh-custom-splash:day', new Date().toISOString().slice(0, 10))
      }
    } catch (e) { /* 隐私模式下不可写 */ }
  }

  function finish() {
    if (finished) return
    finished = true
    if (watchdog) { clearTimeout(watchdog); watchdog = null }
    try { video.pause() } catch (e) { /* noop */ }
    unlock()
    stamp()
    /* 关键 CSS 里的黑底只服务于黑幕期间，揭幕就撤掉，别把应用本体也刷成黑的 */
    try {
      var critical = document.getElementById('dsh-startup-critical')
      if (critical && critical.parentNode) critical.parentNode.removeChild(critical)
    } catch (e) { /* noop */ }
    try { root.style.pointerEvents = 'none' } catch (e) { /* noop */ }
    root.style.opacity = '0'
    setTimeout(function () {
      try { if (root.parentNode) root.parentNode.removeChild(root) } catch (e) { /* noop */ }
      try { window.dispatchEvent(new CustomEvent('dsh-startup:done')) } catch (e) { /* noop */ }
    }, 620)
  }

  function skipNow() {
    if (finished) return
    finish()
  }

  /* ── 播放 ─────────────────────────────────────────────────────────────── */
  video.addEventListener('playing', function () {
    video.style.opacity = '1'
    if (skip) {
      setTimeout(function () { if (skip) skip.style.opacity = '0.92' }, 1100)
    }
  })

  /* 播完、解码失败、源被拦（401/404）：一律揭幕，绝不停在黑屏 */
  video.addEventListener('ended', finish)
  video.addEventListener('error', finish)
  video.addEventListener('abort', finish)

  function play() {
    var p = null
    try { p = video.play() } catch (e) { p = null }
    if (!p || typeof p.then !== 'function') return
    p.catch(function () {
      /* 带声音的自动播放被拒（Web 侧会这样）：降到静音再试一次；
         静音还不让播就说明这条路走不通，直接揭幕。
         静音能播时亮出「开启声音」按钮，让用户自己解除。 */
      if (C.videoMuted) { finish(); return }
      try { video.muted = true } catch (e) { /* noop */ }
      var q = null
      try { q = video.play() } catch (e) { q = null }
      if (!q || typeof q.then !== 'function') { finish(); return }
      q.then(showUnmute)
      q.catch(finish)
    })
  }

  function start() { play() }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }

  /* 超时兜底：源没解出来 / 一直缓冲 / 路由 401，25 秒后无条件放行 */
  watchdog = setTimeout(function () {
    if (finished) return
    var ok = false
    try { ok = video.readyState >= 2 && video.currentTime > 0 } catch (e) { ok = false }
    if (!ok) finish()
  }, 25000)

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') skipNow()
  })

  var canClickSkip = false
  setTimeout(function () { canClickSkip = true }, 900)
  root.addEventListener('click', function () {
    if (canClickSkip) skipNow()
  })

  /* 对外 API：设置页「立即预览」、冒烟测试都走它 */
  window.__DSH_STARTUP_API__ = {
    replay: injectSelf,
    skip: skipNow,
    finish: finish,
    config: C
  }
  window.__DSH_STARTUP_VIDEO__ = video
})()
