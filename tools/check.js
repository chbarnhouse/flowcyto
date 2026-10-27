#!/usr/bin/env node
/* Generate many boards per level and prove each step has exactly one answer: the scratchpad (every
   population named, no identity twice) and the diagnosis (one neoplasm on offer fits the clone).
   node tools/check.js [count]   (default 200 per level) */
const G = require('../js/gen.js');
const { BY } = require('../js/kb.js');
const N = +process.argv[2] || 200;
const CUSTOMS = {
  'custom-gated': { pops: 5, gating: true, decoys: true, extra: true, ref: 'blank', spread: 'touching', pct: true, scratch: true, dx: 'type' },
  'custom-nodx': { pops: 4, decoys: true, extra: false, ref: 'filled', scratch: true, dx: 'off' },
  'custom-dxonly': { pops: 4, gating: true, scratch: false, dx: 'all' },
};
let bad = 0;
for (const level of [...Object.keys(G.LEVELS), ...Object.keys(CUSTOMS)]) {
  const custom = CUSTOMS[level], lv = custom ? 'custom' : level;
  const stats = { plots: 0, matching: 0, clones: {}, ms: 0 };
  for (let s = 1; s <= N; s++) {
    const t = Date.now();
    const p = G.generate(s * 7919, lv, custom);
    stats.ms += Date.now() - t;
    const L = p.cfg, plots = p.plots.map(q => [q.x, q.y]), mk = G.markersOf(plots);
    const clone = p.pops.find(x => x.label === p.target);
    if (L.scratch) {
      const n = G.countSolutions(p.pops, p.pool, mk, 3).n;
      if (n !== 1) { bad++; console.log('✗ scratchpad', level, p.seed, 'solutions:', n); }
      for (const pop of p.pops) if (!G.fits(p.solution[pop.label], pop, mk)) { bad++; console.log('✗ answer does not fit', level, p.seed, pop.label); }
    }
    if (L.dx) {
      const fit = p.dxPool.filter(id => G.fits(id, clone, mk));
      if (fit.length !== 1 || fit[0] !== clone.id) { bad++; console.log('✗ diagnosis', level, p.seed, fit); }
      if (L.dx === 'choice' && p.dxPool.length !== 4) { bad++; console.log('✗ not 4 choices', level, p.seed); }
    }
    if (L.gating && G.collisions(p.pops, plots)) { bad++; console.log('✗ not gate-separable', level, p.seed); }
    if (p.pct && !p.pct.options.includes(p.pct.answer)) { bad++; console.log('✗ pct', p.seed); }
    stats.plots += p.plots.length; stats.matching += p.needsMatching;
    stats.clones[p.clone] = (stats.clones[p.clone] || 0) + 1;
  }
  console.log(`${level}: ${N} boards · avg ${(stats.plots / N).toFixed(1)} plots · ${Math.round(100 * stats.matching / N)}% need cross-elimination · ${(stats.ms / N).toFixed(1)} ms each`);
}
console.log(bad ? `✗ ${bad} problems` : '✓ every board has exactly one answer, at every step');
process.exit(bad ? 1 : 0);
