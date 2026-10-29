/* FlowCyto content: which cell types, diseases, markers and genetic lesions the app draws on. Boards,
   the Quizzes and the master reference all read it; a board in progress keeps what it started with.
   Two filters that stack: a level (Step 1 · Step 2 CK · Step 3 · residency · heme fellowship; each
   includes the ones before it), then any item turned on or off by hand, singly or a whole group at a
   time. An item is on when its own switch says so, else when its level is within the chosen one.
   Scatter and CD45 always stay on: every board is gated on them. Saved in localStorage
   (flowcyto.content). Shown as the Content tab of Settings.
   Those are the defaults. The Quizzes and Custom boards can each keep their own content instead (their
   Advanced section), one-off: the Quizzes' goes when you leave them, Custom's when the sheet opens
   afresh. A scope whose override is null reads the defaults. Advanced always shows the controls; the
   first change copies the defaults into an override, and anything that differs from them is marked
   with a dot and can be reverted (singly, by group, or all at once; back to no differences = null).
   An item differs when it reads otherwise than your defaults' own switch for it would at this scope's
   level, so changing the level alone marks the level, not every item it turns on.
   `use(scope)` says whose content
   the app is reading right now (the Quizzes' while a quiz is open); a board snapshots its own at the start. */
(function () {
  'use strict';
  const FC = window.FC;
  const { MARKERS, MGROUPS, ENTITIES, BY, GENETICS: G } = FC;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = (k, d) => { try { return Object.assign(d, JSON.parse(localStorage.getItem(k) || 'null') || {}); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } };

  const LEVELS = [[1, 'Step 1', 'Step 1'], [2, 'Step 2 CK', 'Step 2'], [3, 'Step 3', 'Step 3'], [4, 'Residency', 'Residency'], [5, 'Heme fellowship', 'Fellowship']];
  const CORE = ['FSC', 'SSC', 'CD45'];
  const DEF = load('flowcyto.content', { level: 1, on: {} });
  // scope → its override ({level, on} or null) and how to save it; registered by the Quizzes and Custom
  const SCOPES = { def: { get: () => DEF, set: () => {}, save: () => save('flowcyto.content', DEF) } };
  const scopeState = sc => (sc && SCOPES[sc] && SCOPES[sc].get()) || DEF;
  let active = 'def';
  const st = () => scopeState(active);

  // ---------- the catalog, keyed e: (cell types and diseases), m: (markers), g: (genetic lesions) ----------
  const dis = id => BY[id] || G.DIS_BY[id];
  const linkLvl = id => Math.min(...G.LINKS.filter(l => l[1] === id).map(l => l[2]));
  const lvlOf = key => {
    const [t, id] = key.split(/:(.*)/);
    return t === 'e' ? dis(id).lvl || 1 : t === 'm' ? MARKERS[id].lvl || 1 : linkLvl(id);
  };
  // everything below takes the state it reads (C); the exported ones read the active scope's
  const onIn = (C, key) => key in C.on ? C.on[key] : lvlOf(key) <= C.level;
  const entIn = (C, id) => onIn(C, 'e:' + id);
  const mkIn = (C, mk) => CORE.includes(mk) || onIn(C, 'm:' + mk);
  // a link counts when its disease and lesion are on and it's within the level, or its lesion was turned on by hand
  const linkIn = (C, [d, l, lv]) => entIn(C, d) && onIn(C, 'g:' + l) && (lv <= C.level || C.on['g:' + l] === true);
  const allowIn = C => ({ ents: ENTITIES.filter(e => entIn(C, e.id)).map(e => e.id), mks: Object.keys(MARKERS).filter(mk => mkIn(C, mk)) });
  const isOn = key => onIn(st(), key), entOn = id => entIn(st(), id), mkOn = mk => mkIn(st(), mk);
  const lesOn = id => onIn(st(), 'g:' + id), linkOn = l => linkIn(st(), l);
  const allow = sc => allowIn(sc ? scopeState(sc) : st());

  const DGROUPS = [['normal', 'Normal cells'], ['B', 'B-cell neoplasms'], ['T', 'T- and NK-cell neoplasms'], ['myeloid', 'Myeloid neoplasms'], ['plasma', 'Plasma cell neoplasms']];
  const ALL_DIS = [...ENTITIES, ...G.DISEASES];
  const disGroup = d => d.kind === 'normal' ? 'normal' : d.lineage === 'NK' ? 'T' : d.lineage;
  const LGROUPS = [['b', 'B-cell'], ['t', 'T-cell'], ['myeloid', 'Myeloid'], ['plasma', 'Plasma cell']];
  const SECTIONS = [
    { id: 'e', title: 'Cell types and diseases', groups: DGROUPS.map(([g, t]) => [g, t, ALL_DIS.filter(d => disGroup(d) === g).map(d => 'e:' + d.id)]) },
    { id: 'm', title: 'Markers', groups: MGROUPS.map(([g, t, mks]) => [g, t, mks.filter(mk => !CORE.includes(mk)).map(mk => 'm:' + mk)]).filter(g => g[2].length) },
    { id: 'g', title: 'Translocations and mutations', groups: LGROUPS.map(([g, t]) => [g, t, Object.values(G.LESIONS).filter(l => l.grp === g).map(l => 'g:' + l.id)]) },
  ];
  const nameOf = key => { const [t, id] = key.split(/:(.*)/); return t === 'e' ? dis(id).name : t === 'm' ? MARKERS[id].name : G.LESIONS[id].name; };
  const allKeys = SECTIONS.flatMap(s => s.groups.flatMap(g => g[2]));

  function set(C, key, on) { if (on === (lvlOf(key) <= C.level)) delete C.on[key]; else C.on[key] = on; }
  function changed(sc) { tidy(sc); SCOPES[sc].save(); if (FC.onContent) FC.onContent(); }
  // an override: what each item would be with your defaults' switches at its level; what differs
  const expected = (C, key) => key in DEF.on ? DEF.on[key] : lvlOf(key) <= C.level;
  const differs = (C, key) => onIn(C, key) !== expected(C, key);
  const nDiffs = C => (C.level !== DEF.level) + allKeys.filter(k => differs(C, k)).length;
  function setOwn(C, key, on) { if (on !== expected(C, key)) C.on[key] = on; else if (key in DEF.on) C.on[key] = DEF.on[key]; else delete C.on[key]; }
  function tidy(sc) { const C = sc !== 'def' && SCOPES[sc].get(); if (C && !nDiffs(C)) SCOPES[sc].set(null); }
  const DOT = '<i class="chg" role="img" aria-label="changed from your default" title="Changed from your default"></i>';

  // ---------- the page ----------
  const ICON = {
    check: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const levelName = n => LEVELS.find(l => l[0] === n)[1];
  const counts = C => SECTIONS.map(s => { const ks = s.groups.flatMap(g => g[2]); return [ks.filter(k => onIn(C, k)).length, ks.length]; });
  // "Step 1 · 31 of 39 cell types and diseases · …"
  function summary(C = DEF, lesions = true) {
    const [e, m, g] = counts(C), hand = Object.keys(C.on).length;
    return `${levelName(C.level)}${hand ? ` plus ${hand} change${hand === 1 ? '' : 's'} by hand` : ''} · ${e[0]} of ${e[1]} cell types and diseases · ${m[0]} of ${m[1]} markers${lesions ? ` · ${g[0]} of ${g[1]} lesions` : ''}`;
  }
  /* The level as a track of stops: every stop up to the chosen one is filled (it's included), the chosen
     one is ringed with a check, the ones past it are hollow. Shape and fill carry it, not color. */
  const levelTrack = C => `<div class="ct-track" role="radiogroup" aria-label="Level" style="--n:${LEVELS.length};--at:${C.level - 1}">${LEVELS.map(([n, long, short]) =>
    `<button role="radio" data-ctlevel="${n}" aria-checked="${C.level === n}" aria-label="${long}" class="${n <= C.level ? 'in' : ''}"><span class="dot">${C.level === n ? ICON.check : ''}</span><span class="lbl">${short}</span></button>`).join('')}</div>`;
  const levelWords = C => C.level === 1 ? 'Step 1 material only.' : `Everything from Step 1 through ${levelName(C.level).replace('Heme fellowship', 'heme fellowship').replace('Residency', 'residency')}.`;
  // a clone that reads like a normal cell on the markers that are on: says which markers would bring it back
  function offBoards(C) {
    if (!FC.lookalikes) return '';
    const a = allowIn(C), out = [];
    for (const e of ENTITIES.filter(e => e.kind === 'neoplasm' && entIn(C, e.id))) {
      const l = FC.lookalikes(e.id, a);
      if (l.like.length) out.push(`<b>${esc(e.name)}</b> reads like ${l.like.map(id => esc(BY[id].name)).join(' and ')}${l.need.length ? `; ${l.need.map(mk => esc(MARKERS[mk].name)).join(' or ')} would tell them apart` : ''}`);
    }
    return out.length ? `<p class="ct-note">Not on boards (quizzes still ask about them): ${out.join('. ')}.</p>` : '';
  }
  function itemHTML(C, key, own) {
    const on = onIn(C, key), chg = own && differs(C, key), lv = lvlOf(key), d = key[0] === 'e' ? dis(key.slice(2)) : null;
    const tags = [lv > 1 ? levelName(lv) : '', d && d.kind === 'genetic' ? 'quiz only' : ''].filter(Boolean);
    return `<button class="mchip ct" data-ct="${esc(key)}" aria-pressed="${on}">${on ? ICON.check : '<span class="ic"></span>'}<span>${esc(nameOf(key))}</span>${tags.map(t => `<small class="ct-tag">${t}</small>`).join('')}${chg ? DOT : ''}</button>`;
  }
  /* The lists for one scope: level, anything set by hand, `extra` (the Quizzes' cell types), then the
     sections. Custom boards have no lesions, and quizzes no boards, so each sees only its own. */
  const LEVEL_FOR = { def: 'For boards, quizzes and the master reference.', quiz: 'For the Quizzes.', custom: 'For Custom boards.' };
  function bodyHTML(extra = '', sc = 'def') {
    const C = scopeState(sc), own = sc !== 'def', lvChg = own && C.level !== DEF.level;
    let h = `<div class="set-row ct-level"><div><b>Level${lvChg ? DOT : ''}</b>${lvChg ? `<button class="btn mini ct-rev" data-ctrevert="level">Revert to ${levelName(DEF.level)}</button>` : ''}<span>${LEVEL_FOR[sc]} ${levelWords(C)} Anything beyond Step 1 is tagged with its level.${sc === 'quiz' ? '' : " A board you're in the middle of keeps what it started with."}</span></div>${levelTrack(C)}</div>`;
    const hand = Object.keys(C.on).length;
    h += extra;
    if (hand && !own) h += `<div class="set-row"><div><b>${hand} change${hand === 1 ? '' : 's'} by hand</b><span>Items turned on or off by hand, whatever the level says.</span></div><button class="btn" data-ctreset>Match the level</button></div>`;
    for (const s of SECTIONS) {
      if (sc === 'custom' && s.id === 'g') continue;
      const ks = s.groups.flatMap(g => g[2]).filter(x => !(sc === 'custom' && x[0] === 'e' && dis(x.slice(2)).kind === 'genetic')), n = ks.filter(k => onIn(C, k)).length;
      h += `<div class="ct-sec"><h3 class="set-sec">${s.title} <span>${n} of ${ks.length}</span></h3><span class="ct-btns"><button class="btn mini" data-ctall="${s.id}">All on</button><button class="btn mini" data-ctnone="${s.id}">All off</button></span></div>`;
      if (s.id === 'e' && sc !== 'quiz') h += offBoards(C);
      if (s.id === 'm') h += `<p class="help">Scatter and CD45 always stay on${sc === 'quiz' ? '' : ': every board is gated on them. A plot shows only when both its markers are on'}.</p>`;
      if (s.id === 'g' && sc === 'def') h += '<p class="help">For the Quizzes. A lesion turned on by hand is asked about for every disease it goes with.</p>';
      for (const [g, t, all] of s.groups) {
        // Custom boards can't use the diseases that have no board of their own
        const keys = sc === 'custom' ? all.filter(x => !(x[0] === 'e' && dis(x.slice(2)).kind === 'genetic')) : all;
        const k = keys.filter(x => onIn(C, x)).length, gid = `${s.id}.${g}`, gChg = own && keys.some(x => differs(C, x));
        h += `<div class="ct-grp"><div class="ct-gh"><b>${t}${gChg ? DOT : ''}</b><span>${k} of ${keys.length}</span>${gChg ? `<button class="btn mini ct-rev" data-ctrevert="${gid}">Revert</button>` : ''}<button class="btn mini" data-ctall="${gid}" ${k === keys.length ? 'disabled' : ''}>All</button><button class="btn mini" data-ctnone="${gid}" ${k ? '' : 'disabled'}>None</button></div><div class="mchips">${keys.map(x => itemHTML(C, x, own)).join('')}</div></div>`;
      }
    }
    return sc === 'def' ? h : `<div data-ctscope="${sc}">${h}</div>`;
  }
  /* The Advanced section of the Quizzes (start screen and Settings) and of Custom: their own content,
     or the defaults. Closed, it says which; it stays open or closed across redraws. */
  const advOpen = {};
  document.addEventListener('toggle', ev => { const d = ev.target; if (d.matches && d.matches('details.ct-adv')) advOpen[d.dataset.ctscope] = d.open; }, true);
  function advancedHTML(sc, what) {
    const own = SCOPES[sc].get(), n = own ? nDiffs(own) : 0;
    const state = n ? `${n} change${n === 1 ? '' : 's'} from your defaults, for ${sc === 'quiz' ? 'this quiz' : 'these boards'} only` : 'Your defaults (Settings → Content)';
    let h = `<details class="ct-adv" data-ctscope="${sc}" ${advOpen[sc] ? 'open' : ''}><summary><span class="ct-adv-t"><b>Advanced${n ? DOT : ''}</b><span>${state}</span></span></summary><div class="ct-adv-in">`;
    const howLong = sc === 'quiz' ? 'leaving Quizzes puts your defaults back' : 'opening Custom again starts from your defaults';
    h += `<div class="set-row"><div><b>Content for ${what}</b><span>Starts from your defaults in Settings → Content. Anything you change here is for ${sc === 'quiz' ? 'this quiz' : 'boards started from this sheet'} only and is marked with a dot; ${howLong}.</span></div>${n ? '<button class="btn" data-ctrevert="all">Revert all to default</button>' : ''}</div>`;
    return h + bodyHTML('', sc) + '</div></details>';
  }

  const keysOf = sel => { const [s, g] = sel.split('.'); const sec = SECTIONS.find(x => x.id === s); return g ? sec.groups.find(x => x[0] === g)[2] : sec.groups.flatMap(x => x[2]); };

  // clicks on any content control; the scope is the nearest data-ctscope (else the defaults). `redraw`
  // puts the page back
  function click(ev, redraw) {
    const t = ev.target, box = t.closest('[data-ctscope]'), sc = box ? box.dataset.ctscope : 'def', own = sc !== 'def';
    // an override comes into being with its first change: a copy of the defaults
    const C = () => own ? SCOPES[sc].get() || (SCOPES[sc].set(JSON.parse(JSON.stringify(DEF))), SCOPES[sc].get()) : DEF;
    const put = (c, k, on) => own ? setOwn(c, k, on) : set(c, k, on);
    const done = () => (changed(sc), redraw(), true);
    const rv = t.closest('[data-ctrevert]');
    if (rv) {
      const what = rv.dataset.ctrevert, c = SCOPES[sc].get(); if (!c) return true;
      if (what === 'all') SCOPES[sc].set(null);
      else if (what === 'level') c.level = DEF.level;
      else for (const k of keysOf(what)) put(c, k, expected(c, k));
      return done();
    }
    const lv = t.closest('[data-ctlevel]');
    if (lv) { const c = C(); c.level = +lv.dataset.ctlevel; if (!own) for (const k of Object.keys(c.on)) set(c, k, c.on[k]); return done(); }
    const it = t.closest('[data-ct]'); if (it) { const c = C(), k = it.dataset.ct; put(c, k, !onIn(c, k)); return done(); }
    const all = t.closest('[data-ctall]'), none = t.closest('[data-ctnone]');
    if (all || none) { const c = C(); for (const k of keysOf((all || none).dataset[all ? 'ctall' : 'ctnone'])) put(c, k, !!all); return done(); }
    if (t.closest('[data-ctreset]')) { DEF.on = {}; return done(); }
    return false;
  }

  const scope = (name, get, setTo, saveIt) => { SCOPES[name] = { get, set: setTo, save: saveIt }; };
  const use = sc => { active = sc || 'def'; };
  const usingOwn = () => active !== 'def' && !!SCOPES[active].get();

  FC.content = { LEVELS, CORE, defaults: DEF, current: st, isOn, entOn, mkOn, lesOn, linkOn, allow, dis, summary, bodyHTML, advancedHTML, click, scope, use, usingOwn, levelName, allKeys };
})();
