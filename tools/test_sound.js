'use strict';
/*
 * Sound: every effect is synthesised, so the tests assert on the notes the game
 * asks for rather than on what a listener would hear. The harness's fake
 * AudioContext records one entry per oscillator.
 *
 * The cases that depend on where a run goes (a stumble on offer, a heal, a
 * zone gate, the end) search for a seed that reaches that situation, so a
 * content change can't quietly stop covering one of the effects.
 * Run: node tools/test_sound.js
 */
const { boot, findSeedRun, reporter } = require('./dom_stub');

const r = reporter('sound');

const notesOf = page => page.notes
  .map(n => n.type[0] + n.freq + (n.slideTo ? '->' + n.slideTo : ''))
  .join(' ');
const tonesOf = page => page.notes.map(n => n.type[0] + n.freq).join(' ');
const quiet = page => { page.notes.length = 0; };

// Offers a choice whose label matches, at the current stop?
const offers = (page, re) => {
  const card = page.card();
  if (!card || card._class.includes('end-entry')) return false;
  return page.findIn(card, 'choice-btn')
    .some(b => re.test((b.children[0] || {})._text || ''));
};

// ---- nothing before the first gesture ----
const g = boot();
r.equal(g.notes.length, 0, 'silent before any interaction');

// ---- a choice blips ----
g.key('1');
r.check(g.notes.length > 0, 'the first keypress unlocks audio and the choice blips');
r.equal(notesOf(g), 's760', 'choice select is one square blip');
quiet(g);
g.key('Enter');
quiet(g);

// ---- a choice that leads to a stumble ----
const stumble = findSeedRun(page => offers(page, /swing again/i));
r.check(!!stumble, 'found a run that offers a stumble');
if (stumble) {
  const p = stumble.g;
  const index = p.findIn(p.card(), 'choice-btn')
    .findIndex(b => /swing again/i.test((b.children[0] || {})._text || ''));
  quiet(p);
  p.key(String(index + 1));
  r.equal(notesOf(p), 's760 s240->90', 'a stumble is the blip plus a falling saw sweep');
  quiet(p);
}

// ---- a choice that heals ----
const heal = findSeedRun(page => offers(page, /let the years catch up/i));
r.check(!!heal, 'found a run that offers a heal');
if (heal) {
  const p = heal.g;
  const index = p.findIn(p.card(), 'choice-btn')
    .findIndex(b => /let the years catch up/i.test((b.children[0] || {})._text || ''));
  quiet(p);
  p.key(String(index + 1));
  r.equal(notesOf(p), 's760 t523 t784', 'a heal is the blip plus a rising triangle pair');
  quiet(p);
}

// ---- the Oracle, when she turns up ----
// She never appears at the intro (the engine skips her where there is only one
// choice), so walk until a stop where she does.
const oracleRun = findSeedRun(page => {
  const card = page.card();
  return !!card && !card._class.includes('end-entry') && !!page.findIn(card, 'oracle-btn')[0];
});
r.check(!!oracleRun, 'found a stop where the Oracle appears');
if (oracleRun) {
  const p = oracleRun.g;
  quiet(p);
  p.key('o');
  r.equal(tonesOf(p), 't520 t784', 'consulting the Oracle is a rising triangle pair');
  quiet(p);
}

// ---- a zone gate chimes, and the run ends on one of the two outros ----
function playCapturing(seed) {
  const p = boot({ search: '?seed=' + seed });
  const seen = { gates: [], end: '' };

  for (let guard = 0; guard < 80; guard++) {
    const card = p.card();
    if (!card || card._class.includes('end-entry')) break;

    if (card._class.includes('zone-transition')) {
      quiet(p);
      p.findIn(card, 'primary-btn')[0].click();
      seen.gates.push(tonesOf(p));
      quiet(p);
      continue;
    }
    const oracleBtn = p.findIn(card, 'oracle-btn')[0];
    if (oracleBtn && !oracleBtn.disabled) { p.key('o'); quiet(p); }

    const choices = p.findIn(card, 'choice-btn');
    if (!choices.length) break;

    quiet(p);
    p.key(String((guard % choices.length) + 1));
    p.key('Enter');
    if (p.card() && p.card()._class.includes('end-entry')) seen.end = notesOf(p);
    quiet(p);
  }
  return seen;
}

let captured = { gates: [], end: '' };
for (let seed = 1; seed <= 40 && !captured.end; seed++) {
  const seen = playCapturing(seed);
  if (seen.gates.indexOf('s659 s988') >= 0 && seen.end) captured = seen;
}
r.check(captured.gates.indexOf('s659 s988') >= 0, 'a zone gate chimes twice');
r.check(!!captured.end, 'a run reached an end card', captured.end || '(nothing captured)');

// The final action may itself be a heal or a stumble, so match the tail.
const tail = captured.end.split(' ').slice(-4).join(' ');
r.check(['s523 s659 s784 s1047', 's392 s330 s262 s196'].indexOf(tail) >= 0,
  'the end plays one four-note run', tail);

// ---- muting ----
const toggle = g.byId['sound-toggle'];
r.equal(toggle._text, 'sound on', 'nothing has muted the run yet');
g.key('m');
r.equal(toggle._text, 'sound off', 'M mutes');
r.equal(toggle.getAttribute('aria-pressed'), 'false', 'aria-pressed follows the mute');
quiet(g);
const choices = g.findIn(g.card(), 'choice-btn');
if (choices.length) choices[0].click();
r.equal(g.notes.length, 0, 'muted: choosing a stop is silent');
toggle.click();
r.equal(toggle._text, 'sound on', 'the toggle unmutes');
r.equal(toggle.getAttribute('aria-pressed'), 'true', 'aria-pressed follows the unmute');

// ---- a replayed run is silent ----
const replay = boot({ hash: g.hash });
r.equal(replay.notes.length, 0, 'replaying a run makes no sound');

process.exitCode = r.finish() === 0 ? 0 : 1;
