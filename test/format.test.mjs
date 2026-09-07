/* Tests for the Dutch date formatting.

   PLAN section 1 settles this: dates are `nl-BE`, which decides 11/09 over
   9/11 and "september" over "September". Numbers need nothing — every one the
   app shows is a whole one — so dates are the whole of it.

   The trap worth a test of its own is the parsing, not the formatting. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDay } from '../js/ui.js';

test('a test date reads as a day she can recognise', () => {
  /* "Toets over 3 dagen" is the number she paces herself by; this is the one
     she finds on the calendar, and only the first of the two was on screen. */
  assert.equal(formatDay('2026-09-11'), 'vrijdag 11 september');
  assert.equal(formatDay('2026-12-21'), 'maandag 21 december');
});

test('months and weekdays are Dutch, lower case, the way Dutch writes them', () => {
  /* Spelled out in full rather than pattern-matched. The first version built a
     regex from a template literal and wrote a word boundary as \b — which in a
     template literal is a backspace character, so it matched nothing. Exact
     strings cannot go wrong that way, and they pin the word order and the
     absence of a comma too, which a pattern would not. */
  assert.equal(formatDay('2026-01-05'), 'maandag 5 januari');
  assert.equal(formatDay('2026-03-01'), 'zondag 1 maart');
  assert.equal(formatDay('2026-05-04'), 'maandag 4 mei');
  assert.equal(formatDay('2026-10-06'), 'dinsdag 6 oktober');
});

test('a backup carries its year; a test date does not', () => {
  /* Restoring last term's file by accident is exactly the mistake worth
     making visible. A test is always this school year, so the year is noise. */
  assert.equal(formatDay('2026-03-01', 'date'), '1 maart 2026');
  assert.doesNotMatch(formatDay('2026-03-01', 'day'), /2026/);
});

test('a full ISO timestamp is accepted, not just a bare day', () => {
  /* `exportedAt` is a full timestamp; `test.date` is a bare day. Both arrive
     here. */
  assert.equal(formatDay('2026-09-07T17:35:00.000Z', 'date'), '7 september 2026');
});

test('the day never shifts across a timezone', () => {
  /* The reason the parts are split by hand instead of going through
     `new Date(iso)`: that reads a bare date as UTC midnight, which is the
     right day in Brussels and the day before anywhere west of Greenwich.
     cram.js parses the same way, for the same reason.

     Checked by running the formatter under a western timezone, which is where
     the naive version breaks. */
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    assert.match(formatDay('2026-09-11'), /11 september/,
      'the date moved a day when read from a western timezone');
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('nothing to format is not an error', () => {
  /* A test with no date, or a backup from before `exportedAt` existed. */
  assert.equal(formatDay(''), '');
  assert.equal(formatDay(null), '');
  assert.equal(formatDay(undefined), '');
});

test('something that is not a date comes back unchanged rather than as Invalid Date', () => {
  assert.equal(formatDay('nonsense'), 'nonsense');
  assert.equal(formatDay('2026-13'), '2026-13');
});
