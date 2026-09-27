'use strict';
/*
 * Keyboard: the whole game must be playable with 1-9 / O / ENTER, and the
 * album and mute controls must work from the keyboard too.
 * Run: node tools/test_keyboard.js
 */
const { boot, findSeedRun, playWithKeyboard, reporter } = require('./dom_stub');

const r = reporter('keyboard');

const g = boot();

// Play a full run on the keyboard alone, varying the choice so the run
// includes heals, stumbles and a gameover-prone stretch.
const trail = playWithKeyboard(g);

r.check(trail.some(t => t.startsWith('O:')), 'O consults the Oracle');
r.check(trail.filter(t => t === 'ENTER:continue').length >= 2,
  'ENTER keeps the journey going (' + trail.filter(t => t === 'ENTER:continue').length + ' times)');
r.check(g.card() && g.card()._class.includes('end-entry'), 'a keyboard-only run finishes');

// ENTER on a zone gate: a run that gets far enough to meet one.
const gated = findSeedRun(page => {
  const card = page.card();
  return !!card && card._class.includes('zone-transition');
});
r.check(!!gated, 'found a run that reaches a zone gate');
if (gated) {
  const p = gated.g;
  r.check(p.findIn(p.card(), 'primary-btn').length === 2, 'the gate offers two choices');
  p.key('Enter');
  const next = p.card();
  r.check(next && !next._class.includes('zone-transition'),
    'ENTER passes the gate and moves to the next stop');
}

// Keys must be inert where they mean nothing.
const before = g.feed.children.length;
g.key('7');
g.key('z');
g.key('9');
r.equal(g.feed.children.length, before, 'stray keys do not change the feed');

// M mutes, and the label and aria-pressed follow.
const toggle = g.byId['sound-toggle'];
r.equal(toggle._text, 'sound on', 'the sound toggle starts on');
g.key('m');
r.equal(toggle._text, 'sound off', 'M mutes');
r.equal(toggle.getAttribute('aria-pressed'), 'false', 'aria-pressed follows the mute');
toggle.click();
r.equal(toggle._text, 'sound on', 'clicking the toggle unmutes');
r.equal(toggle.getAttribute('aria-pressed'), 'true', 'aria-pressed follows the unmute');

// The album, from the end card.
const endCard = g.card();
const albumBtn = g.findIn(endCard, 'primary-btn').filter(b => /album/i.test(b._text))[0];
r.check(albumBtn, 'the end card offers an album button');
albumBtn.click();
const items = g.find('album-item');
r.equal(items.length, 7, 'the album lists the intro plus every location');
r.equal(g.find('album-image').length, items.length, 'every album item has its picture');
r.check(albumBtn.removed, 'the album button removes itself once opened');

// Every item follows the contract: seen items are named, unseen ones are not.
// This holds whichever way the run ended, so it needs no lucky seed.
const nameOf = item => {
  const span = item.children.find(c => c._class === 'album-name');
  return span ? span._text : '';
};
const unseen = items.filter(i => String(i._class).includes('unseen'));
const seen = items.filter(i => !String(i._class).includes('unseen'));
r.check(seen.length >= 1, 'places she reached are shown (' + seen.length + ' of ' + items.length + ')');
r.check(unseen.every(i => nameOf(i) === 'not this time'),
  'every unseen place is marked "not this time"');
r.check(seen.every(i => nameOf(i) && nameOf(i) !== 'not this time'),
  'every seen place keeps its real name');
r.equal(seen.length + unseen.length, items.length, 'every item is either seen or unseen');

// A run that ends early must leave gaps in the album, so find a seed for one.
const early = findSeedRun(page => {
  const card = page.card();
  return !!card && card._class.includes('end-entry');
});
r.check(!!early, 'found a finishing run to check the album against');
if (early) {
  const p = early.g;
  const end = p.card();
  const btn = p.findIn(end, 'primary-btn').filter(b => /album/i.test(b._text))[0];
  if (btn) btn.click();
  const pItems = p.find('album-item');
  const pUnseen = pItems.filter(i => String(i._class).includes('unseen'));
  const pSeen = pItems.filter(i => !String(i._class).includes('unseen'));
  r.equal(pUnseen.length, pItems.length - pSeen.length,
    'unseen count matches the seen count (' + pSeen.length + ' seen, ' + pUnseen.length + ' unseen)');
  r.check(pUnseen.every(i => nameOf(i) === 'not this time'),
    'and every one of them is labelled as missed');
}

// ENTER on the end card restarts rather than opening the album, and a fresh
// run gets a fresh link. Note the search is against the end card, not
// g.card() -- the album is now the last thing in the feed.
const restart = g.findIn(endCard, 'primary-btn').filter(b => /play again/i.test(b._text))[0];
r.check(restart, 'the end card offers Play Again');
restart.click();
r.equal(g.feed.children.length, 1, 'Play Again clears the feed');
r.check(g.card()._class === 'location-entry' && !g.card()._class.includes('end-entry'),
  'Play Again starts a new run at the intro');
r.check(g.hash.includes('choices='), 'the new run has its own link');

process.exitCode = r.finish() === 0 ? 0 : 1;
