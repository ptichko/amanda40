'use strict';
/*
 * Replay determinism: a shared link must rebuild the run it points at,
 * including the Oracle's hints and highlights. Plays a run consulting the
 * Oracle at every opportunity, then boots a second, independent page from the
 * resulting hash and compares the two journeys fingerprint by fingerprint.
 * Run: node tools/test_replay.js
 */
const { boot, clickForward, reporter } = require('./dom_stub');

const r = reporter('replay');

// Everything about a card that a player would notice.
function fingerprint(g) {
  return g.feed.children.map(entry => {
    const one = sel => g.findIn(entry, sel).map(n => n._text || '').join(' / ');
    const highlighted = g.findIn(entry, 'choice-btn')
      .filter(b => String(b._class).includes('oracle-highlight'))
      .map(b => (b.children[0] && b.children[0]._text) || '')
      .join(' / ');
    const chosen = g.findIn(entry, 'choice-btn')
      .filter(b => String(b._class).includes('choice-selected'))
      .map(b => (b.children[0] && b.children[0]._text) || '')
      .join(' / ');
    return [
      entry._class,
      one('entry-name'),
      one('consequence-message'),
      one('oracle-hint'),
      'highlighted=' + highlighted,
      'chosen=' + chosen,
      one('zone-transition-choice'),
    ].join(' | ');
  }).join('\n');
}

// Plays a run, consulting the Oracle wherever she appears.
function playWithOracle(search) {
  const g = boot({ search: search || '' });
  for (let guard = 0; guard < 80; guard++) {
    const card = g.card();
    if (!card || card._class.includes('end-entry')) break;

    if (card._class.includes('zone-transition')) {
      const btns = g.findIn(card, 'primary-btn');
      if (btns.length) btns[btns.length - 1].click();   // vary which gate is taken
      continue;
    }
    const oracle = g.findIn(card, 'oracle-btn')[0];
    if (oracle && !oracle.disabled) oracle.click();
    const choices = g.findIn(card, 'choice-btn');
    if (!choices.length) { clickForward(g); continue; }
    choices[guard % choices.length].click();
    const conts = g.findIn(card, 'primary-btn').filter(b => !b.disabled && !b.removed);
    if (conts.length) conts[conts.length - 1].click();
  }
  return g;
}

const tokensOf = g => ((g.hash.match(/choices=([^&]*)/) || [, ''])[1]).split('.').filter(Boolean);

// A run only covers replay properly if it consulted the Oracle *and* crossed a
// zone gate, and whether it does depends on the seed. Rather than pin a seed
// that a content edit would invalidate, find the first seed that produces a run
// with both. Deterministic (same seeds, same order, every time) and it repairs
// itself when the content changes.
let fixture = null;
for (let seed = 1; seed <= 80 && !fixture; seed++) {
  const g = playWithOracle('?seed=' + seed);
  const tokens = tokensOf(g);
  const hasOracle = tokens.indexOf('o') >= 0;
  const hasGate = tokens.some(t => t === 'f' || t === 'v');
  if (hasOracle && hasGate) fixture = { seed: seed, g: g, tokens: tokens };
}
r.check(!!fixture, 'found a seed whose run covers the Oracle and a zone gate');
if (!fixture) {
  process.exitCode = r.finish() === 0 ? 0 : 1;
  return;
}
console.log('    (fixture seed: ' + fixture.seed + ', ' + fixture.tokens.length + ' tokens)');

const first = fixture.g;
const tokens = fixture.tokens;

r.check(first.card()._class.includes('end-entry'), 'the played run reached an end card');
r.check(tokens.length > 3, 'the run recorded actions (' + tokens.length + ' tokens)');
r.check(tokens.indexOf('o') >= 0, 'the run consulted the Oracle (an "o" token was logged)');
r.check(tokens.some(t => t === 'f' || t === 'v'), 'the run passed a zone gate (f/v logged)');

// Same hash, fresh page.
const second = boot({ hash: first.hash });
const fp1 = fingerprint(first);
const fp2 = fingerprint(second);

if (fp1 === fp2) {
  r.check(true, 'replayed journey is identical (' + fp1.split('\n').length + ' cards)');
} else {
  const a = fp1.split('\n');
  const b = fp2.split('\n');
  const at = a.findIndex((line, i) => line !== b[i]);
  r.check(false, 'replayed journey differs, first at card ' + at);
  console.log('    original: ' + (a[at] || '(missing)'));
  console.log('    replayed: ' + (b[at] || '(missing)'));
}
r.equal(second.byId['progress-fill'].style.width, first.byId['progress-fill'].style.width,
  'replay ends at the same progress');
r.equal(second.hash, first.hash, 'replay leaves the same hash behind');

// A replay must be silent: it would otherwise fire every effect at once.
r.equal(second.notes.length, 0, 'replaying a run makes no sound');

// The same reasoning in a11y terms: the live region is held busy while the
// whole journey is rebuilt, and released when the replay ends. The played run
// (no replay) should never flip it at all.
r.check(second.busyLog.indexOf('true') >= 0, 'a replay holds the live region busy');
r.equal(second.busyLog[second.busyLog.length - 1], 'false', 'the live region is released after the replay');
r.equal(first.busyLog.length, 0, 'an ordinary run never flips the live region');

// A junk hash must not wedge the game.
const junk = boot({ hash: '#seed=notanumber&choices=zz.9.-4.o' });
r.check(junk.card() && !junk.card()._class.includes('end-entry'),
  'a malformed hash still starts a playable game');
r.check(junk.hash.includes('seed='), 'a malformed hash is replaced with a fresh run link');

// ?seed= pins a run from the start: same seed, same journey, whatever the
// player does. That is what makes the fixture above repeatable.
function playAllFirst(seed) {
  const g = boot({ search: '?seed=' + seed });
  for (let guard = 0; guard < 40; guard++) {
    const card = g.card();
    if (!card || card._class.includes('end-entry')) break;
    if (card._class.includes('zone-transition')) { g.findIn(card, 'primary-btn')[0].click(); continue; }
    const choices = g.findIn(card, 'choice-btn');
    if (!choices.length) { clickForward(g); continue; }
    choices[0].click();
    const conts = g.findIn(card, 'primary-btn').filter(b => !b.disabled && !b.removed);
    if (conts.length) conts[conts.length - 1].click();
  }
  return g;
}

const pinnedA = playAllFirst(4242);
const pinnedB = playAllFirst(4242);
r.equal(fingerprint(pinnedA), fingerprint(pinnedB), '?seed=4242 replays the same journey twice');
r.check(pinnedA.hash.includes('seed=4242'), '?seed= is the seed actually used');
r.equal(tokensOf(pinnedA).length > 0, true, '?seed= run still records its actions');
r.check(fingerprint(playAllFirst(99)) !== fingerprint(pinnedA),
  'a different seed gives a different journey');

process.exitCode = r.finish() === 0 ? 0 : 1;
