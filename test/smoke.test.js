import assert from 'node:assert/strict';
import { buildIcs } from '../src/ics.js';
import { VENUES, locationText, COMPANIES } from '../src/lib.js';
import { mergeArchive, isHidden, prueflisteMarkdown } from '../src/build.js';
import { normKey } from '../src/lib.js';

const evs = [
  { uid: 'dob-1', company: COMPANIES.DOB, kind: 'oper', title: 'La Bohème', creator: 'Giacomo Puccini', venue: VENUES.DOB, start: '2026-11-03T19:30', end: null, url: 'https://x.de/a', premiere: false },
  { uid: 'sbb-2', company: COMPANIES.SBB, kind: 'ballett', title: 'Schwanensee', creator: 'Patrice Bart', venue: VENUES.DOB, start: '2026-12-01T19:30', end: null, url: '', premiere: true },
  { uid: 'kob-3', company: COMPANIES.KOB, kind: 'oper', title: 'Die Zauberflöte', creator: 'Wolfgang Amadeus Mozart', venue: VENUES.KOB_SCHILLER, start: '2026-11-10T19:00', end: null, url: '', premiere: false },
];

const ics = buildIcs(evs);
assert.match(ics, /SUMMARY:La Bohème – Giacomo Puccini/);
assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20261103T193000/);
assert.ok(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));

assert.equal(locationText(COMPANIES.SBB, VENUES.DOB), 'Staatsballett Berlin @ Deutsche Oper Berlin, Bismarckstraße 35, 10627 Berlin');
assert.equal(locationText(COMPANIES.DOB, VENUES.DOB), 'Deutsche Oper Berlin, Bismarckstraße 35, 10627 Berlin');
assert.equal(locationText(COMPANIES.KOB, VENUES.KOB_SCHILLER), 'Komische Oper Berlin @ Schillertheater, Bismarckstraße 110, 10625 Berlin');
assert.equal(locationText(COMPANIES.DOB, VENUES.DOB_TISCHLEREI), 'Deutsche Oper Berlin (Tischlerei), Bismarckstraße 35, 10627 Berlin');

const seen = new Set([normKey('la boheme')]);
assert.ok(isHidden(evs[0], seen));
assert.ok(!isHidden(evs[1], seen));

const now = '2026-10-18T12:00';
const merged = mergeArchive([{ ...evs[0], start: '2026-10-01T19:30', uid: 'dob-old' }, evs[2]], [evs[0]], ['kob-'], now);
assert.deepEqual(merged.map((e) => e.uid).sort(), ['dob-1', 'dob-old', 'kob-3']);

const md = prueflisteMarkdown(evs, seen, new Set(), now);
assert.match(md, /ausgeblendet/);

console.log('OK');
