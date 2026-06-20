/* ---------- SOUND (Web Audio, no files needed) ---------- */
let soundOn = true;
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq, duration, type, vol) {
  if (!soundOn) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.value = vol || 0.15;
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.stop(ctx.currentTime + duration);
}
function playCorrect() { beep(523, 0.12, 'sine'); setTimeout(() => beep(784, 0.18, 'sine'), 110); }
function playWrong() { beep(180, 0.3, 'sawtooth', 0.12); }
function playClick() { beep(660, 0.06, 'square', 0.08); }
function playTrick() { beep(440, 0.1, 'triangle'); setTimeout(() => beep(330, 0.1, 'triangle'), 100); setTimeout(() => beep(440, 0.15, 'triangle'), 200); }
function playDamage() { beep(150, 0.25, 'sawtooth', 0.18); setTimeout(() => beep(100, 0.3, 'sawtooth', 0.15), 150); }
function playSiren() {
  if (!soundOn) return;
  let f = 600;
  let rising = true;
  const interval = setInterval(() => {
    beep(f, 0.15, 'sawtooth', 0.1);
    f = rising ? f + 80 : f - 80;
    if (f > 1000) rising = false;
    if (f < 500) rising = true;
  }, 150);
  setTimeout(() => clearInterval(interval), 3000);
}
function playCountBeep() { beep(880, 0.15, 'square', 0.15); }
function playVictory() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'sine'), i * 120));
}
function playLoss() {
  [400, 300, 200, 100].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'sawtooth', 0.15), i * 150));
}
function toggleSound() {
  soundOn = !soundOn;
  document.getElementById('soundToggle').textContent = soundOn ? '🔊' : '🔇';
}

/* ---------- CONFETTI ---------- */
function fireConfetti() {
  const colors = ['#ffd23f', '#4ade80', '#60a5fa', '#fb923c', '#f87171'];
  const layer = document.getElementById('confettiLayer');
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.animationDelay = (Math.random() * 0.5) + 's';
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 4500);
  }
}

/* ---------- LANGUAGE ---------- */
function setLanguage(lang) {
  currentLang = lang;
  document.getElementById('gameTitle').textContent = t('title');
  document.getElementById('gameSub').textContent = t('subtitle');
  document.getElementById('islandLabel').textContent = t('islandLabel');
  document.getElementById('mascotIntro').textContent = t('mascotIntro');
  renderScoreboard();
  renderBoard();
  renderDamage();
}

/* ---------- GAME STATE ---------- */
const POINTS = [100, 200, 300, 400, 500];
const TEAMS = ["Team 1", "Team 2", "Team 3"];
const TEAM_COLORS = ["#60a5fa", "#34d399", "#fb923c"];

let scores = [0, 0, 0];
let used = Array.from({length: 4}, () => Array(5).fill(false));
let currentTeam = 0;
let currentCell = null;
let selectedTeamForAward = 0;

let totalStrikes = 0;
const STRIKE_LIMIT = 10;

let teamStats = [
  { correct: 0, wrong: 0, skipped: 0, pointsWon: 0 },
  { correct: 0, wrong: 0, skipped: 0, pointsWon: 0 },
  { correct: 0, wrong: 0, skipped: 0, pointsWon: 0 }
];
let costliestWrong = null;

let islandLost = false;
let bonusRoundActive = false;
let bonusTimerInterval = null;

/* ---------- SCOREBOARD ---------- */
function renderScoreboard() {
  document.getElementById('scoreboard').innerHTML = TEAMS.map((team, i) => `
    <div class="score-card ${i === currentTeam ? 'active' : ''}">
      <div class="team-name">${team}</div>
      <div class="team-score" id="score-${i}" style="color:${TEAM_COLORS[i]}">${scores[i]}</div>
      <span class="team-badge" style="background:${TEAM_COLORS[i]}22;color:${TEAM_COLORS[i]}">${i === currentTeam ? '▶ ' + t('onTheClock') : t('waiting')}</span>
    </div>
  `).join('');
  document.getElementById('turn-indicator').textContent = "🎯 " + TEAMS[currentTeam] + ", " + t('pickPrompt');
}

function popScore(teamIdx) {
  const el = document.getElementById('score-' + teamIdx);
  if (el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
}

/* ---------- BOARD ---------- */
function renderBoard() {
  const cats = CATEGORIES_I18N[currentLang];
  let html = cats.map(c => `<div class="cat-header"><span class="cat-icon">${c.icon}</span><span class="cat-name">${c.name}</span></div>`).join('');
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 4; c++) {
      if (used[c][r]) {
        html += `<div class="cell used">✓</div>`;
      } else {
        html += `<div class="cell" onclick="openQuestion(${c},${r})">${POINTS[r]}</div>`;
      }
    }
  }
  document.getElementById('board').innerHTML = html;
}

/* ---------- ISLAND SVG (illustrated, stage-based) ---------- */
function getIslandSVG(stage) {
  // stage: 0 healthy, 1 mild, 2 damaged, 3 critical
  const palettes = [
    { sea: "#1d6fa3", sand: "#e8d28a", grass: "#3fae6c", trunk: "#7a5230" },
    { sea: "#1d6fa3", sand: "#d9c279", grass: "#7a9c3f", trunk: "#6b4828" },
    { sea: "#3a6a82", sand: "#a98f5a", grass: "#8a7a3a", trunk: "#5a3f22" },
    { sea: "#48505a", sand: "#5c5346", grass: "#4a4030", trunk: "#3a2f20" }
  ];
  const p = palettes[stage];
  const palmOpacity = stage >= 3 ? 0.3 : 1;
  const faceEmoji = ["🙂", "😕", "😟", "💀"][stage];

  return `
  <svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="150" cy="130" rx="145" ry="35" fill="${p.sea}" opacity="0.9" />
    <ellipse cx="150" cy="120" rx="105" ry="42" fill="${p.sand}" />
    <ellipse cx="150" cy="110" rx="80" ry="32" fill="${p.grass}" />
    <g opacity="${palmOpacity}">
      <rect x="95" y="78" width="6" height="32" fill="${p.trunk}" rx="2" />
      <path d="M98 78 Q80 65 65 70 Q82 75 98 84" fill="${stage >= 2 ? '#5a6b30' : '#2f8f4f'}" />
      <path d="M98 78 Q116 62 130 68 Q114 76 98 84" fill="${stage >= 2 ? '#5a6b30' : '#2f8f4f'}" />
      <path d="M98 78 Q92 58 100 48 Q104 62 98 84" fill="${stage >= 2 ? '#4a5b25' : '#249444'}" />
    </g>
    <g opacity="${palmOpacity}">
      <rect x="200" y="85" width="5" height="28" fill="${p.trunk}" rx="2" />
      <path d="M202 85 Q188 74 176 78 Q190 82 202 90" fill="${stage >= 2 ? '#5a6b30' : '#2f8f4f'}" />
      <path d="M202 85 Q216 72 228 78 Q214 84 202 90" fill="${stage >= 2 ? '#5a6b30' : '#2f8f4f'}" />
    </g>
    ${stage >= 1 ? `<circle cx="120" cy="118" r="3" fill="#888" opacity="0.7" />` : ''}
    ${stage >= 1 ? `<rect x="160" y="122" width="8" height="5" fill="#aaa" opacity="0.6" rx="1" />` : ''}
    ${stage >= 2 ? `<circle cx="140" cy="112" r="4" fill="#777" opacity="0.7" />` : ''}
    ${stage >= 2 ? `<rect x="100" y="125" width="10" height="6" fill="#999" opacity="0.6" rx="1" transform="rotate(15 105 128)" />` : ''}
    ${stage >= 3 ? `<circle cx="175" cy="108" r="5" fill="#666" opacity="0.8" />` : ''}
    ${stage >= 3 ? `<rect x="130" y="100" width="12" height="7" fill="#888" opacity="0.7" rx="1" transform="rotate(-10 136 103)" />` : ''}
    <text x="150" y="120" font-size="34" text-anchor="middle">${faceEmoji}</text>
  </svg>`;
}

function renderDamage() {
  const pct = Math.min(100, (totalStrikes / STRIKE_LIMIT) * 100);
  document.getElementById('damageBarFill').style.width = pct + "%";

  let stage = 0;
  let statusKey = 'damageHealthy';
  if (totalStrikes >= STRIKE_LIMIT) { stage = 3; statusKey = 'damageCritical'; }
  else if (totalStrikes >= STRIKE_LIMIT * 0.6) { stage = 2; statusKey = 'damageCritical'; }
  else if (totalStrikes >= STRIKE_LIMIT * 0.3) { stage = 1; statusKey = 'damageDamaged'; }

  document.getElementById('islandStage').innerHTML = getIslandSVG(stage);
  document.getElementById('damageText').textContent =
    totalStrikes + " " + t('strikes') + " / " + STRIKE_LIMIT + " — " + t(statusKey);
}

function spawnTrashParticle() {
  const stage = document.getElementById('islandStage');
  const emojis = ['🗑️', '🥤', '🛍️', '🧴', '📦'];
  const particle = document.createElement('div');
  particle.className = 'trash-particle';
  particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  particle.style.left = (30 + Math.random() * 220) + 'px';
  particle.style.top = '0px';
  particle.style.animation = 'trashFall 1.2s ease forwards';
  stage.appendChild(particle);
  setTimeout(() => particle.remove(), 1300);
}

function shakeIsland() {
  const stage = document.getElementById('islandStage');
  stage.classList.remove('island-shake');
  void stage.offsetWidth;
  stage.classList.add('island-shake');
}

function reactMascot(happy) {
  const face = document.getElementById('mascotFace');
  face.classList.remove('react-happy', 'react-sad');
  void face.offsetWidth;
  face.classList.add(happy ? 'react-happy' : 'react-sad');
}

function registerStrike() {
  totalStrikes++;
  playDamage();
  shakeIsland();
  spawnTrashParticle();
  spawnTrashParticle();
  renderDamage();
  if (totalStrikes >= STRIKE_LIMIT && !islandLost && !bonusRoundActive) {
    islandLost = true;
    setTimeout(() => beginBonusTransition(), 900);
  }
}

/* ---------- QUESTION FLOW ---------- */
function openQuestion(cat, row) {
  if (used[cat][row]) return;
  playClick();
  currentCell = { cat, row };
  selectedTeamForAward = currentTeam;
  const q = QUESTIONS_I18N[currentLang][cat][row];
  renderModal(q, POINTS[row], cat, false, null);
}

function renderModal(q, pts, cat, revealed, chosenIdx) {
  document.getElementById('overlay').style.display = 'flex';
  const optBtns = q.opts.map((o, i) => {
    let cls = 'opt-btn';
    if (revealed) {
      if (i === q.correct) cls += ' correct';
      else if (i === chosenIdx) cls += ' wrong';
    }
    const handler = revealed ? 'disabled' : `onclick="answer(${i})"`;
    return `<button class="${cls}" ${handler}>${o}</button>`;
  }).join('');

  let resultHtml = '';
  let mascotHtml = '';
  if (revealed) {
    const isTrick = !!q.isTrick;
    const isCorrect = !isTrick && chosenIdx === q.correct;
    const cls = isTrick ? 'trick' : (isCorrect ? 'correct' : 'wrong');
    const label = isTrick ? t('trickQuestion') : (isCorrect ? t('correct') : t('notQuite'));
    resultHtml = `<div class="result-box ${cls}"><span class="fact-tag">${t('realFact')}</span><br><strong>${label}</strong> ${q.fact}</div>`;
    mascotHtml = `<div class="mascot-react"><div class="mface">🗑️</div><div class="mtext">"${q.mascot}"</div></div>`;
  }

  const teamBtns = TEAMS.map((team, i) =>
    `<button class="team-btn ${selectedTeamForAward === i ? 'selected' : ''}" onclick="selectAwardTeam(${i})" id="atb-${i}">${team}</button>`
  ).join('');

  const cats = CATEGORIES_I18N[currentLang];

  document.getElementById('modal').innerHTML = `
    <div class="modal-tag">${cats[cat].icon} ${cats[cat].name}</div>
    <div class="modal-pts">${pts} ${t('points')}</div>
    <div class="modal-question">${q.q}</div>
    <div class="options">${optBtns}</div>
    ${mascotHtml}
    ${resultHtml}
    ${revealed ? `
      <div style="font-size:13px;color:#9fd8c4;margin-bottom:8px">${t('awardTo')}</div>
      <div class="modal-footer">
        <div class="team-select">${teamBtns}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="close-btn" onclick="closeModal(false)">${t('skip')}</button>
          <button class="award-btn" onclick="awardPoints()">${t('award')} ${pts} ${t('pts')}</button>
        </div>
      </div>
    ` : `<div class="modal-footer"><button class="close-btn" onclick="cancelQuestion()">${t('cancel')}</button></div>`}
  `;
}

function cancelQuestion() {
  document.getElementById('overlay').style.display = 'none';
  currentCell = null;
}

function answer(idx) {
  const { cat, row } = currentCell;
  const q = QUESTIONS_I18N[currentLang][cat][row];
  const isTrick = !!q.isTrick;
  const wasCorrect = !isTrick && idx === q.correct;

  if (isTrick) {
    playTrick();
    reactMascot(false);
    teamStats[currentTeam].wrong++;
    registerStrike();
  } else if (wasCorrect) {
    playCorrect();
    reactMascot(true);
    teamStats[currentTeam].correct++;
  } else {
    playWrong();
    reactMascot(false);
    teamStats[currentTeam].wrong++;
    registerStrike();
    if (!costliestWrong || POINTS[row] > costliestWrong.points) {
      costliestWrong = { team: TEAMS[currentTeam], points: POINTS[row], category: CATEGORIES_I18N.en[cat].name };
    }
  }

  renderModal(q, POINTS[row], cat, true, idx);
}

function selectAwardTeam(i) {
  selectedTeamForAward = i;
  TEAMS.forEach((_, idx) => {
    const btn = document.getElementById('atb-' + idx);
    if (btn) btn.className = 'team-btn' + (idx === i ? ' selected' : '');
  });
}

function awardPoints() {
  const { cat, row } = currentCell;
  scores[selectedTeamForAward] += POINTS[row];
  teamStats[selectedTeamForAward].pointsWon += POINTS[row];
  playClick();
  closeModal(true);
}

/* markUsed param removed — question ALWAYS marked used now (bug fix) */
function closeModal(wasAwarded) {
  if (currentCell) {
    used[currentCell.cat][currentCell.row] = true;
    if (!wasAwarded) {
      teamStats[currentTeam].skipped++;
    } else {
      popScore(selectedTeamForAward);
    }
  }
  currentTeam = (currentTeam + 1) % 3;
  document.getElementById('overlay').style.display = 'none';
  renderScoreboard();
  renderBoard();
  renderDamage();
  checkAllUsed();
}

function checkAllUsed() {
  if (used.every(col => col.every(v => v)) && !bonusRoundActive && !islandLost) {
    endGame(false);
  }
}

/* ---------- BONUS ROUND TRANSITION (3 stages) ---------- */
function beginBonusTransition() {
  document.getElementById('overlay').style.display = 'none';

  // STAGE 1: freeze-frame
  const freeze = document.getElementById('freezeOverlay');
  const freezeText = document.getElementById('freezeText');
  freezeText.textContent = t('freezeText');
  freeze.style.display = 'flex';
  playDamage();

  setTimeout(() => {
    freeze.style.display = 'none';
    startAlarmSequence();
  }, 1200);
}

function startAlarmSequence() {
  const alarm = document.getElementById('alarmOverlay');
  const content = document.getElementById('alarmContent');
  alarm.style.display = 'flex';
  playSiren();

  content.innerHTML = `<div class="alarm-title">🚨 ${t('alarmTitle')} 🚨</div>`;

  let count = 3;
  function tick() {
    content.innerHTML = `
      <div class="alarm-title">🚨 ${t('alarmTitle')} 🚨</div>
      <div class="alarm-count">${count}</div>
    `;
    playCountBeep();
    count--;
    if (count >= 0) {
      setTimeout(tick, 1000);
    } else {
      setTimeout(() => {
        alarm.style.display = 'none';
        startBonusRound();
      }, 700);
    }
  }
  setTimeout(tick, 600);
}

/* ---------- BONUS ROUND ---------- */
let bonusPool = [];
let bonusIndex = 0;
let bonusTimeLeft = 0;
const BONUS_QUESTION_COUNT = 5;
const BONUS_TIME_SECONDS = 15;

function flattenAllQuestions() {
  const flat = [];
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 5; r++) {
      flat.push({ cat: c, row: r });
    }
  }
  return flat;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startBonusRound() {
  bonusRoundActive = true;
  bonusPool = shuffle(flattenAllQuestions()).slice(0, BONUS_QUESTION_COUNT);
  bonusIndex = 0;
  document.getElementById('bonusOverlay').style.display = 'flex';
  renderBonusQuestion();
}

function renderBonusQuestion() {
  if (bonusIndex >= bonusPool.length) {
    bonusSuccess();
    return;
  }
  const { cat, row } = bonusPool[bonusIndex];
  const q = QUESTIONS_I18N[currentLang][cat][row];
  const cats = CATEGORIES_I18N[currentLang];

  bonusTimeLeft = BONUS_TIME_SECONDS;

  const optBtns = q.opts.map((o, i) =>
    `<button class="bonus-opt-btn" onclick="bonusAnswer(${i})">${o}</button>`
  ).join('');

  const dots = bonusPool.map((_, i) => {
    let cls = 'bonus-dot';
    if (i < bonusIndex) cls += ' done';
    else if (i === bonusIndex) cls += ' current';
    return `<div class="${cls}"></div>`;
  }).join('');

  document.getElementById('bonusModal').innerHTML = `
    <div class="bonus-header">
      <div class="bonus-title">⚠️ ${t('bonusTitle')} ⚠️</div>
      <div class="bonus-warning">${t('bonusWarning')}</div>
    </div>
    <div class="bonus-progress">${dots}</div>
    <div class="modal-tag">${cats[cat].icon} ${cats[cat].name} — ${bonusIndex + 1} / ${bonusPool.length}</div>
    <div class="bonus-timer" id="bonusTimer">${bonusTimeLeft}</div>
    <div class="modal-question">${q.q}</div>
    <div class="options">${optBtns}</div>
  `;

  if (bonusTimerInterval) clearInterval(bonusTimerInterval);
  bonusTimerInterval = setInterval(() => {
    bonusTimeLeft--;
    const timerEl = document.getElementById('bonusTimer');
    if (timerEl) {
      timerEl.textContent = bonusTimeLeft;
      if (bonusTimeLeft <= 5) timerEl.classList.add('danger');
    }
    if (bonusTimeLeft <= 0) {
      clearInterval(bonusTimerInterval);
      bonusFail();
    }
  }, 1000);
}

function bonusAnswer(idx) {
  clearInterval(bonusTimerInterval);
  const { cat, row } = bonusPool[bonusIndex];
  const q = QUESTIONS_I18N[currentLang][cat][row];
  const correct = idx === q.correct && !q.isTrick;

  if (!correct) {
    bonusFail();
    return;
  }

  playCorrect();
  bonusIndex++;
  setTimeout(() => renderBonusQuestion(), 500);
}

function bonusFail() {
  clearInterval(bonusTimerInterval);
  playLoss();
  document.getElementById('bonusModal').innerHTML = `
    <div class="bonus-header">
      <div class="bonus-title">💀 ${t('bonusTimeUp')}</div>
    </div>
    <div class="result-box wrong" style="margin-top:1rem">${t('bonusFail')}</div>
    <button class="restart-btn" onclick="location.reload()">${t('restart')}</button>
  `;
  setTimeout(() => {
    endGame(true);
  }, 2500);
}

function bonusSuccess() {
  playVictory();
  fireConfetti();
  document.getElementById('bonusModal').innerHTML = `
    <div class="bonus-header">
      <div class="bonus-title" style="color:#4ade80">🌴 ${t('bonusSuccess')}</div>
      <div class="bonus-warning" style="color:#bbf7d0">${t('bonusSuccessSub')}</div>
    </div>
  `;
  totalStrikes = Math.floor(STRIKE_LIMIT * 0.3);
  islandLost = false;
  renderDamage();
  setTimeout(() => {
    document.getElementById('bonusOverlay').style.display = 'none';
    bonusRoundActive = false;
    renderScoreboard();
    renderBoard();
    checkAllUsed();
  }, 2800);
}

/* ---------- END GAME / STATS ---------- */
function endGame(islandWasLost) {
  const max = Math.max(...scores);
  const winners = TEAMS.filter((_, i) => scores[i] === max);
  if (!islandWasLost) { playVictory(); fireConfetti(); }

  document.getElementById('win-banner').innerHTML = `
    <div class="win-banner">
      🏆 ${t('gameOver')}<br>
      ${winners.join(' & ')} ${winners.length > 1 ? t('winsWithPlural') : t('winsWith')} ${max} ${t('pts')}!<br>
      <span style="font-size:13px;color:#9fd8c4;font-weight:400">${t('finalLine')}</span>
      <br><button class="restart-btn" onclick="showStats()">${t('viewStats')}</button>
    </div>
  `;
}

function showStats() {
  const max = Math.max(...scores);
  const mvpIdx = scores.indexOf(max);

  let totalCorrect = 0, totalWrong = 0, totalSkipped = 0;
  teamStats.forEach(s => { totalCorrect += s.correct; totalWrong += s.wrong; totalSkipped += s.skipped; });

  const teamCardsHtml = TEAMS.map((team, i) => {
    const s = teamStats[i];
    const attempted = s.correct + s.wrong;
    const accuracy = attempted > 0 ? Math.round((s.correct / attempted) * 100) : 0;
    const isWinner = i === mvpIdx;
    return `
      <div class="stat-team-card ${isWinner ? 'winner' : ''}">
        <div class="stat-team-name" style="color:${TEAM_COLORS[i]}">${team} ${isWinner ? '👑' : ''}</div>
        <div class="stat-row"><span>${t('teamAccuracy')}</span><span>${accuracy}%</span></div>
        <div class="stat-row"><span>${t('teamCorrect')}</span><span>${s.correct}</span></div>
        <div class="stat-row"><span>${t('teamWrong')}</span><span>${s.wrong}</span></div>
        <div class="stat-row"><span>${t('teamSkipped')}</span><span>${s.skipped}</span></div>
        <div class="stat-row"><span>${t('points')}</span><span>${scores[i]}</span></div>
      </div>
    `;
  }).join('');

  const islandStatusText = islandLost ? t('lost') : t('saved');
  const costliestText = costliestWrong
    ? `${costliestWrong.team} — ${costliestWrong.points} ${t('pts')} (${costliestWrong.category})`
    : "—";

  document.getElementById('statsScreen').innerHTML = `
    <div class="stats-screen">
      <div class="stats-title">📊 ${t('statsTitle')}</div>
      <div class="mvp-banner">🏆 ${t('mvp')}: ${TEAMS[mvpIdx]}</div>
      <div class="stats-grid">${teamCardsHtml}</div>
      <div class="overall-stats">
        <div class="row"><span>${t('totalQuestions')}</span><span>20</span></div>
        <div class="row"><span>${t('totalCorrect')}</span><span>${totalCorrect}</span></div>
        <div class="row"><span>${t('totalWrong')}</span><span>${totalWrong}</span></div>
        <div class="row"><span>${t('totalSkipped')}</span><span>${totalSkipped}</span></div>
        <div class="row"><span>${t('islandStatus')}</span><span>${islandStatusText}</span></div>
        <div class="row"><span>${t('costliest')}</span><span>${costliestText}</span></div>
      </div>
      <button class="restart-btn" onclick="location.reload()">${t('restart')}</button>
    </div>
  `;
  document.getElementById('statsScreen').scrollIntoView({ behavior: 'smooth' });
}

/* ---------- INIT ---------- */
renderScoreboard();
renderBoard();
renderDamage();
