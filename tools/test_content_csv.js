'use strict';
/*
 * The CSV -> index.html bake. Guards the editing workflow in content/README.md:
 * if someone edits content.csv and forgets to run tools/build_content.py, the
 * page they ship is not the page they wrote. Run: node tools/test_content_csv.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { REPO, readIndex, reporter } = require('./dom_stub');

const r = reporter('content-csv');
const CSV = path.join(REPO, 'content', 'content.csv');
const TOOL = path.join(REPO, 'tools', 'build_content.py');

r.check(fs.existsSync(CSV), 'content/content.csv exists');
r.check(fs.existsSync(path.join(REPO, 'content', 'README.md')),
  'content/README.md documents the format');

if (fs.existsSync(CSV)) {
  const header = fs.readFileSync(CSV, 'latin1').split(/\r?\n/)[0].replace(/^﻿/, '').trim();
  r.check(header.length > 0, 'the CSV has a header row  ->  ' + header.slice(0, 40));
}

// The real check: does index.html match the CSV?
try {
  execFileSync('python', [TOOL, '--check'], { cwd: REPO, stdio: 'pipe' });
  r.check(true, 'build_content.py --check passes (index.html matches the CSV)');
} catch (err) {
  const out = ((err.stdout || '') + (err.stderr || '')).trim();
  r.check(false, 'build_content.py --check passes (index.html matches the CSV)\n      ' +
    out.split('\n').join('\n      '));
}

const html = readIndex();
const generated = html.slice(html.indexOf('const CONFIG'), html.indexOf('   ENGINE SECTION'));

// How did the tool read the author's file? A spreadsheet can hand back a
// semicolon-delimited, Windows-1252 CSV without saying so, so assert on what
// matters -- that it parsed completely and lost nothing -- not on a particular
// delimiter or encoding. Deliberately NOT --export: that rewrites the author's
// file, and a test has no business doing that.
let info = null;
try {
  const out = execFileSync('python', [TOOL, '--describe'], { cwd: REPO, stdio: 'pipe' });
  info = JSON.parse(out.toString());
  r.check(info.rows > 250, 'the whole CSV parsed  ->  ' + info.rows + ' rows');
  r.equal(info.lost_characters, 0, 'no characters were lost decoding the file');
  r.check(info.locations === 17, 'all the locations are there  ->  ' + info.locations);
  // whatever the delimiter, the five logical columns must be the documented ones
  const header = fs.readFileSync(CSV, 'latin1').split(/\r?\n/)[0].replace(/^﻿/, '').trim();
  const cols = header.split(info.delimiter).map(s => s.trim());
  r.check(cols.join(',') === 'kind,parent,index,field,value',
    'the CSV has the documented columns, whatever the delimiter  ->  ' + info.delimiter);
  r.check(['locations', 'hints', 'rows'].every(k => k in info),
    'the tool can describe how it read the file');
} catch (err) {
  const out = (err.stdout || '').toString() + (err.stderr || '').toString();
  r.check(false, 'build_content.py --describe works\n      ' +
    out.trim().split('\n').join('\n      '));
}

// Mojibake guard, on the text the game actually shows. The exporter used to
// decode node's UTF-8 output with the Windows locale codec, which turned every
// em dash in the game into "â€"". Check the rendered JS, not the author's raw
// bytes -- a spreadsheet's stray cp1252 byte is the tool's problem to absorb,
// and --describe's lost_characters count is what proves it did.
r.check(!/â/.test(generated), 'the generated content has no mojibake');
r.check(!generated.includes('�'), 'the generated content has no replacement characters');
if (info) {
  const dashes = (generated.match(/—/g) || []).length;
  r.check(dashes === info.em_dashes,
    'every em dash in the CSV reached the page  ->  ' + dashes);
}

// The generated block must be fenced, or the next build clobbers hand-written code.
r.check(html.includes('/* == BEGIN GENERATED CONTENT'),
  'index.html opens the generated block with a marker');
r.check(html.includes('/* == END GENERATED CONTENT == */'),
  'index.html closes the generated block with a marker');
r.check(/^\/\* content-hash: [0-9a-f]{64} \*\/$/m.test(html),
  'the generated block records its content-hash');

// CONFIG is a tuning knob, not a word -- make sure it survived the bake as numbers.
const cfg = html.slice(html.indexOf('const CONFIG'), html.indexOf('const ZONES'));
r.check(/winDistance: \d+/.test(cfg) && /oracleAppearChance: [\d.]+/.test(cfg),
  'CONFIG is emitted as numbers, not strings');
r.check(!/"winDistance"/.test(cfg), 'CONFIG keys are bare identifiers, not quoted');

process.exitCode = r.finish() === 0 ? 0 : 1;
