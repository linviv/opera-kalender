// Deutsche Oper Berlin: Der Kalender lädt seine Termine aus einer JSON-Quelle (event.json).
import { clean, pad, getText, sleep, seasonStart, VENUES, COMPANIES } from '../lib.js';

const BASE = 'https://deutscheoperberlin.de';

/** Wandelt die JSON-Einträge in Termine um und sortiert Nicht-Aufführungen aus. */
export function parseDob(entries) {
  const events = [];
  for (const e of entries) {
    const formal = clean(e.FormalCategory);
    const content = clean(e.ContentCategory);
    const location = clean(e.Location);

    // Nur reguläre Opernabende im Haus (Großes Haus oder Tischlerei); keine Kinderstücke, Führungen, Gespräche, Konzerte.
    if (!['Oper', 'Opera'].includes(formal)) continue;
    if (['Ballett', 'Führung'].includes(content)) continue;
    if (!['Großes Haus', 'Tischlerei'].includes(location)) continue;

    const title = clean(e.Title);
    if (!title) continue;

    const year = (clean(e.DateMonthYear).match(/\d{4}/) || [])[0];
    const month = pad(clean(e.DateMonthNum));
    const day = pad(clean(e.DateDayNum));
    const startTime = clean(e.DateTimeStart);
    if (!year || !/^\d{1,2}:\d{2}$/.test(startTime)) continue;
    const start = `${year}-${month}-${day}T${pad(startTime.split(':')[0])}:${startTime.split(':')[1]}`;

    let end = null;
    const endTime = clean(e.DateTimeEnd);
    if (/^\d{1,2}:\d{2}$/.test(endTime)) {
      const candidate = `${year}-${month}-${day}T${pad(endTime.split(':')[0])}:${endTime.split(':')[1]}`;
      if (candidate > start) end = candidate;
    }

    const info = clean(e.OpusInfoShort);
    const composer = (info.match(/\bvon\s+(.+)$/i) || [])[1] || '';

    events.push({
      uid: `dob-${e.IdEventDate}`,
      company: COMPANIES.DOB,
      kind: 'oper',
      title,
      creator: clean(composer),
      venue: location === 'Tischlerei' ? VENUES.DOB_TISCHLEREI : VENUES.DOB,
      start,
      end,
      url: e.Slug ? BASE + e.Slug : BASE + '/de_DE/calendar',
      premiere: Array.isArray(e.StatusIsPremiere) && e.StatusIsPremiere.length > 0,
    });
  }
  return events;
}

export async function fetchDob(now = new Date()) {
  const from = seasonStart(now);
  const all = [];
  for (let p = 1; p <= 60; p++) {
    const url = `${BASE}/de_DE/event.json?current_page=calendar&date_from=${from}&location=alle&category=alle&status=&p=${p}`;
    const json = await getText(url, { json: true });
    if (!json || !Array.isArray(json.EventOverview)) throw new Error('Deutsche Oper: unerwartetes Antwortformat');
    all.push(...json.EventOverview);
    if (json.Pager?.IsLastPage || json.EventOverview.length === 0) break;
    await sleep(300);
  }
  return parseDob(all);
}
