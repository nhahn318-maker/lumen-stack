const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const app = document.getElementById('app')
const ui = {
  menu: document.getElementById('menu'),
  gameover: document.getElementById('gameover'),
  hud: document.getElementById('hud'),
  mission: document.getElementById('mission'),
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  finalScore: document.getElementById('final-score'),
  resultMeta: document.getElementById('result-meta'),
  missionLabel: document.getElementById('mission-label'),
  missionCount: document.getElementById('mission-count'),
  missionFill: document.getElementById('mission-fill'),
  sound: document.getElementById('sound'),
  pause: document.getElementById('pause'),
  toast: document.getElementById('toast'),
  tapHint: document.getElementById('tap-hint')
}

const palette = [
  ['#72f1c8', '#32b99b'],
  ['#ffd275', '#ef8e68'],
  ['#e99cff', '#9b67df'],
  ['#83c5ff', '#4d78d8'],
  ['#ff91a4', '#d95482']
]

let width = 0
let height = 0
let ratio = 1
let state = 'menu'
let blocks = []
let active = null
let score = 0
let best = 0
let combo = 0
let focus = 0
let lives = 2
let missionTarget = Math.min(24, 10 + Math.floor(best / 150) * 2)
let missionCompleted = false
let playerMuted = localStorage.getItem('lumen-stack-muted') === '1'
let platformAudioEnabled = true
let pausedBySystem = false
let audioContext = null
let lastTime = performance.now()
let toastTimer = 0
let particles = []

function resize() {
  const previousWidth = width
  const previousHeight = height
  const rect = app.getBoundingClientRect()
  ratio = Math.min(window.devicePixelRatio || 1, 2)
  width = rect.width
  height = rect.height
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  if (previousWidth > 0 && previousHeight > 0) {
    const scaleX = width / previousWidth
    const scaleY = height / previousHeight
    blocks.forEach(block => {
      block.x *= scaleX
      block.width *= scaleX
      block.height *= scaleY
    })
    if (active) {
      active.x *= scaleX
      active.y *= scaleY
      active.width *= scaleX
      active.height *= scaleY
      active.speed *= scaleX
      active.velocityY *= scaleY
    }
  }
}

function roundRect(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function tone(frequency, duration, type = 'sine', volume = 0.08, delay = 0) {
  if (playerMuted || !platformAudioEnabled) return
  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)()
  if (audioContext.state === 'suspended') audioContext.resume()
  const start = audioContext.currentTime + delay
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.18, start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  oscillator.connect(gain).connect(audioContext.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

function playSound(name) {
  if (name === 'place') tone(185, 0.08, 'triangle', 0.05)
  if (name === 'perfect') {
    tone(440, 0.16, 'sine', 0.07)
    tone(660, 0.18, 'sine', 0.06, 0.06)
  }
  if (name === 'miss') tone(125, 0.24, 'sawtooth', 0.045)
  if (name === 'over') {
    tone(220, 0.22, 'triangle', 0.05)
    tone(146, 0.35, 'triangle', 0.04, 0.16)
  }
}

function showToast(text) {
  ui.toast.textContent = text
  ui.toast.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 950)
}

function updateHud() {
  ui.score.textContent = score
  ui.best.textContent = Math.max(best, score)
  const floors = Math.max(0, blocks.length - 1)
  ui.missionLabel.textContent = `Reach ${missionTarget} floors`
  ui.missionCount.textContent = `${Math.min(floors, missionTarget)} / ${missionTarget}`
  ui.missionFill.style.width = `${Math.min(100, (floors / missionTarget) * 100)}%`
  ui.sound.textContent = playerMuted ? '×' : '♪'
}

function hasSdk() {
  return typeof window.ytgame !== 'undefined' && window.ytgame && window.ytgame.game
}

function inPlayables() {
  return hasSdk() && Boolean(window.ytgame.IN_PLAYABLES_ENV)
}

function reportSdkWarning(error) {
  console.warn('YouTube Playables SDK operation failed:', error)
  if (inPlayables() && window.ytgame.health) window.ytgame.health.logWarning()
}

async function loadProgress() {
  if (inPlayables()) {
    try {
      const raw = await window.ytgame.game.loadData()
      if (raw) {
        const saved = JSON.parse(raw)
        best = Number.isSafeInteger(saved.best) && saved.best >= 0 ? saved.best : 0
      }
      return
    } catch (error) {
      reportSdkWarning(error)
    }
  }
  best = Number(localStorage.getItem('lumen-stack-best') || 0)
}

async function saveProgress() {
  const data = JSON.stringify({ version: 1, best })
  if (inPlayables()) {
    try {
      await window.ytgame.game.saveData(data)
      return
    } catch (error) {
      reportSdkWarning(error)
    }
  }
  localStorage.setItem('lumen-stack-best', String(best))
}

async function sendBestScore() {
  if (!inPlayables() || !window.ytgame.engagement) return
  try {
    await window.ytgame.engagement.sendScore({ value: best })
  } catch (error) {
    reportSdkWarning(error)
  }
}

function pauseFromSystem() {
  if (state === 'playing') {
    pausedBySystem = true
    state = 'paused'
    saveProgress()
  }
}

function resumeFromSystem() {
  if (pausedBySystem && state === 'paused') {
    pausedBySystem = false
    state = 'playing'
    lastTime = performance.now()
  }
}

function configurePlatform() {
  if (!inPlayables()) return
  platformAudioEnabled = window.ytgame.system.isAudioEnabled()
  window.ytgame.system.onAudioEnabledChange(isEnabled => {
    platformAudioEnabled = isEnabled
  })
  window.ytgame.system.onPause(pauseFromSystem)
  window.ytgame.system.onResume(resumeFromSystem)
  ui.sound.hidden = true
  ui.pause.hidden = true
}

function geometry() {
  return {
    blockHeight: Math.max(30, height * 0.055),
    baseY: height * 0.84,
    spawnY: height * 0.18,
    maxVisible: 8
  }
}

function targetY(index) {
  const g = geometry()
  const topIndex = active ? blocks.length : Math.max(0, blocks.length - 1)
  const camera = Math.max(0, topIndex - g.maxVisible) * g.blockHeight
  return g.baseY - index * g.blockHeight + camera
}

function spawnBlock() {
  const g = geometry()
  const top = blocks[blocks.length - 1]
  const isFocus = focus >= 3
  if (isFocus) focus = 0
  const blockWidth = Math.min(width * 0.72, top.width * (isFocus ? 1.22 : 1))
  active = {
    x: 12,
    y: g.spawnY,
    width: blockWidth,
    height: g.blockHeight,
    direction: 1,
    speed: Math.min(width * 1.08, width * (0.42 + blocks.length * 0.018)) * (isFocus ? 0.72 : 1),
    falling: false,
    velocityY: 0,
    focus: isFocus,
    color: palette[(blocks.length - 1) % palette.length]
  }
  if (isFocus) showToast('FIREFLY FOCUS · wider + slower')
  updateHud()
}

function resetGame() {
  score = 0
  combo = 0
  focus = 0
  lives = 2
  missionCompleted = false
  particles = []
  const g = geometry()
  const baseWidth = width * 0.58
  blocks = [{ x: (width - baseWidth) / 2, width: baseWidth, height: g.blockHeight, color: palette[0] }]
  state = 'playing'
  ui.menu.classList.add('hidden')
  ui.gameover.classList.add('hidden')
  ui.hud.hidden = false
  ui.mission.hidden = false
  ui.tapHint.hidden = false
  ui.pause.textContent = 'Ⅱ'
  spawnBlock()
  updateHud()
}

function addParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const speed = 30 + Math.random() * 90
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30, life: 1, color })
  }
}

function resolveLanding() {
  const top = blocks[blocks.length - 1]
  const left = Math.max(active.x, top.x)
  const right = Math.min(active.x + active.width, top.x + top.width)
  const overlap = right - left

  if (overlap <= 2) {
    lives -= 1
    combo = 0
    focus = Math.max(0, focus - 1)
    playSound('miss')
    showToast(lives ? 'One spark left' : 'The light slipped away')
    if (lives <= 0) endGame()
    else setTimeout(spawnBlock, 360)
    active = null
    return
  }

  const perfectDistance = Math.abs((active.x + active.width / 2) - (top.x + top.width / 2))
  const perfect = perfectDistance <= Math.max(5, top.width * 0.045)
  const placed = {
    x: perfect ? top.x : left,
    width: perfect ? top.width : overlap,
    height: active.height,
    color: active.color
  }
  blocks.push(placed)

  if (perfect) {
    combo += 1
    focus = Math.min(3, focus + 1)
    score += 15 + combo * 5
    addParticles(placed.x + placed.width / 2, targetY(blocks.length - 1), '#fff3ba', 18)
    playSound('perfect')
    showToast(combo > 1 ? `PERFECT ×${combo}` : 'PERFECT')
  } else {
    combo = 0
    score += 10
    addParticles(placed.x + placed.width / 2, targetY(blocks.length - 1), placed.color[0], 7)
    playSound('place')
  }

  const floors = blocks.length - 1
  if (!missionCompleted && floors >= missionTarget) {
    missionCompleted = true
    score += 100
    showToast('MISSION COMPLETE · +100')
    tone(523, 0.22, 'sine', 0.06)
    tone(784, 0.3, 'sine', 0.05, 0.12)
  }
  active = null
  updateHud()
  setTimeout(spawnBlock, 220)
}

function place() {
  if (state !== 'playing' || !active || active.falling) return
  active.falling = true
  active.velocityY = height * 0.42
}

function endGame() {
  state = 'gameover'
  playSound('over')
  best = Math.max(best, score)
  saveProgress()
  sendBestScore()
  ui.finalScore.textContent = score
  ui.resultMeta.textContent = `${Math.max(0, blocks.length - 1)} floors · Best ${best}`
  ui.gameover.classList.remove('hidden')
  ui.hud.hidden = true
  ui.mission.hidden = true
  ui.tapHint.hidden = true
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused'
    ui.pause.textContent = '▶'
    showToast('PAUSED')
  } else if (state === 'paused') {
    pausedBySystem = false
    state = 'playing'
    ui.pause.textContent = 'Ⅱ'
    showToast('BACK TO GROWING')
  }
}

function update(delta) {
  particles.forEach(p => {
    p.x += p.vx * delta
    p.y += p.vy * delta
    p.vy += 80 * delta
    p.life -= delta * 1.25
  })
  particles = particles.filter(p => p.life > 0)
  if (state !== 'playing' || !active) return

  if (!active.falling) {
    active.x += active.speed * active.direction * delta
    if (active.x + active.width >= width - 10) {
      active.x = width - 10 - active.width
      active.direction = -1
    } else if (active.x <= 10) {
      active.x = 10
      active.direction = 1
    }
  } else {
    active.velocityY += height * 1.8 * delta
    active.y += active.velocityY * delta
    if (active.y >= targetY(blocks.length)) resolveLanding()
  }
}

function drawBlock(block, y, index, isActive = false) {
  const gradient = ctx.createLinearGradient(block.x, y, block.x, y + block.height)
  gradient.addColorStop(0, block.color[0])
  gradient.addColorStop(1, block.color[1])
  ctx.save()
  ctx.shadowColor = isActive && block.focus ? '#fff3ba' : 'rgba(8,7,47,.28)'
  ctx.shadowBlur = isActive && block.focus ? 22 : 12
  ctx.shadowOffsetY = 7
  roundRect(block.x, y, block.width, block.height, block.height * 0.32)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = 'rgba(255,255,255,.22)'
  roundRect(block.x + 7, y + 5, Math.max(0, block.width - 14), Math.max(3, block.height * .13), block.height)
  ctx.fill()
  if (index > 0) {
    ctx.fillStyle = 'rgba(20,19,76,.32)'
    ctx.beginPath()
    ctx.arc(block.x + block.width * .22, y + block.height * .6, 2.2, 0, Math.PI * 2)
    ctx.arc(block.x + block.width * .74, y + block.height * .52, 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function draw() {
  ctx.clearRect(0, 0, width, height)
  if (state === 'menu') return

  blocks.forEach((block, index) => drawBlock(block, targetY(index), index))
  if (active) drawBlock(active, active.y, blocks.length, true)

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, 2.5 + p.life * 2, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.globalAlpha = 1

  if (state === 'playing' || state === 'paused') {
    const meterX = 18
    const meterY = height - 60
    ctx.fillStyle = 'rgba(13,14,58,.56)'
    roundRect(meterX, meterY, 112, 34, 17)
    ctx.fill()
    ctx.fillStyle = '#d8d7fa'
    ctx.font = '800 9px system-ui'
    ctx.fillText('FIREFLY FOCUS', meterX + 13, meterY + 13)
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < focus ? '#fff3a8' : 'rgba(255,255,255,.18)'
      ctx.beginPath()
      ctx.arc(meterX + 70 + i * 13, meterY + 23, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#fff'
    ctx.font = '900 13px system-ui'
    ctx.fillText(`✦ ${lives}`, width - 48, height - 37)
  }
}

function frame(time) {
  const delta = Math.min(0.035, (time - lastTime) / 1000)
  lastTime = time
  update(delta)
  draw()
  requestAnimationFrame(frame)
}

document.getElementById('start').addEventListener('click', resetGame)
document.getElementById('restart').addEventListener('click', resetGame)
ui.pause.addEventListener('click', event => { event.stopPropagation(); togglePause() })
ui.sound.addEventListener('click', event => {
  event.stopPropagation()
  playerMuted = !playerMuted
  localStorage.setItem('lumen-stack-muted', playerMuted ? '1' : '0')
  updateHud()
  if (!playerMuted) tone(440, 0.12)
})
canvas.addEventListener('pointerdown', place)
window.addEventListener('keydown', event => {
  if (event.code === 'Space') {
    event.preventDefault()
    place()
  }
  if (event.code === 'KeyP') togglePause()
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseFromSystem()
  else resumeFromSystem()
})
window.addEventListener('resize', resize)

async function boot() {
  resize()
  configurePlatform()
  await loadProgress()
  missionTarget = Math.min(24, 10 + Math.floor(best / 150) * 2)
  updateHud()

  const background = new Image()
  background.src = './assets/twilight-garden-bg.webp'
  try {
    await background.decode()
  } catch (error) {
    console.warn('Background preload failed; CSS fallback remains available.', error)
  }

  requestAnimationFrame(() => {
    draw()
    if (hasSdk()) window.ytgame.game.firstFrameReady()
    requestAnimationFrame(time => {
      if (hasSdk()) window.ytgame.game.gameReady()
      lastTime = time
      requestAnimationFrame(frame)
    })
  })
}

boot()
