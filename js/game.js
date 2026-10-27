/* FlowCyto game screen: both modes, board state, checking, the recap.
   The URL hash names the board (#pops/medium/12345) so any board can be replayed. */
(function () {
  'use strict';
  const FC = window.FC;
  const { BY, generate, renderPlot, shapeIcon, allowed, observed, markersOf, why, describe, LEVELS } = FC;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const ICON = {
    no: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="var(--ink-2)" stroke-width="2.2" stroke-linecap="round"/></svg>',
    yes: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="var(--blue)" stroke="var(--ink)" stroke-width="1"/></svg>',
    right: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="var(--teal)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wrong: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="var(--pink)" stroke-width="2.4" stroke-linecap="round"/></svg>',
  };
  const MARK_WORD = { no: 'ruled out', yes: 'chosen' };

  let S;
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('flowcyto.stats') || '{}'); } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem('flowcyto.stats', JSON.stringify(v)); } catch (e) { /* private window: stats just don't persist */ } },
  };
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('flowcyto.prefs') || '{}'); } catch (e) { return {}; } })();

  function start(mode, level, seed) {
    seed = seed || (Math.random() * 1e9) >>> 0;
    const P = generate(seed, level, mode);
    S = { mode, level, seed, P, marks: {}, checked: {}, wrongChecks: 0, peeks: new Set(), pad: {}, padRow: null, tab: 'answer', sheet: (S && S.sheet) || 'open', focus: null, phase: 'play', pctPick: null, msg: null };
    history.replaceState(null, '', `#${mode}/${level}/${seed}`);
    try { localStorage.setItem('flowcyto.prefs', JSON.stringify({ mode, level })); } catch (e) {}
    $('#modeSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.mode === mode));
    $('#levelSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.level === level));
    $('#specName').textContent = P.specName;
    $('#boardId').textContent = `${LEVELS[level].label} · board ${seed}`;
    drawPlots(); drawPanel();
  }

  const shownPlots = () => S.P.plots.map(p => [p.x, p.y]);
  const target = () => S.P.pops.find(p => p.label === S.P.target);
  const popTag = p => `${shapeIcon(p.slot)} <b>${p.label}</b>`;
  const freePeeks = () => S.level === 'easy';

  function drawPlots() {
    const focus = S.mode === 'clone' ? target().slot : S.focus;
    $('#plots').innerHTML = S.P.plots.map(pl => `<figure>${renderPlot(S.P, pl, { size: 250, focus })}<figcaption>${pl.x === 'LC' ? 'kappa / lambda (surface light chains)' : pl.x + ' / ' + pl.y}</figcaption></figure>`).join('');
  }

  // ---------- scratch pad: markers sorted by cell type ----------
  // Easy: a filled reference. Medium/Hard: the player fills it in; Reveal fills one row from the
  // answer key and counts as a peek (the only way to peek).
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
      if (!freePeeks()) h += `<td class="rv">${filled ? '<span class="tally" title="peeked">seen</span>' : `<button class="reveal" data-reveal="${id}" aria-label="Reveal ${esc(BY[id].name)} (counts as a peek)" title="Reveal (counts as a peek)"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.1" fill="currentColor"/></svg></button>`}</td>`;
      h += '</tr>';
    }
    return h + '</tbody></table></div><p class="help">± partly positive, or varies by patient · κ/λ: 1 = one light chain (clonal), 2 = both, − = none · SSC lo / mid / hi.</p>';
  }
  function jumpToPad(id) {
    S.tab = 'pad'; S.padRow = id; S.sheet = 'open'; drawPanel();
    const r = document.querySelector(`[data-padrow="${id}"]`); if (r) r.scrollIntoView({ block: 'nearest' });
  }

  // ---------- panel ----------
  function drawPanel() {
    const P = S.P, el = $('#panel');
    const tally = `<span class="tally">${S.wrongChecks} wrong check${S.wrongChecks === 1 ? '' : 's'} · ${freePeeks() ? 'pad filled on Easy' : S.peeks.size + ' peek' + (S.peeks.size === 1 ? '' : 's')}</span>`;
    let h = '';
    if (S.mode === 'pops') {
      h += `<h2>Name every population</h2><p class="sub">Give each letter an identity. Decoys are mixed in; no identity is used twice. Click a cell: ruled out, then chosen, then blank. Tap a letter to highlight it in every plot; tap a column name to find it in the scratch pad.</p>`;
      h += `<table class="lgrid"><thead><tr><th></th>${P.pool.map(id => `<th><button class="colh" data-jump="${id}" title="${esc(BY[id].long)}">${esc(BY[id].name)}</button></th>`).join('')}</tr></thead><tbody>`;
      for (const p of P.pops) {
        const c = S.checked[p.label];
        h += `<tr data-row="${p.label}" class="${S.focus === p.slot ? 'focus' : ''}"><th data-focus="${p.label}">${popTag(p)}${c ? `<span class="rowmark ${c}">${ICON[c]}${c}</span>` : ''}</th>`;
        for (const id of P.pool) {
          const m = S.marks[p.label + '|' + id];
          h += `<td class="${m || ''}"><button data-cell="${p.label}|${id}" ${S.phase !== 'play' ? 'disabled' : ''} aria-label="${p.label}, ${esc(BY[id].name)}: ${m ? MARK_WORD[m] : 'blank'}">${m ? ICON[m] : ''}</button></td>`;
        }
        h += '</tr>';
      }
      h += '</tbody></table>';
      const ready = P.pops.every(p => P.pool.some(id => S.marks[p.label + '|' + id] === 'yes'));
      if (S.phase === 'play') h += `<div class="actions"><button class="btn primary" data-act="check" ${ready ? '' : 'disabled'}>Check</button>${tally}</div>${ready ? '' : '<p class="help">Choose one identity in every row to check.</p>'}`;
    } else {
      const t = target();
      h += `<h2>Diagnose the clone</h2><p class="sub">Population ${popTag(t)} is abnormal; the rest of the tube is faded background. Strike out what the plots rule out, then choose. Click a name: ruled out, then chosen, then blank.</p>`;
      for (const id of P.pool) {
        const m = S.marks['dx|' + id], c = S.checked[id];
        h += `<button class="dx ${m || ''}" data-dx="${id}" ${S.phase !== 'play' ? 'disabled' : ''}>${m ? ICON[m] : '<span class="ic"></span>'}<span class="nm">${esc(BY[id].name)}</span>${c ? `<span class="rowmark ${c}">${ICON[c]}${c}</span>` : ''}<span class="peek" data-jump="${id}" role="button" tabindex="0">in pad</span></button>`;
      }
      const ready = P.pool.some(id => S.marks['dx|' + id] === 'yes');
      if (S.phase === 'play') h += `<div class="actions"><button class="btn primary" data-act="check" ${ready ? '' : 'disabled'}>Diagnose</button>${tally}</div>`;
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
    // Phones: the panel is a bottom sheet; keep the plots scrollable above it.
    document.documentElement.style.setProperty('--sheet-h', el.offsetHeight + 'px');
  }

  // ---------- checking ----------
  function check() {
    const P = S.P, plots = S.P.plots;
    if (S.mode === 'pops') {
      const bad = [];
      for (const p of P.pops) {
        const id = P.pool.find(i => S.marks[p.label + '|' + i] === 'yes');
        if (id === P.solution[p.label]) { S.checked[p.label] = 'right'; continue; }
        S.checked[p.label] = 'wrong';
        const r = why(id, p, plots);
        bad.push(`${popTag(p)} is not ${esc(BY[id].name)}: ${r.length ? esc(r[0]) : 'it fits these plots, but another population needs that identity'}.`);
      }
      if (bad.length) { S.wrongChecks++; S.msg = { kind: 'bad', html: `<b>${bad.length} not right yet.</b><ul>${bad.map(b => `<li>${b}</li>`).join('')}</ul>` }; }
      else finishBoard();
    } else {
      const t = target(), id = P.pool.find(i => S.marks['dx|' + i] === 'yes');
      if (id === t.id) { S.checked[id] = 'right'; finishBoard(); }
      else {
        S.wrongChecks++; S.checked[id] = 'wrong'; S.marks['dx|' + id] = 'no';
        const r = why(id, t, plots);
        S.msg = { kind: 'bad', html: `<b>Not ${esc(BY[id].name)}.</b> ${esc(r[0] || 'It does not fit these plots')}.` };
      }
    }
    drawPanel();
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
    record();
    drawPanel();
  }
  function record() {
    const st = store.get(), k = S.mode + '/' + S.level, v = st[k] || { solved: 0, clean: 0 };
    v.solved++; if (!S.wrongChecks && !S.peeks.size) v.clean++;
    st[k] = v; store.set(st); S.stats = v;
  }

  // ---------- recap ----------
  function recap() {
    const P = S.P, plots = P.plots;
    let h = `<div class="recap"><p class="tally">${S.wrongChecks} wrong check${S.wrongChecks === 1 ? '' : 's'}, ${S.peeks.size} peek${S.peeks.size === 1 ? '' : 's'}. ${S.stats ? `${S.stats.solved} solved at this level, ${S.stats.clean} with no mistakes or peeks.` : ''}</p>`;
    const pops = S.mode === 'clone' ? [target()] : P.pops;
    h += `<h3>${S.mode === 'clone' ? 'The clone' : 'The populations'}</h3>`;
    for (const p of pops) {
      const e = BY[p.id];
      const lc = p.lc === 'kappa' || p.lc === 'lambda' ? ` (${p.lc} restricted)` : '';
      h += `<div class="item">${popTag(p)} ${esc(e.long)}${lc} · ${Math.round(p.frac * 100)}% of events<div class="why">${esc(e.teach)}</div></div>`;
    }
    const decoys = S.mode === 'clone' ? P.pool.filter(id => id !== target().id) : P.pool.filter(id => !P.pops.some(p => p.id === id));
    if (decoys.length) {
      h += '<h3>Why the decoys were out</h3>';
      for (const d of decoys) {
        // explain against the population it most resembles
        const cands = S.mode === 'clone' ? [target()] : P.pops;
        let best = null;
        for (const p of cands) { const r = why(d, p, plots); if (!best || r.length < best.r.length) best = { p, r }; }
        h += `<div class="item">${esc(BY[d].name)}<div class="why">Closest to ${best.p.label}, but ${esc(best.r[0] || 'its letter was taken by a better fit')}.</div></div>`;
      }
    }
    const herring = plots.find(p => p.role === 'herring');
    if (herring) h += `<h3>Red herring</h3><div class="item">${esc(herring.x)} / ${esc(herring.y)}<div class="why">Every population is negative on it. It was there for a decoy, not for the answer.</div></div>`;
    h += `<div class="actions"><button class="btn primary" data-act="new">Next board</button></div></div>`;
    return h;
  }

  // ---------- input ----------
  const cycle = m => m === undefined ? 'no' : m === 'no' ? 'yes' : undefined;
  $('#panel').addEventListener('click', ev => {
    const tb = ev.target.closest('[data-tab]');
    if (tb) { S.tab = tb.dataset.tab; S.sheet = 'open'; return drawPanel(); }
    if (ev.target.closest('[data-sheet]')) { S.sheet = S.sheet === 'min' ? 'open' : 'min'; return drawPanel(); }
    const jp = ev.target.closest('[data-jump]');
    if (jp) { ev.stopPropagation(); return jumpToPad(jp.dataset.jump); }
    const pc = ev.target.closest('[data-pad]');
    if (pc) {
      const [id, mk] = pc.dataset.pad.split('|'), key = id + '|' + mk, c = padCycle(mk), i = c.indexOf(S.pad[key]);
      if (i === c.length - 1) delete S.pad[key]; else S.pad[key] = c[i + 1];
      return drawPanel();
    }
    const rv = ev.target.closest('[data-reveal]');
    if (rv) { S.peeks.add(rv.dataset.reveal); S.padRow = rv.dataset.reveal; return drawPanel(); }
    const fc = ev.target.closest('[data-focus]');
    if (fc) { const slot = S.P.pops.find(p => p.label === fc.dataset.focus).slot; S.focus = S.focus === slot ? null : slot; drawPlots(); return drawPanel(); }
    const cell = ev.target.closest('[data-cell]');
    if (cell) {
      const [row, id] = cell.dataset.cell.split('|'), key = row + '|' + id, next = cycle(S.marks[key]);
      if (next === 'yes') for (const k of Object.keys(S.marks)) {
        const [r2, i2] = k.split('|');
        if (S.marks[k] === 'yes' && (r2 === row || i2 === id)) delete S.marks[k]; // one per row, one per column
      }
      if (next) S.marks[key] = next; else delete S.marks[key];
      delete S.checked[row]; S.msg = null;
      return drawPanel();
    }
    const dx = ev.target.closest('[data-dx]');
    if (dx) {
      const key = 'dx|' + dx.dataset.dx, next = cycle(S.marks[key]);
      if (next === 'yes') for (const k of Object.keys(S.marks)) if (S.marks[k] === 'yes') delete S.marks[k];
      if (next) S.marks[key] = next; else delete S.marks[key];
      delete S.checked[dx.dataset.dx]; S.msg = null;
      return drawPanel();
    }
    const act = ev.target.closest('[data-act]');
    if (act && act.dataset.act === 'check') return check();
    if (act && act.dataset.act === 'new') return start(S.mode, S.level);
    const pct = ev.target.closest('[data-pct]');
    if (pct) return answerPct(+pct.dataset.pct);
  });
  // Pointing at a row highlights that population in every plot.
  $('#panel').addEventListener('mouseover', ev => {
    if (S.mode !== 'pops' || !matchMedia('(hover: hover)').matches) return;
    const tr = ev.target.closest('tr[data-row]');
    const slot = tr ? S.P.pops.find(p => p.label === tr.dataset.row).slot : null;
    if (slot !== S.focus) { S.focus = slot; drawPlots(); $('#panel').querySelectorAll('tr[data-row]').forEach(r => r.classList.toggle('focus', tr === r)); }
  });
  $('#panel').addEventListener('mouseleave', () => { if (matchMedia('(hover: hover)').matches && S.focus != null) { S.focus = null; drawPlots(); } });
  // Tap a plot to show it full width (mostly for phones).
  $('#plots').addEventListener('click', ev => { const f = ev.target.closest('figure'); if (f) f.classList.toggle('big'); });
  window.addEventListener('resize', () => document.documentElement.style.setProperty('--sheet-h', $('#panel').offsetHeight + 'px'));
  $('#modeSeg').addEventListener('click', ev => { const b = ev.target.closest('[data-mode]'); if (b) start(b.dataset.mode, S.level); });
  $('#levelSeg').addEventListener('click', ev => { const b = ev.target.closest('[data-level]'); if (b) start(S.mode, b.dataset.level); });
  $('#newBtn').addEventListener('click', () => start(S.mode, S.level));

  const [hm, hl, hs] = location.hash.slice(1).split('/');
  start(['pops', 'clone'].includes(hm) ? hm : prefs.mode || 'pops', LEVELS[hl] ? hl : prefs.level || 'easy', +hs || 0);
})();
