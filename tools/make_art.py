"""Pixel-art generator for The Fourth Decade.

DEV TOOL. The game does not use this, does not call it, and does not depend
on it: index.html just reads the SVG files this writes into images/. There is
still no build step and no runtime dependency -- Python is only needed if you
want to change the art.

Everything is composed on a character grid (one character per pixel), then
emitted as SVG with one <path> per colour -- horizontal runs merged -- and
shape-rendering="crispEdges", so the art stays a few KB and stays blocky at any
zoom. Dithered skies come from a 4x4 Bayer matrix; the sprite gets its dark
outline from an automatic pass over the silhouette.

Usage
-----
    python tools/make_art.py                  # regenerate every image
    python tools/make_art.py --list           # show what it would write
    python tools/make_art.py --preview        # print the sprite as ASCII
    python tools/make_art.py --check          # fail if images/ is out of date
    python tools/make_art.py win.svg          # regenerate just one file

Editing the character
---------------------
Change `amanda()` for the sprite (hair colour is 'h'/'H'/'L' in PAL, the
jacket is 't'/'T', the scarf 'm'/'M'), then re-run and look at
`index.html?debug=true`. `amanda(hat=True)` is the taller variant with the
striped party hat, used by the intro card. Change the scenes to move her
around or restage a background. Nothing else in the repo needs to know.
"""
import io
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'images')

# ---------------------------------------------------------------- palette
PAL = {
    'o': '#14102a',   # outline
    'H': '#b8781e',   # hair shadow
    'h': '#f0c060',   # blonde
    'L': '#ffeeb0',   # blonde highlight
    's': '#f4c9a4',   # skin
    'S': '#cf9468',   # skin shadow
    'e': '#14102a',   # eyes
    't': '#20b0b0',   # teal jacket
    'T': '#12807f',   # teal shadow
    'm': '#e040a0',   # magenta scarf
    'M': '#a82878',   # magenta shadow
    'd': '#3a5aa8',   # jeans
    'D': '#2a3f7a',   # jeans shadow
    'b': '#503828',   # boots
    'w': '#ffffff',
    'k': '#c8c8c8',
    'g': '#d8d8d8',
    'c': '#00e0e0',   # cyan
    'C': '#008888',
    'p': '#ff00ff',   # magenta
    'P': '#a800a8',
    'l': '#80ff40',   # lime
    'y': '#ffe040',   # candle flame
    'n': '#1a1a2e',   # night ground
    'N': '#242440',
    'v': '#0a0a1e',   # dark
    'f': '#606090',   # far
    'F': '#7878a8',
    'r': '#d04030',   # red
}

BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


def hx(c):
    return PAL[c] if len(c) == 1 else c


class Grid:
    def __init__(self, w, h, bg='.'):
        self.w, self.h = w, h
        self.g = [[bg] * w for _ in range(h)]

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h and c != '.':
            self.g[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def hline(self, x0, x1, y, c):
        for x in range(x0, x1 + 1):
            self.px(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(y0, y1 + 1):
            self.px(x, y, c)

    def blit(self, sub, x, y):
        for yy in range(sub.h):
            for xx in range(sub.w):
                self.px(x + xx, y + yy, sub.g[yy][xx])

    def disc(self, cx, cy, r, c):
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.px(x, y, c)

    def crop(self, y0, y1):
        sub = Grid(self.w, y1 - y0 + 1)
        for y in range(y0, y1 + 1):
            sub.g[y - y0] = list(self.g[y])
        return sub

    # Darkens the silhouette: any empty cell touching a filled one becomes an
    # outline cell. Only the outside edge and any holes get outlined, never the
    # boundary between two colours.
    def outline(self, c='o'):
        todo = set()
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != '.':
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and self.g[ny][nx] != '.':
                        todo.add((x, y))
                        break
        for x, y in todo:
            self.g[y][x] = c

    def to_svg(self, scale, bg=None, label=''):
        parts = []
        if bg:
            parts.append('<rect width="%d" height="%d" fill="%s"/>'
                         % (self.w * scale, self.h * scale, hx(bg)))
        for c in sorted(set(ch for row in self.g for ch in row) - {'.'}):
            d = []
            for y in range(self.h):
                x = 0
                while x < self.w:
                    if self.g[y][x] != c:
                        x += 1
                        continue
                    run = 0
                    while x + run < self.w and self.g[y][x + run] == c:
                        run += 1
                    d.append('M%d %dh%dv%dh-%dz'
                             % (x * scale, y * scale, run * scale, scale, run * scale))
                    x += run
            if d:
                parts.append('<path fill="%s" d="%s"/>' % (hx(c), ''.join(d)))
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" '
            'height="%d" shape-rendering="crispEdges" role="img" aria-label="%s">%s</svg>\n'
            % (self.w * scale, self.h * scale, self.w * scale, self.h * scale,
               label, ''.join(parts))
        )

    def show(self):
        """Print the grid as ASCII, for checking a sprite in a terminal."""
        for row in self.g:
            print(''.join(' ' if ch == '.' else ch for ch in row))


# ---------------------------------------------------------------- glyphs
# 5x7 blocky capitals. The scenes currently only use '4' and '0'; the rest are
# here so a sign or a caption can be added without redrawing a font.
GLYPHS = {
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '3': ['####.', '....#', '..##.', '....#', '....#', '#...#', '.###.'],
    'H': ['#...#', '#...#', '#####', '#...#', '#...#', '#...#', '#...#'],
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
}


def text(layer, s, x, y, scale, main='w', shadow='p', shadow_off=3, outline='o'):
    """Draw a short uppercase string, blocky: drop shadow, 1px outline, face.

    Built at cell resolution first so the outline is one *pixel* thick, not one
    glyph cell -- otherwise it swallows the shadow at these sizes.
    """
    cols = (sum(len(GLYPHS[ch][0]) + 1 for ch in s) * scale) - scale
    t = Grid(cols, 7 * scale)
    ox = 0
    for ch in s:
        for gy, grow in enumerate(GLYPHS[ch]):
            for gx, g in enumerate(grow):
                if g == '#':
                    t.rect(ox + gx * scale, gy * scale,
                           ox + (gx + 1) * scale - 1, (gy + 1) * scale - 1, 'w')
        ox += (len(GLYPHS[ch][0]) + 1) * scale
    if outline:
        t.outline(outline)

    if shadow:
        for yy in range(t.h):
            for xx in range(t.w):
                if t.g[yy][xx] != '.':
                    layer.px(x + xx + shadow_off, y + yy + shadow_off, shadow)
    for yy in range(t.h):
        for xx in range(t.w):
            v = t.g[yy][xx]
            if v != '.':
                layer.px(x + xx, y + yy, main if v == 'w' else outline)


# ---------------------------------------------------------------- the sprite
# Vertical headroom added when she wears the birthday hat, in cells. The cone
# occupies rows 0..HAT_PAD-1, the brim sits on row HAT_PAD, and the brim lands on
# the top outline row of the bare sprite -- so her boots end up on the same line
# of ground in both variants.
HAT_PAD = 11

# Party hat, drawn top-down as (row, x0, x1). It leans to her left, away from the
# waving hand: the left edge steps left and the right edge steps in, so the cone
# reads as tilted rather than as a right triangle.
HAT_CONE = [
    (10, 10, 17),
    (9, 10, 16),
    (8, 9, 15),
    (7, 9, 14),
    (6, 8, 13),
    (5, 8, 12),
    (4, 7, 11),
    (3, 7, 10),
    (2, 6, 8),
]
HAT_POM = [(0, 4, 8), (1, 5, 7)]
HAT_BRIM = (7, 17)   # x0, x1 on row HAT_PAD


def amanda(frame=0, hat=False):
    """24x31 character grid: blonde, teal jacket, magenta scarf, waving.

    frame 0 standing, frame 1 mid-step (one-pixel bob), frame 2 a wider stride.

    hat=True adds a striped party hat with a lime pom-pom. It needs headroom, so
    that variant comes back HAT_PAD cells taller with everything drawn in the
    extra space.
    """
    g = Grid(24, 31)
    # head
    g.rect(7, 1, 16, 17, 'H')       # long hair, back
    g.rect(8, 2, 15, 16, 'h')       # hair volume
    g.hline(9, 11, 3, 'L')          # highlight
    g.rect(9, 6, 14, 11, 's')       # face
    g.rect(9, 5, 14, 6, 'h')        # fringe
    g.px(10, 8, 'e')                # eyes
    g.px(13, 8, 'e')
    g.hline(11, 12, 10, 'S')        # smile
    g.rect(11, 12, 12, 13, 's')     # neck
    # right arm goes up first, so the shoulder reads as in front of the hair
    g.rect(18, 4, 19, 14, 't')
    g.rect(18, 1, 20, 2, 's')       # hand, waving above her head
    g.hline(18, 19, 3, 's')          # ...with a notch, so it reads as fingers
    # body
    g.rect(8, 13, 17, 21, 't')      # jacket
    g.vline(8, 14, 21, 'T')
    g.vline(17, 14, 21, 'T')
    g.rect(9, 12, 10, 16, 'H')      # hair falling in front, both sides
    g.rect(15, 12, 16, 16, 'H')
    g.hline(11, 15, 13, 'm')        # scarf
    g.vline(14, 14, 17, 'M')
    g.px(15, 15, 'm')
    g.rect(6, 14, 7, 20, 't')       # left arm, hanging
    g.rect(6, 21, 7, 22, 's')       # hand
    # legs -- frame 2 takes a wider stride so the cycle has some travel in it
    if frame == 2:
        g.rect(8, 22, 15, 27, 'd')
        g.vline(11, 22, 27, 'D')
        g.vline(12, 22, 27, 'D')
        g.rect(6, 28, 9, 29, 'b')     # boots
        g.rect(14, 28, 17, 29, 'b')
    else:
        g.rect(9, 22, 14, 27, 'd')
        g.vline(11, 22, 27, 'D')
        g.vline(12, 22, 27, 'D')
        g.rect(7, 28, 10, 29, 'b')    # boots
        g.rect(12, 28, 15, 29, 'b')
    if frame == 1:
        # one-pixel bob: everything above the boots lifts, feet stay planted
        g.blit(g.crop(0, 27), 0, -1)
    g.outline()

    if not hat:
        return g

    tall = Grid(24, 31 + HAT_PAD)
    tall.blit(g, 0, HAT_PAD)

    # pom-pom first, so the cone's tip tucks under it
    for i, (row, x0, x1) in enumerate(HAT_POM):
        tall.hline(x0, x1, row, 'l')
    tall.px(5, 0, 'y')
    tall.px(6, 0, 'y')
    # striped cone, magenta and white
    for i, (row, x0, x1) in enumerate(HAT_CONE):
        tall.hline(x0, x1, row, 'w' if i % 2 else 'm')
    # brim, over the top of her hair
    tall.hline(HAT_BRIM[0], HAT_BRIM[1], HAT_PAD, 'w')
    tall.outline()
    return tall


# ---------------------------------------------------------------- scenes
# 80x45 cells at 8px each = the 640x360 cards the game displays.
W, H, CELL = 80, 45, 8


def mix(c1, c2, t):
    """Blend two palette colours; t=0 -> c1, t=1 -> c2."""
    a, b = PAL[c1], PAL[c2]
    av = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    bv = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#%02x%02x%02x' % tuple(int(round(av[i] + (bv[i] - av[i]) * t)) for i in range(3))


def ramp(c1, c2, steps):
    """A dither-friendly multi-stop ramp between two colours."""
    return [(i / float(steps - 1), mix(c1, c2, i / float(steps - 1)))
            for i in range(steps)]


def sky(g, stops):
    """Fill the grid with a vertically graded, ordered-dithered sky."""
    for y in range(g.h):
        p = y / (g.h - 1.0)
        lo, hi, f = stops[0][1], stops[-1][1], 0.0
        for i in range(len(stops) - 1):
            a, b = stops[i], stops[i + 1]
            if a[0] <= p <= b[0]:
                lo, hi = a[1], b[1]
                f = (p - a[0]) / (b[0] - a[0] or 1)
                break
        else:
            lo = hi
        for x in range(g.w):
            g.px(x, y, hi if BAYER4[y % 4][x % 4] / 16.0 < f else lo)


def stars(g, seed, n, rows=(0, 34)):
    """Scattered single pixels. Seeded, so re-running gives the same sky."""
    rnd = random.Random(seed)
    for _ in range(n):
        g.px(rnd.randrange(g.w), rnd.randrange(*rows), rnd.choice(['w', 'w', 'c', 'g']))


def ground(g, top, bands=('N', 'n', 'v'), tufts=0, seed=1):
    for y in range(top, g.h):
        g.hline(0, g.w - 1, y, bands[min(2, (y - top) // 4)])
    rnd = random.Random(seed)
    for _ in range(tufts):
        g.px(rnd.randrange(g.w), rnd.randrange(top + 1, g.h), rnd.choice(['T', 'C', 'f']))


def confetti(g, seed, n, rows=(0, 40)):
    rnd = random.Random(seed)
    for _ in range(n):
        g.px(rnd.randrange(g.w), rnd.randrange(*rows), rnd.choice(['p', 'c', 'l', 'y', 'w']))


def scene_intro():
    g = Grid(W, H)
    sky(g, ramp('v', 'C', 7))
    stars(g, 7, 90, (0, 30))
    text(g, '40', 45, 3, 3, 'w', 'p', 3)
    ground(g, 31, ('F', 'f', 'C'), tufts=26, seed=3)
    g.hline(0, W - 1, 30, 'c')
    # She wears the hat here, which makes the sprite HAT_PAD cells taller, so
    # she is blitted higher to keep her boots on the same line of ground — plus
    # one extra row so the pom-pom isn't flush against the top of the card.
    g.blit(amanda(0, hat=True), 12, 13 - HAT_PAD)
    return g


def scene_win():
    g = Grid(W, H)
    sky(g, ramp('P', 'M', 7))
    stars(g, 11, 40, (0, 16))
    confetti(g, 5, 170)
    text(g, '40', 45, 2, 3, 'y', 'P', 3)
    ground(g, 31, ('f', 'F', 'f'), tufts=20, seed=9)
    g.hline(0, W - 1, 30, 'y')
    # cake
    g.rect(40, 36, 60, 42, 'g')
    g.hline(40, 60, 36, 'w')
    g.hline(40, 60, 40, 'm')
    g.rect(44, 32, 56, 36, 'w')
    g.hline(44, 56, 33, 'm')
    for cx in (46, 50, 54):
        g.vline(cx, 29, 31, 'c')
        g.px(cx, 28, 'y')
    g.blit(amanda(), 12, 12)
    return g


def dropped_cake(g, x, y):
    """The birthday cake, on the ground after a bad run.

    Same colours as the upright cake on the win card -- it's the same cake. A
    tiered cake knocked over doesn't stay a tidy block, so this is drawn as the
    big tier on its side with the layers showing at the cut end, the top tier
    slid off beside it, icing squashed out onto the ground, and the candles
    lying where they fell.
    """
    # the big tier, on its side
    g.rect(x, y, x + 15, y + 4, 'g')
    g.hline(x, x + 15, y, 'w')          # icing along the top
    g.hline(x, x + 15, y + 2, 'm')      # filling
    g.hline(x, x + 15, y + 4, 'k')      # shadowed underside
    g.vline(x, y, y + 4, 'w')           # the cut end, layers showing
    g.vline(x + 1, y + 1, y + 3, 'k')
    g.vline(x + 2, y + 1, y + 3, 'm')

    # the top tier, slid off to the right
    g.rect(x + 18, y + 2, x + 25, y + 5, 'g')
    g.hline(x + 18, x + 25, y + 2, 'w')
    g.hline(x + 18, x + 25, y + 4, 'm')
    g.vline(x + 18, y + 2, y + 5, 'w')

    # icing that squashed out of it
    g.hline(x + 9, x + 14, y + 5, 'w')
    g.hline(x + 12, x + 16, y + 6, 'm')
    g.px(x + 17, y + 6, 'w')

    # candles, knocked over, lying between her and the cake. Two rows apart with
    # a wax tip and a spent wick, so they read as two sticks rather than a smear.
    g.hline(x - 9, x - 4, y + 6, 'c')
    g.px(x - 10, y + 6, 'k')
    g.px(x - 3, y + 6, 'w')
    g.hline(x - 6, x - 1, y + 8, 'c')
    g.px(x - 7, y + 8, 'k')
    g.px(x, y + 8, 'w')

    # crumbs
    g.px(x - 11, y + 8, 'g')
    g.px(x + 28, y + 6, 'g')
    g.px(x + 27, y + 7, 'k')


def scene_gameover():
    g = Grid(W, H)
    sky(g, [(0.0, 'v'), (0.6, 'v'), (0.75, 'N'), (1.0, 'N')])
    stars(g, 3, 26, (0, 26))
    g.disc(62, 8, 7, 'g')          # moon
    g.disc(59, 6, 2, 'k')
    g.disc(65, 11, 1, 'k')
    for cx, cy, r in ((20, 9, 3), (34, 6, 2), (46, 12, 3)):   # clouds
        g.disc(cx, cy, r, 'f')
        g.disc(cx + r, cy, r, 'f')
    ground(g, 31, ('N', 'n', 'v'), tufts=10, seed=5)
    g.hline(0, W - 1, 30, 'f')
    g.blit(amanda(), 12, 12)
    # The cake, on the ground beside her. It sits a few rows higher than her
    # boots, which reads as "a bit further down the road" and keeps it clear of
    # the bottom edge of the card.
    dropped_cake(g, 38, 33)
    return g


def walker(frame=0):
    """24x31, drawn small enough to ride the progress bar."""
    return amanda(frame)


# Every file this script owns. The six placeholder loc_*.svg files in images/
# are NOT in here -- those are meant to be replaced with real art by hand.
JOBS = [
    ('loc_intro.svg', scene_intro, CELL, 'v',
     'Pixel art: Amanda in a birthday hat, waving on the road beneath a starry sky and the number 40'),
    ('win.svg', scene_win, CELL, None,
     'Pixel art: Amanda at her fortieth birthday, cake and confetti'),
    ('gameover.svg', scene_gameover, CELL, 'v',
     'Pixel art: Amanda alone on the road under a cold moon'),
    ('walker_0.svg', lambda: walker(0), 1, None,
     'Pixel art sprite of Amanda, blonde hair and teal jacket, standing'),
    ('walker_1.svg', lambda: walker(1), 1, None,
     'Pixel art sprite of Amanda, mid-step'),
    ('walker_2.svg', lambda: walker(2), 1, None,
     'Pixel art sprite of Amanda, mid-stride'),
]


def main(argv):
    wanted = [a for a in argv if not a.startswith('-')]
    unknown = [n for n in wanted if n not in [j[0] for j in JOBS]]
    if unknown:
        sys.exit('no such image: %s (try --list)' % ', '.join(unknown))

    if '--preview' in argv:
        for frame in range(3):
            print('=== walker frame %d ===' % frame)
            amanda(frame).show()
        return

    # --check renders everything in memory and compares with what's committed,
    # without writing. It catches the art and this script drifting apart -- the
    # failure mode where someone edits the SVG by hand, or commits art without
    # committing the change that generated it.
    if '--check' in argv:
        stale = []
        for name, build, scale, bg, label in JOBS:
            if wanted and name not in wanted:
                continue
            path = os.path.join(OUT, name)
            expected = build().to_svg(scale, bg=bg, label=label)
            actual = ''
            if os.path.exists(path):
                with io.open(path, encoding='utf-8') as f:
                    actual = f.read()
            if actual != expected:
                stale.append(name)
        if stale:
            print('art is stale, re-run: python tools/make_art.py  (%s)'
                  % ', '.join(stale))
            sys.exit(1)
        print('art matches tools/make_art.py (%d files)' % len(JOBS))
        return

    for name, build, scale, bg, label in JOBS:
        if wanted and name not in wanted:
            continue
        path = os.path.join(OUT, name)
        with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(build().to_svg(scale, bg=bg, label=label))
        print('wrote %-16s %6d bytes' % (name, os.path.getsize(path)))


if __name__ == '__main__':
    main(sys.argv[1:])
