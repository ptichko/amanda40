#!/usr/bin/env python3
"""
content/content.csv  ->  the CONTENT SECTION of index.html

The game is a single self-contained HTML file that has to keep working from
file:// with no server, so it cannot fetch() a CSV at runtime (browsers block
it: "Failed to fetch"). Instead the CSV is the *authoring* surface and this
tool bakes it into index.html.

    python tools/build_content.py            # rebuild index.html from the CSV
    python tools/build_content.py --check    # fail if index.html is stale (CI)
    python tools/build_content.py --export   # regenerate the CSV from index.html
    python tools/build_content.py --force    # apply even if index.html was hand-edited

One row per field, so every row is complete and a half-filled row can't mean
"delete this". Columns:

    kind         what the row is about
    parent       the id it belongs to (a location id, a zone number, a key)
    index        position within the parent, for ordered things (choices, panels)
    field        the property being set
    value        the value, verbatim

Kinds: config, zone, hint, intro, intro_panel, location, choice, end.
See content/README.md for the full field list.
"""

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(REPO, "index.html")
CONTENT_DIR = os.path.join(REPO, "content")
CSV_PATH = os.path.join(CONTENT_DIR, "content.csv")

BEGIN = "/* == BEGIN GENERATED CONTENT (from content/content.csv) == */"
END = "/* == END GENERATED CONTENT == */"
HASH_RE = re.compile(r"^/\* content-hash: ([0-9a-f]{64}) \*/$", re.M)

FIELDS = ["kind", "parent", "index", "field", "value"]

INT_FIELDS = {
    ("config", "winDistance"),
    ("config", "maxPenaltyPoints"),
    ("config", "minTravel"),
    ("config", "maxTravel"),
    ("zone", "min"),
    ("zone", "max"),
    ("location", "zone"),
    ("location", "weight"),
    ("hint", "weight"),
}
FLOAT_FIELDS = {("config", "oracleAppearChance")}
BOOL_FIELDS = {("choice", "oracle_correct")}
OPTIONAL_FIELDS = {("hint", "weight"), ("choice", "outcome_image")}


class ContentError(Exception):
    pass


# --------------------------------------------------------------------------
# reading
# --------------------------------------------------------------------------

def coerce(kind, field, raw, where, type_key=None):
    """Turn one CSV cell into the JS value it should become.

    `type_key` is what picks the numeric type: for a config row the meaningful
    name is the parent (winDistance), not the field, which is always "value".
    """
    key = (kind, type_key or field)
    if key in INT_FIELDS:
        try:
            return int(raw)
        except ValueError:
            raise ContentError("%s: %s must be a whole number, got %r" % (where, field, raw))
    if key in FLOAT_FIELDS:
        try:
            return float(raw)
        except ValueError:
            raise ContentError("%s: %s must be a number, got %r" % (where, field, raw))
    if (kind, field) in BOOL_FIELDS:
        low = raw.strip().lower()
        if low in ("true", "yes", "1"):
            return True
        if low in ("false", "no", "0"):
            return False
        raise ContentError("%s: oracle_correct must be true or false, got %r" % (where, raw))
    return raw


def slot_key(kind, parent, index):
    """Choices are keyed per location *and* position; everything else by its own id."""
    if kind == "choice":
        if not parent or not index:
            raise ContentError("a choice row needs both a location id and an index")
        return "%s#%s" % (parent, index)
    if kind == "intro":
        return "intro"  # there is only ever one intro card
    key = parent or index
    if not key:
        raise ContentError("a %s row needs a parent or an index" % kind)
    return key


def read_csv(path=CSV_PATH):
    if not os.path.exists(path):
        raise ContentError(
            "no %s -- run with --export to create it from index.html" % os.path.relpath(path, REPO)
        )
    buckets = {}
    seen = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames != FIELDS:
            raise ContentError(
                "%s must have exactly the columns %s, found %s"
                % (os.path.relpath(path, REPO), ",".join(FIELDS), reader.fieldnames)
            )
        for n, row in enumerate(reader, start=2):
            # A value containing a comma but no surrounding quotes lands in the
            # restkey as an extra column. Without this check the rest of the
            # sentence is dropped on the floor without a word.
            if None in row:
                raise ContentError(
                    "row %d: %d fields for %d columns -- a value probably contains a "
                    "comma but isn't quoted. Wrap it in \"double quotes\"."
                    % (n, len(row) - 1 + len(row[None]), len(FIELDS))
                )
            kind = (row["kind"] or "").strip()
            parent = (row["parent"] or "").strip()
            index = (row["index"] or "").strip()
            field = (row["field"] or "").strip()
            value = row["value"]
            if value is None:
                raise ContentError("row %d: value is missing" % n)
            if not kind or not field:
                raise ContentError("row %d: kind and field are required" % n)
            where = "row %d (%s %s)" % (n, kind, parent or index)
            if value.strip() == "" and (kind, field) in OPTIONAL_FIELDS:
                continue
            key = slot_key(kind, parent, index)
            slots = buckets.setdefault(kind, {})
            # first appearance in the file decides order, so the author controls
            # the sequence by where they put the rows
            if key not in slots:
                seen.setdefault(kind, []).append(key)
            slot = slots.setdefault(key, {})
            if field in slot:
                raise ContentError("%s: field %r set twice" % (where, field))
            value = coerce(kind, field, value, where,
                           type_key=parent if kind == "config" else None)
            # only the choice that actually happened is marked, so keep false out
            # of the data entirely and let it stay absent
            if (kind, field) in BOOL_FIELDS and value is False:
                continue
            slot[field] = value

    content = buckets
    order = lambda kind: seen.get(kind, [])

    def need(kind, key, *fields):
        slot = content.get(kind, {}).get(key)
        if slot is None:
            raise ContentError("no %s row for %r (expected one with parent or index %r)"
                               % (kind, kind, key))
        for f in fields:
            if f not in slot:
                raise ContentError("%s %s: missing field %r" % (kind, key, f))
        return slot

    out = {}
    out["CONFIG"] = {k: v["value"] for k, v in content.get("config", {}).items()}

    out["ZONES"] = [
        {"id": int(k), "name": content["zone"][k]["name"],
         "min": content["zone"][k]["min"], "max": content["zone"][k]["max"]}
        for k in sorted(content.get("zone", {}), key=lambda s: int(s))
    ]
    out["ORACLE_HINTS"] = [
        {k: v for k, v in content["hint"][k].items() if k in ("text", "weight")}
        for k in order("hint")
    ]

    intro = need("intro", "intro")
    out["INTRO_LOCATION"] = {
        "id": intro["id"], "name": intro["name"], "image": intro["image"],
        "description": intro["description"],
        "choices": [{
            "label": intro["choice_label"],
            "outcome": {"type": intro["choice_outcome_type"],
                        "text": intro["choice_outcome_text"]},
        }],
    }
    out["INTRO_SEQUENCE"] = [
        {f: content["intro_panel"][k][f] for f in ("image", "title", "caption", "button")}
        for k in order("intro_panel")
    ]

    locations = []
    for loc_id in order("location"):
        slot = content["location"][loc_id]
        for f in ("name", "image", "description"):
            need("location", loc_id, f)
        ckeys = [k for k in order("choice") if k.rsplit("#", 1)[0] == loc_id]
        if not ckeys:
            raise ContentError("location %s has no choice rows" % loc_id)
        choices = []
        for ck in ckeys:
            cslot = content["choice"][ck]
            for f in ("label", "outcome_type", "outcome_text"):
                need("choice", ck, f)
            outcome = {"type": cslot["outcome_type"], "text": cslot["outcome_text"]}
            if "outcome_image" in cslot:
                outcome["image"] = cslot["outcome_image"]
            choice = {"label": cslot["label"], "outcome": outcome}
            if cslot.get("oracle_correct"):
                choice["oracleCorrect"] = True
            choices.append(choice)
        locations.append({
            "id": loc_id, "name": slot["name"], "image": slot["image"],
            "description": slot["description"],
            "zone": slot["zone"], "weight": slot.get("weight", 1),
            "choices": choices,
        })
    out["LOCATIONS"] = locations

    end = {}
    for key in ("win", "gameover"):
        need("end", key, "title", "image")
        end[key] = dict(content["end"][key])
    if "goodMessage" not in end["win"] or "badMessage" not in end["win"]:
        raise ContentError("end win needs both goodMessage and badMessage")
    if "message" not in end["gameover"]:
        raise ContentError("end gameover needs a message")
    out["END_TEXT"] = end
    return out


def order_key(k):
    try:
        return (0, int(k))
    except (TypeError, ValueError):
        return (1, str(k))


def read_index():
    if not os.path.exists(INDEX):
        raise ContentError("no index.html at %s" % INDEX)
    with open(INDEX, encoding="utf-8") as fh:
        return fh.read()


def read_content_from_index():
    """Evaluate the CONTENT SECTION with the repo's own dom_stub and return JSON.

    Node writes UTF-8; it must be decoded as UTF-8 explicitly. Letting Python
    pick the locale codec (cp1252 on Windows) turns every em dash into mojibake
    and blows up outright on characters like U+201D, so the text would be
    silently corrupted on the way into the CSV.
    """
    script = (
        "const d=require(process.argv[1]);"
        "process.stdout.write(JSON.stringify(d.contentObject()));"
    )
    stub = os.path.join(REPO, "tools", "dom_stub.js")
    res = subprocess.run(["node", "-e", script, stub], cwd=REPO, capture_output=True)
    if res.returncode != 0:
        raise ContentError(
            "could not read the content section out of index.html:\n"
            + res.stderr.decode("utf-8", "replace")
        )
    return json.loads(res.stdout.decode("utf-8"))


# --------------------------------------------------------------------------
# writing
# --------------------------------------------------------------------------

def j(value):
    """A JS string literal. JSON quoting handles apostrophes and quotes for us."""
    if not isinstance(value, str):
        return json.dumps(value)
    for bad in ("</", "<!--", " ", " "):
        if bad in value:
            raise ContentError("value contains %r, which would break out of the <script> block: %r"
                               % (bad, value[:60]))
    return json.dumps(value, ensure_ascii=False)


def emit_js(c):
    L = []
    a = L.append
    a("const CONFIG = {")
    a("  winDistance: %s,    // total steps needed to win (thematically: forty)"
      % json.dumps(c["CONFIG"]["winDistance"]))
    a("  maxPenaltyPoints: %s, // stumbles (red Xs) that end the game"
      % json.dumps(c["CONFIG"]["maxPenaltyPoints"]))
    a("  minTravel: %s,       // min steps gained per action"
      % json.dumps(c["CONFIG"]["minTravel"]))
    a("  maxTravel: %s,       // max steps gained per action"
      % json.dumps(c["CONFIG"]["maxTravel"]))
    a("  oracleAppearChance: %s // odds the \"Consult the Oracle\" option shows up;"
      " 1 = she is always there" % num(c["CONFIG"]["oracleAppearChance"]))
    a("};")
    a("")
    a("// The journey is three eras, split by progress. Each location belongs to exactly")
    a("// one zone (see LOCATIONS below), and only locations in the player's current zone")
    a("// are eligible to be picked next. Boundaries are also drawn as markers on the")
    a("// progress bar, and the zone name is called out on the transition card -- which")
    a("// is why they carry the years.")
    a("const ZONES = [")
    a(",\n".join(
        "  { id: %d, name: %s, min: %d, max: %d }" % (z["id"], j(z["name"]), z["min"], z["max"])
        for z in c["ZONES"]
    ))
    a("];")
    a("")
    a("// The Oracle's possible hints. Each time she is consulted, one entry is picked")
    a("// (weighted by optional `weight`, default 1 if omitted). The text is pure flavour:")
    a("// she always highlights the location's actual \"correct\" choice (see")
    a("// getCorrectChoice below), so there is no accuracy roll to tune.")
    a("const ORACLE_HINTS = [")
    a(",\n".join("  " + emit_hint(h) for h in c["ORACLE_HINTS"]))
    a("];")
    a("")
    a("// Each choice has a single, fixed outcome (no randomness in *what*")
    a("// happens -- only *how far* the player travels stays random). outcome.type")
    a("// is one of:")
    a("//   'normal'   -> flavor text only")
    a("//   'penalty'  -> gain 1 stumble point (a red X); 3 points ends the game")
    a("//   'heal'     -> remove 1 stumble point (floor of 0)")
    a("//   'gameover' -> the journey ends immediately, regardless of stumble points")
    a("// outcome.text is shown inline, right in the scrolling feed, after the")
    a("// choice is made. outcome.image is optional -- set it to show a picture")
    a("// inside the outcome box.")
    a("")
    a("// The player always starts here, before any zone locations. It has no")
    a("// `zone` and lives outside LOCATIONS, so it's never picked by the normal")
    a("// zone-based selection (pickNextLocation) -- newGame() always sends the")
    a("// player here first.")
    i = c["INTRO_LOCATION"]
    a("const INTRO_LOCATION = {")
    a("  id: %s, name: %s, image: %s," % (j(i["id"]), j(i["name"]), j(i["image"])))
    a("  description: %s," % j(i["description"]))
    a("  choices: [")
    a("    { label: %s, outcome: { type: %s, text: %s } },"
      % (j(i["choices"][0]["label"]), j(i["choices"][0]["outcome"]["type"]),
         j(i["choices"][0]["outcome"]["text"])))
    a("  ],")
    a("};")
    a("")
    a("// Pixel-art panels that play once, after \"Begin the journey\" and before the")
    a("// first zone -- see playIntroSequence() in the engine. Deliberately not")
    a("// locations: no choices, no outcome, never repeated, so they live outside")
    a("// LOCATIONS and outside the album. Add as many as you like; each gets a")
    a("// Continue button and the last one hands control back to the game.")
    a("const INTRO_SEQUENCE = [")
    a(",\n".join(
        "  {\n    image: %s,\n    title: %s,\n    caption: %s,\n    button: %s,\n  }"
        % (j(p["image"]), j(p["title"]), j(p["caption"]), j(p["button"]))
        for p in c["INTRO_SEQUENCE"]
    ))
    a("];")
    a("")
    a("// Locations the player can land on. Each has a `zone` (1, 2, or 3 -- see")
    a("// ZONES above) and only locations in the player's current zone are")
    a("// eligible to be picked next. `weight` controls relative likelihood among")
    a("// locations within the same zone. Each choice carries a fixed")
    a("// `outcome: { type, text }` (type is one of the four listed above).")
    a("//")
    a("// The choice marked `oracleCorrect: true` is the one that actually happened --")
    a("// the Oracle points at the real thing, which is why it beats the automatic")
    a("// best-outcome ranking in getCorrectChoice(). The others are the roads not")
    a("// taken.")
    a("const LOCATIONS = [")
    by_zone = {}
    for loc in c["LOCATIONS"]:
        by_zone.setdefault(loc["zone"], []).append(loc)
    blocks = []
    for zone in c["ZONES"]:
        if zone["id"] not in by_zone:
            continue
        name = next((z["name"] for z in c["ZONES"] if z["id"] == zone["id"]), "")
        blocks.append("  // --- Zone %d: %s (%d-%d) ---"
                      % (zone["id"], name, zone["min"], zone["max"]))
        for loc in by_zone[zone["id"]]:
            blocks.append(emit_location(loc))
    a("\n".join(blocks))
    a("];")
    a("")
    a("const END_TEXT = {")
    w = c["END_TEXT"]["win"]
    a("  win: {")
    a("    title: %s," % j(w["title"]))
    a("    goodMessage: %s," % j(w["goodMessage"]))
    a("    badMessage: %s," % j(w["badMessage"]))
    a("    image: %s," % j(w["image"]))
    a("  },")
    g = c["END_TEXT"]["gameover"]
    a("  gameover: {")
    a("    title: %s," % j(g["title"]))
    a("    message: %s," % j(g["message"]))
    a("    image: %s," % j(g["image"]))
    a("  },")
    a("};")
    return "\n".join(L)


def num(value):
    """JSON for a number, without a pointless trailing .0 on whole floats."""
    if isinstance(value, float) and value.is_integer():
        return json.dumps(int(value))
    return json.dumps(value)


def normalize(body):
    """The one canonical form of a generated block, for hashing and comparing."""
    return body.strip("\n")


def emit_hint(h):
    parts = ["text: %s" % j(h["text"])]
    if "weight" in h:
        parts.append("weight: %s" % json.dumps(h["weight"]))
    return "{ " + ", ".join(parts) + " }"


def emit_location(loc):
    L = ["  {"]
    L.append("    id: %s, name: %s, image: %s," % (j(loc["id"]), j(loc["name"]), j(loc["image"])))
    L.append("    description: %s," % j(loc["description"]))
    L.append("    zone: %d, weight: %d," % (loc["zone"], loc["weight"]))
    L.append("    choices: [")
    rows = []
    for ch in loc["choices"]:
        bits = ["label: %s" % j(ch["label"])]
        if ch.get("oracleCorrect"):
            bits.append("oracleCorrect: true")
        oc = ["type: %s" % j(ch["outcome"]["type"]), "text: %s" % j(ch["outcome"]["text"])]
        if ch["outcome"].get("image"):
            oc.append("image: %s" % j(ch["outcome"]["image"]))
        rows.append("      { %s, outcome: { %s } }" % (", ".join(bits), ", ".join(oc)))
    L.append(",\n".join(rows))
    L.append("    ],")
    L.append("  },")
    return "\n".join(L)


def digest(body):
    return hashlib.sha256(normalize(body).encode("utf-8")).hexdigest()


def split_generated(html):
    """Return (body, stored_hash) for the generated block, or (None, None)."""
    if BEGIN not in html or END not in html:
        return None, None
    start = html.index(BEGIN) + len(BEGIN)
    end = html.index(END)
    block = html[start:end]
    m = HASH_RE.search(block)
    body = normalize(HASH_RE.sub("", block))
    return body, (m.group(1) if m else None)


def stamp(body):
    return "\n\n/* content-hash: %s */\n" % digest(body)


# --------------------------------------------------------------------------
# commands
# --------------------------------------------------------------------------

def engine_start(html):
    """Offset of the comment that opens the ENGINE SECTION banner.

    Note: rindex(sub, start) in Python searches *forward* from start, unlike
    JS lastIndexOf, so the end has to be given explicitly to search backwards.
    """
    banner = html.index("   ENGINE SECTION")
    return html.rindex("/*", 0, banner)


def cmd_check():
    body, stored = split_generated(read_index())
    if body is None:
        print("FAIL: index.html has no generated-content markers.\n"
              "      Run: python tools/build_content.py --force", file=sys.stderr)
        return 1
    want = normalize(emit_js(read_csv()))
    if digest(body) != stored:
        print("FAIL: the generated block in index.html was hand-edited "
              "(its content-hash does not match).\n"
              "      Rebuild from the CSV, or pass --force if the edit was intended.",
              file=sys.stderr)
        return 1
    if body != want:
        print("FAIL: index.html is stale -- it does not match content/content.csv.\n"
              "      Fix with: python tools/build_content.py", file=sys.stderr)
        return 1
    print("content: index.html matches content/content.csv")
    return 0


def cmd_apply(force):
    want = normalize(emit_js(read_csv()))
    html = read_index()
    body, stored = split_generated(html)
    if body is None:
        if not force:
            print("index.html has no generated-content markers yet.\n"
                  "Re-run with --force to add them (this rewrites the CONTENT SECTION).",
                  file=sys.stderr)
            return 1
        anchor = html.index("const CONFIG")
        head = html[:anchor].rstrip("\n")
        tail = html[engine_start(html):]
        html = "%s\n\n%s\n%s%s\n%s\n\n%s" % (head, BEGIN, want, stamp(want), END, tail)
    else:
        if stored and digest(body) != stored and not force:
            print("refusing to overwrite: the generated block in index.html was edited\n"
                  "by hand since it was last built (its content-hash does not match).\n"
                  "Re-run with --force to discard those edits and rebuild from the CSV.",
                  file=sys.stderr)
            return 1
        start = html.index(BEGIN) + len(BEGIN)
        end = html.index(END)
        html = html[:start] + "\n" + want + stamp(want) + "\n" + html[end:]
    with open(INDEX, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    print("wrote %s from %s" % (os.path.relpath(INDEX, REPO), os.path.relpath(CSV_PATH, REPO)))
    return 0


def cmd_export():
    c = read_content_from_index()
    rows = []

    def add(kind, parent, index, field, value):
        if isinstance(value, bool):
            value = "true" if value else "false"
        elif isinstance(value, float):
            value = repr(value)
        rows.append([kind, parent, index, field, str(value)])

    for k, v in c["CONFIG"].items():
        add("config", k, "", "value", v)
    for z in c["ZONES"]:
        for f in ("name", "min", "max"):
            add("zone", str(z["id"]), "", f, z[f])
    for n, h in enumerate(c["ORACLE_HINTS"]):
        for f in ("text", "weight"):
            if f in h:
                add("hint", "", str(n), f, h[f])
    i = c["INTRO_LOCATION"]
    for f in ("id", "name", "image", "description"):
        add("intro", "", "", f, i[f])
    ch = i["choices"][0]
    add("intro", "", "", "choice_label", ch["label"])
    add("intro", "", "", "choice_outcome_type", ch["outcome"]["type"])
    add("intro", "", "", "choice_outcome_text", ch["outcome"]["text"])
    for n, p in enumerate(c["INTRO_SEQUENCE"]):
        for f in ("image", "title", "caption", "button"):
            add("intro_panel", "", str(n), f, p[f])
    for loc in c["LOCATIONS"]:
        for f in ("name", "image", "zone", "weight", "description"):
            add("location", loc["id"], "", f, loc[f])
        for n, ch in enumerate(loc["choices"]):
            key = "%s#%d" % (loc["id"], n)
            add("choice", loc["id"], str(n), "label", ch["label"])
            if ch.get("oracleCorrect"):
                add("choice", loc["id"], str(n), "oracle_correct", True)
            add("choice", loc["id"], str(n), "outcome_type", ch["outcome"]["type"])
            add("choice", loc["id"], str(n), "outcome_text", ch["outcome"]["text"])
            if ch["outcome"].get("image"):
                add("choice", loc["id"], str(n), "outcome_image", ch["outcome"]["image"])
    for key, slot in c["END_TEXT"].items():
        for f, v in slot.items():
            add("end", key, "", f, v)

    os.makedirs(CONTENT_DIR, exist_ok=True)
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(FIELDS)
        w.writerows(rows)
    print("wrote %s (%d rows) from index.html" % (os.path.relpath(CSV_PATH, REPO), len(rows)))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="fail if index.html is stale")
    ap.add_argument("--export", action="store_true", help="write the CSV from index.html")
    ap.add_argument("--force", action="store_true", help="apply even if index.html was hand-edited")
    args = ap.parse_args()
    try:
        if args.check:
            return cmd_check()
        if args.export:
            return cmd_export()
        return cmd_apply(args.force)
    except ContentError as exc:
        print("error: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
