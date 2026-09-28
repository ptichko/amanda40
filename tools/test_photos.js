'use strict';
/*
 * The location card images. Two things can go wrong quietly:
 *   - a card points at a file that isn't there (test_content.js also checks this),
 *   - a source photo is re-cropped or replaced and the card image is never
 *     regenerated, so the page shows a stale version.
 * Run: node tools/test_photos.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { REPO, readIndex, reporter } = require('./dom_stub');

const r = reporter('photos');
const TOOL = path.join(REPO, 'tools', 'make_photos.py');
const IMAGES = path.join(REPO, 'images');

// Every image the content section points at, in either quote style -- the
// content section is generated as JSON string literals.
const html = readIndex();
const refs = [...new Set(
  [...html.matchAll(/image:\s*["']([^"']+\.(?:svg|jpg))["']/g)].map(m => m[1])
)];

r.check(refs.length >= 16, 'the content section references the location cards  ->  ' + refs.length);
const missing = refs.filter(p => !fs.existsSync(path.join(REPO, p)));
r.equal(missing.length, 0, 'every referenced card image exists on disk');
if (missing.length) console.log('  missing: ' + missing.join(', '));

// Any location still on generated art should have a .svg; any with a real
// photograph should have a .jpg. Mixing them up is the easy mistake.
const wrongExt = refs.filter(p => {
  const base = path.basename(p, path.extname(p));
  return !fs.existsSync(path.join(IMAGES, base + '.svg')) && p.endsWith('.svg');
});
r.equal(wrongExt.length, 0, 'no card points at a placeholder SVG that no longer exists');
if (wrongExt.length) console.log('  stale: ' + wrongExt.join(', '));

// The real check: are the derived card images current?
try {
  const out = execFileSync('python', [TOOL, '--check'], { cwd: REPO, stdio: 'pipe' });
  r.check(true, 'make_photos.py --check passes (card images are current)  ->  ' +
    out.toString().trim());
} catch (err) {
  const out = (err.stdout || '').toString() + (err.stderr || '').toString();
  r.check(false, 'make_photos.py --check passes (card images are current)\n      ' +
    out.trim().split('\n').join('\n      '));
}

// A card image is 16:9 and lands in images/. The *source* photos are not
// required: they are gitignored (one is 11.6 MB), so a fresh clone has only the
// derived cards. If a source happens to be present the tool checks the card
// against it pixel for pixel, which is the stronger check.
const jpgs = fs.readdirSync(IMAGES).filter(f => /^loc_.*\.jpg$/.test(f));
r.check(jpgs.length > 0, 'there are location card photographs  ->  ' + jpgs.length);
r.check(fs.existsSync(path.join(IMAGES, 'cutscene_birth.jpg')),
  'the birth cutscene card is a photograph too');

process.exitCode = r.finish() === 0 ? 0 : 1;
