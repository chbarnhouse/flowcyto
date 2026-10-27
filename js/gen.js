/* FlowCyto generator — sample a specimen, simulate its events, and pick the plots to show so the
   board has exactly one answer.

   A board: populations A–E (each drawn with its own shape) and a pool of identities, some of them
   decoys. The player gives every population an identity; no identity is used twice. A population
   "fits" an identity when that identity's marker profile reads the same (negative / positive / split,
   light chains, scatter) on every plot shown. The board is fair when exactly one assignment fits.

   Clue removal works the way sudoku generators do: start with every plot, drop plots one at a time
   in random order, and keep a drop only while the answer stays unique. What's left is minimal. */
(function () {
  'use strict';
  const FC = typeof module !== 'undefined' ? require('./kb.js') : window.FC;
  const { BY, ENTITIES, PLOTS, SPECIMENS, readClass } = FC;

  // ---------- seeded randomness ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // ---------- what each identity allows, what each population shows ----------
  const plotMarkers = p => p[0] === 'LC' ? ['LC'] : p.filter(Boolean);
  const plotKey = p => p.filter(Boolean).join('/');

  function allowed(e, mk) {
    if (mk === 'FSC') return [e.fsc];
    if (mk === 'SSC') return [e.ssc];
    if (mk === 'LC') return e.m.LC === 'poly' ? ['poly'] : e.m.LC === 'clonal' ? ['kappa', 'lambda'] : ['none'];
    const c = readClass(e.m[mk], mk);
    return c === 'var' ? ['neg', 'pos'] : [c];
  }
  /* A population's reading: fixed by its identity, except light chains and 'var' markers, which
     each case settles (pop.res). */
  function observed(pop, mk) {
    if (mk === 'LC') return pop.lc;
    return (pop.res && pop.res[mk]) || allowed(BY[pop.id], mk)[0];
  }
  /* A partly-positive population (or identity) never rules anything in or out on that marker:
     which fraction is positive is detail, not a STEP 1 fact. */
  const fitsOne = (eid, pop, mk) => { const a = allowed(BY[eid], mk), o = observed(pop, mk); return o === 'split' || a.includes('split') || a.includes(o); };
  const fits = (eid, pop, markers) => markers.every(mk => fitsOne(eid, pop, mk));

  /* Count assignments of populations to distinct pool identities (stops at `cap`). */
  function countSolutions(pops, pool, markers, cap = 2) {
    const cand = pops.map(p => pool.filter(id => fits(id, p, markers)));
    const used = new Set();
    let n = 0;
    const order = pops.map((_, i) => i).sort((a, b) => cand[a].length - cand[b].length);
    (function dfs(k) {
      if (n >= cap) return;
      if (k === order.length) { n++; return; }
      for (const id of cand[order[k]]) {
        if (used.has(id)) continue;
        used.add(id); dfs(k + 1); used.delete(id);
        if (n >= cap) return;
      }
    })(0);
    return { n, cand };
  }
  const markersOf = plots => [...new Set(['SSC', ...plots.flatMap(plotMarkers)])].filter(mk => mk !== 'FSC'); // FSC is display-only

  // ---------- difficulty ----------
  const LEVELS = {
    easy: { label: 'Easy', pops: 3, decoys: 2, dx: 3, clone: 0.7, extra: 2, herring: 0, pct: false, wantMatching: false },
    medium: { label: 'Medium', pops: 4, decoys: 3, dx: 4, cloneMin: 2, clone: 1, extra: 0, herring: 0, pct: false, wantMatching: true },
    hard: { label: 'Hard', pops: 5, decoys: 4, dx: 5, clone: 1, extra: 0, herring: 1, pct: true, wantMatching: true },
  };

  const ALL_MARKERS = markersOf(PLOTS);
  const excluded = (a, b) => (BY[a].excl || []).includes(b) || (BY[b].excl || []).includes(a);
  function distance(eid, pop) { let d = 0; for (const mk of ALL_MARKERS) if (!fitsOne(eid, pop, mk)) d++; return d; }

  /* mode 'pops': name every population (grid). mode 'clone': diagnose the one abnormal population
     from a list of neoplasms; the rest of the tube is background. */
  function generate(seed, level = 'medium', mode = 'pops') {
    const cfg = LEVELS[level];
    const cloneMode = mode === 'clone';
    const r = mulberry32(seed >>> 0);
    // Pick the clone first (every neoplasm equally likely) and keep it across retries, so the
    // preference for cross-elimination boards doesn't skew which diagnoses come up.
    const clone = (cloneMode || r() < cfg.clone) ? pick(r, ENTITIES.filter(e => e.kind === 'neoplasm')).id : null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const spec = pick(r, clone ? SPECIMENS.filter(s => s.clones.includes(clone)) : SPECIMENS);
      const normals = shuffle(r, spec.normals).filter(id => !clone || !excluded(id, clone)).slice(0, cfg.pops - (clone ? 1 : 0));
      const ids = clone ? [...normals, clone] : normals;
      if (ids.length < cfg.pops) continue;
      const pops = ids.map(id => ({ id, lc: allowed(BY[id], 'LC')[0] }));
      for (const p of pops) {
        if (BY[p.id].m.LC === 'clonal') p.lc = r() < 0.6 ? 'kappa' : 'lambda';
        p.res = {};
        for (const [mk, lvl] of Object.entries(BY[p.id].m)) if (lvl === 'var') p.res[mk] = r() < 0.5 ? 'pos' : 'neg';
      }

      // Decoys: identities that differ from some population on only a few markers (never zero).
      const others = ENTITIES.filter(e => !ids.includes(e.id) && ids.every(id => !excluded(id, e.id)))
        .map(e => ({ id: e.id, d: Math.min(...pops.map(p => distance(e.id, p))) + r() * 1.5 }))
        .filter(x => x.d >= 1).sort((a, b) => a.d - b.d);
      // Half come from the clone's own lineage (its real look-alikes), the rest from the closest.
      const lin = clone ? shuffle(r, others.filter(x => BY[x.id].lineage === BY[clone].lineage)).slice(0, Math.ceil(cfg.decoys / 2)) : [];
      const rest = shuffle(r, others.filter(x => !lin.includes(x)).slice(0, cfg.decoys * 2));
      let decoys = [...lin, ...rest].slice(0, cfg.decoys).map(x => x.id);
      const cp = clone && pops.find(p => p.id === clone);
      if (cloneMode) {
        // Other neoplasms, the clone's lineage first, closest look-alikes before far ones.
        const neo = ENTITIES.filter(e => e.kind === 'neoplasm' && e.id !== clone && !excluded(e.id, clone))
          .map(e => ({ id: e.id, d: distance(e.id, cp) + r() * 1.5 + (e.lineage === BY[clone].lineage ? 0 : 4) }))
          .filter(x => x.d >= 1).sort((a, b) => a.d - b.d);
        decoys = shuffle(r, neo.slice(0, cfg.dx + 2)).slice(0, cfg.dx).map(x => x.id);
      }
      const pool = shuffle(r, cloneMode ? [clone, ...decoys] : [...ids, ...decoys]);
      const unique = plots => cloneMode
        ? pool.filter(id => fits(id, cp, markersOf(plots))).length === 1
        : countSolutions(pops, pool, markersOf(plots)).n === 1;

      const candidates = PLOTS.filter(p => !(p[0] === 'FSC' && p[1] === 'SSC'));
      if (!unique(candidates)) continue;

      // Pin one plot of the clone's hallmarks — preferring one that tells it from a pool look-alike.
      const hall = clone ? candidates.filter(p => plotMarkers(p).some(mk => BY[clone].key.includes(mk))) : [];
      const telling = hall.filter(p => pool.some(id => id !== clone && !fits(id, cp, plotMarkers(p))));
      const pinned = (telling.length ? pick(r, telling) : hall.length ? pick(r, hall) : null);
      const informs = q => pool.some(id => id !== clone && !fits(id, cp, plotMarkers(q)));
      // Sudoku-style clue removal.
      let shown = candidates.slice();
      for (const p of shuffle(r, candidates)) {
        if (p === pinned) continue;
        const trial = shown.filter(q => q !== p);
        // Diagnose-the-clone Medium keeps at least cloneMin marker plots that bear on the clone.
        if (cloneMode && cfg.cloneMin && trial.filter(q => informs(q)).length < cfg.cloneMin) continue;
        if (unique(trial)) shown = trial;
      }
      const needsMatching = !cloneMode && countSolutions(pops, pool, markersOf(shown)).cand.some(c => c.length > 1);
      if (!cloneMode && cfg.wantMatching && !needsMatching && attempt < 60) continue;

      const unused = shuffle(r, candidates.filter(p => !shown.includes(p)));
      const extras = [];
      // Easy: a couple of extra plots that confirm what the minimal set already implies.
      for (const p of unused) { if (extras.length >= cfg.extra) break; if (plotMarkers(p).some(mk => (cloneMode ? [cp] : pops).some(q => observed(q, mk) !== 'neg' && observed(q, mk) !== 'none'))) extras.push(p); }
      // Hard: a red herring — a plot aimed at a decoy, where every real population is negative.
      const herrings = [];
      for (const p of unused) {
        if (herrings.length >= cfg.herring) break;
        const mks = plotMarkers(p);
        const allNeg = mks.every(mk => pops.every(q => ['neg', 'none'].includes(observed(q, mk))));
        const lures = decoys.some(d => mks.some(mk => !['neg', 'none'].includes(allowed(BY[d], mk)[0])));
        if (allNeg && lures) herrings.push(p);
      }

      // Population sizes: the clone is big, normals share the rest.
      const w = pops.map(p => BY[p.id].kind === 'neoplasm' ? 2 + r() * 4 : 0.6 + r() * 1.6);
      const tot = w.reduce((a, b) => a + b, 0);
      pops.forEach((p, i) => { p.frac = w[i] / tot; });

      const order = [['FSC', 'SSC'], ...PLOTS.filter(p => shown.includes(p) || extras.includes(p) || herrings.includes(p))];
      const letters = shuffle(r, pops);
      letters.forEach((p, i) => { p.label = 'ABCDE'[i]; p.slot = i; });

      const puzzle = {
        seed: seed >>> 0, level, mode, target: cp ? cp.label : null, spec: spec.id, specName: spec.name,
        pops: letters, pool, plots: order.map(p => ({ x: p[0], y: p[1], key: plotKey(p), role: herrings.includes(p) ? 'herring' : extras.includes(p) ? 'extra' : 'clue' })),
        needsMatching, solution: Object.fromEntries(letters.map(p => [p.label, p.id])),
      };
      if (cfg.pct) {
        const target = letters.find(p => BY[p.id].kind === 'neoplasm') || pick(r, letters);
        const ans = Math.round(target.frac * 100);
        const opts = new Set([ans]);
        const steps = shuffle(r, [-30, -20, -12, 12, 20, 30]);
        for (const s of steps) { const v = ans + s; if (v >= 2 && v <= 95 && [...opts].every(o => Math.abs(o - v) >= 9)) opts.add(v); if (opts.size >= 4) break; }
        puzzle.pct = { label: target.label, answer: ans, options: [...opts].sort((a, b) => a - b) };
      }
      puzzle.events = simulate(puzzle, mulberry32((seed ^ 0x9e3779b9) >>> 0));
      return puzzle;
    }
    throw new Error('could not build a board for seed ' + seed);
  }

  // ---------- events ----------
  const LOG = { neg: [0.55, 0.22], dim: [1.75, 0.2], pos: [2.6, 0.22], bright: [3.3, 0.18] };
  const FSCV = { low: [290, 40], mid: [500, 50], high: [700, 50] };
  const SSCV = { low: [110, 30], mid: [330, 50], high: [640, 70] };
  const TOTAL = 900;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function simulate(puzzle, r) {
    const mks = ['FSC', 'SSC', 'CD45', ...new Set(puzzle.plots.flatMap(p => plotMarkers([p.x, p.y])))];
    return puzzle.pops.map(pop => {
      const e = BY[pop.id];
      const n = Math.max(45, Math.round(pop.frac * TOTAL));
      const ev = [];
      for (let i = 0; i < n; i++) {
        const u = r(), o = {};
        for (const mk of mks) {
          if (mk === 'FSC') { const [m, s] = FSCV[e.fsc]; o.FSC = clamp(m + s * gauss(r), 5, 1018); continue; }
          if (mk === 'SSC') { const [m, s] = SSCV[e.ssc]; o.SSC = clamp(m + s * gauss(r), 5, 1018); continue; }
          if (mk === 'LC') {
            const k = pop.lc === 'kappa' || (pop.lc === 'poly' && r() < 0.6);
            const l = pop.lc === 'lambda' || (pop.lc === 'poly' && !k);
            o.kappa = lv(k ? 'pos' : 'neg', r); o.lambda = lv(l ? 'pos' : 'neg', r); continue;
          }
          let level = e.m[mk] || '-';
          if (level === 'var') level = pop.res[mk] === 'pos' ? '+' : '-';
          if (level === 'split') {
            const on = e.cont ? (e.cont.late.includes(mk) ? u > 0.5 : u < 0.45) : r() < 0.5;
            level = on ? '+' : '-';
          }
          o[mk] = lv(level === '-' ? 'neg' : level === '+' ? 'pos' : level, r);
        }
        ev.push(o);
      }
      return ev;
    });
  }
  function lv(k, r) { const [m, s] = LOG[k]; return clamp(m + s * gauss(r), 0.03, 3.97); }

  /* Why a decoy doesn't fit a population, in words — for the end-of-board explanation. */
  function why(eid, pop, plots) {
    const out = [];
    for (const mk of markersOf(plots.map(p => [p.x, p.y]))) {
      if (fitsOne(eid, pop, mk)) continue;
      const a = allowed(BY[eid], mk), o = observed(pop, mk);
      out.push(describe(mk, o) + ' here; ' + BY[eid].name + (mk === 'LC' ? ' has ' : ' is ') + a.map(v => describe(mk, v, true)).join(' or '));
    }
    return out;
  }
  function describe(mk, cls, short) {
    if (mk === 'LC') return { none: 'no light chain', poly: 'both kappa and lambda', kappa: 'kappa only', lambda: 'lambda only' }[cls];
    if (mk === 'FSC') return (short ? '' : 'FSC ') + cls + (short ? ' FSC' : '');
    if (mk === 'SSC') return (short ? '' : 'SSC ') + cls + (short ? ' SSC' : '');
    return mk + { neg: '−', pos: '+', dim: ' dim', split: ' partly +' }[cls];
  }

  const API = { generate, countSolutions, fits, allowed, observed, markersOf, plotMarkers, why, describe, LEVELS, mulberry32 };
  if (typeof module !== 'undefined') module.exports = API; else window.FC = Object.assign(window.FC || {}, API);
})();
