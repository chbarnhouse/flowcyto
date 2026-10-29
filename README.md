# FlowCyto

A flow cytometry logic puzzle for STEP 1, a companion to Step 1 Pathways. Read the dot plots, name the populations, and find the clone. Every board is generated and has exactly one answer that logic can reach.

**How a board plays:** first the **scratchpad**: give every population in the tube an identity (normal cell types, plus "Abnormal (clone)"; no identity is used twice). Then the **diagnosis**: name the clone. The **reference** lists each cell type's markers.

**Levels:**
- **Easy:** just the plots and cell types you need; reference filled in; diagnosis from 4.
- **Medium:** extra plots and absent cell types; reference filled in; diagnosis from 4.
- **Hard:** you fill in the reference; diagnosis from every neoplasm.
- **Expert:** no labels: you place every quad gate, and the events sort themselves into lettered groups.
- **Master:** gates, extra plots, absent cell types, populations that touch.
- **Extreme:** gates, you choose the scratchpad's cell types, and you type the diagnosis (full names or common abbreviations), plus a share-of-events question.
- **Custom:** set each of these yourself, including turning the scratchpad or the diagnosis off.

## Run it
Static files with no build step and no dependencies:

```
python3 -m http.server 8793
```

Then open http://localhost:8793. The URL hash names the board (`#pops/medium/12345`), so any board can be replayed.

## Publishing
- **GitHub Pages** serves this repository's `main` branch as it is: no build step. Pushing `main` publishes.
- **Self-hosted copy:** `./deploy.sh` copies the static files into a Proxmox container and serves them there (`--setup` on the first run). Settings live in `deploy.env`, which is git-ignored; see `deploy.env.example`.
- **No server or accounts:** stats, streaks, settings and the board in progress stay in each visitor's own browser (localStorage).

## Files
- `js/kb.js`: markers, normal populations, neoplasms (marker profiles, hallmarks, teaching lines), specimens, and the curated plot pairs.
- `js/genetics.js`: translocations and mutations, the malignancies they go with (with a level per link), and pairs never asked.
- `js/content.js`: Settings → Content: a level (Step 1 to heme fellowship) plus items turned on or off by hand, singly or by group. Boards, the Quizzes and the master reference read it.
- `js/markers.js`: the Quizzes (markers, and translocations and mutations).
- `js/master.js`: the master reference.
- `js/gen.js`: seeded generator, uniqueness solver, sudoku-style clue removal, and event simulation.
- `js/plot.js`: SVG dot plots. Each population has a shape, a letter badge and a CVD-safe color.
- `js/game.js`: the game screen.
- `node tools/check.js [n]`: generates n boards per mode and level, and proves each has exactly one answer.
