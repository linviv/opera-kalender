// Staatsballett Berlin: Der gesamte Spielplan steht auf einer Seite (HTML).
import { parseHTML } from 'linkedom';
import { clean, getText, sbbVenue, COMPANIES } from '../lib.js';

const URL_SCHEDULE = 'https://www.staatsballett-berlin.de/spielplan.html';

/** Liest die Spielplanseite. Regeln:
 *  - Nur Termine ohne Education-Kategorie (Workshops, Familienvormittage, Ferienkurse, Talks tragen eine Kategorienummer).
 *  - Nur Einträge mit Choreografenzeile; Kinderstücke werden ausgelassen.
 *  - Als Titelzusatz dient die Choreografin bzw. der Choreograf. */
export function parseStaatsballett(document) {
  const events = [];
  for (const f of document.querySelectorAll('.frame-spielplan[data-ts]')) {
    const kat = clean(f.getAttribute('data-bg_kategorien'));
    if (kat !== '' && kat !== '2') continue;

    const title = clean(f.querySelector('h3')?.textContent);
    const content = f.querySelector('.ni-teaser-content');
    if (!title || !content) continue;

    const lines = content.innerHTML
      .split(/<br\s*\/?>/i)
      .map((l) => clean(l.replace(/<\/?em>/gi, '\u0001').replace(/<[^>]+>/g, ' ')));
    const first = lines[0] || '';
    if (!/^(choreograph|choreograf|ballett von|tanzstück)/i.test(first)) continue;
    if (/kinder/i.test(lines.join(' '))) continue;

    // Namen stehen zwischen \u0001-Markern; bei "Choreographie von X & Inszenierung von Y" nur X.
    // Auch "Choreographie und Inszenierung von X nach A und B": nur nach einem Namen abschneiden, vor "nach" ebenfalls.
    const cut = first.split(/(?<=\u0001)\s*(?:&|und)\s*Inszenierung/i)[0].split(/\bnach\b/i)[0];
    const names = [...cut.matchAll(/\u0001([^\u0001]+)\u0001/g)].map((m) => clean(m[1]));
    const creator = names.join(' & ');
    if (!creator) continue;

    const ts = Number(f.getAttribute('data-ts'));
    if (!ts) continue;
    // Der Zeitstempel enthält die Berliner Uhrzeit als UTC-Wert.
    const start = new Date(ts * 1000).toISOString().slice(0, 16);

    const id = (f.innerHTML.match(/\/ical\/content\/event\/(\d+)\.html/) || [])[1];
    if (!id) continue;

    const link = f.querySelector('a.ni-link-title')?.getAttribute('href') || URL_SCHEDULE;
    const venueText = clean(f.querySelector('.ni-venue')?.textContent);
    const label = clean(f.textContent);

    events.push({
      uid: `sbb-${id}`,
      company: COMPANIES.SBB,
      kind: 'ballett',
      title,
      creator,
      venue: sbbVenue(venueText),
      start,
      end: null,
      url: link,
      premiere: /(^|\s)Premiere(\s|$)/.test(label),
      timeText: clean(f.querySelector('.time')?.textContent),
    });
  }
  return events;
}

export async function fetchStaatsballett() {
  const html = await getText(URL_SCHEDULE);
  if (!html) throw new Error('Staatsballett: Spielplanseite nicht erreichbar');
  const events = parseStaatsballett(parseHTML(html).document);
  if (events.length === 0) throw new Error('Staatsballett: keine Termine gefunden');
  return events;
}
