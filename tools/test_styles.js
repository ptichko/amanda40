'use strict';
/*
 * Stylesheet sanity: balanced braces, a style for every class the engine
 * creates, and every asset the CSS references actually on disk.
 * Run: node tools/test_styles.js
 */
const fs = require('fs');
const path = require('path');
const { REPO, readIndex, gameScript, reporter } = require('./dom_stub');

const r = reporter('styles');
const html = readIndex();
const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const body = (html.match(/<body>([\s\S]*?)<script>/) || [])[1] || '';

// ---- structure ----
r.check(style.length > 0, 'there is a <style> block');
r.equal((style.match(/\{/g) || []).length, (style.match(/\}/g) || []).length,
  'braces are balanced');
r.check(/shape-rendering|content:/.test(style), 'stylesheet is not empty');
r.check(!/@import|url\(\s*['"]?https?:/i.test(style), 'no remote assets in the CSS');
r.check(!/@font-face/i.test(style), 'no @font-face (the 90s look uses local fonts)');
r.check(/prefers-reduced-motion/.test(style), 'reduced-motion block is present');
r.check(/\.(choice-btn|primary-btn|sound-toggle):focus-visible\D/.test(style) &&
  /outline[^;]*dotted/.test(style),
  'buttons have a visible keyboard-focus rectangle');

// ---- every class the engine builds has a rule ----
const js = gameScript();
const used = new Set();
for (const m of js.matchAll(/el\('(?:div|p|span|button|ul|li|h2|img)',\s*'([a-z0-9 \-]+)'/g)) {
  m[1].split(/\s+/).forEach(c => c && used.add(c));
}
for (const m of js.matchAll(/el\('(?:div|span|button)',\s*'([a-z]+-[a-z\-]+)'/g)) used.add(m[1]);
for (const m of js.matchAll(/querySelector(?:All)?\('\.([a-z\-]+)'\)/g)) used.add(m[1]);
for (const m of js.matchAll(/classList\.(?:add|remove|contains)\('([a-z\-]+)'\)/g)) used.add(m[1]);
for (const m of js.matchAll(/class="([a-z0-9 \-]+)"/g)) m[1].split(/\s+/).forEach(c => c && used.add(c));

const missing = [...used].filter(c => !style.includes('.' + c)).sort();
r.equal(missing.length, 0, 'every engine class has a style rule' +
  (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''));

// ---- assets referenced from CSS exist ----
for (const m of style.matchAll(/url\('([^']+)'\)/g)) {
  const src = m[1];
  if (/^https?:|^data:/.test(src)) continue;
  r.check(fs.existsSync(path.join(REPO, src)), 'css asset exists: ' + src);
}

// ---- the stylesheet is not accidentally scoped to a missing element ----
for (const id of ['scene', 'scene-feed', 'hud', 'progress-fill', 'penalty-points', 'zone-markers']) {
  r.check(html.includes('id="' + id + '"'), 'markup still has #' + id);
}

process.exitCode = r.finish() === 0 ? 0 : 1;
