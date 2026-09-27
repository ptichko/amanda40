# AGENTS.md

Guidance for coding agents (and humans) working in this repo.

## What this is

A single-file, no-build, no-server text/image adventure: **The Fourth Decade**, a
birthday quest for Amanda. Open `index.html` in a browser and play.

## Hard constraints — do not break these

These are the reason the project is pleasant to work on. Any change that violates them
should be rejected, or the change should include a migration of the whole repo.

1. **No server, no build step, no dependencies.** One `index.html` that runs from
   `file://`. No npm, no bundler, no framework, no `fetch()` of local data files.
2. **No network access at runtime.** No CDN links, no web fonts, no remote images.
   Every asset is a relative path under `images/`.
3. **No ES modules.** The script is a classic inline `<script>`; `import`/`export`
   will fail under `file://` because of CORS.
4. **Single file.** The game is intentionally not split up. Do not introduce
   `src/`, modules, or a build output.
5. **No secrets, no tracking, no analytics.**

## Run / verify

- Play: open `index.html`. There is nothing to install and nothing to start.
- Eyeball all artwork at once: `index.html?debug=true` dumps every location plus both
  end screens into the feed on load. Use this after touching images.
- No test suite exists and none is expected. Verification is manual: open the page,
  click through, confirm the console is clean.

If you make a change to the engine, at minimum play one full run to a win **and** one
run that ends in game over.

## Architecture

`index.html` is two blocks inside one `<script>`:

- **CONTENT SECTION** (near the top) — all the data. Everything a writer touches.
- **ENGINE SECTION** (below it) — state, selection, rendering. Should not need
  changes for content work.

Game flow, in order:

1. `newGame()` resets `state` and renders `INTRO_LOCATION` (fixed start, never
   re-picked, has no `zone`).
2. A choice at a location resolves to a **fixed** `outcome` — no randomness in *what*
   happens. Only the distance travelled is random (`CONFIG.minTravel`..`maxTravel`).
3. Outcome text is appended inline into the location card (not a modal) with a
   Continue button, then the "Wandering ... N steps" status plays.
4. `pickNextLocation()` picks the next location: only from the player's **current
   zone**, weighted by `weight`, preferring unvisited ones, and never the location
   just left if any alternative exists.
5. Crossing a `ZONES` boundary inserts a zone-transition card (offering / oath) and
   remembers the choice in `state.leftOffering`, which selects the win message.
6. Reaching `CONFIG.winDistance` wins; `state.penaltyPoints >= CONFIG.maxPenaltyPoints`
   or a `gameover` outcome loses. The end card shows journey stats and a Play Again button.

Outcome types — the only four legal values of `outcome.type`:

| type | effect |
| --- | --- |
| `normal` | flavor text only |
| `penalty` | +1 stumble point (a red X) |
| `heal` | −1 stumble point, floored at 0 |
| `gameover` | journey ends immediately |

## Where to edit content

Everything below lives in the CONTENT SECTION of `index.html`:

| symbol | purpose |
| --- | --- |
| `CONFIG` | `winDistance`, `maxPenaltyPoints`, `minTravel`/`maxTravel`, `oracleAppearChance` |
| `ZONES` | the progress ranges (`min`/`max`) locations are grouped into |
| `ORACLE_HINTS` | hint texts the Oracle can give, each with an `accuracy` and optional `weight` |
| `INTRO_LOCATION` | the fixed location every game starts at |
| `LOCATIONS` | every place the player can land |
| `END_TEXT` | `win` (with `goodMessage`/`badMessage`) and `gameover` titles, messages, images |

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
- **`choices`** — 2 to 4 per location works best. At least one `normal`, and spread
  `penalty`/`heal` so a run has texture. A `gameover` should be rare and intentional.
- **`outcome.image`** is optional; set it to show a picture inside the outcome box
  (useful for a dramatic `gameover`).
- **Tone**: warm, affectionate, funny. This is a birthday present. Avoid anything that
  would read as a jab.

## Invariants a change must preserve

- `CONFIG.winDistance` must equal the `max` of the last zone in `ZONES` (both are `40`).
  If you change one, change the other, or the last zone's tail is unreachable / the
  progress bar overshoots its markers.
- `ZONES` ranges must be contiguous and cover `0..winDistance` with no gaps, or
  `getZoneForProgress()` silently falls back to the last zone.
- `INTRO_LOCATION` must stay outside `LOCATIONS` and without a `zone`.
- If you add zones, also update the two-button hardcoded list in
  `appendZoneTransitionEntry` — it assumes exactly three zones.
- The Oracle's "correct" choice is derived, not declared: `getCorrectChoice()` picks the
  best-ranked outcome type via `OUTCOME_RANK` (`heal` > `normal` > `penalty` >
  `gameover`). To pin a specific choice instead, mark it `oracleCorrect: true`.

## Images

`images/` holds one small SVG placeholder per location plus `win.svg` and
`gameover.svg`. Replace files in place, keeping the filenames, and everything just works.
Prefer small assets (the originals are photos; keep the page light enough to open
instantly from disk). If you add a location, add its placeholder too.

## Style

- Plain ES5-flavoured JavaScript: `const`/`let`, arrow functions, `forEach`. No
  TypeScript, no classes where a function will do.
- Content is written as readable object literals with the same field order as existing
  entries. Keep the comment blocks explaining *why* non-obvious logic exists — the engine
  section is comment-dense on purpose.
- No new dependencies. No comments that narrate trivial code.
