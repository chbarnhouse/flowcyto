/* FlowCyto Quizzes: endless quizzes in two topics, any mix switched on in Settings (at least one):
     markers   which cells carry which markers
     genetics  which translocations and mutations go with which malignancies (js/genetics.js)
   Both draw only on what Settings → Content has on (js/content.js). Answer formats, any mix of them
   switched on in Settings (at least one):
     swipe   a cell type and a marker: does it carry it? (swipe right for yes, left for no; or the buttons)
     single  multiple choice with one right answer (tapping a choice answers)
     multi   pick all that apply (one to three right)
     type    type it yourself: a full name or an abbreviation, matched the way Step 1 Pathways matches
             (case, spaces and punctuation ignored, Greek folded); any right answer counts, and text that
             names nothing isn't a miss
   Directions (for all but swipe; at least one): marker or lesion → cells, cell → markers or lesions.
   Only clear-cut readings are asked: a marker that is partly positive or varies between patients is
   never a question, nor is a lesion that turns up in a disease without being its classic one. Negative
   pairs come from the same lineage first (CD5 on a B cell, not CD41 on a T cell; t(14;18) for mantle
   cell), so a "no" is a real distinction. Route: '#markers'. */
(function () {
  'use strict';
  const FC = window.FC;
  const { BY, ENTITIES, MARKERS, readClass, GENETICS: G, content: CT } = FC;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } };
  const ICON = {
    yes: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    no: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    back: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    list: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5l1.2 1.2 2-2.4M2.5 10.5l1.2 1.2 2-2.4M8 5h5.5M8 11h5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pause: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    gear: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h6M12 4.5h1.5M2.5 11.5h1.5M7.5 11.5h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10.2" cy="4.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5.8" cy="11.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  };
  const FORMATS = { swipe: 'Swipe: yes or no? Right for yes, left for no', single: 'Multiple choice: one right answer', multi: 'Pick all that apply: more than one can be right', type: 'Type it yourself: any right answer counts' };
  const DIRS = { cells: 'Marker or lesion → cells', markers: 'Cell → markers or lesions' };
  const TOPIC_NAMES = { markers: 'Markers: which cells carry which markers', genetics: 'Translocations and mutations: which go with which malignancies' };
  // almost every cell has these: never the answer to type
  const COMMON = ['CD45', 'CD55', 'CD59'];

  // ---------- facts: clear-cut readings only ----------
  const ent = id => BY[id] || G.DIS_BY[id]; // a cell type, or a disease with no board of its own
  const QUIZ_MARKERS = Object.keys(MARKERS).filter(mk => !['FSC', 'SSC', 'LC'].includes(mk));
  function reading(id, mk) {
    if (!CT.mkOn(mk) || !CT.entOn(id)) return null;
    const c = readClass(BY[id].m[mk], mk);
    return c === 'neg' ? false : (c === 'pos' || c === 'dim') ? true : null; // split / var: not asked
  }
  // markers worth asking about for a cell: its own, plus any its lineage-mates carry
  function markersFor(id) {
    const lin = BY[id].lineage, set = new Set();
    for (const e of ENTITIES) if (e.lineage === lin || e.id === id) for (const mk of Object.keys(e.m)) if (QUIZ_MARKERS.includes(mk)) set.add(mk);
    return [...set].filter(mk => reading(id, mk) !== null);
  }
  // "CD4 T cell" and CD4: the name gives it away, so that pair is never asked
  const named = (id, mk) => new RegExp(`(^|[^A-Za-z0-9])${mk}([^A-Za-z0-9]|$)`).test(BY[id].name);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /* Which cells the quiz asks about. Translocations and mutations belong to malignancies only, so with
     that topic on, Normal isn't a choice (and on its own, neither is Both): the saved choice stays put
     for when it's off again, and this is what applies meanwhile. */
  const cellChoices = () => !Q.cfg.topics.genetics ? ['normal', 'neoplasm', 'both'] : Q.cfg.topics.markers ? ['neoplasm', 'both'] : ['neoplasm'];
  const cells = () => cellChoices().includes(Q.cfg.cells) ? Q.cfg.cells : Q.cfg.cells === 'normal' && Q.cfg.topics.markers ? 'both' : 'neoplasm';
  const cellPool = () => ENTITIES.filter(e => CT.entOn(e.id) && (cells() === 'both' || e.kind === cells())).map(e => e.id);

  // genetics: a link that's on is a yes; a classic lesion of another disease is a no; anything else isn't asked
  const LINK = new Map(G.LINKS.map(l => [l[0] + '|' + l[1], l]));
  const RARE = new Set(G.RARE.map(r => r.join('|')));
  const DISEASES = [...ENTITIES.filter(e => e.kind === 'neoplasm'), ...G.DISEASES].map(d => d.id);
  function gread(d, l) {
    const link = LINK.get(d + '|' + l);
    if (link) return CT.linkOn(link) ? true : null;
    if (RARE.has(d + '|' + l) || G.LESIONS[l].noNeg || !CT.entOn(d) || !CT.lesOn(l)) return null;
    return false;
  }
  const geneRows = () => DISEASES.filter(d => G.LINKS.some(l => l[0] === d && CT.linkOn(l)));
  const geneCols = () => Object.keys(G.LESIONS).filter(l => G.LINKS.some(k => k[1] === l && CT.linkOn(k)));
  // lesions worth asking about for a disease: those of its lineage first, the rest when that's too few
  function lesionsFor(d) {
    const lin = ent(d).lineage, all = Object.keys(G.LESIONS).filter(l => gread(d, l) !== null);
    const mine = all.filter(l => G.LINKS.some(k => k[1] === l && ent(k[0]).lineage === lin));
    return mine.length >= 6 ? mine : all;
  }
  const TOPICS = {
    markers: { rows: cellPool, cols: () => QUIZ_MARKERS.filter(CT.mkOn), read: reading, colsFor: markersFor, named, colKind: 'mark', common: COMMON,
      has: 'carries', hasNot: "doesn't carry", have: 'Carry', withWord: 'Cells with', swipe: 'Does it carry it?', colWord: 'marker', rowWord: 'cell type' },
    genetics: { rows: geneRows, cols: geneCols, read: gread, colsFor: lesionsFor, named: () => false, colKind: 'gene', common: [],
      has: 'has', hasNot: "doesn't have", have: 'Have', withWord: 'Diseases with', swipe: 'Does it go with it?', colWord: 'translocation or mutation', rowWord: 'disease' },
  };

  function makeQuestion() {
    // pick the topic and format first, then retry within them, so one that is harder to fill still gets its share
    for (const topic of shuffle(Object.keys(TOPICS).filter(t => Q.cfg.topics[t]))) { const q = makeIn(topic); if (q) return Object.assign(q, { topic }); }
    return null;
  }
  function makeIn(topic) {
    const T = TOPICS[topic], reading = T.read, markersFor = T.colsFor, named = T.named, COMMON = T.common;
    const fmts = shuffle(Object.keys(FORMATS).filter(f => Q.cfg.formats[f]));
    const dirs = Object.keys(DIRS).filter(d => Q.cfg.dirs[d]);
    const QUIZ_MARKERS = T.cols(), all = T === TOPICS.markers ? ENTITIES.map(e => e.id) : DISEASES;
    for (let tries = 0; tries < 50 * fmts.length; tries++) {
      const fmt = fmts[Math.floor(tries / 50)], pool = T.rows();
      if (!pool.length || !QUIZ_MARKERS.length) return null;
      if (fmt === 'swipe') {
        const id = pick(pool), mks = markersFor(id).filter(mk => !named(id, mk)), want = Math.random() < 0.5;
        const pickFrom = mks.filter(mk => reading(id, mk) === want);
        if (!pickFrom.length) continue;
        return { kind: 'match', fmt, id, mk: pick(pickFrom), answer: want };
      }
      const kind = pick(dirs);
      if (fmt === 'type') {
        if (kind === 'markers') {
          const id = pick(pool), ok = markersFor(id).filter(mk => reading(id, mk) && !named(id, mk) && !COMMON.includes(mk));
          if (!ok.length) continue;
          return { kind, fmt, id, correct: ok };
        }
        // a marker few cells carry, so naming one means something
        const mk = pick(QUIZ_MARKERS.filter(m => !COMMON.includes(m))), ok = pool.filter(id => reading(id, mk) === true);
        if (!ok.length || ok.length > 6 || all.some(id => reading(id, mk) && named(id, mk))) continue;
        return { kind, fmt, mk, correct: ok };
      }
      const one = fmt === 'single', total = one ? 4 : 5;
      const nPosOf = pos => one ? 1 : Math.min(pos.length, 1 + Math.floor(Math.random() * 3));
      if (kind === 'markers') {
        const id = pick(pool), mks = shuffle(markersFor(id).filter(mk => !named(id, mk)));
        const pos = mks.filter(mk => reading(id, mk)), neg = mks.filter(mk => !reading(id, mk));
        if (!pos.length || neg.length < total - nPosOf(pos)) continue;
        const nPos = nPosOf(pos), opts = shuffle([...pos.slice(0, nPos), ...neg.slice(0, total - nPos)]);
        return { kind, fmt, id, options: opts, correct: opts.filter(mk => reading(id, mk)) };
      }
      const mk = pick(QUIZ_MARKERS), clear = shuffle(pool.filter(id => reading(id, mk) !== null && markersFor(id).includes(mk) && !named(id, mk)));
      const pos = clear.filter(id => reading(id, mk)), neg = clear.filter(id => !reading(id, mk));
      if (!pos.length || neg.length < 3) continue;
      // decoys from the positives' lineages first, so the choice is a real one
      const lins = new Set(pos.map(id => ent(id).lineage));
      const negs = [...neg.filter(id => lins.has(ent(id).lineage)), ...neg.filter(id => !lins.has(ent(id).lineage))];
      const nPos = nPosOf(pos), opts = shuffle([...pos.slice(0, nPos), ...negs.slice(0, total - nPos)]);
      if (opts.length < 4) continue;
      return { kind, fmt, mk, options: opts, correct: opts.filter(id => reading(id, mk)) };
    }
    return null;
  }

  // ---------- typed answers: every name a cell or marker goes by ----------
  // Step 1 Pathways' rule: case, spaces and punctuation don't matter; Greek letters fold to their Latin initial
  const GREEK = { α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', κ: 'k', λ: 'l' };
  const tnorm = s => String(s).toLowerCase().replace(/[αβγδεκλ]/g, c => GREEK[c]).replace(/\b(alpha|beta|gamma|delta|kappa|lambda)/g, w => w[0])
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  function namesOf(kind, key) {
    if (kind === 'cell') { const e = ent(key); return [e.name, e.long, ...(e.aliases || []), ...e.name.split(' / ')]; }
    if (kind === 'gene') { const l = G.LESIONS[key]; return [l.name, ...l.aliases]; }
    const m = MARKERS[key], out = [key, m.name];
    // "c-KIT, the stem cell factor receptor", "neural cell adhesion molecule (NCAM)": each part counts
    if (m.full) out.push(m.full, ...m.full.split(/[(),]/).map(x => x.replace(/^\s*the\s+/, '').trim()).filter(x => x.length > 1));
    return out;
  }
  const INDEX = { cell: new Map(), mark: new Map(), gene: new Map() };
  for (const e of [...ENTITIES, ...G.DISEASES]) for (const n of namesOf('cell', e.id)) if (tnorm(n) && !INDEX.cell.has(tnorm(n))) INDEX.cell.set(tnorm(n), e.id);
  for (const l of Object.keys(G.LESIONS)) for (const n of namesOf('gene', l)) if (tnorm(n) && !INDEX.gene.has(tnorm(n))) INDEX.gene.set(tnorm(n), l);
  for (const mk of QUIZ_MARKERS) for (const n of namesOf('mark', mk)) if (tnorm(n) && !INDEX.mark.has(tnorm(n))) INDEX.mark.set(tnorm(n), mk);
  const resolve = (kind, text) => INDEX[kind].get(tnorm(text)) || null;
  // a near miss in spelling: suggest the name (never the answer: it is any name in the catalog)
  function nearest(kind, text) {
    const v = tnorm(text); if (v.length < 4) return null;
    const dist = (a, b) => { const d = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } } return d[b.length]; };
    let best = null;
    for (const [n, key] of INDEX[kind]) { const k = dist(v, n); if (k <= (v.length > 8 ? 2 : 1) && (!best || k < best[0])) best = [k, key]; }
    return best && nameOf(kind, best[1]);
  }

  // ---------- full names ----------
  // a cell's long name when its short one is abbreviated (CLL / SLL, NK cell); a marker's own name, or CD n
  const ABBR = /(^|[^A-Za-z])([A-Z]{2,}|CD\d)/;
  const cellFull = id => { const e = ent(id); return ABBR.test(e.name) && e.long && e.long !== e.name ? e.long : ''; };
  const markFull = mk => MARKERS[mk].full || (/^CD\d/.test(mk) ? `cluster of differentiation ${mk.slice(2)}` : '');
  const fullOf = (kind, key) => kind === 'cell' ? cellFull(key) : kind === 'gene' ? G.LESIONS[key].full : markFull(key);
  const nameOf = (kind, key) => kind === 'cell' ? ent(key).name : kind === 'gene' ? G.LESIONS[key].name : MARKERS[key].name;
  // an abbreviation in a question: dotted underline; press and hold (or tap: Settings) for the full name
  const term = (kind, key) => fullOf(kind, key) ? `<span class="abbr" role="button" data-full="${kind}:${esc(key)}">${esc(nameOf(kind, key))}</span>` : esc(nameOf(kind, key));
  // in an answer the full name is written out (CD numbers only when they have a name of their own)
  const spelled = (kind, key) => kind === 'cell' ? cellFull(key) : kind === 'gene' ? G.LESIONS[key].full : MARKERS[key].full || '';

  /* The answer lists: every marker a cell carries, every cell (in the quiz's cell types) carrying a
     marker. Dim, bright, partly (split) and varies are said in words. */
  const TAG = { dim: 'dim', bright: 'bright', split: 'partly', var: 'varies', poly: 'both', clonal: 'one only' };
  const carries = lv => lv && lv !== '-';
  const cellMarkers = id => Object.keys(MARKERS).filter(mk => !MARKERS[mk].scatter && CT.mkOn(mk) && carries(BY[id].m[mk])).map(mk => ({ kind: 'mark', key: mk, lv: BY[id].m[mk] }));
  // every cell in the content, whatever the quiz is set to; normal ones first, under their own headings
  const markerCells = mk => ENTITIES.filter(e => CT.entOn(e.id) && carries(e.m[mk])).map(e => ({ kind: 'cell', key: e.id, lv: e.m[mk], group: e.kind === 'normal' ? 'Normal' : 'Abnormal' }));
  const disLesions = d => Object.keys(G.LESIONS).filter(l => gread(d, l)).map(l => ({ kind: 'gene', key: l }));
  const lesionDis = l => DISEASES.filter(d => gread(d, l)).map(d => ({ kind: 'cell', key: d }));
  Object.assign(TOPICS.markers, { rowItems: cellMarkers, colItems: markerCells });
  Object.assign(TOPICS.genetics, { rowItems: disLesions, colItems: lesionDis });
  // one answer list as a small table: name · full name · how it reads (in words), the asked one shaded and tagged
  function sectionHTML(title, items, hit, foot, hitTag = 'asked') {
    // grouped lists (Normal / Abnormal) get a table each, so wide windows can set them side by side
    const groups = [];
    for (const it of items) { if (!groups.length || it.group !== groups[groups.length - 1].name) groups.push({ name: it.group, items: [] }); groups[groups.length - 1].items.push(it); }
    const table = g => `<table class="qtab ${g.items[0].kind}">${g.name ? `<tr class="grp"><th colspan="3">${g.name}</th></tr>` : ''}${g.items.map(it => {
      const f = spelled(it.kind, it.key), tag = TAG[it.lv], asked = it.key === hit;
      return `<tr${asked ? ' class="hit"' : ''}><th>${esc(nameOf(it.kind, it.key))}</th><td>${esc(f)}</td><td class="lv">${tag ? `<span class="pill">${tag}</span>` : ''}${asked ? `<span class="pill asked">${hitTag}</span>` : ''}</td></tr>`;
    }).join('')}</table>`;
    const lists = !items.length ? '<p class="help">None of these cell types.</p>' : groups.length > 1 ? `<div class="qgroups">${groups.map(table).join('')}</div>` : table(groups[0]);
    return `<section class="qsec${groups.length > 1 ? ' grouped' : ''}"><h4>${title}</h4>${lists}${foot ? `<p class="qfoot">${foot}</p>` : ''}</section>`;
  }
  // "CLL / SLL (chronic lymphocytic leukemia / …)"; a full name with its own parentheses goes between commas
  const withFull = (kind, key) => {
    // a lesion's line is just its name: what it does is in the table below
    let f = kind === 'gene' ? '' : spelled(kind, key); if (!f) return `<b>${esc(nameOf(kind, key))}</b>`;
    if (kind === 'cell' && !/^[A-Z][A-Z-]/.test(f)) f = f[0].toLowerCase() + f.slice(1); // "Chronic …" mid-sentence; not "B-lymphoblastic
    return `<b>${esc(nameOf(kind, key))}</b>${f.includes('(') ? `, <span class="full">${esc(f)}</span>,` : ` <span class="full">(${esc(f)})</span>`}`;
  };

  // ---------- state ----------
  // settings from before formats existed: swipe stays swipe, the two pick-all kinds become Pick all + their directions
  const savedCfg = load('flowcyto.markers', {});
  if (savedCfg.kinds && !savedCfg.formats) {
    const k = savedCfg.kinds;
    savedCfg.formats = { swipe: !!k.match, single: false, multi: !!(k.cells || k.markers), type: false };
    savedCfg.dirs = k.cells || k.markers ? { cells: !!k.cells, markers: !!k.markers } : { cells: true, markers: true };
    delete savedCfg.kinds;
  }
  const Q = { cfg: Object.assign({ content: null, topics: { markers: true, genetics: true }, formats: { swipe: true, single: true, multi: true, type: false }, dirs: { cells: true, markers: true }, cells: 'both' }, savedCfg), draft: '', msg: null, typed: null, q: null, picked: new Set(), crossed: new Set(), done: false, right: null, score: 0, answered: 0, streak: 0 };
  const best = () => load('flowcyto.markersBest', 0);
  // the Quizzes' own content (null: Settings → Content); read while a quiz is open
  CT.scope('quiz', () => Q.cfg.content, v => { Q.cfg.content = v; }, () => { save('flowcyto.markers', Q.cfg); if (!$('#quiz').hidden && !Q.q) setup(); });

  // ---------- views ----------
  function open() {
    $('#menu').hidden = true; $('#game').hidden = true; $('#quiz').hidden = false;
    document.documentElement.classList.add('in-game');
    document.title = 'FlowCyto · Quizzes';
    CT.use('quiz');
    Q.score = 0; Q.answered = 0; Q.streak = 0;
    setup();
  }
  function close() { $('#quiz').hidden = true; hideFull(); CT.use(null); }
  const bar = () => `<header class="bar"><div class="bar-in"><button class="iconbtn" data-qmenu aria-label="Main menu">${ICON.back}<span>Menu</span></button><div class="gtitle"><b>Quizzes</b><span>${Q.answered ? `${Q.score} of ${Q.answered} · streak ${Q.streak} · best ${best()}` : `best streak ${best()}`}</span></div><span class="bar-btns"><button class="iconbtn" data-qmaster aria-label="Master reference">${FC.master.ICON}<span>Reference</span></button><button class="iconbtn" data-qsettings aria-label="Settings">${ICON.gear}<span>Settings</span></button></span></div></header>`;
  // the quiz's own settings: shown on the start screen and at the top of Settings
  const chipOf = (attr, on, label) => `<button class="qchip" ${attr} aria-pressed="${on}">${on ? ICON.yes : '<span class="ic"></span>'}<span>${label}</span></button>`;
  const kindsHTML = () => `<div class="qchips">${Object.entries(FORMATS).map(([k, t]) => chipOf(`data-qfmt="${k}"`, !!Q.cfg.formats[k], t)).join('')}</div>`;
  const topicsHTML = () => `<div class="qchips">${Object.entries(TOPIC_NAMES).map(([k, t]) => chipOf(`data-qtopic="${k}"`, !!Q.cfg.topics[k], t)).join('')}</div>`;
  const dirsHTML = () => `<div class="qchips">${Object.entries(DIRS).map(([k, t]) => chipOf(`data-qdir="${k}"`, !!Q.cfg.dirs[k], t)).join('')}</div>`;
  // which cells the questions (and the answer lists) draw on
  const cellsHTML = () => `<div class="seg" role="radiogroup">${[['normal', 'Normal'], ['neoplasm', 'Abnormal'], ['both', 'Both']].map(([v, t]) => `<button role="radio" data-qcells="${v}" aria-checked="${cells() === v}" ${cellChoices().includes(v) ? '' : 'disabled'}>${t}</button>`).join('')}</div>`;
  // what the Cell types row says
  const cellsNote = () => 'Normal cells, abnormal ones (neoplasms and clones), or both.' + (Q.cfg.topics.genetics ? ` Translocations and mutations are only about abnormal cells${Q.cfg.topics.markers ? ', so Normal needs that topic off' : ''}.` : '');
  const modeHTML = () => `<div class="qrow col"><div><b>Topics</b></div>${topicsHTML()}</div><div class="qrow col"><div><b>Answer formats</b></div>${kindsHTML()}</div><div class="qrow"><div><b>Directions</b><span>For every format but swipe: name the cells for a marker or lesion, the markers or lesions for a cell, or both.</span></div>${dirsHTML()}</div><div class="qrow"><div><b>Cell types</b><span>${cellsNote()}</span></div>${cellsHTML()}</div>`;
  function setup() {
    Q.q = null;
    $('#quiz').innerHTML = bar() + `<main class="qmain"><section class="qcard setup card"><h2>Quizzes</h2><p class="sub">Endless quizzes on which cells carry which markers, and which translocations and mutations go with which malignancies. Pick any mix of topics and answer formats; change them any time in Settings. The level comes from Settings → Content, unless Advanced below gives the Quizzes their own.</p>
      ${modeHTML()}${CT.advancedHTML('quiz', 'quizzes')}<button class="btn primary big" data-qstart>Start</button></section></main>`;
  }
  function next() {
    if (Q.auto) { clearTimeout(Q.auto.timer); clearInterval(Q.auto.tick); } Q.auto = null;
    Q.q = makeQuestion(); Q.picked = new Set(); Q.crossed = new Set(); Q.done = false; Q.right = null; Q.draft = ''; Q.msg = null; Q.typed = null;
    if (!Q.q) { $('#quiz').innerHTML = bar() + '<main class="qmain"><section class="qcard card"><p>No questions fit these settings. Try more topics or cell types, or more content (Settings → Content).</p></section></main>'; return; }
    draw();
  }
  function questionHTML() {
    const q = Q.q, T = TOPICS[q.topic], ck = T.colKind, fb = Q.done;
    if (q.kind === 'match') {
      let h = `<div class="swipe-wrap"><div class="swipe-hint left">${ICON.no}<span>No</span></div><div class="swipe-hint right">${ICON.yes}<span>Yes</span></div>
        <div class="swipecard card" id="swipecard"><span class="qkind">${T.swipe}</span><b class="qterm qcell">${term('cell', q.id)}</b><span class="qand">and</span><b class="qterm qmark">${term(ck, q.mk)}</b><p class="help">Swipe right for yes, left for no.</p></div></div>`;
      if (!fb) h += `<div class="yn"><button class="btn big no" data-yn="no">${ICON.no}<span>No</span></button><button class="btn big yes" data-yn="yes">${ICON.yes}<span>Yes</span></button></div>`;
      return h;
    }
    const isCells = q.kind === 'cells', subj = isCells ? term(ck, q.mk) : term('cell', q.id), gene = ck === 'gene';
    if (q.fmt === 'type') {
      const ask = isCells ? (gene ? 'Name a malignancy that has it.' : 'Name a cell that carries it.') : (gene ? 'Name a translocation or mutation it has.' : 'Name a marker it carries.');
      const note = isCells || gene ? '' : ' (Not CD45, CD55 or CD59: nearly every cell has those.)';
      return `<section class="qcard card"><span class="qkind">${ask}</span><b class="qbig">${subj}</b><p class="help">Any one counts.${note} A full name or an abbreviation; case, spaces and punctuation don't matter.</p>
        <form class="qtype" data-qtype><input id="qin" type="text" value="${esc(fb ? nameOf(isCells ? 'cell' : ck, Q.typed) : Q.draft)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="${isCells ? (gene ? 'A malignancy' : 'A cell type') : (gene ? 'A translocation or gene' : 'A marker')}" aria-label="${ask}" ${fb ? 'disabled' : ''}>${fb ? '' : '<button class="btn primary big">Check</button>'}</form>
        ${Q.msg ? `<p class="qmsg" role="status">${Q.msg}</p>` : ''}</section>`;
    }
    const one = q.fmt === 'single';
    const askPick = gene ? (isCells ? (one ? 'Which malignancy has it?' : 'Which malignancies have it?') : (one ? 'Which one does it have?' : 'Which does it have?'))
      : isCells ? (one ? 'Which cell carries it?' : 'Which cells carry it?') : (one ? 'Which marker does it carry?' : 'Which markers does it carry?');
    let h = `<section class="qcard card"><span class="qkind">${askPick} ${one ? 'Pick one.' : 'Pick all that apply.'}</span><b class="qbig">${subj}</b><div class="qopts">`;
    for (const o of q.options) {
      const on = Q.picked.has(o), isRight = q.correct.includes(o);
      const x = !fb && Q.crossed.has(o);
      let cls = on ? 'on' : x ? 'crossed' : '', mark = on ? ICON.yes : '<span class="ic"></span>', tail = '';
      if (fb) { const yes = gene ? 'goes with it' : 'carries it'; cls = isRight ? (on ? 'ok' : 'missed') : (on ? 'bad' : ''); mark = isRight ? ICON.yes : (on ? ICON.no : '<span class="ic"></span>'); tail = `<span class="otag">${isRight ? (on ? yes : `${yes}: missed`) : (on ? "doesn't" : '')}</span>`; }
      const ok = isCells ? 'cell' : ck, nm = esc(nameOf(ok, o)), hasFull = !!fullOf(ok, o);
      // holding a choice shows its full name without choosing it
      h += `<div class="qrow-opt"><button class="qopt ${cls}" data-qopt="${o}" ${hasFull ? `data-full="${ok}:${esc(o)}"` : ''} ${fb ? 'disabled' : ''}>${mark}<span${hasFull ? ' class="abbr"' : ''}>${nm}</span>${tail}</button>${fb ? '' : `<button class="xout" data-qx="${o}" aria-pressed="${x}" aria-label="${x ? 'Restore' : 'Cross out'} ${nm}" title="${x ? 'Restore' : 'Cross out'}">${ICON.no}</button>`}</div>`;
    }
    h += '</div>';
    // one answer: tapping a choice answers; pick all: Check
    if (!fb && !one) h += `<button class="btn primary big" data-qcheck ${Q.picked.size ? '' : 'disabled'}>Check</button>`;
    return h + '</section>';
  }
  // the verdict pops up over the bottom of the screen; the question stays visible above it
  function popupHTML() {
    const q = Q.q, T = TOPICS[q.topic], ck = T.colKind, mk = q.mk && MARKERS[q.mk];
    const note = ck === 'mark' ? (mk.note ? `<b>${esc(mk.name)}</b>: ${esc(mk.note)}` : '') : '';
    const teach = q.id && ck === 'mark' && ent(q.id).teach ? esc(ent(q.id).teach) : '';
    const onCell = (id, foot, hit) => sectionHTML(`${esc(ent(id).name)} ${T.has}`, T.rowItems(id), hit || q.mk, foot, hit ? 'yours' : 'asked');
    const withMark = (m, foot, hit) => sectionHTML(`${T.withWord} ${esc(nameOf(ck, m))}`, T.colItems(m), hit || q.id, foot, hit ? 'yours' : 'asked');
    const bare = (kind, key) => withFull(kind, key).replace(/,$/, '');
    let line, body;
    if (q.kind === 'match') { line = ck === 'mark' ? `${withFull('cell', q.id)} is <b>${esc(mk.name)}${q.answer ? '+' : '−'}</b>` : `${bare('cell', q.id)} ${q.answer ? T.has : T.hasNot} <b>${esc(nameOf(ck, q.mk))}</b>`; body = `<div class="qsecs two">${onCell(q.id, teach)}${withMark(q.mk, note)}</div>`; }
    else if (q.fmt === 'type' && q.kind === 'cells') { line = `${bare('cell', Q.typed)} ${Q.right ? T.has : T.hasNot} <b>${esc(nameOf(ck, q.mk))}</b>`; body = withMark(q.mk, note, Q.typed); }
    else if (q.fmt === 'type') { line = `${bare('cell', q.id)} ${Q.right ? T.has : T.hasNot} ${bare(ck, Q.typed)}`; body = onCell(q.id, teach, Q.typed); }
    else if (q.kind === 'cells') { line = `${T.have} ${bare(ck, q.mk)}: <b>${q.correct.map(o => esc(ent(o).name)).join(', ')}</b>`; body = withMark(q.mk, note); }
    else { line = `${bare('cell', q.id)} ${T.has} <b>${q.correct.map(o => esc(nameOf(ck, o))).join(', ')}</b>`; body = onCell(q.id, teach); }
    // auto-continue: a bar that runs down to the next question; press and hold (or scroll the answer) stops it
    const a = Q.auto, timer = a ? `<div class="qtimer${a.paused ? ' paused' : ''}" style="--secs:${a.secs}s"><div class="qtimer-track"><i></i></div><span>${a.paused ? `${ICON.pause}<b>Paused</b> · Next when you're ready` : `Next question in <span class="qcount">${a.secs}</span> s · <b>hold to pause</b>`}</span></div>` : '';
    return `<div class="qpop ${Q.right ? 'right' : 'wrong'}" role="status"><div class="qpop-in card${q.kind === 'match' ? ' wide two' : body.includes('qgroups') ? ' wide' : ''}"><div class="qpop-head">${Q.right ? ICON.yes : ICON.no}<b>${Q.right ? 'Right' : 'Not quite'}</b></div><div class="qpop-body"><p class="qpop-line">${line}</p>${body}</div>${timer}<button class="btn big qpop-next" data-qnext>Next</button></div></div>`;
  }
  function draw() {
    hideFull();
    $('#quiz').innerHTML = bar() + `<main class="qmain">${questionHTML()}</main>${Q.done ? popupHTML() : ''}`;
    if (Q.q.kind === 'match' && !Q.done) bindSwipe();
    if (Q.q.fmt === 'type' && !Q.done && !Q.msg) { const i = $('#qin'); if (i) i.focus({ preventScroll: true }); }
  }
  function answer(right) {
    Q.done = true; Q.right = right; Q.answered++;
    if (right) { Q.score++; Q.streak++; if (Q.streak > best()) save('flowcyto.markersBest', Q.streak); } else Q.streak = 0;
    // Settings: seconds until the next question after a right / wrong answer (0 = wait for Next)
    const q = Q.q, secs = +(right ? FC.prefs.quizRight : FC.prefs.quizWrong) || 0;
    Q.auto = secs > 0 ? { secs, paused: false, end: performance.now() + secs * 1000, timer: setTimeout(() => { if (Q.q === q && Q.done && !$('#quiz').hidden) next(); }, secs * 1000) } : null;
    draw();
    // the seconds count down with the bar
    const a = Q.auto;
    if (a) a.tick = setInterval(() => {
      const el = $('#quiz .qcount');
      if (Q.auto !== a || a.paused || !el) return clearInterval(a.tick);
      el.textContent = Math.max(1, Math.ceil((a.end - performance.now()) / 1000));
    }, 200);
  }
  // stops the countdown for good: the bar freezes and says Paused; Next is up to you
  function pauseAuto() {
    const a = Q.auto; if (!a || a.paused || !Q.done) return;
    a.paused = true; clearTimeout(a.timer);
    const t = $('#quiz .qtimer'); if (!t) return;
    t.classList.add('paused');
    t.querySelector('span').innerHTML = `${ICON.pause}<b>Paused</b> · Next when you're ready`;
    if (navigator.vibrate) navigator.vibrate(10);
  }

  // ---------- swipe ----------
  function bindSwipe() {
    const card = $('#swipecard'); if (!card) return;
    let x0 = null, dx = 0;
    swipeCancel = () => { x0 = null; card.classList.remove('dragging'); card.style.transform = ''; $('.swipe-hint.right').style.opacity = 0; $('.swipe-hint.left').style.opacity = 0; };
    card.addEventListener('pointerdown', ev => { x0 = ev.clientX; dx = 0; card.setPointerCapture(ev.pointerId); card.classList.add('dragging'); });
    card.addEventListener('pointermove', ev => {
      if (x0 == null) return;
      dx = ev.clientX - x0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      $('.swipe-hint.right').style.opacity = Math.max(0, Math.min(1, dx / 90));
      $('.swipe-hint.left').style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null; card.classList.remove('dragging');
      if (Math.abs(dx) > 90) return answer((dx > 0) === Q.q.answer);
      card.style.transform = ''; $('.swipe-hint.right').style.opacity = 0; $('.swipe-hint.left').style.opacity = 0;
    };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }

  // ---------- full names: press and hold an abbreviation (Settings: or tap it) ----------
  /* While held, the full name shows in a bubble and a Keep it open zone covers the top bar (as for a
     held plot): let go there and the bubble stays until the next tap. A choice always works by holding,
     since a tap picks it. */
  let swipeCancel = null, hold = null, kept = false, quietUntil = 0;
  function fullTip() {
    let t = $('#fulltip');
    if (!t) { t = document.createElement('div'); t.id = 'fulltip'; t.className = 'holdtip fulltip'; t.setAttribute('role', 'status'); t.hidden = true; document.body.append(t); }
    return t;
  }
  function showFull(el, keep) {
    const [kind, key] = el.dataset.full.split(/:(.*)/), t = fullTip();
    const cd = kind === 'mark' && /^CD\d/.test(key) && MARKERS[key].full ? '<span>CD: cluster of differentiation</span>' : '';
    t.innerHTML = `<span><b>${esc(nameOf(kind, key))}</b><span class="fullname">${esc(fullOf(kind, key))}</span>${cd}${keep ? '<span>Tap anywhere to close.</span>' : ''}</span>`;
    t.hidden = false; kept = !!keep;
    const r = el.getBoundingClientRect(), w = Math.min(360, innerWidth - 24);
    Object.assign(t.style, { width: w + 'px', left: Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px' });
    const above = r.top - 10 - t.offsetHeight, barB = $('#quiz .bar').getBoundingClientRect().bottom;
    t.style.top = (above > barB + 8 ? above : r.bottom + 10) + 'px';
  }
  function hideFull() { const t = $('#fulltip'); if (t) t.hidden = true; kept = false; }
  const latchEl = () => $('#latch');
  function drawKeep(on) {
    const I = FC.ICON;
    latchEl().innerHTML = `<div class="lz keep${on ? ' on' : ''}" data-lz="keep">${on ? I.lock : I.unlock}<span>${on ? 'Let go to keep it open' : 'Keep it open'}</span></div>`;
  }
  function onKeep(x, y) {
    const z = latchEl().firstElementChild; if (!z) return false;
    const r = z.getBoundingClientRect(), m = 14;
    return x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;
  }
  document.addEventListener('pointerdown', ev => {
    quietUntil = 0; // a new touch: its click is a real one
    const el = ev.target.closest('#quiz [data-full]'); if (!el || kept || Q.done && el.matches('.qopt')) return;
    if (!el.matches('.qopt') && FC.prefs.abbrOpen === 'tap') return; // the click opens it
    hold = { el, x: ev.clientX, y: ev.clientY, shown: false, on: false, timer: setTimeout(() => {
      if (!hold) return;
      hold.shown = true; if (swipeCancel) swipeCancel();
      showFull(el, false);
      const L = latchEl(), b = $('#quiz .bar').getBoundingClientRect();
      Object.assign(L.style, { top: b.top + 'px', height: b.height + 'px' }); L.classList.remove('tap'); drawKeep(false); L.hidden = false;
      if (navigator.vibrate) navigator.vibrate(10);
    }, 300) };
  }, true);
  const track = (x, y) => {
    if (!hold) return;
    if (!hold.shown) { if (Math.hypot(x - hold.x, y - hold.y) > 10) { clearTimeout(hold.timer); hold = null; } return; }
    const on = onKeep(x, y); if (on !== hold.on) { hold.on = on; drawKeep(on); if (on && navigator.vibrate) navigator.vibrate(10); }
  };
  addEventListener('pointermove', ev => track(ev.clientX, ev.clientY), true);
  addEventListener('touchmove', ev => { const t = ev.touches[0]; if (t) track(t.clientX, t.clientY); }, { capture: true, passive: true });
  document.addEventListener('touchmove', ev => { if (hold && hold.shown) ev.preventDefault(); }, { passive: false });
  // a hold ends however the touch ends (iOS can end a long press without a pointerup)
  function endFull() {
    if (!hold) return;
    const h = hold; hold = null; clearTimeout(h.timer);
    if (!h.shown) { if (!h.el.matches('.qopt')) FC.holdTip(h.el, 'Press and hold to see the full name.'); return; } // only tapped
    latchEl().hidden = true; quietUntil = performance.now() + 450; // the touch's own click doesn't pick the choice
    if (h.on) showFull(h.el, true); else hideFull();
  }
  for (const t of ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup', 'blur']) addEventListener(t, endFull, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) endFull(); });
  // a kept bubble closes on the next tap, which does nothing else
  document.addEventListener('click', ev => {
    if (performance.now() < quietUntil) { ev.stopPropagation(); ev.preventDefault(); return; }
    if (kept) { hideFull(); ev.stopPropagation(); ev.preventDefault(); return; }
    const el = ev.target.closest('#quiz .abbr[data-full]');
    if (el && FC.prefs.abbrOpen === 'tap') { showFull(el, true); ev.stopPropagation(); }
  }, true);
  document.querySelector('#quiz').addEventListener('contextmenu', ev => ev.preventDefault());

  // a press and hold anywhere on the answer popup pauses auto-continue; so does scrolling the answer
  let popHold = null, popHeld = false;
  document.addEventListener('pointerdown', ev => {
    popHeld = false; // a new touch: its click is a real one
    if (!ev.target.closest('#quiz .qpop') || !Q.auto || Q.auto.paused) return;
    popHold = { x: ev.clientX, y: ev.clientY, t: setTimeout(() => { popHold = null; popHeld = true; pauseAuto(); }, 350) };
  });
  addEventListener('pointermove', ev => { if (popHold && Math.hypot(ev.clientX - popHold.x, ev.clientY - popHold.y) > 10) { clearTimeout(popHold.t); popHold = null; } });
  for (const t of ['pointerup', 'pointercancel', 'touchend', 'touchcancel']) addEventListener(t, () => { if (popHold) { clearTimeout(popHold.t); popHold = null; } }, true);
  document.addEventListener('scroll', ev => { if (ev.target.closest && ev.target.closest('#quiz .qpop')) pauseAuto(); }, true);
  // the hold's own click (on Next, say) does nothing
  document.addEventListener('click', ev => { if (popHeld) { popHeld = false; if (ev.target.closest('#quiz .qpop')) { ev.stopPropagation(); ev.preventDefault(); } } }, true);

  // ---------- input ----------
  document.addEventListener('click', ev => {
    const inSettings = ev.target.closest('#settings');
    const f = ev.target.closest('[data-qfmt]'), d = ev.target.closest('[data-qdir]'), c = ev.target.closest('[data-qcells]'), tp = ev.target.closest('[data-qtopic]');
    if (f || d || c || tp) {
      // flip a format or direction, but never the last one on
      const flip = (set, key) => { if (set[key] && Object.values(set).filter(Boolean).length === 1) return false; set[key] = !set[key]; return true; };
      if (tp) { if (!flip(Q.cfg.topics, tp.dataset.qtopic)) return; }
      else if (f) { if (!flip(Q.cfg.formats, f.dataset.qfmt)) return; }
      else if (d) { if (!flip(Q.cfg.dirs, d.dataset.qdir)) return; }
      else if (!c.disabled) Q.cfg.cells = c.dataset.qcells; else return;
      save('flowcyto.markers', Q.cfg);
      if (!$('#quiz').hidden && !Q.q) setup();
      if (inSettings) FC.openSettings();
      return;
    }
    if (!ev.target.closest('#quiz')) return;
    if (CT.click(ev, () => { if (!Q.q) setup(); })) return;
    if (ev.target.closest('[data-qmenu]')) { location.hash = '/'; return; }
    if (ev.target.closest('[data-qsettings]')) return FC.openSettings();
    if (ev.target.closest('[data-qmaster]')) return FC.master.open();
    if (ev.target.closest('[data-qstart]')) return next();
    if (ev.target.closest('[data-qnext]')) return next();
    const yn = ev.target.closest('[data-yn]'); if (yn && !Q.done) return answer((yn.dataset.yn === 'yes') === Q.q.answer);
    const x = ev.target.closest('[data-qx]'); if (x && !Q.done) { const v = x.dataset.qx; Q.crossed.has(v) ? Q.crossed.delete(v) : (Q.crossed.add(v), Q.picked.delete(v)); return draw(); }
    const o1 = ev.target.closest('[data-qopt]');
    if (o1 && !Q.done && Q.q.fmt === 'single') { const v = o1.dataset.qopt; Q.picked = new Set([v]); return answer(Q.q.correct.includes(v)); }
    const o = ev.target.closest('[data-qopt]'); if (o && !Q.done) { const v = o.dataset.qopt; Q.picked.has(v) ? Q.picked.delete(v) : (Q.picked.add(v), Q.crossed.delete(v)); return draw(); }
    if (ev.target.closest('[data-qcheck]')) { const q = Q.q, ok = q.correct.length === Q.picked.size && q.correct.every(x => Q.picked.has(x)); return answer(ok); }
  });
  // typed answers: anything that names nothing in the catalog (or only partly fits) isn't a miss
  document.addEventListener('input', ev => { if (ev.target.id === 'qin') Q.draft = ev.target.value; });
  document.addEventListener('submit', ev => {
    if (!ev.target.closest('#quiz [data-qtype]')) return;
    ev.preventDefault();
    const q = Q.q; if (!q || Q.done) return;
    const text = $('#qin').value.trim(); Q.draft = text; if (!text) return;
    const T = TOPICS[q.topic], kind = q.kind === 'cells' ? 'cell' : T.colKind, key = resolve(kind, text);
    const again = msg => { Q.msg = msg; draw(); const i = $('#qin'); if (i) { i.focus(); i.select(); } };
    if (!key) { const near = nearest(kind, text); return again(`I don't know "${esc(text)}" as a ${kind === 'cell' ? T.rowWord : T.colWord}.${near ? ` Did you mean <b>${esc(near)}</b>?` : ' Try a full name or a common abbreviation.'} Not counted.`); }
    const r = kind === 'cell' ? T.read(key, q.mk) : T.read(q.id, key);
    if (r === null) return again(T === TOPICS.genetics ? `<b>${esc(nameOf(kind, key))}</b> isn't a classic match either way, or it's off in Settings → Content: name another. Not counted.`
      : `<b>${esc(nameOf(kind, key))}</b> is only partly positive, varies between cases, or is off in Settings → Content: name one that's clearly positive. Not counted.`);
    if (r && kind === 'mark' && COMMON.includes(key)) return again(`True, but nearly every cell has <b>${esc(nameOf(kind, key))}</b>: name one that says more. Not counted.`);
    Q.typed = key; answer(r === true);
  });
  document.addEventListener('keydown', ev => {
    if ($('#quiz').hidden || !Q.q) return;
    if (Q.q.kind === 'match' && !Q.done && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) answer((ev.key === 'ArrowRight') === Q.q.answer);
    else if (Q.done && (ev.key === 'Enter' || ev.key === ' ') && !ev.target.closest('input, button')) { ev.preventDefault(); next(); }
  });

  FC.markers = { open, close, modeHTML, topicsHTML, kindsHTML, dirsHTML, cellsHTML, cellsNote, makeQuestion: () => makeQuestion(), cfg: Q.cfg };
})();
