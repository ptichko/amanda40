# AGENTS.md

Guidance for coding agents (and humans) working in this repo.

## What this is

A single-file, no-build, no-server text/image adventure: **The Fourth Decade**, a
birthday quest for Amanda. Open `index.html` in a browser and play.

## Repository layout

```
index.html            the entire game: styles, content, engine
images/               every asset the page loads (see "Images")
content/              content.csv + README.md -- the editable source of the game's words
tools/                dev-only. Never loaded by the page. See "Tests".
AGENTS.md             this file
README.md             what it is, how to play, what to do next
```

`index.html` and `images/` are the whole game. Deleting `tools/` breaks nothing that
matters — only the ability to regenerate art and run the tests. `content/` is the
editing surface for text: `index.html` is generated from it, but the game never reads
it at runtime (see "Where to edit content").

## Hard constraints — do not break these

These are the reason the project is pleasant to work on. Any change that violates them
should be rejected, or the change should include a migration of the whole repo.

1. **No server, no build step, no dependencies.** One `index.html` that runs from
   `file://`. No npm, no bundler, no framework, no `fetch()` of local data files. Nothing
   in `tools/` is loaded by the page — those scripts are for authoring and testing, and
   the game works with the whole directory deleted except `index.html` and `images/`.
   The one authoring step that does exist is baking `content/content.csv` into
   `index.html` (`python tools/build_content.py`); it needs Python and produces no extra
   artifacts, because the shipped game is still that single hand-openable file. It is a
   text-substitution pass, not a compile — the rule it serves is that the page must open
   offline, and reading the CSV in the browser would break exactly that.
2. **No network access at runtime.** No CDN links, no web fonts, no remote images.
   Every asset is a relative path under `images/` (including `images/bg-tile.svg`,
   which the page background tiles). There are also no sound files: every effect is
   synthesised with the Web Audio API, so nothing to download and nothing to ship.
3. **No `@font-face`, no Google Fonts.** The 1990s look depends on fonts that are
   already installed locally — see "Look and feel" below. Adding a webfont would
   both break the no-network rule and defeat the period styling.
4. **No ES modules.** The script is a classic inline `<script>`; `import`/`export`
   will fail under `file://` because of CORS.
5. **Single file.** The game is intentionally not split up. Do not introduce
   `src/`, modules, or a build output. `content/content.csv` is not a build output and
   not loaded at runtime — it is the editable source for one region of `index.html`.
6. **No secrets, no tracking, no analytics.**

## Run / verify

- Play: open `index.html`. There is nothing to install and nothing to start.
- Play with the keyboard: `1`–`9` pick a choice, `O` consults the Oracle, `ENTER`
  presses the last button in the current card, `M` mutes the sound.
- Eyeball all artwork at once: `index.html?debug=true` dumps every location plus both
  end screens into the feed on load. Use this after touching images. Debug mode ignores
  the seed and the run in the URL.
- Replay or share a run: every run has a seed, and the address bar always holds
  `#seed=…&choices=…`. Open that URL and the run replays itself, exactly.
- Pin a run from the start: `index.html?seed=1234` always begins the same journey. A
  `?seed=` in the query string wins over the hash, which is how the test suite gets a
  reproducible run.

There **is** a test suite — see "Tests" below. Run it before you claim anything works.

### How a run is recorded (don't break this)

The address bar is the save file. `state.log` holds one token per action —

| token | meaning |
| --- | --- |
| `0`, `1`, `2`… | index of the choice picked at that stop |
| `o` | the Oracle was consulted there |
| `f` / `v` | offering / oath at a zone gate |

— and `state.seed` seeds a mulberry32 PRNG in `state.rng()`. Replaying a link feeds
those tokens back through the same code, so the whole journey (stops, distances,
outcomes, Oracle hints and highlights) is reproduced. Three consequences:

- **Every random draw must go through `state.rng()`, never `Math.random()`.** A stray
  `Math.random()` won't break the game, it will silently break replay.
- **Every player action that touches the RNG or the state must log a token**, in the
  handler that performs it (see `resolveChoice`, `renderOracle`'s click handler, and
  `appendZoneTransitionEntry`'s two buttons). An action that isn't logged can't be
  replayed; one that logs but doesn't draw from the RNG just makes the link longer.
- `syncHash()` rewrites the hash with `history.replaceState` after each action, with a
  `location.hash` fallback for environments where that throws. Keep it called from the
  same place as the `state.log.push`.

The feed is a live region (`#scene` is `aria-live="polite"` with `aria-relevant="additions"`,
so screen readers announce new cards as they land). `replayLog()` holds it at
`aria-busy="true"` for the duration of a rebuild and releases it in the same `finally` that
clears `state.replaying` — same reasoning as the silenced sounds: a replay would otherwise
read the whole journey back to back. `test_replay.js` asserts the flips through
`busyLog`, an aria-busy recorder that `dom_stub.js` wraps around `#scene`.

## Tests

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_tests.ps1   # everything
node tools\test_replay.js                                     # one file
```

(`-ExecutionPolicy Bypass` is only needed if your machine blocks local scripts;
`node tools\test_*.js` always works. Requires Node, and — for `test_content_csv.js` only —
Python. The game itself needs neither Node nor Python; the suite is the only thing that does.)

| file | what it protects |
| --- | --- |
| `tools/dom_stub.js` | the harness: pulls the inline script out of `index.html` and runs it against a DOM stub with synchronous timers, plus a fake `AudioContext` that records notes |
| `tools/test_content.js` | content invariants — unique `loc_*` ids, every `zone` in `ZONES`, contiguous zones, `winDistance` == last zone max, legal `outcome.type`s, every zone non-punishing, and **every image path exists on disk** |
| `tools/test_content_csv.js` | that `index.html` still matches `content/content.csv` (it shells out to `build_content.py --check`), that the generated block is fenced and hashed, and that `CONFIG` is emitted as numbers |
| `tools/test_oracle.js` | the Oracle is offered at every stop with a choice, and always highlights the `oracleCorrect` one — the two guarantees that replaced the old appearance and accuracy rolls |
| `tools/test_photos.js` | every referenced card image exists, no card points at a deleted placeholder, and `make_photos.py --check` passes |
| `tools/test_styles.js` | balanced braces, no `@font-face` or remote assets, the reduced-motion block, a style rule for every class the engine creates, CSS assets on disk |
| `tools/test_playthrough.js` | a safe run reaches a win at 100%, a reckless one ends early, every strategy terminates, the log has one token per action, replaying a finished run lands on the same end card |
| `tools/test_replay.js` | replay determinism, fingerprint by fingerprint including Oracle hints and highlights; a malformed hash still yields a playable game |
| `tools/test_keyboard.js` | a full run played with `1`/`O`/`ENTER` only, stray keys inert, the `M` mute and the album button |
| `tools/test_sound.js` | every effect's notes and pitch bends, silence before the first gesture, mute, and that a replay makes no sound |
| `tools/make_art.py` | regenerates the pixel art (see "Regenerating the art") and the preview manifest via `--manifest` |
| `tools/make_photos.py` | builds the nine photograph cards from their source photos (see "Photograph cards") |
| `tools/build_content.py` | bakes `content/content.csv` into the CONTENT SECTION of `index.html` (see "Where to edit content") |
| `tools/art_preview.html` | contact sheet of every image at 1x and zoomed — open it after touching art. Lists the cards from `tools/art_list.js`, which `make_art.py --check` keeps current |
| `tools/art_list.js` | the card list `art_preview.html` renders — **generated** by `make_art.py --manifest`, checked by `make_art.py --check` |

`test_content.js` also prints how many lines still contain `PLACEHOLDER:` — that
number should be zero before this is given to anyone.

When you change the engine, add or update a test in the same commit. The stub is
deliberately small; if a test needs behaviour the stub lacks (say `lastElementChild`),
extend `dom_stub.js` rather than reaching into the game from a test.

**Do not hardcode a seed.** A run's path depends on its seed, so a test that asserts "a
stumble is on offer" or "this run crosses a zone gate" will start failing the moment the
content changes. Use `findSeedRun(pred)` from `dom_stub.js`: it walks seeds from 1 upward,
drives each with the keyboard, and hands back the first page *stopped at the moment the
predicate held*. That way a content edit changes which seed is used instead of breaking
the test. `test_replay.js` and `test_sound.js` both work this way.

## Before you commit — and before you push

A change is not finished until all three of these are done. Do them **in the same commit
as the change**, never as a follow-up: docs drift from code within a day, and a reviewer
reading a stale `AGENTS.md` is worse off than one reading nothing.

1. **Tests are green.** `powershell -ExecutionPolicy Bypass -File tools\run_tests.ps1`
   passes. If you touched the engine, you added or updated a test alongside it. If you
   touched `tools/make_art.py` or anything in `images/`, `python tools\make_art.py --check`
   passes too. If a location card has a photograph, `python tools\make_photos.py --check`
   passes as well. If you touched `content/content.csv`, `index.html` has been rebuilt from
   it (`python tools\build_content.py`) so the two are committed together.
2. **Documentation is updated.** See the table below for what goes where. This is the step
   everyone skips, and it is the step that makes the *next* change safe — a future agent
   trusts `AGENTS.md` completely, so anything you leave stale in it becomes a wrong turn
   for someone else.
3. **You can say what you verified.** Name the test, the run, or the screenshot that
   proves the claim. "Looks right" is not evidence, and if you could not verify something,
   say that instead of implying you did.

| if you changed | update |
| --- | --- |
| a rule the engine depends on, an invariant, a footgun | `AGENTS.md` — the matching section, and **Hard constraints** if it is one |
| a new function, flag, DOM id, or state field | `AGENTS.md` — Architecture / the relevant section, plus a code comment explaining *why* |
| something a player can see, hear, or press | `README.md` — Playing, and the Look and feel paragraph if it's visual |
| an asset in `images/` | the table in **Images** above, including whether it is final or a placeholder |
| a file in `tools/` | the table in **Tests** above, and `README.md`'s "Working on it" |
| a symbol in the CONTENT SECTION | the table in **Where to edit content** (edit the CSV, then rebuild) |
| the next stage of the work | the checklist in `README.md`'s "Next steps" |

Note the trap this workflow invites: `index.html` is generated, so a content change is
really **two** files — `content/content.csv` *and* the rebuilt `index.html`. Committing
one without the other leaves the page disagreeing with its own source, and
`test_content_csv.js` will say so.

Two traps, both hit already in this repo:

- **Verify any number you write down.** This file has claimed the art generator rewrites
  "four files" when it writes six, and that the suite has a fixed check count. Both were
  wrong. Run the command and count.
- **Check the claim is true before documenting it.** `index.html?seed=1234` was documented
  in two places for a commit before it was implemented. A documented feature that does
  nothing is worse than an undocumented one, because people build on it.

## Architecture

`index.html` is two blocks inside one `<script>`:

- **CONTENT SECTION** (near the top) — all the data. Generated from
  `content/content.csv`; fenced by the BEGIN/END GENERATED CONTENT markers so the tool
  knows what it owns. Everything a writer touches.
- **ENGINE SECTION** (below it) — state, selection, rendering. Should not need
  changes for content work. Hand-written, and `build_content.py` never touches it.

Game flow, in order:

1. `newGame()` resets `state` and renders `INTRO_LOCATION` (fixed start, never
   re-picked, has no `zone`). On load, `readRunFromUrl()` decides what to do: a
   `?seed=` starts that seed from the beginning, otherwise a `#seed=…&choices=…` hash
   replays the run it names, otherwise a fresh random run. Debug mode skips all of it.
2. A choice at a location resolves to a **fixed** `outcome` — no randomness in *what*
   happens. Only the distance travelled is random (`CONFIG.minTravel`..`maxTravel`).
3. Outcome text is appended inline into the location card (not a modal) with a
   Continue button, then the "Wandering ... N steps" status plays. **The intro
   card is the exception**: it passes `deferTravel` to `appendConsequence()` and
   the status is played afterwards, into the last intro panel, by
   `resolveChoice()`. The first step of the journey belongs *after* the
   how-to-play card and the birth cutscene — they are the road starting, not
   travelling — and `updateProgressBar()` is held back with it, so the bar never
   jumps ahead of the line that explains it. A replay plays no travel status at
   all (`state.replaying` short-circuits it), like every other one.
4. `pickNextLocation()` picks the next location: only from the player's **current
   zone**, weighted by `weight`, preferring unvisited ones, and never the location
   just left if any alternative exists.
5. Crossing a `ZONES` boundary inserts a zone-transition card (offering / oath) and
   remembers the choice in `state.leftOffering`, which selects the win message.
6. Reaching `CONFIG.winDistance` wins; `state.penaltyPoints >= CONFIG.maxPenaltyPoints`
   or a `gameover` outcome loses. The end card shows journey stats, a shareable run
   link, an album button, and Play Again.

Outcome types — the only four legal values of `outcome.type`:

| type | effect |
| --- | --- |
| `normal` | flavor text only |
| `penalty` | +1 stumble point (a red X) |
| `heal` | −1 stumble point, floored at 0 |
| `gameover` | journey ends immediately |

## Where to edit content

**Edit `content/content.csv`, not `index.html`.** All the text below is generated into
the CONTENT SECTION of `index.html` by `python tools/build_content.py`. The full column
reference is in `content/README.md`; the short version is one row per field —
`kind, parent, index, field, value` — where order of the rows is the order things play.

The game can't read the CSV while running, and that is deliberate: browsers block
`fetch()` on `file://`, so a runtime read would break hard constraint 1. The CSV is the
source, `index.html` is the build output.

```powershell
python tools\build_content.py            # rebuild index.html from the CSV
python tools\build_content.py --check    # fail if index.html is stale (a test does this)
python tools\build_content.py --export   # rebuild the CSV from index.html
python tools\build_content.py --describe # report how the CSV was read (read-only)
python tools\build_content.py --force    # apply even if index.html was hand-edited
```

**The CSV is read defensively, because spreadsheets are not to be trusted.** Excel
writes `;` instead of `,` in locales whose decimal separator is a comma, so the delimiter
is sniffed from the header. A file saved as Windows-1252 can contain raw smart quotes that
aren't valid UTF-8; `decode_csv_bytes()` walks the bytes, passes valid UTF-8 sequences
through untouched and reinterprets only the bytes that *cannot* be part of one. Decoding
such a file as Windows-1252 wholesale would be worse, because it turns every correctly
encoded em dash into `â€"` — that mistake cost this repo real text once. `--describe`
reports the delimiter, the row count and `lost_characters`, and is what
`test_content_csv.js` asserts on.

That test deliberately does **not** call `--export`: `--export` rewrites the author's
file, and a test has no business mutating the source it is checking. It was doing exactly
that, and normalising a hand-edited CSV as a side effect of running the suite.

Two safeguards, both worth preserving:

- The generated region is fenced by `/* == BEGIN GENERATED CONTENT … == */` and
  `/* == END GENERATED CONTENT == */` and carries a `/* content-hash: … */` comment.
  If the block is edited by hand the hash stops matching, and the tool **refuses to
  overwrite** it (exit 1) rather than silently discarding the edit. `--force` overrides.
- `tools/test_content_csv.js` runs `--check`, so a CSV edit that was never baked fails
  the suite. Don't let that test go stale.

The generated block is `CONFIG`, `ZONES`, `ORACLE_HINTS`, `INTRO_LOCATION`,
`INTRO_SEQUENCE`, `LOCATIONS` and `END_TEXT`:

| symbol | `kind` in the CSV | purpose |
| --- | --- | --- |
| `CONFIG` | `config` | `winDistance`, `maxPenaltyPoints`, `minTravel`/`maxTravel`, `oracleAppearChance` |
| `ZONES` | `zone` | the progress ranges (`min`/`max`) locations are grouped into. Three eras, each named with its years: **Childhood, 1986 to 2001** (0–13), **The Teenage Years, 2000 to 2005** (14–26), **Grown Up, 2006 to 2020** (27–40) |
| `ORACLE_HINTS` | `hint` | the flavour text the Oracle says while she points at the correct choice, with an optional `weight` |
| `INTRO_LOCATION` | `intro` | the fixed location every game starts at |
| `INTRO_SEQUENCE` | `intro_panel` + `panel_bullet` | the panels that play once after "Begin the journey" — the **how-to-play card** and the **birth cutscene** — see "The intro sequence" below |
| `LOCATIONS` | `location` + `choice` | the 17 places the player can land, in date order within each zone, and what you can do at each |
| `END_TEXT` | `end` | `win` (with `goodMessage`/`badMessage`) and `gameover` titles, messages, images |

Two traps when editing the CSV:

- **Exactly one choice per location needs `oracle_correct` = `true`.** That is the choice
  that really happened, and it is the one the Oracle points at. `test_content.js`
  enforces one per location.
- **`location` ids are load-bearing.** `images/loc_<id>.svg` is looked up from the id, so
  renaming an id without renaming its picture breaks the asset test. (A location that has
  a photograph uses `images/loc_<id>.jpg` instead — same rule.)
- **The generated strings are JSON, so they are double-quoted.** Two tools parse the
  content section out of `index.html` with a regex, and both were written for the
  hand-written single-quoted style: `make_art.py`'s `LOCATION_RE` (which drives
  `--placeholders`) and the card lister in `art_preview.html`. They now accept either
  quote style. If you ever hand-edit the content block and make it single-quoted, check
  that `--list-placeholders` still finds all sixteen — that is the canary, and nothing in
  the test suite covers it.

The years in the `ZONES` names are the only place the eras' date spans are recorded, and
they have to be kept in step with the locations: adding a 2017 stop means the third zone's
name no longer stops at 2012. The step ranges are *not* years — a run is 40 steps whatever
the dates are.

## Content recipe

Progress on this is tracked as a checklist in the "Next steps" section of `README.md` —
check it before starting content work so you don't redo what's already written.

To add a location, append an object to `LOCATIONS`:

```js
{
  id: 'loc_theCornerDiner',              // unique; convention: loc_<camelCaseOfName>
  name: 'The Corner Diner',
  image: 'images/loc_theCornerDiner.svg', // relative path under images/
  description: 'The same booth, the same sticky menu.',
  zone: 2,                                // 1 | 2 | 3 — must match a ZONES id
  weight: 1,                              // relative likelihood within the zone
  choices: [
    { label: 'Order the usual', outcome: { type: 'normal', text: 'They do not even ask.' } },
    { label: 'Try the special', outcome: { type: 'penalty', text: 'A great deal of chili.' } },
  ],
},
```

Conventions that are not enforced by code but matter in practice:

- **`id`** must be unique across `LOCATIONS`. Nothing depends on numbering, so
  `loc_<camelCaseOfTheName>` is the convention — "Bear's room" style names are fine.
- **`zone`** must be one of the `ZONES` ids. A location in no zone is unreachable; a
  location in the wrong zone shows up at the wrong point in the story.
- **`image`** should point at `images/` with the matching filename. Drop the real art in
  under the same name and the game picks it up with no code change.
- **`choices`** — 2 to 4 per location works best. The choice marked `oracleCorrect: true`
  is the one that actually happened; the others are the roads not taken. The Oracle
  highlights the true one, which is why it beats the automatic best-outcome ranking in
  `getCorrectChoice()` — mark it on **every** location, or she starts guessing.
- **`outcome.image`** is optional; set it to show a picture inside the outcome box
  (useful for a dramatic `gameover`).
- **Tone**: warm, affectionate, funny. This is a birthday present. Avoid anything that
  would read as a jab.

## The intro sequence

`INTRO_SEQUENCE` is an array of panels played once, after the player presses "Begin the
journey" and before the first zone. It is where the how-to-play card and Wentworth Douglass
Hospital live — the birth is a panel, not a location, because it has no choices, no outcome,
and should never come up again or appear in the album.

A panel is `{ image, title, caption, button }`, and **`image` and `caption` are optional**,
so a panel can be a page of words with no picture. It may also carry `bullets: [string]`,
rendered as a list under the caption. Only `title` is required, and the engine defaults the
button to "Continue" if `button` is missing. That combination is what the how-to-play card
is: panel 0, no `image`, a one-line `caption`, and four `panel_bullet` rows. `buildEntryCard()`
takes the optional image and description for it, and skips either element when it's absent —
without that, a panel with no picture renders a broken `<img>` at the top of itself.

`playIntroSequence()` in the engine walks the panels, one Continue button each, then hands
control back so the first zone location is picked as normal. Two things to know:

- **It has to survive a replay.** A shared link has no player to press Continue, so
  `playIntroSequence()` renders each panel and steps straight to the next when
  `state.replaying` is set. Without that, every shared link dead-ends on the first panel.
- It needs no log token: it's deterministic, so the replay rebuilds it for free. Don't
  add one.
- **`onDone` is handed the last panel's card body**, not nothing. That is where the
  intro's deferred "Wandering N steps" status is appended, so the journey visibly
  starts from the last thing the player read. Change the signature and the travel
  status lands in the wrong card.

Add as many panels as you like — the array is the whole interface. Don't count them, though:
`test_playthrough.js` compares the cutscene cards it counts against `INTRO_SEQUENCE.length`,
so adding one is a content change, not a test change.

## Invariants a change must preserve

- `CONFIG.winDistance` must equal the `max` of the last zone in `ZONES` (both are `40`).
  If you change one, change the other, or the last zone's tail is unreachable / the
  progress bar overshoots its markers.
- `ZONES` ranges must be contiguous and cover `0..winDistance` with no gaps, or
  `getZoneForProgress()` silently falls back to the last zone.
- `INTRO_LOCATION` must stay outside `LOCATIONS` and without a `zone`.
- `INTRO_SEQUENCE` panels must stay outside `LOCATIONS` too, or they become ordinary
  stops that can repeat and turn up in the album.
- **The first `INTRO_SEQUENCE` panel is the how-to-play card** and must stay a list of
  `bullets`. It is the only thing between "Begin the journey" and the story, and a
  panel that lost its bullets would render as a bare title with nothing to read.
  `test_content.js` asserts it.
- Every location needs exactly one `oracleCorrect: true` choice. With none,
  `getCorrectChoice()` falls back to the best-ranked outcome type via `OUTCOME_RANK`
  (`heal` > `normal` > `penalty` > `gameover`), and the Oracle starts pointing at
  whatever is safest rather than at what happened. `test_content.js` enforces this.
- **The Oracle is offered everywhere and is never wrong.** `oracleAppearChance` is `1`,
  and `renderOracle()`'s click handler highlights `getCorrectChoice(location)`
  unconditionally — the hint text is flavour only. Both used to be probabilistic
  (a 0.6 appearance roll, and a per-hint `accuracy` roll that could light a wrong
  button), and both are now guaranteed. Don't reintroduce a chance of a wrong
  answer: it is the one thing the player can act on. `test_oracle.js` walks 30 seeds
  and fails on either regression. Two consequences of removing the roll:
  `computeStats()` no longer reports an accuracy percentage (it could only ever read
  100%), and no hint carries an `accuracy` field.
- The order choices are *shown* in is not the order they're written in. `orderedChoices()`
  shuffles them with the seeded RNG before rendering, because otherwise the true choice
  sits at position 1 at all 17 stops and "always click the top button" wins every run.
  Write the true choice first in the source, where it's easiest to see while writing; the
  shuffle means that has no effect on play. Two things depend on the shuffle being
  display-only, so don't "fix" this by sorting the content instead: the Oracle's highlight
  follows the *choice object* via `buttonMap`, and the run log records the index into
  `LOCATIONS`, not the position on screen. That's what keeps shared links replaying right.
  The `choice-key` badge rides the display order — it shows the button's `1`-`9`
  shortcut, which is positional by design — and `state.currentButtonMap` is how the
  replay marks the chosen button the same way a live click does, since a replay resolves
  through `resolveChoice` and never calls `selectChoice`.
- Adding a zone needs no engine change - `renderZoneMarkers()` and
  `appendZoneTransitionEntry()` both read `ZONES` - but the new zone's `min`/`max` must
  keep the ranges contiguous.

## Images

`images/` holds one image per location plus `win.svg`, `gameover.svg`, and two
non-location assets:

| file | role | status |
| --- | --- | --- |
| `loc_intro.svg` | intro card | **final** — pixel-art Amanda in a birthday hat, waving on the road under the "40" |
| `cutscene_birth.jpg` | the birth cutscene panel, which is intro panel 1 | **photograph** — Wentworth-Douglass Hospital at dusk, from `wentworth_douglas_hospital.jpg`; it replaced a pixel-art version that `make_art.py` no longer generates |
| `win.svg` | win card | **final** — pixel-art Amanda, cake, confetti |
| `gameover.svg` | game-over card | **final** — dejected pixel-art Amanda, arms down, beside the dropped birthday cake under a cold moon |
| `walker_0..2.svg` | the three-frame sprite that rides the progress bar | **final** — same character, 24x31 |
| `bg-tile.svg` | the seamless 300x300 wallpaper the page background tiles | **hand-written** — the only image not generated by `make_art.py`; a Memphis-shape grid on the four palette colours sampled from `Solo_Jazz_design.jpg`, and the stylesheet references it by relative path, don't rename |
| `Solo_Jazz_design.jpg` | the reference photo the wallpaper's four colours came from | **source reference** — the pattern no longer copies its texture, only its palette; not shown in the game, don't reference it from `index.html` |
| `loc_*.jpg` (10 locations) | the real photographs, one per location | **photographs** — derived from the originals by `tools/make_photos.py`; 16:9, 1200x675, padded with navy |
| `loc_*.svg` (the remaining 6 mid-game locations) | one per location | **placeholders** — generated, meant to be replaced with real photos |
| `DARE.jpg`, `velveteen_rabbit.jpg`, … (the 10 originals) | the source photographs | **sources, gitignored** — never referenced by `index.html`; `make_photos.py` reads them, so they live on disk only and a clone has just the derived cards |

Replace placeholder files in place, keeping the filenames, and everything just works.
Prefer small assets so the page still opens instantly from disk. If you add a location,
add its image too (or re-run `--placeholders`, below).

### Photograph cards

Ten of the sixteen mid-game stops now use a real photograph instead of a generated
placeholder, and the birth cutscene panel is an eleventh. `tools/make_photos.py` owns them:

```powershell
python tools/make_photos.py            # (re)build every card image from its source
python tools/make_photos.py --list     # the photo -> location mapping
python tools/make_photos.py --check    # fail if a card image is missing or stale
```

The mapping lives in `MAPPING` in that script. A card is **letterboxed, not cropped**:
the source is scaled to fit 1200x675 and the remainder padded with `#000040`, which is
already the colour behind the image. That is deliberate — `object-fit: cover` in
`.entry-image` would cut a tall photo into a thin strip, which destroys exactly the
artefacts that matter here (the Velveteen Rabbit title page, the Bette Midler single, the
D.A.R.E. logo, where the text *is* the picture). The cost is that a 0.56-ratio portrait
sits small in a wide frame. If that reads as too small, the fix is in the CSS, not here.

Three photos had more than one plausible stop and the choices are recorded in `MAPPING`:
the Bishop Brady sign went to the National Anthem (her graduation) rather than the
leadership conference; Stonehill illustrated the transfer and Emerson the degree; the
Strafford sign went to the move, leaving the talent show with the Bette Midler single.

`strafford_house.png` is an **aerial map screenshot** — a satellite view with a pin on it,
not a photograph of the house — and it competes with that sign for the same card. It lost,
because the sign is a real photograph like every other card here. It is left on disk and
deliberately unmapped rather than deleted, in case a Strafford Elementary location is ever
added: that is really what the sign is about, and neither card covers it today.

**`MAPPING` may not name the same stem twice, and `make_photos.py` now fails if it does.**
`rebuild()` walks the list in order and writes `stem + '.jpg'` each time, so a duplicate
would not error — the later entry would overwrite the earlier one and the earlier photo
would be dropped with no message at all. That is how the two Strafford photos nearly
collided. `check_mapping()` runs before `rebuild()`, `--check` and `--list`, and names both
offenders.

`MAPPING` is source photo -> **filename stem**, not location id, because one entry is not a
location at all: `wentworth_douglas_hospital.jpg` becomes `cutscene_birth.jpg` for the
birth cutscene panel. That panel used to be generated pixel art and was in `make_art.py`'s
`JOBS`; it is not any more, and `scene_birth()` was deleted rather than left unreachable.
Its source is a 13.9-megapixel phone photo at 11.6 MB, cut down to 122 KB — which is the
point of the tool, since the page is meant to open instantly from disk.

`--check` re-renders each source and compares **decoded pixels**, not file bytes, so a
Pillow upgrade that changes the encoder doesn't cause a false failure while a swapped or
re-cropped source photo does. `tools/test_photos.js` runs it.

The source photos are **not in git** (`.gitignore`; one is 11.6 MB and the page only ever
loads the small derived copy), so on a fresh clone there is nothing to compare against.
`--check` then verifies each card exists at the right size and says so — "checked for size
only, source photo not present" — rather than failing or quietly claiming more than it
checked. Keep the originals on disk if you want to re-cut a card.

### Placeholder cards

The remaining mid-game location images are generated, but **not** by `make_art.py`'s
`JOBS` and not covered by `--check` — they exist to be replaced, and `--check` would
start failing the moment a real photo took one of their names. Write them with:

```powershell
python tools/make_art.py --placeholders        # rewrite every placeholder card
python tools/make_art.py --list-placeholders   # what they are and which year each shows
```

They are generated by **parsing `index.html`**, not from a list in the script, so a
location can't be renamed in the content and left behind in the art. Each card is a
dithered gradient in its zone's colour, a dashed frame, the year, and the location name
in the blocky font. A location whose image is a `.jpg` is skipped, so running
`--placeholders` won't hand a real photograph a generated card.

The pixel art is deliberately 8px-cell chunky with `shape-rendering="crispEdges"`. If you
swap in a photo for one of the final files, that's fine — but keep
`image-rendering: pixelated` in mind for any new sprite, or it will look blurry when the
browser scales it.

**The cake is the same object in both cards.** `scene_win()` draws it upright in tiers;
`dropped_cake()` in `scene_gameover()` draws the same thing on the ground after a bad run
— big tier on its side with the layers showing at the cut end, top tier slid off beside
it, icing squashed out, candles and crumbs scattered. Both use the same palette entries
(`g` body, `w` icing, `m` filling, `c` candles), so if you recolour the cake on the win
card, recolour it there too. It sits a few rows *above* her boots on purpose: that reads
as "a bit further down the road" and keeps it clear of the bottom edge of the card.

### Regenerating the art

Six of the files above are **generated** by `tools/make_art.py`: `loc_intro.svg`,
`win.svg`, `gameover.svg` and `walker_0/1/2.svg`. (`bg-tile.svg` is hand-written, and the
`loc_*.jpg` / `cutscene_birth.jpg` photographs are built by `make_photos.py` — none of them
are in that list.)

```powershell
python tools/make_art.py            # rewrite all six files it owns
python tools/make_art.py --list     # what it would write
python tools/make_art.py --preview  # print the sprite as ASCII
python tools/make_art.py --check    # fail if images/ or art_list.js is out of date
python tools/make_art.py --manifest # rewrite tools/art_list.js for the preview sheet
python tools/make_art.py win.svg    # just one
```

`tools/art_list.js` is the card list that `art_preview.html` renders. It used to read
`index.html` with `fetch()`, which **browsers block on `file://`** — the normal way to open
anything in this repo — so the sheet's lower half always came up blank. A classic
`<script src>` is not subject to that restriction, so the list is written out as JS and
loaded as one. `--check` regenerates it in memory and fails if the committed copy differs,
so it cannot drift.

`tools/make_art.py` is a **dev tool, not part of the game**. Nothing in `index.html`
invokes it, Python is not a dependency, and deleting `tools/` would not break the page —
only the ability to re-render art that is already committed. To restyle her, edit
`amanda()` in that file (hair is `h`/`H`/`L`, jacket `t`/`T`, scarf `m`/`M` in `PAL`) and
re-run. The output is deterministic: the same code always produces byte-identical SVGs, so
a regeneration with no art change leaves `git status` clean.

Three shapes of the sprite come out of that one function, all from `amanda()`:

- `amanda(frame)` — 24x31, used by the walker frames and the win card. `pose='wave'`
  (the default): right arm up, waving, with a smile.
- `amanda(frame, pose='slump')` — same 24x31 grid, for the game-over card only. Both arms
  down at her sides, the top row of the jacket drawn a cell narrower each way so the
  shoulders slope, and a frown (the middle of the mouth sits above its corners). Keep the
  slump off the walker and the win card — a glum sprite marching along the progress bar
  would be grim, and the win card is meant to be the opposite of glum.
- `amanda(frame, hat=True)` — 24x(31+`HAT_PAD`), the striped party hat with a lime
  pom-pom, leaning away from her waving hand. Only the intro card uses it. The hat needs
  headroom, which is why that variant is taller: `HAT_CONE`, `HAT_POM` and `HAT_BRIM`
  describe it cell by cell, and `scene_intro()` blits her `HAT_PAD` cells higher so her
  boots stay on the same line of ground as in the other two cards. **If you change
  `HAT_PAD` or the brim row, check the pom-pom isn't flush against the top of the card.**

The flags compose — `amanda(0, hat=True, pose='wave')` is the intro card — so a fourth
combination is one argument away.

`--check` is the guard against drift: it renders every file in memory and fails if
`images/` doesn't match, which catches both hand-edited SVGs and art committed without
the script change that generated it. Run it before committing anything that touches
either.

### The progress walker

`images/walker_0..2.svg` are a DOM element, not a background: `#progress-walker` inside
`.progress-wrap` is a `<span>` stacking all three frames, positioned from
`updateProgressBar()` in the engine. Its `left` is clamped so she stays inside the panel
at 0% and 100%. Three things to know:

- The HUD row is `.progress-col` (bar + `#zone-labels` ruler) vs `#steps` vs
  `#penalty-points`. The labels are a *sibling*, not a child of `.progress-wrap`, so the
  wrap's height stays the track's — the walker `bottom: -2px` pins her to the track, not
  to the labels row.
- If you change the progress bar's height, check `.progress-walker` still lines up — the
  sprite is 24x31 and deliberately pokes a few pixels above the track.
- Don't "fix" her by moving her into `.progress-track`; the track has `overflow: hidden`
  and would clip her at both ends.
- The cycle is CSS only: `.is-walking` (added by `updateProgressBar`, removed
  `WALK_STOP_MS` after the bar settles) drives a `steps`-style opacity animation across
  the three frames. Add a fourth frame and you must extend both the HTML and the
  `walk-cycle` keyframes.

## Look and feel

Deliberately 1990s, and the whole stylesheet is written to protect that. Before changing
any CSS, read this list — each item is load-bearing:

- **Fonts are local-only, and named in stacks.** `--font-display` is Impact (titles,
  entry names, buttons), `--font-body` is Verdana/Tahoma, `--font-mono` is Courier New
  (travel status, stats, dividers), `--font-hand` is Comic Sans MS (the Oracle only).
  Every stack ends in a generic family so something renders everywhere.
- **Silver bevels, square corners.** `border: 2px outset #dfdfdf` for raised, `inset` for
  grooves and pressed states. `border-radius` was removed on purpose — rounded corners
  did not exist in this era. `.primary-btn:active` and `.choice-btn:active` go `inset` to
  look pressed.
- **Navy + magenta + cyan + lime on silver.** The palette lives in `:root` as custom
  properties. `--accent` is navy and is what text uses on silver; magenta and cyan are
  decoration (shadows, borders, glows) and are deliberately *not* used for body text,
  because magenta on silver fails contrast.
- **The page background is wallpaper, not a canvas.** `images/bg-tile.svg` is a seamless
  300x300 tile: a Memphis-style 4x4 arrangement of the period's shapes — outlined and
  filled triangles, rings, confetti dots, rotated bars, terrazzo chips, a symmetric plus,
  sine squiggles and zigzags — on a near-white `#f7f7f4` ground, in teal (`#04C4C7`),
  light teal (`#6fdcde`), indigo (`#3a2785`) and navy (`#000080`) only. **Only about 3% of
  the tile is inked**, which is the point: the silver panels sit on top of it and the
  deep-teal title text reads across it, so a heavier pattern would be a legibility bug
  rather than a taste call. It was a broad teal-swipe design before, sampled from
  `images/Solo_Jazz_design.jpg`; the pattern changed but the four colours it used are
  still that photo's, so the lineage holds.
  The tile is seamless because the whole group of marks is stamped at all nine offsets
  (-W/0/+W by -H/0/+H) via `<use>` — one `<g id="tile">` and nine uses, rather than nine
  copies per mark. The old file did the latter (72 uses for 8 marks) and it renders
  identically; the only difference is z-order between marks that overlap across a seam.
  If you add a mark, put it inside that group or the edge will cut. A handful of marks
  deliberately straddle the tile edges, so a broken wrap shows up immediately.
  Because the page is pale, text that sits *directly* on the background — the title,
  tagline, key hints, colophon — uses `--page-ink` (deep teal) and `--page-accent`
  (indigo), not the white and cyan that a dark background wanted. If you recolour the
  wallpaper, recolour those four rules with it; the panels and everything inside them are
  unaffected. `--bg` is only a fallback for when the tile fails to load, and the CSS pins
  `background-size: 300px 300px` to match the tile's native size.
- **Stepped, not smooth, animation.** Progress and choice-fill transitions use
  `steps()`, the marquee loops seamlessly by holding its text twice and sliding `-50%`,
  and the title has a barely-there flicker. Keep motion in that spirit. The marquee also
  names the era: `setMarqueeMessage()` (called from `updateProgressBar()` on every zone
  change) rewrites both halves with the current zone's name, so a replacement must keep
  the two halves identical strings. That and the `:focus-visible` rect are the two things
  `test_styles.js` greps for in the stylesheet.
- **CRT scanlines** come from `body::after` at low opacity. Don't raise it much.
- **The pixel sprite in the HUD** is scaled 1:1 (24x31) with `image-rendering: pixelated`.
  Don't apply a transform scale to it.
- **Keyboard controls** are a single `keydown` listener that clicks real buttons in the
  last feed child, so it inherits every existing `disabled` guard. Keep it that way —
  synthesising state changes directly would bypass the guards. Note `ENTER` is ignored
  when a button already has focus, otherwise the browser's own activation would fire the
  action twice.
- **Keyboard focus is visible.** `.choice-btn`, `.primary-btn` and `.sound-toggle` show a
  dotted in-set focus rectangle under `:focus-visible` (period-correct Win95 focus-behaviour
  with `:focus` — mouse clicks would light it on every press). The rule tests for
  `:focus-visible` plus a `dotted` outline; if you re-style it, keep both in the check.
- `prefers-reduced-motion: reduce` switches off the marquee, flicker, glow, and
  transitions. Keep that block working.

If you add a new UI element, style it from the existing tokens rather than introducing a
new colour or a webfont.

## Sound

All effects are synthesised — no audio files exist in this repo. `sfx` is the catalogue
(one function per event), `note()` is the single primitive that builds one oscillator
plus an envelope, and `SOUND_VOLUME` is the master level. Four rules, each of which has
already been got wrong once:

- **Route every effect through `playSound()`.** It is the only thing that checks
  `soundEnabled`, checks `state.replaying`, and swallows errors. Calling `sfx.*()`
  directly skips all three.
- **The audio context is created on the first user gesture**, via `armAudio()` on
  `pointerdown`/`keydown`. Creating it on page load gets it blocked by autoplay policy,
  and the game would stay silent until a reload.
- **A replayed run is silent** (`state.replaying`), otherwise opening a shared link fires
  every effect in the run at once.
- **Muting is session state only** — deliberately not persisted, because a `file://`
  page has no reliable storage. It resets on reload, which is the lesser evil against a
  mute that mysteriously persists.

The toggle is a real `<button>` in the key-hints line (`#sound-toggle`, styled
`.sound-toggle`, `aria-pressed` kept in sync), so it is reachable by mouse, keyboard, and
screen reader, and the `M` key flips the same state.

## Style

- Plain ES5-flavoured JavaScript: `const`/`let`, arrow functions, `forEach`. No
  TypeScript, no classes where a function will do.
- Content is written as readable object literals with the same field order as existing
  entries. Keep the comment blocks explaining *why* non-obvious logic exists — the engine
  section is comment-dense on purpose.
- No new dependencies. No comments that narrate trivial code.
