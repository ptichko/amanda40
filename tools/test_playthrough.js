'use strict';
/*
 * Plays whole runs with different strategies and checks each one terminates
 * sensibly: a win at 100%, a loss before it, a journey log that matches what
 * was clicked, and no stuck states.
 * Run: node tools/test_playthrough.js
 */
const { boot, reporter } = require('./dom_stub');

const r = reporter('playthrough');

// Clicks a choice by index, then presses Continue, the way a player would.
function step(g, index) {
  const card = g.card();
  if (!card) return false;
  if (card._class.includes('end-entry')) return false;

  if (card._class.includes('zone-transition')) {
    const btns = g.findIn(card, 'primary-btn');
    if (btns.length) btns[0].click();
    return true;
  }
  const choices = g.findIn(card, 'choice-btn');
  if (choices.length) choices[Math.min(index, choices.length - 1)].click();
  const conts = g.findIn(card, 'primary-btn').filter(b => !b.disabled && !b.removed);
  if (conts.length) conts[conts.length - 1].click();
  return true;
}

function play(index, maxSteps = 60) {
  const g = boot();
  let steps = 0;
  while (steps < maxSteps && step(g, index)) steps++;
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
    oracleVisits: (g.hash.match(/choices=([^&]*)/) || [, ''])[1].split('.').filter(t => t === 'o').length,
  };
}

// First choice everywhere: mostly safe, so this should reach the win.
const safe = play(0);
r.check(safe.ended, 'safe run reaches an end card');
r.equal(safe.progress, '100%', 'safe run fills the progress bar');
r.equal(safe.title, 'The Fourth Decade', 'safe run wins');
r.check(safe.penalties === 0, 'safe run took no stumbles');
r.check(safe.steps > 5, 'safe run took a real journey (' + safe.steps + ' actions)');
r.check(safe.hash.includes('choices='), 'a shareable hash was written');
r.equal(safe.log.split('.').filter(Boolean).length, safe.steps,
  'the log has one token per action (gates and all)');

// Last choice everywhere: mostly stumbles, so this should end early.
const reckless = play(99);
r.check(reckless.ended, 'reckless run reaches an end card');
r.check(reckless.progress !== '100%', 'reckless run does not reach the end (' + reckless.progress + ')');
r.equal(reckless.title, 'The journey ends', 'reckless run ends in game over');
r.check(reckless.steps < safe.steps, 'reckless run is shorter than the safe one');

// Middle choice: whatever happens, it must terminate, not wedge.
const middling = play(1);
r.check(middling.ended, 'middle-choice run reaches an end card');
r.check(middling.entries > 1, 'the feed kept its history (' + middling.entries + ' cards)');

// Replaying a finished run must reach the same end card, not a new one.
const replay = boot({ hash: safe.hash });
const replayCard = replay.card();
r.check(replayCard && replayCard._class.includes('end-entry'),
  'replaying a finished run lands on the end card');
r.equal(replay.byId['progress-fill'].style.width, safe.progress, 'replay ends at the same progress');
r.equal(replay.hash, safe.hash, 'replay rewrites the same hash');

process.exitCode = r.finish() === 0 ? 0 : 1;
