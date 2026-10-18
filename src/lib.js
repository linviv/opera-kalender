// Gemeinsame Hilfsfunktionen und Spielstätten

export const clean = (s) =>
  (s ?? '').replace(/­/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export const pad = (n) => String(n).padStart(2, '0');

/** Vergleichsschlüssel für Titel (Kleinschreibung, ohne Akzente und Satzzeichen). */
export function normKey(s) {
  return clean(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Spielstätten: "owner" ist das Haus, dem die Bühne gehört bzw. das dort selbst spielt.
export const VENUES = {
  SUL: { house: 'Staatsoper Unter den Linden', owner: 'Staatsoper Unter den Linden', street: 'Unter den Linden 7, 10117 Berlin' },
  DOB: { house: 'Deutsche Oper Berlin', owner: 'Deutsche Oper Berlin', street: 'Bismarckstraße 35, 10627 Berlin' },
  DOB_TISCHLEREI: { house: 'Deutsche Oper Berlin (Tischlerei)', owner: 'Deutsche Oper Berlin', street: 'Bismarckstraße 35, 10627 Berlin' },
  KOB_SCHILLER: { house: 'Schillertheater', owner: 'Komische Oper Berlin', street: 'Bismarckstraße 110, 10625 Berlin' },
  KOB_HANGAR: { house: 'Flughafen Tempelhof, Hangar 4', owner: 'Komische Oper Berlin', street: 'Columbiadamm 10, 12101 Berlin' },
  KONZERTHAUS: { house: 'Konzerthaus Berlin', owner: 'Komische Oper Berlin', street: 'Gendarmenmarkt 2, 10117 Berlin' },
};

/** Ortsangabe: "<Kompanie> @ <Haus>, <Straße>" bzw. nur "<Haus>, <Straße>", wenn die Kompanie im eigenen Haus spielt. */
export function locationText(company, venue) {
  const name = venue.house.includes(company) ? venue.house : `${company} @ ${venue.house}`;
  return venue.street ? `${name}, ${venue.street}` : name;
}

/** Ordnet einen Spielstättentext der Komischen Oper einer bekannten Bühne zu. */
export function kobVenue(text) {
  const t = clean(text);
  if (/schiller/i.test(t)) return VENUES.KOB_SCHILLER;
  if (/hangar|tempelhof/i.test(t)) return VENUES.KOB_HANGAR;
  if (/konzerthaus/i.test(t)) return VENUES.KONZERTHAUS;
  return { house: t, owner: 'Komische Oper Berlin', street: '' };
}

/** Ordnet den Spielstättentext des Staatsballetts einer bekannten Bühne zu. */
export function sbbVenue(text) {
  const t = clean(text);
  if (/staatsoper/i.test(t)) return VENUES.SUL;
  if (/tischlerei/i.test(t)) return VENUES.DOB_TISCHLEREI;
  if (/deutsche oper/i.test(t)) return VENUES.DOB;
  if (/schiller|komische oper/i.test(t)) return VENUES.KOB_SCHILLER;
  return { house: t, owner: 'Staatsballett Berlin', street: '' };
}

export const COMPANIES = {
  SUL: 'Staatsoper Unter den Linden',
  DOB: 'Deutsche Oper Berlin',
  KOB: 'Komische Oper Berlin',
  SBB: 'Staatsballett Berlin',
};

/** Beginn der aktuellen Spielzeit (1. August) als Datum "YYYY-MM-DD". */
export function seasonStart(now = new Date()) {
  const y = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${y}-08-01`;
}

/** Aktuelle Berliner Ortszeit als "YYYY-MM-DDTHH:MM". */
export function berlinNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
  return parts.replace(' ', 'T');
}

/** Addiert Minuten zu einer lokalen Zeit "YYYY-MM-DDTHH:MM" (ohne Zeitzonenumrechnung). */
export function addMinutes(local, minutes) {
  const d = new Date(local + ':00Z');
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lädt eine URL mit Wiederholungen. Gibt null bei 404 zurück. */
export async function getText(url, { json = false } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'opera-kalender/1.0 (privater Spielplan-Kalender)',
          accept: json ? 'application/json' : 'text/html',
          'accept-language': 'de-DE,de;q=0.9',
        },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
      return json ? await res.json() : await res.text();
    } catch (err) {
      lastErr = err;
      await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

export { sleep };
