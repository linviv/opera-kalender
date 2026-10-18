// Baut den Kalender: Spielpläne einlesen, zusammenführen, "gesehen"-Liste anwenden, Dateien schreiben.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { berlinNow, normKey, locationText } from './lib.js';
import { buildIcs, summaryOf } from './ics.js';
import { fetchDob } from './sources/dob.js';
import { fetchKob } from './sources/kob.js';
import { fetchStaatsoper } from './sources/staatsoper.js';
import { fetchStaatsballett } from './sources/staatsballett.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = {
  seen: path.join(ROOT, 'gesehen.txt'),
  archive: path.join(ROOT, 'data', 'events.json'),
  ics: path.join(ROOT, 'docs', 'oper-ballett.ics'),
  list: path.join(ROOT, 'PRUEFLISTE.md'),
};

const SOURCES = [
  ['Deutsche Oper Berlin', 'dob-', fetchDob],
  ['Komische Oper Berlin', 'kob-', fetchKob],
  ['Staatsoper Unter den Linden', 'so-', fetchStaatsoper],
  ['Staatsballett Berlin', 'sbb-', fetchStaatsballett],
];

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

/** gesehen.txt: eine Produktion pro Zeile, Zeilen mit # sind Kommentare. */
export async function readSeen(file = P.seen) {
  if (!existsSync(file)) return new Set();
  const text = await readFile(file, 'utf8');
  return new Set(
    text.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean).map(normKey)
  );
}

export function isHidden(ev, seen) {
  return seen.has(normKey(ev.title)) || seen.has(normKey(summaryOf(ev)));
}

export function mergeArchive(prevEvents, scraped, failedPrefixes, now) {
  const map = new Map();
  for (const ev of prevEvents) {
    // Vergangene Termine bleiben erhalten; bei ausgefallener Quelle bleibt auch ihr Zukunftsbestand.
    if (ev.start < now || failedPrefixes.some((p) => ev.uid.startsWith(p))) map.set(ev.uid, ev);
  }
  for (const ev of scraped) map.set(ev.uid, ev);
  return [...map.values()];
}

export function prueflisteMarkdown(events, seen, prevKeys, now) {
  const groups = new Map();
  for (const ev of events.filter((e) => e.start >= now)) {
    const key = `${normKey(ev.title)}|${ev.company}`;
    if (!groups.has(key)) groups.set(key, { title: ev.title, creator: ev.creator, company: ev.company, kind: ev.kind, dates: [], hidden: isHidden(ev, seen), key });
    groups.get(key).dates.push(ev.start);
  }
  const rows = [...groups.values()].sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title, 'de'));
  const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(2, 4)}`;

  const out = [
    '# Prüfliste: alle Produktionen im Überblick',
    '',
    'Diese Liste wird bei jedem Update neu erzeugt. Pro Produktion eine Zeile.',
    '',
    '**Eine Produktion abwählen:** Datei `gesehen.txt` öffnen, den Titel in eine neue Zeile schreiben, speichern. Beim nächsten Update verschwinden alle künftigen Termine dieser Produktion aus dem Kalender. Bereits vergangene Termine bleiben erhalten.',
    '',
  ];
  let lastCompany = '';
  for (const g of rows) {
    if (g.company !== lastCompany) {
      out.push('', `## ${g.company}`, '', '| Produktion | Termine | Zeitraum | Status |', '|---|---|---|---|');
      lastCompany = g.company;
    }
    g.dates.sort();
    const isNew = prevKeys && prevKeys.size > 0 && !prevKeys.has(g.key);
    const status = g.hidden ? 'ausgeblendet (gesehen)' : isNew ? '**neu**' : 'im Kalender';
    const name = g.creator ? `${g.title} – ${g.creator}` : g.title;
    const range = g.dates.length === 1 ? fmt(g.dates[0]) : `${fmt(g.dates[0])} bis ${fmt(g.dates[g.dates.length - 1])}`;
    out.push(`| ${name.replace(/\|/g, '/')} | ${g.dates.length} | ${range} | ${status} |`);
  }
  out.push('', `Stand: ${now.replace('T', ' ')} Uhr (Berliner Zeit)`, '');
  return out.join('\n');
}

export async function main() {
  const now = berlinNow();
  const prev = await readJson(P.archive, { events: [], keys: [] });
  const scraped = [];
  const failed = [];

  for (const [name, prefix, fetcher] of SOURCES) {
    try {
      const evs = await fetcher(new Date());
      console.log(`${name}: ${evs.length} Termine`);
      scraped.push(...evs);
    } catch (err) {
      console.error(`FEHLER bei ${name}: ${err.message}`);
      failed.push({ name, prefix });
    }
  }

  const events = mergeArchive(prev.events, scraped, failed.map((f) => f.prefix), now);
  const seen = await readSeen();

  // Ausgeblendet werden nur künftige Termine; Vergangenes bleibt als Erinnerung im Kalender.
  const visible = events.filter((e) => e.start < now || !isHidden(e, seen));

  await mkdir(path.dirname(P.ics), { recursive: true });
  await mkdir(path.dirname(P.archive), { recursive: true });
  await writeFile(P.ics, buildIcs(visible));

  const prevKeys = new Set(prev.keys || []);
  await writeFile(P.list, prueflisteMarkdown(events, seen, prevKeys, now));

  const keys = [...new Set(events.filter((e) => e.start >= now).map((e) => `${normKey(e.title)}|${e.company}`))].sort();
  const archive = [...events].sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid));
  await writeFile(P.archive, JSON.stringify({ events: archive, keys }, null, 1) + '\n');

  console.log(`Kalender: ${visible.length} Termine (${events.length - visible.length} ausgeblendet)`);
  if (failed.length) {
    console.error(`Achtung: ${failed.length} Quelle(n) nicht erreichbar: ${failed.map((f) => f.name).join(', ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
