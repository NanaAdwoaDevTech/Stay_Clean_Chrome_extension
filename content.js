'use strict';
// ── StayClean v5 · Content Script ─────────────────────────────────────────
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'BLOCK') showOverlay(msg);
});

function showOverlay({ username, points, streak }) {
  if (document.getElementById('sc-ov')) return;

  const LINES = [
    "You are stronger than this urge. Step away.",
    "Every minute here costs you. Your future self is watching.",
    "This site was on your list for a reason. Trust past-you.",
    "Close this tab. You will thank yourself in 5 minutes.",
    "Real wins happen when no one is watching. Walk away.",
    "Champions are built in moments exactly like this.",
    "One decision separates you from where you want to be.",
    "Your streak is worth more than this moment of weakness.",
    "The dopamine hit fades. Your discipline stays.",
    "Nothing on that page will make you feel better about yourself.",
    "Visiting this site breaks your streak and resets your level. Worth it?",
    "Your rank is safe. Your streak is not. Choose wisely.",
  ];
  const q   = LINES[Math.floor(Math.random() * LINES.length)];
  const stk = streak > 0
    ? '<p class="sc-s">🔥 ' + streak + '-day streak at risk — visiting resets your level!</p>'
    : '<p class="sc-s">Build your streak by staying away.</p>';

  const css = document.createElement('style');
  css.id = 'sc-css';
  css.textContent = `
    #sc-ov{position:fixed;inset:0;z-index:2147483647;background:rgba(6,8,20,.97);
      display:flex;align-items:center;justify-content:center;
      font-family:'Segoe UI',system-ui,sans-serif;animation:scIn .28s ease}
    @keyframes scIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
    #sc-box{background:linear-gradient(150deg,#151a35,#0c0f22);border:2px solid #3040a0;
      border-radius:22px;padding:38px 32px;max-width:420px;width:90%;text-align:center;
      box-shadow:0 0 55px rgba(70,90,255,.22),0 18px 55px rgba(0,0,0,.65)}
    .sc-em{font-size:2.8rem;margin-bottom:8px}
    .sc-h{font-size:1.8rem;font-weight:900;color:#fff;margin-bottom:4px}
    .sc-u{color:#8896cc;font-size:.9rem;margin-bottom:15px}
    .sc-u b{color:#99aaff}
    .sc-q{background:rgba(70,90,255,.1);border-left:3px solid #5566f0;
      border-radius:0 11px 11px 0;padding:11px 14px;color:#c5cdfa;
      font-size:.9rem;font-style:italic;line-height:1.55;margin-bottom:13px;text-align:left}
    .sc-s{color:#ffb84d;font-weight:700;font-size:.87rem;margin-bottom:13px}
    .sc-row{display:flex;gap:13px;justify-content:center;margin-bottom:20px}
    .sc-stat{background:rgba(255,255,255,.05);border-radius:12px;padding:10px 20px}
    .sc-sv{font-size:1.5rem;font-weight:800;color:#7080ff}
    .sc-sl{font-size:.67rem;color:#8896cc;text-transform:uppercase;letter-spacing:1px;font-weight:700}
    .sc-btns{display:flex;gap:9px;justify-content:center;margin-bottom:9px}
    .sc-btn{border:none;border-radius:11px;padding:11px 22px;font-size:.92rem;
      font-weight:800;cursor:pointer;transition:all .18s}
    #sc-back{background:linear-gradient(135deg,#5566f0,#7080ff);color:#fff;flex:1}
    #sc-back:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(85,102,240,.4)}
    #sc-skip{background:rgba(255,255,255,.06);color:#8896cc;border:1.5px solid #3040a0}
    #sc-skip:hover{background:rgba(255,70,70,.1);color:#ff6060;border-color:#ff4040}
    .sc-note{font-size:.7rem;color:#505878}`;

  const ov = document.createElement('div');
  ov.id = 'sc-ov';
  ov.innerHTML =
    '<div id="sc-box">' +
      '<div class="sc-em">🛡️</div>' +
      '<h1 class="sc-h">StayClean</h1>' +
      '<p class="sc-u">Blocked site, <b>' + (username || 'Champion') + '</b></p>' +
      '<div class="sc-q">"' + q + '"</div>' +
      stk +
      '<div class="sc-row">' +
        '<div class="sc-stat"><div class="sc-sv">' + (points || 0) + '</div><div class="sc-sl">Points</div></div>' +
        '<div class="sc-stat"><div class="sc-sv">' + (streak || 0) + '</div><div class="sc-sl">Streak</div></div>' +
      '</div>' +
      '<div class="sc-btns">' +
        '<button class="sc-btn" id="sc-back">← Go Back</button>' +
        '<button class="sc-btn" id="sc-skip">Continue Anyway</button>' +
      '</div>' +
      '<p class="sc-note">Continuing resets your streak, level, and 5-min window.</p>' +
    '</div>';

  document.head.appendChild(css);
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';

  function done() { ov.remove(); css.remove(); document.body.style.overflow = ''; }

  document.getElementById('sc-back').addEventListener('click', () => {
    history.back();
    setTimeout(() => { try { window.close(); } catch(e) {} }, 350);
    done();
  });
  document.getElementById('sc-skip').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RESET_WINDOW' });
    done();
  });
}
