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
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cellPool = () => ENTITIES.filter(e => Q.cfg.cells === 'both' || e.kind === Q.cfg.cells).map(e => e.id);

  function makeQuestion() {
    // pick the kind first, then retry within it, so a kind that is harder to fill still gets its share
    const kinds = shuffle(Object.keys(KINDS).filter(k => Q.cfg.kinds[k]));
    for (let tries = 0; tries < 50 * kinds.length; tries++) {
      const kind = kinds[Math.floor(tries / 50)], pool = cellPool();
      if (kind === 'match') {
        const id = pick(pool), mks = markersFor(id), want = Math.random() < 0.5;
        const pickFrom = mks.filter(mk => reading(id, mk) === want);
        if (!pickFrom.length) continue;
        const mk = pick(pickFrom);
        return { kind, id, mk, answer: want };
      }
      if (kind === 'markers') {
        const id = pick(pool), mks = shuffle(markersFor(id));
        const pos = mks.filter(mk => reading(id, mk)), neg = mks.filter(mk => !reading(id, mk));
        if (!pos.length || !neg.length) continue;
        const nPos = Math.min(pos.length, 1 + Math.floor(Math.random() * 3)), opts = shuffle([...pos.slice(0, nPos), ...neg.slice(0, 5 - nPos)]);
        if (opts.length < 4) continue;
        return { kind, id, options: opts, correct: opts.filter(mk => reading(id, mk)) };
      }
      if (kind === 'cells') {
        const mk = pick(QUIZ_MARKERS), clear = shuffle(pool.filter(id => reading(id, mk) !== null && markersFor(id).includes(mk)));
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
  function close() { $('#quiz').hidden = true; }
  const bar = () => `<header class="bar"><div class="bar-in"><button class="iconbtn" data-qmenu aria-label="Main menu">${ICON.back}<span>Menu</span></button><div class="gtitle"><b>Markers</b><span>${Q.answered ? `${Q.score} of ${Q.answered} · streak ${Q.streak} · best ${best()}` : `best streak ${best()}`}</span></div><button class="iconbtn" data-qsettings aria-label="Settings">${ICON.gear}<span>Settings</span></button></div></header>`;
  // the quiz's own settings: shown on the start screen and at the top of Settings
  function modeHTML() {
    const c = Q.cfg, chip = (k, label) => `<button class="qchip" data-qkind="${k}" aria-pressed="${!!c.kinds[k]}">${c.kinds[k] ? ICON.yes : '<span class="ic"></span>'}<span>${label}</span></button>`;
    const seg = `<div class="seg" role="radiogroup">${[['normal', 'Normal cells'], ['neoplasm', 'Neoplasms'], ['both', 'Both']].map(([v, t]) => `<button role="radio" data-qcells="${v}" aria-checked="${c.cells === v}">${t}</button>`).join('')}</div>`;
    return `<div class="qchips">${chip('match', 'Does this cell carry this marker? Swipe right for yes, left for no')}${chip('cells', 'A marker: pick every cell that carries it')}${chip('markers', 'A cell: pick every marker it carries')}</div>
      <div class="qrow"><b>Cells</b>${seg}</div>`;
  }
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
        <div class="swipecard card" id="swipecard"><span class="qkind">Does it carry it?</span><b class="qterm qcell">${esc(e.name)}</b><span class="qand">and</span><b class="qterm qmark">${esc(mk.name)}</b><p class="help">Swipe right for yes, left for no.</p></div></div>`;
      if (!fb) h += `<div class="yn"><button class="btn big no" data-yn="no">${ICON.no}<span>No</span></button><button class="btn big yes" data-yn="yes">${ICON.yes}<span>Yes</span></button></div>`;
      return h;
    }
    const isCells = q.kind === 'cells';
    let h = `<section class="qcard card"><span class="qkind">${isCells ? 'Which cells carry it?' : 'Which markers does it carry?'} Pick all that apply.</span><b class="qbig">${esc(isCells ? mk.name : BY[q.id].name)}</b>${isCells && mk.note ? `<p class="help">${esc(mk.note)}</p>` : ''}<div class="qopts">`;
    for (const o of q.options) {
      const on = Q.picked.has(o), isRight = q.correct.includes(o);
      const x = !fb && Q.crossed.has(o);
      let cls = on ? 'on' : x ? 'crossed' : '', mark = on ? ICON.yes : '<span class="ic"></span>', tail = '';
      if (fb) { cls = isRight ? (on ? 'ok' : 'missed') : (on ? 'bad' : ''); mark = isRight ? ICON.yes : (on ? ICON.no : '<span class="ic"></span>'); tail = `<span class="otag">${isRight ? (on ? 'carries it' : 'carries it: missed') : (on ? "doesn't" : '')}</span>`; }
      const nm = esc(isCells ? BY[o].name : MARKERS[o].name);
      h += `<div class="qrow-opt"><button class="qopt ${cls}" data-qopt="${o}" ${fb ? 'disabled' : ''}>${mark}<span>${nm}</span>${tail}</button>${fb ? '' : `<button class="xout" data-qx="${o}" aria-pressed="${x}" aria-label="${x ? 'Restore' : 'Cross out'} ${nm}" title="${x ? 'Restore' : 'Cross out'}">${ICON.no}</button>`}</div>`;
    }
    h += '</div>';
    if (!fb) h += `<button class="btn primary big" data-qcheck ${Q.picked.size ? '' : 'disabled'}>Check</button>`;
    return h + '</section>';
  }
  // the verdict pops up over the bottom of the screen; the question stays visible above it
  function popupHTML() {
    const q = Q.q, mk = q.mk && MARKERS[q.mk];
    let body;
    if (q.kind === 'match') body = `<p class="qpop-line">${esc(BY[q.id].name)} is <b>${esc(mk.name)}${q.answer ? '+' : '−'}</b></p>${mk.note ? `<p class="help">${esc(mk.name)}: ${esc(mk.note)}</p>` : ''}`;
    else {
      const names = q.correct.map(o => esc(q.kind === 'cells' ? BY[o].name : MARKERS[o].name)).join(', ');
      body = `<p class="qpop-line">${q.kind === 'cells' ? `Carry ${esc(mk.name)}` : `${esc(BY[q.id].name)} carries`}: <b>${names}</b></p>${q.kind === 'markers' && BY[q.id].teach ? `<p class="help">${esc(BY[q.id].teach)}</p>` : ''}`;
    }
    return `<div class="qpop ${Q.right ? 'right' : 'wrong'}" role="status"><div class="qpop-in card"><div class="qpop-head">${Q.right ? ICON.yes : ICON.no}<b>${Q.right ? 'Right' : 'Not quite'}</b></div>${body}<button class="btn big qpop-next" data-qnext>Next</button></div></div>`;
  }
  function draw() {
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

  FC.markers = { open, close, modeHTML, makeQuestion: () => makeQuestion(), cfg: Q.cfg };
})();
