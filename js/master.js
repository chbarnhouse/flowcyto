/* FlowCyto master reference: every cell type against every marker, in one table. Opened from the book
   button beside Settings (menu, board and quiz). Search, filters, grouping and sorting all stack:
     search    cells (name, full name, aliases) and markers (name, full name, note); a cell match narrows
               the rows, a marker match narrows the columns
     filters   Normal / Abnormal, lineages, marker groups; hide markers none of the shown cells carry;
               only markers that differ between the shown cells
     group     cells by lineage, by normal / abnormal, or not at all
     sort      catalog order, A to Z, or by one marker (carriers first, brightest first)
     axes      cells down the side and markers across (default), or switched
   Clear all filters puts search and filters back (grouping, sorting and axes stay).
   Tap a cell or a marker for everything about it. Readings are written as symbols with a legend, never
   as color alone. Choices are kept in localStorage (flowcyto.master). */
(function () {
  'use strict';
  const FC = window.FC;
  const { BY, ENTITIES, MARKERS } = FC;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = (k, d) => { try { return Object.assign(d, JSON.parse(localStorage.getItem(k) || 'null') || {}); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } };
  const ICON = {
    close: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    check: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    filter: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3.5h12M4.5 8h7M7 12.5h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    search: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.2 10.2l3.3 3.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    abn: '<svg class="ic abn" viewBox="0 0 16 16" aria-label="abnormal" role="img"><path d="M8 2.5l5.5 5.5L8 13.5 2.5 8z" fill="currentColor"/></svg>',
    swap: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sort: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M2.5 10.5L5 13l2.5-2.5M11 13V3M8.5 5.5L11 3l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  // ---------- catalog ----------
  const LINEAGES = [['T', 'T cell'], ['NK', 'NK cell'], ['B', 'B cell'], ['plasma', 'Plasma cell'], ['myeloid', 'Myeloid']];
  const { MGROUPS } = FC;
  const GROUP_OF = Object.fromEntries(MGROUPS.flatMap(([g, , mks]) => mks.map(mk => [mk, g])));
  const ALL_MARKERS = MGROUPS.flatMap(g => g[2]).filter(mk => MARKERS[mk]);
  const CELLS = ENTITIES.filter(e => e.kind === 'normal' || e.kind === 'neoplasm');

  // what a cell shows for a marker: [symbol, class, words]
  const SCATTER = { low: ['lo', 'sc', 'low'], mid: ['mid', 'sc', 'intermediate'], high: ['hi', 'sc', 'high'] }; // size and granularity, not a marker: unshaded
  function reading(e, mk) {
    if (mk === 'FSC') return SCATTER[e.fsc] || ['', 'neg', ''];
    if (mk === 'SSC') return SCATTER[e.ssc] || ['', 'neg', ''];
    const lv = e.m[mk];
    if (mk === 'LC') return lv === 'poly' ? ['κλ', 'pos', 'kappa and lambda (polyclonal)'] : lv === 'clonal' ? ['κ|λ', 'pos', 'kappa or lambda only (clonal)'] : ['–', 'neg', 'none'];
    return ({ '+': ['+', 'pos', 'positive'], bright: ['++', 'pos', 'bright'], dim: ['dim', 'pos', 'dim'], split: ['±', 'part', 'partly positive'], var: ['var', 'part', 'varies between cases'] })[lv] || ['–', 'neg', 'negative'];
  }
  const RANK = { '++': 0, '+': 1, dim: 2, '±': 3, var: 4, 'κλ': 1, 'κ|λ': 1, hi: 0, mid: 1, lo: 2 };
  const carries = (e, mk) => reading(e, mk)[1] !== 'neg';
  const fullOf = mk => MARKERS[mk].full || (/^CD\d/.test(mk) ? `cluster of differentiation ${mk.slice(2)}` : '');

  // ---------- state ----------
  const M = load('flowcyto.master', { q: '', normal: true, abnormal: true, lins: [], mgroups: [], group: 'lineage', sort: 'catalog', by: null, hideEmpty: true, onlyDiff: false, open: false, flip: false });
  const keep = () => save('flowcyto.master', Object.assign({}, M, { q: '' })); // the search box starts empty each time
  let detail = null, gate = null;

  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9κλ]+/g, ' ').trim();
  const cellText = e => norm([e.name, e.long, ...(e.aliases || []), LINEAGES.find(l => l[0] === e.lineage)[1]].join(' '));
  const markText = mk => norm([mk, MARKERS[mk].name, MARKERS[mk].full || '', MARKERS[mk].note || ''].join(' '));
  function searched() {
    const q = norm(M.q); if (!q) return { cells: null, marks: null };
    const words = q.split(' ');
    const hit = t => words.every(w => t.includes(w));
    const cells = CELLS.filter(e => hit(cellText(e))), marks = ALL_MARKERS.filter(mk => hit(markText(mk)));
    // a marker's exact name ("CD5") means that marker alone, though "CD56" and "CD4 T cell" match too
    const exact = ALL_MARKERS.filter(mk => norm(MARKERS[mk].name) === q || norm(mk) === q);
    if (exact.length) return { cells: null, marks: exact };
    // a cell match shows those cells with all their markers; otherwise the markers that match
    if (cells.length) return { cells, marks: null };
    return { cells: null, marks: marks.length ? marks : [] };
  }
  function view() {
    const s = searched();
    // Settings → Content decides what's in the catalog at all; the filters here narrow it further
    let rows = (s.cells || CELLS).filter(e => FC.content.entOn(e.id) && (e.kind === 'normal' ? M.normal : M.abnormal) && (!M.lins.length || M.lins.includes(e.lineage)));
    let cols = (s.marks || ALL_MARKERS).filter(mk => FC.content.mkOn(mk) && (!M.mgroups.length || M.mgroups.includes(GROUP_OF[mk])));
    if (M.hideEmpty && !s.marks) cols = cols.filter(mk => GROUP_OF[mk] === 'scatter' || rows.some(e => carries(e, mk)));
    if (M.onlyDiff) cols = cols.filter(mk => new Set(rows.map(e => reading(e, mk)[0])).size > 1);
    if (M.sort === 'az') rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (M.by && MARKERS[M.by]) rows = rows.slice().sort((a, b) => (RANK[reading(a, M.by)[0]] ?? 9) - (RANK[reading(b, M.by)[0]] ?? 9));
    return { rows, cols, s };
  }

  // ---------- drawing ----------
  const dlg = () => $('#master');
  const chip = (attr, on, label) => `<button class="mchip" ${attr} aria-pressed="${on}">${on ? ICON.check : '<span class="ic"></span>'}<span>${label}</span></button>`;
  const seg = (k, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, t]) => `<button role="radio" data-mset="${k}" data-v="${v}" aria-checked="${M[k] === v}">${t}</button>`).join('')}</div>`;
  function filtersHTML() {
    return `<div class="mfilters">
      <div class="mf-row"><b>Cells</b><div class="mchips">${chip('data-mkind="normal"', M.normal, 'Normal')}${chip('data-mkind="abnormal"', M.abnormal, `${ICON.abn} Abnormal`)}</div></div>
      <div class="mf-row"><b>Lineage</b><div class="mchips">${LINEAGES.map(([v, t]) => chip(`data-mlin="${v}"`, M.lins.includes(v), t)).join('')}</div></div>
      <div class="mf-row"><b>Markers</b><div class="mchips">${MGROUPS.map(([v, t]) => chip(`data-mgrp="${v}"`, M.mgroups.includes(v), t)).join('')}</div></div>
      <div class="mf-row"><b>Show</b><div class="mchips">${chip('data-mflag="hideEmpty"', M.hideEmpty, 'Hide markers none of these carry')}${chip('data-mflag="onlyDiff"', M.onlyDiff, 'Only markers that differ')}</div></div>
      <div class="mf-row"><b>Group</b>${seg('group', [['lineage', 'Lineage'], ['kind', 'Normal / abnormal'], ['none', 'None']])}</div>
      <div class="mf-row"><b>Sort</b>${seg('sort', [['catalog', 'Catalog'], ['az', 'A to Z']])}</div>
      <div class="mf-foot"><p class="mf-note">No lineage or marker group picked means all of them. Tap a marker's name to sort by it.</p><button class="btn" data-mreset ${nFilters() || M.q ? '' : 'disabled'}>${ICON.close}<span>Clear all filters</span></button></div>
    </div>`;
  }
  const nFilters = () => (!M.normal || !M.abnormal ? 1 : 0) + M.lins.length + M.mgroups.length + (M.onlyDiff ? 1 : 0) + (!M.hideEmpty ? 1 : 0);
  const cellGroup = e => M.group === 'lineage' ? LINEAGES.find(l => l[0] === e.lineage)[1] : M.group === 'kind' ? (e.kind === 'normal' ? 'Normal' : 'Abnormal') : null;
  const groupCells = rows => M.group === 'none' ? rows : rows.slice().sort((a, b) => {
    const k = e => M.group === 'lineage' ? LINEAGES.findIndex(l => l[0] === e.lineage) : e.kind === 'normal' ? 0 : 1;
    return k(a) - k(b);
  });
  const cellName = e => `${e.kind === 'normal' ? '' : ICON.abn}${esc(e.name)}`;
  const cellTd = (e, mk) => { const [sym, cls, words] = reading(e, mk); return `<td class="${cls}${M.by === mk && !M.flip ? ' by' : ''}" title="${esc(e.name)} · ${esc(MARKERS[mk].name)}: ${words}">${sym}</td>`; };
  const markHead = mk => `data-mmark="${esc(mk)}" title="${esc(MARKERS[mk].name)}${fullOf(mk) ? ': ' + esc(fullOf(mk)) : ''}"`;
  /* Switched axes: markers down the side (under their family headings), cell types across the top
     (under their lineage or normal / abnormal headings) */
  function flippedHTML(rows, cols) {
    const cells = groupCells(rows);
    let gh = '<tr class="mgh"><th class="corner" rowspan="2"><span>Marker</span></th>', last, span = 0;
    const flush = () => { if (span) gh += `<th colspan="${span}"><span>${last || ''}</span></th>`; };
    last = undefined;
    for (const e of cells) { const g = cellGroup(e); if (g !== last) { flush(); last = g; span = 0; } span++; }
    flush(); gh += '</tr>';
    const ch = `<tr class="mmh">${cells.map(e => `<th class="mk" data-mcell="${e.id}" title="${esc(e.long || e.name)}"><span>${cellName(e)}</span></th>`).join('')}</tr>`;
    let body = '', grp = null;
    for (const mk of cols) {
      const g = GROUP_OF[mk];
      if (g !== grp) { grp = g; body += `<tr class="mgrp"><th colspan="${cells.length + 1}"><span>${MGROUPS.find(x => x[0] === g)[1]}</span></th></tr>`; }
      body += `<tr${M.by === mk ? ' class="byrow"' : ''}><th class="cell" ${markHead(mk)}><span>${esc(MARKERS[mk].name)}${M.by === mk ? ICON.sort : ''}</span></th>${cells.map(e => cellTd(e, mk)).join('')}</tr>`;
    }
    return `<div class="mscroll"><table class="mgrid flip"><thead>${gh}${ch}</thead><tbody>${body}</tbody></table></div>`;
  }
  function tableHTML(rows, cols) {
    if (!rows.length || !cols.length) return `<p class="mempty">Nothing matches. ${M.q ? 'Try a shorter search, or ' : ''}<button class="linkbtn" data-mreset>clear the filters</button>.</p>`;
    if (M.flip) return flippedHTML(rows, cols);
    // marker-group header across the top, then the marker names (sideways)
    let gh = '<tr class="mgh"><th class="corner" rowspan="2"><span>Cell type</span></th>', last = null, span = 0;
    const flush = () => { if (last) gh += `<th colspan="${span}" class="g-${last}"><span>${MGROUPS.find(g => g[0] === last)[1]}</span></th>`; };
    for (const mk of cols) { const g = GROUP_OF[mk]; if (g !== last) { flush(); last = g; span = 0; } span++; }
    flush(); gh += '</tr>';
    const mh = `<tr class="mmh">${cols.map(mk => `<th class="mk${M.by === mk ? ' by' : ''}" data-mmark="${esc(mk)}" title="${esc(MARKERS[mk].name)}${fullOf(mk) ? ': ' + esc(fullOf(mk)) : ''}"><span>${esc(MARKERS[mk].name)}${M.by === mk ? ICON.sort : ''}</span></th>`).join('')}</tr>`;
    let body = '', grp = null;
    const label = e => M.group === 'lineage' ? LINEAGES.find(l => l[0] === e.lineage)[1] : M.group === 'kind' ? (e.kind === 'normal' ? 'Normal' : 'Abnormal') : null;
    const ordered = M.group === 'none' ? rows : rows.slice().sort((a, b) => {
      const k = e => M.group === 'lineage' ? LINEAGES.findIndex(l => l[0] === e.lineage) : e.kind === 'normal' ? 0 : 1;
      return k(a) - k(b);
    });
    for (const e of ordered) {
      const g = label(e);
      if (g && g !== grp) { grp = g; body += `<tr class="mgrp"><th colspan="${cols.length + 1}"><span>${g}</span></th></tr>`; }
      body += `<tr><th class="cell" data-mcell="${e.id}"><span>${e.kind === 'normal' ? '' : ICON.abn}${esc(e.name)}</span></th>${cols.map(mk => { const [sym, cls, words] = reading(e, mk); return `<td class="${cls}${M.by === mk ? ' by' : ''}" title="${esc(e.name)} · ${esc(MARKERS[mk].name)}: ${words}">${sym}</td>`; }).join('')}</tr>`;
    }
    return `<div class="mscroll"><table class="mgrid"><thead>${gh}${mh}</thead><tbody>${body}</tbody></table></div>`;
  }
  const LEGEND = `<div class="mlegend"><span><b>++</b> bright</span><span><b>+</b> positive</span><span><b>dim</b></span><span class="part"><b>±</b> partly</span><span class="part"><b>var</b> varies</span><span><b>–</b> negative</span><span><b>κλ</b> both light chains · <b>κ|λ</b> one</span><span>${ICON.abn} abnormal</span></div>`;

  const resultsHTML = (rows, cols) => `<div class="m-sum"><span>${rows.length} cell type${rows.length === 1 ? '' : 's'} · ${cols.length} marker${cols.length === 1 ? '' : 's'}${FC.content.allKeys.some(k => k[0] !== 'g' && !FC.content.isOn(k)) ? ` · ${esc(FC.content.levelName(FC.content.state.level))} content (Settings)` : ''}</span>${nFilters() ? `<button class="mchip" data-mreset aria-label="Clear all filters">${ICON.close}<span>Clear ${nFilters()} filter${nFilters() === 1 ? '' : 's'}</span></button>` : ''}${M.by ? `<button class="mchip on" data-munsort aria-pressed="true">${ICON.sort}<span>Sorted by ${esc(MARKERS[M.by].name)}</span>${ICON.close}</button>` : ''}</div>${tableHTML(rows, cols)}${LEGEND}`;
  // typing redraws the results only, so the search box (and the phone keyboard) stays put
  function refresh() { const r = dlg().querySelector('.m-results'); if (!r) return draw(); const { rows, cols } = view(); r.innerHTML = resultsHTML(rows, cols); }
  function draw(focusSearch) {
    const d = dlg(); if (!d) return;
    const { rows, cols } = view(), n = nFilters();
    const scroll = d.querySelector('.mscroll'), pos = scroll ? [scroll.scrollLeft, scroll.scrollTop] : null;
    d.innerHTML = `<div class="m-head"><h2>Master reference</h2><button class="iconbtn" data-mclose aria-label="Close the master reference">${ICON.close}</button></div>
      ${gate ? gateHTML() : `<div class="m-tools">
        <label class="msearch">${ICON.search}<input type="search" id="mq" placeholder="Search cells and markers" value="${esc(M.q)}" autocomplete="off" spellcheck="false"></label>
        <button class="btn mfbtn" data-mfilters aria-expanded="${M.open}">${ICON.filter}<span>Filters${n ? ` (${n})` : ''}</span></button>
        <button class="btn mfbtn mswap" data-mflip aria-pressed="${M.flip}" aria-label="Switch axes: ${M.flip ? 'cell types down the side' : 'markers down the side'}" title="Switch axes">${ICON.swap}<span>Switch axes</span></button>
      </div>
      ${M.open ? filtersHTML() : ''}
      <div class="m-results">${resultsHTML(rows, cols)}</div>`}
      ${detail ? detailHTML() : ''}`;
    const sc = d.querySelector('.mscroll'); if (sc && pos) { sc.scrollLeft = pos[0]; sc.scrollTop = pos[1]; }
    if (focusSearch) { const i = d.querySelector('#mq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }

  // everything about one cell or one marker, in a sheet over the bottom
  function rowsHTML(items, hit) {
    let group = null;
    return items.map(it => {
      const head = it.group && it.group !== group ? `<tr class="grp"><th colspan="3">${(group = it.group)}</th></tr>` : '';
      return `${head}<tr${it.key === hit ? ' class="hit"' : ''}><th>${esc(it.name)}</th><td>${esc(it.full || '')}</td><td class="lv">${it.tag ? `<span class="pill">${it.tag}</span>` : ''}</td></tr>`;
    }).join('');
  }
  const TAGS = { '++': 'bright', dim: 'dim', '±': 'partly', var: 'varies', 'κλ': 'both', 'κ|λ': 'one only', lo: 'low', mid: 'mid', hi: 'high' };
  function detailHTML() {
    const [kind, key] = detail;
    let h;
    if (kind === 'cell') {
      const e = BY[key], lin = LINEAGES.find(l => l[0] === e.lineage)[1];
      const items = ALL_MARKERS.filter(mk => GROUP_OF[mk] !== 'scatter' && FC.content.mkOn(mk) && carries(e, mk)).map(mk => ({ key: mk, name: MARKERS[mk].name, full: MARKERS[mk].full || '', tag: TAGS[reading(e, mk)[0]] }));
      h = `<h3>${e.kind === 'normal' ? '' : ICON.abn}${esc(e.name)}</h3><p class="md-sub">${e.long && e.long !== e.name ? esc(e.long) + ' · ' : ''}${e.kind === 'normal' ? 'Normal' : 'Abnormal'} · ${lin} · scatter: FSC ${e.fsc}, SSC ${e.ssc}</p>
        ${e.teach ? `<p class="md-teach">${esc(e.teach)}</p>` : ''}
        ${e.aliases ? `<p class="md-sub">Also called ${e.aliases.map(esc).join(', ')}</p>` : ''}
        <section class="qsec"><h4>Carries</h4><table class="qtab mark">${rowsHTML(items)}</table><p class="qfoot">Everything else is negative.</p></section>`;
    } else {
      const mk = key, m = MARKERS[mk];
      const items = CELLS.filter(e => FC.content.entOn(e.id) && carries(e, mk)).map(e => ({ key: e.id, name: e.name, full: e.long && e.long !== e.name ? e.long : '', tag: TAGS[reading(e, mk)[0]], group: e.kind === 'normal' ? 'Normal' : 'Abnormal' }));
      h = `<h3>${esc(m.name)}</h3>${fullOf(mk) ? `<p class="md-sub">${esc(fullOf(mk))}</p>` : ''}${m.note ? `<p class="md-teach">${esc(m.note)}</p>` : ''}
        <section class="qsec"><h4>Cells with ${esc(m.name)}</h4>${items.length ? `<table class="qtab cell">${rowsHTML(items)}</table>` : '<p class="help">None.</p>'}</section>
        <button class="btn" data-msortby="${esc(mk)}">${ICON.sort}<span>${M.by === mk ? 'Stop sorting by' : 'Sort cells by'} ${esc(m.name)}</span></button>`;
    }
    return `<div class="mdetail" role="dialog" aria-label="Details"><div class="md-in card"><button class="iconbtn md-x" data-mdclose aria-label="Close">${ICON.close}</button>${h}</div></div>`;
  }
  // in a board where you fill in the reference yourself, opening this is a peek: say so first
  const gateHTML = () => `<div class="mgate card"><p><b>This board's reference is yours to fill in.</b></p><p>The master reference shows every cell's markers, so opening it counts against a clean solve (like peeking at every row).</p><div class="mgate-btns"><button class="btn" data-mclose>Cancel</button><button class="btn primary" data-mgo>Open it anyway</button></div></div>`;

  // ---------- open / close ----------
  function open(opts) {
    let d = dlg();
    if (!d) { d = document.createElement('dialog'); d.id = 'master'; d.className = 'master card'; document.body.append(d); bind(d); }
    gate = opts && opts.warn ? opts : null; detail = null; M.q = '';
    draw();
    if (!d.open) d.showModal();
  }
  function close() { const d = dlg(); if (d && d.open) d.close(); }

  function bind(d) {
    d.addEventListener('input', ev => { if (ev.target.id === 'mq') { M.q = ev.target.value; refresh(); } });
    d.addEventListener('cancel', ev => { if (detail) { ev.preventDefault(); detail = null; draw(); } });
    d.addEventListener('click', ev => {
      const t = ev.target, c = s => t.closest(s);
      if (c('[data-mclose]')) return close();
      if (c('[data-mgo]')) { const g = gate; gate = null; if (g.onOpen) g.onOpen(); return draw(); }
      if (c('[data-mdclose]') || (detail && t.classList.contains('mdetail'))) { detail = null; return draw(); }
      if (c('[data-mflip]')) { M.flip = !M.flip; keep(); return draw(); }
      if (c('[data-mfilters]')) { M.open = !M.open; keep(); return draw(); }
      if (c('[data-mreset]')) { Object.assign(M, { q: '', normal: true, abnormal: true, lins: [], mgroups: [], onlyDiff: false, hideEmpty: true }); keep(); return draw(); }
      const tog = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
      let b;
      if ((b = c('[data-mkind]'))) { const k = b.dataset.mkind; M[k] = !M[k]; if (!M.normal && !M.abnormal) M[k === 'normal' ? 'abnormal' : 'normal'] = true; }
      else if ((b = c('[data-mlin]'))) M.lins = tog(M.lins, b.dataset.mlin);
      else if ((b = c('[data-mgrp]'))) M.mgroups = tog(M.mgroups, b.dataset.mgrp);
      else if ((b = c('[data-mflag]'))) M[b.dataset.mflag] = !M[b.dataset.mflag];
      else if ((b = c('[data-mset]'))) M[b.dataset.mset] = b.dataset.v;
      else if ((b = c('[data-munsort]'))) M.by = null;
      else if ((b = c('[data-msortby]'))) { M.by = M.by === b.dataset.msortby ? null : b.dataset.msortby; detail = null; }
      else if ((b = c('[data-mcell]'))) detail = ['cell', b.dataset.mcell];
      else if ((b = c('[data-mmark]'))) detail = ['mark', b.dataset.mmark];
      else return;
      keep(); draw();
    });
  }

  FC.master = { open, close, ICON: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4.2C6.4 3 4.4 2.8 2 3.4v9.2c2.4-.6 4.4-.4 6 .8 1.6-1.2 3.6-1.4 6-.8V3.4c-2.4-.6-4.4-.4-6 .8zM8 4.2v9.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>' };
})();
