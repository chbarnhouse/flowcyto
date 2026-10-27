#!/usr/bin/env node
/* Generate many boards per level and prove each has exactly one answer.
   node tools/check.js [count]   (default 200 per level) */
const G = require('../js/gen.js');
const { BY } = require('../js/kb.js');
const N = +process.argv[2] || 200;
let bad = 0;
const CUSTOM = { pops: 5, gating: true, choose: false, decoys: true, extra: true, ref: 'blank', spread: 'touching', pct: true };
for (const mode of ['pops', 'clone']) for (const level of [...Object.keys(G.LEVELS), 'custom']) {
  const stats = { plots: 0, matching: 0, clones: {}, ms: 0 };
  for (let s = 1; s <= N; s++) {
    const t = Date.now();
    const p = G.generate(s * 7919, level, mode, CUSTOM);
    const L = level === 'custom' ? G.customLevel(CUSTOM) : G.LEVELS[level];
    stats.ms += Date.now() - t;
    const plots = p.plots.map(q => [q.x, q.y]);
    const target = p.pops.find(x => x.label === p.target);
    const n = mode === 'clone' ? p.pool.filter(id => G.fits(id, target, G.markersOf(plots))).length : G.countSolutions(p.pops, p.pool, G.markersOf(plots), 3).n;
    if (n !== 1) { bad++; console.log('✗', level, p.seed, 'solutions:', n); }
    for (const pop of mode === 'clone' ? [target] : p.pops) if (!G.fits(p.solution[pop.label], pop, G.markersOf(plots))) { bad++; console.log('✗ answer does not fit', level, p.seed, pop.label); }
    if (mode === 'clone' && L.cloneMin) {
      const informs = p.plots.slice(1).filter(q => p.pool.some(id => id !== target.id && !G.fits(id, target, G.plotMarkers([q.x, q.y])))).length;
      if (informs < L.cloneMin) { bad++; console.log('✗ too few marker plots', level, p.seed, informs); }
    }
    if (L.gating && G.collisions(p.pops, plots)) { bad++; console.log('✗ not gate-separable', mode, level, p.seed); }
    if (p.pct && !p.pct.options.includes(p.pct.answer)) { bad++; console.log('✗ pct', p.seed); }
    stats.plots += p.plots.length; stats.matching += p.needsMatching;
    for (const pop of p.pops) if (BY[pop.id].kind === 'neoplasm') stats.clones[pop.id] = (stats.clones[pop.id] || 0) + 1;
  }
  console.log(`${mode} ${level}: ${N} boards · avg ${(stats.plots / N).toFixed(1)} plots · ${Math.round(100 * stats.matching / N)}% need cross-elimination · ${(stats.ms / N).toFixed(1)} ms each`);
  console.log('   clones:', Object.entries(stats.clones).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
}
console.log(bad ? `✗ ${bad} problems` : '✓ every board has exactly one answer');
process.exit(bad ? 1 : 0);
