'use strict';
/*
 * Content invariants: the things that break silently if someone edits the
 * CONTENT SECTION wrong. Run: node tools/test_content.js
 */
const fs = require('fs');
const path = require('path');
const { REPO, contentObject, reporter } = require('./dom_stub');

const { CONFIG, ZONES, ORACLE_HINTS, INTRO_LOCATION, LOCATIONS, END_TEXT } = contentObject();
const r = reporter('content');

const allLocations = [INTRO_LOCATION, ...LOCATIONS];

// ---- ids ----
const ids = allLocations.map(l => l.id);
r.equal(new Set(ids).size, ids.length, 'location ids are unique');
LOCATIONS.forEach(l => r.check(/^loc_[A-Za-z0-9]+$/.test(l.id), 'id follows loc_<camelCase>: ' + l.id));

// ---- zones ----
const zoneIds = ZONES.map(z => z.id);
LOCATIONS.forEach(l => r.check(zoneIds.includes(l.zone), 'zone ' + l.zone + ' exists for ' + l.id));
r.check(!('zone' in INTRO_LOCATION), 'INTRO_LOCATION has no zone (so it is never re-picked)');
r.check(!LOCATIONS.some(l => l.id === INTRO_LOCATION.id), 'INTRO_LOCATION is not in LOCATIONS');

ZONES.slice(1).forEach((z, i) => {
  r.equal(z.min, ZONES[i].max + 1, 'zone ' + z.id + ' starts where zone ' + ZONES[i].id + ' ends');
});
r.equal(ZONES[0].min, 0, 'first zone starts at 0');
r.equal(ZONES[ZONES.length - 1].max, CONFIG.winDistance, 'last zone ends at winDistance');
ZONES.forEach(z => r.check(z.name, 'zone ' + z.id + ' has a name (shown in the HUD tooltip)'));

// ---- choices and outcomes ----
const VALID_TYPES = ['normal', 'penalty', 'heal', 'gameover'];
allLocations.forEach(l => {
  r.check(Array.isArray(l.choices) && l.choices.length >= 1, l.id + ' has choices');
  r.check(l.choices.length >= 2 || l.id === INTRO_LOCATION.id,
    l.id + ' offers a real choice (>=2)');
  const labels = l.choices.map(c => c.label);
  r.equal(new Set(labels).size, labels.length, l.id + ' choice labels are unique');
  l.choices.forEach(c => {
    r.check(c.label && typeof c.label === 'string', l.id + ' choice has a label');
    r.check(c.outcome && VALID_TYPES.includes(c.outcome.type),
      l.id + ' outcome.type is one of ' + VALID_TYPES.join('/') + ': ' + (c.outcome && c.outcome.type));
    r.check(c.outcome && typeof c.outcome.text === 'string' && c.outcome.text.length > 0,
      l.id + ' outcome has text');
  });
});

// Every zone needs somewhere to go, and at least one non-punishing way forward.
ZONES.forEach(z => {
  const inZone = LOCATIONS.filter(l => l.zone === z.id);
  r.check(inZone.length > 0, 'zone ' + z.id + ' has at least one location');
  const safe = inZone.some(l => l.choices.some(c => c.outcome.type !== 'penalty'));
  r.check(safe, 'zone ' + z.id + ' has at least one non-penalty choice');
});

// ---- end text ----
r.check(END_TEXT.win && END_TEXT.win.title && END_TEXT.win.image, 'END_TEXT.win is complete');
r.check(END_TEXT.win.goodMessage && END_TEXT.win.badMessage,
  'END_TEXT.win has both messages (offering picks the bad one)');
r.check(END_TEXT.gameover && END_TEXT.gameover.title && END_TEXT.gameover.message,
  'END_TEXT.gameover is complete');
ORACLE_HINTS.forEach((h, i) => {
  r.check(typeof h.text === 'string' && h.text.length > 0, 'hint ' + i + ' has text');
  r.check(h.accuracy > 0 && h.accuracy <= 1, 'hint ' + i + ' accuracy is in (0, 1]');
});

// ---- images exist on disk ----
const images = [];
allLocations.forEach(l => images.push(l.image));
images.push(END_TEXT.win.image, END_TEXT.gameover.image);
LOCATIONS.forEach(l => l.choices.forEach(c => { if (c.outcome.image) images.push(c.outcome.image); }));
images.push('images/bg-tile.svg');
[0, 1, 2].forEach(i => images.push('images/walker_' + i + '.svg'));

[...new Set(images)].forEach(src => {
  r.check(fs.existsSync(path.join(REPO, src)), 'asset exists: ' + src);
});

// ---- placeholder debt, reported not failed ----
const placeholders = require('fs').readFileSync(path.join(REPO, 'index.html'), 'utf8')
  .split('\n')
  .filter(l => l.includes('PLACEHOLDER'))
  .map(l => l.trim().slice(0, 60));
if (placeholders.length) {
  console.log('\n  NOTE  ' + placeholders.length +
    ' lines still contain PLACEHOLDER: (replace before giving it away)');
}

process.exitCode = r.finish() === 0 ? 0 : 1;
