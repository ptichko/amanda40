'use strict';
/*
 * Plays whole runs with different strategies and checks each one terminates
 * sensibly: a win at 100%, a loss before it, a journey log that matches what
 * was clicked, and no stuck states.
 * Run: node tools/test_playthrough.js
 */
const { boot, clickForward, contentObject, reporter } = require('./dom_stub');

const r = reporter('playthrough');

const { CONFIG, LOCATIONS, INTRO_SEQUENCE, ZONES } = contentObject();
const byName = new Map(LOCATIONS.map(l => [l.name, l]));

// Plays like a person who knows the story: always takes the choice that really
// happened. The buttons are matched by *label*, not by position, because the
// engine shuffles the displayed order.
function clickChoice(g, card, want) {
  return g.findIn(card, 'choice-btn').find(b => {
    const text = ((b.children[0] || {})._text || '').toLowerCase();
    return want.some(c => c.label.toLowerCase() === text);
  });
}

function trueChoice(location) {
  return location.choices.filter(c => c.oracleCorrect);
}

function wrongChoice(location) {
  const out = location.choices.filter(c => c.outcome.type === 'penalty');
  return out.length ? out : location.choices;
}

// Clicks a choice, then presses Continue, the way a player would.
function step(g, choose) {
  const card = g.card();
  if (!card) return false;
  if (card._class.includes('end-entry')) return false;

  if (card._class.includes('zone-transition')) {
    const btns = g.findIn(card, 'primary-btn');
    if (btns.length) btns[0].click();
    return true;
  }
  const choices = g.findIn(card, 'choice-btn');
  if (choices.length) {
    const heading = g.findIn(card, 'entry-name').map(n => n._text).join('');
    const location = byName.get(heading);
    const target = location ? clickChoice(g, card, choose(location)) : null;
    (target || choices[0]).click();
    const conts = g.findIn(card, 'primary-btn').filter(b => !b.disabled && !b.removed);
    if (conts.length) conts[conts.length - 1].click();
    return true;
  }
  // No choices: an intro cutscene panel, whose button is the only way on.
  return clickForward(g);
}

function play(choose, maxSteps = 80) {
  const g = boot();
  let steps = 0;
  while (steps < maxSteps && step(g, choose)) steps++;
  const card = g.card();
  return {
    steps,
    ended: !!card && card._class.includes('end-entry'),
    title: g.findIn(card, 'entry-name').map(n => n._text).join(''),
    progress: g.byId['progress-fill'].style.width,
    penalties: g.findIn(g.byId['penalty-points'], 'penalty-mark-full').length,
    hash: g.hash,
    log: (g.hash.match(/choices=([^&]*)/) || [, ''])[1],
    entries: g.feed.children.length,
    cutscenes: g.feed.children.filter(c => c._class.includes('cutscene-entry')).length,
  };
}

// Plays like a person who knows the story: should reach the win.
const knowing = play(trueChoice);
r.check(knowing.ended, 'a run that always takes the true choice reaches an end card');
r.equal(knowing.progress, '100%', 'and fills the progress bar');
r.equal(knowing.title, 'The Fourth Decade', 'and wins');
r.equal(knowing.penalties, 0, 'without a single stumble');
r.check(knowing.steps > 5, 'having taken a real journey (' + knowing.steps + ' actions)');
r.check(knowing.hash.includes('choices='), 'a shareable hash was written');
// Counted from the content, not hardcoded: adding a panel to INTRO_SEQUENCE
// (the how-to-play card, the birth cutscene) should not fail this line.
r.equal(knowing.cutscenes, INTRO_SEQUENCE.length,
  'every intro panel played exactly once (' + INTRO_SEQUENCE.length + ')');
r.check(knowing.cutscenes > 0, 'and there is at least one');

// The how-to-play card. Checked on a rendered feed rather than on the content
// object, because what matters is that it comes out as a readable card: no
// broken image frame, a list rather than a wall of prose, one way on.
{
  const g = boot();
  g.findIn(g.card(), 'choice-btn')[0].click();   // "Begin the journey"
  clickForward(g);                               // Continue on the outcome box
  const card = g.card();
  r.check(card && card._class.includes('cutscene-entry'),
    'Continue after "Begin the journey" opens the first intro panel');
  r.equal(g.findIn(card, 'entry-image').length, 0, 'the how-to-play card has no picture');
  const bullets = g.findIn(card, 'entry-bullet');
  r.check(bullets.length >= 3, 'it lists the instructions (' + bullets.length + ' lines)');
  r.check(bullets.every(li => li._text.trim().length > 0), 'and none of them is blank');
  r.equal(g.findIn(card, 'primary-btn').length, 1, 'with a single Continue button');

  // The first "Wandering N steps" belongs *after* the whole intro sequence, not
  // between "Begin the journey" and the panels -- and the bar moves with it, so
  // the two never disagree about how far along the journey is.
  r.equal(g.find('travel-status').length, 0,
    'and no travel status has played yet');
  r.equal(g.byId['progress-fill'].style.width, '0%',
    'the progress bar has not moved either');
  for (let i = 1; i < INTRO_SEQUENCE.length; i++) clickForward(g);
  r.equal(g.find('travel-status').length, 0,
    'still nothing while the cutscene is on screen');
  clickForward(g);
  r.equal(g.find('travel-status').length, 1,
    'the first travel status plays after the last panel');
  r.equal(g.findIn(g.feed.children[1 + INTRO_SEQUENCE.length - 1], 'travel-status').length, 1,
    'inside the last panel, not back on the intro card');
  r.check(g.byId['progress-fill'].style.width !== '0%',
    'and the bar moved with it (' + g.byId['progress-fill'].style.width + ')');
  // The step readout says the same thing the bar does, in steps not percent.
  const pct = Number(String(g.byId['progress-fill'].style.width).replace('%', ''));
  const steps = Math.round(pct * CONFIG.winDistance / 100);
  r.equal(g.byId['steps']._text, 'step ' + steps + ' of ' + CONFIG.winDistance,
    'the step readout matches the bar (step ' + steps + ' of ' + CONFIG.winDistance + ')');
  // The zone-labels ruler carries every zone's name, in zone order, at its
  // own first step.
  const labelEls = g.byId['zone-labels'].children;
  r.equal(labelEls.length, ZONES.length,
    'every zone gets a label on the ruler (' + labelEls.length + ')');
  r.equal(labelEls.map(n => n._text).join(' | '), ZONES.map(z => z.name).join(' | '),
    'the ruler labels the zones in order');
  r.check(g.card() && g.card()._class.includes('location-entry')
    && !g.card()._class.includes('cutscene-entry'),
    'then the first zone stop opens');

  // A normal stop still plays its own status inline, or deferring the intro's
  // would have quietly turned the feature off for the rest of the run.
  g.findIn(g.card(), 'choice-btn')[0].click();
  clickForward(g);
  r.equal(g.find('travel-status').length, 2,
    'every later step plays its own travel status');
}

// The log records one token per *logged* action. Steps also counts the cutscene
// panel, which is not a choice and so has no token.
const tokens = knowing.log.split('.').filter(Boolean).length;
r.check(tokens > 0 && tokens <= knowing.steps,
  'the log has one token per logged action (' + tokens + ' tokens, ' + knowing.steps + ' steps)');
r.check(knowing.log.split('.').filter(Boolean).every(t => /^\d+$|^o$|^[fv]$/.test(t)),
  'every log token is a choice index, an oracle visit, or a gate');

// Getting it wrong every time: should end early.
const wrong = play(wrongChoice);
r.check(wrong.ended, 'a run that always takes a stumble reaches an end card');
r.check(wrong.progress !== '100%', 'and does not reach the end (' + wrong.progress + ')');
r.equal(wrong.title, 'The journey ends', 'and ends in game over');
r.check(wrong.steps < knowing.steps, 'having a shorter journey than the run that knows the story');
r.check(wrong.penalties > 0, 'having picked up the stumbles');

// A middle strategy: whatever happens, it must terminate, not wedge.
const middling = play(loc => loc.choices.slice(1));
r.check(middling.ended, 'a middle-choice run reaches an end card');
r.check(middling.entries > 1, 'the feed kept its history (' + middling.entries + ' cards)');

// The whole point of the shuffle: the true choice must not keep the same
// position, or "always click the top button" wins every run.
function firstRealCard(g) {
  for (let i = 0; i < 6; i++) {
    const card = g.card();
    if (!card || card._class.includes('end-entry')) return null;
    if (card._class.includes('cutscene-entry') || card._class.includes('zone-transition')) {
      if (!clickForward(g)) return null;
      continue;
    }
    const choices = g.findIn(card, 'choice-btn');
    if (choices.length > 1) return card;
    if (choices.length === 1) {
      choices[0].click();
      const conts = g.findIn(card, 'primary-btn').filter(b => !b.disabled && !b.removed);
      if (conts.length) conts[conts.length - 1].click();
      continue;
    }
    if (!clickForward(g)) return null;
  }
  return null;
}

const seen = new Set();
for (let seed = 1; seed <= 15; seed++) {
  const g = boot({ search: '?seed=' + seed });
  const card = firstRealCard(g);
  if (!card) continue;
  const location = byName.get(g.findIn(card, 'entry-name').map(n => n._text).join(''));
  if (!location) continue;
  const wanted = trueChoice(location).map(c => c.label.toLowerCase());
  const at = g.findIn(card, 'choice-btn')
    .findIndex(b => wanted.indexOf(((b.children[0] || {})._text || '').toLowerCase()) >= 0);
  seen.add(at);
}
r.check(seen.size > 1,
  'the true choice lands in more than one position across seeds (positions seen: ' +
  [...seen].sort().join(', ') + ')');

// Replaying a finished run must reach the same end card, not a new one.
const replay = boot({ hash: knowing.hash });
const replayCard = replay.card();
r.check(replayCard && replayCard._class.includes('end-entry'),
  'replaying a finished run lands on the end card');
r.equal(replay.byId['progress-fill'].style.width, knowing.progress, 'at the same progress');
r.equal(replay.hash, knowing.hash, 'and leaves the same hash behind');
r.equal(replay.feed.children.filter(c => c._class.includes('cutscene-entry')).length,
  knowing.cutscenes, 'having replayed the intro cutscene too');
// A replay is instant everywhere else, so it must not gain an animated walk
// just because the intro's travel status moved. The dots are timers.
r.equal(replay.find('travel-status').length, 0,
  'a replay plays no travel status at all, the intro\'s included');

process.exitCode = r.finish() === 0 ? 0 : 1;
