/* FlowCyto genetics: the translocations and mutations that go with each malignancy, for the Quizzes.

   LESIONS: one per lesion. `name` is how it's written, `full` what it does, `aliases` what a typed
   answer may call it (genes, fusion partners, the bare "11;14"). `grp` is where the Content settings
   list it. `noNeg`: found in many cancers, so "X doesn't have it" is never asked (del(17p), FLT3-ITD…).
   DISEASES: malignancies with no flow board of their own (CML, the MPNs, DLBCL…). The flow neoplasms
   in kb.js are diseases here too, under their own ids.
   LINKS: [disease, lesion, lvl]. The level is the link's, since one lesion can be Step 1 for one
   disease and residency for another: t(11;14) in mantle cell vs myeloma.
   RARE: a disease and a lesion that do meet, but not classically: never asked either way. */
(function () {
  'use strict';
  const FC = window.FC;

  const LESIONS = {
    t1114: { name: 't(11;14)', full: 'CCND1–IGH: cyclin D1 driven by the IgH promoter', grp: 'b', aliases: ['11;14', 'CCND1-IGH', 'IGH-CCND1', 'CCND1', 'cyclin D1', 'BCL1'] },
    t1418: { name: 't(14;18)', full: 'IGH–BCL2: BCL2 overexpressed, so apoptosis is blocked', grp: 'b', aliases: ['14;18', 'IGH-BCL2', 'BCL2-IGH', 'BCL2'] },
    t814: { name: 't(8;14)', full: 'MYC–IGH: c-MYC driven by the IgH promoter', grp: 'b', aliases: ['8;14', 'MYC-IGH', 'IGH-MYC', 'MYC', 'c-MYC'] },
    t1118: { name: 't(11;18)', full: 'BIRC3–MALT1 (API2–MALT1): NF-κB switched on; no longer needs H. pylori', grp: 'b', aliases: ['11;18', 'BIRC3-MALT1', 'API2-MALT1', 'MALT1'] },
    braf: { name: 'BRAF V600E', full: 'activating BRAF kinase mutation (MAPK pathway)', grp: 'b', aliases: ['BRAF', 'V600E'] },
    myd88: { name: 'MYD88 L265P', full: 'activating MYD88 mutation (NF-κB)', grp: 'b', aliases: ['MYD88', 'L265P'] },
    bcl6: { name: 'BCL6 rearrangement', full: '3q27: BCL6 overexpressed', grp: 'b', aliases: ['BCL6', '3q27'] },
    del13q: { name: 'del(13q14)', full: 'miR-15a/16-1 lost: the most common CLL lesion, best prognosis', grp: 'b', aliases: ['13q', 'del13q', '13q deletion', '13q14'] },
    tri12: { name: 'Trisomy 12', full: 'intermediate prognosis in CLL', grp: 'b', noNeg: true, aliases: ['+12', 'trisomy12'] },
    del17p: { name: 'del(17p)', full: 'TP53 lost: poor prognosis, resists chemotherapy', grp: 'b', noNeg: true, aliases: ['17p', 'del17p', '17p deletion', 'TP53', 'p53'] },
    t1221: { name: 't(12;21)', full: 'ETV6–RUNX1 (TEL–AML1): good prognosis', grp: 'b', aliases: ['12;21', 'ETV6-RUNX1', 'TEL-AML1'] },
    hyperdip: { name: 'Hyperdiploidy', full: 'more than 50 chromosomes: good prognosis in B-ALL', grp: 'b', noNeg: true, aliases: ['hyperdiploid', 'high hyperdiploidy'] },
    kmt2a: { name: 'KMT2A rearrangement', full: '11q23 (MLL), as t(4;11) in infant B-ALL: poor prognosis', grp: 'b', noNeg: true, aliases: ['KMT2A', 'MLL', '11q23', 't(4;11)', '4;11', 'MLL rearrangement'] },
    t922: { name: 't(9;22)', full: 'BCR–ABL1, the Philadelphia chromosome: a tyrosine kinase that is always on (imatinib)', grp: 'myeloid', aliases: ['9;22', 'BCR-ABL', 'BCR-ABL1', 'Philadelphia chromosome', 'Philadelphia', 'Ph', 'Ph+'] },
    t414: { name: 't(4;14)', full: 'FGFR3 and NSD2 (MMSET) driven by IgH: higher risk', grp: 'plasma', aliases: ['4;14', 'FGFR3', 'MMSET', 'NSD2'] },
    notch1: { name: 'NOTCH1', full: 'activating NOTCH1 mutation', grp: 't', noNeg: true, aliases: ['NOTCH'] },
    t25: { name: 't(2;5)', full: 'NPM1–ALK: an ALK fusion kinase (crizotinib)', grp: 't', aliases: ['2;5', 'NPM-ALK', 'NPM1-ALK', 'ALK'] },
    stat3: { name: 'STAT3', full: 'activating STAT3 mutation', grp: 't', noNeg: true, aliases: [] },
    t1517: { name: 't(15;17)', full: 'PML–RARA: maturation block; all-trans retinoic acid and arsenic', grp: 'myeloid', aliases: ['15;17', 'PML-RARA', 'PML-RARα', 'RARA', 'RARα'] },
    t821: { name: 't(8;21)', full: 'RUNX1–RUNX1T1 (AML1–ETO): good prognosis', grp: 'myeloid', aliases: ['8;21', 'RUNX1-RUNX1T1', 'AML1-ETO'] },
    inv16: { name: 'inv(16)', full: 'CBFB–MYH11: good prognosis; abnormal eosinophils', grp: 'myeloid', aliases: ['inv16', 'inversion 16', 't(16;16)', '16;16', 'CBFB-MYH11'] },
    npm1: { name: 'NPM1 mutation', full: 'good prognosis without FLT3-ITD', grp: 'myeloid', aliases: ['NPM1', 'nucleophosmin'] },
    flt3: { name: 'FLT3-ITD', full: 'internal tandem duplication: poor prognosis', grp: 'myeloid', noNeg: true, aliases: ['FLT3', 'FLT3 ITD'] },
    gata1: { name: 'GATA1', full: 'mutated in the leukemia of Down syndrome', grp: 'myeloid', aliases: [] },
    jak2: { name: 'JAK2 V617F', full: 'JAK–STAT signaling always on', grp: 'myeloid', aliases: ['JAK2', 'V617F'] },
    calr: { name: 'CALR', full: 'calreticulin, exon 9 frameshift', grp: 'myeloid', aliases: ['calreticulin'] },
    mpl: { name: 'MPL', full: 'thrombopoietin receptor (W515)', grp: 'myeloid', aliases: ['MPL W515', 'thrombopoietin receptor'] },
    kit: { name: 'KIT D816V', full: 'activating c-KIT mutation', grp: 'myeloid', aliases: ['KIT', 'c-KIT', 'D816V'] },
    del5q: { name: 'del(5q)', full: 'isolated: responds to lenalidomide', grp: 'myeloid', aliases: ['5q', 'del5q', '5q-', '5q minus', '5q deletion'] },
    fip1l1: { name: 'FIP1L1–PDGFRA', full: 'cryptic 4q12 deletion: responds to imatinib', grp: 'myeloid', aliases: ['FIP1L1', 'PDGFRA', 'FIP1L1-PDGFRA'] },
    piga: { name: 'PIGA', full: 'acquired X-linked mutation: no GPI anchors', grp: 'myeloid', aliases: ['PIG-A'] },
  };

  // malignancies with no board of their own; `lvl` as in kb.js
  const DISEASES = [
    { id: 'cml', lineage: 'myeloid', name: 'CML', long: 'Chronic myeloid leukemia', aliases: ['chronic myelogenous leukemia'] },
    { id: 'pv', lineage: 'myeloid', name: 'Polycythemia vera', long: 'Polycythemia vera', aliases: ['PV'] },
    { id: 'et', lineage: 'myeloid', name: 'Essential thrombocythemia', long: 'Essential thrombocythemia', aliases: ['ET', 'essential thrombocytosis'] },
    { id: 'pmf', lineage: 'myeloid', name: 'Primary myelofibrosis', long: 'Primary myelofibrosis', aliases: ['PMF', 'myelofibrosis'] },
    { id: 'sm', lvl: 2, lineage: 'myeloid', name: 'Systemic mastocytosis', long: 'Systemic mastocytosis', aliases: ['SM', 'mastocytosis'] },
    { id: 'mds5q', lvl: 2, lineage: 'myeloid', name: 'MDS with del(5q)', long: 'Myelodysplastic syndrome with isolated del(5q)', aliases: ['5q minus syndrome', '5q syndrome'] },
    { id: 'meo', lvl: 5, lineage: 'myeloid', name: 'Myeloid neoplasm with eosinophilia', long: 'Myeloid/lymphoid neoplasm with eosinophilia and PDGFRA rearrangement', aliases: ['CEL', 'chronic eosinophilic leukemia', 'hypereosinophilic syndrome', 'HES'] },
    { id: 'lch', lvl: 2, lineage: 'myeloid', name: 'Langerhans cell histiocytosis', long: 'Langerhans cell histiocytosis', aliases: ['LCH', 'histiocytosis X'] },
    { id: 'dlbcl', lineage: 'B', name: 'DLBCL', long: 'Diffuse large B-cell lymphoma', aliases: ['diffuse large B cell lymphoma'] },
    { id: 'wm', lineage: 'B', name: 'Waldenström macroglobulinemia', long: 'Lymphoplasmacytic lymphoma (Waldenström macroglobulinemia)', aliases: ['WM', 'LPL', 'lymphoplasmacytic lymphoma', 'Waldenstrom'] },
    { id: 'alcl', lvl: 2, lineage: 'T', name: 'ALCL', long: 'Anaplastic large cell lymphoma', aliases: ['ALK+ ALCL', 'anaplastic large cell lymphoma'] },
    { id: 'tlgl', lvl: 4, lineage: 'T', name: 'T-LGL leukemia', long: 'T-cell large granular lymphocytic leukemia', aliases: ['LGL', 'T-LGL', 'large granular lymphocytic leukemia'] },
  ];
  for (const d of DISEASES) d.kind = 'genetic';

  const LINKS = [
    ['mcl', 't1114', 1], ['mm', 't1114', 4],
    ['fl', 't1418', 1], ['dlbcl', 't1418', 4],
    ['burkitt', 't814', 1],
    ['mzl', 't1118', 1],
    ['hcl', 'braf', 1], ['lch', 'braf', 4],
    ['wm', 'myd88', 4],
    ['dlbcl', 'bcl6', 4],
    ['cll', 'del13q', 4], ['cll', 'tri12', 5], ['cll', 'del17p', 4], ['mm', 'del17p', 4],
    ['ball', 't1221', 1], ['ball', 't922', 1], ['ball', 'hyperdip', 4], ['ball', 'kmt2a', 4], ['amol', 'kmt2a', 5],
    ['cml', 't922', 1],
    ['mm', 't414', 5],
    ['tall', 'notch1', 5],
    ['alcl', 't25', 2],
    ['tlgl', 'stat3', 5],
    ['apl', 't1517', 1],
    ['aml', 't821', 4], ['aml', 'inv16', 4], ['aml', 'npm1', 4], ['aml', 'flt3', 4],
    ['amkl', 'gata1', 5],
    ['pv', 'jak2', 1], ['et', 'jak2', 1], ['pmf', 'jak2', 1], ['et', 'calr', 4], ['pmf', 'calr', 4], ['et', 'mpl', 4], ['pmf', 'mpl', 4],
    ['sm', 'kit', 2],
    ['mds5q', 'del5q', 2],
    ['meo', 'fip1l1', 5],
    ['pnh', 'piga', 1],
  ];
  // they do meet, just not classically: never asked either way
  const RARE = [['dlbcl', 't814'], ['dlbcl', 'myd88'], ['mm', 't814'], ['mm', 'del13q'], ['mcl', 'del13q'], ['aml', 'kit'], ['aml', 't922'], ['aml', 'kmt2a'], ['fl', 'bcl6'], ['mds5q', 'jak2'], ['amol', 't821'], ['cml', 'jak2'],
    ['amol', 'npm1'], ['amol', 'inv16'], ['amol', 'kit'], ['mzl', 'myd88'], ['aml', 'del5q'],
    // APL and the leukemia of Down syndrome are kinds of AML: "AML doesn't have t(15;17)" would be wrong
    ['aml', 't1517'], ['aml', 'gata1']];

  for (const [id, l] of Object.entries(LESIONS)) l.id = id;
  const DIS_BY = Object.fromEntries(DISEASES.map(d => [d.id, d]));
  FC.GENETICS = { LESIONS, DISEASES, DIS_BY, LINKS, RARE };
})();
