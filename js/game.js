/* FlowCyto: main menu, game screen, reference / scratch pad, settings, hints, saved board.
   Routes: '#/' is the menu; '#pops/medium/12345' is a board (mode/level/seed), so any board can be
   replayed. The board in progress is saved to localStorage and offered as Continue on the menu.
   A level is a set of switches (js/gen.js LEVELS; Custom builds its own): the game reads them from
   the board (S.cfg), never from the level's name. */
(function () {
  'use strict';
  const FC = window.FC;
  const { BY, ENTITIES, generate, renderPlot, shapeIcon, allowed, observed, markersOf, plotMarkers, fits, countSolutions, why, LEVELS, gateCode, geom, axes, axisVal, isFscSsc, isScatter } = FC;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const ICON = {
    no: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="var(--ink-2)" stroke-width="2.2" stroke-linecap="round"/></svg>',
    yes: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="var(--blue)" stroke="var(--ink)" stroke-width="1"/></svg>',
    right: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="var(--teal)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wrong: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="var(--pink)" stroke-width="2.4" stroke-linecap="round"/></svg>',
    close: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    eye: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.1" fill="currentColor"/></svg>',
    book: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.2c2-.9 3.8-.9 5.5.3 1.7-1.2 3.5-1.2 5.5-.3v9.6c-2-.9-3.8-.9-5.5.3-1.7-1.2-3.5-1.2-5.5-.3zM8 3.5v9.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    gear: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    more: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="12.5" cy="8" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const MARK_WORD = { no: 'ruled out', yes: 'chosen' };
  const MODES = {
    pops: { name: 'Name every population', short: 'Populations', blurb: 'Give every population in the tube an identity. None is used twice, so letters settle each other like a logic grid.',
      icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h26M3 21h26M12 3v26M21 3v26" stroke="currentColor" stroke-width="1.4"/><circle cx="7.5" cy="7.5" r="2.4" fill="currentColor"/><path d="M16.5 14.2l2.6 4.3h-5.2z" fill="currentColor"/></svg>' },
    clone: { name: 'Diagnose the clone', short: 'Diagnose', blurb: 'One population is abnormal. Read its markers against the background and strike out look-alike neoplasms until one is left.',
      icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="2.2" fill="currentColor"/></svg>' },
  };
  const LEVEL_NOTES = {
    easy: 'just the plots and cell types you need · reference filled in',
    medium: 'extra plots · a few cell types that aren\'t there · reference filled in',
    hard: 'like Medium, but you fill in the scratch pad',
    expert: 'no labels: you place every gate · just what you need',
    master: 'gates, extra plots and absent cell types · populations touch',
    extreme: 'gates, and you choose which cell types to consider · share-of-events question',
  };

  // ---------- storage (every access guarded: private windows may refuse) ----------
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const save = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stats/prefs just don't persist */ } };
  const prefs = Object.assign({ enlarge: 'hold', refOpen: 'hold', gscale: 1, autoCheck: false, timer: false, tours: {},
    custom: { pops: 4, gating: false, choose: false, decoys: true, extra: true, ref: 'filled', spread: 'normal', pct: false } }, load('flowcyto.prefs', {}));
  prefs.appearance = Object.assign({ mode: 'auto', light: 'default', dark: 'dark' }, prefs.appearance || {});
  const setPref = (k, v) => { prefs[k] = v; save('flowcyto.prefs', prefs); };
  /* Level changes keep their stats: 3→4 levels (old Hard became Extreme), then 4→6 (old Medium is
     closest to the new Hard, old gated Hard to Expert). A board in progress moves the same way. */
  function migrate(map, flag) {
    if (prefs[flag]) return;
    const st = load('flowcyto.stats', {}), cur = load('flowcyto.current', null);
    for (const [from, to] of map) {
      for (const m of Object.keys(MODES)) if (st[m + '/' + from] && !st[m + '/' + to]) { st[m + '/' + to] = st[m + '/' + from]; delete st[m + '/' + from]; }
      if (cur && cur.level === from && !cur.moved) { cur.level = to; cur.moved = true; }
    }
    save('flowcyto.stats', st); if (cur) { delete cur.moved; save('flowcyto.current', cur); }
    setPref(flag, true);
  }
  migrate([['hard', 'extreme']], 'levels4');
  migrate([['hard', 'expert'], ['medium', 'hard']], 'levels6');

  // ---------- daily boards: one per mode per day (local date), at Medium; a streak of days ----------
  const DAILY_LEVEL = 'medium';
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => dayKey(new Date());
  function dailySeed(mode, day = today()) { let h = 2166136261; for (const c of day + '/' + mode) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }
  const isDaily = () => !!S && S.level === DAILY_LEVEL && S.seed === dailySeed(S.mode);
  function streak() {
    const done = load('flowcyto.daily', {}), d = new Date();
    if (!(done[dayKey(d)] || []).length) d.setDate(d.getDate() - 1); // today still counts until it's over
    let n = 0; while ((done[dayKey(d)] || []).length) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const fmtTime = ms => { const t = Math.round(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  // ---------- appearance: Auto / Light / Dark, plus which light and which dark theme (as in Pathways) ----------
  const darkScheme = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    const a = prefs.appearance, dark = a.mode === 'dark' || (a.mode === 'auto' && !!(darkScheme && darkScheme.matches));
    document.documentElement.setAttribute('data-theme', dark ? a.dark : a.light);
    document.documentElement.style.setProperty('--gs', prefs.gscale);
    syncStatusBar();
  }
  /* iOS paints the status bar (and Android the browser bar) in theme-color. Match it to whatever sits
     right under it, the game's top bar or the menu page, so the two read as one surface. */
  function syncStatusBar() {
    const el = !$('#game').hidden ? $('.bar') : document.body;
    const m = document.querySelector('meta[name="theme-color"]');
    if (el && m) m.setAttribute('content', getComputedStyle(el).backgroundColor);
  }
  if (darkScheme && darkScheme.addEventListener) darkScheme.addEventListener('change', () => { if (prefs.appearance.mode === 'auto') applyTheme(); });
  const THEME_SWATCH = { default: ['#1d5fa8', '#ffffff', '#1d5fa8'], light: ['#f6f7f9', '#ffffff', '#1d5fa8'], dark: ['#0f1217', '#181d25', '#7fb2ea'], black: ['#000000', '#0e0f12', '#7fb2ea'] };
  // A theme drawn as a tiny page (background, a card, an accent bar) plus its name, so it never rests on color alone.
  const themeChoice = (group, v, label) => { const [bg, card, acc] = THEME_SWATCH[v], on = prefs.appearance[group] === v;
    return `<button class="theme-pick" data-theme-set="${group}" data-v="${v}" role="radio" aria-checked="${on}"><span class="theme-sw" style="background:${bg}"><span style="background:${card}"><i style="background:${acc}"></i></span></span><span>${label}${on ? ' ' + ICON.right.replace('var(--teal)', 'currentColor') : ''}</span></button>`; };

  let S = null;

  // ---------- routing ----------
  const LEVEL_KEYS = [...Object.keys(LEVELS), 'custom'];
  function route() {
    const [m, l, s] = location.hash.replace(/^#\/?/, '').split('/');
    if (MODES[m] && LEVEL_KEYS.includes(l)) {
      const cur = load('flowcyto.current', null);
      if (cur && cur.mode === m && cur.level === l && String(cur.seed) === s) return startGame(m, l, +s, cur);
      return startGame(m, l, +s || 0);
    }
    showMenu();
  }
  const play = (mode, level, seed) => { location.hash = `${mode}/${level}/${seed || ((Math.random() * 1e9) >>> 0)}`; };

  // ---------- main menu ----------
  function showMenu() {
    if (S) { pauseTimer(); persist(); }
    S = null; endTour(); closeRef(true);
    $('#game').hidden = true; $('#menu').hidden = false;
    document.title = 'FlowCyto';
    const stats = load('flowcyto.stats', {}), cur = load('flowcyto.current', null);
    let h = `<main class="menu-in"><div class="menu-top"><div class="logo on-page"><svg width="56" height="56" viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 3v16M3 11h16" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/><circle cx="7" cy="15" r="2.2" fill="currentColor"/><path d="M15 4.6l2.2 3.6h-4.4z" fill="currentColor"/></svg><div><h1>FlowCyto</h1><p>Flow cytometry logic puzzles for STEP 1</p></div></div><button class="gearbtn" data-settings aria-label="Settings" title="Settings">${ICON.gear}</button></div>`;
    if (cur && cur.phase !== 'done' && MODES[cur.mode] && LEVEL_KEYS.includes(cur.level)) {
      h += `<button class="card cont" data-continue><span class="cont-k">Continue</span><b>${esc(MODES[cur.mode].name)}</b><span>${levelLabel(cur.level)} · board ${cur.seed} · ${plural(cur.wrongChecks || 0, 'mistake')}</span><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    }
    const daily = load('flowcyto.daily', {})[today()] || [], st = streak();
    h += `<section class="card daily"><div class="dhead"><h2>Daily boards</h2><span class="streak">${plural(st, 'day')} in a row</span></div><p>A new board for each mode every day, at Medium.</p><div class="dbtns">${Object.entries(MODES).map(([m, M]) => {
      const done = daily.includes(m);
      return `<button class="dbtn${done ? ' done' : ''}" data-daily="${m}"><span class="micon">${M.icon}</span><b>${M.name}</b><span>${done ? ICON.right + ' solved today' : 'play today\'s'}</span></button>`; }).join('')}</div></section>`;
    for (const [m, M] of Object.entries(MODES)) {
      h += `<section class="card mcard"><div class="mhead"><span class="micon">${M.icon}</span><h2>${M.name}</h2></div><p>${M.blurb}</p><div class="lvls">`;
      for (const [l, L] of Object.entries(LEVELS)) {
        const sv = stats[m + '/' + l];
        h += `<button class="lvl" data-play="${m}/${l}" title="${esc(LEVEL_NOTES[l])}"><b>${L.label}</b><span>${sv ? `${sv.solved} solved` : 'new'}${prefs.timer && sv && sv.best ? ` · ${fmtTime(sv.best)}` : ''}</span></button>`;
      }
      const sc = stats[m + '/custom'];
      h += `</div><button class="lvl custom" data-custom="${m}"><b>Custom</b><span>${sc ? `${sc.solved} solved · ` : ''}choose every setting</span></button></section>`;
    }
    h += `<section class="card legend"><h2>Levels</h2><dl>${Object.entries(LEVELS).map(([l, L]) => `<dt>${L.label}</dt><dd>${LEVEL_NOTES[l]}</dd>`).join('')}</dl></section></main>`;
    $('#menu').innerHTML = h;
    syncStatusBar();
  }
  const levelLabel = l => l === 'custom' ? 'Custom' : LEVELS[l].label;
  $('#menu').addEventListener('click', ev => {
    const p = ev.target.closest('[data-play]'); if (p) { const [m, l] = p.dataset.play.split('/'); return play(m, l); }
    const dl = ev.target.closest('[data-daily]'); if (dl) return play(dl.dataset.daily, DAILY_LEVEL, dailySeed(dl.dataset.daily));
    if (ev.target.closest('[data-continue]')) { const c = load('flowcyto.current', null); return play(c.mode, c.level, c.seed); }
    const cu = ev.target.closest('[data-custom]'); if (cu) return openCustom(cu.dataset.custom);
    if (ev.target.closest('[data-settings]')) openSettings();
  });

  // ---------- custom level ----------
  const csheet = $('#acts');
  function openCustom(mode) {
    const c = prefs.custom;
    const seg = (k, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, t]) => `<button role="radio" data-cset="${k}" data-v="${v}" aria-checked="${String(c[k]) === String(v)}">${t}</button>`).join('')}</div>`;
    let h = `<div class="set-head"><h2>Custom · ${MODES[mode].short}</h2><button class="iconbtn" data-close aria-label="Close">${ICON.close}</button></div>`;
    h += `<div class="set-row"><div><b>Labels</b><span>Labeled populations, or unlabeled events you gate yourself.</span></div>${seg('gating', [[false, 'Labeled'], [true, 'Gates']])}</div>`;
    h += `<div class="set-row"><div><b>Populations</b></div>${seg('pops', [[3, '3'], [4, '4'], [5, '5']])}</div>`;
    h += `<div class="set-row"><div><b>Plots</b><span>Just the ones you need, or extra ones that may or may not help.</span></div>${seg('extra', [[false, 'Needed'], [true, 'Extra']])}</div>`;
    h += `<div class="set-row"><div><b>Answer choices</b><span>Only what's there, with look-alikes that aren't, or chosen by you from every cell type.</span></div>${seg('choice', [['present', 'Present'], ['decoys', 'Look-alikes'], ['choose', 'You choose']])}</div>`;
    h += `<div class="set-row"><div><b>Reference</b></div>${seg('ref', [['filled', 'Filled in'], ['blank', 'Scratch pad']])}</div>`;
    h += `<div class="set-row"><div><b>Populations look</b></div>${seg('spread', [['distinct', 'Distinct'], ['normal', 'Normal'], ['touching', 'Touching']])}</div>`;
    h += `<div class="set-row"><div><b>Share-of-events question</b></div>${seg('pct', [[false, 'Off'], [true, 'On']])}</div>`;
    h += `<div class="actions end"><button class="btn primary" data-cplay="${mode}">Play</button></div>`;
    csheet.innerHTML = h; csheet.dataset.kind = 'custom';
    if (!csheet.open) csheet.showModal();
  }
  // the "Answer choices" switch reads and writes two stored flags
  Object.defineProperty(prefs.custom, 'choice', { get() { return this.choose ? 'choose' : this.decoys ? 'decoys' : 'present'; }, enumerable: false, configurable: true });

  // ---------- game ----------
  function startGame(mode, level, seed, saved) {
    seed = seed || ((Math.random() * 1e9) >>> 0);
    const custom = level === 'custom' ? ((saved && saved.custom) || Object.assign({}, prefs.custom)) : null;
    const P = generate(seed, level, mode, custom);
    endTour(); closeRef(true);
    S = { mode, level, seed, P, cfg: P.cfg, custom, marks: {}, checked: {}, wrongChecks: 0, hints: 0, peeks: new Set(), pad: {}, refRow: null,
      cols: P.choose ? [] : P.pool.slice(), refs: P.choose ? [] : P.pool.slice(),
      focus: null, phase: 'play', pctPick: null, msg: null, flash: null, elapsed: 0, t0: null, undo: [], why: null };
    if (saved) Object.assign(S, { marks: saved.marks || {}, checked: saved.checked || {}, wrongChecks: saved.wrongChecks || 0, hints: saved.hints || 0, peeks: new Set(saved.peeks || []), pad: saved.pad || {}, phase: saved.phase || 'play', pctPick: saved.pctPick || null, msg: saved.msg || null, stats: saved.stats, elapsed: saved.elapsed || 0, cols: saved.cols || S.cols, refs: saved.refs || S.refs });
    if (gating()) {
      S.gates = (saved && saved.gates) || P.plots.map(() => null); // nothing placed: the player sets every gate
      S.sigSlot = (saved && saved.sigSlot) || {}; S.slotSig = {};
      S.cloneRow = (saved && saved.cloneRow) || null;
      regroup();
    }
    $('#game').classList.toggle('gating', gating());
    if (location.hash.slice(1) !== `${mode}/${level}/${seed}`) history.replaceState(null, '', `#${mode}/${level}/${seed}`);
    $('#menu').hidden = true; $('#game').hidden = false;
    $('#gMode').innerHTML = `<span class="long">${MODES[mode].name}</span><span class="short">${MODES[mode].short}</span>`;
    $('#gLevel').textContent = levelLabel(level);
    $('#specName').textContent = P.specName;
    $('#boardId').textContent = isDaily() ? `daily · ${today()}` : `board ${seed}`;
    document.title = `FlowCyto · ${MODES[mode].name}`;
    resumeTimer(); tickTimer(); syncStatusBar();
    drawPlots(); drawPanel();
    const tk = tourKey();
    if (S.phase === 'play' && !prefs.tours[tk]) setTimeout(() => { if (S && S.seed === seed) startTour(tk); }, 350);
  }

  // ---------- timer (Settings → Timer; always kept for personal bests, shown only when on) ----------
  const elapsedNow = () => S ? S.elapsed + (S.t0 != null ? performance.now() - S.t0 : 0) : 0;
  function pauseTimer() { if (S && S.t0 != null) { S.elapsed = elapsedNow(); S.t0 = null; } }
  function resumeTimer() { if (S && S.phase === 'play' && !document.hidden && S.t0 == null) S.t0 = performance.now(); }
  function tickTimer() {
    const t = $('#timer'); if (!S) return;
    t.hidden = !prefs.timer; if (prefs.timer) t.textContent = ' · ' + fmtTime(elapsedNow());
  }
  setInterval(tickTimer, 1000);
  document.addEventListener('visibilitychange', () => { if (!S) return; if (document.hidden) { pauseTimer(); persist(); } else resumeTimer(); });

  // ---------- undo: takes back marks, pad entries, grid edits, gate moves and hint steps (not the tally) ----------
  function pushUndo() {
    if (!S || S.phase !== 'play') return;
    S.undo.push(JSON.stringify({ marks: S.marks, checked: S.checked, pad: S.pad, cols: S.cols, refs: S.refs, gates: S.gates, sigSlot: S.sigSlot, slotSig: S.slotSig, cloneRow: S.cloneRow }));
    if (S.undo.length > 200) S.undo.shift();
  }
  function undo() {
    if (!S || !S.undo.length || S.phase !== 'play') return;
    Object.assign(S, JSON.parse(S.undo.pop()));
    if (gating()) regroup();
    S.msg = null; drawPlots(); drawPanel(); if (refIsOpen()) drawRef();
  }
  function persist() {
    if (!S) return;
    save('flowcyto.current', { mode: S.mode, level: S.level, seed: S.seed, custom: S.custom, marks: S.marks, checked: S.checked, wrongChecks: S.wrongChecks, hints: S.hints, peeks: [...S.peeks], pad: S.pad, cols: S.cols, refs: S.refs, phase: S.phase, pctPick: S.pctPick, msg: S.msg, stats: S.stats, gates: S.gates, sigSlot: S.sigSlot, cloneRow: S.cloneRow, elapsed: elapsedNow() });
  }

  const shownPlots = () => S.P.plots.map(p => [p.x, p.y]);
  const target = () => S.P.pops.find(p => p.label === S.P.target);
  const popTag = p => `${shapeIcon(p.slot)} <b>${p.label}</b>`;
  const refFilled = () => S.cfg.ref === 'filled';
  const choosing = () => !!S.cfg.choose;
  const axisCaption = pl => pl.x === 'LC' ? 'kappa → · lambda ↑' : `${pl.x} → · ${pl.y} ↑`;
  const plotName = pl => pl.x === 'LC' ? 'kappa / lambda' : pl.x + ' / ' + pl.y;

  // ---------- gated levels: the player's quad gates define the groups ----------
  /* Every event gets a signature: which part of each plot's gate it falls in (a plot with no gate yet
     says nothing). Each signature big enough to matter (2% of events) is a group, painted with its own
     letter, shape and color in every plot. Good gates give one group per population; a gate through a
     cluster splits it, a gate on the wrong side merges two. A population that is partly positive by
     nature (normal B cells: kappa and lambda; CD23; hematogones maturing) shows as two clusters even
     with perfect gates, so groups of one population that differ only on such a marker are merged.
     Letters stick to their cluster. */
  const gating = () => !!(S && S.cfg.gating);
  // Is population p naturally split on this axis (so a gate there is right to cut it)?
  function naturallySplit(p, mk) {
    if (mk === 'LCk' || mk === 'LCl') return p.lc === 'poly';
    if (mk === 'FSC' || mk === 'SSC') return false;
    return observed(p, mk) === 'split';
  }
  function regroup() {
    const P = S.P, n = P.pops.length, total = P.events.reduce((a, e) => a + e.length, 0);
    if (!S.gates.some(Boolean)) { S.groups = []; S.extraGroups = 0; S.paint = P.events.map(e => e.map(() => -1)); return; }
    const sig = P.events.map(evs => evs.map(e => P.plots.map((pl, i) => gateCode(e, pl, S.gates[i])).join('')));
    const tally = new Map();
    sig.forEach((arr, k) => arr.forEach(x => { let g = tally.get(x); if (!g) tally.set(x, g = { sig: x, n: 0, by: new Array(n).fill(0) }); g.n++; g.by[k]++; }));
    let big = [...tally.values()].filter(g => g.n >= Math.max(8, total * 0.02)).sort((a, b) => b.n - a.n);
    // merge clusters of one population that differ only where it is naturally split
    const major = g => g.by.indexOf(Math.max(...g.by));
    const onlyNatural = (a, b, p) => [...a.sig].every((c, i) => {
      if (c === b.sig[i]) return true;
      const [xm, ym] = axes(P.plots[i]), d = (+c) ^ (+b.sig[i]);
      if (isFscSsc(P.plots[i])) return false;
      return (!(d & 2) || naturallySplit(p, xm)) && (!(d & 1) || naturallySplit(p, ym));
    });
    const merged = [];
    for (const g of big) {
      const k = major(g), p = P.pops[k];
      const host = g.by[k] / g.n >= 0.85 && merged.find(m => major(m) === k && m.by[k] / m.n >= 0.85 && m.members.some(x => onlyNatural(x, g, p)));
      if (host) { host.members.push(g); host.n += g.n; g.by.forEach((v, i) => { host.by[i] += v; }); }
      else merged.push({ sig: g.sig, n: g.n, by: g.by.slice(), members: [g] });
    }
    // A small tail of one population (under a quarter of it) beside its main cluster is stragglers, not
    // a group: drawn gray and never counted. A gate through the middle of a cluster still splits it.
    const size = P.events.map(e => e.length);
    big = merged.filter(g => { const k = major(g); return !(g.by[k] < 0.25 * size[k] && merged.some(h => h !== g && major(h) === k && h.by[k] > g.by[k])); });
    const slotOf = {}, used = new Set();
    for (const g of big) { const x = S.sigSlot[g.sig]; if (x != null && !used.has(x)) { slotOf[g.sig] = x; used.add(x); } }
    for (const g of big) if (slotOf[g.sig] == null) { const f = [0, 1, 2, 3, 4].find(x => !used.has(x)); if (f != null) { slotOf[g.sig] = f; used.add(f); } }
    // a letter that now names a different cluster loses its old marks
    for (const [sg, slot] of Object.entries(slotOf)) {
      const L = 'ABCDE'[slot];
      if (S.slotSig[slot] && S.slotSig[slot] !== sg) { for (const k of Object.keys(S.marks)) if (k.startsWith(L + '|')) delete S.marks[k]; delete S.checked[L]; if (S.cloneRow === L) S.cloneRow = null; }
      S.slotSig[slot] = sg;
    }
    S.sigSlot = slotOf;
    S.extraGroups = big.filter(g => slotOf[g.sig] == null).length;
    S.groups = big.filter(g => slotOf[g.sig] != null).map(g => { const k = major(g); return { slot: slotOf[g.sig], label: 'ABCDE'[slotOf[g.sig]], pop: P.pops[k], purity: g.by[k] / g.n, n: g.n }; }).sort((a, b) => a.slot - b.slot);
    const slotByRaw = {};
    for (const g of big) for (const m of g.members) if (slotOf[g.sig] != null) slotByRaw[m.sig] = slotOf[g.sig];
    S.paint = sig.map(arr => arr.map(x => slotByRaw[x] != null ? slotByRaw[x] : -1));
  }
  /* The rows the player names: populations (labeled boards) or the player's groups (gated). */
  const rows = () => gating() ? S.groups.map(g => ({ label: g.label, slot: g.slot, pop: g.pop, purity: g.purity }))
    : S.P.pops.map(p => ({ label: p.label, slot: p.slot, pop: p, purity: 1 }));
  const rowTag = r => `${shapeIcon(r.slot)} <b>${r.label}</b>`;
  const cloneRowObj = () => gating() ? rows().find(r => r.label === S.cloneRow) : { label: target().label, slot: target().slot, pop: target(), purity: 1 };

  /* Options for drawing plot i. Small tiles on phones draw compact (smaller viewBox, no axis text) so
     clusters and badges stay legible; the enlarged view always draws full. */
  function plotOpts(i, full) {
    const compact = !full && !!S.compact, size = compact ? 160 : 240;
    if (!gating()) return { size, compact, focus: S.mode === 'clone' ? target().slot : S.focus };
    const cr = S.mode === 'clone' ? cloneRowObj() : null;
    const labels = 'ABCDE'.split('').map((l, slot) => S.groups.some(g => g.slot === slot) ? l : null);
    return { size, compact, focus: S.mode === 'clone' ? (cr ? cr.slot : null) : S.focus, labels: 'none', paint: S.paint, paintLabels: labels, gate: S.gates[i] || 'none' };
  }
  function drawPlots() {
    $('#plots').innerHTML = S.P.plots.map((pl, i) => `<figure data-plot="${i}" class="${S.flash === i ? 'flash' : ''}">${renderPlot(S.P, pl, plotOpts(i))}<figcaption>${S.compact ? axisCaption(pl) : plotName(pl)}</figcaption></figure>`).join('');
    fitPlots();
  }

  /* Every plot on screen at once: pick the column count that gives the biggest square plots in the
     space left above (phones) or beside (desktop) the answer. Press-and-hold or tap shows one large. */
  function fitPlots() {
    const grid = $('#plots'); if (!S || !grid.clientWidth) return;
    const n = S.P.plots.length, W = grid.clientWidth, H = grid.clientHeight, gap = 8, pad = 10, cap = 16;
    let best = { s: 0, c: 1 };
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c);
      const s = Math.min((W - gap * (c - 1)) / c - pad, (H - gap * (r - 1)) / r - pad - cap);
      if (s > best.s) best = { s, c };
    }
    const s = Math.max(64, Math.min(330, Math.floor(best.s)));
    const compact = s < 170;
    if (compact !== !!S.compact) { S.compact = compact; return drawPlots(); }
    grid.style.setProperty('--plot', s + 'px');
    grid.style.gridTemplateColumns = `repeat(${best.c}, ${s + pad}px)`;
    grid.classList.toggle('tiny', s < 150);
  }

  // ---------- the two grids: answer columns (S.cols) and reference rows (S.refs) ----------
  /* Normally both are the board's fixed list. On "you choose" boards both start empty and stay in step:
     adding to either adds to both; removing from the answer grid keeps the reference row; removing a
     reference row removes its answer column; changing one keeps the other's old entry when it already
     holds work (marks or pad entries) and adds the new one beside it. */
  const colHasWork = id => Object.keys(S.marks).some(k => k.endsWith('|' + id));
  const refHasWork = id => S.peeks.has(id) || Object.keys(S.pad).some(k => k.startsWith(id + '|'));
  const addTo = (list, id) => { if (!list.includes(id)) list.push(id); };
  function addCol(id) { addTo(S.cols, id); addTo(S.refs, id); }
  function addRef(id) { addTo(S.refs, id); addTo(S.cols, id); }
  function dropMarks(id) { for (const k of Object.keys(S.marks)) if (k.endsWith('|' + id)) delete S.marks[k]; delete S.checked[id]; }
  function removeCol(id) { S.cols = S.cols.filter(x => x !== id); dropMarks(id); }
  function removeRef(id) { S.refs = S.refs.filter(x => x !== id); for (const k of Object.keys(S.pad)) if (k.startsWith(id + '|')) delete S.pad[k]; removeCol(id); }
  function swapIn(list, old, nu) { const i = list.indexOf(old); if (list.includes(nu)) return list.filter(x => x !== old); const out = list.slice(); out[i] = nu; return out; }
  function changeCol(old, nu) {
    const keepRef = refHasWork(old);
    dropMarks(old); S.cols = swapIn(S.cols, old, nu);
    if (keepRef) addTo(S.refs, nu); else if (S.refs.includes(old)) S.refs = swapIn(S.refs, old, nu); else addTo(S.refs, nu);
  }
  function changeRef(old, nu) {
    const keepCol = colHasWork(old);
    for (const k of Object.keys(S.pad)) if (k.startsWith(old + '|')) delete S.pad[k];
    S.refs = swapIn(S.refs, old, nu);
    if (keepCol) addTo(S.cols, nu); else if (S.cols.includes(old)) S.cols = swapIn(S.cols, old, nu); else addTo(S.cols, nu);
  }
  /* The cell types you can add: every one in the catalog this board allows, normal cells first. */
  function catalogOptions(exclude) {
    const ids = S.P.pool.filter(id => !exclude.includes(id));
    const group = (kind, title) => { const g = ids.filter(id => BY[id].kind === kind).sort((a, b) => BY[a].name.localeCompare(BY[b].name)); return g.length ? `<optgroup label="${title}">${g.map(id => `<option value="${id}">${esc(BY[id].name)}</option>`).join('')}</optgroup>` : ''; };
    return group('normal', 'Normal cells') + group('neoplasm', 'Neoplasms');
  }
  const addSelect = (attr, label, exclude) => `<label class="addsel"><span class="addsel-face">${ICON.plus}<span>${label}</span></span><select ${attr} aria-label="${label}"><option value="" selected disabled>${label}</option>${catalogOptions(exclude)}</select></label>`;

  // ---------- reference / scratch pad: markers sorted by cell type ----------
  // Filled levels: a read-only reference. Scratch-pad levels: the player fills it in; the eye reveals a
  // row from the key and counts as a peek. Opens over the board (tap, or press and hold: Settings).
  const PAD_CYCLE = { LC: ['one', 'both', 'none'], SSC: ['low', 'mid', 'high'], CD45: ['+', 'dim', '−'] };
  const PAD_TEXT = { one: '1', both: '2', none: '−', low: 'lo', mid: 'mid', high: 'hi' };
  const padCycle = mk => PAD_CYCLE[mk] || ['+', '−', '±'];
  const padClass = v => (v === '+' || v === 'dim' || v === 'one' || v === 'both') ? 'p' : (v === '−' || v === 'none') ? 'n' : v === '±' ? 's' : '';
  function truth(id, mk) {
    const e = BY[id], a = allowed(e, mk);
    if (mk === 'LC') return e.m.LC === 'clonal' ? 'one' : e.m.LC === 'poly' ? 'both' : 'none';
    if (mk === 'SSC') return a[0];
    if (a.length > 1 || a[0] === 'split') return '±';
    return { neg: '−', pos: '+', dim: 'dim' }[a[0]];
  }
  const padFilled = id => refFilled() || S.peeks.has(id);
  const refTitle = () => refFilled() ? 'Reference' : 'Scratch pad';
  function refHTML() {
    const mks = markersOf(shownPlots()), ro = refFilled(), left = S.refs.filter(id => !S.peeks.has(id)).length;
    let h = `<div class="ref-head"><h2>${ICON.book} ${refTitle()}</h2><button class="iconbtn" data-refclose aria-label="Close">${ICON.close}</button></div>`;
    h += `<p class="sub">${ro ? 'Each cell type on offer, read on the markers these plots show.' : 'Sort the markers by cell type from memory: tap a cell to cycle its value. The eye fills a row from the key and counts as a peek; anything you had wrong gets a wavy underline.'}</p>`;
    if (!S.refs.length) h += `<p class="empty">No cell types yet. Add the ones you want to consider; they join the answer grid too.</p>`;
    else {
      h += `<div class="gridwrap"><table class="pad ${ro ? 'ro' : 'ed'}"><thead><tr><th></th>${mks.map(mk => `<th scope="col">${mk === 'LC' ? 'κ/λ' : esc(mk)}</th>`).join('')}${ro ? '' : '<th></th>'}</tr></thead><tbody>`;
      for (const id of S.refs) {
        const filled = padFilled(id);
        const name = choosing() ? `<button class="rowh" data-refmenu="${id}">${esc(BY[id].name)}</button>` : esc(BY[id].name);
        h += `<tr class="${S.refRow === id ? 'hl' : ''}" data-padrow="${id}"><th scope="row" title="${esc(BY[id].long)}">${name}</th>`;
        for (const mk of mks) {
          const mine = S.pad[id + '|' + mk];
          if (filled) {
            const v = truth(id, mk), diff = mine && mine !== v;
            h += `<td class="pv ${padClass(v)}${diff ? ' diff' : ''}"${diff ? ` title="you had ${esc(PAD_TEXT[mine] || mine)}"` : ''}><span>${esc(PAD_TEXT[v] || v)}</span></td>`;
          } else {
            h += `<td class="pv ${padClass(mine)}"><button data-pad="${id}|${mk}" aria-label="${esc(BY[id].name)}, ${esc(mk)}: ${mine ? esc(mine) : 'blank'}">${mine ? esc(PAD_TEXT[mine] || mine) : ''}</button></td>`;
          }
        }
        if (!ro) h += `<td class="rv">${filled ? '<span class="tally" title="peeked">seen</span>' : `<button class="reveal" data-reveal="${id}" aria-label="Reveal ${esc(BY[id].name)} (counts as a peek)" title="Reveal (counts as a peek)">${ICON.eye}</button>`}</td>`;
        h += '</tr>';
      }
      h += '</tbody></table></div>';
    }
    h += `<div class="ref-foot">${choosing() ? addSelect('data-addref', 'Add a cell type', S.refs) : ''}${!ro && left ? `<button class="btn" data-fill>Fill in from the key (${plural(left, 'peek')})</button>` : ''}</div>`;
    return h + '<p class="help">± partly positive, or varies by patient · κ/λ: 1 = one light chain (clonal), 2 = both, − = none · SSC lo / mid / hi.</p>';
  }
  const refPane = $('#refpane');
  const refIsOpen = () => !refPane.hidden;
  let refHeld = false, refAt = 0;
  function drawRef() { refPane.innerHTML = `<div class="refpane-in card">${refHTML()}</div>`; fitGrid(refPane.querySelector('.pad'), refPane.querySelector('.gridwrap')); }
  function openRef(row) {
    if (!S) return;
    if (row) S.refRow = row;
    drawRef(); refPane.hidden = false; refAt = performance.now();
    const r = row && refPane.querySelector(`[data-padrow="${row}"]`); if (r) r.scrollIntoView({ block: 'nearest' });
  }
  function closeRef(silent) { refPane.hidden = true; refPane.innerHTML = ''; refHeld = false; if (!silent && S) drawPanel(); }
  function fillReference() {
    if (refFilled()) return;
    for (const id of S.refs) S.peeks.add(id);
    openRef(); drawPanel();
  }

  /* Grid sizing: cells as big as the space allows (answer cells up to finger size; reference cells
     smaller, since the read-only ones aren't touched), scaled by Settings → Grid size. A grid that fits
     is centered; one that doesn't scrolls sideways with its name column pinned. */
  function fitGrid(table, wrap) {
    if (!table || !wrap) return;
    const gs = +prefs.gscale || 1, n = table.querySelector('tr').children.length - 1;
    const head = table.classList.contains('lgrid') ? 64 : 116, avail = wrap.clientWidth - head * gs;
    const answer = table.classList.contains('lgrid');
    // A few answer columns get wide cells with their names written across (no tall sideways labels).
    const flat = answer && n > 0 && n <= 4 && avail / n >= 64 * gs;
    const [lo, hi] = answer ? (flat ? [64, 96] : [30, 46]) : table.classList.contains('ro') ? [24, 32] : [34, 40];
    const cell = Math.max(lo * gs, Math.min(hi * gs, Math.floor(avail / Math.max(1, n))));
    table.classList.toggle('flat', flat);
    table.style.setProperty('--cell', cell + 'px');
    table.style.setProperty('--row', (flat ? Math.min(46, cell * 0.62) : cell) + 'px');
    wrap.classList.toggle('scrolls', table.scrollWidth > wrap.clientWidth + 1);
  }

  // ---------- answer panel ----------
  function tallyText() {
    return `${plural(S.wrongChecks, 'mistake')} · ${plural(S.hints, 'hint')}${refFilled() ? '' : ' · ' + plural(S.peeks.size, 'peek')}`;
  }
  function drawPanel() {
    const P = S.P, el = $('#panel'), play = S.phase === 'play';
    const tally = `<span class="tally">${tallyText()}${prefs.autoCheck ? ' · auto-check on' : ''}</span>`;
    let h = `<div class="ans-head"><h2>${S.mode === 'pops' ? 'Answer' : 'Diagnosis'}</h2><button class="refbtn" id="refBtn">${ICON.book}<span>${refTitle()}</span></button></div>`;
    if (S.mode === 'pops') {
      if (gating()) h += `<p class="gstat">${S.gates.some(Boolean) ? `${plural(S.groups.length, 'group')}${S.extraGroups ? ` (+${S.extraGroups} too many to letter)` : ''}` : 'No gates yet: drag on a plot to place one'} · this tube has ${P.pops.length} populations</p>`;
      else h += `<p class="sub">Give each letter an identity; none is used twice. Tap a cell: ruled out, then chosen, then blank. Tap a letter to highlight it in every plot.</p>`;
      if (!S.cols.length) h += `<p class="empty">Choose which cell types to consider. They join the scratch pad too.</p>`;
      h += `<div class="gridwrap"><table class="lgrid"><thead><tr><th></th>${S.cols.map(id => `<th><button class="colh" data-colh="${id}" title="${esc(BY[id].long)}">${esc(BY[id].name)}</button></th>`).join('')}${choosing() && play ? `<th class="addcol">${addSelect('data-addcol', 'Add', S.cols)}</th>` : ''}</tr></thead><tbody>`;
      for (const p of rows()) {
        const c = S.checked[p.label];
        h += `<tr data-row="${p.label}" class="${S.focus === p.slot ? 'focus' : ''}"><th data-focus="${p.label}">${rowTag(p)}${c ? `<span class="rowmark ${c}">${ICON[c]}<span>${c}</span></span>` : ''}</th>`;
        for (const id of S.cols) {
          const m = S.marks[p.label + '|' + id];
          h += `<td class="${m || ''}"><button data-cell="${p.label}|${id}" ${play ? '' : 'disabled'} aria-label="${p.label}, ${esc(BY[id].name)}: ${m ? MARK_WORD[m] : 'blank'}">${m ? ICON[m] : ''}</button></td>`;
        }
        if (choosing() && play) h += '<td class="addcol"></td>';
        h += '</tr>';
      }
      h += '</tbody></table></div>';
      const ready = rows().length > 0 && rows().every(p => S.cols.some(id => S.marks[p.label + '|' + id] === 'yes'));
      if (play) h += `<div class="actions">${prefs.autoCheck ? '' : `<button class="btn primary" data-act="check" ${ready ? '' : 'disabled'}>Check</button>`}${tally}</div>`;
    } else {
      if (gating()) {
        h += `<p class="gstat">${S.gates.some(Boolean) ? plural(S.groups.length, 'group') : 'No gates yet: drag on a plot to place one'} · find the abnormal group</p>`;
        h += `<div class="gpick"><span>Abnormal group:</span>${rows().map(r => `<button class="gchip" data-crow="${r.label}" aria-pressed="${S.cloneRow === r.label}" ${play ? '' : 'disabled'}>${rowTag(r)}</button>`).join('') || '<span class="muted">none yet</span>'}</div>`;
      } else {
        h += `<p class="sub">Population ${popTag(target())} is abnormal; the rest is faded background. Tap a name: ruled out, then chosen, then blank.</p>`;
      }
      if (!S.cols.length) h += `<p class="empty">Choose which neoplasms to consider. They join the scratch pad too.</p>`;
      h += '<div class="dxlist">';
      for (const id of S.cols) {
        const m = S.marks['dx|' + id], c = S.checked[id];
        h += `<div class="dxrow"><button class="dx ${m || ''}" data-dx="${id}" ${play ? '' : 'disabled'}>${m ? ICON[m] : '<span class="ic"></span>'}<span class="nm">${esc(BY[id].name)}</span>${c ? `<span class="rowmark ${c}">${ICON[c]}<span>${c}</span></span>` : ''}</button><button class="padlink" data-colh="${id}" aria-label="${choosing() ? 'Options for' : 'Show in the reference:'} ${esc(BY[id].name)}">${choosing() ? ICON.more : ICON.book}</button></div>`;
      }
      if (choosing() && play) h += `<div class="adddx">${addSelect('data-addcol', 'Add a neoplasm', S.cols)}</div>`;
      h += '</div>';
      const ready = S.cols.some(id => S.marks['dx|' + id] === 'yes');
      if (play) h += `<div class="actions">${prefs.autoCheck ? '' : `<button class="btn primary" data-act="check" ${ready ? '' : 'disabled'}>Diagnose</button>`}${tally}</div>`;
    }
    if (S.msg) h += `<div class="msg ${S.msg.kind}">${S.msg.html}</div>`;
    if (S.phase === 'pct') {
      const t = P.pops.find(p => p.label === P.pct.label);
      h += `<div class="msg"><b>Last step.</b> The ${gating() ? 'abnormal population' : 'population ' + popTag(t)} is about what share of all events?<div class="pctq">${P.pct.options.map(v => `<button class="btn" data-pct="${v}">${v}%</button>`).join('')}</div></div>`;
    }
    if (S.phase === 'done') h += recap();
    el.innerHTML = h;
    fitGrid(el.querySelector('.lgrid'), el.querySelector('.gridwrap'));
    $('#hintBtn').disabled = !play;
    $('#undoBtn').disabled = !play || !S.undo.length;
    persist();
    fitPlots();
  }

  // ---------- checking ----------
  function wrongReason(id, p) {
    const r = why(id, p, S.P.plots);
    return r.length ? r[0] : 'it fits these plots, but another population needs that identity';
  }
  function check() {
    if (S.mode === 'pops') {
      if (gating()) {
        const gp = gateProblems();
        if (gp.length) { S.wrongChecks++; S.msg = { kind: 'bad', html: `<b>Fix the gates first.</b><ul>${gp.map(x => `<li>${x}</li>`).join('')}</ul>` }; return drawPanel(); }
      }
      const bad = [];
      for (const r of rows()) {
        const id = S.cols.find(i => S.marks[r.label + '|' + i] === 'yes');
        if (id === r.pop.id) { S.checked[r.label] = 'right'; continue; }
        S.checked[r.label] = 'wrong';
        bad.push(`${rowTag(r)} is not ${esc(BY[id].name)}: ${esc(wrongReason(id, r.pop))}.`);
      }
      if (bad.length) { S.wrongChecks++; S.msg = { kind: 'bad', html: `<b>${bad.length} not right yet.</b><ul>${bad.map(b => `<li>${b}</li>`).join('')}</ul>` }; }
      else finishBoard();
    } else checkClone();
    drawPanel();
  }
  /* Gated levels: are the gates good enough to name groups? */
  function gateProblems() {
    const out = [], rs = rows(), P = S.P;
    if (S.extraGroups || rs.length > P.pops.length) out.push('There are more groups than populations: a gate is cutting through a cluster.');
    for (const r of rs) if (r.purity < 0.85) out.push(`${rowTag(r)} mixes two populations: move a gate into the gap between them, or place another gate.`);
    for (const p of P.pops) { const mine = rs.filter(r => r.pop === p && r.purity >= 0.85); if (mine.length > 1) out.push(`${mine.map(rowTag).join(' and ')} are one population split by a gate.`); }
    if (!out.length && rs.length < P.pops.length) out.push('Some populations still share a group: place another gate, or move one to the other side of a cluster.');
    return out;
  }
  function checkClone() {
    const t = target(), id = S.cols.find(i => S.marks['dx|' + i] === 'yes');
    if (!id) return;
    if (gating()) {
      const cr = cloneRowObj();
      if (!cr) { S.msg = { kind: 'bad', html: '<b>Pick the abnormal group first.</b> Gate the tube until the clone has a letter of its own, then choose it above.' }; return; }
      if (cr.pop !== t) { S.wrongChecks++; S.msg = { kind: 'bad', html: `<b>${rowTag(cr)} isn't the abnormal population.</b> Its markers fit a normal cell type; look for the group that doesn't.` }; return; }
      if (cr.purity < 0.85) { S.wrongChecks++; S.msg = { kind: 'bad', html: `<b>${rowTag(cr)} mixes the clone with normal cells.</b> Tighten the gates around it first.` }; return; }
    }
    if (id === t.id) { S.checked[id] = 'right'; finishBoard(); return; }
    S.wrongChecks++; S.checked[id] = 'wrong'; S.marks['dx|' + id] = 'no';
    S.msg = { kind: 'bad', html: `<b>Not ${esc(BY[id].name)}.</b> ${esc(wrongReason(id, t))}.` };
  }
  /* Auto-check: judge one row the moment an identity is chosen. */
  function autoCheckRow(row) {
    const r = rows().find(q => q.label === row), id = S.cols.find(i => S.marks[row + '|' + i] === 'yes');
    if (!id || !r) return;
    if (r.purity < 0.85) { S.checked[row] = 'wrong'; S.wrongChecks++; S.msg = { kind: 'bad', html: `${rowTag(r)} mixes two populations: move a gate into the gap first.` }; return; }
    if (id === r.pop.id) { S.checked[row] = 'right'; S.msg = null; }
    else { S.checked[row] = 'wrong'; S.wrongChecks++; S.msg = { kind: 'bad', html: `${rowTag(r)} is not ${esc(BY[id].name)}: ${esc(wrongReason(id, r.pop))}.` }; }
    if (rows().every(q => S.checked[q.label] === 'right') && (!gating() || !gateProblems().length)) finishBoard();
  }
  function finishBoard() {
    pauseTimer();
    S.msg = { kind: 'good', html: `<b>Solved.</b> ${S.mode === 'pops' ? 'Every population is right.' : 'That is the diagnosis.'}` };
    S.phase = S.P.pct ? 'pct' : 'done';
    if (S.phase === 'done') record();
  }
  function answerPct(v) {
    S.pctPick = v; S.phase = 'done';
    const ok = v === S.P.pct.answer;
    S.msg = { kind: ok ? 'good' : 'bad', html: ok ? `<b>Solved, and ${v}% is right.</b>` : `<b>Solved, but the share was ${S.P.pct.answer}%</b> (you picked ${v}%). Judge it from how much of the plot the shape fills, not how dense one cluster looks.` };
    if (!ok) S.wrongChecks++;
    record();
    drawPanel();
  }
  function record() {
    const st = load('flowcyto.stats', {}), k = S.mode + '/' + S.level, v = st[k] || { solved: 0, clean: 0 };
    v.solved++; if (!S.wrongChecks && !S.peeks.size && !S.hints) v.clean++;
    const ms = elapsedNow(); S.time = ms; S.newBest = !v.best || ms < v.best; if (S.newBest) v.best = ms;
    st[k] = v; save('flowcyto.stats', st); S.stats = v;
    if (isDaily()) { const d = load('flowcyto.daily', {}), t = today(); d[t] = [...new Set([...(d[t] || []), S.mode])]; save('flowcyto.daily', d); }
  }

  // ---------- hints: one logical step, with its reason ----------
  /* Order: on gated boards, fix a misplaced gate, then place a missing one; on "you choose" boards, add
     a cell type the answer needs; then undo a mistake; cross out an identity a plot rules out; place an
     identity that is the only one left; the cross-elimination step ("that identity belongs to another
     letter"). Highlights the population and the plot that decides it. */
  function firstContradiction(id, p) {
    for (const mk of markersOf(shownPlots())) if (!fits(id, p, [mk])) {
      const i = mk === 'SSC' ? 0 : S.P.plots.findIndex(pl => plotMarkers([pl.x, pl.y]).includes(mk));
      return { mk, plot: i, text: why(id, p, S.P.plots)[0] };
    }
    return null;
  }
  /* A line's cost at v: for each population, the share of its events on the wrong side (when its
     reading says which side) or the smaller share either side (when nothing says, as for the
     side-scatter line on CD45/SSC); a naturally split population counts events the line puts across
     from the part they were drawn in. */
  function lineCost(mk, k, v) {
    return S.P.pops.map((p, pi) => {
      const evs = S.P.events[pi];
      if (naturallySplit(p, mk)) return isScatter(mk) ? 0 : evs.filter(e => (axisVal(e, mk) > FC.CUT) !== (axisVal(e, mk) > v)).length / evs.length;
      const up = evs.filter(e => axisVal(e, mk) > v).length / evs.length, want = side(p, mk, k);
      return want === 'above' ? 1 - up : want === 'below' ? up : Math.min(up, 1 - up);
    });
  }
  function bestLine(mk, k, lo, hi) {
    const top = isScatter(mk) ? 1024 : 4, step = top / 160;
    let best = null, bc = Infinity;
    for (let v = Math.max(step, lo || 0); v < Math.min(top, hi || top); v += step) { const c = lineCost(mk, k, v).reduce((a, b) => a + b, 0); if (c < bc - 1e-9) { bc = c; best = v; } }
    return { v: best, c: bc };
  }
  // Does a line on this axis separate anything (two populations meant for opposite sides)?
  const separates = (mk, k) => { const s = S.P.pops.filter(p => !naturallySplit(p, mk)).map(p => side(p, mk, k)); return s.includes('above') && s.includes('below'); };
  function badGate() {
    const P = S.P;
    for (const [i, pl] of P.plots.entries()) {
      const gt = S.gates[i]; if (!gt) continue;
      const [xm, ym] = axes(pl);
      const lines = gt.y1 != null ? [['y1', 'SSC'], ['y2', 'SSC']].filter(([k]) => gt[k] != null) : [['x', xm], ['y', ym]];
      for (const [k, mk] of lines) {
        const now = lineCost(mk, k, gt[k]);
        if (Math.max(...now) <= 0.05) continue;
        const b = bestLine(mk, k, k === 'y2' && gt.y1 != null ? gt.y1 + 20 : 0, k === 'y1' && gt.y2 != null ? gt.y2 - 20 : 0);
        // only a line that can actually do better (populations that truly touch can't be split cleaner)
        if (b.v != null && b.c < now.reduce((a, c) => a + c, 0) - 0.02) return { i, k, mk, to: b.v, pl };
      }
    }
    return null;
  }
  /* The first plot with no gate whose gate would separate something, and the gate to place there. */
  function missingGate() {
    const P = S.P;
    for (const [i, pl] of P.plots.entries()) {
      if (S.gates[i]) continue;
      if (isFscSsc(pl)) {
        const need1 = separates('SSC', 'y1'), need2 = separates('SSC', 'y2');
        if (!need1 && !need2) continue;
        const g = { y1: bestLine('SSC', 'y1', 0, 900).v, y2: null };
        if (need2) g.y2 = bestLine('SSC', 'y2', g.y1 + 20, 0).v;
        return { i, pl, gate: g };
      }
      const [xm, ym] = axes(pl), sx = separates(xm, 'x'), sy = separates(ym, 'y');
      if (!sx && !sy) continue;
      return { i, pl, gate: { x: bestLine(xm, 'x').v, y: bestLine(ym, 'y').v } };
    }
    return null;
  }
  function side(p, mk, k) {
    if (mk === 'SSC') { const c = BY[p.id].ssc; if (k === 'y1') return c === 'low' ? 'below' : 'above'; if (k === 'y2') return c === 'high' ? 'above' : 'below'; return null; }
    if (mk === 'FSC') return null;
    if (mk === 'LCk' || mk === 'LCl') return (mk === 'LCk' ? p.lc === 'kappa' : p.lc === 'lambda') ? 'above' : 'below';
    const c = observed(p, mk); return c === 'neg' ? 'below' : 'above';
  }
  const lineName = (bg) => bg.k === 'y1' ? 'lower side-scatter line' : bg.k === 'y2' ? 'upper side-scatter line' : `${bg.mk === 'LCk' ? 'kappa' : bg.mk === 'LCl' ? 'lambda' : bg.mk} line`;

  function hint() {
    if (S.phase !== 'play') return;
    pushUndo();
    const P = S.P;
    const say = (html, r, plot) => {
      S.hints++; S.msg = { kind: 'hint', html: `<b>Hint.</b> ${html}` };
      if (S.mode === 'pops' && r) S.focus = r.slot;
      S.flash = plot != null && plot >= 0 ? plot : null;
      drawPlots(); drawPanel(); if (refIsOpen()) drawRef();
      const m = document.querySelector('#panel .msg.hint'); if (m) m.scrollIntoView({ block: 'nearest' });
      if (S.flash != null) setTimeout(() => { if (!S) return; S.flash = null; const f = document.querySelector('figure.flash'); if (f) f.classList.remove('flash'); }, 2600);
    };
    if (gating()) {
      const bg = badGate();
      if (bg) { S.gates[bg.i][bg.k] = bg.to; regroup(); return say(`The ${lineName(bg)} on ${plotName(bg.pl)} cut through a population or left one on the wrong side. Moved it into the gap.`, null, bg.i); }
      const mg = missingGate();
      if (mg && (rows().length < P.pops.length || S.extraGroups || rows().some(r => r.purity < 0.85))) {
        S.gates[mg.i] = mg.gate; regroup();
        return say(`${plotName(mg.pl)} separates populations that still share a group. Placed its gate in the gaps.`, null, mg.i);
      }
      if (S.mode === 'clone') {
        const cr = cloneRowObj(), good = rows().find(r => r.pop === target());
        if (good && (!cr || cr.label !== good.label)) { S.cloneRow = good.label; return say(`${rowTag(good)} is the abnormal group: no normal cell type in this tube reads that way. Picked it.`, good); }
      }
    }
    const tc = S.mode === 'clone' ? cloneRowObj() : null;
    const list = S.mode === 'pops' ? rows().map(r => ({ p: r.pop, r, key: id => r.label + '|' + id, sol: r.pop.id }))
      : tc ? [{ p: tc.pop, r: tc, key: id => 'dx|' + id, sol: target().id }] : [];
    const who = (r) => S.mode === 'pops' ? rowTag(r) : `The clone (${rowTag(r)})`;
    const mks = markersOf(shownPlots());
    // 0. "you choose" boards: the answer must be on offer
    if (choosing()) for (const { r, sol } of list) if (!S.cols.includes(sol)) { addCol(sol); return say(`Consider ${esc(BY[sol].name)}: it fits ${who(r)} on every plot. Added it to both grids.`, r); }
    // 1. mistakes
    for (const { p, r, key, sol } of list) {
      const bad = S.cols.find(id => S.marks[key(id)] === 'yes' && id !== sol);
      if (bad) { delete S.marks[key(bad)]; delete S.checked[S.mode === 'pops' ? r.label : bad]; const c = firstContradiction(bad, p); return say(`${who(r)} is not ${esc(BY[bad].name)}: ${esc(c ? c.text : 'another population needs that identity')}. Cleared it.`, r, c && c.plot); }
      if (S.marks[key(sol)] === 'no') { delete S.marks[key(sol)]; return say(`You crossed out the right identity for ${who(r)}. Restored that cell; look at its row again.`, r); }
    }
    // 2. a cross-out a plot proves
    for (const { p, r, key, sol } of list) {
      if (S.marks[key(sol)] === 'yes') continue;
      for (const id of S.cols) {
        if (S.marks[key(id)] || fits(id, p, mks)) continue;
        const c = firstContradiction(id, p);
        S.marks[key(id)] = 'no';
        return say(`${who(r)} is not ${esc(BY[id].name)}: ${esc(c.text)}. Crossed it out.`, r, c.plot);
      }
    }
    // 3. the only identity left
    for (const { r, key, sol } of list) {
      if (S.marks[key(sol)] === 'yes') continue;
      const left = S.cols.filter(id => S.marks[key(id)] !== 'no');
      if (left.length === 1 || S.mode === 'clone') return place(r, key, sol, `${esc(BY[sol].name)} is the only identity left that fits ${who(r)}.`, say);
    }
    // 4. cross-elimination: an identity that fits this letter belongs to another
    const cand = countSolutions(P.pops, S.cols, mks).cand;
    for (const { p, r, key, sol } of list) {
      if (S.marks[key(sol)] === 'yes') continue;
      const other = (cand[P.pops.indexOf(p)] || []).find(id => id !== sol && S.marks[key(id)] !== 'no');
      if (!other) continue;
      const q = list.find(x => x.p.id === other);
      S.marks[key(other)] = 'no';
      return say(`${rowTag(r)} fits ${esc(BY[other].name)} too, but ${q ? rowTag(q.r) : 'another population'} can only be ${esc(BY[other].name)} once its own decoys are out, and no identity is used twice. Crossed it out for ${r.label}.`, r);
    }
    S.msg = { kind: 'hint', html: '<b>Hint.</b> Everything is placed. Press Check.' }; drawPanel();
  }
  function place(r, key, sol, text, say) {
    for (const k of Object.keys(S.marks)) {
      const [r2, i2] = k.split('|');
      if (S.marks[k] === 'yes' && (k === key(sol) || r2 === key(sol).split('|')[0] || i2 === sol)) delete S.marks[k];
    }
    S.marks[key(sol)] = 'yes';
    if (prefs.autoCheck) { if (S.mode === 'pops') autoCheckRow(r.label); else checkClone(); }
    say(text + ' Chose it.', r);
  }

  // ---------- recap ----------
  function recap() {
    const P = S.P, plots = P.plots;
    let h = `<div class="recap"><p class="tally">${tallyText()}${prefs.timer && S.time ? ` · ${fmtTime(S.time)}${S.newBest ? ' (personal best)' : ''}` : ''}. ${S.stats ? `${S.stats.solved} solved at this level, ${S.stats.clean} clean (no mistakes, hints or peeks).` : ''}${isDaily() ? ` Today's daily is done: ${plural(streak(), 'day')} in a row.` : ''}</p>`;
    if (S.why) h += whyHTML();
    const pops = S.mode === 'clone' ? [target()] : P.pops;
    h += `<h3>${S.mode === 'clone' ? 'The clone' : 'The populations'}</h3>`;
    for (const p of pops) {
      const e = BY[p.id];
      const lc = p.lc === 'kappa' || p.lc === 'lambda' ? ` (${p.lc} restricted)` : '';
      h += `<div class="item">${gating() ? '' : popTag(p) + ' '}${esc(e.long)}${lc} · ${Math.round(p.frac * 100)}% of events <button class="btn mini" data-why="${P.pops.indexOf(p)}">Why?</button><div class="why">${esc(e.teach)}</div></div>`;
    }
    const decoys = S.mode === 'clone' ? S.cols.filter(id => id !== target().id) : S.cols.filter(id => !P.pops.some(p => p.id === id));
    if (decoys.length) {
      h += '<h3>Why the others were out</h3>';
      for (const d of decoys) {
        const cands = S.mode === 'clone' ? [target()] : P.pops;
        let best = null;
        for (const p of cands) { const r = why(d, p, plots); if (!best || r.length < best.r.length) best = { p, r }; }
        h += `<div class="item">${esc(BY[d].name)}<div class="why">Closest to ${gating() ? 'the ' + esc(BY[best.p.id].name.toLowerCase()) : best.p.label}, but ${esc(best.r[0] || 'its letter was taken by a better fit')}.</div></div>`;
      }
    }
    const extra = plots.filter(p => p.role === 'extra');
    if (extra.length) h += `<h3>Plots you didn't need</h3><div class="item">${extra.map(p => esc(plotName(p))).join(' · ')}<div class="why">Real readings of this tube, but the board was solvable without them.</div></div>`;
    h += `<div class="actions"><button class="btn primary" data-act="new">Next board</button><button class="btn" data-act="menu">Menu</button></div></div>`;
    return h;
  }

  // ---------- why replay: step through the plots that decided one population ----------
  function whySteps(pop) {
    const P = S.P, others = S.cols.filter(id => id !== pop.id), byPlot = new Map(), taken = [];
    for (const id of others) {
      const c = firstContradiction(id, pop);
      if (!c) { taken.push(id); continue; }
      if (!byPlot.has(c.plot)) byPlot.set(c.plot, []);
      byPlot.get(c.plot).push({ id, text: c.text });
    }
    const steps = [...byPlot.entries()].sort((a, b) => a[0] - b[0]).map(([plot, list]) => ({ plot,
      html: `<b>${esc(plotName(P.plots[plot]))}</b> rules out ${list.map(x => esc(BY[x.id].name)).join(', ')}. ${esc(list[0].text[0].toUpperCase() + list[0].text.slice(1))}.` }));
    if (taken.length) steps.push({ plot: null, html: `${taken.map(id => esc(BY[id].name)).join(', ')} also ${taken.length > 1 ? 'fit' : 'fits'} these plots, but ${taken.length > 1 ? 'each belongs' : 'it belongs'} to another population, and no identity is used twice.` });
    steps.push({ plot: null, html: `That leaves <b>${esc(BY[pop.id].long)}</b>. ${esc(BY[pop.id].teach)}` });
    return steps;
  }
  function whyHTML() {
    const w = S.why, st = w.steps[w.i], pop = S.P.pops[w.k];
    return `<div class="msg hint whybox"><div class="whyhead"><b>Why: ${esc(BY[pop.id].name)}</b><span class="tally">step ${w.i + 1} of ${w.steps.length}</span></div><p>${st.html}</p><div class="actions"><button class="btn mini" data-whystep="-1" ${w.i ? '' : 'disabled'}>Back</button><button class="btn mini primary" data-whystep="1" ${w.i < w.steps.length - 1 ? '' : 'disabled'}>Next</button><button class="btn mini" data-whyclose>Close</button></div></div>`;
  }
  function showWhy() {
    const w = S.why, st = w && w.steps[w.i];
    S.flash = st && st.plot != null ? st.plot : null;
    if (w) { const pop = S.P.pops[w.k]; S.focus = gating() ? ((S.groups.find(g => g.pop === pop) || {}).slot ?? null) : pop.slot; } else S.focus = null;
    drawPlots(); drawPanel();
    const box = document.querySelector('#panel .whybox'); if (box) box.scrollIntoView({ block: 'nearest' });
  }

  // ---------- action sheet: a column's / reference row's options on "you choose" boards ----------
  function openActions(kind, id) {
    const nm = esc(BY[id].name), exclude = kind === 'col' ? S.cols : S.refs;
    let h = `<div class="set-head"><h2>${nm}</h2><button class="iconbtn" data-close aria-label="Close">${ICON.close}</button></div>`;
    if (kind === 'col') h += `<button class="btn wide" data-act-ref="${id}">${ICON.book} Show in the ${refTitle().toLowerCase()}</button>`;
    h += `<label class="field"><span>Change to</span><select data-act-change="${kind}|${id}"><option value="" selected disabled>Pick a cell type</option>${catalogOptions(exclude)}</select></label>`;
    h += `<button class="btn wide" data-act-remove="${kind}|${id}">${ICON.close} ${kind === 'col' ? 'Remove from the answer (stays in the ' + refTitle().toLowerCase() + ')' : 'Remove (from the answer too)'}</button>`;
    csheet.innerHTML = h; csheet.dataset.kind = 'actions';
    if (!csheet.open) csheet.showModal();
  }
  function afterEdit() { S.msg = null; drawPanel(); if (refIsOpen()) drawRef(); }
  csheet.addEventListener('click', ev => {
    if (ev.target === csheet || ev.target.closest('[data-close]')) return csheet.close();
    const cs = ev.target.closest('[data-cset]');
    if (cs) {
      const c = prefs.custom, k = cs.dataset.cset, v = cs.dataset.v;
      if (k === 'choice') { c.choose = v === 'choose'; c.decoys = v !== 'present'; }
      else c[k] = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? +v : v;
      setPref('custom', c); return openCustom(csheet.querySelector('[data-cplay]').dataset.cplay);
    }
    const cp = ev.target.closest('[data-cplay]'); if (cp) { csheet.close(); return play(cp.dataset.cplay, 'custom'); }
    const ar = ev.target.closest('[data-act-ref]'); if (ar) { csheet.close(); return openRef(ar.dataset.actRef); }
    const rm = ev.target.closest('[data-act-remove]');
    if (rm) { const [kind, id] = rm.dataset.actRemove.split('|'); pushUndo(); if (kind === 'col') removeCol(id); else removeRef(id); csheet.close(); return afterEdit(); }
  });
  csheet.addEventListener('change', ev => {
    const ch = ev.target.closest('[data-act-change]');
    if (ch && ch.value) { const [kind, id] = ch.dataset.actChange.split('|'); pushUndo(); if (kind === 'col') changeCol(id, ch.value); else changeRef(id, ch.value); csheet.close(); afterEdit(); }
  });

  // ---------- panel input ----------
  const cycle = m => m === undefined ? 'no' : m === 'no' ? 'yes' : undefined;
  $('#panel').addEventListener('change', ev => {
    const ad = ev.target.closest('[data-addcol]');
    if (ad && ad.value) { pushUndo(); addCol(ad.value); afterEdit(); }
  });
  $('#panel').addEventListener('click', ev => {
    if (ev.target.closest('#refBtn')) { if (prefs.refOpen === 'tap' || !refFilled()) openRef(); return; }
    const ch = ev.target.closest('[data-colh]');
    if (ch) { if (choosing() && S.phase === 'play') return openActions('col', ch.dataset.colh); return openRef(ch.dataset.colh); }
    const fc = ev.target.closest('[data-focus]');
    if (fc) { const slot = rows().find(p => p.label === fc.dataset.focus).slot; S.focus = S.focus === slot ? null : slot; drawPlots(); return drawPanel(); }
    const crw = ev.target.closest('[data-crow]');
    if (crw) { pushUndo(); S.cloneRow = S.cloneRow === crw.dataset.crow ? null : crw.dataset.crow; S.msg = null; drawPlots(); return drawPanel(); }
    const cell = ev.target.closest('[data-cell]');
    if (cell) {
      pushUndo();
      const [row, id] = cell.dataset.cell.split('|'), key = row + '|' + id, next = cycle(S.marks[key]);
      if (next === 'yes') for (const k of Object.keys(S.marks)) {
        const [r2, i2] = k.split('|');
        if (S.marks[k] === 'yes' && (r2 === row || i2 === id)) { delete S.marks[k]; if (r2 !== row) delete S.checked[r2]; } // one per row, one per column
      }
      if (next) S.marks[key] = next; else delete S.marks[key];
      delete S.checked[row]; S.msg = null;
      if (next === 'yes' && prefs.autoCheck) autoCheckRow(row);
      return drawPanel();
    }
    const dx = ev.target.closest('[data-dx]');
    if (dx) {
      pushUndo();
      const key = 'dx|' + dx.dataset.dx, next = cycle(S.marks[key]);
      if (next === 'yes') for (const k of Object.keys(S.marks)) if (S.marks[k] === 'yes') delete S.marks[k];
      if (next) S.marks[key] = next; else delete S.marks[key];
      delete S.checked[dx.dataset.dx]; S.msg = null;
      if (next === 'yes' && prefs.autoCheck) checkClone();
      return drawPanel();
    }
    const act = ev.target.closest('[data-act]');
    if (act && act.dataset.act === 'check') return check();
    if (act && act.dataset.act === 'new') return play(S.mode, S.level);
    if (act && act.dataset.act === 'menu') { location.hash = '/'; return; }
    const pct = ev.target.closest('[data-pct]');
    if (pct) return answerPct(+pct.dataset.pct);
    const wb = ev.target.closest('[data-why]');
    if (wb) { const k = +wb.dataset.why; S.why = { k, i: 0, steps: whySteps(S.P.pops[k]) }; return showWhy(); }
    const ws = ev.target.closest('[data-whystep]');
    if (ws) { S.why.i = Math.max(0, Math.min(S.why.steps.length - 1, S.why.i + +ws.dataset.whystep)); return showWhy(); }
    if (ev.target.closest('[data-whyclose]')) { S.why = null; return showWhy(); }
  });
  // Reference button, press-and-hold: shows the read-only reference while the finger is down.
  $('#panel').addEventListener('pointerdown', ev => {
    if (!ev.target.closest('#refBtn') || !S || prefs.refOpen !== 'hold' || !refFilled()) return;
    refHeld = true; openRef();
  });
  addEventListener('pointerup', () => { if (refHeld) { refHeld = false; closeRef(); } });
  addEventListener('pointercancel', () => { if (refHeld) { refHeld = false; closeRef(); } });
  // Pointing at a row (mouse) highlights that population in every plot.
  $('#panel').addEventListener('mouseover', ev => {
    if (!S || S.mode !== 'pops' || !matchMedia('(hover: hover)').matches) return;
    const tr = ev.target.closest('tr[data-row]');
    const row = tr && rows().find(p => p.label === tr.dataset.row), slot = row ? row.slot : null;
    if (slot !== S.focus) { S.focus = slot; drawPlots(); $('#panel').querySelectorAll('tr[data-row]').forEach(r => r.classList.toggle('focus', tr === r)); }
  });
  $('#panel').addEventListener('mouseleave', () => { if (S && matchMedia('(hover: hover)').matches && S.focus != null) { S.focus = null; drawPlots(); } });

  // reference pane input
  refPane.addEventListener('click', ev => {
    if (ev.target.closest('[data-refclose]')) return closeRef();
    if (ev.target === refPane) { if (performance.now() - refAt > 400) closeRef(); return; }
    const pc = ev.target.closest('[data-pad]');
    if (pc) {
      pushUndo();
      const [id, mk] = pc.dataset.pad.split('|'), key = id + '|' + mk, c = padCycle(mk), i = c.indexOf(S.pad[key]);
      if (i === c.length - 1) delete S.pad[key]; else S.pad[key] = c[i + 1];
      return drawRef();
    }
    const rv = ev.target.closest('[data-reveal]');
    if (rv) { S.peeks.add(rv.dataset.reveal); S.refRow = rv.dataset.reveal; drawRef(); return drawPanel(); }
    if (ev.target.closest('[data-fill]')) return fillReference();
    const rm = ev.target.closest('[data-refmenu]'); if (rm && S.phase === 'play') return openActions('ref', rm.dataset.refmenu);
  });
  refPane.addEventListener('change', ev => {
    const ad = ev.target.closest('[data-addref]');
    if (ad && ad.value) { pushUndo(); addRef(ad.value); afterEdit(); }
  });

  // ---------- enlarge a plot: tap, or press and hold (Settings); on gated boards, place and drag gates ----------
  const zoom = $('#zoom');
  let zoomI = null, zoomAt = 0;
  function openZoom(i) {
    zoomI = i; zoomAt = performance.now();
    const pl = S.P.plots[i], size = Math.floor(Math.min(innerWidth - 24, innerHeight - (gating() ? 130 : 90), 640));
    const tail = gating() ? `<div class="zoom-foot"><span>${S.gates[i] ? 'Drag to move the gate' : 'Drag to place a gate'}${isFscSsc(pl) ? ' (two side-scatter lines)' : ''}</span><button class="btn primary" data-done>Done</button></div>` : '';
    zoom.innerHTML = `<figure data-zplot="${i}">${renderPlot(S.P, pl, plotOpts(i, true))}<figcaption>${plotName(pl)}${!gating() && prefs.enlarge === 'tap' ? ' · tap to close' : ''}</figcaption>${tail}</figure>`;
    zoom.style.setProperty('--zoom', size + 'px');
    zoom.hidden = false;
  }
  const closeZoom = () => { zoom.hidden = true; zoom.innerHTML = ''; zoomI = null; };
  let holdTimer = null, held = false, drag = null, frame = 0;
  /* Pointer position -> gate, in the plot's own data units. A plot with no gate gets one where you
     press. On FSC/SSC the first line goes where you press; pressing well away from it adds the second;
     after that you move whichever line is nearer. */
  function moveGate(d, ev) {
    const svg = d.zoom ? zoom.querySelector('svg') : document.querySelector(`#plots [data-plot="${d.i}"] svg`);
    if (!svg) return;
    const rc = svg.getBoundingClientRect(), g = d.zoom ? geom(S.P.plots[d.i]) : geom(S.P.plots[d.i], S.compact ? 160 : 240, !!S.compact);
    const vx = (ev.clientX - rc.left) / rc.width * g.S, vy = (ev.clientY - rc.top) / rc.height * g.S;
    const pl = S.P.plots[d.i];
    if (isFscSsc(pl)) {
      const y = g.dy(vy);
      let gt = S.gates[d.i];
      if (!gt) { gt = S.gates[d.i] = { y1: y, y2: null }; d.line = 'y1'; }
      if (!d.line) {
        if (gt.y2 == null && Math.abs(y - gt.y1) > 70) { if (y > gt.y1) { gt.y2 = y; d.line = 'y2'; } else { gt.y2 = gt.y1; gt.y1 = y; d.line = 'y1'; } }
        else d.line = gt.y2 == null || Math.abs(y - gt.y1) < Math.abs(y - gt.y2) ? 'y1' : 'y2';
      }
      if (d.line === 'y1') gt.y1 = gt.y2 == null ? y : Math.min(y, gt.y2 - 20); else gt.y2 = Math.max(y, gt.y1 + 20);
    } else S.gates[d.i] = { x: g.dx(vx), y: g.dy(vy) };
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0; regroup(); drawPlots();
      if (zoomI != null) { const f = zoom.querySelector('figure'); if (f) f.firstElementChild.outerHTML = renderPlot(S.P, S.P.plots[zoomI], plotOpts(zoomI, true)); }
      drawPanel();
    });
  }
  $('#plots').addEventListener('pointerdown', ev => {
    const f = ev.target.closest('[data-plot]'); if (!f || !S) return;
    if (gating() && S.phase === 'play') { drag = { i: +f.dataset.plot, x0: ev.clientX, y0: ev.clientY, moved: false }; $('#plots').setPointerCapture(ev.pointerId); return; }
    if (prefs.enlarge !== 'hold') return;
    held = false;
    holdTimer = setTimeout(() => { held = true; openZoom(+f.dataset.plot); }, 220);
  });
  $('#plots').addEventListener('pointermove', ev => {
    if (!drag || drag.zoom) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 6) return;
    if (!drag.moved) pushUndo();
    drag.moved = true; moveGate(drag, ev);
  });
  $('#plots').addEventListener('pointerup', () => { if (!drag || drag.zoom) return; const d = drag; drag = null; if (!d.moved) openZoom(d.i); });
  zoom.addEventListener('pointerdown', ev => {
    if (!gating() || zoomI == null || !ev.target.closest('svg') || S.phase !== 'play') return;
    pushUndo(); drag = { i: zoomI, zoom: true, moved: true }; zoom.setPointerCapture(ev.pointerId); moveGate(drag, ev);
  });
  zoom.addEventListener('pointermove', ev => { if (drag && drag.zoom) moveGate(drag, ev); });
  zoom.addEventListener('pointerup', () => { if (drag && drag.zoom) { drag = null; if (zoomI != null) openZoom(zoomI); } });
  const release = () => { clearTimeout(holdTimer); if (held) { held = false; closeZoom(); } };
  addEventListener('pointerup', release); addEventListener('pointercancel', release);
  $('#plots').addEventListener('click', ev => { const f = ev.target.closest('[data-plot]'); if (f && !gating() && prefs.enlarge === 'tap') openZoom(+f.dataset.plot); });
  $('#plots').addEventListener('contextmenu', ev => ev.preventDefault());
  zoom.addEventListener('click', ev => {
    if (ev.target.closest('[data-done]')) return closeZoom();
    if (performance.now() - zoomAt < 400) return; // a touch's own follow-up click lands on the new overlay
    if (gating() ? !ev.target.closest('figure') : prefs.enlarge === 'tap') closeZoom();
  });
  addEventListener('keydown', ev => { if (ev.key !== 'Escape') return; if (!zoom.hidden) closeZoom(); else if (refIsOpen()) closeRef(); });

  // ---------- settings ----------
  const dlg = $('#settings');
  function openSettings() {
    const seg = (k, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, t]) => `<button role="radio" data-pref="${k}" data-v="${v}" aria-checked="${String(prefs[k]) === String(v)}">${t}</button>`).join('')}</div>`;
    let h = `<div class="set-head"><h2>Settings</h2><button class="iconbtn" data-close aria-label="Close settings">${ICON.close}</button></div>`;
    const a = prefs.appearance;
    h += `<div class="set-row"><div><b>Appearance</b><span>This device only.</span></div><div class="seg" role="radiogroup">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, t]) => `<button role="radio" data-theme-set="mode" data-v="${v}" aria-checked="${a.mode === v}">${t}</button>`).join('')}</div></div>`;
    h += `<div class="set-row themes"><div><b>Light theme</b></div><div class="theme-row" role="radiogroup">${themeChoice('light', 'default', 'Default')}${themeChoice('light', 'light', 'Light')}</div></div>`;
    h += `<div class="set-row themes"><div><b>Dark theme</b></div><div class="theme-row" role="radiogroup">${themeChoice('dark', 'dark', 'Dark')}${themeChoice('dark', 'black', 'Black')}</div></div>`;
    h += `<div class="set-row"><div><b>Grid size</b><span>Answer, reference and scratch pad cells and text.</span></div>${seg('gscale', [[0.85, 'Small'], [1, 'Medium'], [1.2, 'Large'], [1.4, 'Larger']])}</div>`;
    h += `<div class="set-row"><div><b>Enlarge a plot</b><span>Press and hold shows it while your finger is down; tap opens it until you tap again. On gated levels a tap always opens it, so you can place its gate.</span></div>${seg('enlarge', [['hold', 'Press and hold'], ['tap', 'Tap']])}</div>`;
    h += `<div class="set-row"><div><b>Open the reference</b><span>The same choice for the read-only reference. The scratch pad always opens on a tap, since you write in it.</span></div>${seg('refOpen', [['hold', 'Press and hold'], ['tap', 'Tap']])}</div>`;
    h += `<div class="set-row"><div><b>Timer</b><span>Shows the clock while you play and your best time per level. Times are kept either way.</span></div>${seg('timer', [[false, 'Off'], [true, 'On']])}</div>`;
    h += `<div class="set-row"><div><b>Auto-check</b><span>Marks each choice right or wrong as you make it. A wrong choice counts as a mistake.</span></div>${seg('autoCheck', [[false, 'Off'], [true, 'On']])}</div>`;
    if (S) {
      const left = S.refs.filter(id => !S.peeks.has(id)).length;
      h += `<div class="set-row"><div><b>How to play</b><span>A short walk-through on this board.</span></div><button class="btn" data-tour>Show me</button></div>`;
      if (!refFilled()) h += `<div class="set-row"><div><b>Scratch pad</b><span>${left ? `Fill it in from the key. Counts as ${plural(left, 'peek')}.` : 'Already filled in.'}</span></div><button class="btn" data-fill ${left ? '' : 'disabled'}>Fill in from the key</button></div>`;
    }
    dlg.innerHTML = h;
    if (!dlg.open) dlg.showModal();
  }
  dlg.addEventListener('click', ev => {
    if (ev.target === dlg || ev.target.closest('[data-close]')) return dlg.close();
    const t = ev.target.closest('[data-theme-set]');
    if (t) {
      const a = prefs.appearance, key = t.dataset.themeSet;
      if (key === 'mode') a.mode = t.dataset.v; else { a[key] = t.dataset.v; if (a.mode !== 'auto') a.mode = key; } // picking a light theme while in Dark shows it
      setPref('appearance', a); applyTheme(); return openSettings();
    }
    const b = ev.target.closest('[data-pref]');
    if (b) {
      const k = b.dataset.pref, raw = b.dataset.v;
      const v = (k === 'autoCheck' || k === 'timer') ? raw === 'true' : k === 'gscale' ? +raw : raw;
      setPref(k, v); applyTheme();
      if (S) { drawPanel(); tickTimer(); if (refIsOpen()) drawRef(); } else showMenu();
      return openSettings();
    }
    if (ev.target.closest('[data-fill]')) { dlg.close(); fillReference(); }
    if (ev.target.closest('[data-tour]')) { dlg.close(); startTour(tourKey()); }
  });

  // ---------- top bar ----------
  $('#menuBtn').addEventListener('click', () => { location.hash = '/'; });
  $('#newBtn').addEventListener('click', () => play(S.mode, S.level));
  $('#hintBtn').addEventListener('click', hint);
  $('#undoBtn').addEventListener('click', undo);
  $('#setBtn').addEventListener('click', openSettings);
  addEventListener('resize', () => { if (!S) return; fitPlots(); fitGrid($('#panel .lgrid'), $('#panel .gridwrap')); if (refIsOpen()) drawRef(); });
  addEventListener('hashchange', route);

  // ---------- guided first board: coach marks over the real board, once per kind (Settings → How to play) ----------
  const tourKey = () => gating() ? (choosing() ? 'choose' : 'gating') : S.mode;
  const REF_STEP = ['#refBtn', 'Reference: each cell type\'s markers. On Easy and Medium it\'s filled in (press and hold, or tap: Settings); from Hard up it\'s a scratch pad you fill from memory, and the eye reveals a row as a peek.'];
  const GATE_STEPS = [
    ['#plots', 'Nothing is labeled and no gates are placed: every event starts gray.'],
    ['#plots figure:nth-child(2)', 'Drag on a plot to place its gate (a crosshair; up to two side-scatter lines on FSC/SSC), then drag again to move it. Tap a plot to work on it large.'],
    ['.gstat', 'Events sort themselves into lettered groups across every plot. Aim for one clean group per population: a line through a cluster splits it, a line on the wrong side merges two.'],
  ];
  const TOURS = {
    pops: [
      ['#plots', 'Every population in this tube has its own shape and letter, the same in every plot. The dashed lines split negative from positive: read which side each letter sits on.'],
      ['.lgrid', 'Rows are the populations; columns are identities, and none is used twice. Tap a cell once to rule it out, twice to choose it.'],
      REF_STEP,
      ['#hintBtn', 'Stuck? Hint makes one logical step and says why. Undo takes back your last move.'],
      ['.actions', 'Check when every row has a choice. Each wrong one counts as a mistake. After solving, Why? replays the plots that decided each population.'],
    ],
    clone: [
      ['#plots', 'One population is outlined; the rest of the tube is faded background. Read the outlined one on every plot: which side of each dashed line is it?'],
      ['.dxlist', 'These are look-alike neoplasms. Tap one once to rule it out, twice to choose it. The book button shows its markers.'],
      REF_STEP,
      ['#hintBtn', 'Stuck? Hint rules one out and says which plot did it. Undo takes back your last move.'],
    ],
    gating: [...GATE_STEPS,
      ['#panel', 'Then name the groups (or pick the abnormal one and diagnose it), as on the labeled levels.'],
      ['#hintBtn', 'Hint fixes a misplaced gate or places a missing one first, then helps you name. Undo takes back a gate move.'],
    ],
    choose: [...GATE_STEPS,
      ['.addcol, .adddx', 'On Extreme you choose which cell types to consider. Add them here or in the scratch pad; the two stay in step. Tap a column name to change or remove it.'],
      ['#hintBtn', 'Hint fixes or places gates first, adds a cell type the answer needs, then helps you name.'],
    ],
  };
  let tour = null;
  function startTour(key) {
    if (!S) return;
    closeRef(true); drawPanel();
    tour = { key, i: 0, steps: TOURS[key].filter(([sel]) => document.querySelector(sel)) };
    showTourStep();
  }
  function endTour() {
    if (tour) { prefs.tours[tour.key] = true; setPref('tours', prefs.tours); }
    tour = null; const c = $('#coach'); c.hidden = true; c.innerHTML = '';
  }
  function showTourStep() {
    const c = $('#coach'); if (!tour) return;
    const [sel, text] = tour.steps[tour.i], el = document.querySelector(sel);
    if (!el) return endTour();
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect(), pad = 6, last = tour.i === tour.steps.length - 1;
    const below = r.top + r.height / 2 < innerHeight / 2;
    c.innerHTML = `<div class="coach-spot" style="left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + 2 * pad}px;height:${r.height + 2 * pad}px"></div>
      <div class="coach-card card" style="${below ? 'bottom' : 'top'}:max(16px, env(safe-area-inset-${below ? 'bottom' : 'top'}))" role="dialog" aria-label="How to play">
      <p>${text}</p><div class="actions"><span class="tally">${tour.i + 1} of ${tour.steps.length}</span><button class="btn mini" data-tskip>${last ? 'Close' : 'Skip'}</button>${tour.i ? '<button class="btn mini" data-tback>Back</button>' : ''}${last ? '<button class="btn mini primary" data-tdone>Got it</button>' : '<button class="btn mini primary" data-tnext>Next</button>'}</div></div>`;
    c.hidden = false;
  }
  $('#coach').addEventListener('click', ev => {
    if (ev.target.closest('[data-tnext]')) { tour.i++; return showTourStep(); }
    if (ev.target.closest('[data-tback]')) { tour.i--; return showTourStep(); }
    if (ev.target.closest('[data-tskip], [data-tdone]')) return endTour();
  });
  addEventListener('resize', () => { if (tour) showTourStep(); });

  FC.state = () => S; // for tests and the console
  applyTheme();
  route();
})();
