# The Fourth Decade

A single-page, no-build, no-server text/image adventure, made as a birthday gift for
Amanda. Open `index.html` in a browser to play — there is no server, no install step,
and nothing to compile.

The text you'll want to change lives in one spreadsheet, `content/content.csv`; see
[Working on it](#working-on-it). Editing it runs a small Python step that pastes the new
words into `index.html`. Playing still needs nothing at all.

## The game

A journey in three eras — **Childhood, 1986 to 2001**, **The Teenage Years, 2000 to
2005**, and **Grown Up, 2006 to 2020** — across 17 stops drawn from the actual life: the
first house in Rochester, a talent show there's video of, a Velveteen Rabbit with the
playbill to prove it, a train from Philadelphia to make a prize, a degree, a magazine
article, a job at Spindrift and a move to Watertown, and Belmont. Each step you pick one
of 2–3 choices; every choice has a fixed, determined outcome, and only the distance you
travel is random. Travel 40 steps to reach the far side and win. Three stumbles (red Xs in
the HUD) and the journey ends early.

Every location has one choice marked `oracleCorrect` — the one that really happened. The
others are the roads not taken. **The three choices are shuffled every time you play**, so
the right answer isn't always in the same place and you can't beat it by guessing a
position. The keyboard shortcuts stay positional, so the buttons move under `1`, `2`, `3`.

An **Oracle** is waiting at every stop. Consult her and she'll highlight the choice that
actually happened — she's never wrong. What she says while she does it is flavour, drawn
from her own notes, so consult her if you like and don't if you'd rather trust yourself.
She has nothing to say at the opening card, which only has one button.

Before the first zone there's a **cutscene**: click *Begin the journey* and you get a
pixel-art panel of the room you were born in — Wentworth Douglass Hospital, Dover NH,
1986 — before the road starts.

## Status: placeholder content

The engine is complete and playable, and the **structure is real** — the three eras, the
15 stops, the years, the artefacts (video, playbill, CD, certificate, letter, newspaper
article, magazine) and the true/wrong choice on every location are all in place. What is
still placeholder is the **wording**: every description, caption and outcome started as a
first draft, marked `PLACEHOLDER:` in the source. 70 lines to go. `test_content.js`
reports the count on every run, and it should be zero before this is given to anyone.

Swap in the real memories, keeping the years and the facts. Everything you'd want to write
lives in **`content/content.csv`** — one spreadsheet, edited directly:

- the three eras (zones) and their year spans,
- the Oracle's hints and how often she's right,
- the intro card and the cutscene panels,
- each of the 17 places you can land — its name, picture, and description,
- every choice at every stop, and what happens when you pick it,
- the win and game-over cards.

Edit the CSV, run `python tools\build_content.py`, reload the page. See
**Working on it** below for the loop, or [content/README.md](content/README.md) for the
column reference. The **ENGINE SECTION** of `index.html` (selection, state, rendering)
isn't involved and shouldn't need changes. See [AGENTS.md](AGENTS.md) for the full content
recipe, the invariants to preserve, and the conventions for ids/images/tone.

## Look and feel

Deliberately 1990s: a teal-and-indigo Solo Jazz cup wallpaper, silver beveled panels with
square corners, Impact display caps, Comic Sans for the Oracle, Courier for the status
lines, a scrolling marquee banner, faint CRT scanlines, and stepped (not smooth) progress
animation. All of it is local fonts and CSS — no webfonts, no images beyond `images/`, so
it still opens instantly and offline.

The wallpaper is the Solo Jazz cup: broad ragged teal swipes (`#04C4C7`) with white
dry-brush speckle and thin indigo (`#3a2785`) scribbles, on a near-white ground. It's
deliberately mostly white so the silver panels stay readable on top of it. The page's own
text is inked deep teal with indigo accents (`--page-ink`, `--page-accent`) rather than the
white and cyan that a dark background wanted.

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
`images/` is done for the intro, the win card, and the game-over card (real pixel art -
leave those alone unless you want to redraw her). Of the 16 mid-game locations, **9 now use
a real photograph** and the remaining 7 have generated placeholder cards - a dithered
gradient in their era's colour, the year, and the location name. The birth cutscene is a
photograph too: Wentworth-Douglass Hospital at dusk.

The photographs are the actual artefacts: the Velveteen Rabbit title page, the Bette
Midler single, the D.A.R.E. logo, the CD, the school signs, a wall of Spindrift cans. They
are letterboxed to 16:9 with navy bars rather than cropped, so nothing gets cut off -
`object-fit: cover` would have reduced the Bette Midler cover to a band of hair. That
means a tall photo sits fairly small in a wide frame.

To swap one, replace the source photo (keep the name) and run:

```powershell
python tools/make_photos.py            # rebuild the card images
python tools/make_photos.py --list     # which photo goes with which stop
python tools/make_photos.py --check    # fail if a card image is stale
```

The source photos are **not in git** - one of them is 11.6 MB, and the page only ever loads
the small card built from it. They live on disk so you can re-cut a card; a fresh clone
has just the finished ones, and `--check` then verifies size only and says so.

To fill in one of the remaining placeholders, drop a photo in under the same filename
(`images/loc_<id>.jpg`, where `<id>` is in `content/content.csv`) and point that row at
it - no code change. To see everything at once without playing through, open
`index.html?debug=true` - it dumps every location and both end screens into the feed.

## Working on it

### Editing the words

All the text in the game lives in one spreadsheet: **`content/content.csv`**. Zone names,
the Oracle's hints, the intro card and cutscene, every location, every choice and what
happens when you pick it, and both end cards.

1. Open `content/content.csv` and change what you want. Save it.
2. Run `python tools\build_content.py`.
3. Reload `index.html`.

That's the whole loop. One row per value, in five columns — `kind, parent, index, field,
value` — and the order of the rows is the order things appear in the game.
**[content/README.md](content/README.md)** is the full reference: every `kind`, every
field, and the two rules that will bite you (exactly one choice per location needs
`oracle_correct`, and the zone ranges have to tile the journey without gaps).

The step 2 is not optional. The game reads its words out of `index.html`, because a
browser will not let a page opened from `file://` fetch a neighbouring file — and this
game has to keep working as a single file you can double-click, offline, forever. So the
CSV is the source and `index.html` is the build output. Edit the CSV, never the block
inside `index.html`; if you do edit it by hand the tool will notice and refuse to
overwrite you.

Other flags:

```powershell
python tools\build_content.py --check    # fail if index.html is out of date (a test does this)
python tools\build_content.py --export   # go the other way: rebuild the CSV from index.html
python tools\build_content.py --force    # apply, discarding hand-edits to the block
```

### Everything else

`tools/` holds dev-only helpers. Nothing in there is loaded by the page, and the game
still runs if you delete the folder — but it's what makes the project maintainable.

**Tests.** 461 checks over the engine, the content and the images, no browser required:

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_tests.ps1   # all nine files
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

Open `tools/art_preview.html` afterwards to eyeball every image at once, zoomed. It lists
the cards from a generated `tools/art_list.js`, so it works when you just double-click it -
`python tools/make_art.py --manifest` rewrites that list, and `--check` fails if it is out
of date.

[AGENTS.md](AGENTS.md) has the longer version: architecture, the content recipe, the
invariants a change must preserve, and the rules for keeping replay and sound working.

## Next steps

The structure is done. What's left is the writing and the photographs.

### 1. Replace the 78 `PLACEHOLDER:` lines

`test_content.js` prints the worklist on every run, and it's the same 78 rows in
`content/content.csv` — search that file for `PLACEHOLDER`. Everything it finds is a first
draft written from the facts — the years, the schools, the towns, the artefacts and who
did what are all correct, but the voice is generic. Go through it and make it hers, then
run `python tools\build_content.py` and reload.

Two things to preserve while you do:

- **Keep the years.** They carry the chronology, and the placeholder cards read them
  straight out of the descriptions.
- **Keep `oracleCorrect: true` on the true choice.** It's what makes the Oracle point at
  what actually happened instead of guessing. `test_content.js` fails if a location
  doesn't have exactly one.

If you add or remove a location, re-run `python tools/make_art.py --placeholders` so the
cards match.

### 2. Drop in the remaining photographs

Nine are in. The other seven stops still have generated placeholder cards: the first
house in Rochester, St. Elizabeth Seton, Disney World / Jellystone / Poland Springs,
Destination Imagination, the Washington DC conference, WEGO Health, and Belmont. Each is
named after its location `id` - put a photo at `images/loc_<id>.jpg`, point that row in
`content/content.csv` at it, and nothing else needs to change. `index.html?debug=true`
shows every one at once.

The obvious candidates are the things you already have: the playbill and the original
Velveteen Rabbit script, the newspaper clipping, the poetry certificate, the
leadership-conference letter, the Monitor magazine article.

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
