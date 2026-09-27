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

## Look and feel

Deliberately 1990s: a navy starfield, silver beveled panels with square corners, Impact
display caps, Comic Sans for the Oracle, Courier for the status lines, magenta/cyan/lime
accents, a scrolling marquee banner, faint CRT scanlines, and stepped (not smooth)
progress animation. All of it is local fonts and CSS — no webfonts, no images beyond
`images/`, so it still opens instantly and offline.

## Images

`images/` holds a small SVG placeholder for each location plus `win.svg` and
`gameover.svg`. Replace the files in place, keeping the filenames, and the game picks up
the new art with no code change. To see everything at once without playing through,
open `index.html?debug=true` — it dumps every location and both end screens into the feed.

## Next steps

Ordered, roughly by dependency. Steps 1–3 are the actual gift; 4–6 are polish.

### 1. Brainstorm the places (outside the code)

Make a list of real places, first get-togethers, and recurring spots from Amanda's life
— ten to fifteen is plenty. For each, note roughly *when* it happened, because that
decides which zone it belongs in. Decide up front whether real people get named; a
"we both know who this is" inside joke lands much harder than a stranger's name.

### 2. Fill in the content (`index.html`, CONTENT SECTION only)

Work zone by zone, so the story escalates:

| zone | steps | should feel like |
| --- | --- | --- |
| 1 | 0–13 | the beginning — early years, first adventures, the low-stuff |
| 2 | 14–26 | the middle — growth, trouble, the best and worst stories |
| 3 | 27–40 | now — leading to the Lookout Point and the win |

For each place: `id` (`loc_<camelCaseOfName>`), `name`, a one-or-two-sentence
`description` in second person ("you"), `image`, `zone`, `weight`, and 2–4 `choices`
with a fixed `outcome` each. A run is roughly 13–20 actions, so **3–4 locations per
zone is about right** — enough that the player rarely sees the same place twice.

Then write, in order: `ORACLE_HINTS` (four hints, descending `accuracy`, in the
Oracle's voice), `INTRO_LOCATION`'s horoscope, and `END_TEXT` — including the
`badMessage` branch for players who leave an offering at the shrine.

When the writing is done, `grep -n PLACEHOLDER index.html` should return nothing.

### 3. Swap the art (`images/`)

One image per location, named after its `id` (`loc_theCornerDiner.svg` →
`images/loc_theCornerDiner.svg`), plus `win.svg` and `gameover.svg`. Keep the same
wide aspect ratio the placeholders use and keep files small — the whole point is that
it opens instantly from disk. Check every image at once with `index.html?debug=true`.

### 4. Playtest and tune

Play several full runs by hand, both outcomes. Things to look for:

- a location that never comes up, or one that comes up every run
- a zone where every choice is a `penalty` — a death sentence rather than a story beat
- win/lose balance: is the journey ending on the first stumble too often?
- then tune `CONFIG` (`winDistance`, `minTravel`/`maxTravel`, `maxPenaltyPoints`,
  `oracleAppearChance`). If you change `winDistance`, **change the `ZONES` `max` values
  to match** — see the invariants in [AGENTS.md](AGENTS.md).

### 5. Ship it

- [ ] Commit, then open `index.html` on the machine it'll be played on (a `file://`
      path works; no server, nothing to install).
- [ ] Check the `<title>` and `<h1>` still suit, and add a dedication line to
      `INTRO_LOCATION` if you want her name in the first thing she reads.
- [ ] If the intro mentions a year, remember it goes stale next year.
- [ ] Optional extras, all content-only: an `outcome.image` on a dramatic game over, a
      fourth zone (needs the hardcoded three-zone list in `appendZoneTransitionEntry`
      updated too), or a `weight` bump so the best location shows up more often.
