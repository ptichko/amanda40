'use strict';
/*
 * Shared test harness for The Fourth Decade.
 *
 * DEV TOOL. The game never loads this, and Node is not a dependency of the
 * page -- it just lets the engine be exercised without a browser.
 *
 * The game is one inline <script> in index.html, so the harness pulls that
 * script out and runs it in a vm sandbox against a DOM stub small enough to
 * read. Timers fire immediately and synchronously, which means a whole run
 * (choices, consequences, travel animations, zone gates, end card) completes
 * in a few milliseconds with no waiting.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
const INDEX = path.join(REPO, 'index.html');

function readIndex() {
  return fs.readFileSync(INDEX, 'utf8');
}

// The engine, as source.
function gameScript() {
  const m = readIndex().match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('no inline <script> found in index.html');
  return m[1];
}

// Just the CONTENT SECTION (CONFIG, ZONES, ORACLE_HINTS, INTRO_LOCATION,
// LOCATIONS, END_TEXT), for tests that only need the data.
function contentObject() {
  const js = gameScript();
  const start = js.indexOf('const CONFIG');
  const engineBanner = js.indexOf('   ENGINE SECTION');
  if (start < 0 || engineBanner < 0) throw new Error('content section not found');
  const block = js.slice(start, js.lastIndexOf('/*', engineBanner));
  return vm.runInNewContext(
    block + '\n;({ CONFIG, ZONES, ORACLE_HINTS, INTRO_LOCATION, INTRO_SEQUENCE,' +
    ' LOCATIONS, END_TEXT })'
  );
}

function makeNode(tag) {
  return {
    tagName: tag,
    children: [],
    _class: '',
    _text: '',
    style: {},
    disabled: false,
    removed: false,
    handlers: {},
    attrs: {},
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
    },
    get className() { return this._class; },
    set className(v) { this._class = v; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    remove() { this.removed = true; },
    addEventListener(ev, fn) { this.handlers[ev] = fn; },
    removeEventListener(ev) { delete this.handlers[ev]; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    click() { if (this.handlers.click && !this.disabled) this.handlers.click(); },
    focus() {},
    scrollIntoView() {},
    get scrollHeight() { return 0; },
    get lastElementChild() { return this.children[this.children.length - 1] || null; },
    set innerHTML(v) { this.children = []; },
    get innerHTML() { return ''; },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const want = String(sel).replace(/^\./, '');
      const out = [];
      const stack = [...this.children];
      while (stack.length) {
        const n = stack.shift();
        if (n._class && String(n._class).split(/\s+/).includes(want)) out.push(n);
        stack.push(...n.children);
      }
      return out;
    },
  };
}

// A fake Web Audio API that records the notes the game asks for, so sound
// effects can be asserted on instead of listened to.
function makeAudio(notes) {
  function FakeAudioContext() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = { name: 'destination' };
    this.resume = () => { this.state = 'running'; };
    this.createGain = () => ({
      gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    });
    this.createOscillator = () => {
      const rec = { type: null, freq: 0, slideTo: 0, start: 0, stop: 0 };
      notes.push(rec);
      return {
        set type(v) { rec.type = v; },
        get type() { return rec.type; },
        frequency: {
          setValueAtTime(f) { rec.freq = f; },
          exponentialRampToValueAtTime(f) { rec.slideTo = f; },
        },
        connect() {},
        start(t) { rec.start = t; },
        stop(t) { rec.stop = t; },
      };
    };
  }
  return FakeAudioContext;
}

/*
 * Boots one page. Options:
 *   hash   -- the URL hash, to replay a shared run
 *   search -- the query string, e.g. '?debug=true'
 */
function boot(options) {
  const opts = options || {};
  const notes = [];
  const byId = {};
  ['scene', 'scene-feed', 'progress-fill', 'penalty-points', 'zone-markers', 'sound-toggle']
    .forEach(id => { byId[id] = makeNode(id === 'sound-toggle' ? 'button' : 'div'); });

  const handlers = {};
  let hash = opts.hash || '';
  const loc = { search: opts.search || '', hash };
  const AudioContext = makeAudio(notes);

  const sandbox = {
    console, Math, URLSearchParams, AudioContext,
    // Synchronous timers keep every test fast and deterministic.
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    history: { replaceState: (a, b, h) => { hash = h; loc.hash = h; } },
    window: { location: loc, AudioContext },
    document: {
      getElementById: id => byId[id] || makeNode('div'),
      createElement: makeNode,
      addEventListener: (ev, fn) => { handlers[ev] = fn; },
      removeEventListener: (ev) => { delete handlers[ev]; },
      activeElement: null,
    },
  };
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(gameScript(), sandbox, { filename: 'index.html' });

  const feed = byId['scene-feed'];

  return {
    sandbox, byId, feed, notes, loc,
    // The bottom of the feed: whatever the player is looking at.
    card: () => feed.children[feed.children.length - 1] || null,
    // Every node in the tree matching a class name.
    find: (sel) => collect(feed, sel),
    findIn: (node, sel) => (node ? collect(node, sel) : []),
    text: (node) => collect(node, null).map(n => n._text).filter(Boolean).join(' '),
    // Dispatch a key the way the browser would, to the real listener.
    key(k) {
      handlers.keydown({
        key: k,
        target: { tagName: 'BODY' },
        ctrlKey: false, altKey: false, metaKey: false,
        preventDefault() { this.defaultPrevented = true; },
      });
    },
    pointer() { if (handlers.pointerdown) handlers.pointerdown({}); },
    get hash() { return hash; },
  };
}

// Depth-first collection of every node whose class list contains cls.
// Pass null for cls to collect every node.
function collect(node, cls, out = []) {
  if (node._class && (cls === null || String(node._class).split(/\s+/).includes(cls))) {
    out.push(node);
  }
  (node.children || []).forEach(c => collect(c, cls, out));
  return out;
}

// ---- tiny assertion helpers, so the tests read as a list of claims ----

function reporter(title) {
  let failures = 0;
  let checks = 0;

  function record(ok, label, detail) {
    checks++;
    if (!ok) failures++;
    const mark = ok ? 'PASS' : 'FAIL';
    console.log('  ' + mark + '  ' + label + (detail ? '  ->  ' + detail : ''));
  }

  return {
    check: (ok, label, detail) => record(!!ok, label, ok ? detail : (detail || 'expected truthy')),
    equal: (actual, expected, label) =>
      record(actual === expected, label, String(actual) +
        (actual === expected ? '' : '   (expected ' + expected + ')')),
    finish() {
      console.log(failures === 0
        ? '\n' + title + ': ' + checks + ' checks passed'
        : '\n' + title + ': ' + failures + ' of ' + checks + ' checks FAILED');
      return failures;
    },
    get failures() { return failures; },
  };
}

// One step of keyboard play: consult the Oracle if offered, take a choice, press
// ENTER, or pass a zone gate. Returns false when there is nothing left to do.
function stepOnce(g, pick) {
  const card = g.card();
  if (!card || card._class.includes('end-entry')) return false;

  if (card._class.includes('zone-transition')) {
    g.key('Enter');
    return true;
  }
  const oracle = g.findIn(card, 'oracle-btn')[0];
  if (oracle && !oracle.disabled) g.key('o');

  const choices = g.findIn(card, 'choice-btn');
  if (!choices.length) {
    // No choices here: an intro cutscene panel, or any other card whose only
    // way forward is its button. ENTER presses it.
    return clickForward(g);
  }
  const index = Math.min(pick(choices), choices.length - 1);
  g.key(String(index + 1));
  g.key('Enter');
  return true;
}

// Clicks the last enabled primary button in the current card -- the way forward
// from an intro cutscene panel. Exported because several drivers need it and
// forgetting to handle the cutscene shows up as a test that silently stalls.
function clickForward(g) {
  const card = g.card();
  if (!card) return false;
  const btns = g.findIn(card, 'primary-btn').filter(b => !b.disabled && !b.removed);
  if (!btns.length) return false;
  btns[btns.length - 1].click();
  return true;
}

// Drives a page from the keyboard exactly as a player would, and stops at the
// end card. `choiceFor(choices)` picks which choice to take.
function playWithKeyboard(g, choiceFor) {
  const pick = choiceFor || (choices => choices.length - 1);
  const trail = [];
  for (let guard = 0; guard < 80; guard++) {
    const card = g.card();
    if (!card || card._class.includes('end-entry')) break;

    if (card._class.includes('zone-transition')) {
      g.key('Enter');
      trail.push('ENTER:zone');
      continue;
    }
    const oracle = g.findIn(card, 'oracle-btn')[0];
    if (oracle && !oracle.disabled) {
      g.key('o');
      trail.push('O:oracle');
    }
    const choices = g.findIn(card, 'choice-btn');
    if (!choices.length) {
      // An intro cutscene panel: its button is the only way on.
      if (!clickForward(g)) break;
      trail.push('ENTER:cutscene');
      continue;
    }
    const index = Math.min(pick(choices), choices.length - 1);
    g.key(String(index + 1));
    trail.push((index + 1) + ':' + ((choices[index].children[0] || {})._text || ''));
    g.key('Enter');
    trail.push('ENTER:continue');
  }
  return trail;
}

// The label of the first choice in the content with the given outcome type.
// Tests match on this instead of hardcoding a string, so rewording a choice in
// index.html doesn't quietly turn a test into a no-op.
function labelWithOutcome(type) {
  const { LOCATIONS } = contentObject();
  for (const loc of LOCATIONS) {
    for (const choice of loc.choices) {
      if (choice.outcome.type === type) return choice.label;
    }
  }
  return null;
}

/*
 * Finds the first seed whose keyboard run reaches a moment satisfying pred, and
 * hands back the page *stopped at that moment* -- so the caller can act there.
 *
 * This keeps tests off hardcoded magic seeds: if the content changes, a
 * different seed is found rather than the fixture silently ceasing to cover the
 * case. Pass pred = () => true to get the first seed that gets anywhere.
 */
function findSeedRun(pred, choiceFor, limit = 60) {
  const pick = choiceFor || (choices => choices.length - 1);
  for (let seed = 1; seed <= limit; seed++) {
    const g = boot({ search: '?seed=' + seed });
    for (let guard = 0; guard < 80; guard++) {
      if (pred(g)) return { seed: seed, g: g };
      if (!stepOnce(g, pick)) break;
    }
    if (pred(g)) return { seed: seed, g: g };
  }
  return null;
}

module.exports = {
  REPO, INDEX, readIndex, gameScript, contentObject, labelWithOutcome,
  boot, collect, reporter, stepOnce, clickForward, playWithKeyboard, findSeedRun,
};
