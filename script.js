/* ============================================================
   SOUND ENGINE
============================================================ */
let soundOn = true;
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq, dur, type, vol) {
  if (!soundOn) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine'; osc.frequency.value = freq; gain.gain.value = vol || 0.15;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}
function playCorrect() { beep(523,0.12,'sine'); setTimeout(()=>beep(784,0.18,'sine'),110); }
function playWrong()   { beep(180,0.3,'sawtooth',0.12); }
function playClick()   { beep(660,0.06,'square',0.08); }
function playTrick()   { beep(440,0.1,'triangle'); setTimeout(()=>beep(330,0.1,'triangle'),100); setTimeout(()=>beep(440,0.15,'triangle'),200); }
function playDamage()  { beep(150,0.25,'sawtooth',0.18); setTimeout(()=>beep(100,0.3,'sawtooth',0.15),150); }
function playSiren() {
  if (!soundOn) return;
  let f=600, rising=true;
  const iv=setInterval(()=>{ beep(f,0.15,'sawtooth',0.1); f=rising?f+80:f-80; if(f>1000)rising=false; if(f<500)rising=true; },150);
  setTimeout(()=>clearInterval(iv),3000);
}
function playCountBeep() { beep(880,0.15,'square',0.15); }
function playVictory()   { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.2,'sine'),i*120)); }
function playLoss()      { [400,300,200,100].forEach((f,i)=>setTimeout(()=>beep(f,0.3,'sawtooth',0.15),i*150)); }
function toggleSound() {
  soundOn = !soundOn;
  document.getElementById('soundToggle').textContent = soundOn ? '🔊' : '🔇';
}

/* ============================================================
   CONFETTI
============================================================ */
function fireConfetti() {
  const colors = ['#ffd23f','#4ade80','#60a5fa','#fb923c','#f87171','#c084fc'];
  const layer = document.getElementById('confettiLayer');
  for (let i=0;i<70;i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random()*100+'vw';
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDuration = (2+Math.random()*2)+'s';
    p.style.animationDelay = (Math.random()*0.6)+'s';
    layer.appendChild(p);
    setTimeout(()=>p.remove(),4500);
  }
}

/* ============================================================
   LANGUAGE
============================================================ */
let currentLang = 'en';
function t(key) { return (I18N[currentLang]||{})[key] || (I18N.en||{})[key] || key; }

function setLanguagePre(lang) { currentLang = lang; }

function setLanguage(lang) {
  currentLang = lang;
  document.getElementById('langSelect').value = lang;
  document.getElementById('gameTitle').textContent  = t('title');
  document.getElementById('gameSub').textContent    = t('subtitle');
  document.getElementById('islandLabel').textContent = t('islandLabel');
  document.getElementById('mascotIntro').textContent = t('mascotIntro');
  renderHelp();
  renderScoreboard();
  renderBoard();
  renderDamage();
}

/* ============================================================
   GAME STATE
============================================================ */
const POINTS = [100,200,300,400,500];
const TEAMS  = ['Team 1','Team 2','Team 3'];
const TEAM_COLORS = ['#60a5fa','#34d399','#fb923c'];
const STRIKE_LIMIT = 10;
const QUESTION_SECS = 30;
const BONUS_Q_COUNT = 5;
const BONUS_SECS    = 15;

let gameMode = 'team';
let scores, used, currentTeam, currentCell, selectedTeamForAward;
let totalStrikes, teamStats, costliestWrong, islandLost, bonusRoundActive;
let soloScore, soloCorrect, soloWrong;
let questionTimerInterval = null;
let bonusTimerInterval    = null;
let bonusPool = [], bonusIndex = 0, bonusTimeLeft = 0;

function initGame() {
  scores = [0,0,0];
  used   = Array.from({length:4},()=>Array(5).fill(false));
  currentTeam = 0; currentCell = null; selectedTeamForAward = 0;
  totalStrikes = 0; islandLost = false; bonusRoundActive = false;
  soloScore = 0; soloCorrect = 0; soloWrong = 0;
  teamStats = [0,1,2].map(()=>({correct:0,wrong:0,skipped:0,pointsWon:0}));
  costliestWrong = null;
  document.getElementById('win-banner').innerHTML  = '';
  document.getElementById('statsScreen').innerHTML = '';
  renderHelp();
  renderScoreboard();
  renderBoard();
  renderDamage();
}

/* ============================================================
   MODE SELECT
============================================================ */
function startMode(mode) {
  gameMode = mode;
  currentLang = document.getElementById('langSelectMode').value;
  document.getElementById('langSelect').value = currentLang;
  document.getElementById('modeScreen').style.display = 'none';
  document.getElementById('wrap').style.display = 'block';
  document.getElementById('gameTitle').textContent  = t('title');
  document.getElementById('gameSub').textContent    = t('subtitle');
  document.getElementById('islandLabel').textContent = t('islandLabel');
  document.getElementById('mascotIntro').textContent = t('mascotIntro');
  initGame();
}

/* ============================================================
   HOW TO PLAY PANEL
============================================================ */
function toggleHelp() {
  const panel = document.getElementById('helpPanel');
  const btn   = document.getElementById('helpBtn');
  const open  = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function renderHelp() {
  const solo = gameMode === 'solo';
  document.getElementById('helpInner').innerHTML = `
    <h3>❓ How to Play</h3>
    <div class="help-grid">
      <div class="help-section">
        <strong>🎯 Objective</strong>
        ${solo
          ? 'Answer all 20 questions. Score points for correct answers and keep Pulau Semakau alive.'
          : '3 teams take turns. Host awards points. Most points at the end wins.'}
      </div>
      <div class="help-section">
        <strong>📋 Picking a question</strong>
        Click any point value on the board. Guess which of the two options generates more plastic waste.
      </div>
      <div class="help-section">
        <strong>🏝️ Island health</strong>
        Every wrong answer or skip adds a <em>strike</em>. At <strong>10 strikes</strong> the island is declared lost and a bonus round triggers.
      </div>
      <div class="help-section">
        <strong>⚠️ Bonus round</strong>
        5 random questions, 15 seconds each. Sudden death — one wrong answer ends it instantly.
      </div>
      ${solo ? `
      <div class="help-section">
        <strong>⏱️ No timer in solo mode</strong>
        Take your time. Points are awarded automatically for correct answers.
      </div>
      <div class="help-section">
        <strong>🧮 Scoring</strong>
        100 – 500 points per question depending on difficulty row.
      </div>` : `
      <div class="help-section">
        <strong>🏆 Awarding points</strong>
        After each reveal the host can award points to ANY team — useful for audience shout-outs.
      </div>
      <div class="help-section">
        <strong>⏭️ Skipping</strong>
        "Skip points" moves on without awarding. The question is still consumed — it will not return to the board.
      </div>`}
    </div>`;
}

/* ============================================================
   SCOREBOARD
============================================================ */
function renderScoreboard() {
  const sb = document.getElementById('scoreboard');
  const ti = document.getElementById('turn-indicator');

  if (gameMode === 'solo') {
    sb.innerHTML = `
      <div class="solo-score-bar">
        <div class="solo-score-label">Your score</div>
        <div class="solo-score-value" id="soloScoreDisplay">${soloScore}</div>
        <div class="solo-score-sub">${soloCorrect} correct · ${soloWrong} wrong · ${totalStrikes} / ${STRIKE_LIMIT} strikes</div>
      </div>`;
    ti.textContent = '🎯 ' + t('pickPrompt');
    return;
  }

  sb.innerHTML = TEAMS.map((team,i)=>`
    <div class="score-card ${i===currentTeam?'active':''}">
      <div class="team-name">${team}</div>
      <div class="team-score" id="score-${i}" style="color:${TEAM_COLORS[i]}">${scores[i]}</div>
      <span class="team-badge" style="background:${TEAM_COLORS[i]}22;color:${TEAM_COLORS[i]}">
        ${i===currentTeam?'▶ '+t('onTheClock'):t('waiting')}
      </span>
    </div>`).join('');
  ti.textContent = '🎯 '+TEAMS[currentTeam]+', '+t('pickPrompt');
}

function popScore(idx) {
  const el = document.getElementById('score-'+idx);
  if (!el) return;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

function updateSoloDisplay() {
  const el = document.getElementById('soloScoreDisplay');
  if (el) el.textContent = soloScore;
  const sub = el && el.parentElement.querySelector('.solo-score-sub');
  if (sub) sub.textContent = `${soloCorrect} correct · ${soloWrong} wrong · ${totalStrikes} / ${STRIKE_LIMIT} strikes`;
}

/* ============================================================
   BOARD — cells are real <button> elements (accessibility fix)
============================================================ */
function renderBoard() {
  const cats = CATEGORIES_I18N[currentLang] || CATEGORIES_I18N.en;
  let html = cats.map(c=>`
    <div class="cat-header" role="columnheader">
      <span class="cat-icon" aria-hidden="true">${c.icon}</span>
      <span class="cat-name">${c.name}</span>
    </div>`).join('');

  for (let r=0;r<5;r++) {
    for (let c=0;c<4;c++) {
      const cat = cats[c];
      if (used[c][r]) {
        html += `<button class="cell used" disabled aria-label="Already answered" aria-disabled="true">✓</button>`;
      } else {
        html += `<button class="cell" onclick="openQuestion(${c},${r})" aria-label="${cat.name}, ${POINTS[r]} ${t('points')}">${POINTS[r]}</button>`;
      }
    }
  }
  document.getElementById('board').innerHTML = html;
}

/* ============================================================
   ISLAND SVG — illustrated with decay stages + trash particles
============================================================ */
function getIslandSVG(stage) {
  const palettes = [
    {sea:'#1d6fa3',sand:'#e8d28a',grass:'#3fae6c',trunk:'#7a5230'},
    {sea:'#1d6fa3',sand:'#d9c279',grass:'#7a9c3f',trunk:'#6b4828'},
    {sea:'#3a6a82',sand:'#a98f5a',grass:'#8a7a3a',trunk:'#5a3f22'},
    {sea:'#48505a',sand:'#5c5346',grass:'#4a4030',trunk:'#3a2f20'}
  ];
  const p = palettes[stage];
  const palmOp  = stage>=3 ? 0.3 : 1;
  const leafCol = stage>=2 ? '#5a6b30' : '#2f8f4f';
  const face    = ['🙂','😕','😟','💀'][stage];
  return `
  <svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="150" cy="150" rx="148" ry="28" fill="${p.sea}" opacity="0.7"/>
    <ellipse cx="150" cy="138" rx="120" ry="30" fill="${p.sea}"/>
    <ellipse cx="150" cy="120" rx="105" ry="38" fill="${p.sand}"/>
    <ellipse cx="150" cy="108" rx="80"  ry="28" fill="${p.grass}"/>
    <g opacity="${palmOp}">
      <rect x="94" y="76" width="6" height="34" fill="${p.trunk}" rx="2"/>
      <path d="M97 78 Q78 64 62 70 Q80 74 97 84"   fill="${leafCol}"/>
      <path d="M97 78 Q116 60 132 67 Q113 75 97 84" fill="${leafCol}"/>
      <path d="M97 78 Q90 57 99 46 Q104 60 97 84"   fill="${stage>=2?'#4a5b25':'#249444'}"/>
    </g>
    <g opacity="${palmOp}">
      <rect x="199" y="83" width="5" height="28" fill="${p.trunk}" rx="2"/>
      <path d="M201 84 Q186 72 174 77 Q188 81 201 90" fill="${leafCol}"/>
      <path d="M201 84 Q216 70 229 76 Q213 83 201 90" fill="${leafCol}"/>
    </g>
    ${stage>=1?`<circle cx="118" cy="116" r="4" fill="#888" opacity="0.7"/>
      <rect x="158" y="120" width="9" height="5" fill="#aaa" opacity="0.6" rx="1"/>`:''}
    ${stage>=2?`<circle cx="138" cy="110" r="5" fill="#777" opacity="0.75"/>
      <rect x="98" y="123" width="11" height="6" fill="#999" opacity="0.6" rx="1" transform="rotate(15 103 126)"/>`:''}
    ${stage>=3?`<circle cx="174" cy="106" r="6" fill="#666" opacity="0.85"/>
      <rect x="128" y="98" width="13" height="7" fill="#888" opacity="0.7" rx="1" transform="rotate(-10 134 102)"/>
      <circle cx="155" cy="125" r="4" fill="#555" opacity="0.7"/>`:''}
    <text x="150" y="118" font-size="32" text-anchor="middle">${face}</text>
  </svg>`;
}

function renderDamage() {
  const pct = Math.min(100,(totalStrikes/STRIKE_LIMIT)*100);
  document.getElementById('damageBarFill').style.width = pct+'%';
  document.getElementById('damageBar').setAttribute('aria-valuenow', totalStrikes);

  let stage=0, statusKey='damageHealthy';
  if      (totalStrikes>=STRIKE_LIMIT)        { stage=3; statusKey='damageCritical'; }
  else if (totalStrikes>=STRIKE_LIMIT*0.6)    { stage=2; statusKey='damageCritical'; }
  else if (totalStrikes>=STRIKE_LIMIT*0.3)    { stage=1; statusKey='damageDamaged';  }

  document.getElementById('islandStage').innerHTML = getIslandSVG(stage);

  // singular / plural fix
  const strikeWord = totalStrikes===1 ? 'strike' : t('strikes');
  document.getElementById('damageText').textContent =
    `${totalStrikes} ${strikeWord} / ${STRIKE_LIMIT} — ${t(statusKey)}`;
}

function spawnTrashParticle() {
  const stage  = document.getElementById('islandStage');
  const emojis = ['🗑️','🥤','🛍️','🧴','📦'];
  const p = document.createElement('div');
  p.className  = 'trash-particle';
  p.textContent = emojis[Math.floor(Math.random()*emojis.length)];
  p.style.left  = (30+Math.random()*220)+'px';
  p.style.top   = '0px';
  p.style.animation = 'trashFall 1.2s ease forwards';
  stage.appendChild(p);
  setTimeout(()=>p.remove(), 1300);
}

function shakeIsland() {
  const el = document.getElementById('islandStage');
  el.classList.remove('island-shake'); void el.offsetWidth; el.classList.add('island-shake');
}

function reactMascot(happy) {
  const face = document.getElementById('mascotFace');
  face.classList.remove('react-happy','react-sad');
  void face.offsetWidth;
  face.classList.add(happy ? 'react-happy' : 'react-sad');
}

function registerStrike() {
  totalStrikes++;
  playDamage(); shakeIsland(); spawnTrashParticle(); spawnTrashParticle();
  renderDamage();
  if (gameMode==='solo') updateSoloDisplay();
  if (totalStrikes>=STRIKE_LIMIT && !islandLost && !bonusRoundActive) {
    islandLost = true;
    setTimeout(()=>beginBonusTransition(), 900);
  }
}

/* ============================================================
   QUESTION FLOW
============================================================ */
function openQuestion(cat, row) {
  if (used[cat][row]) return;
  playClick();
  currentCell = {cat, row};
  selectedTeamForAward = currentTeam;
  const q = (QUESTIONS_I18N[currentLang]||QUESTIONS_I18N.en)[cat][row];
  renderModal(q, POINTS[row], cat, false, null);
}

function renderModal(q, pts, cat, revealed, chosenIdx) {
  clearInterval(questionTimerInterval);
  document.getElementById('overlay').style.display = 'flex';
  const cats = CATEGORIES_I18N[currentLang] || CATEGORIES_I18N.en;

  // option buttons — color based on explicit q.correct index
  const optBtns = q.opts.map((o,i)=>{
    let cls = 'opt-btn';
    if (revealed) {
      if (i===q.correct) cls += ' correct';
      else if (i===chosenIdx) cls += ' wrong';
    }
    const handler = revealed ? 'disabled' : `onclick="answer(${i})"`;
    return `<button class="${cls}" ${handler} aria-label="Option ${i+1}: ${o}">${o}</button>`;
  }).join('');

  // visible timer bar — team mode, pre-answer only
  const timerHtml = (!revealed && gameMode==='team') ? `
    <div class="timer-row">
      <div class="timer-track"><div class="timer-fill" id="timerFill" style="width:100%"></div></div>
      <div class="timer-label" id="timerLabel">${QUESTION_SECS}s</div>
    </div>` : '';

  let resultHtml='', mascotHtml='';
  if (revealed) {
    const isTrick   = !!q.isTrick;
    const isCorrect = !isTrick && chosenIdx===q.correct;
    const cls   = isTrick?'trick':(isCorrect?'correct':'wrong');
    const label = isTrick?t('trickQuestion'):(isCorrect?t('correct'):t('notQuite'));
    resultHtml = `<div class="result-box ${cls}"><span class="fact-tag">${t('realFact')}</span><br><strong>${label}</strong> ${q.fact}</div>`;
    mascotHtml = `<div class="mascot-react"><div class="mface" aria-hidden="true">🗑️</div><div class="mtext">"${q.mascot}"</div></div>`;
  }

  const teamBtns = TEAMS.map((team,i)=>
    `<button class="team-btn ${selectedTeamForAward===i?'selected':''}" onclick="selectAwardTeam(${i})" id="atb-${i}">${team}</button>`
  ).join('');

  const footerHtml = revealed
    ? (gameMode==='team'
        ? `<div style="font-size:13px;color:#9fd8c4;margin-bottom:8px">${t('awardTo')}</div>
           <div class="modal-footer">
             <div class="team-select">${teamBtns}</div>
             <div style="display:flex;gap:8px;margin-top:8px">
               <button class="close-btn" onclick="closeModal(false)">${t('skip')}</button>
               <button class="award-btn" onclick="awardPoints()">${t('award')} ${pts} ${t('pts')}</button>
             </div>
           </div>`
        : `<div class="modal-footer" style="justify-content:center">
             <button class="award-btn" onclick="closeModal(true)">Next ➡</button>
           </div>`)
    : `<div class="modal-footer"><button class="close-btn" onclick="cancelQuestion()">${t('cancel')}</button></div>`;

  document.getElementById('modal').innerHTML = `
    <div class="modal-tag">${cats[cat].icon} ${cats[cat].name}</div>
    <div class="modal-pts">${pts} ${t('points')}</div>
    ${timerHtml}
    <div class="modal-question" id="modalQuestion">${q.q}</div>
    <div class="options">${optBtns}</div>
    ${mascotHtml}${resultHtml}${footerHtml}`;

  // start visible countdown (team mode only, before answer)
  if (!revealed && gameMode==='team') {
    let remaining = QUESTION_SECS;
    questionTimerInterval = setInterval(()=>{
      remaining--;
      const fill  = document.getElementById('timerFill');
      const label = document.getElementById('timerLabel');
      if (!fill) { clearInterval(questionTimerInterval); return; }
      fill.style.width = (remaining/QUESTION_SECS*100)+'%';
      label.textContent = remaining+'s';
      if (remaining<=10) { fill.classList.add('warn');   label.classList.add('warn');   }
      if (remaining<=5)  { fill.classList.replace('warn','danger'); label.classList.replace('warn','danger'); }
      if (remaining<=0) {
        clearInterval(questionTimerInterval);
        // timed out — auto-skip and register a strike
        used[currentCell.cat][currentCell.row] = true;
        teamStats[currentTeam].skipped++;
        registerStrike();
        currentTeam = (currentTeam+1)%3;
        document.getElementById('overlay').style.display = 'none';
        renderScoreboard(); renderBoard(); renderDamage();
        checkAllUsed();
      }
    },1000);
  }
}

function cancelQuestion() {
  clearInterval(questionTimerInterval);
  document.getElementById('overlay').style.display = 'none';
  currentCell = null;
}

function answer(idx) {
  clearInterval(questionTimerInterval);
  const {cat,row} = currentCell;
  const q = (QUESTIONS_I18N[currentLang]||QUESTIONS_I18N.en)[cat][row];
  const isTrick   = !!q.isTrick;
  // CORRECT ANSWER CHECK — uses explicit q.correct field, not positional assumption
  const wasCorrect = !isTrick && idx===q.correct;

  if (gameMode==='solo') {
    if (wasCorrect) {
      playCorrect(); reactMascot(true);
      soloScore += POINTS[row]; soloCorrect++;
      updateSoloDisplay();
    } else {
      isTrick ? playTrick() : playWrong();
      reactMascot(false); soloWrong++; registerStrike();
      if (!costliestWrong||POINTS[row]>costliestWrong.points)
        costliestWrong = {team:'You', points:POINTS[row], category:(CATEGORIES_I18N.en||[])[cat]?.name||''};
    }
  } else {
    if (isTrick) {
      playTrick(); reactMascot(false);
      teamStats[currentTeam].wrong++; registerStrike();
    } else if (wasCorrect) {
      playCorrect(); reactMascot(true);
      teamStats[currentTeam].correct++;
    } else {
      playWrong(); reactMascot(false);
      teamStats[currentTeam].wrong++; registerStrike();
      if (!costliestWrong||POINTS[row]>costliestWrong.points)
        costliestWrong = {team:TEAMS[currentTeam], points:POINTS[row], category:(CATEGORIES_I18N.en||[])[cat]?.name||''};
    }
  }
  renderModal(q, POINTS[row], cat, true, idx);
}

function selectAwardTeam(i) {
  selectedTeamForAward = i;
  TEAMS.forEach((_,idx)=>{
    const btn = document.getElementById('atb-'+idx);
    if (btn) btn.className = 'team-btn'+(idx===i?' selected':'');
  });
}

function awardPoints() {
  const {cat,row} = currentCell;
  scores[selectedTeamForAward] += POINTS[row];
  teamStats[selectedTeamForAward].pointsWon += POINTS[row];
  playClick(); popScore(selectedTeamForAward);
  closeModal(true);
}

// BUG FIX — question is ALWAYS consumed, whether awarded or skipped
function closeModal(wasAwarded) {
  clearInterval(questionTimerInterval);
  if (currentCell) {
    used[currentCell.cat][currentCell.row] = true;
    if (gameMode==='team' && !wasAwarded) teamStats[currentTeam].skipped++;
  }
  currentTeam = (currentTeam+1)%3;
  document.getElementById('overlay').style.display = 'none';
  renderScoreboard(); renderBoard(); renderDamage();
  checkAllUsed();
}

function checkAllUsed() {
  if (used.every(col=>col.every(v=>v)) && !bonusRoundActive && !islandLost) endGame(false);
}

/* ============================================================
   BONUS TRANSITION — 3 full stages
   Stage 1: freeze-frame on last question reveal
   Stage 2: flashing alarm overlay with siren + 3-2-1 countdown
   Stage 3: bonus round modal
============================================================ */
function beginBonusTransition() {
  clearInterval(questionTimerInterval);
  document.getElementById('overlay').style.display = 'none';

  // STAGE 1 — freeze
  const freeze = document.getElementById('freezeOverlay');
  document.getElementById('freezeText').textContent = t('freezeText');
  freeze.style.display = 'flex';
  playDamage();

  setTimeout(()=>{
    freeze.style.display = 'none';
    startAlarmSequence();
  }, 1400);
}

function startAlarmSequence() {
  const alarm   = document.getElementById('alarmOverlay');
  const content = document.getElementById('alarmContent');
  alarm.style.display = 'flex';
  playSiren();
  content.innerHTML = `<div class="alarm-title">🚨 ${t('alarmTitle')} 🚨</div>`;

  let count = 3;
  function tick() {
    content.innerHTML = `<div class="alarm-title">🚨 ${t('alarmTitle')} 🚨</div><div class="alarm-count">${count}</div>`;
    playCountBeep(); count--;
    if (count>=0) setTimeout(tick,1000);
    else setTimeout(()=>{ alarm.style.display='none'; startBonusRound(); },700);
  }
  setTimeout(tick, 600);
}

/* ============================================================
   BONUS ROUND
============================================================ */
function shuffle(arr) {
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function startBonusRound() {
  bonusRoundActive = true;
  bonusPool = shuffle(
    Array.from({length:4},(_,c)=>Array.from({length:5},(_,r)=>({cat:c,row:r}))).flat()
  ).slice(0,BONUS_Q_COUNT);
  bonusIndex = 0;
  document.getElementById('bonusOverlay').style.display = 'flex';
  renderBonusQuestion();
}

function renderBonusQuestion() {
  if (bonusIndex>=bonusPool.length) { bonusSuccess(); return; }
  const {cat,row} = bonusPool[bonusIndex];
  const q    = (QUESTIONS_I18N[currentLang]||QUESTIONS_I18N.en)[cat][row];
  const cats = CATEGORIES_I18N[currentLang] || CATEGORIES_I18N.en;
  bonusTimeLeft = BONUS_SECS;

  const optBtns = q.opts.map((o,i)=>
    `<button class="bonus-opt-btn" onclick="bonusAnswer(${i})" aria-label="Option: ${o}">${o}</button>`
  ).join('');

  const dots = bonusPool.map((_,i)=>{
    let cls = 'bonus-dot';
    if (i<bonusIndex) cls+=' done';
    else if (i===bonusIndex) cls+=' current';
    return `<div class="${cls}"></div>`;
  }).join('');

  document.getElementById('bonusModal').innerHTML = `
    <div class="bonus-header">
      <div class="bonus-title">⚠️ ${t('bonusTitle')} ⚠️</div>
      <div class="bonus-warning">${t('bonusWarning')}</div>
    </div>
    <div class="bonus-progress">${dots}</div>
    <div class="modal-tag">${cats[cat].icon} ${cats[cat].name} — ${bonusIndex+1} / ${bonusPool.length}</div>
    <div class="bonus-timer" id="bonusTimer">${bonusTimeLeft}</div>
    <div class="modal-question">${q.q}</div>
    <div class="options">${optBtns}</div>`;

  if (bonusTimerInterval) clearInterval(bonusTimerInterval);
  bonusTimerInterval = setInterval(()=>{
    bonusTimeLeft--;
    const el = document.getElementById('bonusTimer');
    if (el) { el.textContent=bonusTimeLeft; if (bonusTimeLeft<=5) el.classList.add('danger'); }
    if (bonusTimeLeft<=0) { clearInterval(bonusTimerInterval); bonusFail(); }
  },1000);
}

function bonusAnswer(idx) {
  clearInterval(bonusTimerInterval);
  const {cat,row} = bonusPool[bonusIndex];
  const q = (QUESTIONS_I18N[currentLang]||QUESTIONS_I18N.en)[cat][row];
  if (q.isTrick || idx!==q.correct) { bonusFail(); return; }
  playCorrect(); bonusIndex++;
  setTimeout(()=>renderBonusQuestion(), 500);
}

function bonusFail() {
  clearInterval(bonusTimerInterval); playLoss();
  document.getElementById('bonusModal').innerHTML = `
    <div class="bonus-header"><div class="bonus-title">💀 ${t('bonusTimeUp')}</div></div>
    <div class="result-box wrong" style="margin-top:1rem">${t('bonusFail')}</div>
    <div class="btn-row"><button class="restart-btn" onclick="location.reload()">${t('restart')}</button></div>`;
  setTimeout(()=>endGame(true), 2500);
}

function bonusSuccess() {
  playVictory(); fireConfetti();
  document.getElementById('bonusModal').innerHTML = `
    <div class="bonus-header">
      <div class="bonus-title" style="color:#4ade80">🌴 ${t('bonusSuccess')}</div>
      <div class="bonus-warning" style="color:#bbf7d0">${t('bonusSuccessSub')}</div>
    </div>`;
  totalStrikes = Math.floor(STRIKE_LIMIT*0.3);
  islandLost = false; renderDamage();
  setTimeout(()=>{
    document.getElementById('bonusOverlay').style.display = 'none';
    bonusRoundActive = false;
    renderScoreboard(); renderBoard(); checkAllUsed();
  },2800);
}

/* ============================================================
   END GAME
============================================================ */
function endGame(islandWasLost) {
  clearInterval(questionTimerInterval);
  clearInterval(bonusTimerInterval);
  if (!islandWasLost) { playVictory(); fireConfetti(); }

  if (gameMode==='solo') {
    const acc = soloCorrect+soloWrong>0 ? Math.round(soloCorrect/(soloCorrect+soloWrong)*100) : 0;
    document.getElementById('win-banner').innerHTML = `
      <div class="${islandWasLost?'loss-banner':'win-banner'}">
        ${islandWasLost?'💀 Island lost!':'🏆 Challenge complete!'}
        <br><span style="font-size:16px">Score: ${soloScore} pts · Accuracy: ${acc}%</span>
        <br><span style="font-size:13px;opacity:0.8">${t('finalLine')}</span>
        <div class="btn-row"><button class="restart-btn" onclick="showStats()">${t('viewStats')}</button></div>
      </div>`;
    return;
  }

  const max     = Math.max(...scores);
  const winners = TEAMS.filter((_,i)=>scores[i]===max);

  if (islandWasLost) {
    // FIX — separate loss banner, not a win message
    document.getElementById('win-banner').innerHTML = `
      <div class="loss-banner">
        💀 Island lost — game over!<br>
        <span style="font-size:16px">${winners.join(' & ')} ${winners.length>1?'were':'was'} leading with ${max} ${t('pts')}</span><br>
        <span style="font-size:13px;opacity:0.8">${t('finalLine')}</span>
        <div class="btn-row"><button class="restart-btn" onclick="showStats()">${t('viewStats')}</button></div>
      </div>`;
  } else {
    document.getElementById('win-banner').innerHTML = `
      <div class="win-banner">
        🏆 ${t('gameOver')}<br>
        ${winners.join(' & ')} ${winners.length>1?t('winsWithPlural'):t('winsWith')} ${max} ${t('pts')}!<br>
        <span style="font-size:13px;color:#9fd8c4;font-weight:400">${t('finalLine')}</span>
        <div class="btn-row"><button class="restart-btn" onclick="showStats()">${t('viewStats')}</button></div>
      </div>`;
  }
}

/* ============================================================
   STATS SCREEN
============================================================ */
function showStats() {
  const max    = Math.max(...scores);
  const mvpIdx = scores.indexOf(max);
  let totalC=0, totalW=0, totalS=0;
  teamStats.forEach(s=>{ totalC+=s.correct; totalW+=s.wrong; totalS+=s.skipped; });
  const costliestText = costliestWrong
    ? `${costliestWrong.team} — ${costliestWrong.points} ${t('pts')} (${costliestWrong.category})`
    : '—';

  let innerHtml = '';
  if (gameMode==='solo') {
    const acc = soloCorrect+soloWrong>0?Math.round(soloCorrect/(soloCorrect+soloWrong)*100):0;
    innerHtml = `
      <div class="stats-grid" style="grid-template-columns:1fr">
        <div class="stat-team-card winner">
          <div class="stat-team-name" style="color:#ffd23f">Your results</div>
          <div class="stat-row"><span>Final score</span><span>${soloScore}</span></div>
          <div class="stat-row"><span>${t('teamAccuracy')}</span><span>${acc}%</span></div>
          <div class="stat-row"><span>${t('teamCorrect')}</span><span>${soloCorrect}</span></div>
          <div class="stat-row"><span>${t('teamWrong')}</span><span>${soloWrong}</span></div>
          <div class="stat-row"><span>${t('islandStatus')}</span><span>${islandLost?t('lost'):t('saved')}</span></div>
          <div class="stat-row"><span>${t('costliest')}</span><span>${costliestText}</span></div>
        </div>
      </div>`;
  } else {
    const teamCardsHtml = TEAMS.map((team,i)=>{
      const s   = teamStats[i];
      const att = s.correct+s.wrong;
      const acc = att>0?Math.round(s.correct/att*100):0;
      return `
        <div class="stat-team-card ${i===mvpIdx?'winner':''}">
          <div class="stat-team-name" style="color:${TEAM_COLORS[i]}">${team} ${i===mvpIdx?'👑':''}</div>
          <div class="stat-row"><span>${t('teamAccuracy')}</span><span>${acc}%</span></div>
          <div class="stat-row"><span>${t('teamCorrect')}</span><span>${s.correct}</span></div>
          <div class="stat-row"><span>${t('teamWrong')}</span><span>${s.wrong}</span></div>
          <div class="stat-row"><span>${t('teamSkipped')}</span><span>${s.skipped}</span></div>
          <div class="stat-row"><span>${t('points')}</span><span>${scores[i]}</span></div>
        </div>`;
    }).join('');
    innerHtml = `
      <div class="mvp-banner">🏆 ${t('mvp')}: ${TEAMS[mvpIdx]}</div>
      <div class="stats-grid">${teamCardsHtml}</div>
      <div class="overall-stats">
        <div class="row"><span>${t('totalQuestions')}</span><span>20</span></div>
        <div class="row"><span>${t('totalCorrect')}</span><span>${totalC}</span></div>
        <div class="row"><span>${t('totalWrong')}</span><span>${totalW}</span></div>
        <div class="row"><span>${t('totalSkipped')}</span><span>${totalS}</span></div>
        <div class="row"><span>${t('islandStatus')}</span><span>${islandLost?t('lost'):t('saved')}</span></div>
        <div class="row"><span>${t('costliest')}</span><span>${costliestText}</span></div>
      </div>`;
  }

  document.getElementById('statsScreen').innerHTML = `
    <div class="stats-screen">
      <div class="stats-title">📊 ${t('statsTitle')}</div>
      ${innerHtml}
      <div class="btn-row"><button class="restart-btn" onclick="location.reload()">${t('restart')}</button></div>
    </div>`;
  document.getElementById('statsScreen').scrollIntoView({behavior:'smooth'});
}
