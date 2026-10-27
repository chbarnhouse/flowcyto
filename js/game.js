/* FlowCyto: main menu, game screen, settings, hints, saved board.
   Routes: '#/' is the menu; '#pops/medium/12345' is a board (mode/level/seed), so any board can be
   replayed. The board in progress is saved to localStorage and offered as Continue on the menu. */
(function () {
  'use strict';
  const FC = window.FC;
  const { BY, generate, renderPlot, shapeIcon, allowed, observed, markersOf, plotMarkers, fits, countSolutions, why, describe, LEVELS, gateCode, geom, axes, axisVal, isFscSsc, isScatter } = FC;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const ICON = {
    no: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="var(--ink-2)" stroke-width="2.2" stroke-linecap="round"/></svg>',
    yes: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="var(--blue)" stroke="var(--ink)" stroke-width="1"/></svg>',
    right: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="var(--teal)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wrong: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="var(--pink)" stroke-width="2.4" stroke-linecap="round"/></svg>',
    eye: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.1" fill="currentColor"/></svg>',
  };
  const MARK_WORD = { no: 'ruled out', yes: 'chosen' };
  const MODES = {
    pops: { name: 'Name every population', blurb: 'Give every population in the tube an identity. Decoys are mixed in and none is used twice, so letters settle each other like a logic grid.',
      icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h26M3 21h26M12 3v26M21 3v26" stroke="currentColor" stroke-width="1.4"/><circle cx="7.5" cy="7.5" r="2.4" fill="currentColor"/><path d="M16.5 14.2l2.6 4.3h-5.2z" fill="currentColor"/></svg>' },
    clone: { name: 'Diagnose the clone', blurb: 'One population is abnormal. Read its markers against the background and strike out look-alike neoplasms until one is left.',
      icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="2.2" fill="currentColor"/></svg>' },
  };

  // ---------- storage (every access guarded: private windows may refuse) ----------
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const save = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stats/prefs just don't persist */ } };
  const prefs = Object.assign({ enlarge: 'hold', autoCheck: false }, load('flowcyto.prefs', {}));
  prefs.appearance = Object.assign({ mode: 'auto', light: 'default', dark: 'dark' }, prefs.appearance || {});
  const setPref = (k, v) => { prefs[k] = v; save('flowcyto.prefs', prefs); };

  // ---------- appearance: Auto / Light / Dark, plus which light and which dark theme (as in Pathways) ----------
  const darkScheme = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    const a = prefs.appearance, dark = a.mode === 'dark' || (a.mode === 'auto' && !!(darkScheme && darkScheme.matches));
    document.documentElement.setAttribute('data-theme', dark ? a.dark : a.light);
  }
  if (darkScheme && darkScheme.addEventListener) darkScheme.addEventListener('change', () => { if (prefs.appearance.mode === 'auto') applyTheme(); });
  const THEME_SWATCH = { default: ['#1d5fa8', '#ffffff', '#1d5fa8'], light: ['#f6f7f9', '#ffffff', '#1d5fa8'], dark: ['#0f1217', '#181d25', '#7fb2ea'], black: ['#000000', '#0e0f12', '#7fb2ea'] };
  // A theme drawn as a tiny page (background, a card, an accent bar) plus its name, so it never rests on color alone.
  const themeChoice = (group, v, label) => { const [bg, card, acc] = THEME_SWATCH[v], on = prefs.appearance[group] === v;
    return `<button class="theme-pick" data-theme-set="${group}" data-v="${v}" role="radio" aria-checked="${on}"><span class="theme-sw" style="background:${bg}"><span style="background:${card}"><i style="background:${acc}"></i></span></span><span>${label}${on ? ' ' + ICON.right.replace('var(--teal)', 'currentColor') : ''}</span></button>`; };

  let S = null;

  // ---------- routing ----------
  function route() {
    const [m, l, s] = location.hash.replace(/^#\/?/, '').split('/');
    if (MODES[m] && LEVELS[l]) {
      const cur = load('flowcyto.current', null);
      if (cur && cur.mode === m && cur.level === l && String(cur.seed) === s) return startGame(m, l, +s, cur);
      return startGame(m, l, +s || 0);
    }
    showMenu();
  }
  const play = (mode, level, seed) => { location.hash = `${mode}/${level}/${seed || ((Math.random() * 1e9) >>> 0)}`; };

  // ---------- main menu ----------
  function showMenu() {
    S = null;
    $('#game').hidden = true; $('#menu').hidden = false;
    document.title = 'FlowCyto';
    const stats = load('flowcyto.stats', {}), cur = load('flowcyto.current', null);
    let h = `<main class="menu-in"><div class="logo on-page"><svg width="56" height="56" viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 3v16M3 11h16" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/><circle cx="7" cy="15" r="2.2" fill="currentColor"/><path d="M15 4.6l2.2 3.6h-4.4z" fill="currentColor"/></svg><div><h1>FlowCyto</h1><p>Flow cytometry logic puzzles for STEP 1</p></div></div>`;
    if (cur && cur.phase !== 'done') {
      h += `<button class="card cont" data-continue><span class="cont-k">Continue</span><b>${esc(MODES[cur.mode].name)}</b><span>${LEVELS[cur.level].label} · board ${cur.seed} · ${plural(cur.wrongChecks || 0, 'mistake')}</span><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    }
    for (const [m, M] of Object.entries(MODES)) {
      h += `<section class="card mcard"><div class="mhead"><span class="micon">${M.icon}</span><h2>${M.name}</h2></div><p>${M.blurb}</p><div class="lvls">`;
      for (const [l, L] of Object.entries(LEVELS)) {
        const st = stats[m + '/' + l];
        h += `<button class="lvl" data-play="${m}/${l}"><b>${L.label}</b><span>${st ? `${st.solved} solved` : 'new'}</span></button>`;
      }
      h += '</div></section>';
    }
    h += `<div class="menu-foot on-page"><span class="muted">Easy: more plots, reference filled in · Medium: fewest plots · Hard: no labels (you place the gates), populations that touch, a red herring and a share-of-events question</span><button class="btn" data-settings>Settings</button></div></main>`;
    $('#menu').innerHTML = h;
  }
  $('#menu').addEventListener('click', ev => {
    const p = ev.target.closest('[data-play]'); if (p) { const [m, l] = p.dataset.play.split('/'); return play(m, l); }
    if (ev.target.closest('[data-continue]')) { const c = load('flowcyto.current', null); return play(c.mode, c.level, c.seed); }
    if (ev.target.closest('[data-settings]')) openSettings();
  });

  // ---------- game ----------
  function startGame(mode, level, seed, saved) {
    seed = seed || ((Math.random() * 1e9) >>> 0);
    const P = generate(seed, level, mode);
    S = { mode, level, seed, P, marks: {}, checked: {}, wrongChecks: 0, hints: 0, peeks: new Set(), pad: {}, padRow: null, tab: 'answer', sheet: 'open', focus: null, phase: 'play', pctPick: null, msg: null, flash: null };
    if (saved) Object.assign(S, { marks: saved.marks || {}, checked: saved.checked || {}, wrongChecks: saved.wrongChecks || 0, hints: saved.hints || 0, peeks: new Set(saved.peeks || []), pad: saved.pad || {}, phase: saved.phase || 'play', pctPick: saved.pctPick || null, msg: saved.msg || null, stats: saved.stats });
    if (gating()) {
      S.gates = (saved && saved.gates) || initGates();
      S.sigSlot = (saved && saved.sigSlot) || {}; S.slotSig = {};
      S.cloneRow = (saved && saved.cloneRow) || null;
      regroup();
    }
    $('#game').classList.toggle('gating', gating());
    if (location.hash.slice(1) !== `${mode}/${level}/${seed}`) history.replaceState(null, '', `#${mode}/${level}/${seed}`);
    $('#menu').hidden = true; $('#game').hidden = false;
    $('#gMode').textContent = MODES[mode].name;
    $('#gLevel').textContent = LEVELS[level].label;
    $('#specName').textContent = P.specName;
    $('#boardId').textContent = `board ${seed}`;
    document.title = `FlowCyto · ${MODES[mode].name}`;
    drawPlots(); drawPanel();
  }
  function persist() {
    if (!S) return;
    save('flowcyto.current', { mode: S.mode, level: S.level, seed: S.seed, marks: S.marks, checked: S.checked, wrongChecks: S.wrongChecks, hints: S.hints, peeks: [...S.peeks], pad: S.pad, phase: S.phase, pctPick: S.pctPick, msg: S.msg, stats: S.stats, gates: S.gates, sigSlot: S.sigSlot, cloneRow: S.cloneRow });
  }

  const shownPlots = () => S.P.plots.map(p => [p.x, p.y]);
  const target = () => S.P.pops.find(p => p.label === S.P.target);
  const popTag = p => `${shapeIcon(p.slot)} <b>${p.label}</b>`;
  const freePeeks = () => S.level === 'easy';
  const plotName = pl => pl.x === 'LC' ? 'kappa / lambda' : pl.x + ' / ' + pl.y;

  // ---------- Hard: the player's quad gates define the groups ----------
  /* Every event gets a signature: which part of each plot's gate it falls in. Each signature big
     enough to matter (2% of events) is a group, painted with its own letter, shape and color in every
     plot. Good gates give one group per population; a gate through a cluster splits it, a gate on the
     wrong side merges two. A population that is partly positive by nature (normal B cells: kappa and
     lambda; CD23; hematogones maturing) shows as two clusters even with perfect gates, so groups of
     one population that differ only on such a marker are merged. Letters stick to their cluster. */
  const gating = () => !!(S && LEVELS[S.level].gating);
  function initGates() {
    const r = FC.mulberry32((S.seed ^ 0x5bd1e995) >>> 0);
    const start = mk => isScatter(mk) ? 150 + r() * 500 : 0.8 + r() * 1.9;
    return S.P.plots.map(pl => isFscSsc(pl) ? { y1: 140 + r() * 260, y2: 430 + r() * 300 } : { x: start(axes(pl)[0]), y: start(axes(pl)[1]) });
  }
  // Is population p naturally split on this axis (so a gate there is right to cut it)?
  function naturallySplit(p, mk) {
    if (mk === 'LCk' || mk === 'LCl') return p.lc === 'poly';
    if (mk === 'FSC' || mk === 'SSC') return false;
    return observed(p, mk) === 'split';
  }
  function regroup() {
    const P = S.P, n = P.pops.length, total = P.events.reduce((a, e) => a + e.length, 0);
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
  /* The rows the player names: populations (labeled boards) or the player's groups (Hard). */
  const rows = () => gating() ? S.groups.map(g => ({ label: g.label, slot: g.slot, pop: g.pop, purity: g.purity }))
    : S.P.pops.map(p => ({ label: p.label, slot: p.slot, pop: p, purity: 1 }));
  const rowTag = r => `${shapeIcon(r.slot)} <b>${r.label}</b>`;
  const cloneRowObj = () => gating() ? rows().find(r => r.label === S.cloneRow) : { label: target().label, slot: target().slot, pop: target(), purity: 1 };

  function plotOpts(i, size = 240) {
    if (!gating()) return { size, focus: S.mode === 'clone' ? target().slot : S.focus };
    const cr = S.mode === 'clone' ? cloneRowObj() : null;
    const labels = 'ABCDE'.split('').map((l, slot) => S.groups.some(g => g.slot === slot) ? l : null);
    return { size, focus: S.mode === 'clone' ? (cr ? cr.slot : null) : S.focus, labels: 'none', paint: S.paint, paintLabels: labels, gate: S.gates[i] };
  }
  function drawPlots() {
    $('#plots').innerHTML = S.P.plots.map((pl, i) => `<figure data-plot="${i}" class="${S.flash === i ? 'flash' : ''}">${renderPlot(S.P, pl, plotOpts(i))}<figcaption>${plotName(pl)}</figcaption></figure>`).join('');
    fitPlots();
  }

  /* Every plot on screen at once: pick the column count that gives the biggest square plots in the
     space left above (phones) or beside (desktop) the panel. Press-and-hold or tap shows one large. */
  function fitPlots() {
    const grid = $('#plots'); if (!S || !grid.clientWidth) return;
    const n = S.P.plots.length, W = grid.clientWidth, H = grid.clientHeight, gap = 8, pad = 10, cap = 16;
    let best = { s: 0, c: 1 };
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c);
      const s = Math.min((W - gap * (c - 1)) / c - pad, (H - gap * (r - 1)) / r - pad - cap);
      if (s > best.s) best = { s, c };
    }
    const s = Math.max(70, Math.min(330, Math.floor(best.s)));
    grid.style.setProperty('--plot', s + 'px');
    grid.style.gridTemplateColumns = `repeat(${best.c}, ${s + pad}px)`;
    grid.classList.toggle('tiny', s < 150);
  }

  // ---------- scratch pad: markers sorted by cell type ----------
  // Easy: a filled reference. Medium/Hard: the player fills it in; the eye reveals a row from the
  // answer key and counts as a peek. Settings → Fill in the reference table reveals them all.
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
  const padFilled = id => freePeeks() || S.peeks.has(id);
  function padHTML() {
    const mks = markersOf(shownPlots());
    let h = `<p class="sub">${freePeeks()
      ? 'Reference for Easy: each cell type on this board, read on the markers these plots show.'
      : 'Sort the markers by cell type from memory: tap a cell to cycle its value. The eye fills a row from the key and counts as a peek; anything you had wrong gets a wavy underline.'}</p>`;
    h += `<div class="padwrap"><table class="pad"><thead><tr><th></th>${mks.map(mk => `<th scope="col">${mk === 'LC' ? 'κ/λ' : esc(mk)}</th>`).join('')}${freePeeks() ? '' : '<th></th>'}</tr></thead><tbody>`;
    for (const id of S.P.pool) {
      const filled = padFilled(id);
      h += `<tr class="${S.padRow === id ? 'hl' : ''}" data-padrow="${id}"><th scope="row" title="${esc(BY[id].long)}">${esc(BY[id].name)}</th>`;
      for (const mk of mks) {
        const mine = S.pad[id + '|' + mk];
        if (filled) {
          const v = truth(id, mk), diff = mine && mine !== v;
          h += `<td class="pv ${padClass(v)}${diff ? ' diff' : ''}"${diff ? ` title="you had ${esc(PAD_TEXT[mine] || mine)}"` : ''}><span>${esc(PAD_TEXT[v] || v)}</span></td>`;
        } else {
          h += `<td class="pv ${padClass(mine)}"><button data-pad="${id}|${mk}" aria-label="${esc(BY[id].name)}, ${esc(mk)}: ${mine ? esc(mine) : 'blank'}">${mine ? esc(PAD_TEXT[mine] || mine) : ''}</button></td>`;
        }
      }
      if (!freePeeks()) h += `<td class="rv">${filled ? '<span class="tally" title="peeked">seen</span>' : `<button class="reveal" data-reveal="${id}" aria-label="Reveal ${esc(BY[id].name)} (counts as a peek)" title="Reveal (counts as a peek)">${ICON.eye}</button>`}</td>`;
      h += '</tr>';
    }
    return h + '</tbody></table></div><p class="help">± partly positive, or varies by patient · κ/λ: 1 = one light chain (clonal), 2 = both, − = none · SSC lo / mid / hi.</p>';
  }
  function jumpToPad(id) {
    S.tab = 'pad'; S.padRow = id; S.sheet = 'open'; drawPanel();
    const r = document.querySelector(`[data-padrow="${id}"]`); if (r) r.scrollIntoView({ block: 'nearest' });
  }
  function fillReference() {
    if (freePeeks()) return;
    for (const id of S.P.pool) S.peeks.add(id);
    S.tab = 'pad'; S.sheet = 'open'; drawPanel();
  }

  // ---------- panel ----------
  function tallyText() {
    return `${plural(S.wrongChecks, 'mistake')} · ${plural(S.hints, 'hint')}${freePeeks() ? '' : ' · ' + plural(S.peeks.size, 'peek')}`;
  }
  function drawPanel() {
    const P = S.P, el = $('#panel'), play = S.phase === 'play';
    const tally = `<span class="tally">${tallyText()}${prefs.autoCheck ? ' · auto-check on' : ''}</span>`;
    let h = '';
    if (S.mode === 'pops') {
      h += gating()
        ? `<p class="sub">No labels on Hard: drag each plot's gate (the crosshair; two side-scatter lines on FSC/SSC) and the events sort themselves into lettered groups across every plot. Get one clean group per population, then name each group.</p><p class="gstat">${plural(S.groups.length, 'group')}${S.extraGroups ? ` (+${S.extraGroups} too many to letter)` : ''} · this tube has ${P.pops.length} populations</p>`
        : `<p class="sub">Give each letter an identity; decoys are mixed in and none is used twice. Tap a cell: ruled out, then chosen, then blank. Tap a letter to highlight it in every plot; tap a column name to find it in the pad.</p>`;
      h += `<table class="lgrid"><thead><tr><th></th>${P.pool.map(id => `<th><button class="colh" data-jump="${id}" title="${esc(BY[id].long)}">${esc(BY[id].name)}</button></th>`).join('')}</tr></thead><tbody>`;
      for (const p of rows()) {
        const c = S.checked[p.label];
        h += `<tr data-row="${p.label}" class="${S.focus === p.slot ? 'focus' : ''}"><th data-focus="${p.label}">${rowTag(p)}${c ? `<span class="rowmark ${c}">${ICON[c]}${c}</span>` : ''}</th>`;
        for (const id of P.pool) {
          const m = S.marks[p.label + '|' + id];
          h += `<td class="${m || ''}"><button data-cell="${p.label}|${id}" ${play ? '' : 'disabled'} aria-label="${p.label}, ${esc(BY[id].name)}: ${m ? MARK_WORD[m] : 'blank'}">${m ? ICON[m] : ''}</button></td>`;
        }
        h += '</tr>';
      }
      h += '</tbody></table>';
      const ready = rows().length > 0 && rows().every(p => P.pool.some(id => S.marks[p.label + '|' + id] === 'yes'));
      if (play) h += `<div class="actions">${prefs.autoCheck ? '' : `<button class="btn primary" data-act="check" ${ready ? '' : 'disabled'}>Check</button>`}${tally}</div>`;
    } else {
      if (gating()) {
        h += `<p class="sub">No labels on Hard: drag each plot's gate and the events sort themselves into lettered groups. Find the abnormal group, pick it, then diagnose it.</p>`;
        h += `<div class="gpick"><span>Abnormal group:</span>${rows().map(r => `<button class="gchip" data-crow="${r.label}" aria-pressed="${S.cloneRow === r.label}" ${play ? '' : 'disabled'}>${rowTag(r)}</button>`).join('') || '<span class="muted">no groups yet</span>'}</div>`;
      } else {
        const t = target();
        h += `<p class="sub">Population ${popTag(t)} is abnormal; the rest of the tube is faded background. Strike out what the plots rule out, then choose. Tap a name: ruled out, then chosen, then blank.</p>`;
      }
      for (const id of P.pool) {
        const m = S.marks['dx|' + id], c = S.checked[id];
        h += `<div class="dxrow"><button class="dx ${m || ''}" data-dx="${id}" ${play ? '' : 'disabled'}>${m ? ICON[m] : '<span class="ic"></span>'}<span class="nm">${esc(BY[id].name)}</span>${c ? `<span class="rowmark ${c}">${ICON[c]}${c}</span>` : ''}</button><button class="padlink" data-jump="${id}">pad</button></div>`;
      }
      const ready = P.pool.some(id => S.marks['dx|' + id] === 'yes');
      if (play) h += `<div class="actions">${prefs.autoCheck ? '' : `<button class="btn primary" data-act="check" ${ready ? '' : 'disabled'}>Diagnose</button>`}${tally}</div>`;
    }
    if (S.msg) h += `<div class="msg ${S.msg.kind}">${S.msg.html}</div>`;
    if (S.phase === 'pct') {
      const t = P.pops.find(p => p.label === P.pct.label);
      h += `<div class="msg"><b>Last step.</b> Population ${popTag(t)} is about what share of all events?<div class="pctq">${P.pct.options.map(v => `<button class="btn" data-pct="${v}">${v}%</button>`).join('')}</div></div>`;
    }
    if (S.phase === 'done') h += recap();
    const tab = (k, t) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${t}</button>`;
    const chev = S.sheet === 'min' ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4';
    el.innerHTML = `<div class="tabs" role="tablist">${tab('answer', 'Answer')}${tab('pad', freePeeks() ? 'Reference' : 'Scratch pad')}<button class="sheet-tg" data-sheet aria-label="${S.sheet === 'min' ? 'Show the panel' : 'Shrink the panel'}"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="${chev}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="tabbody">${S.tab === 'pad' ? padHTML() : h}</div>`;
    el.classList.toggle('min', S.sheet === 'min');
    $('#hintBtn').disabled = !play;
    persist();
    fitPlots();
  }

  // ---------- checking ----------
  function wrongReason(id, p) {
    const r = why(id, p, S.P.plots);
    return r.length ? r[0] : 'it fits these plots, but another population needs that identity';
  }
  function check() {
    const P = S.P;
    if (S.mode === 'pops') {
      if (gating()) {
        const gp = gateProblems();
        if (gp.length) { S.wrongChecks++; S.msg = { kind: 'bad', html: `<b>Fix the gates first.</b><ul>${gp.map(x => `<li>${x}</li>`).join('')}</ul>` }; return drawPanel(); }
      }
      const bad = [];
      for (const r of rows()) {
        const id = P.pool.find(i => S.marks[r.label + '|' + i] === 'yes');
        if (id === r.pop.id) { S.checked[r.label] = 'right'; continue; }
        S.checked[r.label] = 'wrong';
        bad.push(`${rowTag(r)} is not ${esc(BY[id].name)}: ${esc(wrongReason(id, r.pop))}.`);
      }
      if (bad.length) { S.wrongChecks++; S.msg = { kind: 'bad', html: `<b>${bad.length} not right yet.</b><ul>${bad.map(b => `<li>${b}</li>`).join('')}</ul>` }; }
      else finishBoard();
    } else checkClone();
    drawPanel();
  }
  /* Hard: are the gates good enough to name groups? */
  function gateProblems() {
    const out = [], rs = rows(), P = S.P;
    if (S.extraGroups || rs.length > P.pops.length) out.push('There are more groups than populations: a gate is cutting through a cluster.');
    for (const r of rs) if (r.purity < 0.85) out.push(`${rowTag(r)} mixes two populations: move a gate into the gap between them.`);
    for (const p of P.pops) { const mine = rs.filter(r => r.pop === p && r.purity >= 0.85); if (mine.length > 1) out.push(`${mine.map(rowTag).join(' and ')} are one population split by a gate.`); }
    if (!out.length && rs.length < P.pops.length) out.push('A population is hiding inside another group: some gate sits on the wrong side of a cluster.');
    return out;
  }
  function checkClone() {
    const t = target(), id = S.P.pool.find(i => S.marks['dx|' + i] === 'yes');
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
    const r = rows().find(q => q.label === row), id = S.P.pool.find(i => S.marks[row + '|' + i] === 'yes');
    if (!id || !r) return;
    if (r.purity < 0.85) { S.checked[row] = 'wrong'; S.wrongChecks++; S.msg = { kind: 'bad', html: `${rowTag(r)} mixes two populations: move a gate into the gap first.` }; return; }
    if (id === r.pop.id) { S.checked[row] = 'right'; S.msg = null; }
    else { S.checked[row] = 'wrong'; S.wrongChecks++; S.msg = { kind: 'bad', html: `${rowTag(r)} is not ${esc(BY[id].name)}: ${esc(wrongReason(id, r.pop))}.` }; }
    if (rows().every(q => S.checked[q.label] === 'right') && (!gating() || !gateProblems().length)) finishBoard();
  }
  function finishBoard() {
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
    st[k] = v; save('flowcyto.stats', st); S.stats = v;
  }

  // ---------- hints: one logical step, with its reason ----------
  /* Order: undo a mistake first; then cross out an identity a plot rules out; then place an identity
     that is the only one left; then the cross-elimination step ("that identity belongs to another
     letter"). Highlights the population and the plot that decides it. */
  function firstContradiction(id, p) {
    for (const mk of markersOf(shownPlots())) if (!fits(id, p, [mk])) {
      const i = mk === 'SSC' ? 0 : S.P.plots.findIndex(pl => plotMarkers([pl.x, pl.y]).includes(mk));
      return { mk, plot: i, text: why(id, p, S.P.plots)[0] };
    }
    return null;
  }
  /* Hard: the first gate line that leaves more than 5% of a population on the wrong side (or cuts one),
     and where it should go. A line's cost at v: for each population, the share of its events on the wrong side
     (when its reading says which side) or the smaller share either side (when nothing says, as for the
     side-scatter line on CD45/SSC); naturally split populations cost nothing. */
  function badGate() {
    const P = S.P;
    for (const [i, pl] of P.plots.entries()) {
      const gt = S.gates[i], [xm, ym] = axes(pl);
      const lines = gt.y1 != null ? [['y1', 'SSC'], ['y2', 'SSC']] : [['x', xm], ['y', ym]];
      for (const [k, mk] of lines) {
        const cost = v => P.pops.map((p, pi) => {
          if (naturallySplit(p, mk)) return 0;
          const evs = P.events[pi], up = evs.filter(e => axisVal(e, mk) > v).length / evs.length, want = side(p, mk, k);
          return want === 'above' ? 1 - up : want === 'below' ? up : Math.min(up, 1 - up);
        });
        const now = cost(gt[k]);
        if (Math.max(...now) <= 0.05) continue;
        const top = isScatter(mk) ? 1024 : 4, step = top / 160;
        let best = gt[k], bc = Infinity;
        for (let v = step; v < top; v += step) {
          if (k === 'y1' && v >= gt.y2 - 20) break;
          if (k === 'y2' && v <= gt.y1 + 20) continue;
          const c = cost(v).reduce((a, b) => a + b, 0); if (c < bc - 1e-9) { bc = c; best = v; }
        }
        // only a line that can actually do better (populations that truly touch can't be split cleaner)
        if (bc < now.reduce((a, b) => a + b, 0) - 0.02) return { i, k, mk, to: best, pl };
      }
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
    const P = S.P, mks = markersOf(shownPlots());
    if (gating()) {
      const bg = badGate();
      if (bg) {
        S.gates[bg.i][bg.k] = bg.to; regroup();
        S.hints++; S.msg = { kind: 'hint', html: `<b>Hint.</b> The ${lineName(bg)} on ${plotName(bg.pl)} cut through a population or left one on the wrong side. Moved it into the gap.` };
        S.flash = bg.i; S.tab = 'answer'; S.sheet = 'open'; drawPlots(); drawPanel();
        const m = document.querySelector('#panel .msg.hint'); if (m) m.scrollIntoView({ block: 'nearest' });
        setTimeout(() => { S.flash = null; const f = document.querySelector('figure.flash'); if (f) f.classList.remove('flash'); }, 2600);
        return;
      }
      if (S.mode === 'clone') {
        const cr = cloneRowObj(), good = rows().find(r => r.pop === target());
        if (good && (!cr || cr.label !== good.label)) {
          S.cloneRow = good.label; S.hints++;
          S.msg = { kind: 'hint', html: `<b>Hint.</b> ${rowTag(good)} is the abnormal group: no normal cell type in this tube reads that way. Picked it.` };
          S.tab = 'answer'; S.sheet = 'open'; drawPlots(); drawPanel(); return;
        }
      }
    }
    const tc = S.mode === 'clone' ? cloneRowObj() : null;
    const list = S.mode === 'pops' ? rowsForHint() : tc ? [{ p: tc.pop, r: tc, key: id => 'dx|' + id, sol: target().id }] : [];
    const say = (html, p, plot) => {
      S.hints++; S.msg = { kind: 'hint', html: `<b>Hint.</b> ${html}` };
      if (S.mode === 'pops' && p) S.focus = p.slot;
      S.flash = plot != null && plot >= 0 ? plot : null;
      S.tab = 'answer'; S.sheet = 'open';
      drawPlots(); drawPanel();
      const m = document.querySelector('#panel .msg.hint'); if (m) m.scrollIntoView({ block: 'nearest' });
      if (S.flash != null) setTimeout(() => { S.flash = null; const f = document.querySelector('figure.flash'); if (f) f.classList.remove('flash'); }, 2600);
    };
    const who = (p, r) => S.mode === 'pops' ? rowTag(r) : `The clone (${rowTag(r)})`;
    // 1. mistakes
    for (const { p, r, key, sol } of list) {
      const bad = P.pool.find(id => S.marks[key(id)] === 'yes' && id !== sol);
      if (bad) { delete S.marks[key(bad)]; delete S.checked[S.mode === 'pops' ? r.label : bad]; const c = firstContradiction(bad, p); return say(`${who(p, r)} is not ${esc(BY[bad].name)}: ${esc(c ? c.text : 'another population needs that identity')}. Cleared it.`, r, c && c.plot); }
      if (S.marks[key(sol)] === 'no') { delete S.marks[key(sol)]; return say(`You crossed out the right identity for ${who(p, r)}. Restored that cell; look at its row again.`, r); }
    }
    // 2. a cross-out a plot proves
    for (const { p, r, key, sol } of list) {
      if (S.marks[key(sol)] === 'yes') continue;
      for (const id of P.pool) {
        if (S.marks[key(id)] || fits(id, p, mks)) continue;
        const c = firstContradiction(id, p);
        S.marks[key(id)] = 'no';
        return say(`${who(p, r)} is not ${esc(BY[id].name)}: ${esc(c.text)}. Crossed it out.`, r, c.plot);
      }
    }
    // 3. the only identity left
    for (const { p, r, key, sol } of list) {
      if (S.marks[key(sol)] === 'yes') continue;
      const left = P.pool.filter(id => S.marks[key(id)] !== 'no');
      if (left.length === 1 || S.mode === 'clone') return place(r, key, sol, `${esc(BY[sol].name)} is the only identity left that fits ${who(p, r)}.`, say);
    }
    // 4. cross-elimination: an identity that fits this letter belongs to another
    const cand = countSolutions(P.pops, P.pool, mks).cand;
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
  const rowsForHint = () => rows().map(r => ({ p: r.pop, r, key: id => r.label + '|' + id, sol: r.pop.id }));
  function place(p, key, sol, text, say) {
    for (const k of Object.keys(S.marks)) {
      const [r2, i2] = k.split('|');
      if (S.marks[k] === 'yes' && (k === key(sol) || r2 === key(sol).split('|')[0] || i2 === sol)) delete S.marks[k];
    }
    S.marks[key(sol)] = 'yes';
    if (prefs.autoCheck) { if (S.mode === 'pops') autoCheckRow(p.label); else checkClone(); }
    say(text + ' Chose it.', p);
  }

  // ---------- recap ----------
  function recap() {
    const P = S.P, plots = P.plots;
    let h = `<div class="recap"><p class="tally">${tallyText()}. ${S.stats ? `${S.stats.solved} solved at this level, ${S.stats.clean} clean (no mistakes, hints or peeks).` : ''}</p>`;
    const pops = S.mode === 'clone' ? [target()] : P.pops;
    h += `<h3>${S.mode === 'clone' ? 'The clone' : 'The populations'}</h3>`;
    for (const p of pops) {
      const e = BY[p.id];
      const lc = p.lc === 'kappa' || p.lc === 'lambda' ? ` (${p.lc} restricted)` : '';
      h += `<div class="item">${gating() ? '' : popTag(p) + ' '}${esc(e.long)}${lc} · ${Math.round(p.frac * 100)}% of events<div class="why">${esc(e.teach)}</div></div>`;
    }
    const decoys = S.mode === 'clone' ? P.pool.filter(id => id !== target().id) : P.pool.filter(id => !P.pops.some(p => p.id === id));
    if (decoys.length) {
      h += '<h3>Why the decoys were out</h3>';
      for (const d of decoys) {
        const cands = S.mode === 'clone' ? [target()] : P.pops;
        let best = null;
        for (const p of cands) { const r = why(d, p, plots); if (!best || r.length < best.r.length) best = { p, r }; }
        h += `<div class="item">${esc(BY[d].name)}<div class="why">Closest to ${gating() ? 'the ' + esc(BY[best.p.id].name.toLowerCase()) : best.p.label}, but ${esc(best.r[0] || 'its letter was taken by a better fit')}.</div></div>`;
      }
    }
    const herring = plots.find(p => p.role === 'herring');
    if (herring) h += `<h3>Red herring</h3><div class="item">${esc(plotName(herring))}<div class="why">Every population is negative on it. It was there for a decoy, not for the answer.</div></div>`;
    h += `<div class="actions"><button class="btn primary" data-act="new">Next board</button><button class="btn" data-act="menu">Menu</button></div></div>`;
    return h;
  }

  // ---------- panel input ----------
  const cycle = m => m === undefined ? 'no' : m === 'no' ? 'yes' : undefined;
  $('#panel').addEventListener('click', ev => {
    const tb = ev.target.closest('[data-tab]');
    if (tb) { S.tab = tb.dataset.tab; S.sheet = 'open'; return drawPanel(); }
    if (ev.target.closest('[data-sheet]')) { S.sheet = S.sheet === 'min' ? 'open' : 'min'; return drawPanel(); }
    const jp = ev.target.closest('[data-jump]');
    if (jp) return jumpToPad(jp.dataset.jump);
    const pc = ev.target.closest('[data-pad]');
    if (pc) {
      const [id, mk] = pc.dataset.pad.split('|'), key = id + '|' + mk, c = padCycle(mk), i = c.indexOf(S.pad[key]);
      if (i === c.length - 1) delete S.pad[key]; else S.pad[key] = c[i + 1];
      return drawPanel();
    }
    const rv = ev.target.closest('[data-reveal]');
    if (rv) { S.peeks.add(rv.dataset.reveal); S.padRow = rv.dataset.reveal; return drawPanel(); }
    const fc = ev.target.closest('[data-focus]');
    if (fc) { const slot = rows().find(p => p.label === fc.dataset.focus).slot; S.focus = S.focus === slot ? null : slot; drawPlots(); return drawPanel(); }
    const crw = ev.target.closest('[data-crow]');
    if (crw) { S.cloneRow = S.cloneRow === crw.dataset.crow ? null : crw.dataset.crow; S.msg = null; drawPlots(); return drawPanel(); }
    const cell = ev.target.closest('[data-cell]');
    if (cell) {
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
  });
  // Pointing at a row (mouse) highlights that population in every plot.
  $('#panel').addEventListener('mouseover', ev => {
    if (!S || S.mode !== 'pops' || !matchMedia('(hover: hover)').matches) return;
    const tr = ev.target.closest('tr[data-row]');
    const row = tr && rows().find(p => p.label === tr.dataset.row), slot = row ? row.slot : null;
    if (slot !== S.focus) { S.focus = slot; drawPlots(); $('#panel').querySelectorAll('tr[data-row]').forEach(r => r.classList.toggle('focus', tr === r)); }
  });
  $('#panel').addEventListener('mouseleave', () => { if (S && matchMedia('(hover: hover)').matches && S.focus != null) { S.focus = null; drawPlots(); } });

  // ---------- enlarge a plot: tap, or press and hold (Settings); on Hard, drag gates ----------
  const zoom = $('#zoom');
  let zoomI = null, zoomAt = 0;
  function openZoom(i) {
    zoomI = i; zoomAt = performance.now();
    const pl = S.P.plots[i], size = Math.floor(Math.min(innerWidth - 24, innerHeight - (gating() ? 130 : 90), 640));
    const tail = gating() ? `<div class="zoom-foot"><span>Drag anywhere to move the gate</span><button class="btn primary" data-done>Done</button></div>` : '';
    zoom.innerHTML = `<figure data-zplot="${i}">${renderPlot(S.P, pl, plotOpts(i))}<figcaption>${plotName(pl)}${!gating() && prefs.enlarge === 'tap' ? ' · tap to close' : ''}</figcaption>${tail}</figure>`;
    zoom.style.setProperty('--zoom', size + 'px');
    zoom.hidden = false;
  }
  const closeZoom = () => { zoom.hidden = true; zoom.innerHTML = ''; zoomI = null; };
  let holdTimer = null, held = false, drag = null, frame = 0;
  // Pointer position -> gate, in the plot's own data units.
  function moveGate(d, ev) {
    const svg = d.zoom ? zoom.querySelector('svg') : document.querySelector(`#plots [data-plot="${d.i}"] svg`);
    if (!svg) return;
    const rc = svg.getBoundingClientRect(), g = geom(S.P.plots[d.i]);
    const vx = (ev.clientX - rc.left) / rc.width * g.S, vy = (ev.clientY - rc.top) / rc.height * g.S;
    const gt = S.gates[d.i];
    if (gt.y1 != null) {
      const y = g.dy(vy);
      if (!d.line) d.line = Math.abs(y - gt.y1) < Math.abs(y - gt.y2) ? 'y1' : 'y2';
      if (d.line === 'y1') gt.y1 = Math.min(y, gt.y2 - 20); else gt.y2 = Math.max(y, gt.y1 + 20);
    } else { gt.x = g.dx(vx); gt.y = g.dy(vy); }
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0; regroup(); drawPlots();
      if (zoomI != null) { const f = zoom.querySelector('figure'); if (f) f.firstElementChild.outerHTML = renderPlot(S.P, S.P.plots[zoomI], plotOpts(zoomI)); }
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
    drag.moved = true; moveGate(drag, ev);
  });
  $('#plots').addEventListener('pointerup', () => { if (!drag || drag.zoom) return; const d = drag; drag = null; if (!d.moved) openZoom(d.i); });
  zoom.addEventListener('pointerdown', ev => {
    if (!gating() || zoomI == null || !ev.target.closest('svg') || S.phase !== 'play') return;
    drag = { i: zoomI, zoom: true, moved: true }; zoom.setPointerCapture(ev.pointerId); moveGate(drag, ev);
  });
  zoom.addEventListener('pointermove', ev => { if (drag && drag.zoom) moveGate(drag, ev); });
  zoom.addEventListener('pointerup', () => { if (drag && drag.zoom) drag = null; });
  const release = () => { clearTimeout(holdTimer); if (held) { held = false; closeZoom(); } };
  addEventListener('pointerup', release); addEventListener('pointercancel', release);
  $('#plots').addEventListener('click', ev => { const f = ev.target.closest('[data-plot]'); if (f && !gating() && prefs.enlarge === 'tap') openZoom(+f.dataset.plot); });
  $('#plots').addEventListener('contextmenu', ev => ev.preventDefault());
  zoom.addEventListener('click', ev => {
    if (ev.target.closest('[data-done]')) return closeZoom();
    if (performance.now() - zoomAt < 400) return; // a touch's own follow-up click lands on the new overlay
    if (gating() ? !ev.target.closest('figure') : prefs.enlarge === 'tap') closeZoom();
  });
  addEventListener('keydown', ev => { if (ev.key === 'Escape' && !zoom.hidden) closeZoom(); });

  // ---------- settings ----------
  const dlg = $('#settings');
  function openSettings() {
    const seg = (k, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, t]) => `<button role="radio" data-pref="${k}" data-v="${v}" aria-checked="${String(prefs[k]) === String(v)}">${t}</button>`).join('')}</div>`;
    let h = `<div class="set-head"><h2>Settings</h2><button class="iconbtn" data-close aria-label="Close settings">${ICON.wrong.replace('var(--pink)', 'currentColor')}</button></div>`;
    const a = prefs.appearance;
    h += `<div class="set-row"><div><b>Appearance</b><span>This device only.</span></div><div class="seg" role="radiogroup">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, t]) => `<button role="radio" data-theme-set="mode" data-v="${v}" aria-checked="${a.mode === v}">${t}</button>`).join('')}</div></div>`;
    h += `<div class="set-row themes"><div><b>Light theme</b></div><div class="theme-row" role="radiogroup">${themeChoice('light', 'default', 'Default')}${themeChoice('light', 'light', 'Light')}</div></div>`;
    h += `<div class="set-row themes"><div><b>Dark theme</b></div><div class="theme-row" role="radiogroup">${themeChoice('dark', 'dark', 'Dark')}${themeChoice('dark', 'black', 'Black')}</div></div>`;
    h += `<div class="set-row"><div><b>Enlarge a plot</b><span>Press and hold shows it while your finger is down; tap opens it until you tap again. On Hard a tap always opens it, so you can drag its gate.</span></div>${seg('enlarge', [['hold', 'Press and hold'], ['tap', 'Tap']])}</div>`;
    h += `<div class="set-row"><div><b>Auto-check</b><span>Marks each choice right or wrong as you make it. A wrong choice counts as a mistake.</span></div>${seg('autoCheck', [[false, 'Off'], [true, 'On']])}</div>`;
    if (S) {
      const left = S.P.pool.filter(id => !S.peeks.has(id)).length;
      h += `<div class="set-row"><div><b>Reference table</b><span>${freePeeks() ? 'Already filled in on Easy.' : left ? `Fills the scratch pad from the key. Counts as ${plural(left, 'peek')}.` : 'Already filled in.'}</span></div><button class="btn" data-fill ${freePeeks() || !left ? 'disabled' : ''}>Fill in the reference table</button></div>`;
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
      const k = b.dataset.pref, v = k === 'autoCheck' ? b.dataset.v === 'true' : b.dataset.v;
      setPref(k, v);
      if (S) drawPanel();
      return openSettings();
    }
    if (ev.target.closest('[data-fill]')) { fillReference(); dlg.close(); }
  });

  // ---------- top bar ----------
  $('#menuBtn').addEventListener('click', () => { location.hash = '/'; });
  $('#newBtn').addEventListener('click', () => play(S.mode, S.level));
  $('#hintBtn').addEventListener('click', hint);
  $('#setBtn').addEventListener('click', openSettings);
  addEventListener('resize', () => { if (S) fitPlots(); });
  addEventListener('hashchange', route);
  FC.state = () => S; // for tests and the console
  applyTheme();
  route();
})();
