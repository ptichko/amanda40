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
  const header = fs.readFileSync(CSV, 'utf8').split('\n')[0].replace(/^﻿/, '').trim();
  r.equal(header, 'kind,parent,index,field,value', 'the CSV has the documented columns');
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

// Mojibake guard: node hands the exporter UTF-8, and if that ever gets decoded
// with the Windows locale codec, every em dash in the game silently turns into
// "â€"". Round-trip the export and compare, rather than trusting it.
const before = fs.readFileSync(CSV, 'utf8');
try {
  execFileSync('python', [TOOL, '--export'], { cwd: REPO, stdio: 'pipe' });
  // r.check, not r.equal: equal() would print the whole 291-row file as detail
  r.check(fs.readFileSync(CSV, 'utf8') === before,
    're-exporting the CSV from index.html is a no-op (text survives the round trip)');
  r.check(!/â|�/.test(before), 'the CSV has no mojibake from a bad decode');
} catch (err) {
  const out = ((err.stdout || '') + (err.stderr || '')).toString().trim();
  r.check(false, 're-exporting the CSV from index.html is a no-op (text survives)\n      ' +
    out.split('\n').join('\n      '));
}

// The generated block must be fenced, or the next build clobbers hand-written code.
const html = readIndex();
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
