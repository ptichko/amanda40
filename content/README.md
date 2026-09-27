# Editing the game's words

All the text in the game — zone names, the Oracle's hints, the intro card, every
location, every choice and its outcome, and the two end cards — lives in
**`content.csv`** in this folder. It is the only file you need to edit.

## The loop

1. Open `content.csv` in Excel, Numbers, Google Sheets, or Notepad.
2. Change the text you want. **Save it.**
3. From the repo root, run:

   ```
   python tools/build_content.py
   ```

4. Reload `index.html` in your browser.

That's it. Step 3 bakes your edits into `index.html`.

> The game can't read the CSV while you play. Browsers block `fetch()` on
> `file://` ("Failed to fetch"), and this game has to keep working as a single
> file you can double-click with no server. So the CSV is the *source* and
> `index.html` is the *build output* — which is why step 3 is needed.

## Don't edit the words inside `index.html`

The block between these two markers in `index.html` is generated:

```
/* == BEGIN GENERATED CONTENT (from content/content.csv) == */
...
/* == END GENERATED CONTENT == */
```

Edit it by hand and `build_content.py` will refuse to overwrite your work and
tell you so. If you *meant* to edit it there, pass `--force`.

## Running the tool

| Command | What it does |
| --- | --- |
| `python tools/build_content.py` | Bake `content.csv` into `index.html`. |
| `python tools/build_content.py --check` | Fail if `index.html` doesn't match the CSV. The test suite runs this. |
| `python tools/build_content.py --export` | Go the other way: rebuild `content.csv` from `index.html`. Useful if you hand-wrote content in the HTML and want to keep it. |
| `python tools/build_content.py --force` | Bake, discarding hand-edits to the generated block. |

## How the file is laid out

Five columns, and **one row per single value**:

| Column | Meaning |
| --- | --- |
| `kind` | What the row is about. See the table below. |
| `parent` | Which thing it belongs to — a location id, a zone number, or a key like `win`. |
| `index` | Position within the parent, for ordered things (choices, cutscene panels, hints). |
| `field` | The property being set — `name`, `description`, `label`, `text`… |
| `value` | The value, exactly as it should read in the game. |

Because every row is a complete value, there's no such thing as a half-filled
row, and a blank cell can never silently mean "delete this field".

**Order is the order of the rows.** The choices under a location, the locations
themselves, the Oracle's hints and the cutscene panels all play in the order
they appear in the file. To reorder something, move its rows.

### The `kind` values

| `kind` | `parent` | Fields |
| --- | --- | --- |
| `config` | `winDistance`, `maxPenaltyPoints`, `minTravel`, `maxTravel`, `oracleAppearChance` | `value` |
| `zone` | the zone number, e.g. `1` | `name`, `min`, `max` |
| `hint` | *(blank)*, `index` numbers the hints | `text`, `weight` *(optional)* |
| `intro` | *(blank — there is only one)* | `id`, `name`, `image`, `description`, `choice_label`, `choice_outcome_type`, `choice_outcome_text` |
| `intro_panel` | *(blank)*, `index` numbers the panels | `image`, `title`, `caption`, `button` |
| `location` | the location id, e.g. `loc_theTalentShow` | `name`, `image`, `zone`, `weight`, `description` |
| `choice` | the location id it belongs to, `index` numbers the choices | `label`, `oracle_correct` (`true` on the one that really happened), `outcome_type`, `outcome_text`, `outcome_image` *(optional)* |
| `end` | `win` or `gameover` | `title`, `message`, `image` — and for `win`, `goodMessage` and `badMessage` |

### Things worth knowing

- **Exactly one choice per location must have `oracle_correct` set to `true`.**
  That's the choice that actually happened, and it's the one the Oracle points
  at. Leave it off the others. The test suite checks this.
- **`outcome_type`** is one of `normal`, `penalty`, `heal`, `gameover`. A
  `penalty` gains a red X, a `heal` removes one, and three Xs ends the run.
- **The zone `min`/`max` values must tile the whole journey without gaps**, and
  the last one has to end at `winDistance` (40). The tests check this too.
- **Keep the `id`s** (`loc_theTalentShow`) as they are. Other files reference
  them: `images/loc_theTalentShow.svg` is that location's picture, and the tests
  look the assets up by id.
- **Commas and quotes are fine** — the file is properly quoted CSV, so
  `He said, "not yet."` needs no escaping. Just don't try to break out of the
  value with `</`, which the tool will reject.
- **But a value with a comma has to be wrapped in `"double quotes"`.** If it isn't,
  the comma splits the row and the rest of the sentence is dropped. The tool now
  catches this and names the row, but a spreadsheet will quote it for you
  automatically — which is the easy way to stay out of trouble.
- **The `PLACEHOLDER:` prefix** is only there to make it easy to search for
  what's still a first draft. It shows up in the game, so delete it from any row
  you've finished writing.
