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
    S = { mode, level, seed, P, marks: {}, checked: {}, wrongChecks: 0, peeks: new Set(), peekOpen: null, focus: null, phase: 'play', pctPick: null, msg: null };
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

  // ---------- an identity's profile on the plots shown ----------
  function profile(id) {
    const e = BY[id], chips = [];
    for (const mk of markersOf(shownPlots())) {
      const a = allowed(e, mk);
      let t;
      if (mk === 'LC') t = e.m.LC === 'clonal' ? 'one light chain only' : e.m.LC === 'poly' ? 'kappa and lambda' : 'no light chain';
      else if (mk === 'SSC') t = 'SSC ' + a[0];
      else if (a.length > 1) t = mk + ' ±';
      else t = describe(mk, a[0]);
      chips.push(`<span class="chip">${esc(t)}</span>`);
    }
    return `<div class="prof"><b>${esc(e.long)}${freePeeks() ? '' : ' · peek'}</b><div class="chips">${chips.join('')}</div></div>`;
  }
  function peek(id) {
    if (S.peekOpen === id) { S.peekOpen = null; return drawPanel(); }
    S.peekOpen = id;
    if (!freePeeks()) S.peeks.add(id);
    drawPanel();
  }

  // ---------- panel ----------
  function drawPanel() {
    const P = S.P, el = $('#panel');
    const tally = `<span class="tally">${S.wrongChecks} wrong check${S.wrongChecks === 1 ? '' : 's'} · ${freePeeks() ? 'profiles free on Easy' : S.peeks.size + ' peek' + (S.peeks.size === 1 ? '' : 's')}</span>`;
    let h = '';
    if (S.mode === 'pops') {
      h += `<h2>Name every population</h2><p class="sub">Give each letter an identity. Decoys are mixed in; no identity is used twice. Click a cell: ruled out, then chosen, then blank. ${freePeeks() ? 'Click a column name to see its profile.' : 'Click a column name to peek at its profile (counts as a peek).'}</p>`;
      h += `<table class="lgrid"><thead><tr><th></th>${P.pool.map(id => `<th><button class="colh" data-peek="${id}" title="${esc(BY[id].long)}">${esc(BY[id].name)}</button></th>`).join('')}</tr></thead><tbody>`;
      for (const p of P.pops) {
        const c = S.checked[p.label];
        h += `<tr data-row="${p.label}" class="${S.focus === p.slot ? 'focus' : ''}"><th>${popTag(p)}${c ? `<span class="rowmark ${c}">${ICON[c]}${c}</span>` : ''}</th>`;
        for (const id of P.pool) {
          const m = S.marks[p.label + '|' + id];
          h += `<td class="${m || ''}"><button data-cell="${p.label}|${id}" ${S.phase !== 'play' ? 'disabled' : ''} aria-label="${p.label}, ${esc(BY[id].name)}: ${m ? MARK_WORD[m] : 'blank'}">${m ? ICON[m] : ''}</button></td>`;
        }
        h += '</tr>';
      }
      h += '</tbody></table>';
      if (S.peekOpen) h += profile(S.peekOpen);
      const ready = P.pops.every(p => P.pool.some(id => S.marks[p.label + '|' + id] === 'yes'));
      if (S.phase === 'play') h += `<div class="actions"><button class="btn primary" data-act="check" ${ready ? '' : 'disabled'}>Check</button>${tally}</div>${ready ? '' : '<p class="help">Choose one identity in every row to check.</p>'}`;
    } else {
      const t = target();
      h += `<h2>Diagnose the clone</h2><p class="sub">Population ${popTag(t)} is abnormal; the rest of the tube is faded background. Strike out what the plots rule out, then choose. Click a name: ruled out, then chosen, then blank.</p>`;
      for (const id of P.pool) {
        const m = S.marks['dx|' + id], c = S.checked[id];
        h += `<button class="dx ${m || ''}" data-dx="${id}" ${S.phase !== 'play' ? 'disabled' : ''}>${m ? ICON[m] : '<span class="ic"></span>'}<span class="nm">${esc(BY[id].name)}</span>${c ? `<span class="rowmark ${c}">${ICON[c]}${c}</span>` : ''}<span class="peek" data-peek="${id}" role="button" tabindex="0">profile</span></button>`;
        if (S.peekOpen === id) h += profile(id);
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
    el.innerHTML = h;
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
    const pk = ev.target.closest('[data-peek]');
    if (pk) { ev.stopPropagation(); return peek(pk.dataset.peek); }
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
    if (S.mode !== 'pops') return;
    const tr = ev.target.closest('tr[data-row]');
    const slot = tr ? S.P.pops.find(p => p.label === tr.dataset.row).slot : null;
    if (slot !== S.focus) { S.focus = slot; drawPlots(); $('#panel').querySelectorAll('tr[data-row]').forEach(r => r.classList.toggle('focus', tr === r)); }
  });
  $('#panel').addEventListener('mouseleave', () => { if (S.focus != null) { S.focus = null; drawPlots(); } });
  $('#modeSeg').addEventListener('click', ev => { const b = ev.target.closest('[data-mode]'); if (b) start(b.dataset.mode, S.level); });
  $('#levelSeg').addEventListener('click', ev => { const b = ev.target.closest('[data-level]'); if (b) start(S.mode, b.dataset.level); });
  $('#newBtn').addEventListener('click', () => start(S.mode, S.level));

  const [hm, hl, hs] = location.hash.slice(1).split('/');
  start(['pops', 'clone'].includes(hm) ? hm : prefs.mode || 'pops', LEVELS[hl] ? hl : prefs.level || 'easy', +hs || 0);
})();
