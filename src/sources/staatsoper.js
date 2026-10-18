// Staatsoper Unter den Linden: Spielplan nach Kategorie "Oper: Alle" (HTML, seitenweise).
import { parseHTML } from 'linkedom';
import { clean, getText, sleep, addMinutes, VENUES, COMPANIES } from '../lib.js';

const BASE = 'https://www.staatsoper-berlin.de';

/** Liest eine Seite der Staatsoper-Spielplanliste. Gibt Termine und den Link zur nächsten Seite zurück.
 *  Behalten werden nur Opernabende im Haus Unter den Linden mit Komponistenangabe;
 *  Kinderfassungen, Gastspiele und Live-Übertragungen fallen heraus. */
export function parseStaatsoperPage(document) {
  const events = [];
  for (const t of document.querySelectorAll('.termin')) {
    const a = t.querySelector('.termin__title a');
    const time = t.querySelector('time')?.getAttribute('datetime');
    if (!a || !time) continue;

    const venue = clean(t.querySelector('.termin__spielstaette')?.textContent);
    if (venue !== 'Staatsoper Unter den Linden') continue;

    const title = clean(a.textContent);
    if (!title || /für kinder|live-übertragung|gastspiel/i.test(title)) continue;

    let creator = clean(t.querySelector('.termin__werkinfo')?.textContent);
    creator = creator.replace(/,\s*(halbszenische|konzertante|szenische)[^,]*$/i, '');
    if (!creator) continue;

    const id = (a.getAttribute('href') || '').match(/#event-(\d+)/)?.[1];
    if (!id) continue;

    const start = time.replace(' ', 'T').slice(0, 16);
    const dur = clean(t.querySelector('.termin__spieldauer')?.textContent).match(/(\d+):(\d{2})\s*h/);
    const end = dur ? addMinutes(start, Number(dur[1]) * 60 + Number(dur[2])) : null;

    events.push({
      uid: `so-${id}`,
      company: COMPANIES.SUL,
      kind: 'oper',
      title,
      creator,
      venue: VENUES.SUL,
      start,
      end,
      url: BASE + a.getAttribute('href').replace(/#.*$/, ''),
      premiere: false,
    });
  }

  const next = [...document.querySelectorAll('a')]
    .filter((x) => /^(weiter|nächste|next)/i.test(clean(x.textContent)))
    .map((x) => x.getAttribute('href'))
    .find((h) => h && h.includes('/spielplan/'));
  return { events, next: next || null };
}

export async function fetchStaatsoper(now = new Date()) {
  const month = `01-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${now.getUTCFullYear()}`;
  let url = `/de/spielplan/${month}/2/`; // Kategorie 2 = "Oper: Alle"
  const seen = new Set();
  const all = [];
  for (let pages = 0; url && !seen.has(url) && pages < 100; pages++) {
    seen.add(url);
    const html = await getText(BASE + url);
    if (!html) break;
    const { events, next } = parseStaatsoperPage(parseHTML(html).document);
    all.push(...events);
    url = next;
    await sleep(300);
  }
  if (all.length === 0) throw new Error('Staatsoper: keine Termine gefunden');
  return all;
}
