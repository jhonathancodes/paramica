/* =====================================================
   JARDIM DE ESTRELAS — Para Micaela, de Jhonathan 💙
   ===================================================== */
 
// ---- CONFIG ----
const GAME_DURATION = 90;
const SPAWN_INTERVAL_MS = 900;
const MAX_STARS_ON_SCREEN = 14;
const CONSTELLATION_TOTAL = 24;
 
const STAR_TYPES = [
  { type: 'normal',  icon: '⭐', points: 1, speedRange: [60, 110], weight: 40, label: '+1' },
  { type: 'gold',    icon: '🌟', points: 3, speedRange: [80, 130], weight: 25, label: '+3' },
  { type: 'pink',    icon: '✨', points: 2, speedRange: [70, 120], weight: 20, label: '+2' },
  { type: 'cyan',    icon: '💫', points: 2, speedRange: [55, 100], weight: 10, label: '+2' },
  { type: 'special', icon: '🌠', points: 5, speedRange: [90, 140], weight: 5,  label: '+5 ✨' },
];
 
const MESSAGES_BY_SCORE = [
  { min: 0,  msg: "Você é especial do jeito que é, Micaela. Cada momento ao seu lado parece mágico. 🌙" },
  { min: 20, msg: "Você tem a luz de mil estrelas, Micaela! Jhonathan fica muito feliz só de te ver sorrir. ✨" },
  { min: 40, msg: "Sabia que você faz o dia dele mais bonito só existindo? Ele se importa muito com você. 💜" },
  { min: 65, msg: "Uau! Você é incrível, Micaela! Assim como essas estrelas, você ilumina tudo ao redor. 🌟" },
  { min: 90, msg: "Lendária! O Jhonathan sabia que você ia arrasar. Você é única e ele quer que saiba disso. 💙✨" },
];
 
const COMBOS = [
  '', '', '',
  '💫 Combo!', '🌟 Incrível!', '✨ Fantástica!', '💜 Mágica!', '🌠 Lendária!'
];
 
// ---- STATE ----
let score = 0;
let timeLeft = GAME_DURATION;
let gameRunning = false;
let spawnTimer = null;
let countdownTimer = null;
let constellationLit = 0;
let power = 0;
let streak = 0;
 
// Lista de estrelas ativas: { el, y, speed, type, collected }
let activeStarsList = [];
let rafId = null;
let lastTimestamp = null;
 
// ---- DOM ----
const screenIntro  = document.getElementById('screen-intro');
const screenGame   = document.getElementById('screen-game');
const screenEnd    = document.getElementById('screen-end');
const gameArea     = document.getElementById('game-area');
const hudScore     = document.getElementById('hud-score');
const hudTime      = document.getElementById('hud-time');
const hudCombo     = document.getElementById('hud-combo');
const constDots    = document.getElementById('const-dots');
const powerBar     = document.getElementById('power-bar');
const btnMagic     = document.getElementById('btn-magic');
const btnStart     = document.getElementById('btn-start');
const btnReplay    = document.getElementById('btn-replay');
const floatsDiv    = document.getElementById('floats');
const endMsg       = document.getElementById('end-msg');
const endScoreVal  = document.getElementById('end-score-val');
const endConst     = document.getElementById('end-constellation');
const bgCanvas     = document.getElementById('bg-canvas');
 
// ---- BACKGROUND STARFIELD ----
const ctx = bgCanvas.getContext('2d');
let bgStars = [];
 
function resizeCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
 
function initBgStars() {
  bgStars = [];
  const n = Math.floor((window.innerWidth * window.innerHeight) / 4000);
  for (let i = 0; i < n; i++) {
    bgStars.push({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random(),
      da: (Math.random() * 0.008 + 0.002) * (Math.random() < 0.5 ? 1 : -1),
    });
  }
}
 
function drawBg() {
  ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  const grad = ctx.createLinearGradient(0, 0, 0, bgCanvas.height);
  grad.addColorStop(0, '#020611');
  grad.addColorStop(0.5, '#06101e');
  grad.addColorStop(1, '#0d0a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
 
  for (const [cx2, cy2, cr, col] of [
    [bgCanvas.width*0.2, bgCanvas.height*0.3, 200, 'rgba(90,50,180,0.07)'],
    [bgCanvas.width*0.8, bgCanvas.height*0.6, 180, 'rgba(180,50,120,0.06)'],
    [bgCanvas.width*0.5, bgCanvas.height*0.8, 220, 'rgba(40,100,200,0.05)'],
  ]) {
    const rg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, cr);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  }
 
  for (const s of bgStars) {
    s.a += s.da;
    if (s.a > 1 || s.a < 0.1) s.da *= -1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fill();
  }
 
  requestAnimationFrame(drawBg);
}
 
window.addEventListener('resize', () => { resizeCanvas(); initBgStars(); });
resizeCanvas();
initBgStars();
drawBg();
 
// ---- CONSTELLATION DOTS ----
function buildConstellationDots() {
  constDots.innerHTML = '';
  for (let i = 0; i < CONSTELLATION_TOTAL; i++) {
    const d = document.createElement('div');
    d.className = 'const-dot';
    if (i < constellationLit) d.classList.add('lit');
    constDots.appendChild(d);
  }
}
 
function lightDot() {
  if (constellationLit >= CONSTELLATION_TOTAL) return;
  constellationLit++;
  const dots = constDots.querySelectorAll('.const-dot');
  dots[constellationLit - 1]?.classList.add('lit');
}
 
// ---- WEIGHTED RANDOM STAR TYPE ----
function pickStarType() {
  const totalWeight = STAR_TYPES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * totalWeight;
  for (const t of STAR_TYPES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return STAR_TYPES[0];
}
 
// ---- SPAWN STAR (JS movement, sem CSS animation) ----
function spawnStar(isShower = false) {
  if (activeStarsList.length >= MAX_STARS_ON_SCREEN) return;
  const type = pickStarType();
 
  const el = document.createElement('div');
  el.className = `star-obj type-${type.type}`;
 
  const xPct = 5 + Math.random() * 88;
  const speed = type.speedRange[0] + Math.random() * (type.speedRange[1] - type.speedRange[0]);
  const finalSpeed = isShower ? speed * 1.4 : speed;
 
  // posição inicial acima da tela
  const startY = -80;
  el.style.position = 'absolute';
  el.style.left = `${xPct}vw`;
  el.style.top = `${startY}px`;
  el.style.opacity = '0';
  el.style.transition = 'transform 0.1s ease, opacity 0.3s ease';
 
  const iconDiv = document.createElement('div');
  iconDiv.className = 'star-icon';
  iconDiv.textContent = type.icon;
  el.appendChild(iconDiv);
 
  gameArea.appendChild(el);
 
  // fade in
  requestAnimationFrame(() => { el.style.opacity = '1'; });
 
  const starObj = { el, y: startY, speed: finalSpeed, type, collected: false };
  activeStarsList.push(starObj);
 
  // hover visual via JS (sem CSS transform conflict)
  el.addEventListener('mouseenter', () => {
    if (!starObj.collected) el.style.transform = 'scale(1.25)';
  });
  el.addEventListener('mouseleave', () => {
    if (!starObj.collected) el.style.transform = 'scale(1)';
  });
 
  el.addEventListener('click', (e) => {
    if (!gameRunning || starObj.collected) return;
    e.stopPropagation();
    starObj.collected = true;
    collectStar(starObj, e.clientX, e.clientY);
  });
}
 
// ---- GAME LOOP (RAF) ----
function gameLoop(timestamp) {
  if (!gameRunning) return;
 
  const delta = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0.016;
  lastTimestamp = timestamp;
 
  const screenH = window.innerHeight;
 
  for (let i = activeStarsList.length - 1; i >= 0; i--) {
    const s = activeStarsList[i];
    if (s.collected) continue;
 
    s.y += s.speed * delta;
    s.el.style.top = `${s.y}px`;
 
    // saiu da tela
    if (s.y > screenH + 20) {
      s.el.remove();
      activeStarsList.splice(i, 1);
      streak = 0;
    }
  }
 
  rafId = requestAnimationFrame(gameLoop);
}
 
// ---- COLLECT STAR ----
function collectStar(starObj, cx, cy) {
  const { el, type } = starObj;
 
  // animação de coleta: escala + fade
  el.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
  el.style.transform = 'scale(1.8)';
  el.style.opacity = '0';
  setTimeout(() => {
    el.remove();
    activeStarsList = activeStarsList.filter(s => s !== starObj);
  }, 260);
 
  score += type.points;
  streak++;
 
  power = Math.min(100, power + (type.points === 5 ? 30 : type.points * 7));
  updatePowerBar();
 
  const dotsToLight = type.points === 5 ? 2 : 1;
  for (let i = 0; i < dotsToLight; i++) lightDot();
 
  hudScore.textContent = score;
  hudScore.style.transform = 'scale(1.3)';
  setTimeout(() => { hudScore.style.transform = 'scale(1)'; }, 200);
 
  const comboIdx = Math.min(streak, COMBOS.length - 1);
  const comboText = COMBOS[comboIdx] || '';
  const label = type.label || `+${type.points}`;
 
  const floatCls = type.type === 'pink' ? 'pink' : type.type === 'cyan' ? 'cyan' : '';
  spawnFloat(cx, cy, label, floatCls);
 
  if (comboText) {
    setTimeout(() => spawnFloat(cx, cy - 36, comboText, 'pink big'), 120);
  }
 
  if (streak >= 3) {
    hudCombo.textContent = comboText || `${streak}x combo!`;
    clearTimeout(hudCombo._t);
    hudCombo._t = setTimeout(() => { hudCombo.textContent = ''; }, 1800);
  }
}
 
// ---- FLOAT TEXT ----
function spawnFloat(x, y, text, cls = '') {
  const el = document.createElement('div');
  el.className = `float-pop ${cls}`;
  el.textContent = text;
  el.style.left = `${x - 20}px`;
  el.style.top = `${y - 20}px`;
  floatsDiv.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}
 
// ---- POWER BAR ----
function updatePowerBar() {
  powerBar.style.setProperty('--pct', `${power}%`);
  if (power >= 100) {
    btnMagic.disabled = false;
    btnMagic.classList.add('ready');
  } else {
    btnMagic.disabled = true;
    btnMagic.classList.remove('ready');
  }
}
 
// ---- MAGIC SHOWER ----
btnMagic.addEventListener('click', () => {
  if (power < 100) return;
  power = 0;
  updatePowerBar();
 
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:rgba(201,168,255,0.18);z-index:50;pointer-events:none;transition:opacity 0.6s;';
  document.body.appendChild(flash);
  setTimeout(() => { flash.style.opacity = '0'; }, 100);
  setTimeout(() => flash.remove(), 700);
 
  for (let i = 0; i < 18; i++) {
    setTimeout(() => { if (gameRunning) spawnStar(true); }, i * 80);
  }
 
  spawnFloat(window.innerWidth / 2, window.innerHeight / 2, '💜 Chuva Mágica!', 'pink big');
});
 
// ---- START GAME ----
function startGame() {
  // limpar estado anterior
  cancelAnimationFrame(rafId);
  clearInterval(spawnTimer);
  clearInterval(countdownTimer);
 
  activeStarsList.forEach(s => s.el.remove());
  activeStarsList = [];
  gameArea.innerHTML = '';
 
  score = 0;
  timeLeft = GAME_DURATION;
  constellationLit = 0;
  power = 0;
  streak = 0;
  lastTimestamp = null;
  gameRunning = true;
 
  hudScore.textContent = '0';
  hudTime.textContent = timeLeft;
  hudTime.style.color = '';
  hudTime.style.textShadow = '';
  hudCombo.textContent = '';
  buildConstellationDots();
  updatePowerBar();
 
  showScreen(screenGame);
 
  // spawn loop
  spawnTimer = setInterval(() => {
    if (gameRunning) spawnStar();
  }, SPAWN_INTERVAL_MS);
 
  // countdown
  countdownTimer = setInterval(() => {
    timeLeft--;
    hudTime.textContent = timeLeft;
    if (timeLeft <= 10) {
      hudTime.style.color = '#ff7eb3';
      hudTime.style.textShadow = '0 0 20px rgba(255,120,180,0.8)';
    }
    if (timeLeft <= 0) endGame();
  }, 1000);
 
  // inicia loop de movimento
  rafId = requestAnimationFrame(gameLoop);
}
 
// ---- END GAME ----
function endGame() {
  gameRunning = false;
  cancelAnimationFrame(rafId);
  clearInterval(spawnTimer);
  clearInterval(countdownTimer);
 
  activeStarsList.forEach(s => s.el.remove());
  activeStarsList = [];
  gameArea.innerHTML = '';
 
  endScoreVal.textContent = score;
  endConst.textContent = '⭐🌟💫✨🌠✨💫🌟⭐';
 
  const msg = [...MESSAGES_BY_SCORE].reverse().find(m => score >= m.min) || MESSAGES_BY_SCORE[0];
  endMsg.textContent = `"${msg.msg}"`;
 
  setTimeout(() => showScreen(screenEnd), 400);
}
 
// ---- SCREEN TRANSITIONS ----
function showScreen(target) {
  [screenIntro, screenGame, screenEnd].forEach(s => s.classList.remove('active'));
  target.classList.add('active');
}
 
// ---- BUTTONS ----
btnStart.addEventListener('click', startGame);
btnReplay.addEventListener('click', startGame);
 
// ---- INIT ----
showScreen(screenIntro);