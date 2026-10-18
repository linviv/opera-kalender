// Komische Oper Berlin: Monatsseiten des Kalenders (HTML).
import { parseHTML } from 'linkedom';
import { clean, getText, sleep, kobVenue, COMPANIES } from '../lib.js';

const BASE = 'https://www.komische-oper-berlin.de';

/** Liest eine Monatsseite. Regeln:
 *  - Nur Einträge mit Komponistenzeile (Führungen, Matineen, Workshops, Kammerkonzerte haben keine).
 *  - Kinder- und Familienvorstellungen ("Jung für alle") werden ausgelassen.
 *  - Ballette ("Choreografie von ...") kommen aus dem Spielplan des Staatsballetts. */
export function parseKobMonth(document) {
  const events = [];
  for (const el of document.querySelectorAll('.performance')) {
    const meta = el.querySelector('meta[itemprop="startDate"]');
    if (!meta) continue;

    const author = clean(
      [...el.querySelectorAll('.performance__author')].map((a) => a.innerHTML.replace(/<br\s*\/?>/gi, ' ')).join(' ')
        .replace(/<[^>]+>/g, ' ')
    );
    if (!author) continue;
    if (/^choreo/i.test(author)) continue;

    const side = clean([...el.querySelectorAll('.performance__sideinfoscol')].map((x) => x.textContent).join(' '));
    if (/jung für alle/i.test(side)) continue;

    const link = el.querySelector('.performance__link');
    const title = clean(link?.textContent);
    if (!title) continue;

    const id = (el.getAttribute('id') || '').match(/p(\d+)$/)?.[1];
    if (!id) continue;

    const href = link.getAttribute('href') || '';
    events.push({
      uid: `kob-${id}`,
      company: COMPANIES.KOB,
      kind: 'oper',
      title,
      creator: author,
      venue: kobVenue(el.querySelector('.performance__location')?.textContent),
      start: meta.getAttribute('content').slice(0, 16),
      end: null,
      url: href.startsWith('http') ? href : BASE + href,
      premiere: /premiere/i.test(side),
    });
  }
  return events;
}

export function monthKeys(now = new Date(), count = 14) {
  const keys = [];
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  for (let i = 0; i < count; i++) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return keys;
}

export async function fetchKob(now = new Date()) {
  const all = [];
  let pagesFound = 0;
  for (const key of monthKeys(now)) {
    const html = await getText(`${BASE}/spielplan/kalender/${key}/`);
    await sleep(300);
    if (!html) continue;
    pagesFound++;
    all.push(...parseKobMonth(parseHTML(html).document));
  }
  if (pagesFound === 0) throw new Error('Komische Oper: keine Monatsseite erreichbar');
  return all;
}
