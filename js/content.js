/* FlowCyto content: which cell types, diseases, markers and genetic lesions the app draws on. Boards,
   the Quizzes and the master reference all read it; a board in progress keeps what it started with.
   Two filters that stack: a level (Step 1 · Step 2 CK · Step 3 · residency · heme fellowship; each
   includes the ones before it), then any item turned on or off by hand, singly or a whole group at a
   time. An item is on when its own switch says so, else when its level is within the chosen one.
   Scatter and CD45 always stay on: every board is gated on them. Saved in localStorage
   (flowcyto.content). Shown as the Content tab of Settings. */
(function () {
  'use strict';
  const FC = window.FC;
  const { MARKERS, MGROUPS, ENTITIES, BY, GENETICS: G } = FC;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = (k, d) => { try { return Object.assign(d, JSON.parse(localStorage.getItem(k) || 'null') || {}); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } };

  const LEVELS = [[1, 'Step 1', 'Step 1'], [2, 'Step 2 CK', 'Step 2'], [3, 'Step 3', 'Step 3'], [4, 'Residency', 'Residency'], [5, 'Heme fellowship', 'Fellowship']];
  const CORE = ['FSC', 'SSC', 'CD45'];
  const C = load('flowcyto.content', { level: 1, on: {} });

  // ---------- the catalog, keyed e: (cell types and diseases), m: (markers), g: (genetic lesions) ----------
  const dis = id => BY[id] || G.DIS_BY[id];
  const linkLvl = id => Math.min(...G.LINKS.filter(l => l[1] === id).map(l => l[2]));
  const lvlOf = key => {
    const [t, id] = key.split(/:(.*)/);
    return t === 'e' ? dis(id).lvl || 1 : t === 'm' ? MARKERS[id].lvl || 1 : linkLvl(id);
  };
  const isOn = key => key in C.on ? C.on[key] : lvlOf(key) <= C.level;
  const entOn = id => isOn('e:' + id);
  const mkOn = mk => CORE.includes(mk) || isOn('m:' + mk);
  const lesOn = id => isOn('g:' + id);
  // a link counts when its disease and lesion are on and it's within the level, or its lesion was turned on by hand
  const linkOn = ([d, l, lv]) => entOn(d) && lesOn(l) && (lv <= C.level || C.on['g:' + l] === true);
  const allow = () => ({ ents: ENTITIES.filter(e => entOn(e.id)).map(e => e.id), mks: Object.keys(MARKERS).filter(mkOn) });

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

  function set(key, on) { if (on === (lvlOf(key) <= C.level)) delete C.on[key]; else C.on[key] = on; }
  function changed() { save('flowcyto.content', C); if (FC.onContent) FC.onContent(); }

  // ---------- the page ----------
  const ICON = {
    check: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const levelName = n => LEVELS.find(l => l[0] === n)[1];
  const counts = () => SECTIONS.map(s => { const ks = s.groups.flatMap(g => g[2]); return [ks.filter(isOn).length, ks.length]; });
  // for Settings: "Step 1 · 31 of 39 cell types and diseases · …"
  function summary() {
    const [e, m, g] = counts(), hand = Object.keys(C.on).length;
    return `${levelName(C.level)}${hand ? ` plus ${hand} change${hand === 1 ? '' : 's'} by hand` : ''} · ${e[0]} of ${e[1]} cell types and diseases · ${m[0]} of ${m[1]} markers · ${g[0]} of ${g[1]} lesions`;
  }
  /* The level as a track of stops: every stop up to the chosen one is filled (it's included), the chosen
     one is ringed with a check, the ones past it are hollow. Shape and fill carry it, not color. */
  const levelTrack = () => `<div class="ct-track" role="radiogroup" aria-label="Level" style="--n:${LEVELS.length};--at:${C.level - 1}">${LEVELS.map(([n, long, short]) =>
    `<button role="radio" data-ctlevel="${n}" aria-checked="${C.level === n}" aria-label="${long}" class="${n <= C.level ? 'in' : ''}"><span class="dot">${C.level === n ? ICON.check : ''}</span><span class="lbl">${short}</span></button>`).join('')}</div>`;
  const levelWords = () => C.level === 1 ? 'Step 1 material only.' : `Everything from Step 1 through ${levelName(C.level).replace('Heme fellowship', 'heme fellowship').replace('Residency', 'residency')}.`;
  // a clone that reads like a normal cell on the markers that are on: says which markers would bring it back
  function offBoards() {
    if (!FC.lookalikes) return '';
    const a = allow(), out = [];
    for (const e of ENTITIES.filter(e => e.kind === 'neoplasm' && entOn(e.id))) {
      const l = FC.lookalikes(e.id, a);
      if (l.like.length) out.push(`<b>${esc(e.name)}</b> reads like ${l.like.map(id => esc(BY[id].name)).join(' and ')}${l.need.length ? `; ${l.need.map(mk => esc(MARKERS[mk].name)).join(' or ')} would tell them apart` : ''}`);
    }
    return out.length ? `<p class="ct-note">Not on boards (quizzes still ask about them): ${out.join('. ')}.</p>` : '';
  }
  function itemHTML(key) {
    const on = isOn(key), lv = lvlOf(key), d = key[0] === 'e' ? dis(key.slice(2)) : null;
    const tags = [lv > 1 ? levelName(lv) : '', d && d.kind === 'genetic' ? 'quiz only' : ''].filter(Boolean);
    return `<button class="mchip ct" data-ct="${esc(key)}" aria-pressed="${on}">${on ? ICON.check : '<span class="ic"></span>'}<span>${esc(nameOf(key))}</span>${tags.map(t => `<small class="ct-tag">${t}</small>`).join('')}</button>`;
  }
  // the Content tab: level, anything set by hand, `extra` (the Quizzes' cell types), then the lists
  function bodyHTML(extra = '') {
    let h = `<div class="set-row ct-level"><div><b>Level</b><span>For boards, quizzes and the master reference. ${levelWords()} Anything beyond Step 1 is tagged with its level. A board you're in the middle of keeps what it started with.</span></div>${levelTrack()}</div>`;
    const hand = Object.keys(C.on).length;
    h += extra;
    if (hand) h += `<div class="set-row"><div><b>${hand} change${hand === 1 ? '' : 's'} by hand</b><span>Items you turned on or off yourself, whatever the level says.</span></div><button class="btn" data-ctreset>Match the level</button></div>`;
    for (const s of SECTIONS) {
      const ks = s.groups.flatMap(g => g[2]), n = ks.filter(isOn).length;
      h += `<div class="ct-sec"><h3 class="set-sec">${s.title} <span>${n} of ${ks.length}</span></h3><span class="ct-btns"><button class="btn mini" data-ctall="${s.id}">All on</button><button class="btn mini" data-ctnone="${s.id}">All off</button></span></div>`;
      if (s.id === 'e') h += offBoards();
      if (s.id === 'm') h += '<p class="help">Scatter and CD45 always stay on: every board is gated on them. A plot shows only when both its markers are on.</p>';
      if (s.id === 'g') h += '<p class="help">For the Quizzes. A lesion turned on by hand is asked about for every disease it goes with.</p>';
      for (const [g, t, keys] of s.groups) {
        const k = keys.filter(isOn).length, gid = `${s.id}.${g}`;
        h += `<div class="ct-grp"><div class="ct-gh"><b>${t}</b><span>${k} of ${keys.length}</span><button class="btn mini" data-ctall="${gid}" ${k === keys.length ? 'disabled' : ''}>All</button><button class="btn mini" data-ctnone="${gid}" ${k ? '' : 'disabled'}>None</button></div><div class="mchips">${keys.map(itemHTML).join('')}</div></div>`;
      }
    }
    return h;
  }
  const keysOf = sel => { const [s, g] = sel.split('.'); const sec = SECTIONS.find(x => x.id === s); return g ? sec.groups.find(x => x[0] === g)[2] : sec.groups.flatMap(x => x[2]); };

  // clicks on the page (it lives in the Settings dialog); `redraw` puts the page back, keeping the scroll
  function click(ev, redraw) {
    const t = ev.target;
    const lv = t.closest('[data-ctlevel]'); if (lv) { C.level = +lv.dataset.ctlevel; for (const k of Object.keys(C.on)) set(k, C.on[k]); changed(); return redraw(), true; }
    const it = t.closest('[data-ct]'); if (it) { const k = it.dataset.ct; set(k, !isOn(k)); changed(); return redraw(), true; }
    const all = t.closest('[data-ctall]'), none = t.closest('[data-ctnone]');
    if (all || none) { for (const k of keysOf((all || none).dataset[all ? 'ctall' : 'ctnone'])) set(k, !!all); changed(); return redraw(), true; }
    if (t.closest('[data-ctreset]')) { C.on = {}; changed(); return redraw(), true; }
    return false;
  }

  FC.content = { LEVELS, CORE, state: C, isOn, entOn, mkOn, lesOn, linkOn, allow, dis, summary, bodyHTML, click, levelName, allKeys };
})();
