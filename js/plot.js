/* FlowCyto dot plots — SVG strings.
   Populations are told apart three ways at once: a shape per population (circle, triangle, square,
   diamond, cross), a letter badge on every cluster, and a color from the CVD-safe set. Color is
   never the only cue. Marker axes are log decades with a dashed line at the negative/positive cut. */
(function () {
  'use strict';
  const SHAPES = ['circle', 'triangle', 'square', 'diamond', 'cross'];
  const COLORS = ['var(--blue)', 'var(--orange)', 'var(--pink)', 'var(--teal)', 'var(--gold)'];
  const CUT = 1.2;

  function glyph(shape, x, y, s) {
    switch (shape) {
      case 'circle': return `M${x - s},${y}a${s},${s} 0 1,0 ${2 * s},0a${s},${s} 0 1,0 ${-2 * s},0`;
      case 'triangle': return `M${x},${y - s * 1.2}L${x + s * 1.1},${y + s * .8}L${x - s * 1.1},${y + s * .8}Z`;
      case 'square': return `M${x - s * .9},${y - s * .9}h${s * 1.8}v${s * 1.8}h${-s * 1.8}Z`;
      case 'diamond': return `M${x},${y - s * 1.25}L${x + s * 1.05},${y}L${x},${y + s * 1.25}L${x - s * 1.05},${y}Z`;
      case 'cross': { const t = s * .42; return `M${x - t},${y - s * 1.1}h${2 * t}v${s * 1.1 - t}h${s * 1.1 - t}v${2 * t}h${-(s * 1.1 - t)}v${s * 1.1 - t}h${-2 * t}v${-(s * 1.1 - t)}h${-(s * 1.1 - t)}v${-2 * t}h${s * 1.1 - t}Z`; }
    }
  }
  /* A standalone icon for legends and buttons. */
  function shapeIcon(slot, size = 16) {
    const s = size / 2;
    return `<svg class="shape-ic" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><path d="${glyph(SHAPES[slot], s, s, s * .72)}" fill="${COLORS[slot]}" stroke="var(--ink)" stroke-width="1"/></svg>`;
  }

  const axisVal = (ev, mk) => mk === 'LCk' ? ev.kappa : mk === 'LCl' ? ev.lambda : ev[mk];
  const isScatter = mk => mk === 'FSC' || mk === 'SSC';
  const label = mk => mk === 'LCk' ? 'kappa' : mk === 'LCl' ? 'lambda' : mk;

  /* opts: { size, focus (slot to emphasize), labels, paint }
     labels: 'full' (shape + color + a letter badge on every cluster) · 'shapes' (no badges) ·
     'none' (every event a plain gray dot, except events the player painted: paint[k][i] is the
     paint slot for event i of population k, or -1; a paint draws with that slot's shape and color). */
  function renderPlot(puzzle, plot, opts = {}) {
    const S = opts.size || 240, L = 36, B = 30, T = 8, R = 8, W = S - L - R, H = S - T - B;
    const xm = plot.x === 'LC' ? 'LCk' : plot.x, ym = plot.x === 'LC' ? 'LCl' : plot.y;
    const sx = v => L + (isScatter(xm) ? v / 1024 : v / 4) * W;
    const sy = v => T + H - (isScatter(ym) ? v / 1024 : v / 4) * H;
    const out = [`<svg class="dotplot" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="${label(xm)} versus ${label(ym)}">`];
    out.push(`<rect x="${L}" y="${T}" width="${W}" height="${H}" class="dp-frame"/>`);
    // decade ticks on log axes
    for (let d = 1; d < 4; d++) {
      if (!isScatter(xm)) out.push(`<line x1="${sx(d)}" y1="${T + H}" x2="${sx(d)}" y2="${T + H + 4}" class="dp-tick"/>`);
      if (!isScatter(ym)) out.push(`<line x1="${L - 4}" y1="${sy(d)}" x2="${L}" y2="${sy(d)}" class="dp-tick"/>`);
    }
    if (!isScatter(xm)) out.push(`<line x1="${sx(CUT)}" y1="${T}" x2="${sx(CUT)}" y2="${T + H}" class="dp-cut"/>`);
    if (!isScatter(ym)) out.push(`<line x1="${L}" y1="${sy(CUT)}" x2="${L + W}" y2="${sy(CUT)}" class="dp-cut"/>`);
    // events, drawn in interleaved order so no population sits wholly on top
    const pops = puzzle.pops, ev = puzzle.events;
    const max = Math.max(...ev.map(e => e.length));
    const labels = opts.labels || 'full';
    if (labels === 'none') {
      const gray = [], painted = SHAPES.map(() => []);
      for (let i = 0; i < max; i++) pops.forEach((p, k) => {
        const e = ev[k][i]; if (!e) return;
        const slot = opts.paint && opts.paint[k] ? opts.paint[k][i] : -1, x = sx(axisVal(e, xm)), y = sy(axisVal(e, ym));
        if (slot >= 0) painted[slot].push(glyph(SHAPES[slot], x, y, 2.3)); else gray.push(glyph('circle', x, y, 1.7));
      });
      out.push(`<path d="${gray.join('')}" class="dp-ev dp-gray"/>`);
      painted.forEach((d, slot) => { if (d.length) out.push(`<path d="${d.join('')}" fill="${COLORS[slot]}" class="dp-ev"/>`); });
    } else {
      const paths = pops.map(() => []);
      for (let i = 0; i < max; i++) pops.forEach((p, k) => { const e = ev[k][i]; if (e) paths[k].push(glyph(SHAPES[p.slot], sx(axisVal(e, xm)), sy(axisVal(e, ym)), 2.3)); });
      pops.forEach((p, k) => {
        const dim = opts.focus != null && opts.focus !== p.slot;
        out.push(`<path d="${paths[k].join('')}" fill="${COLORS[p.slot]}" class="dp-ev${dim ? ' dp-dim' : ''}"/>`);
      });
    }
    // axes
    out.push(`<text x="${L + W / 2}" y="${S - 6}" class="dp-ax" text-anchor="middle">${label(xm)}</text>`);
    out.push(`<text x="12" y="${T + H / 2}" class="dp-ax" text-anchor="middle" transform="rotate(-90 12 ${T + H / 2})">${label(ym)}</text>`);
    if (!isScatter(xm)) out.push(`<text x="${(L + sx(CUT)) / 2}" y="${T + H + 12}" class="dp-q" text-anchor="middle">−</text><text x="${(sx(CUT) + L + W) / 2}" y="${T + H + 12}" class="dp-q" text-anchor="middle">+</text>`);
    if (!isScatter(ym)) out.push(`<text x="${L - 9}" y="${(T + sy(CUT)) / 2 + 4}" class="dp-q" text-anchor="middle">+</text><text x="${L - 9}" y="${(sy(CUT) + T + H) / 2 + 4}" class="dp-q" text-anchor="middle">−</text>`);
    if (labels === 'full') out.push(badges(pops, ev, xm, ym, sx, sy, L, T, W, H, opts.focus));
    out.push('</svg>');
    return out.join('');
  }

  /* One letter badge per cluster: a population split across quadrants gets a badge in each. */
  function badges(pops, ev, xm, ym, sx, sy, L, T, W, H, focus) {
    const marks = [];
    pops.forEach((p, k) => {
      const groups = {};
      for (const e of ev[k]) {
        const gx = isScatter(xm) ? 0 : axisVal(e, xm) > CUT ? 1 : 0, gy = isScatter(ym) ? 0 : axisVal(e, ym) > CUT ? 1 : 0;
        (groups[gx + ':' + gy] = groups[gx + ':' + gy] || []).push(e);
      }
      for (const g of Object.values(groups)) {
        if (g.length < ev[k].length * 0.2) continue;
        const med = a => a.slice().sort((u, v) => u - v)[a.length >> 1];
        marks.push({ p, x: sx(med(g.map(e => axisVal(e, xm)))), y: sy(med(g.map(e => axisVal(e, ym)))) });
      }
    });
    // nudge apart badges that would overlap, then keep them inside the frame
    for (let it = 0; it < 40; it++) {
      for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) {
        const a = marks[i], b = marks[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01;
        if (d < 21) { const push = (21 - d) / 2, ux = dx / d || 1, uy = dy / d; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
      }
      for (const m of marks) { m.x = Math.max(L + 10, Math.min(L + W - 10, m.x)); m.y = Math.max(T + 10, Math.min(T + H - 10, m.y)); }
    }
    return marks.map(m => `<g class="dp-badge${focus != null && focus !== m.p.slot ? ' dp-dim' : ''}" transform="translate(${m.x.toFixed(1)},${m.y.toFixed(1)})"><circle r="9.5" stroke="${COLORS[m.p.slot]}"/><text y="4" text-anchor="middle">${m.p.label}</text></g>`).join('');
  }

  /* Which quadrant an event sits in on a plot: 'x+y+' etc. (scatter axes count as '+' throughout). */
  function quadrant(ev, plot) {
    const xm = plot.x === 'LC' ? 'LCk' : plot.x, ym = plot.x === 'LC' ? 'LCl' : plot.y;
    const sx = isScatter(xm) ? '' : axisVal(ev, xm) > CUT ? 'x+' : 'x-', sy = isScatter(ym) ? '' : axisVal(ev, ym) > CUT ? 'y+' : 'y-';
    return sx + sy;
  }
  window.FC = Object.assign(window.FC || {}, { renderPlot, shapeIcon, quadrant, SHAPES, COLORS, CUT });
})();
