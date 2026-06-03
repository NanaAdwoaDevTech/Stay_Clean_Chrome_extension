'use strict';
// ── StayClean · Popup JS (patched) ────────────────────────────────────────
// Privacy: zero network calls, zero analytics, zero tracking.
// All state lives in chrome.storage.local on the user's own device only.

const AVATARS = ['🏆','🔥','💪','🧠','🌟','🦁','🚀','🌈','🎯','⚡','🦅','🍀','🏋️','🎮','🌙','👑'];

const QUICK = [
  { l:'🔞 pornhub.com',    u:'pornhub.com'    },
  { l:'🔞 xvideos.com',    u:'xvideos.com'    },
  { l:'🔞 xhamster.com',   u:'xhamster.com'   },
  { l:'🔞 onlyfans.com',   u:'onlyfans.com'   },
  { l:'🍺 drizly.com',     u:'drizly.com'     },
  { l:'🍷 totalwine.com',  u:'totalwine.com'  },
  { l:'🎰 bet365.com',     u:'bet365.com'     },
  { l:'🎰 draftkings.com', u:'draftkings.com' },
  { l:'📱 tiktok.com',     u:'tiktok.com'     },
  { l:'🐦 twitter.com',    u:'twitter.com'    },
  { l:'📸 instagram.com',  u:'instagram.com'  },
];

const ACHIEVEMENTS = [
  { id:'first_win',    icon:'🌱', name:'First Win',        desc:'Complete your first clean session'               },
  { id:'ten_sessions', icon:'🔥', name:'On Fire',          desc:'10 total clean sessions'                         },
  { id:'hour_clean',   icon:'⏰', name:'Clock Watcher',    desc:'60 total clean minutes'                          },
  { id:'streak3',      icon:'📅', name:'3-Day Warrior',    desc:'3-day streak'                                    },
  { id:'streak7',      icon:'🗓️', name:'Week Strong',      desc:'7-day streak'                                    },
  { id:'level5',       icon:'⭐', name:'Halfway There',    desc:'Reach level 5'                                   },
  { id:'level10',      icon:'👑', name:'Legend Level',     desc:'Reach level 10'                                  },
  { id:'pts500',       icon:'💎', name:'Diamond Hands',    desc:'500 total points'                                },
  { id:'ironclad',     icon:'🛡️', name:'Ironclad',         desc:'24 continuous slip-free hours (1+ URL blocked)'  },
  { id:'resist10',     icon:'💪', name:'Temptation Proof', desc:'10 blocked-site attempts in one session'         },
  { id:'one_year',     icon:'🌅', name:'1 Year Clean',     desc:'146,000 pts — 1 full year equivalent'            },
  { id:'two_years',    icon:'🌠', name:'2 Years Clean',    desc:'292,000 pts — 2 full years equivalent'           },
  { id:'three_years',  icon:'♾️', name:'Completely Free',  desc:'438,000 pts — 3 years. You did it!'              },
];

// Populated from background on each pull
let S        = {};
let QUOTES   = [];
let RANKS    = [];
let LEVEL_XP = [0, 310, 1634, 4325, 8626, 14737, 22827, 33046, 45531, 60405, 77784, 97776, 120482, 146000];
let THREE_YR = 438000;

let selAv      = '🏆';
let dashTimer  = null;
let toastTimer = null;
const DAY_MS   = 24 * 60 * 60 * 1000;

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await pull();
  buildAvatars();
  buildQuickChips();
  bindAll();

  if (!S.username) {
    show('scSetup');
  } else if ((S.totalPoints || 0) >= THREE_YR && !S.celebrationSeen) {
    showCelebration();
  } else {
    show('scMain');
    renderAll();
    dashTimer = setInterval(softPull, 5000);
  }
});

// ── Comms ─────────────────────────────────────────────────────────────────
function pull() {
  return new Promise(r => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, res => {
      if (!res) { r(); return; }
      if (res.s)        S        = res.s;
      if (res.quotes)   QUOTES   = res.quotes;
      if (res.ranks)    RANKS    = res.ranks;
      if (res.levelXp)  LEVEL_XP = res.levelXp;
      if (res.threeYrPts) THREE_YR = res.threeYrPts;
      r();
    });
  });
}
function push() { return new Promise(r => chrome.runtime.sendMessage({ type: 'SET_STATE', s: S }, r)); }
async function softPull() {
  await pull();
  if ((S.totalPoints || 0) >= THREE_YR && !S.celebrationSeen) { showCelebration(); return; }
  renderDash();
}

// ── Screen helper ─────────────────────────────────────────────────────────
function show(id) {
  ['scSetup','scMain','scCelebration'].forEach(s => { const e = g(s); if (e) e.classList.add('hidden'); });
  const t = g(id); if (t) t.classList.remove('hidden');
}

// ── Bind everything ───────────────────────────────────────────────────────
function bindAll() {
  g('suBtn').addEventListener('click', doSetup);
  g('suName').addEventListener('keydown', e => { if (e.key === 'Enter') doSetup(); });
  g('logoutBtn').addEventListener('click', doLogout);
  g('settLogout').addEventListener('click', doLogout);
  g('addUrlBtn').addEventListener('click', addUrl);
  g('urlInp').addEventListener('keydown', e => { if (e.key === 'Enter') addUrl(); });
  g('notifToggle').addEventListener('change', saveNotifPref);
  g('celContinueBtn').addEventListener('click', dismissCelebration);
  document.querySelector('.tabbar').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (t) switchTab(t.dataset.panel, t);
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────
function buildAvatars() {
  const row = g('avRow'); row.innerHTML = '';
  AVATARS.forEach(em => {
    const b = document.createElement('button');
    b.className = 'av-btn' + (em === selAv ? ' sel' : '');
    b.textContent = em; b.type = 'button';
    b.addEventListener('click', () => { selAv = em; buildAvatars(); });
    row.appendChild(b);
  });
}

async function doSetup() {
  const name = g('suName').value.trim();
  if (!name) { toast('Please enter a username!'); return; }
  S.username = name; S.avatar = selAv;
  S.achievements = []; S.blockedUrls = []; S.activity = [];
  S.notificationsEnabled = true; S.slipFreeStart = Date.now(); S.celebrationSeen = false;
  await push();
  show('scMain'); renderAll();
  if (!dashTimer) dashTimer = setInterval(softPull, 5000);
}

// ── Logout — GDPR Art. 17 Right to Erasure ────────────────────────────────
function doLogout() {
  if (!confirm('Log out?\n\nThis permanently and completely deletes all your StayClean data from this device. It cannot be undone.')) return;
  chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => window.location.reload());
}

// ── Celebration ───────────────────────────────────────────────────────────
function showCelebration() {
  show('scCelebration');
  spawnStars();
}

function spawnStars() {
  const c = g('celStars'); if (!c) return;
  c.innerHTML = '';
  const EMOJIS = ['⭐','✨','🎉','🎊','💫','🌟','♾️','🏆','💎','🔥','🌈','🌅'];
  for (let i = 0; i < 32; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = 11 + Math.random() * 16;
    s.style.cssText = `left:${Math.random()*100}%;top:-${size+5}px;font-size:${size}px;`
      + `animation-duration:${3.5 + Math.random()*4}s;animation-delay:${Math.random()*5}s;`;
    s.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    c.appendChild(s);
  }
}

async function dismissCelebration() {
  chrome.runtime.sendMessage({ type: 'MARK_CEL_SEEN' }, async () => {
    S.celebrationSeen = true;
    show('scMain'); renderAll();
    if (!dashTimer) dashTimer = setInterval(softPull, 5000);
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.panel').forEach(p => { p.classList.remove('show'); p.classList.add('hidden'); });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = g('panel-' + name);
  if (panel) { panel.classList.remove('hidden'); panel.classList.add('show'); }
  if (btn) btn.classList.add('active');
  if (name === 'rank')         renderRank();
  if (name === 'achievements') renderAch();
  if (name === 'settings')     renderSettings();
}

function renderAll() { renderDash(); renderBlockList(); renderRank(); renderAch(); renderSettings(); }

// ── Dashboard ─────────────────────────────────────────────────────────────
function renderDash() {
  if (!S) return;
  const pts    = S.totalPoints  || 0;
  const sPts   = S.streakPoints || 0;
  const lvl    = S.level        || 1;
  const streak = S.streak       || 0;
  const rank   = getRank(pts);

  setText('tbAv',   S.avatar || '🏆');
  setText('tbName', S.username || 'Champion');
  setText('tbRank', rank.icon + ' ' + rank.title);
  setText('heroPts', pts.toLocaleString());

  // XP bar (streak points — resets on break)
  const li   = Math.min(lvl - 1, LEVEL_XP.length - 1);
  const curr = LEVEL_XP[li] || 0;
  const next = LEVEL_XP[Math.min(lvl, LEVEL_XP.length - 1)] || curr + 500;
  const pct  = next > curr ? Math.min(100, Math.round((sPts - curr) / (next - curr) * 100)) : 100;
  setText('xpLbl',  'Lv ' + lvl);
  setText('xpNext', (sPts - curr).toLocaleString() + '/' + (next - curr).toLocaleString());
  setText('heroSub', pct >= 100 ? '🎉 Level up!' : (100 - pct) + '% to Lv ' + (lvl + 1));
  setW('xpFill', pct);

  const sn = g('streakNote');
  if (sn) { streak > 0 ? sn.classList.remove('hidden') : sn.classList.add('hidden'); }

  // 5-min window bar
  const ws = S.windowStart;
  if (ws) {
    const el  = Date.now() - ws;
    const wp  = Math.min(100, Math.round(el / (5 * 60 * 1000) * 100));
    const rem = Math.max(0, Math.ceil((5 * 60 * 1000 - el) / 1000));
    const m = Math.floor(rem / 60), sc = rem % 60;
    setW('winFill', wp);
    setText('winPct', wp + '%');
    setText('winSub', wp >= 100 ? '✅ Complete!' : m + 'm ' + sc + 's → +' + Math.round(10 * (1 + streak * 0.1)) + ' pts');
  } else {
    setW('winFill', 0); setText('winPct', '0%');
    setText('winSub', 'Browse any non-blocked site to start');
  }

  // 24-hr clean day bar
  const cdCard  = g('cleanDayCard');
  const urls    = S.blockedUrls || [];
  const slips   = S.todaySlips  || 0;
  const sfStart = S.slipFreeStart;
  if (!urls.length) {
    cdCard.className = 'clean-day-card';
    setW('cdFill', 0); setText('cdSub', 'Add at least 1 blocked URL to begin');
  } else if (slips > 0) {
    cdCard.className = 'clean-day-card';
    setW('cdFill', 0); setText('cdSub', '⚠️ Slip recorded — 24-hr clock restarted');
  } else if (sfStart) {
    const elapsed = Date.now() - sfStart;
    const cdPct   = Math.min(100, Math.round(elapsed / DAY_MS * 100));
    const cdRem   = Math.max(0, Math.ceil((DAY_MS - elapsed) / 1000));
    const ch = Math.floor(cdRem / 3600), cm = Math.floor((cdRem % 3600) / 60);
    if (cdPct >= 100) {
      cdCard.className = 'clean-day-card done';
      setW('cdFill', 100); setText('cdSub', '🏆 Clean day complete! Streak increments next tick');
    } else {
      cdCard.className = 'clean-day-card active';
      setW('cdFill', cdPct); setText('cdSub', ch + 'h ' + cm + 'm remaining — ' + cdPct + '% complete');
    }
  } else {
    cdCard.className = 'clean-day-card';
    setW('cdFill', 0); setText('cdSub', 'Tracking started…');
  }

  setText('stSess',  S.todaySessions  || 0);
  setText('stStrk',  streak);
  setText('stMins',  S.totalCleanMins || 0);
  setText('stSlips', slips);

  if (QUOTES.length && S.quoteIdx !== undefined) setText('quoteBox', '"' + QUOTES[S.quoteIdx] + '"');

  // Activity — last 5
  const feed = g('actFeed');
  const acts = (S.activity || []).slice(0, 5);
  if (!acts.length) { feed.innerHTML = '<div class="feed-empty">💤 No activity yet — stay clean to earn points!</div>'; return; }
  feed.innerHTML = '';
  acts.forEach(a => {
    const d = document.createElement('div'); d.className = 'fi';
    if (a.type === 'pts') {
      const sk = a.streak > 0 ? ' 🔥' + a.streak + 'd' : '';
      d.innerHTML = '<span class="fi-ico">✅</span><span class="fi-txt"><b>+' + a.pts + ' pts</b> — 5 min clean' + sk + '</span><span class="fi-ago">' + ago(a.t) + '</span>';
    } else {
      d.innerHTML = '<span class="fi-ico">⚠️</span><span class="fi-txt">Blocked: <b>' + host(a.url) + '</b></span><span class="fi-ago">' + ago(a.t) + '</span>';
    }
    feed.appendChild(d);
  });
}

// ── Block list ────────────────────────────────────────────────────────────
function buildQuickChips() {
  const row = g('quickChips'); row.innerHTML = '';
  QUICK.forEach(q => {
    const s = document.createElement('span');
    s.className = 'chip'; s.textContent = q.l;
    s.addEventListener('click', () => quickBlock(q.u));
    row.appendChild(s);
  });
}

function renderBlockList() {
  const urls = S.blockedUrls || [];
  setText('urlCnt', urls.length);
  const list = g('urlList'); list.innerHTML = '';
  if (!urls.length) { list.innerHTML = '<div class="list-empty">No sites blocked yet. Add one above.</div>'; return; }
  urls.forEach(entry => {
    const u = entry.url || entry, at = entry.addedAt;
    const row = document.createElement('div'); row.className = 'url-item';
    const info = document.createElement('div'); info.className = 'url-info';
    const lbl = document.createElement('div'); lbl.className = 'url-txt'; lbl.textContent = '🚫 ' + u;
    info.appendChild(lbl);
    if (at) { const age = document.createElement('div'); age.className = 'url-age'; age.textContent = 'Added ' + ago(at); info.appendChild(age); }
    const del = document.createElement('button'); del.className = 'url-del'; del.textContent = '✕'; del.type = 'button';
    del.title = 'Remove — breaks streak & counts as a visit';
    del.addEventListener('click', () => removeUrl(u));
    row.appendChild(info); row.appendChild(del); list.appendChild(row);
  });
}

async function addUrl() {
  let v = g('urlInp').value.trim().toLowerCase();
  if (!v) return;
  v = v.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  if (!v) { toast('Enter a valid domain'); return; }
  if ((S.blockedUrls || []).some(e => (e.url || e) === v)) { toast('Already blocked!'); return; }
  chrome.runtime.sendMessage({ type: 'ADD_URL', url: v }, async () => {
    g('urlInp').value = ''; await pull(); renderDash(); renderBlockList(); toast('🚫 ' + v + ' blocked!');
  });
}

async function quickBlock(u) {
  const c = u.replace(/^www\./, '');
  if ((S.blockedUrls || []).some(e => (e.url || e) === c)) { toast('Already blocked!'); return; }
  chrome.runtime.sendMessage({ type: 'ADD_URL', url: c }, async () => {
    await pull(); renderDash(); renderBlockList(); toast('🚫 ' + c + ' blocked!');
  });
}

async function removeUrl(u) {
  if (!confirm('Remove "' + u + '"?\n\nThis counts as visiting it — your streak breaks and level resets to 1.')) return;
  chrome.runtime.sendMessage({ type: 'REMOVE_URL', url: u }, async () => {
    await pull(); renderAll(); toast('⚠️ Removed — streak broken!');
  });
}

// ── Rank panel ────────────────────────────────────────────────────────────
function renderRank() {
  if (!RANKS.length) return;
  const pts     = S.totalPoints || 0;
  const current = getRank(pts);
  const nextR   = RANKS.find(r => r.min > pts);
  const nextTxt = nextR
    ? (nextR.min - pts).toLocaleString() + ' pts to ' + nextR.icon + ' ' + nextR.title
    : '♾️ You have reached the highest rank!';

  g('rankHero').innerHTML =
    '<div class="rh-icon">'  + current.icon  + '</div>' +
    '<div class="rh-title">' + current.title + '</div>' +
    '<div class="rh-pts">'   + pts.toLocaleString() + ' total points</div>' +
    '<div class="rh-next">'  + nextTxt + '</div>';

  const ladder = g('rankLadder'); ladder.innerHTML = '';
  RANKS.forEach(r => {
    const isCurr    = r.title === current.title;
    const isDone    = pts >= r.min && !isCurr;
    const isSpecial = r.min >= 438000;
    const row = document.createElement('div');
    row.className = 'rl-item' + (isCurr ? ' current' : '') + (isDone ? ' done' : '') + (isSpecial ? ' special' : '');

    const info = document.createElement('div'); info.className = 'rl-info';
    const title = document.createElement('div'); title.className = 'rl-title'; title.textContent = r.icon + ' ' + r.title;
    const hint  = document.createElement('div'); hint.className  = 'rl-hint';  hint.textContent  = r.hint || '';
    info.appendChild(title); info.appendChild(hint);

    let badge;
    if (isCurr) {
      badge = document.createElement('span'); badge.className = 'rl-badge'; badge.textContent = 'YOU';
    } else if (isDone) {
      badge = document.createElement('span'); badge.textContent = '✅'; badge.style.fontSize = '1rem';
    } else {
      badge = document.createElement('span');
      badge.className = 'rl-badge' + (isSpecial ? ' gold' : '');
      badge.textContent = r.min.toLocaleString() + ' pts';
    }

    row.appendChild(info); row.appendChild(badge); ladder.appendChild(row);
  });
}

function getRank(pts) {
  if (!RANKS.length) return { icon: '🌱', title: 'Seedling' };
  for (let i = RANKS.length - 1; i >= 0; i--) if ((pts||0) >= RANKS[i].min) return RANKS[i];
  return RANKS[0];
}

// ── Achievements ──────────────────────────────────────────────────────────
function renderAch() {
  const done = S.achievements || [];
  setText('achCnt', done.length + '/' + ACHIEVEMENTS.length);
  const grid = g('achGrid'); grid.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const card = document.createElement('div');
    card.className = 'ach-card ' + (done.includes(a.id) ? 'done' : 'locked');
    card.innerHTML = '<div class="ach-ico">' + a.icon + '</div><div class="ach-name">' + a.name + '</div><div class="ach-desc">' + a.desc + '</div>';
    grid.appendChild(card);
  });
}

// ── Settings ──────────────────────────────────────────────────────────────
function renderSettings() { g('notifToggle').checked = S.notificationsEnabled !== false; }
async function saveNotifPref() {
  S.notificationsEnabled = g('notifToggle').checked;
  await push();
  toast(S.notificationsEnabled ? '🔔 Notifications on' : '🔕 Notifications off');
}

// ── Helpers ───────────────────────────────────────────────────────────────
function g(id)          { return document.getElementById(id); }
function setText(id, v) { const e = g(id); if (e) e.textContent = v; }
function setW(id, pct)  { const e = g(id); if (e) e.style.width = (pct || 0) + '%'; }
function host(url) {
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}
function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60)    return d + 's ago';
  if (d < 3600)  return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
}
function toast(msg) {
  const el = g('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}
