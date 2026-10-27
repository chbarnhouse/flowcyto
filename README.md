# FlowCyto

A flow cytometry logic puzzle for STEP 1, a companion to Step 1 Pathways. Read the dot plots, name the populations, and find the clone. Every board is generated and has exactly one answer that logic can reach.

**Modes:**
- **Name every population**: a logic grid. Give each lettered population an identity. Decoys are mixed in, and no identity is used twice.
- **Diagnose the clone**: one abnormal population against a list of look-alike neoplasms.

**Levels:**
- **Easy:** just the plots and cell types you need; the reference is filled in.
- **Medium:** extra plots and a few cell types that aren't in the tube; reference filled in.
- **Hard:** like Medium, but you fill in a scratch pad instead of a reference.
- **Expert:** no labels: you place every quad gate, and the events sort themselves into lettered groups.
- **Master:** gates, extra plots, absent cell types, and populations that touch.
- **Extreme:** gates, and you choose which cell types to consider from the whole catalog, plus a share-of-events question.
- **Custom:** set each of these yourself.

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
- `js/gen.js`: seeded generator, uniqueness solver, sudoku-style clue removal, and event simulation.
- `js/plot.js`: SVG dot plots. Each population has a shape, a letter badge and a CVD-safe color.
- `js/game.js`: the game screen.
- `node tools/check.js [n]`: generates n boards per mode and level, and proves each has exactly one answer.
