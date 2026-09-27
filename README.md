# The Fourth Decade

A single-page, no-build, no-server text/image adventure, made as a birthday gift for
Amanda. Open `index.html` in a browser to play — there is no server, no install step,
and nothing to compile.

## The game

A journey in three zones: **The Long Way Round**, **The Turning Point**, and **The Far
Shore**. Each step you pick one of 2–4 choices; every choice has a fixed, determined
outcome, and only the distance you travel is random. Travel 40 steps to reach the far side
and win. Three stumbles (red Xs in the HUD) and the journey ends early.

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

Deliberately 1990s: teal/hot-pink/lime quatrefoil wallpaper, silver beveled panels with
square corners, Impact display caps, Comic Sans for the Oracle, Courier for the status
lines, a scrolling marquee banner, faint CRT scanlines, and stepped (not smooth) progress
animation. All of it is local fonts and CSS — no webfonts, no images beyond `images/`, so
it still opens instantly and offline.

The wallpaper is the plastic-tableware palette of a 90s kitchen, kept deliberately
low-contrast so the silver panels stay readable on top of it. The page's own text is
inked deep teal with hot-pink accents (`--page-ink`, `--page-pink`) rather than the white
and cyan that a dark background wanted.

**Amanda appears as pixel art** — a blonde character in a teal jacket and magenta scarf,
drawn on an 8px grid with `crispEdges` so she stays blocky at any zoom. She's on the intro
card in a striped birthday hat, waving on the road under a giant "40"; on the win card
with a cake and confetti; on the game-over card under a cold moon with the cake knocked
over on the ground beside her; and as a 24x31 sprite who **walks along the progress bar**
as you get closer to forty.

## Playing

Click through, or use the keyboard: `1`–`9` pick a choice, `O` consults the Oracle, `ENTER`
presses the last button (Continue, a zone gate, Play Again), `M` mutes.

There are sound effects — a blip when you choose, a falling buzz when you stumble, a
rising pair when something heals, a chime at a zone gate, and a short tune either way at
the end. They're synthesised in the browser with the Web Audio API, so there are no sound
files to download and it all still works offline. Muting is via `M` or the little
**sound on** button next to the key hints.

Every run is recorded in the address bar as `#seed=…&choices=…`, so you can:

- **share a run** — copy the URL and it replays exactly, same stops, same distances,
  same Oracle hints
- **resume** a run by reopening that URL
- **fix a seed** with `index.html?seed=1234` to start the same journey every time

The end card lists the run's seed and shows a *View the album* button: every stop in the
journey, with the ones you never reached greyed out.

## Images

`images/` is done for the intro, win, and game-over cards (real pixel art — leave those
alone unless you want to redraw her). The six mid-game locations still hold grey
placeholders: replace those files in place, keeping the filenames, and the game picks up
the new art with no code change. To see everything at once without playing through, open
`index.html?debug=true` — it dumps every location and both end screens into the feed.

## Working on it

`tools/` holds dev-only helpers. Nothing in there is loaded by the page, and the game
still runs if you delete the folder — but it's what makes the project maintainable.

**Tests.** 212 checks over the engine and the content, no browser required:

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_tests.ps1   # all six files
node tools\test_replay.js                                     # just one
```

`test_content.js` also reports how many lines still say `PLACEHOLDER:` — that number
should be zero before this is given to anyone.

**The art** is generated, not hand-drawn, so the character can be restyled without
redrawing pixels by hand. `tools/make_art.py` rewrites the six files it owns:

```powershell
python tools/make_art.py --preview    # print the sprite as ASCII
python tools/make_art.py              # rewrite the art
python tools/make_art.py --check      # fail if images/ is out of date
```

Open `tools/art_preview.html` afterwards to eyeball every image at once, zoomed.

[AGENTS.md](AGENTS.md) has the longer version: architecture, the content recipe, the
invariants a change must preserve, and the rules for keeping replay and sound working.

## Next steps

Ordered, roughly by dependency. Steps 1–3 are the actual gift; 4–5 are polish. The engine
is finished — everything below is content and art.

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

### 3. Swap the remaining art (`images/`)

The intro, win, and game-over cards are finished pixel art — leave them. The six
mid-game locations still hold grey placeholders: drop in one image per location, named
after its `id` (`loc_theCornerDiner.svg` → `images/loc_theCornerDiner.svg`). Keep the
wide aspect ratio the placeholders use and keep files small — the whole point is that it
opens instantly from disk. Check every image at once with `index.html?debug=true`.

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
      path works; no server, nothing to install). If she'll play it on a phone, serve it
      for a minute with `python -m http.server 8000 --directory .` and open
      `http://<your-pc-ip>:8000` — phones can't open `file://` paths.
- [ ] Run `tools\run_tests.ps1` one last time; it should be green and report zero
      `PLACEHOLDER:` lines.
- [ ] Check the `<title>` and `<h1>` still suit, and add a dedication line to
      `INTRO_LOCATION` if you want her name in the first thing she reads.
- [ ] If the intro mentions a year, remember it goes stale next year.
- [ ] Optional extras, all content-only: an `outcome.image` on a dramatic game over, a
      fourth zone (needs the hardcoded three-zone list in `appendZoneTransitionEntry`
      updated too), or a `weight` bump so the best location shows up more often.
