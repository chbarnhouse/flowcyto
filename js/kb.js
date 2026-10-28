/* FlowCyto knowledge base — markers, normal populations and the STEP 1 neoplasms.

   Levels per marker: '-' negative · 'dim' · '+' · 'bright' · 'split' (the population is part
   negative, part positive: CD23 on normal B cells) · 'var' (differs between patients: T-ALL may be
   CD4+CD8+, CD4−CD8− or either alone; each case settles it one way).
   A marker an entity doesn't list is negative.
   Light chains are one compound marker, LC: 'poly' (normal B and plasma cells: some kappa,
   some lambda), 'clonal' (one light chain only; the case picks kappa or lambda), or absent (none).
   Scatter: fsc/ssc are 'low' | 'mid' | 'high'.

   `key`: a neoplasm's hallmark markers; every board shows at least one plot of them, so the
   clone is never named by a shortcut. FSC is drawn but never decides a board (size is trivia here).
   For the puzzle, dim/+/bright all read as positive (except CD45, where dim is its own reading:
   the blast gate); only negative / positive / split matter. Incidental dims that aren't a teaching
   point are left out on purpose, so a board never turns on trivia.
   `excl` lists entities that flow alone can't fairly separate from this one, so the generator
   never puts both in the same board. */
(function () {
  'use strict';

  /* `full`: what the abbreviation stands for, or the marker's common name (the quiz shows it on a
     press and hold, and in its answers). A CD marker without one reads as cluster of differentiation N. */
  const MARKERS = {
    FSC: { name: 'FSC', full: 'forward scatter', note: 'forward scatter: cell size', scatter: true },
    SSC: { name: 'SSC', full: 'side scatter', note: 'side scatter: granularity', scatter: true },
    CD45: { name: 'CD45', full: 'leukocyte common antigen (LCA)', note: 'dim on blasts, absent on plasma cells and RBCs' },
    CD34: { name: 'CD34', note: 'stem cells and blasts' },
    CD117: { name: 'CD117', full: 'c-KIT, the stem cell factor receptor', note: 'myeloid blasts, mast cells' },
    TdT: { name: 'TdT', full: 'terminal deoxynucleotidyl transferase', note: 'immature lymphoid blasts (ALL)' },
    'HLA-DR': { name: 'HLA-DR', full: 'human leukocyte antigen DR (MHC class II)', note: 'B cells, monocytes, most blasts; absent in APL' },
    CD13: { name: 'CD13', full: 'aminopeptidase N', note: 'myeloid' },
    CD33: { name: 'CD33', full: 'Siglec-3', note: 'myeloid' },
    MPO: { name: 'MPO', full: 'myeloperoxidase', note: 'myeloid lineage (cytoplasmic)' },
    CD14: { name: 'CD14', full: 'lipopolysaccharide (LPS) co-receptor', note: 'monocytes' },
    CD64: { name: 'CD64', full: 'Fc gamma receptor I (FcγRI)', note: 'monocytes' },
    CD11b: { name: 'CD11b', full: 'integrin alpha-M (Mac-1)', note: 'maturing myeloid cells' },
    CD15: { name: 'CD15', full: 'Lewis X (SSEA-1)', note: 'granulocytes' },
    CD16: { name: 'CD16', full: 'Fc gamma receptor III (FcγRIII)', note: 'neutrophils, NK cells' },
    CD56: { name: 'CD56', full: 'neural cell adhesion molecule (NCAM)', note: 'NK cells; aberrant on myeloma' },
    CD3: { name: 'CD3', note: 'T cells (cytoplasmic in T-ALL)' },
    CD4: { name: 'CD4', note: 'helper T cells; dim on monocytes' },
    CD8: { name: 'CD8', note: 'cytotoxic T cells' },
    CD7: { name: 'CD7', note: 'pan-T; lost in Sézary and ATLL' },
    CD2: { name: 'CD2', full: 'LFA-2', note: 'pan-T, NK' },
    CD5: { name: 'CD5', note: 'T cells; aberrant on CLL and mantle cell' },
    CD1a: { name: 'CD1a', note: 'cortical thymocytes (T-ALL), Langerhans cells' },
    CD26: { name: 'CD26', full: 'dipeptidyl peptidase-4 (DPP-4)', note: 'lost on Sézary cells' },
    CD19: { name: 'CD19', note: 'B cells from the earliest precursor' },
    CD20: { name: 'CD20', note: 'mature B cells; dim in CLL; target of rituximab' },
    CD22: { name: 'CD22', full: 'Siglec-2', note: 'B cells' },
    CD10: { name: 'CD10', full: 'common acute lymphoblastic leukemia antigen (CALLA)', note: 'germinal center (FL, Burkitt), B-ALL, mature neutrophils' },
    CD23: { name: 'CD23', full: 'low-affinity IgE receptor (FcεRII)', note: 'CLL positive, mantle cell negative' },
    CD200: { name: 'CD200', full: 'OX-2', note: 'CLL bright, mantle cell negative' },
    FMC7: { name: 'FMC7', full: 'an epitope on CD20, named for its antibody clone', note: 'CLL negative, mantle cell positive' },
    CD11c: { name: 'CD11c', full: 'integrin alpha-X', note: 'hairy cell (with CD25, CD103); monocytes' },
    CD25: { name: 'CD25', full: 'interleukin-2 receptor alpha chain (IL-2Rα)', note: 'hairy cell, ATLL' },
    CD103: { name: 'CD103', full: 'integrin alpha-E', note: 'hairy cell' },
    CD38: { name: 'CD38', full: 'cyclic ADP-ribose hydrolase', note: 'plasma cells (bright)' },
    CD138: { name: 'CD138', full: 'syndecan-1', note: 'plasma cells' },
    CD41: { name: 'CD41', full: 'glycoprotein IIb (GpIIb)', note: 'megakaryocytes and platelets' },
    CD61: { name: 'CD61', full: 'glycoprotein IIIa (GpIIIa)', note: 'megakaryocytes and platelets' },
    CD55: { name: 'CD55', full: 'decay-accelerating factor (DAF)', note: 'GPI-anchored; lost in PNH' },
    CD59: { name: 'CD59', full: 'membrane inhibitor of reactive lysis (MIRL), protectin', note: 'GPI-anchored; lost in PNH' },
    LC: { name: 'κ / λ', full: 'kappa and lambda immunoglobulin light chains', note: 'surface light chains: polyclonal (both) or restricted (one = clonal)' },
  };

  /* Curated plots: the pairs a real panel would draw. [x, y]. */
  const PLOTS = [
    ['FSC', 'SSC'], ['CD45', 'SSC'],
    ['CD19', 'CD3'], ['CD4', 'CD8'], ['CD19', 'CD5'], ['CD5', 'CD23'], ['CD23', 'CD200'], ['CD20', 'FMC7'],
    ['CD19', 'CD10'], ['CD11c', 'CD103'], ['CD25', 'CD103'], ['LC', null],
    ['CD34', 'CD117'], ['CD13', 'CD33'], ['CD34', 'HLA-DR'], ['CD14', 'CD64'], ['CD16', 'CD11b'], ['CD15', 'CD16'],
    ['MPO', 'CD34'], ['TdT', 'CD10'], ['TdT', 'CD34'], ['CD7', 'CD3'], ['CD1a', 'CD3'], ['CD7', 'CD26'], ['CD4', 'CD25'],
    ['CD16', 'CD56'], ['CD38', 'CD138'], ['CD19', 'CD56'], ['CD41', 'CD61'], ['CD55', 'CD59'], ['CD2', 'CD7'],
  ];

  const LYM = { fsc: 'low', ssc: 'low' };
  const E = [
    // ---- normal populations ----
    { id: 'tcd4', kind: 'normal', lineage: 'T', name: 'CD4 T cell', long: 'Helper T cell', ...LYM,
      m: { CD45: 'bright', CD3: '+', CD4: '+', CD2: '+', CD5: '+', CD7: '+', CD26: '+', CD55: '+', CD59: '+' },
      teach: 'CD3+ CD4+: helper T cells, normally about twice as many as CD8 T cells.' },
    { id: 'tcd8', kind: 'normal', lineage: 'T', name: 'CD8 T cell', long: 'Cytotoxic T cell', ...LYM,
      m: { CD45: 'bright', CD3: '+', CD8: '+', CD2: '+', CD5: '+', CD7: '+', CD26: '+', CD55: '+', CD59: '+' },
      teach: 'CD3+ CD8+: cytotoxic T cells, MHC I restricted.' },
    { id: 'nk', kind: 'normal', lineage: 'NK', name: 'NK cell', long: 'Natural killer cell', ...LYM,
      m: { CD45: 'bright', CD56: '+', CD16: '+', CD2: '+', CD7: '+', CD8: 'var', CD55: '+', CD59: '+' },
      teach: 'CD3− with CD16+ CD56+: NK cells. CD2 and CD7 too, but never surface CD3.' },
    { id: 'bmat', kind: 'normal', lineage: 'B', name: 'Mature B cell', long: 'Mature B cell (polyclonal)', ...LYM,
      m: { CD45: 'bright', CD19: '+', CD20: '+', CD22: '+', CD23: 'split', CD200: '+', FMC7: 'split', 'HLA-DR': '+', LC: 'poly', CD55: '+', CD59: '+' },
      teach: 'CD19+ CD20+ with both kappa and lambda: normal polyclonal B cells.' },
    { id: 'hgone', kind: 'normal', lineage: 'B', name: 'Hematogone', long: 'Hematogone (normal B precursor)', ...LYM, cont: { late: ['CD20'] },
      m: { CD45: 'dim', CD19: '+', CD10: '+', CD22: 'dim', CD34: 'split', TdT: 'split', CD20: 'split', 'HLA-DR': '+', CD55: '+', CD59: '+' },
      teach: 'Normal B precursors mature as a continuum: TdT and CD34 fade while CD20 appears. A blast clone instead sits as one tight cluster.' },
    { id: 'plasma', kind: 'normal', lineage: 'plasma', name: 'Plasma cell', long: 'Normal plasma cell (polyclonal)', fsc: 'mid', ssc: 'low',
      m: { CD45: 'dim', CD38: 'bright', CD138: '+', CD19: '+', LC: 'poly', CD55: '+', CD59: '+' },
      teach: 'Normal plasma cells: CD38 bright, CD138+, still CD19+, CD56−, and polyclonal.' },
    { id: 'mono', kind: 'normal', lineage: 'myeloid', name: 'Monocyte', long: 'Monocyte', fsc: 'mid', ssc: 'mid', excl: ['amol'],
      m: { CD45: '+', CD14: 'bright', CD64: '+', CD33: 'bright', CD13: '+', CD11b: '+', CD11c: '+', 'HLA-DR': '+', CD4: 'dim', CD55: '+', CD59: '+' },
      teach: 'Intermediate scatter, CD14+ CD64+ HLA-DR+: monocytes (and they carry dim CD4).' },
    { id: 'neut', kind: 'normal', lineage: 'myeloid', name: 'Neutrophil', long: 'Neutrophil', fsc: 'mid', ssc: 'high',
      m: { CD45: '+', CD13: '+', CD33: 'dim', CD15: 'bright', CD16: 'bright', CD11b: '+', CD11c: '+', CD10: '+', MPO: 'bright', CD55: '+', CD59: '+' },
      teach: 'High side scatter, CD15+ CD16+ CD11b+, HLA-DR−: mature neutrophils (and they are CD10+).' },

    // ---- neoplasms ----
    { id: 'cll', kind: 'neoplasm', aliases: ['CLL', 'SLL', 'CLL/SLL', 'chronic lymphocytic leukemia', 'small lymphocytic lymphoma', 'B-CLL'], key: ['CD5', 'CD23', 'CD200'], lineage: 'B', name: 'CLL / SLL', long: 'Chronic lymphocytic leukemia / small lymphocytic lymphoma', ...LYM,
      m: { CD45: 'bright', CD19: '+', CD20: 'dim', CD22: 'dim', CD5: '+', CD23: '+', CD200: 'bright', 'HLA-DR': '+', LC: 'clonal', CD55: '+', CD59: '+' },
      teach: 'CLL/SLL: a B clone with CD5+ CD23+ CD200+, dim CD20 and FMC7−. Smudge cells; the most common adult leukemia; warm AIHA.' },
    { id: 'mcl', kind: 'neoplasm', aliases: ['MCL', 'mantle cell', 'mantle cell lymphoma'], key: ['CD5', 'CD23', 'FMC7'], lineage: 'B', name: 'Mantle cell lymphoma', long: 'Mantle cell lymphoma', ...LYM,
      m: { CD45: 'bright', CD19: '+', CD20: '+', CD22: '+', CD5: '+', FMC7: '+', 'HLA-DR': '+', LC: 'clonal', CD55: '+', CD59: '+' },
      teach: 'Mantle cell: CD5+ like CLL, but CD23− CD200− FMC7+. t(11;14) puts cyclin D1 next to the IgH promoter.' },
    { id: 'fl', kind: 'neoplasm', aliases: ['FL', 'follicular', 'follicular lymphoma'], key: ['CD10', 'CD5'], lineage: 'B', name: 'Follicular lymphoma', long: 'Follicular lymphoma', ...LYM, excl: ['burkitt'],
      m: { CD45: 'bright', CD19: '+', CD20: '+', CD22: '+', CD10: '+', 'HLA-DR': '+', LC: 'clonal', CD55: '+', CD59: '+' },
      teach: 'Follicular lymphoma: germinal-center B clone, CD10+ CD5−. t(14;18) overexpresses BCL2 (blocks apoptosis).' },
    { id: 'burkitt', kind: 'neoplasm', aliases: ['Burkitt', 'Burkitts', 'Burkitt lymphoma', 'BL'], key: ['CD10', 'TdT'], lineage: 'B', name: 'Burkitt lymphoma', long: 'Burkitt lymphoma', fsc: 'mid', ssc: 'low', excl: ['fl'],
      m: { CD45: '+', CD19: '+', CD20: '+', CD22: '+', CD10: '+', 'HLA-DR': '+', LC: 'clonal', CD55: '+', CD59: '+' },
      teach: 'Burkitt: mature B clone, CD10+ but TdT− (not a blast). t(8;14) MYC; starry sky; jaw (endemic, EBV) or abdomen.' },
    { id: 'hcl', kind: 'neoplasm', aliases: ['HCL', 'hairy cell', 'hairy cell leukemia'], key: ['CD11c', 'CD25', 'CD103'], lineage: 'B', name: 'Hairy cell leukemia', long: 'Hairy cell leukemia', fsc: 'mid', ssc: 'low',
      m: { CD45: 'bright', CD19: '+', CD20: 'bright', CD22: 'bright', CD11c: 'bright', CD25: '+', CD103: '+', CD200: 'bright', FMC7: '+', 'HLA-DR': '+', LC: 'clonal', CD55: '+', CD59: '+' },
      teach: 'Hairy cell: B clone with CD11c, CD25 and CD103 (plus annexin A1). TRAP+, BRAF V600E, dry tap, massive spleen; cladribine.' },
    { id: 'mzl', kind: 'neoplasm', aliases: ['MZL', 'marginal zone', 'marginal zone lymphoma', 'MALT', 'MALToma', 'MALT lymphoma'], key: ['LC', 'CD5', 'CD10'], lineage: 'B', name: 'Marginal zone lymphoma', long: 'Marginal zone lymphoma', ...LYM,
      m: { CD45: 'bright', CD19: '+', CD20: '+', CD22: '+', CD11c: 'var', 'HLA-DR': '+', LC: 'clonal', CD55: '+', CD59: '+' },
      teach: 'Marginal zone: a restricted B clone that is CD5− CD10− CD103−: the small B-cell lymphoma left by exclusion. MALT type follows H. pylori.' },
    { id: 'ball', kind: 'neoplasm', aliases: ['B-ALL', 'B ALL', 'pre-B ALL', 'B-cell ALL', 'B lymphoblastic leukemia', 'B-lymphoblastic leukemia', 'ALL'], key: ['TdT', 'CD34', 'CD10'], lineage: 'B', name: 'B-ALL', long: 'B-lymphoblastic leukemia', ...LYM, excl: ['hgone'],
      m: { CD45: 'dim', CD19: '+', CD10: '+', CD34: '+', TdT: '+', CD22: '+', 'HLA-DR': '+', CD55: '+', CD59: '+' },
      teach: 'B-ALL: TdT+ CD34+ CD10+ CD19+ blasts with no surface light chain. Children; t(12;21) does well, t(9;22) does badly.' },
    { id: 'tall', kind: 'neoplasm', aliases: ['T-ALL', 'T ALL', 'T-cell ALL', 'T lymphoblastic leukemia', 'T-lymphoblastic leukemia', 'T-LBL', 'T lymphoblastic lymphoma'], key: ['TdT', 'CD7', 'CD3'], lineage: 'T', name: 'T-ALL', long: 'T-lymphoblastic leukemia', ...LYM,
      m: { CD45: 'dim', CD3: '+', CD7: '+', CD2: '+', CD5: '+', CD1a: 'var', CD4: 'var', CD8: 'var', TdT: '+', CD34: 'var', CD55: '+', CD59: '+' },
      teach: 'T-ALL: TdT+ CD7+ cytoplasmic CD3+, often CD4+ CD8+ together and CD1a+ (cortical thymocyte). Mediastinal mass in a teenager.' },
    { id: 'aml', kind: 'neoplasm', aliases: ['AML', 'acute myeloid leukemia', 'acute myelogenous leukemia', 'acute myeloblastic leukemia'], key: ['CD117', 'MPO', 'CD13', 'CD33'], lineage: 'myeloid', name: 'AML', long: 'Acute myeloid leukemia', fsc: 'mid', ssc: 'low',
      m: { CD45: 'dim', CD34: 'var', CD117: '+', CD13: '+', CD33: '+', 'HLA-DR': '+', MPO: '+', CD55: '+', CD59: '+' },
      teach: 'AML: CD34+ CD117+ CD13+ CD33+ MPO+ blasts with dim CD45 and low SSC. Auer rods; 20% blasts or more.' },
    { id: 'apl', kind: 'neoplasm', aliases: ['APL', 'M3', 'AML M3', 'AML-M3', 'acute promyelocytic leukemia', 'promyelocytic leukemia'], key: ['HLA-DR', 'CD34', 'CD117'], lineage: 'myeloid', name: 'APL (AML-M3)', long: 'Acute promyelocytic leukemia', fsc: 'mid', ssc: 'high',
      m: { CD45: 'dim', CD117: '+', CD13: '+', CD33: 'bright', MPO: 'bright', CD55: '+', CD59: '+' },
      teach: 'APL: high SSC with CD34− HLA-DR− and bright CD33/MPO. t(15;17) PML-RARA; DIC; all-trans retinoic acid.' },
    { id: 'amol', kind: 'neoplasm', aliases: ['M5', 'AML M5', 'AML-M5', 'acute monocytic leukemia', 'monocytic leukemia', 'acute monoblastic leukemia'], key: ['CD14', 'CD64'], lineage: 'myeloid', name: 'Acute monocytic leukemia', long: 'Acute monocytic leukemia (AML-M5)', fsc: 'mid', ssc: 'mid', excl: ['mono'],
      m: { CD45: '+', CD64: '+', CD33: 'bright', CD13: 'dim', CD11b: '+', CD11c: '+', CD14: 'var', CD56: 'var', 'HLA-DR': '+', CD4: 'dim', CD55: '+', CD59: '+' },
      teach: 'Acute monocytic (M5): CD64+ CD11b+ CD33 bright, CD34−, CD14 partial. Gum and skin infiltration.' },
    { id: 'amkl', kind: 'neoplasm', aliases: ['M7', 'AML M7', 'AML-M7', 'AMKL', 'acute megakaryoblastic leukemia', 'megakaryoblastic leukemia'], key: ['CD41', 'CD61'], lineage: 'myeloid', name: 'Megakaryoblastic AML', long: 'Acute megakaryoblastic leukemia (AML-M7)', fsc: 'mid', ssc: 'low',
      m: { CD45: 'dim', CD41: '+', CD61: '+', CD34: 'var', CD33: 'var', CD55: '+', CD59: '+' },
      teach: 'Megakaryoblastic (M7): CD41+ CD61+ blasts, MPO−. Children with Down syndrome, under 5.' },
    { id: 'mm', kind: 'neoplasm', aliases: ['MM', 'myeloma', 'multiple myeloma', 'plasma cell myeloma'], key: ['CD38', 'CD138', 'CD56', 'CD19'], lineage: 'plasma', name: 'Multiple myeloma', long: 'Plasma cell myeloma', fsc: 'mid', ssc: 'low',
      m: { CD38: 'bright', CD138: '+', CD56: 'var', LC: 'clonal', CD55: '+', CD59: '+' },
      teach: 'Myeloma: CD38+ CD138+ plasma cells that have lost CD19 and CD45, gained CD56, and make one light chain. CRAB; M spike.' },
    { id: 'sezary', kind: 'neoplasm', aliases: ['Sezary', 'Sézary', 'Sezary syndrome', 'mycosis fungoides', 'MF', 'CTCL', 'cutaneous T-cell lymphoma'], key: ['CD7', 'CD26'], lineage: 'T', name: 'Sézary / mycosis fungoides', long: 'Mycosis fungoides / Sézary syndrome', ...LYM,
      m: { CD45: 'bright', CD3: '+', CD4: '+', CD2: '+', CD5: '+', CD55: '+', CD59: '+' },
      teach: 'Sézary / mycosis fungoides: CD4+ T cells that have lost CD7 and CD26. Cerebriform nuclei; Pautrier microabscesses.' },
    { id: 'atll', kind: 'neoplasm', aliases: ['ATLL', 'ATL', 'adult T-cell leukemia', 'adult T-cell lymphoma', 'adult T-cell leukemia/lymphoma', 'HTLV-1 leukemia'], key: ['CD25', 'CD7'], lineage: 'T', name: 'ATLL', long: 'Adult T-cell leukemia/lymphoma', ...LYM,
      m: { CD45: 'bright', CD3: '+', CD4: '+', CD25: 'bright', CD2: '+', CD5: '+', CD55: '+', CD59: '+' },
      teach: 'ATLL: CD4+ CD25 bright, CD7−. HTLV-1 (Japan, Caribbean); flower cells, hypercalcemia, lytic bone lesions.' },
    { id: 'pnh', kind: 'neoplasm', aliases: ['PNH', 'paroxysmal nocturnal hemoglobinuria', 'PNH clone'], key: ['CD55', 'CD59'], lineage: 'myeloid', name: 'PNH clone', long: 'Paroxysmal nocturnal hemoglobinuria clone', fsc: 'mid', ssc: 'high',
      m: { CD45: '+', CD13: '+', CD33: 'dim', CD15: 'bright', CD16: 'dim', CD11b: '+', CD11c: '+', CD10: '+', MPO: 'bright' },
      teach: 'PNH: PIGA mutation, so no GPI anchors: granulocytes and RBCs lack CD55 and CD59 (FLAER−) and complement lyses them. Thrombosis; eculizumab.' },
  ];
  const BY = Object.fromEntries(E.map(e => [e.id, e]));
  /* The scratchpad's "Abnormal (clone)" choice: any population can be it (it is the one that fits no
     normal cell type on offer); the diagnosis step then names it. Not part of the catalog. */
  BY.abn = { id: 'abn', kind: 'pseudo', lineage: 'none', name: 'Abnormal (clone)', long: 'The abnormal population (the clone)', fsc: 'mid', ssc: 'low', m: {}, teach: 'The population that fits no normal cell type on offer: the diagnosis step names it.' };

  /* Specimens: which normal populations sit in the background, and which clones fit them. */
  const SPECIMENS = [
    { id: 'blood-b', name: 'Peripheral blood, lymphocytosis', normals: ['tcd4', 'tcd8', 'nk', 'bmat', 'mono', 'neut'], clones: ['cll', 'mcl', 'fl', 'hcl', 'mzl', 'burkitt'] },
    { id: 'blood-t', name: 'Peripheral blood, atypical T cells', normals: ['tcd4', 'tcd8', 'nk', 'bmat', 'mono', 'neut'], clones: ['sezary', 'atll'] },
    { id: 'marrow-acute', name: 'Bone marrow, suspected acute leukemia', normals: ['neut', 'mono', 'tcd4', 'tcd8', 'bmat', 'hgone'], clones: ['aml', 'apl', 'ball', 'tall', 'amkl', 'amol'] },
    { id: 'marrow-plasma', name: 'Bone marrow, M spike', normals: ['neut', 'mono', 'tcd4', 'tcd8', 'bmat', 'plasma'], clones: ['mm'] },
    { id: 'blood-pnh', name: 'Peripheral blood, hemolysis', normals: ['neut', 'mono', 'tcd4', 'tcd8', 'bmat'], clones: ['pnh'] },
  ];

  /* What a reader sees for a marker: 'neg' | 'pos' | 'split'. LC: 'none' | 'poly' | 'kappa' | 'lambda'. */
  function readClass(level, mk) {
    if (!level || level === '-') return 'neg';
    if (level === 'var') return 'var';
    if (mk === 'CD45' && level === 'dim') return 'dim';
    if (level === 'split') return 'split';
    return 'pos';
  }

  const FC = { MARKERS, PLOTS, ENTITIES: E, BY, SPECIMENS, readClass };
  if (typeof module !== 'undefined') module.exports = FC; else window.FC = Object.assign(window.FC || {}, FC);
})();
