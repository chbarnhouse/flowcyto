/* FlowCyto Markers: an endless quiz on which cells carry which markers. Three kinds of question, each
   switched on or off on the start sheet:
     match   a cell type and a marker: does it carry it? (swipe right for yes, left for no; or the buttons)
     cells   a marker: which of these cells carry it? (pick all that apply)
     markers a cell type: which of these markers does it carry? (pick all that apply)
   Only clear-cut readings are asked: a marker that is partly positive or varies between patients is
   never a question. Negative pairs come from the same lineage's markers (CD5 on a B cell, not CD41 on a
   T cell), so a "no" is a real distinction. Route: '#markers'. */
(function () {
  'use strict';
  const FC = window.FC;
  const { BY, ENTITIES, MARKERS, readClass } = FC;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } };
  const ICON = {
    yes: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    no: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    back: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    list: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5l1.2 1.2 2-2.4M2.5 10.5l1.2 1.2 2-2.4M8 5h5.5M8 11h5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gear: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h6M12 4.5h1.5M2.5 11.5h1.5M7.5 11.5h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10.2" cy="4.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5.8" cy="11.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  };
  const KINDS = { match: 'Does it carry it? (swipe)', cells: 'Marker → which cells', markers: 'Cell → which markers' };

  // ---------- facts: clear-cut readings only ----------
  const QUIZ_MARKERS = Object.keys(MARKERS).filter(mk => !['FSC', 'SSC', 'LC'].includes(mk));
  function reading(id, mk) {
    const c = readClass(BY[id].m[mk], mk);
    return c === 'neg' ? false : (c === 'pos' || c === 'dim') ? true : null; // split / var: not asked
  }
  // markers worth asking about for a cell: its own, plus any its lineage-mates carry
  function markersFor(id) {
    const lin = BY[id].lineage, set = new Set();
    for (const e of ENTITIES) if (e.lineage === lin || e.id === id) for (const mk of Object.keys(e.m)) if (QUIZ_MARKERS.includes(mk)) set.add(mk);
    return [...set].filter(mk => reading(id, mk) !== null);
  }
  // "CD4 T cell" and CD4: the name gives it away, so that pair is never asked
  const named = (id, mk) => new RegExp(`(^|[^A-Za-z0-9])${mk}([^A-Za-z0-9]|$)`).test(BY[id].name);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cellPool = () => ENTITIES.filter(e => Q.cfg.cells === 'both' || e.kind === Q.cfg.cells).map(e => e.id);

  function makeQuestion() {
    // pick the kind first, then retry within it, so a kind that is harder to fill still gets its share
    const kinds = shuffle(Object.keys(KINDS).filter(k => Q.cfg.kinds[k]));
    for (let tries = 0; tries < 50 * kinds.length; tries++) {
      const kind = kinds[Math.floor(tries / 50)], pool = cellPool();
      if (kind === 'match') {
        const id = pick(pool), mks = markersFor(id).filter(mk => !named(id, mk)), want = Math.random() < 0.5;
        const pickFrom = mks.filter(mk => reading(id, mk) === want);
        if (!pickFrom.length) continue;
        const mk = pick(pickFrom);
        return { kind, id, mk, answer: want };
      }
      if (kind === 'markers') {
        const id = pick(pool), mks = shuffle(markersFor(id).filter(mk => !named(id, mk)));
        const pos = mks.filter(mk => reading(id, mk)), neg = mks.filter(mk => !reading(id, mk));
        if (!pos.length || !neg.length) continue;
        const nPos = Math.min(pos.length, 1 + Math.floor(Math.random() * 3)), opts = shuffle([...pos.slice(0, nPos), ...neg.slice(0, 5 - nPos)]);
        if (opts.length < 4) continue;
        return { kind, id, options: opts, correct: opts.filter(mk => reading(id, mk)) };
      }
      if (kind === 'cells') {
        const mk = pick(QUIZ_MARKERS), clear = shuffle(pool.filter(id => reading(id, mk) !== null && markersFor(id).includes(mk) && !named(id, mk)));
        const pos = clear.filter(id => reading(id, mk)), neg = clear.filter(id => !reading(id, mk));
        if (!pos.length || neg.length < 2) continue;
        // decoys from the positives' lineages first, so the choice is a real one
        const lins = new Set(pos.map(id => BY[id].lineage));
        const negs = [...neg.filter(id => lins.has(BY[id].lineage)), ...neg.filter(id => !lins.has(BY[id].lineage))];
        const nPos = Math.min(pos.length, 1 + Math.floor(Math.random() * 3)), opts = shuffle([...pos.slice(0, nPos), ...negs.slice(0, 5 - nPos)]);
        if (opts.length < 4) continue;
        return { kind, mk, options: opts, correct: opts.filter(id => reading(id, mk)) };
      }
    }
    return null;
  }

  // ---------- full names ----------
  // a cell's long name when its short one is abbreviated (CLL / SLL, NK cell); a marker's own name, or CD n
  const ABBR = /(^|[^A-Za-z])([A-Z]{2,}|CD\d)/;
  const cellFull = id => { const e = BY[id]; return ABBR.test(e.name) && e.long && e.long !== e.name ? e.long : ''; };
  const markFull = mk => MARKERS[mk].full || (/^CD\d/.test(mk) ? `cluster of differentiation ${mk.slice(2)}` : '');
  const fullOf = (kind, key) => kind === 'cell' ? cellFull(key) : markFull(key);
  const nameOf = (kind, key) => kind === 'cell' ? BY[key].name : MARKERS[key].name;
  // an abbreviation in a question: dotted underline; press and hold (or tap: Settings) for the full name
  const term = (kind, key) => fullOf(kind, key) ? `<span class="abbr" role="button" data-full="${kind}:${esc(key)}">${esc(nameOf(kind, key))}</span>` : esc(nameOf(kind, key));
  // in an answer the full name is written out (CD numbers only when they have a name of their own)
  const spelled = (kind, key) => kind === 'cell' ? cellFull(key) : MARKERS[key].full || '';

  /* The answer lists: every marker a cell carries, every cell (in the quiz's cell types) carrying a
     marker. Dim, bright, partly (split) and varies are said in words. */
  const TAG = { dim: 'dim', bright: 'bright', split: 'partly', var: 'varies', poly: 'κ and λ', clonal: 'one only' };
  const carries = lv => lv && lv !== '-';
  const cellMarkers = id => Object.keys(MARKERS).filter(mk => !MARKERS[mk].scatter && carries(BY[id].m[mk])).map(mk => ({ kind: 'mark', key: mk, lv: BY[id].m[mk] }));
  const markerCells = mk => cellPool().filter(id => carries(BY[id].m[mk])).map(id => ({ kind: 'cell', key: id, lv: BY[id].m[mk] }));
  function listHTML(title, items, hit) {
    if (!items.length) return `<h4 class="qlist-h">${title}</h4><p class="help">None of these cell types.</p>`;
    return `<h4 class="qlist-h">${title}</h4><ul class="qlist">${items.map(it => {
      const f = spelled(it.kind, it.key), tag = TAG[it.lv];
      return `<li${it.key === hit ? ' class="hit"' : ''}><b>${esc(nameOf(it.kind, it.key))}${tag ? ` <i>${tag}</i>` : ''}</b>${f ? `<span>${esc(f)}</span>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  // "CLL / SLL (chronic lymphocytic leukemia / …)"; a full name with its own parentheses goes between commas
  const withFull = (kind, key) => {
    let f = spelled(kind, key); if (!f) return `<b>${esc(nameOf(kind, key))}</b>`;
    if (kind === 'cell' && !/^[A-Z][A-Z-]/.test(f)) f = f[0].toLowerCase() + f.slice(1); // "Chronic …" mid-sentence; not "B-lymphoblastic
    return `<b>${esc(nameOf(kind, key))}</b>${f.includes('(') ? `, <span class="full">${esc(f)}</span>,` : ` <span class="full">(${esc(f)})</span>`}`;
  };

  // ---------- state ----------
  const Q = { cfg: Object.assign({ kinds: { match: true, cells: true, markers: true }, cells: 'both' }, load('flowcyto.markers', {})), q: null, picked: new Set(), crossed: new Set(), done: false, right: null, score: 0, answered: 0, streak: 0 };
  const best = () => load('flowcyto.markersBest', 0);

  // ---------- views ----------
  function open() {
    $('#menu').hidden = true; $('#game').hidden = true; $('#quiz').hidden = false;
    document.documentElement.classList.add('in-game');
    document.title = 'FlowCyto · Markers';
    Q.score = 0; Q.answered = 0; Q.streak = 0;
    setup();
  }
  function close() { $('#quiz').hidden = true; hideFull(); }
  const bar = () => `<header class="bar"><div class="bar-in"><button class="iconbtn" data-qmenu aria-label="Main menu">${ICON.back}<span>Menu</span></button><div class="gtitle"><b>Markers</b><span>${Q.answered ? `${Q.score} of ${Q.answered} · streak ${Q.streak} · best ${best()}` : `best streak ${best()}`}</span></div><button class="iconbtn" data-qsettings aria-label="Settings">${ICON.gear}<span>Settings</span></button></div></header>`;
  // the quiz's own settings: shown on the start screen and at the top of Settings
  function kindsHTML() {
    const c = Q.cfg, chip = (k, label) => `<button class="qchip" data-qkind="${k}" aria-pressed="${!!c.kinds[k]}">${c.kinds[k] ? ICON.yes : '<span class="ic"></span>'}<span>${label}</span></button>`;
    return `<div class="qchips">${chip('match', 'Does this cell carry this marker? Swipe right for yes, left for no')}${chip('cells', 'A marker: pick every cell that carries it')}${chip('markers', 'A cell: pick every marker it carries')}</div>`;
  }
  // which cells the questions (and the answer lists) draw on
  const cellsHTML = () => `<div class="seg" role="radiogroup">${[['normal', 'Normal'], ['neoplasm', 'Abnormal'], ['both', 'Both']].map(([v, t]) => `<button role="radio" data-qcells="${v}" aria-checked="${Q.cfg.cells === v}">${t}</button>`).join('')}</div>`;
  const modeHTML = () => `${kindsHTML()}<div class="qrow"><div><b>Cell types</b><span>Normal cells, abnormal ones (neoplasms and clones), or both.</span></div>${cellsHTML()}</div>`;
  function setup() {
    Q.q = null;
    $('#quiz').innerHTML = bar() + `<main class="qmain"><section class="qcard setup card"><h2>Markers</h2><p class="sub">An endless quiz on which cells carry which markers. Pick the kinds of question; change them any time in Settings.</p>
      ${modeHTML()}<button class="btn primary big" data-qstart>Start</button></section></main>`;
  }
  function next() {
    Q.q = makeQuestion(); Q.picked = new Set(); Q.crossed = new Set(); Q.done = false; Q.right = null;
    if (!Q.q) { $('#quiz').innerHTML = bar() + '<main class="qmain"><section class="qcard card"><p>No questions fit these settings. Try more cell types.</p></section></main>'; return; }
    draw();
  }
  function questionHTML() {
    const q = Q.q, mk = q.mk && MARKERS[q.mk], fb = Q.done;
    if (q.kind === 'match') {
      const e = BY[q.id];
      let h = `<div class="swipe-wrap"><div class="swipe-hint left">${ICON.no}<span>No</span></div><div class="swipe-hint right">${ICON.yes}<span>Yes</span></div>
        <div class="swipecard card" id="swipecard"><span class="qkind">Does it carry it?</span><b class="qterm qcell">${term('cell', q.id)}</b><span class="qand">and</span><b class="qterm qmark">${term('mark', q.mk)}</b><p class="help">Swipe right for yes, left for no.</p></div></div>`;
      if (!fb) h += `<div class="yn"><button class="btn big no" data-yn="no">${ICON.no}<span>No</span></button><button class="btn big yes" data-yn="yes">${ICON.yes}<span>Yes</span></button></div>`;
      return h;
    }
    const isCells = q.kind === 'cells';
    let h = `<section class="qcard card"><span class="qkind">${isCells ? 'Which cells carry it?' : 'Which markers does it carry?'} Pick all that apply.</span><b class="qbig">${isCells ? term('mark', q.mk) : term('cell', q.id)}</b><div class="qopts">`;
    for (const o of q.options) {
      const on = Q.picked.has(o), isRight = q.correct.includes(o);
      const x = !fb && Q.crossed.has(o);
      let cls = on ? 'on' : x ? 'crossed' : '', mark = on ? ICON.yes : '<span class="ic"></span>', tail = '';
      if (fb) { cls = isRight ? (on ? 'ok' : 'missed') : (on ? 'bad' : ''); mark = isRight ? ICON.yes : (on ? ICON.no : '<span class="ic"></span>'); tail = `<span class="otag">${isRight ? (on ? 'carries it' : 'carries it: missed') : (on ? "doesn't" : '')}</span>`; }
      const ok = isCells ? 'cell' : 'mark', nm = esc(nameOf(ok, o)), hasFull = !!fullOf(ok, o);
      // holding a choice shows its full name without choosing it
      h += `<div class="qrow-opt"><button class="qopt ${cls}" data-qopt="${o}" ${hasFull ? `data-full="${ok}:${esc(o)}"` : ''} ${fb ? 'disabled' : ''}>${mark}<span${hasFull ? ' class="abbr"' : ''}>${nm}</span>${tail}</button>${fb ? '' : `<button class="xout" data-qx="${o}" aria-pressed="${x}" aria-label="${x ? 'Restore' : 'Cross out'} ${nm}" title="${x ? 'Restore' : 'Cross out'}">${ICON.no}</button>`}</div>`;
    }
    h += '</div>';
    if (!fb) h += `<button class="btn primary big" data-qcheck ${Q.picked.size ? '' : 'disabled'}>Check</button>`;
    return h + '</section>';
  }
  // the verdict pops up over the bottom of the screen; the question stays visible above it
  function popupHTML() {
    const q = Q.q, mk = q.mk && MARKERS[q.mk];
    const note = mk && mk.note ? `<p class="help">${withFull('mark', q.mk).replace(/,$/, '')}: ${esc(mk.note)}</p>` : '';
    const teach = q.id && BY[q.id].teach ? `<p class="help">${esc(BY[q.id].teach)}</p>` : '';
    const onCell = id => listHTML(`Every marker on ${esc(BY[id].name)}`, cellMarkers(id), q.mk);
    const withMark = m => listHTML(`Every ${{ normal: 'normal cell', neoplasm: 'abnormal cell', both: 'cell' }[Q.cfg.cells]} with ${esc(MARKERS[m].name)}`, markerCells(m), q.id);
    let line, body;
    if (q.kind === 'match') { line = `${withFull('cell', q.id)} is <b>${esc(mk.name)}${q.answer ? '+' : '−'}</b>`; body = onCell(q.id) + note + withMark(q.mk) + teach; }
    else if (q.kind === 'cells') { line = `Carry ${withFull('mark', q.mk)}: <b>${q.correct.map(o => esc(BY[o].name)).join(', ')}</b>`; body = note + withMark(q.mk); }
    else { line = `${withFull('cell', q.id)} carries <b>${q.correct.map(o => esc(MARKERS[o].name)).join(', ')}</b>`; body = teach + onCell(q.id); }
    return `<div class="qpop ${Q.right ? 'right' : 'wrong'}" role="status"><div class="qpop-in card"><div class="qpop-head">${Q.right ? ICON.yes : ICON.no}<b>${Q.right ? 'Right' : 'Not quite'}</b></div><div class="qpop-body"><p class="qpop-line">${line}</p>${body}</div><button class="btn big qpop-next" data-qnext>Next</button></div></div>`;
  }
  function draw() {
    hideFull();
    $('#quiz').innerHTML = bar() + `<main class="qmain">${questionHTML()}</main>${Q.done ? popupHTML() : ''}`;
    if (Q.q.kind === 'match' && !Q.done) bindSwipe();
  }
  function answer(right) {
    Q.done = true; Q.right = right; Q.answered++;
    if (right) { Q.score++; Q.streak++; if (Q.streak > best()) save('flowcyto.markersBest', Q.streak); } else Q.streak = 0;
    draw();
    // Settings: seconds until the next question after a right / wrong answer (0 = wait for Next)
    const q = Q.q, secs = +(right ? FC.prefs.quizRight : FC.prefs.quizWrong) || 0;
    if (secs > 0) setTimeout(() => { if (Q.q === q && Q.done && !$('#quiz').hidden) next(); }, secs * 1000);
  }

  // ---------- swipe ----------
  function bindSwipe() {
    const card = $('#swipecard'); if (!card) return;
    let x0 = null, dx = 0;
    swipeCancel = () => { x0 = null; card.classList.remove('dragging'); card.style.transform = ''; $('.swipe-hint.right').style.opacity = 0; $('.swipe-hint.left').style.opacity = 0; };
    card.addEventListener('pointerdown', ev => { x0 = ev.clientX; dx = 0; card.setPointerCapture(ev.pointerId); card.classList.add('dragging'); });
    card.addEventListener('pointermove', ev => {
      if (x0 == null) return;
      dx = ev.clientX - x0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      $('.swipe-hint.right').style.opacity = Math.max(0, Math.min(1, dx / 90));
      $('.swipe-hint.left').style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null; card.classList.remove('dragging');
      if (Math.abs(dx) > 90) return answer((dx > 0) === Q.q.answer);
      card.style.transform = ''; $('.swipe-hint.right').style.opacity = 0; $('.swipe-hint.left').style.opacity = 0;
    };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }

  // ---------- full names: press and hold an abbreviation (Settings: or tap it) ----------
  /* While held, the full name shows in a bubble and a Keep it open zone covers the top bar (as for a
     held plot): let go there and the bubble stays until the next tap. A choice always works by holding,
     since a tap picks it. */
  let swipeCancel = null, hold = null, kept = false, quietUntil = 0;
  function fullTip() {
    let t = $('#fulltip');
    if (!t) { t = document.createElement('div'); t.id = 'fulltip'; t.className = 'holdtip fulltip'; t.setAttribute('role', 'status'); t.hidden = true; document.body.append(t); }
    return t;
  }
  function showFull(el, keep) {
    const [kind, key] = el.dataset.full.split(/:(.*)/), t = fullTip();
    const cd = kind === 'mark' && /^CD\d/.test(key) && MARKERS[key].full ? '<span>CD: cluster of differentiation</span>' : '';
    t.innerHTML = `<span><b>${esc(nameOf(kind, key))}</b><span class="fullname">${esc(fullOf(kind, key))}</span>${cd}${keep ? '<span>Tap anywhere to close.</span>' : ''}</span>`;
    t.hidden = false; kept = !!keep;
    const r = el.getBoundingClientRect(), w = Math.min(360, innerWidth - 24);
    Object.assign(t.style, { width: w + 'px', left: Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px' });
    const above = r.top - 10 - t.offsetHeight, barB = $('#quiz .bar').getBoundingClientRect().bottom;
    t.style.top = (above > barB + 8 ? above : r.bottom + 10) + 'px';
  }
  function hideFull() { const t = $('#fulltip'); if (t) t.hidden = true; kept = false; }
  const latchEl = () => $('#latch');
  function drawKeep(on) {
    const I = FC.ICON;
    latchEl().innerHTML = `<div class="lz keep${on ? ' on' : ''}" data-lz="keep">${on ? I.lock : I.unlock}<span>${on ? 'Let go to keep it open' : 'Keep it open'}</span></div>`;
  }
  function onKeep(x, y) {
    const z = latchEl().firstElementChild; if (!z) return false;
    const r = z.getBoundingClientRect(), m = 14;
    return x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;
  }
  document.addEventListener('pointerdown', ev => {
    quietUntil = 0; // a new touch: its click is a real one
    const el = ev.target.closest('#quiz [data-full]'); if (!el || kept || Q.done && el.matches('.qopt')) return;
    if (!el.matches('.qopt') && FC.prefs.abbrOpen === 'tap') return; // the click opens it
    hold = { el, x: ev.clientX, y: ev.clientY, shown: false, on: false, timer: setTimeout(() => {
      if (!hold) return;
      hold.shown = true; if (swipeCancel) swipeCancel();
      showFull(el, false);
      const L = latchEl(), b = $('#quiz .bar').getBoundingClientRect();
      Object.assign(L.style, { top: b.top + 'px', height: b.height + 'px' }); L.classList.remove('tap'); drawKeep(false); L.hidden = false;
      if (navigator.vibrate) navigator.vibrate(10);
    }, 300) };
  }, true);
  const track = (x, y) => {
    if (!hold) return;
    if (!hold.shown) { if (Math.hypot(x - hold.x, y - hold.y) > 10) { clearTimeout(hold.timer); hold = null; } return; }
    const on = onKeep(x, y); if (on !== hold.on) { hold.on = on; drawKeep(on); if (on && navigator.vibrate) navigator.vibrate(10); }
  };
  addEventListener('pointermove', ev => track(ev.clientX, ev.clientY), true);
  addEventListener('touchmove', ev => { const t = ev.touches[0]; if (t) track(t.clientX, t.clientY); }, { capture: true, passive: true });
  document.addEventListener('touchmove', ev => { if (hold && hold.shown) ev.preventDefault(); }, { passive: false });
  // a hold ends however the touch ends (iOS can end a long press without a pointerup)
  function endFull() {
    if (!hold) return;
    const h = hold; hold = null; clearTimeout(h.timer);
    if (!h.shown) { if (!h.el.matches('.qopt')) FC.holdTip(h.el, 'Press and hold to see the full name.'); return; } // only tapped
    latchEl().hidden = true; quietUntil = performance.now() + 450; // the touch's own click doesn't pick the choice
    if (h.on) showFull(h.el, true); else hideFull();
  }
  for (const t of ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup', 'blur']) addEventListener(t, endFull, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) endFull(); });
  // a kept bubble closes on the next tap, which does nothing else
  document.addEventListener('click', ev => {
    if (performance.now() < quietUntil) { ev.stopPropagation(); ev.preventDefault(); return; }
    if (kept) { hideFull(); ev.stopPropagation(); ev.preventDefault(); return; }
    const el = ev.target.closest('#quiz .abbr[data-full]');
    if (el && FC.prefs.abbrOpen === 'tap') { showFull(el, true); ev.stopPropagation(); }
  }, true);
  document.querySelector('#quiz').addEventListener('contextmenu', ev => ev.preventDefault());

  // ---------- input ----------
  document.addEventListener('click', ev => {
    const inSettings = ev.target.closest('#settings');
    const k = ev.target.closest('[data-qkind]'), c = ev.target.closest('[data-qcells]');
    if (k || c) {
      if (k) { const kinds = Q.cfg.kinds, key = k.dataset.qkind; if (kinds[key] && Object.values(kinds).filter(Boolean).length === 1) return; kinds[key] = !kinds[key]; }
      else Q.cfg.cells = c.dataset.qcells;
      save('flowcyto.markers', Q.cfg);
      if (!$('#quiz').hidden && !Q.q) setup();
      if (inSettings) FC.openSettings();
      return;
    }
    if (!ev.target.closest('#quiz')) return;
    if (ev.target.closest('[data-qmenu]')) { location.hash = '/'; return; }
    if (ev.target.closest('[data-qsettings]')) return FC.openSettings();
    if (ev.target.closest('[data-qstart]')) return next();
    if (ev.target.closest('[data-qnext]')) return next();
    const yn = ev.target.closest('[data-yn]'); if (yn && !Q.done) return answer((yn.dataset.yn === 'yes') === Q.q.answer);
    const x = ev.target.closest('[data-qx]'); if (x && !Q.done) { const v = x.dataset.qx; Q.crossed.has(v) ? Q.crossed.delete(v) : (Q.crossed.add(v), Q.picked.delete(v)); return draw(); }
    const o = ev.target.closest('[data-qopt]'); if (o && !Q.done) { const v = o.dataset.qopt; Q.picked.has(v) ? Q.picked.delete(v) : (Q.picked.add(v), Q.crossed.delete(v)); return draw(); }
    if (ev.target.closest('[data-qcheck]')) { const q = Q.q, ok = q.correct.length === Q.picked.size && q.correct.every(x => Q.picked.has(x)); return answer(ok); }
  });
  document.addEventListener('keydown', ev => {
    if ($('#quiz').hidden || !Q.q) return;
    if (Q.q.kind === 'match' && !Q.done && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) answer((ev.key === 'ArrowRight') === Q.q.answer);
    else if (Q.done && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); next(); }
  });

  FC.markers = { open, close, modeHTML, kindsHTML, cellsHTML, makeQuestion: () => makeQuestion(), cfg: Q.cfg };
})();
