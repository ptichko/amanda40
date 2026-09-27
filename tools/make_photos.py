#!/usr/bin/env python3
"""
Pad and resize the real photographs into the location cards.

The cards are drawn in a 16:9 frame (see .entry-image in index.html) at roughly
600px wide, and `object-fit: cover` would crop anything taller into a thin
strip -- fatal for artefacts like the Velveteen Rabbit title page or the Bette
Midler single, where the text *is* the picture. So this letterboxes instead:
scale the whole photo to fit and pad the remainder with the card's navy
(#000040, --bg-dark), which is already the colour behind the image.

Originals are left untouched; the processed copy is written alongside as
images/loc_<id>.jpg so the location keeps its conventional filename and
index.html's asset lookup still works.

    python tools/make_photos.py            # (re)generate the card images
    python tools/make_photos.py --list     # show the mapping
    python tools/make_photos.py --check    # fail if any card image is missing/stale
"""

import argparse
import io
import os
import sys

try:
    from PIL import Image, ImageChops, ImageOps
except ImportError:
    sys.exit("Pillow is required for this one: pip install Pillow")

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
IMAGES = os.path.join(REPO, 'images')

# 16:9 at 2x the ~600px the card renders at.
CARD_W, CARD_H = 1200, 675
NAVY = (0x00, 0x00, 0x40)          # --bg-dark
JPEG_QUALITY = 88

# source photo in images/  ->  location id it illustrates
#
# The two school photos and the Strafford sign each had more than one plausible
# stop; these were the choices. A stop with no photo keeps its generated
# placeholder, so this list is deliberately partial.
MAPPING = [
    ('DARE.jpg',                      'loc_theDareSpeech'),
    ('strafford_elementary_school.jpg', 'loc_theMoveToStrafford'),
    ('wind_beneath_my_wings.jpg',     'loc_theTalentShow'),
    ('velveteen_rabbit.jpg',          'loc_piscataquaYouthPlayers'),
    ('stories_are_made_that_way.jpg', 'loc_storiesAreMadeThatWay'),
    ('bishop_brady_high_school.jpg',  'loc_theNationalAnthem'),
    ('stonehill_college.jpg',         'loc_stonehillToEmerson'),
    ('emerson_college.jpg',           'loc_magnaCumLaude'),
    ('spindrift.jpg',                 'loc_spindrift'),
]


def target_for(loc_id):
    return os.path.join(IMAGES, loc_id + '.jpg')


def render(src_path):
    """The finished 16:9 card image for a source photo, as an in-memory image."""
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)      # phone photos carry a rotation
        im = im.convert('RGB')
        im.thumbnail((CARD_W, CARD_H), Image.LANCZOS)   # fit, never enlarge
        canvas = Image.new('RGB', (CARD_W, CARD_H), NAVY)
        canvas.paste(im, ((CARD_W - im.width) // 2, (CARD_H - im.height) // 2))
        return canvas


def encode(canvas):
    """JPEG bytes for a rendered card, the same way process() writes it."""
    buf = io.BytesIO()
    canvas.save(buf, 'JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)
    return buf


def process(src_path, out_path):
    with open(out_path, 'wb') as fh:
        fh.write(encode(render(src_path)).getvalue())
    return os.path.getsize(out_path)


def rebuild():
    missing = []
    for src, loc_id in MAPPING:
        src_path = os.path.join(IMAGES, src)
        if not os.path.exists(src_path):
            missing.append(src)
            continue
        size = process(src_path, target_for(loc_id))
        print('  %-34s -> %-28s %6.1f KB' % (src, loc_id + '.jpg', size / 1024.0))
    if missing:
        print('error: missing source photo(s): %s' % ', '.join(missing), file=sys.stderr)
        return 1
    print('%d card image(s) written to images/' % len(MAPPING))
    return 0


def check():
    """Fail unless every card image is byte-for-byte what the source would produce.

    Compares decoded pixels rather than JPEG bytes, so a Pillow upgrade that
    changes the encoder doesn't produce a false failure -- but a swapped or
    re-cropped source photo does.
    """
    bad = []
    for src, loc_id in MAPPING:
        src_path = os.path.join(IMAGES, src)
        out = target_for(loc_id)
        if not os.path.exists(src_path):
            bad.append('%s: source photo is gone' % src)
            continue
        if not os.path.exists(out):
            bad.append('%s: card image has not been generated' % loc_id)
            continue
        with Image.open(out) as on_disk:
            on_disk = on_disk.convert('RGB')
            if on_disk.size != (CARD_W, CARD_H):
                bad.append('%s: is %dx%d, expected %dx%d'
                           % (loc_id, on_disk.size[0], on_disk.size[1], CARD_W, CARD_H))
                continue
            # JPEG is lossy, so the file can't be compared with the uncompressed
            # render -- put both through the same encoder first, then diff pixels.
            expected = Image.open(encode(render(src_path))).convert('RGB')
            if ImageChops.difference(on_disk, expected).getbbox() is not None:
                bad.append('%s: does not match %s -- the photo changed since it was built'
                           % (loc_id, src))
    if bad:
        print('FAIL: photo card images are out of date', file=sys.stderr)
        for b in bad:
            print('  ' + b, file=sys.stderr)
        print('  Fix with: python tools/make_photos.py', file=sys.stderr)
        return 1
    print('photos: %d card images match tools/make_photos.py' % len(MAPPING))
    return 0


def show():
    for src, loc_id in MAPPING:
        exists = 'ok ' if os.path.exists(os.path.join(IMAGES, src)) else 'MISSING'
        print('  %-7s %-34s -> %s.jpg' % (exists, src, loc_id))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='fail if a card image is missing/stale')
    ap.add_argument('--list', action='store_true', help='show the photo -> location mapping')
    args = ap.parse_args()
    if args.check:
        return check()
    if args.list:
        return show()
    return rebuild()


if __name__ == '__main__':
    sys.exit(main())
