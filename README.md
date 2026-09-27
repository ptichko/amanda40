# The Fourth Decade

A single-page, no-build, no-server text/image adventure, made as a birthday gift for
Amanda. Open `index.html` in a browser to play — there is no server, no install step,
and nothing to compile.

## The game

A journey in three eras — **Childhood, 1986 to 2001**, **The Teenage Years, 2000 to
2005**, and **Grown Up, 2006 to 2012** — across 15 stops drawn from the actual life: the
first house in Rochester, a talent show there's video of, a Velveteen Rabbit with the
playbill to prove it, a train from Philadelphia to make a prize, a degree, and a magazine
article. Each step you pick one of 2–3 choices; every choice has a fixed, determined
outcome, and only the distance you travel is random. Travel 40 steps to reach the far side
and win. Three stumbles (red Xs in the HUD) and the journey ends early.

Every location has one choice marked `oracleCorrect` — the one that really happened. The
others are the roads not taken.

An **Oracle** turns up at most locations. Consult her and she'll highlight what actually
happened — she's right some of the time, and the odds depend on which hint she draws. Her
hit rate shows up in the end-of-game stats, so consult her if you like, and don't if you'd
rather trust yourself.

Before the first zone there's a **cutscene**: click *Begin the journey* and you get a
pixel-art panel of the room you were born in — Wentworth Douglass Hospital, Dover NH,
1986 — before the road starts.

## Status: placeholder content

The engine is complete and playable, and the **structure is real** — the three eras, the
15 stops, the years, the artefacts (video, playbill, CD, certificate, letter, newspaper
article, magazine) and the true/wrong choice on every location are all in place. What is
still placeholder is the **wording**: every description, caption and outcome is a first
draft, marked `PLACEHOLDER:` in the source. 71 lines to go. `test_content.js` reports the
count on every run, and it should be zero before this is given to anyone.

Swap in the real memories, keeping the years and the facts. Everything you'd want to write
lives in the **CONTENT SECTION** near the top of the `<script>` block in `index.html`:

- `CONFIG` — total steps to win, stumble limit, travel range, Oracle appearance rate.
- `ZONES` — the three eras, each with its year span.
- `ORACLE_HINTS` — hint texts the Oracle can give, and how often she's right.
- `INTRO_LOCATION` — the fixed location every game starts at.
- `INTRO_SEQUENCE` — the pixel-art panels that play after "Begin the journey".
- `LOCATIONS` — the 15 places you can land, each with a `zone`, a `weight`, and choices.
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
with a cake and confetti; on the game-over card with her arms down beside the cake she
knocked over, under a cold moon; and as a 24x31 sprite who **walks along the progress bar**
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

`images/` is done for the intro, the birth cutscene, the win card, and the game-over card
(real pixel art — leave those alone unless you want to redraw her). The 15 mid-game
locations have generated placeholder cards instead — a dithered gradient in their era's
colour, the year, and the location name. Drop a real photo in under the same filename and
the game picks it up with no code change. Regenerate the placeholders after editing the
content with `python tools/make_art.py --placeholders`. To see everything at once without
playing through, open `index.html?debug=true` — it dumps every location and both end
screens into the feed.

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
python tools/make_art.py              # rewrite the finished art
python tools/make_art.py --placeholders  # rewrite the location placeholders
python tools/make_art.py --check      # fail if the finished art is out of date
```

Open `tools/art_preview.html` afterwards to eyeball every image at once, zoomed.

[AGENTS.md](AGENTS.md) has the longer version: architecture, the content recipe, the
invariants a change must preserve, and the rules for keeping replay and sound working.

## Next steps

The structure is done. What's left is the writing and the photographs.

### 1. Replace the 71 `PLACEHOLDER:` lines

`grep -n PLACEHOLDER index.html` is the worklist. Everything it lists is a first draft
written from the facts — the years, the schools, the towns, the artefacts and who did what
are all correct, but the voice is generic. Go through it and make it hers.

Two things to preserve while you do:

- **Keep the years.** They carry the chronology, and the placeholder cards read them
  straight out of the descriptions.
- **Keep `oracleCorrect: true` on the true choice.** It's what makes the Oracle point at
  what actually happened instead of guessing. `test_content.js` fails if a location
  doesn't have exactly one.

If you add or remove a location, re-run `python tools/make_art.py --placeholders` so the
cards match.

### 2. Drop in the photographs

The 15 mid-game locations have generated placeholder cards. Each is named after its
location `id` — put a real photo at that filename and nothing else needs to change.
Keep the wide aspect ratio the placeholders use and keep files small; the whole point is
that it opens instantly from disk. `index.html?debug=true` shows every one at once.

The obvious candidates are the things you already have: the talent show video, the
playbill and the original Velveteen Rabbit script, the DARE speech in your own
handwriting, the CD, the newspaper clipping, the certificate, the letter, the magazine.

### 3. Playtest

Play several full runs by hand, both outcomes. Things to look for:

- a stop that never comes up, or one that comes up every run
- a location whose real detail didn't make it into the draft
- win/lose balance: is the journey ending on the first stumble too often?
- then tune `CONFIG` (`winDistance`, `minTravel`/`maxTravel`, `maxPenaltyPoints`,
  `oracleAppearChance`). If you change `winDistance`, **change the `ZONES` `max` values
  to match** — see the invariants in [AGENTS.md](AGENTS.md).

### 4. Ship it

- [ ] Run `tools\run_tests.ps1` one last time; green, and reporting zero `PLACEHOLDER:`
      lines.
- [ ] Open `index.html` on the machine it'll be played on (a `file://` path works; no
      server, nothing to install). If she'll play it on a phone, serve it for a minute with
      `python -m http.server 8000 --directory .` and open `http://<your-pc-ip>:8000` —
      phones can't open `file://` paths.
- [ ] Check the `<title>` and `<h1>` still suit, and add a dedication line to
      `INTRO_LOCATION` if you want her name in the first thing she reads.
- [ ] Optional, all content-only: a second intro panel, an `outcome.image` on a dramatic
      game over, or a `weight` bump so the best stop comes up more often.
