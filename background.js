'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  StayClean · Background Service Worker  (patched)
//
//  PRIVACY / GDPR COMPLIANCE
//  ─────────────────────────
//  • All data is stored exclusively in chrome.storage.local on the user's
//    own device. Nothing is ever sent to any server, API, or third party.
//  • No analytics, no cookies, no telemetry, no network requests of any kind.
//  • User can permanently erase all data at any time via the Log Out button
//    (chrome.storage.local.clear), exercising GDPR Article 17 — Right to Erasure.
//  • No privacy policy is required: no personal data is processed outside
//    the user's own device.
//
//  CALIBRATION
//  ───────────
//  400 pts = 1 clean day  (5 hrs active × 12 five-min windows × 10 pts base)
//
//  RANKS  (total points — NEVER reset)
//  ────────────────────────────────────
//  Unranked 0 → Seedling 200 → Starter 400 → Determined 1,200 → Focused 2,800
//  → Disciplined 5,600 → Warrior 12,000 → Champion 36,000 → Elite 72,000
//  → 1 Year Clean 146,000 → 2 Years Clean 292,000 → 3 Years — Free 438,000
//
//  LEVELS  (streak points — RESET to 1 when streak breaks)
//  ─────────────────────────────────────────────────────────
//  Power curve: L1=0  …  L14=146,000 (1-year equivalent). Fast early, slow near top.
//
//  CLEAN 24-HR DAY — all three conditions required simultaneously:
//  ────────────────────────────────────────────────────────────────
//  a) At least 1 URL in block list
//  b) Zero visits to any blocked URL since slipFreeStart
//  c) 24 real hours elapsed since slipFreeStart
//
//  OTHER RULES
//  ───────────
//  • Streak break → level = 1, streakPoints = 0  (totalPoints + rank always safe)
//  • Removing a URL from block list = visiting it — full slip + streak break
//  • Activity log: last 5 entries only
//  • 190 unique daily quotes, one per calendar day-of-year, cycling endlessly
//  • 3-year milestone (438,000 pts) triggers celebration screen
// ═══════════════════════════════════════════════════════════════════════════

const FIVE_MIN   = 5 * 60 * 1000;
const DAY_MS     = 24 * 60 * 60 * 1000;
const STREAK_BON = 0.10;   // +10% points per active streak day
const BASE_PTS   = 10;

// ── Self-stacking ranks (total points — NEVER reset) ───────────────────────
const RANKS = [
  { min:       0, icon: '❓', title: 'Unranked',       hint: 'before you begin'  },
  { min:     200, icon: '🌱', title: 'Seedling',        hint: '~half a day'       },
  { min:     400, icon: '🔰', title: 'Starter',         hint: '1 day'             },
  { min:    1200, icon: '💼', title: 'Determined',      hint: '3 days'            },
  { min:    2800, icon: '🎯', title: 'Focused',         hint: '1 week'            },
  { min:    5600, icon: '⚡', title: 'Disciplined',     hint: '2 weeks'           },
  { min:   12000, icon: '🛡️', title: 'Warrior',         hint: '1 month'           },
  { min:   36000, icon: '🏅', title: 'Champion',        hint: '3 months'          },
  { min:   72000, icon: '💎', title: 'Elite',           hint: '6 months'          },
  { min:  146000, icon: '🌅', title: '1 Year Clean',    hint: '1 year'            },
  { min:  292000, icon: '🌠', title: '2 Years Clean',   hint: '2 years'           },
  { min:  438000, icon: '♾️', title: '3 Years — Free',  hint: '3 years 🎉'        },
];

const THREE_YEAR_PTS = 438000;
const ONE_YEAR_PTS   = 146000;
const TWO_YEAR_PTS   = 292000;

// ── Level XP (streak points — RESET on streak break) ──────────────────────
// Power curve  L1=0  …  L14=146,000.  Fast early wins, very slow near top.
const LEVEL_XP = [
  0, 310, 1634, 4325, 8626, 14737, 22827, 33046, 45531, 60405, 77784, 97776, 120482, 146000
];

// ── 190 unique daily quotes (day-of-year mod 190, same quote all day) ──────
const QUOTES = [
  "Every 5 minutes of resistance is a vote for who you want to become.",
  "The urge will pass. Your character stays forever.",
  "Discipline is choosing what you want most over what you want now.",
  "You don't have to be perfect — just better than yesterday.",
  "The hardest part is starting. You already did. Keep going.",
  "Small wins compound into massive change.",
  "What you resist, you master.",
  "Your future self is watching. Make them proud.",
  "Boredom is the gateway to creativity. Sit with it.",
  "The algorithm was designed to trap you. Outsmart it.",
  "Silence the feed. Amplify your focus.",
  "One tab closed is a battle won.",
  "You are not your impulses. You are your choices.",
  "Progress isn't always visible. Trust the process.",
  "Every time you resist, your willpower muscle grows.",
  "The world rewards those who can focus deeply.",
  "Distraction is the enemy of greatness. Guard your attention.",
  "A clear mind is worth more than any scroll.",
  "You have already come further than most people dare.",
  "The version of you that wins is the one who stays the course.",
  "Your attention is the most valuable currency you own.",
  "Stop giving your best hours to the worst content.",
  "Real life is richer than any feed could ever be.",
  "The present moment is calling. Answer it.",
  "You were made for deep work, not shallow clicks.",
  "What you feed your mind shapes who you become.",
  "Champions do the boring thing when nobody is watching.",
  "Every great story starts with someone choosing to show up.",
  "The people who change the world do it with sustained focus.",
  "You are literally rewiring your brain right now. Keep going.",
  "Resist once. Then resist again. That is the whole strategy.",
  "Close the tab. Open your potential.",
  "Your streak is a monument to your character.",
  "One more clean session. That is all that is required.",
  "The dopamine hit fades. The growth stays.",
  "You are in charge of your mind. Prove it.",
  "The best things in life require sustained attention.",
  "What would the best version of you do right now?",
  "Boredom is just opportunity wearing a disguise.",
  "Choose depth over distraction, every single time.",
  "Your brain is a garden. Watch what you plant in it.",
  "Success is rented — and rent is due every single day.",
  "Ten minutes of focus beats ten hours of distraction.",
  "The gap between who you are and who you want to be is closed by moments like this.",
  "You don't need more willpower. You need fewer chances to give in.",
  "Log off. Live forward.",
  "The best investment you will ever make is in your own focus.",
  "Do it now. Your tomorrow will thank you.",
  "You are not behind. You are exactly where showing up matters.",
  "Hard choices, easy life. Easy choices, hard life.",
  "Every time you choose focus, the next choice gets easier.",
  "The strongest thing you can do is pause before you click.",
  "Protect your peace more fiercely than your entertainment.",
  "Your story is being written right now. What chapter is this?",
  "Clean sessions stack. Before you know it, you are a different person.",
  "What you do in the next 5 minutes defines who you are becoming.",
  "A ship in harbour is safe — but that is not what ships are built for.",
  "Your brain on focus is a superpower. Activate it.",
  "The scroll never ends. So you have to be the one who does.",
  "Momentum is fragile. Protect it with every choice.",
  "You have come too far to be derailed by a momentary urge.",
  "Comparison is the thief of joy. Focus is the gift of progress.",
  "One clean minute. Then one more. That is how mountains are climbed.",
  "The version of you that wins is not luckier — they are more consistent.",
  "Great focus is a skill. You are training it right now.",
  "Your mind deserves better inputs than a random feed.",
  "Do the hard thing first. Everything else becomes easier.",
  "The cost of distraction is a life unlived.",
  "Quiet the noise. Hear what matters.",
  "You are the author of your habits. Write a good story.",
  "Resistance is the sign that something is worth fighting for.",
  "Each clean session is a deposit in your future self's account.",
  "Nothing on that site is more important than who you are becoming.",
  "The path to freedom is paved with small, consistent choices.",
  "Stay curious about your own potential — it is bigger than any feed.",
  "You don't need motivation to start. You need discipline to continue.",
  "Every expert was once a beginner who refused to quit.",
  "The greatest competition is the one you have with yourself.",
  "Sharpen the mind. Let the world come to you.",
  "Your habits are your destiny. Choose deliberately.",
  "One more hour of focus today means one step closer to the life you want.",
  "You are not the voice that craves distraction. You are the one who hears it.",
  "The secret to willpower is not white-knuckling. It is building identity.",
  "I am someone who chooses focus. Act like it.",
  "The internet will always be there. Your peak years will not.",
  "Scrolling is easy. Building is hard. Hard is where the good stuff lives.",
  "What you practise, you become. Practise presence.",
  "Growth does not happen in your comfort zone or your feed.",
  "Every great person you admire had to choose focus over comfort, repeatedly.",
  "The world is full of distraction. Rare is the one who can resist.",
  "Be the person who does what they said they would do.",
  "One decision at a time. This one counts.",
  "Your goals don't care about your mood. Show up anyway.",
  "The moment you want to quit is the moment right before the breakthrough.",
  "Clarity comes from action, not scrolling.",
  "You are not looking for answers on that site. You already have them.",
  "Close it. The work is waiting.",
  "The deepest satisfaction comes from doing the hard thing.",
  "Clean streaks don't just happen. They are chosen — like you are doing now.",
  "Your mind is your most powerful tool. Keep it sharp.",
  "You can either scroll your life away or build it. Not both.",
  "Today's focus is tomorrow's advantage.",
  "The small voice that says not today is your greatest enemy. Ignore it.",
  "Each point you earn is evidence that you can be trusted with more.",
  "Make the choice that 3am-you would be proud of.",
  "Your attention is being sold. Refuse to be the product.",
  "Stay in the arena, even when no one is watching.",
  "The return on focus is always worth the investment.",
  "Your future needs you present. Be here.",
  "A clear conscience and a clean streak walk hand in hand.",
  "You are more powerful than any craving. This moment is proof.",
  "What is easy now is hard later. What is hard now is easy later.",
  "The best time to build discipline was yesterday. Second best: right now.",
  "You are building a track record with yourself. Make it count.",
  "Real rest is intentional. A scroll is just slow destruction.",
  "You already know what to do. The question is whether you will do it.",
  "Today's sacrifice is next year's freedom.",
  "Every clean session is a love letter to your future self.",
  "Strength is not the absence of weakness — it is choosing not to act on it.",
  "You are closer than you think. Don't stop now.",
  "Earn your rest. Don't steal it from your potential.",
  "The best chapter of your life will not be written by a distracted mind.",
  "Your character is forged in moments exactly like this one.",
  "Temptation is just a test in disguise. Pass it.",
  "The only person you need to impress is who you were yesterday.",
  "Clean windows don't just earn points. They earn self-respect.",
  "What you do when no one is watching is who you truly are.",
  "Push past the impulse. There is gold on the other side.",
  "Your brain craves novelty. Give it something real.",
  "Be relentless in the pursuit of the person you know you can be.",
  "The measure of a person is what they do when they can quit.",
  "Momentum is the secret. You already have it. Protect it.",
  "If you knew how close you were, you would never stop.",
  "Your habits are either working for you or against you. Choose wisely.",
  "Excellence is not an act. It is a habit built one choice at a time.",
  "Stay the course. The view from the summit is worth every struggle.",
  "What you allow into your mind shapes every decision you make.",
  "A single click can cost a hundred minutes of focus. Is it worth it?",
  "You are the curator of your own mind. Curate wisely.",
  "Every second of focus is a second stolen back from distraction.",
  "The mind that wanders loses. The mind that stays wins.",
  "This is the practice. Every. Single. Day.",
  "The most rebellious thing you can do today is focus.",
  "You don't need the internet to know who you are. You need silence.",
  "Mental clarity is a superpower in a distracted world. Own it.",
  "Nothing on that screen will make you feel better about yourself.",
  "The quiet life is the productive life. Embrace it.",
  "Your peak performance lives on the other side of this temptation.",
  "Every time you choose yourself over the feed, you win.",
  "You are the protagonist of your story. Start acting like it.",
  "Focus is the new IQ. The world belongs to those who can hold it.",
  "Don't let one weak moment unravel weeks of strong ones.",
  "Your wins are proof of your strength. Keep adding to the list.",
  "Train your brain the way athletes train their body — with discipline.",
  "Be someone who keeps their word to themselves.",
  "You didn't come this far to only come this far.",
  "Today is a gift. Don't trade it for a scroll.",
  "Stay sharp. Stay clean. Stay winning.",
  "Your legacy is being written in moments like this.",
  "The life you want is built in the hours you protect.",
  "Let your results do the talking. Right now, the result is focus.",
  "Brave is not the absence of temptation. Brave is saying no to it.",
  "Your focus is your greatest competitive advantage. Use it.",
  "You are not missing out. You are opting in to something greater.",
  "Show up for yourself the way you would show up for someone you love.",
  "You already have everything you need. Now do the work.",
  "The best version of you was always just one clean choice away.",
  "Keep stacking. Keep climbing. Keep winning.",
  "Be so focused that distraction forgets your address.",
  "Every choice ripples. Make waves that matter.",
  "The finish line doesn't move. But you can.",
  "You are not defined by your urges. You are defined by your responses.",
  "The discipline you build today is the freedom you enjoy tomorrow.",
  "One session at a time. One day at a time. One life — make it count.",
  "Your best work lives on the other side of every distraction you refuse.",
  "The most powerful words you can say are: not this time.",
  "Victory is not given. It is chosen, moment by moment.",
  "You are writing the story of who you are right now. What happens next?",
  "Don't chase the feeling. Chase the result.",
  "Every closed tab is an open door to your potential.",
  "The person who masters themselves can master anything.",
  "Comfort is overrated. Growth is underrated. Choose accordingly.",
  "Your concentration today is your confidence tomorrow.",
  "Tiny hinges swing big doors. Your habits are the hinges.",
  "Nobody regrets focusing. Everybody regrets scrolling.",
  "The strength you need already lives inside you. Reach for it.",
  "You are building something that cannot be taken away: your character.",
  "Real success is boring from the outside and deeply satisfying from within.",
  "The road less travelled is less travelled because it requires showing up.",
];

// ── State ────────────────────────────────────────────────────────────────
function loadState() {
  return new Promise(r => chrome.storage.local.get('sc5', d => r(d.sc5 || freshState())));
}
function saveState(s) {
  return new Promise(r => chrome.storage.local.set({ sc5: s }, r));
}
function freshState() {
  return {
    username: '', avatar: '🏆',
    totalPoints: 0,        // all-time → rank  (NEVER resets)
    streakPoints: 0,       // current streak run → level  (resets on break)
    level: 1,
    streak: 0, longestStreak: 0,
    blockedUrls: [],       // [{ url, addedAt }]  — starts empty
    achievements: [],
    totalSessions: 0, totalCleanMins: 0,
    todaySessions: 0, todaySlips: 0,
    slipFreeStart: null,      // ms: start of current 24-hr slip-free window
    lastStreakAwardTs: null,  // ms: prevents double streak-increments
    windowStart: null,        // ms: start of current 5-min clean window
    activity: [],             // last 5 only
    notificationsEnabled: true,
    celebrationSeen: false,   // whether 3-yr screen has been dismissed
    quoteDOY: -1, quoteIdx: 0,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────
function calcLevel(sp) {
  const p = sp || 0;
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) if (p >= LEVEL_XP[i]) return i + 1;
  return 1;
}
function getRank(tp) {
  const p = tp || 0;
  for (let i = RANKS.length - 1; i >= 0; i--) if (p >= RANKS[i].min) return RANKS[i];
  return RANKS[0];
}
function doy(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }
function assignQuote(s) {
  const d = doy(new Date());
  if (s.quoteDOY !== d) { s.quoteDOY = d; s.quoteIdx = d % QUOTES.length; }
  return s;
}

// ── Clean 24-hr day check ────────────────────────────────────────────────
function isCleanDay(s) {
  if (!s.blockedUrls || !s.blockedUrls.length) return false;
  if ((s.todaySlips || 0) > 0) return false;
  if (!s.slipFreeStart) return false;
  return (Date.now() - s.slipFreeStart) >= DAY_MS;
}

// ── Streak check (called every tick) ────────────────────────────────────
async function checkStreak(s) {
  if (!isCleanDay(s)) return s;
  const now = Date.now();
  if (s.lastStreakAwardTs && (now - s.lastStreakAwardTs) < DAY_MS) return s;
  s.streak            = (s.streak || 0) + 1;
  s.longestStreak     = Math.max(s.longestStreak || 0, s.streak);
  s.lastStreakAwardTs = now;
  s.slipFreeStart     = now; // reset for next 24-hr window
  if (s.notificationsEnabled !== false)
    ping('stk_' + now, '🔥 Day ' + s.streak + ' streak!', '24 clean hours. Keep going!');
  return s;
}

// ── Award 5-min window ───────────────────────────────────────────────────
async function award() {
  let s = await loadState();
  if (!s.username) return;
  s = assignQuote(s);
  s = await checkStreak(s);

  const mult       = 1 + (s.streak || 0) * STREAK_BON;
  const earned     = Math.round(BASE_PTS * mult);
  s.totalPoints    = (s.totalPoints    || 0) + earned;
  s.streakPoints   = (s.streakPoints   || 0) + earned;
  s.totalCleanMins = (s.totalCleanMins || 0) + 5;
  s.totalSessions  = (s.totalSessions  || 0) + 1;
  s.todaySessions  = (s.todaySessions  || 0) + 1;
  s.windowStart    = Date.now();
  const prevLvl    = s.level;
  s.level          = calcLevel(s.streakPoints);

  const { s: s2, fresh } = runAchievements(s);
  s = s2;
  s.activity = s.activity || [];
  s.activity.unshift({ type: 'pts', pts: earned, streak: s.streak, t: Date.now() });
  s.activity = s.activity.slice(0, 5);
  await saveState(s);

  if (s.notificationsEnabled !== false) {
    const lv = s.level > prevLvl ? ' 🎉 Level ' + s.level + '!' : '';
    ping('pts_' + Date.now(), '✅ +' + earned + ' pts!', '5 clean minutes.' + lv);
    fresh.forEach(id => {
      if (id === 'three_years') ping('cel', '🎉 YOU DID IT!', '3 years free. Open StayClean to celebrate!');
      else ping('ach_' + id, '🏅 Achievement!', id.replace(/_/g, ' '));
    });
  }
}

// ── Slip ────────────────────────────────────────────────────────────────
async function applySlip(url, breakStreak) {
  let s = await loadState();
  s = assignQuote(s);
  s.windowStart   = null;
  s.todaySlips    = (s.todaySlips || 0) + 1;
  s.slipFreeStart = Date.now(); // restart 24-hr clock
  if (breakStreak && (s.streak || 0) > 0) {
    s.streak = 0; s.level = 1; s.streakPoints = 0; s.lastStreakAwardTs = null;
    if (s.notificationsEnabled !== false)
      ping('brk', '💔 Streak broken!', 'Level reset to 1. Rank & total points are safe. Rebuild!');
  }
  s.activity = s.activity || [];
  s.activity.unshift({ type: 'slip', url, t: Date.now() });
  s.activity = s.activity.slice(0, 5);
  await saveState(s);
  return s;
}

// ── Achievements ─────────────────────────────────────────────────────────
function runAchievements(s) {
  const DEFS = [
    { id: 'first_win',    ok: s => s.totalSessions  >= 1            },
    { id: 'ten_sessions', ok: s => s.totalSessions  >= 10           },
    { id: 'hour_clean',   ok: s => s.totalCleanMins >= 60           },
    { id: 'streak3',      ok: s => s.streak         >= 3            },
    { id: 'streak7',      ok: s => s.streak         >= 7            },
    { id: 'level5',       ok: s => s.level          >= 5            },
    { id: 'level10',      ok: s => s.level          >= 10           },
    { id: 'pts500',       ok: s => s.totalPoints    >= 500          },
    { id: 'ironclad',     ok: s => isCleanDay(s)                    },
    { id: 'resist10',     ok: s => s.todaySlips     >= 10           },
    { id: 'one_year',     ok: s => s.totalPoints    >= ONE_YEAR_PTS },
    { id: 'two_years',    ok: s => s.totalPoints    >= TWO_YEAR_PTS },
    { id: 'three_years',  ok: s => s.totalPoints    >= THREE_YEAR_PTS },
  ];
  s.achievements = s.achievements || [];
  const fresh = [];
  DEFS.forEach(d => {
    if (!s.achievements.includes(d.id) && d.ok(s)) { s.achievements.push(d.id); fresh.push(d.id); }
  });
  return { s, fresh };
}

// ── URL matching ──────────────────────────────────────────────────────────
function urlBlocked(url, list) {
  if (!url || !list || !list.length) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return list.some(e => {
      const c = (e.url || e).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
      return host === c || host.endsWith('.' + c);
    });
  } catch { return false; }
}

// ── Tick every 30 s ──────────────────────────────────────────────────────
async function tick() {
  let s = await loadState();
  if (!s.username) return;
  s = await checkStreak(s);
  await saveState(s);
  if (s.windowStart && Date.now() - s.windowStart >= FIVE_MIN) await award();
}

// ── Navigation ────────────────────────────────────────────────────────────
chrome.webNavigation.onCommitted.addListener(async details => {
  if (details.frameId !== 0) return;
  const s = await loadState();
  if (!s.username) return;
  if (urlBlocked(details.url, s.blockedUrls)) {
    const u = await applySlip(details.url, true);
    chrome.tabs.sendMessage(details.tabId, { type: 'BLOCK', username: u.username, points: u.totalPoints, streak: u.streak }).catch(() => {});
  } else {
    if (!s.windowStart) { s.windowStart = Date.now(); await saveState(s); }
  }
});

// ── Alarms ────────────────────────────────────────────────────────────────
chrome.alarms.create('tick', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tick') tick(); });
chrome.runtime.onInstalled.addListener(tick);
chrome.runtime.onStartup.addListener(tick);
function ping(id, title, message) {
  chrome.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon48.png', title, message, priority: 1 });
}

// ── Message bridge ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type === 'GET_STATE') {
    loadState().then(s => { s = assignQuote(s); reply({ s, quotes: QUOTES, ranks: RANKS, levelXp: LEVEL_XP, threeYrPts: THREE_YEAR_PTS }); });
    return true;
  }
  if (msg.type === 'SET_STATE') { saveState(msg.s).then(() => reply({ ok: true })); return true; }
  if (msg.type === 'RESET_WINDOW') {
    loadState().then(async s => { s.windowStart = null; await saveState(s); reply({ ok: true }); }); return true;
  }
  if (msg.type === 'ADD_URL') {
    loadState().then(async s => {
      s.blockedUrls = s.blockedUrls || [];
      if (!s.blockedUrls.some(e => (e.url || e) === msg.url)) {
        s.blockedUrls.push({ url: msg.url, addedAt: Date.now() });
        if (!s.slipFreeStart) s.slipFreeStart = Date.now();
      }
      await saveState(s); reply({ ok: true });
    }); return true;
  }
  if (msg.type === 'REMOVE_URL') {
    // Removing a blocked URL = visiting it — full slip consequences + streak break
    loadState().then(async s => {
      s.blockedUrls = (s.blockedUrls || []).filter(e => (e.url || e) !== msg.url);
      await saveState(s);
      await applySlip(msg.url + ' [removed from block list]', true);
      reply({ ok: true });
    }); return true;
  }
  if (msg.type === 'MARK_CEL_SEEN') {
    loadState().then(async s => { s.celebrationSeen = true; await saveState(s); reply({ ok: true }); }); return true;
  }
  // LOGOUT — complete local erasure exercising GDPR Art. 17 Right to Erasure
  if (msg.type === 'LOGOUT') { chrome.storage.local.clear(() => reply({ ok: true })); return true; }
});
