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
  const fitsOne = (eid, pop, mk) => { if (eid === 'abn') return true; const a = allowed(BY[eid], mk), o = observed(pop, mk); return o === 'split' || a.includes('split') || a.includes(o); };
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
  /* One game, two steps: the **scratchpad** (give every population an identity: normal cell types plus
     "Abnormal (clone)") and then the **diagnosis** (name the clone). Each level is a set of switches
     (Custom builds its own):
     pops      populations in the tube (one of them is always the clone)
     decoys    normal cell types offered in the scratchpad beyond the ones present (0, n, or 'all')
     extra     plots shown beyond the minimum needed (real readings, maybe useful, never required)
     ref       'filled' reference, or 'blank' (you fill it in)
     gating    no labels: the player places a quad gate on each plot
     choose    the scratchpad starts empty: the player picks which cell types to consider
     scratch   the scratchpad step (Custom can drop it: then the clone is outlined, or picked as a group)
     dx        diagnosis: 'choice' (pick from 4) · 'all' (pick from every neoplasm) · 'type' · null (none)
     spread    cluster looseness (SD multiplier); pct asks what share of events the clone is */
  const LEVELS = {
    easy: { label: 'Easy', pops: 3, decoys: 0, extra: 0, ref: 'filled', spread: 1, dx: 'choice', scratch: true, cloneMin: 1, wantMatching: false },
    medium: { label: 'Medium', pops: 4, decoys: 2, extra: 2, ref: 'filled', spread: 1.1, dx: 'choice', scratch: true, cloneMin: 2, wantMatching: true },
    hard: { label: 'Hard', pops: 4, decoys: 2, extra: 2, ref: 'blank', spread: 1.15, dx: 'all', scratch: true, cloneMin: 2, wantMatching: true },
    expert: { label: 'Expert', pops: 4, decoys: 0, extra: 0, ref: 'blank', gating: true, spread: 1.12, dx: 'all', scratch: true, cloneMin: 2, wantMatching: true },
    master: { label: 'Master', pops: 5, decoys: 3, extra: 2, ref: 'blank', gating: true, spread: 1.3, dx: 'all', scratch: true, cloneMin: 2, wantMatching: true },
    extreme: { label: 'Extreme', pops: 5, decoys: 'all', extra: 2, ref: 'blank', gating: true, choose: true, spread: 1.45, pct: true, dx: 'type', scratch: true, cloneMin: 2, wantMatching: true },
  };
  /* Custom: the player's own switches (the menu's Custom tile). */
  function customLevel(c = {}) {
    const scratch = c.scratch !== false, dx = c.dx === 'off' ? null : (c.dx || 'choice');
    return { label: 'Custom', pops: c.pops || 4, decoys: c.choose ? 'all' : c.decoys ? 3 : 0, extra: c.extra ? 2 : 0, ref: c.ref || 'filled',
      gating: !!c.gating, choose: !!c.choose && scratch, spread: { distinct: 1, normal: 1.15, touching: 1.45 }[c.spread || 'normal'], pct: !!c.pct,
      dx: scratch || dx ? dx : 'choice', scratch, cloneMin: 2, wantMatching: !!(c.decoys || c.choose) };
  }

  const ALL_MARKERS = markersOf(PLOTS);
  const excluded = (a, b) => (BY[a].excl || []).includes(b) || (BY[b].excl || []).includes(a);
  function distance(eid, pop, mks = ALL_MARKERS) { let d = 0; for (const mk of mks) if (!fitsOne(eid, pop, mk)) d++; return d; }

  /* Content settings (js/content.js) pass `allow`: the cell types and markers that are on. A clone
     that reads the same as a normal cell of its specimen on every marker that's on can't be told
     apart, so it never comes up: lookalikes() names those normals and the markers that would separate them. */
  const okMarkers = allow => allow ? new Set(['FSC', 'SSC', 'CD45', ...allow.mks]) : null;
  const same = (a, b, mk) => { const x = allowed(BY[a], mk), y = allowed(BY[b], mk); return x.includes('split') || y.includes('split') || x.some(v => y.includes(v)); };
  function lookalikes(clone, allow) {
    const okE = new Set(allow.ents), okM = okMarkers(allow), mks = ALL_MARKERS.filter(mk => okM.has(mk));
    const normals = new Set(SPECIMENS.filter(s => s.clones.includes(clone)).flatMap(s => s.normals).filter(id => okE.has(id) && !excluded(id, clone)));
    const like = [...normals].filter(n => mks.every(mk => same(clone, n, mk)));
    return { like, need: [...new Set(like.flatMap(n => ALL_MARKERS.filter(mk => !okM.has(mk) && !same(clone, n, mk))))] };
  }

  function generate(seed, level = 'medium', custom, allow) {
    const cfg = level === 'custom' ? customLevel(custom) : LEVELS[level];
    const r = mulberry32(seed >>> 0);
    const okE = allow ? new Set(allow.ents) : null, okM = okMarkers(allow);
    const entOk = id => !okE || okE.has(id), mkOk = mk => !okM || okM.has(mk);
    const MKS = ALL_MARKERS.filter(mkOk), dist = (eid, pop) => distance(eid, pop, MKS);
    // Pick the clone first (every neoplasm equally likely) and keep it across retries, so the
    // preference for cross-elimination boards doesn't skew which diagnoses come up. A clone that
    // can't make a board with this content gives way to another.
    const neos = ENTITIES.filter(e => e.kind === 'neoplasm' && entOk(e.id) && !(allow && lookalikes(e.id, allow).like.length));
    if (!neos.length) throw new Error('no clone fits the content settings');
    let clone = pick(r, neos).id;
    const tried = [];
    for (;;) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const spec = pick(r, SPECIMENS.filter(s => s.clones.includes(clone)));
      const normals = shuffle(r, spec.normals).filter(id => !excluded(id, clone) && entOk(id)).slice(0, cfg.pops - 1);
      const ids = [...normals, clone];
      if (ids.length < cfg.pops) continue;
      const pops = ids.map(id => ({ id, lc: allowed(BY[id], 'LC')[0] }));
      for (const p of pops) {
        if (BY[p.id].m.LC === 'clonal') p.lc = r() < 0.6 ? 'kappa' : 'lambda';
        p.res = {};
        for (const [mk, lvl] of Object.entries(BY[p.id].m)) if (lvl === 'var') p.res[mk] = r() < 0.5 ? 'pos' : 'neg';
      }
      const cp = pops.find(p => p.id === clone);
      const near = (cands, to) => cands.map(e => ({ id: e.id, raw: Math.min(...to.map(p => dist(e.id, p))) })).filter(x => x.raw >= 1)
        .map(x => ({ id: x.id, d: x.raw + r() * 1.5 })).sort((a, b) => a.d - b.d);

      // Scratchpad choices. With a diagnosis step, the clone is "Abnormal (clone)" and the decoys are
      // normal cell types; without one, the scratchpad names the neoplasm itself (with look-alikes).
      let pool = [];
      if (cfg.scratch) {
        const ok = e => entOk(e.id) && !ids.includes(e.id) && ids.every(id => !excluded(id, e.id));
        if (cfg.dx) {
          const others = near(ENTITIES.filter(e => e.kind === 'normal' && ok(e)), pops);
          const decoys = cfg.decoys === 'all' ? others.map(x => x.id) : shuffle(r, others.slice(0, cfg.decoys * 2)).slice(0, cfg.decoys).map(x => x.id);
          pool = shuffle(r, [...normals, 'abn', ...decoys]);
        } else {
          const others = near(ENTITIES.filter(ok), pops);
          const lin = shuffle(r, others.filter(x => BY[x.id].lineage === BY[clone].lineage)).slice(0, Math.ceil(cfg.decoys / 2));
          const rest = shuffle(r, others.filter(x => !lin.includes(x)).slice(0, cfg.decoys * 2));
          const decoys = cfg.decoys === 'all' ? others.map(x => x.id) : [...lin, ...rest].slice(0, cfg.decoys).map(x => x.id);
          pool = shuffle(r, [...ids, ...decoys]);
        }
      }
      // Diagnosis choices: the clone and 3 look-alikes (its lineage first), or every neoplasm.
      let dxPool = [];
      if (cfg.dx) {
        const neo = ENTITIES.filter(e => e.kind === 'neoplasm' && entOk(e.id) && e.id !== clone && !excluded(e.id, clone) && dist(e.id, cp) >= 1)
          .map(e => ({ id: e.id, d: dist(e.id, cp) + r() * 1.5 + (e.lineage === BY[clone].lineage ? 0 : 4) })).sort((a, b) => a.d - b.d);
        dxPool = cfg.dx === 'choice' ? shuffle(r, [clone, ...shuffle(r, neo.slice(0, 5)).slice(0, 3).map(x => x.id)]) : [clone, ...neo.map(x => x.id)];
      }
      const unique = plots => {
        const mk = markersOf(plots);
        if (cfg.scratch && countSolutions(pops, pool, mk).n !== 1) return false;
        if (cfg.dx && dxPool.filter(id => fits(id, cp, mk)).length !== 1) return false;
        return true;
      };

      const candidates = PLOTS.filter(p => !(p[0] === 'FSC' && p[1] === 'SSC') && plotMarkers(p).every(mkOk));
      if (!unique(candidates)) continue;

      // Pin one plot of the clone's hallmarks: preferring one that tells it from a look-alike on offer.
      const rivals = cfg.dx ? dxPool : pool;
      const hall = candidates.filter(p => plotMarkers(p).some(mk => BY[clone].key.includes(mk)));
      const telling = hall.filter(p => rivals.some(id => id !== clone && id !== 'abn' && !fits(id, cp, plotMarkers(p))));
      const pinned = (telling.length ? pick(r, telling) : hall.length ? pick(r, hall) : null);
      const informs = q => rivals.some(id => id !== clone && id !== 'abn' && !fits(id, cp, plotMarkers(q)));
      // Sudoku-style clue removal.
      let shown = candidates.slice();
      for (const p of shuffle(r, candidates)) {
        if (p === pinned) continue;
        const trial = shown.filter(q => q !== p);
        // the diagnosis keeps at least cloneMin marker plots that bear on the clone
        if (cfg.dx && cfg.cloneMin && trial.filter(q => informs(q)).length < cfg.cloneMin) continue;
        if (unique(trial)) shown = trial;
      }
      const needsMatching = cfg.scratch && countSolutions(pops, pool, markersOf(shown)).cand.some(c => c.filter(x => x !== 'abn').length > 1);
      if (cfg.scratch && cfg.wantMatching && !needsMatching && attempt < 60) continue;

      const unused = shuffle(r, candidates.filter(p => !shown.includes(p)));
      // Extra plots: real readings of this tube that aren't needed. Half show something positive (they
      // look useful), the rest are aimed at an identity on offer that isn't here (a red herring).
      const extras = [], offered = [...pool, ...dxPool].filter(id => id !== 'abn' && !ids.includes(id));
      const showsSomething = p => plotMarkers(p).some(mk => pops.some(q => !['neg', 'none'].includes(observed(q, mk))));
      const lure = p => { const mks = plotMarkers(p); return mks.every(mk => pops.every(q => ['neg', 'none'].includes(observed(q, mk)))) && offered.some(d => mks.some(mk => !['neg', 'none'].includes(allowed(BY[d], mk)[0]))); };
      for (const p of unused) { if (extras.length >= Math.ceil(cfg.extra / 2)) break; if (showsSomething(p)) extras.push(p); }
      for (const p of unused) { if (extras.length >= cfg.extra) break; if (!extras.includes(p) && lure(p)) extras.push(p); }
      for (const p of unused) { if (extras.length >= cfg.extra) break; if (!extras.includes(p)) extras.push(p); }

      // Gated boards: every pair of populations must be separable by quad gates on the plots shown.
      // If two can't be told apart, add the plot that splits them.
      if (cfg.gating) {
        let all = [...shown, ...extras], guard = 0;
        while (collisions(pops, all) && guard++ < 6) {
          const fix = unused.filter(p => !all.includes(p)).map(p => ({ p, c: collisions(pops, [...all, p]) })).sort((a, b) => a.c - b.c)[0];
          if (!fix || fix.c >= collisions(pops, all)) break;
          extras.push(fix.p); all = [...all, fix.p];
        }
        if (collisions(pops, all)) continue;
      }

      // Population sizes: the clone is big, normals share the rest.
      const w = pops.map(p => BY[p.id].kind === 'neoplasm' ? 2 + r() * 4 : 0.6 + r() * 1.6);
      const tot = w.reduce((a, b) => a + b, 0);
      pops.forEach((p, i) => { p.frac = w[i] / tot; });

      const order = [['FSC', 'SSC'], ...PLOTS.filter(p => shown.includes(p) || extras.includes(p))];
      const letters = shuffle(r, pops);
      letters.forEach((p, i) => { p.label = 'ABCDE'[i]; p.slot = i; });
      const answer = id => (cfg.dx && id === clone) ? 'abn' : id; // what the scratchpad calls each population

      const puzzle = {
        seed: seed >>> 0, level, cfg, target: cp.label, clone, spec: spec.id, specName: spec.name,
        pops: letters, pool, dxPool, choose: !!cfg.choose,
        plots: order.map(p => ({ x: p[0], y: p[1], key: plotKey(p), role: extras.includes(p) ? 'extra' : 'clue' })),
        needsMatching, solution: Object.fromEntries(letters.map(p => [p.label, answer(p.id)])),
      };
      if (cfg.pct) {
        const ans = Math.round(cp.frac * 100);
        const opts = new Set([ans]);
        const steps = shuffle(r, [-30, -20, -12, 12, 20, 30]);
        for (const s of steps) { const v = ans + s; if (v >= 2 && v <= 95 && [...opts].every(o => Math.abs(o - v) >= 9)) opts.add(v); if (opts.size >= 4) break; }
        puzzle.pct = { label: cp.label, answer: ans, options: [...opts].sort((a, b) => a - b) };
      }
      puzzle.events = simulate(puzzle, mulberry32((seed ^ 0x9e3779b9) >>> 0));
      return puzzle;
    }
    tried.push(clone);
    const left = neos.filter(e => !tried.includes(e.id));
    if (!left.length) break;
    clone = pick(r, left).id;
    }
    throw new Error('could not build a board for seed ' + seed);
  }

  /* What quad gates can see of a population: one string per combination of its readings on the
     plots (a naturally split marker or polyclonal light chains give both). Dim counts as positive,
     as a single gate line does. */
  function gateSigs(pop, plots) {
    let out = [''];
    const add = opts => { out = out.flatMap(s => opts.map(o => s + o + '.')); };
    add([BY[pop.id].ssc]);
    for (const p of plots) for (const mk of plotMarkers(p)) {
      if (mk === 'SSC' || mk === 'FSC') continue;
      if (mk === 'LC') { add(pop.lc === 'poly' ? ['kappa', 'lambda'] : [pop.lc]); continue; }
      const c = observed(pop, mk);
      add(c === 'split' ? ['n', 'p'] : c === 'neg' ? ['n'] : ['p']);
    }
    return out;
  }
  function collisions(pops, plots) {
    const sigs = pops.map(p => new Set(gateSigs(p, plots)));
    let n = 0;
    for (let i = 0; i < pops.length; i++) for (let j = i + 1; j < pops.length; j++) if ([...sigs[i]].some(x => sigs[j].has(x))) n++;
    return n;
  }

  // ---------- events ----------
  const LOG = { neg: [0.55, 0.22], dim: [1.75, 0.2], pos: [2.6, 0.22], bright: [3.3, 0.18] };
  const FSCV = { low: [290, 40], mid: [500, 50], high: [700, 50] };
  const SSCV = { low: [110, 30], mid: [330, 50], high: [640, 70] };
  const TOTAL = 900;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* Harder levels draw looser clusters (spread scales every SD). Kept so that negative and positive
     still sit on their own side of the cut: the uniqueness proof assumes each cluster reads clearly. */
  function simulate(puzzle, r) {
    const k = (puzzle.cfg && puzzle.cfg.spread) || 1;
    const lv = (c, r) => { const [m, s] = LOG[c]; return clamp(m + s * k * gauss(r), 0.03, 3.97); };
    const mks = ['FSC', 'SSC', 'CD45', ...new Set(puzzle.plots.flatMap(p => plotMarkers([p.x, p.y])))];
    return puzzle.pops.map(pop => {
      const e = BY[pop.id];
      const n = Math.max(45, Math.round(pop.frac * TOTAL));
      const ev = [];
      for (let i = 0; i < n; i++) {
        const u = r(), o = {};
        for (const mk of mks) {
          if (mk === 'FSC') { const [m, s] = FSCV[e.fsc]; o.FSC = clamp(m + s * k * gauss(r), 5, 1018); continue; }
          if (mk === 'SSC') { const [m, s] = SSCV[e.ssc]; o.SSC = clamp(m + s * k * gauss(r), 5, 1018); continue; }
          if (mk === 'LC') {
            const k = pop.lc === 'kappa' || (pop.lc === 'poly' && r() < 0.6);
            const l = pop.lc === 'lambda' || (pop.lc === 'poly' && !k);
            o.kappa = lv(k ? 'pos' : 'neg', r); o.lambda = lv(l ? 'pos' : 'neg', r); continue;
          }
          let level = e.m[mk] || '-';
          if (level === 'var') level = pop.res[mk] === 'pos' ? '+' : '-';
          if (level === 'split') {
            const on = e.cont ? (e.cont.late.includes(mk) ? u > 0.5 : u < 0.45) : r() < ((e.frac && e.frac[mk]) || 0.5);
            level = on ? '+' : '-';
          }
          o[mk] = lv(level === '-' ? 'neg' : level === '+' ? 'pos' : level, r);
        }
        ev.push(o);
      }
      return ev;
    });
  }

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

  const API = { generate, lookalikes, collisions, customLevel, countSolutions, fits, allowed, observed, markersOf, plotMarkers, why, describe, LEVELS, mulberry32 };
  if (typeof module !== 'undefined') module.exports = API; else window.FC = Object.assign(window.FC || {}, API);
})();
