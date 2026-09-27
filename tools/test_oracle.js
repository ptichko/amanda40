'use strict';
/*
 * The Oracle's two guarantees:
 *   1. she is offered at every stop that has a real choice, and
 *   2. when consulted, she highlights the choice that actually happened.
 *
 * Both used to be probabilistic: a 0.6 appearance roll, and a per-hint accuracy
 * roll that could point at a wrong answer. Run: node tools/test_oracle.js
 */
const { boot, contentObject, reporter } = require('./dom_stub');

const { LOCATIONS, INTRO_LOCATION } = contentObject();
const r = reporter('oracle');

const correctLabel = loc => {
  const hit = loc.choices.find(c => c.oracleCorrect);
  return hit ? hit.label : null;
};

// Identify the stop from the card text (the location's name is printed on it),
// so the check never has to infer the location from what she highlighted.
function locateFrom(cardText) {
  const hits = LOCATIONS.filter(l => cardText.includes(l.name));
  return hits.length === 1 ? hits[0] : null;
}

function walk(seed, onLocation) {
  const g = boot({ search: '?seed=' + seed });
  for (let guard = 0; guard < 80; guard++) {
    const card = g.card();
    if (!card || card._class.includes('end-entry')) return;
    if (card._class.includes('zone-transition')) { g.key('Enter'); continue; }

    const buttons = g.findIn(card, 'choice-btn');
    if (!buttons.length) { g.key('Enter'); continue; }   // intro cutscene panel

    const labels = buttons.map(b => (b.children[0] || {})._text);
    const loc = locateFrom(g.text(card));

    // The intro card has a single "Begin the journey" choice, so she has nothing
    // to say about it; only stops with 2+ choices are in scope.
    if (labels.length >= 2) {
      const want = loc ? correctLabel(loc) : null;
      // play the true choice where we can, so a run survives to more stops
      const pick = want ? Math.max(0, labels.indexOf(want)) : 0;
      onLocation(g, card, loc, labels, pick);
      g.key(String(pick + 1));
    } else {
      g.key('1');
    }
    g.key('Enter');
  }
}

const SEEDS = 30;
let stops = 0, offered = 0, consulted = 0;
let notOffered = [], unidentifiable = 0, notOne = [], wrong = [];

for (let seed = 1; seed <= SEEDS; seed++) {
  walk(seed, (g, card, loc, labels) => {
    stops++;
    const btn = g.findIn(card, 'oracle-btn')[0];
    if (!btn || btn.disabled) {
      notOffered.push('seed ' + seed);
      return;
    }
    offered++;
    g.key('o');
    consulted++;

    const lit = g.findIn(card, 'choice-btn')
      .filter(b => b.classList.contains('oracle-highlight'));
    if (lit.length !== 1) {
      notOne.push('seed ' + seed + ': lit ' + lit.length + ' buttons');
      return;
    }
    const litLabel = (lit[0].children[0] || {})._text;

    if (!loc) { unidentifiable++; return; }
    const want = correctLabel(loc);
    if (litLabel !== want) {
      wrong.push('seed ' + seed + ' @ ' + loc.id + ': lit "' + litLabel +
        '" but the true one is "' + want + '"');
    }
  });
}

const show = list => { if (list.length) console.log('  ' + list.slice(0, 6).join('\n  ')); };

r.check(stops > 200, 'the sweep visited plenty of multi-choice stops  ->  ' + stops);
r.equal(notOffered.length, 0,
  'the Oracle is offered at every stop that has a choice (' + notOffered.length + ' gaps)');
show(notOffered);
r.check(consulted === offered && consulted > 200,
  'and she could be consulted at every one of them  ->  ' + consulted);
r.equal(unidentifiable, 0, 'every stop was identifiable by name');
r.equal(notOne.length, 0, 'she highlights exactly one button');
show(notOne);
r.equal(wrong.length, 0,
  'the button she lights is always the one marked oracleCorrect');
show(wrong);

// The intro card is the one place she has nothing to point at.
r.check(INTRO_LOCATION.choices.length < 2, 'the intro card is out of scope (one choice)');

process.exitCode = r.finish() === 0 ? 0 : 1;
