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
function playAlarm() { beep(800, 0.1, 'square', 0.1); setTimeout(() => beep(600, 0.1, 'square', 0.1), 150); }
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

let totalAnswered = 0;
let totalStrikes = 0; // wrong + skipped count toward island damage
const STRIKE_LIMIT = 10; // more than half of 20 questions

let teamStats = [
  { correct: 0, wrong: 0, skipped: 0, pointsWon: 0 },
  { correct: 0, wrong: 0, skipped: 0, pointsWon: 0 },
  { correct: 0, wrong: 0, skipped: 0, pointsWon: 0 }
];
let costliestWrong = null; // { team, points, category, row }

let islandLost = false;
let bonusRoundActive = false;
let bonusTimerInterval = null;

/* ---------- SCOREBOARD ---------- */
function renderScoreboard() {
  document.getElementById('scoreboard').innerHTML = TEAMS.map((team, i) => `
    <div class="score-card ${i === currentTeam ? 'active' : ''}">
      <div class="team-name">${team}</div>
      <div class="team-score" style="color:${TEAM_COLORS[i]}">${scores[i]}</div>
      <span class="team-badge" style="background:${TEAM_COLORS[i]}22;color:${TEAM_COLORS[i]}">${i === currentTeam ? '▶ ' + t('onTheClock') : t('waiting')}</span>
    </div>
  `).join('');
  document.getElementById('turn-indicator').textContent = "🎯 " + TEAMS[currentTeam] + ", " + t('pickPrompt');
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

/* ---------- ISLAND / DAMAGE SYSTEM ---------- */
function renderDamage() {
  const pct = Math.min(100, (totalStrikes / STRIKE_LIMIT) * 100);
  document.getElementById('damageBarFill').style.width = pct + "%";

  const shape = document.getElementById('islandShape');
  const face = document.getElementById('islandFace');

  let statusKey = 'damageHealthy';
  let color = '#2bc492';
  let emoji = '🙂';

  if (totalStrikes >= STRIKE_LIMIT) {
    color = '#5c4a1a';
    emoji = '💀';
    statusKey = 'damageCritical';
  } else if (totalStrikes >= STRIKE_LIMIT * 0.6) {
    color = '#a36b2a';
    emoji = '😟';
    statusKey = 'damageCritical';
  } else if (totalStrikes >= STRIKE_LIMIT * 0.3) {
    color = '#6b8f3a';
    emoji = '😕';
    statusKey = 'damageDamaged';
  }

  shape.setAttribute('fill', color);
  face.textContent = emoji;
  document.getElementById('damageText').textContent =
    totalStrikes + " " + t('strikes') + " / " + STRIKE_LIMIT + " — " + t(statusKey);
}

function registerStrike() {
  totalStrikes++;
  playDamage();
  renderDamage();
  if (totalStrikes >= STRIKE_LIMIT && !islandLost && !bonusRoundActive) {
    islandLost = true;
    setTimeout(() => startBonusRound(), 600);
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
      const correctIdx = q.isTrick ? -1 : 0; // index 0 is always correct answer in our data unless isTrick
      if (q.isTrick) { cls += ' wrong'; }
      else if (i === 0) cls += ' correct';
      else if (i === chosenIdx && i !== 0) cls += ' wrong';
    }
    const handler = revealed ? 'disabled' : `onclick="answer(${i})"`;
    return `<button class="${cls}" ${handler}>${o}</button>`;
  }).join('');

  let resultHtml = '';
  let mascotHtml = '';
  if (revealed) {
    const isTrick = q.isTrick;
    const isCorrect = !isTrick && chosenIdx === 0;
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
          <button class="close-btn" onclick="closeModal(true, false)">${t('skip')}</button>
          <button class="award-btn" onclick="awardPoints()">${t('award')} ${pts} ${t('pts')}</button>
        </div>
      </div>
    ` : `<div class="modal-footer"><button class="close-btn" onclick="closeModal(false, false)">${t('cancel')}</button></div>`}
  `;
}

function answer(idx) {
  const { cat, row } = currentCell;
  const q = QUESTIONS_I18N[currentLang][cat][row];
  const wasCorrect = !q.isTrick && idx === 0;

  totalAnswered++;

  if (q.isTrick) {
    playTrick();
    teamStats[currentTeam].wrong++;
    registerStrike();
  } else if (wasCorrect) {
    playCorrect();
    teamStats[currentTeam].correct++;
  } else {
    playWrong();
    teamStats[currentTeam].wrong++;
    registerStrike();
    // track costliest wrong answer (highest point value missed)
    if (!costliestWrong || POINTS[row] > costliestWrong.points) {
      costliestWrong = { team: TEAMS[currentTeam], points: POINTS[row], category: CATEGORIES_I18N.en[cat].name, row: row };
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
  closeModal(true, true);
}

/* markUsed: always true now (bug fix). wasAwarded: whether points were given */
function closeModal(markUsed, wasAwarded) {
  if (currentCell) {
    // BUG FIX: question is consumed either way, even on skip
    used[currentCell.cat][currentCell.row] = true;
    if (!wasAwarded) {
      // it was a skip — count as skipped for whichever team was on the clock
      teamStats[currentTeam].skipped++;
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
  if (used.every(col => col.every(v => v)) && !bonusRoundActive) {
    if (islandLost) {
      // bonus round already handled the ending separately
      return;
    }
    endGame();
  }
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
  playAlarm();
  document.getElementById('overlay').style.display = 'none';
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

  document.getElementById('bonusModal').innerHTML = `
    <div class="bonus-header">
      <div class="bonus-title">⚠️ ${t('bonusTitle')} ⚠️</div>
      <div class="bonus-warning">${t('bonusWarning')}</div>
    </div>
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
  const correct = !q.isTrick && idx === 0;

  if (!correct) {
    bonusFail();
    return;
  }

  playCorrect();
  bonusIndex++;
  setTimeout(() => renderBonusQuestion(), 400);
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
    document.getElementById('bonusOverlay').style.display = 'none';
    endGame(true);
  }, 2500);
}

function bonusSuccess() {
  playVictory();
  document.getElementById('bonusModal').innerHTML = `
    <div class="bonus-header">
      <div class="bonus-title" style="color:#4ade80">🌴 ${t('bonusSuccess')}</div>
      <div class="bonus-warning" style="color:#bbf7d0">${t('bonusSuccessSub')}</div>
    </div>
  `;
  // restore island visually
  totalStrikes = Math.floor(STRIKE_LIMIT * 0.3);
  islandLost = false;
  renderDamage();
  setTimeout(() => {
    document.getElementById('bonusOverlay').style.display = 'none';
    bonusRoundActive = false;
    renderScoreboard();
    renderBoard();
    checkAllUsed();
  }, 2500);
}

/* ---------- END GAME / STATS ---------- */
function endGame(islandWasLost) {
  const max = Math.max(...scores);
  const winners = TEAMS.filter((_, i) => scores[i] === max);
  if (!islandWasLost) playVictory();

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
