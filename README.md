# FlowCyto

A flow cytometry logic puzzle for STEP 1, a companion to Step 1 Pathways. Read the dot plots, name the populations, and find the clone. Every board is generated and has exactly one answer that logic can reach.

**Modes:**
- **Name every population**: a logic grid. Give each lettered population an identity. Decoys are mixed in, and no identity is used twice.
- **Diagnose the clone**: one abnormal population against a list of look-alike neoplasms.

**Levels:**
- **Easy:** more plots, and profiles are free to view.
- **Medium:** the minimum set of plots, and a peek at a profile counts against you.
- **Hard:** five populations, a red-herring plot, and a "what share of events" question.

## Run it
Static files with no build step and no dependencies:

```
python3 -m http.server 8793
```

Then open http://localhost:8793. The URL hash names the board (`#pops/medium/12345`), so any board can be replayed.

## Charlie's copy
https://flowcyto.chbarnhouse.com (LAN/VPN only). `./deploy.sh` pushes the static files into the container and restarts `flowcyto.service` (python3 http.server on port 8020); `--setup` on the first run. Settings in `deploy.env` (git-ignored; see `deploy.env.example`).

## Files
- `js/kb.js`: markers, normal populations, neoplasms (marker profiles, hallmarks, teaching lines), specimens, and the curated plot pairs.
- `js/gen.js`: seeded generator, uniqueness solver, sudoku-style clue removal, and event simulation.
- `js/plot.js`: SVG dot plots. Each population has a shape, a letter badge and a CVD-safe color.
- `js/game.js`: the game screen.
- `node tools/check.js [n]`: generates n boards per mode and level, and proves each has exactly one answer.
