/* Tests for the parser. Run with `node --test test/` — no dependencies.

   Rejects are asserted on their `code`, never their `reason`: the reasons are
   Dutch copy she reads in the import preview, and rewording them must not break
   a test. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseList, normalize, cardId, fnv1a } from '../js/parse.js';

const one = text => {
  const r = parseList(text);
  assert.deepEqual(r.rejects, [], 'expected no rejected lines');
  assert.equal(r.words.length, 1);
  return r.words[0];
};

/* ------------------------------------------------------------- fields --- */

test('three fields are term, form and translation', () => {
  const w = one('pater | patris, m. | vader');
  assert.equal(w.term, 'pater');
  assert.equal(w.form, 'patris, m.');
  assert.deepEqual(w.translations, ['vader']);
});

test('two fields are term and translation, with no form', () => {
  const w = one('sed | maar');
  assert.equal(w.term, 'sed');
  assert.equal(w.form, '');
  assert.deepEqual(w.translations, ['maar']);
});

test('a blank middle field is the same as no form', () => {
  assert.equal(one('ad |  | naar').form, '');
});

test('a trailing separator is tolerated', () => {
  const w = one('pater | patris, m. | vader |');
  assert.deepEqual(w.translations, ['vader']);
});

test('/ splits alternatives and the full field stays as the canonical answer', () => {
  const w = one('mater | matris, f. | moeder / mama');
  assert.deepEqual(w.translations, ['moeder', 'mama']);
  assert.equal(w.answer, 'moeder / mama');
});

test('columns padded for readability parse the same as loose typing', () => {
  const padded = parseList('pater    | patris, m.   | vader');
  const loose = parseList('pater|patris, m.|vader');
  assert.deepEqual(padded.words, loose.words);
});

/* ------------------------------------------------------ titles, noise --- */

test('the first # line is the title and later ones are comments', () => {
  const r = parseList('# Chapter 1 — Familia\n# a note\npater | vader');
  assert.equal(r.title, 'Chapter 1 — Familia');
  assert.equal(r.words.length, 1);
});

test('no comment line means no title', () => {
  assert.equal(parseList('pater | vader').title, null);
});

test('blank lines, CRLF and a BOM are all ignored', () => {
  const r = parseList('﻿# T\r\n\r\npater | vader\r\n\r\n');
  assert.deepEqual(r.rejects, []);
  assert.equal(r.words[0].term, 'pater', 'a BOM must not ride along on the first term');
  assert.equal(r.title, 'T');
});

/* -------------------------------------------------------- separators --- */

test('a semicolon-separated file is read when the first data line has no |', () => {
  const r = parseList('pater;patris, m.;vader\nmater;matris, f.;moeder');
  assert.equal(r.separator, ';');
  assert.equal(r.words.length, 2);
});

test('a tab-separated paste out of a spreadsheet is read', () => {
  const r = parseList('pater\tpatris, m.\tvader');
  assert.equal(r.separator, 'tab');
  assert.equal(r.words[0].form, 'patris, m.');
});

test('the separator is chosen once, not guessed per line', () => {
  /* Second line has a | in it; the file is already committed to ';'. */
  const r = parseList('pater;vader\nmater|moeder');
  assert.equal(r.separator, ';');
  assert.equal(r.rejects.length, 1, 'the | line has no ; and must be reported');
});

/* ----------------------------------------------------------- rejects --- */

test('a line with no separator is reported with its number and reason', () => {
  const r = parseList('# T\npater | vader\nnonsense\n');
  assert.equal(r.words.length, 1);
  assert.equal(r.rejects.length, 1);
  assert.equal(r.rejects[0].line, 3);
  assert.equal(r.rejects[0].text, 'nonsense');
  assert.equal(r.rejects[0].code, 'no-separator');
});

test('too many fields is reported rather than silently truncated', () => {
  const r = parseList('pater | patris, m. | vader | extra');
  assert.equal(r.words.length, 0);
  assert.equal(r.rejects[0].code, 'too-many-fields');
});

test('an empty term or an empty translation is reported', () => {
  const r = parseList(' | patris, m. | vader\npater | patris, m. |  ');
  assert.equal(r.words.length, 0);
  assert.equal(r.rejects.length, 2);
  assert.equal(r.rejects[0].code, 'no-term');
  assert.equal(r.rejects[1].code, 'no-translation');
});

test('a line ending in a separator is reported, not read as a two-field line', () => {
  /* "pater | patris, m. |" must never become "pater means patris, m." — that
     would silently promote the grammar form into the answer. */
  const r = parseList('pater | patris, m. |');
  assert.equal(r.words.length, 0);
  assert.equal(r.rejects[0].code, 'no-translation');
  assert.match(r.rejects[0].reason, /eindigt op \|/, 'and says so in Dutch');
});

test('nothing is ever dropped without a reason', () => {
  const text = '# T\npater | vader\nrubbish\n\nmater | moeder | x | y\n';
  const r = parseList(text);
  const dataLines = text.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
  assert.equal(r.words.length + r.rejects.length, dataLines);
});

/* ---------------------------------------------------------------- ids --- */

test('normalize folds case, accents and whitespace', () => {
  assert.equal(normalize('  Één   Woord '), 'een woord');
  assert.equal(normalize('MĀTER'), 'mater');
});

test('fnv1a is deterministic and 32-bit', () => {
  assert.equal(fnv1a('mater'), fnv1a('mater'));
  assert.match(fnv1a('mater'), /^[0-9a-f]{8}$/);
  assert.notEqual(fnv1a('mater'), fnv1a('pater'));
});

test('ids survive reordering, realigning and inserting lines', () => {
  const a = parseList('pater | patris, m. | vader\nmater | matris, f. | moeder');
  const b = parseList('mater|matris, f.|moeder\nnovus | nova | nieuw\npater   | patris, m. | vader');
  const idOf = (r, term) => r.words.find(w => w.term === term).id;
  assert.equal(idOf(a, 'pater'), idOf(b, 'pater'));
  assert.equal(idOf(a, 'mater'), idOf(b, 'mater'));
});

test('fixing a translation or a form keeps the card, fixing the term replaces it', () => {
  const base = parseList('mater | matris, f. | moeder').words[0].id;
  assert.equal(parseList('mater | matris, f. | moeder / mama').words[0].id, base);
  assert.equal(parseList('mater | matris f. | moeder').words[0].id, base);
  assert.notEqual(parseList('matter | matris, f. | moeder').words[0].id, base);
});

test('case and accents on the term do not change the id', () => {
  const a = parseList('mater | moeder').words[0].id;
  assert.equal(parseList('Māter | moeder').words[0].id, a);
});

/* --------------------------------------------------------- homographs --- */

test('a homograph pair is told apart by grammar form and flagged', () => {
  const r = parseList('liber | libri, m. | boek\nliber | libera, liberum | vrij');
  assert.equal(r.words.length, 2);
  assert.notEqual(r.words[0].id, r.words[1].id, 'colliding terms must not share an id');

  const warning = r.warnings.find(w => w.type === 'homograph');
  assert.ok(warning, 'the pair must be flagged for checking by eye');
  assert.equal(warning.term, 'liber');
  assert.deepEqual(warning.entries.map(e => e.line), [1, 2]);
});

test('only the colliding terms are qualified, so ordinary words keep plain ids', () => {
  const alone = parseList('pater | patris, m. | vader').words[0].id;
  const withCollision = parseList(
    'pater | patris, m. | vader\nliber | libri, m. | boek\nliber | libera | vrij'
  ).words.find(w => w.term === 'pater').id;
  assert.equal(withCollision, alone);
});

test('a corpus-wide homograph qualifies a term even when this file has it once', () => {
  const plain = parseList('liber | libri, m. | boek').words[0].id;
  const qualified = parseList('liber | libri, m. | boek', {
    collidingTerms: new Set(['liber']),
  }).words[0].id;
  assert.notEqual(qualified, plain);
  assert.equal(qualified, cardId('liber', 'libri, m.', true));
});

test('the same term twice with no form to tell them apart is a duplicate, not a card clash', () => {
  const r = parseList('pater | vader\npater | papa');
  assert.equal(r.words.length, 1, 'two cards must never share one id');
  assert.equal(r.rejects.length, 1);
  assert.equal(r.rejects[0].code, 'duplicate');
});

/* ------------------------------------------------ shared translations --- */

test('a translation covering several terms is flagged for reverse mode', () => {
  const r = parseList('dicere | dico | zeggen / spreken\nnarrare | narro | vertellen / zeggen');
  const warning = r.warnings.find(w => w.type === 'shared-translation');
  assert.ok(warning);
  assert.equal(warning.translation, 'zeggen');
  assert.deepEqual(warning.entries.map(e => e.term), ['dicere', 'narrare']);
});

test('shared translations are matched after folding case and accents', () => {
  const r = parseList('unus | una | één\nsolus | sola | Een');
  assert.ok(r.warnings.some(w => w.type === 'shared-translation' && w.translation === 'een'));
});

/* ------------------------------------------------------ the real file --- */

test('the committed chapter parses cleanly and holds its awkward cases', async () => {
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(new URL('../data/latin-chapter-01.txt', import.meta.url), 'utf8');
  const r = parseList(text, { listId: 'latin-ch01' });

  assert.deepEqual(r.rejects, [], 'the committed list must have no unreadable lines');
  assert.equal(r.title, 'Hoofdstuk 1 — Familia');
  assert.ok(r.words.length > 20);
  assert.ok(r.words.every(w => w.lists.includes('latin-ch01')));

  assert.ok(r.warnings.some(w => w.type === 'homograph' && w.term === 'liber'));
  assert.ok(r.warnings.some(w => w.type === 'shared-translation' && w.translation === 'zeggen'));
  assert.equal(r.words.find(w => w.term === 'unus').translations[0], 'één');
  assert.equal(r.words.find(w => w.term === 'ad').form, '');
  assert.equal(r.words.find(w => w.term === 'sed').form, '');
});

test('every rejected line carries a stable code as well as Dutch copy', () => {
  const r = parseList([
    'rubbish',
    'pater | patris, m. | vader | extra',
    ' | vorm | x',
    'sed |',
    'pater | vader',
    'pater | papa',
  ].join('\n'));
  const codes = r.rejects.map(x => x.code);
  assert.deepEqual(codes,
    ['no-separator', 'too-many-fields', 'no-term', 'no-translation', 'duplicate']);
  for (const reject of r.rejects) {
    assert.ok(reject.reason.length > 0, `${reject.code} has no Dutch message`);
    assert.ok(Number.isInteger(reject.line));
  }
});

test('warnings are Dutch and keep their English type', () => {
  const r = parseList('liber | libri, m. | boek\nliber | libera | vrij');
  const warning = r.warnings.find(w => w.type === 'homograph');
  assert.match(warning.message, /komt|staat/, 'the message she reads is Dutch');
});
