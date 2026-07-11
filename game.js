const $ = (s) => document.querySelector(s);
const startScreen = $('#startScreen');
const playScreen = $('#playScreen');
const resultScreen = $('#resultScreen');
const startBtn = $('#startBtn');
const retryBtn = $('#retryBtn');
const audio = $('#battleAudio');
const gate = $('#gate');
const lane = $('#lane');
const judgement = $('#judgement');
const prompt = $('#prompt');
const magic = $('#magic');
const boss = $('#boss');
const bossHit = $('#bossHit');
const bossHpEl = $('#bossHp');
const bossHpText = $('#bossHpText');
const stabilityEl = $('#stability');
const stabilityText = $('#stabilityText');
const comboEl = $('#combo');
const accEl = $('#accuracy');
const timerEl = $('#timer');
const finalRank = $('#finalRank');
const finalStats = $('#finalStats');
const glitchOverlay = $('#glitchOverlay');
const introOverlay = $('#introOverlay');
const warningText = $('#warningText');
const phaseText = $('#phaseText');
const handIdle = $('#handIdle');
const impactBurst = $('#impactBurst');

const PERFECT_FX = {
  A: ['assets/video/perfect_blue.mp4', 'assets/audio/perfect_blue.mp3'],
  W: ['assets/video/perfect_red.mp4', 'assets/audio/perfect_red.mp3'],
  S: ['assets/video/perfect_green.mp4', 'assets/audio/perfect_green.mp3'],
  D: ['assets/video/perfect_yellow.mp4', 'assets/audio/perfect_yellow.mp3']
};
const hitAudio = Object.fromEntries(Object.entries(PERFECT_FX).map(([key, value]) => {
  const sound = new Audio(value[1]);
  sound.preload = 'auto';
  sound.volume = .42;
  return [key, sound];
}));

const KEYS = ['A', 'W', 'S', 'D'];
const NOTE_SRC = {
  A: 'assets/img/note_a.png',
  W: 'assets/img/note_w.png',
  S: 'assets/img/note_s.png',
  D: 'assets/img/note_d.png'
};

let running = false;
let raf = null;
let startTime = 0;
let beatMap = [];
let nextSpawnIndex = 0;
let activeNotes = [];
let bossHp = 100;
let stability = 100;
let combo = 0;
let maxCombo = 0;
let total = 0;
let hits = 0;
let perfect = 0;
let great = 0;
let good = 0;
let miss = 0;
let demoSeconds = 156;
let phaseTwoTriggered = false;
let gameplayStarted = false;
let lastAudioGuardAt = 0;
let travelMs = 980;        // v0.9: faster note travel
const missLateMs = 430;    // auto MISS after passing the gate
const earlyIgnoreMs = 520; // too early = WAIT, not punished

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  const k = e.key.toUpperCase();
  if (KEYS.includes(k)) {
    e.preventDefault();
    if (!e.repeat) press(k);
  }
});
document.querySelectorAll('.buttons button').forEach((button) => {
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    press(button.dataset.key);
  }, {passive:false});
});

function startGame(){
  hide(startScreen); hide(resultScreen); show(playScreen);
  cleanupNotes();
  running = false;
  gameplayStarted = false;
  phaseTwoTriggered = false;
  nextSpawnIndex = 0;
  bossHp = 100; stability = 100; combo = 0; maxCombo = 0;
  total = 0; hits = 0; perfect = 0; great = 0; good = 0; miss = 0;
  cancelAnimationFrame(raf);
  audio.pause();
  audio.currentTime = 0;
  travelMs = 980;
  if (Number.isFinite(audio.duration) && audio.duration > 30) demoSeconds = Math.floor(audio.duration);
  buildContinuousBeatMap();
  updateHUD();
  updateGlitch();
  showJudge('', true);
  prompt.innerHTML = 'SYNCING <b>...</b>';
  // Start audible playback inside the user's click/tap gesture.
  // Delayed unmuting after the intro is blocked by some mobile browsers.
  audio.muted = false;
  audio.volume = .72;
  audio.play().catch(() => {});
  playIntroSequence();
}


async function playIntroSequence(){
  show(introOverlay);
  const lines = ['introLine1','introLine2','introLine3','introLine4'].map(id => document.getElementById(id));
  for (const line of lines){
    line.classList.remove('show');
    void line.offsetWidth;
    line.classList.add('show');
    await new Promise(r => setTimeout(r, 760));
  }
  hide(introOverlay);
  startTime = performance.now();
  running = true;
  gameplayStarted = true;
  keepBattleAudioAlive();
  loop();
}

audio.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(audio.duration) && audio.duration > 30) {
    demoSeconds = Math.floor(audio.duration);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) endGame();
});

function keepBattleAudioAlive(){
  if (!running || !gameplayStarted || stability <= 0) return;
  if (audio.paused && audio.currentTime < demoSeconds - .25) {
    audio.play().catch(() => {});
  }
}

audio.addEventListener('pause', () => {
  if (running && gameplayStarted && stability > 0) {
    setTimeout(keepBattleAudioAlive, 80);
  }
});

function seededRandom(seed){
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pickKey(i){
  // Controlled randomness: varied, but not chaotic.
  const r = seededRandom(i * 9.17 + 3.1);
  if (r < 0.25) return 'A';
  if (r < 0.50) return 'W';
  if (r < 0.75) return 'S';
  return 'D';
}

function buildContinuousBeatMap(){
  // Real rhythm-game style: notes are scheduled on a timeline.
  // They continue spawning whether the player hits or misses.
  beatMap = [];
  let t = 1450; // first target time after start, in ms
  let i = 0;
  const songMs = demoSeconds * 1000;
  while (t < songMs - 1500) {
    const progress = t / songMs;
    const r = seededRandom(i * 13.37 + 5.5);

    // Gap varies: some notes close, some notes far. Gets slightly tighter over time.
    let minGap = progress < 0.35 ? 600 : progress < 0.72 ? 500 : 430;
    let maxGap = progress < 0.35 ? 1120 : progress < 0.72 ? 960 : 820;
    let gap = minGap + r * (maxGap - minGap);

    // Every few notes, add a small burst so it feels less predictable.
    if (i % 11 === 7) gap *= 0.72;
    if (i % 17 === 12) gap *= 1.22;

    beatMap.push({
      id: i,
      key: pickKey(i),
      targetAt: t,
      spawnAt: Math.max(0, t - travelMs),
      judged: false,
      el: null
    });
    t += gap;
    i++;
  }
}

function formatTime(sec){
  const m = Math.floor(sec / 60);
  const s = Math.max(0, Math.floor(sec % 60));
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function createNote(noteData){
  const el = document.createElement('div');
  el.className = 'note live-note';
  el.dataset.key = noteData.key;
  const img = document.createElement('img');
  img.src = NOTE_SRC[noteData.key];
  img.alt = `note ${noteData.key}`;
  el.appendChild(img);
  lane.appendChild(el);
  noteData.el = el;
  activeNotes.push(noteData);
}

function cleanupNotes(){
  activeNotes.forEach(n => n.el?.remove());
  activeNotes = [];
  document.querySelectorAll('.live-note').forEach(el => el.remove());
  const oldStatic = $('#note');
  if (oldStatic) hide(oldStatic);
}

function getTargetX(){
  const laneRect = lane.getBoundingClientRect();
  const gateRect = gate.getBoundingClientRect();
  // note is 112px wide; target means note center aligns with gate center
  return (gateRect.left + gateRect.width * 0.5) - laneRect.left - 56;
}

function loop(now = performance.now()){
  if (!running || !gameplayStarted) return;
  if (now - lastAudioGuardAt > 500) {
    lastAudioGuardAt = now;
    keepBattleAudioAlive();
  }
  const elapsedMs = now - startTime;
  const elapsed = elapsedMs / 1000;
  const remaining = Math.max(0, Math.ceil(demoSeconds - elapsed));
  timerEl.textContent = formatTime(remaining);

  // Spawn notes by timeline, not by player input.
  while (nextSpawnIndex < beatMap.length && elapsedMs >= beatMap[nextSpawnIndex].spawnAt) {
    createNote(beatMap[nextSpawnIndex]);
    nextSpawnIndex++;
  }

  const targetX = getTargetX();
  for (const n of activeNotes) {
    if (n.judged || !n.el) continue;
    const p = clamp((elapsedMs - n.spawnAt) / travelMs, 0, 1.26);
    const x = targetX * p;
    n.el.style.transform = `translateX(${x}px)`;
    n.el.classList.toggle('near-hit', p > 0.78 && p < 1.08);

    if (elapsedMs > n.targetAt + missLateMs) {
      doMiss(n, true);
    }
  }

  // Remove old judged notes after their animation window.
  activeNotes = activeNotes.filter(n => {
    if (!n.el) return false;
    if (n.removeAt && now > n.removeAt) {
      n.el.remove();
      return false;
    }
    return true;
  });

  updatePrompt(elapsedMs);

  // The song plays to its natural ending unless the neural link collapses.
  if (elapsed >= demoSeconds || stability <= 0 || (nextSpawnIndex >= beatMap.length && activeNotes.length === 0)) {
    endGame();
    return;
  }
  raf = requestAnimationFrame(loop);
}

function updatePrompt(elapsedMs){
  const next = activeNotes
    .filter(n => !n.judged)
    .sort((a,b) => Math.abs(a.targetAt - elapsedMs) - Math.abs(b.targetAt - elapsedMs))[0]
    || beatMap[nextSpawnIndex];
  if (!next) return;
  prompt.innerHTML = `PRESS <b>${next.key}</b>`;
}

function press(key){
  if (!running) return;
  keepBattleAudioAlive();
  flashButton(key);
  playTapFx(key);
  const elapsedMs = performance.now() - startTime;

  const candidates = activeNotes.filter(n => !n.judged);
  if (!candidates.length) {
    showJudge('WAIT', false);
    return;
  }

  const nearestAny = candidates
    .slice()
    .sort((a,b) => Math.abs(a.targetAt - elapsedMs) - Math.abs(b.targetAt - elapsedMs))[0];

  const matching = candidates
    .filter(n => n.key === key)
    .sort((a,b) => Math.abs(a.targetAt - elapsedMs) - Math.abs(b.targetAt - elapsedMs))[0];

  // Very early taps should not punish the player.
  if (nearestAny && elapsedMs < nearestAny.targetAt - earlyIgnoreMs) {
    showJudge('WAIT', false);
    return;
  }

  if (matching && Math.abs(matching.targetAt - elapsedMs) <= 560) {
    const abs = Math.abs(matching.targetAt - elapsedMs);
    if (abs <= 150) judge(matching, 'PERFECT');
    else if (abs <= 290) judge(matching, 'GREAT');
    else if (abs <= 450) judge(matching, 'GOOD');
    else doMiss(matching, false);
    return;
  }

  // Wrong button near the gate = MISS on the nearest note.
  if (nearestAny && Math.abs(nearestAny.targetAt - elapsedMs) <= 430) {
    doMiss(nearestAny, false);
  } else {
    showJudge('WAIT', false);
  }
}

function judge(n, label){
  if (!n || n.judged) return;
  n.judged = true;
  n.el?.classList.add('hit-out');
  n.removeAt = performance.now() + 180;
  total++;
  hits++;

  if (label === 'PERFECT') {
    perfect++; combo++; bossHp -= 0.34; stability = Math.min(100, stability + 0.9);
  } else if (label === 'GREAT') {
    great++; combo++; bossHp -= 0.23; stability = Math.min(100, stability + 0.45);
  } else {
    good++; combo++; bossHp -= 0.13;
  }
  maxCombo = Math.max(maxCombo, combo);
  showJudge(label, true);
  playHitFx(n.key, label);
  updateHUD();
  checkBossPhase();
}

function doMiss(n, auto){
  if (!n || n.judged) return;
  n.judged = true;
  n.el?.classList.add('miss-out');
  n.removeAt = performance.now() + 200;
  total++;
  miss++;
  combo = 0;
  stability -= auto ? 3.5 : 5.5;
  showJudge('MISS', false);
  document.body.classList.add('damage');
  playScreen.classList.remove('glitch-pulse');
  void playScreen.offsetWidth;
  playScreen.classList.add('glitch-pulse');
  setTimeout(() => document.body.classList.remove('damage'), 240);
  setTimeout(() => playScreen.classList.remove('glitch-pulse'), 200);
  updateHUD();
}

function showJudge(text, good){
  judgement.textContent = text;
  judgement.classList.toggle('miss', !good && text !== 'WAIT' && text !== '');
  judgement.classList.remove('pop');
  void judgement.offsetWidth;
  if (text) judgement.classList.add('pop');
  if (good && text) {
    gate.classList.remove('flash');
    void gate.offsetWidth;
    gate.classList.add('flash');
  }
}

function restartVideo(video){
  video.pause();
  video.currentTime = 0;
  show(video);
  video.play().catch(() => {});
  clearTimeout(video.hideTimer);
  video.hideTimer = setTimeout(() => hide(video), 2200);
}

function playTapFx(key){
  // Immediate feedback on every physical/touch input, even WAIT or MISS.
  handIdle.classList.remove('tap-attack','hit-attack');
  void handIdle.offsetWidth;
  handIdle.classList.add('tap-attack');

  const sound = hitAudio[key];
  sound.pause();
  sound.currentTime = 0;
  sound.play().catch(() => {});
  if (navigator.vibrate) navigator.vibrate(16);
}

function playHitFx(key, label){
  playScreen.classList.remove('screen-hit');
  void playScreen.offsetWidth;
  playScreen.classList.add('screen-hit');

  magic.classList.remove('hidden','flash');
  void magic.offsetWidth;
  magic.classList.add('flash');
  setTimeout(() => hide(magic), 430);

  boss.classList.add('hit-shake');
  show(bossHit);
  setTimeout(() => {
    hide(bossHit);
    boss.classList.remove('hit-shake');
  }, 260);
  setTimeout(() => playScreen.classList.remove('screen-hit'), 170);

  const colors = {A:'#38bfff',W:'#ff305f',S:'#27ff91',D:'#ffd43b'};
  handIdle.style.setProperty('--fx', colors[key]);
  handIdle.classList.remove('tap-attack','hit-attack');
  void handIdle.offsetWidth;
  handIdle.classList.add('hit-attack');
  impactBurst.style.setProperty('--fx', colors[key]);
  impactBurst.classList.remove('fire');
  void impactBurst.offsetWidth;
  impactBurst.classList.add('fire');

  if (navigator.vibrate) navigator.vibrate(label === 'PERFECT' ? 35 : 18);
}

function flashButton(key){
  const btn = document.querySelector(`.buttons button[data-key="${key}"]`);
  if (!btn) return;
  btn.classList.add('active');
  setTimeout(() => btn.classList.remove('active'), 120);
}

function updateHUD(){
  bossHp = clamp(bossHp, 0, 100);
  stability = clamp(stability, 0, 100);
  bossHpEl.style.width = `${bossHp}%`;
  stabilityEl.style.width = `${stability}%`;
  bossHpText.textContent = `${Math.round(bossHp)}%`;
  stabilityText.textContent = `${Math.round(stability)}%`;
  comboEl.textContent = `COMBO x${combo}`;
  const acc = total ? Math.round((hits / total) * 100) : 100;
  accEl.textContent = `ACC ${acc}%`;
  updateGlitch();
}

function updateGlitch(){
  if (!playScreen) return;
  playScreen.classList.remove('glitch-1','glitch-2','glitch-3');
  if (!running) return;
  warningText.textContent = '';
  if (stability <= 20) { playScreen.classList.add('glitch-3'); warningText.textContent = 'NEURAL LINK CRITICAL // SIGNAL LOST'; }
  else if (stability <= 35) { playScreen.classList.add('glitch-2'); warningText.textContent = 'WARNING // FIREWALL DECAY'; }
  else if (stability <= 60) { playScreen.classList.add('glitch-1'); warningText.textContent = 'SYSTEM INSTABILITY DETECTED'; }
}


function checkBossPhase(){
  if (!phaseTwoTriggered && bossHp <= 30){
    phaseTwoTriggered = true;
    playScreen.classList.add('boss-phase-2');
    phaseText.textContent = 'PHASE II // RAGE PROTOCOL';
    phaseText.classList.remove('show');
    void phaseText.offsetWidth;
    phaseText.classList.add('show');
    travelMs = Math.max(780, travelMs - 90);
    setTimeout(() => phaseText.classList.remove('show'), 1200);
  }
}

function endGame(){
  running = false;
  cancelAnimationFrame(raf);
  audio.pause();
  cleanupNotes();
  playScreen.classList.remove('glitch-1','glitch-2','glitch-3','glitch-pulse','boss-phase-2');
  gameplayStarted = false;
  warningText.textContent = '';
  hide(playScreen);
  show(resultScreen);
  const acc = total ? Math.round((hits / total) * 100) : 100;
  let rank = acc >= 92 ? 'S' : acc >= 82 ? 'A' : acc >= 68 ? 'B' : 'C';
  if (stability <= 0) rank = 'D';
  finalRank.textContent = `RANK ${rank}`;
  const status = stability <= 0 ? 'NEURAL LINK COLLAPSED' : bossHp <= 0 ? 'VIRUS JAO-THEE PURGED' : 'EXORCISM SESSION COMPLETE';
  finalStats.innerHTML = `${status}<br><br>Accuracy: ${acc}%<br>Perfect: ${perfect}<br>Great: ${great}<br>Good: ${good}<br>Miss: ${miss}<br>Max Combo: ${maxCombo}`;
}
