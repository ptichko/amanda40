# The Fourth Decade

A single-page, no-build, no-server text/image adventure, made as a birthday gift for
Amanda. Open `index.html` in a browser to play — there is no server, no install step,
and nothing to compile.

## The game

A journey in three zones: **The Long Way Round**, **The Turning Point**, and **The Far
Shore**. Each step you pick one of 2–4 choices; every choice has a fixed, determined
outcome, and only the distance you travel is random. Travel 40 steps to reach the
Lookout Point and win. Three stumbles (red Xs in the HUD) and the journey ends early.

An **Oracle** turns up at most locations. Consult her and she'll highlight one of your
choices — she's right some of the time, and the odds depend on which hint she draws.
Her hit rate shows up in the end-of-game stats, so consult her if you like, and don't
if you'd rather trust yourself.

## Status: placeholder content

The engine is complete and playable. **All the writing is placeholder** — six generic
locations, placeholder Oracle hints, and placeholder win/lose text, each marked
`PLACEHOLDER:` in the source. Replace them with real places, memories, and inside
jokes from Amanda's life.

Everything you'd want to write lives in the **CONTENT SECTION** near the top of the
`<script>` block in `index.html`:

- `CONFIG` — total steps to win, stumble limit, travel range, Oracle appearance rate.
- `ZONES` — the three progress ranges locations are grouped into.
- `ORACLE_HINTS` — hint texts the Oracle can give, and how often she's right.
- `INTRO_LOCATION` — the fixed location every game starts at.
- `LOCATIONS` — the places you can land, each with a `zone`, a `weight`, and choices.
- `END_TEXT` — win and game-over titles and messages.

The **ENGINE SECTION** below it (selection, state, rendering) shouldn't need changes
for content edits. See [AGENTS.md](AGENTS.md) for the full content recipe, the
invariants to preserve, and the conventions for ids/images/tone.

## Images

`images/` holds a small SVG placeholder for each location plus `win.svg` and
`gameover.svg`. Replace the files in place, keeping the filenames, and the game picks up
the new art with no code change. To see everything at once without playing through,
open `index.html?debug=true` — it dumps every location and both end screens into the feed.
