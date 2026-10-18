// Erzeugt eine iCalendar-Datei (.ics), die Apple Kalender, Google Kalender und Outlook abonnieren können.
import { addMinutes, locationText } from './lib.js';

const esc = (s) =>
  String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Faltet Zeilen auf höchstens 75 Byte (RFC 5545). */
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const stamp = (local) => local.replace(/[-:]/g, '') + '00';

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
];

export function summaryOf(ev) {
  return ev.creator ? `${ev.title} – ${ev.creator}` : ev.title;
}

export function buildIcs(events, { name = 'Oper & Ballett Berlin' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//opera-kalender//Oper und Ballett Berlin//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...VTIMEZONE,
  ];

  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid));
  for (const ev of sorted) {
    const end = ev.end || addMinutes(ev.start, ev.kind === 'ballett' ? 150 : 180);
    const desc = [
      ev.company + (ev.kind === 'ballett' ? ' (Ballett)' : ' (Oper)'),
      ev.premiere ? 'Premiere' : null,
      ev.url ? `Infos und Karten: ${ev.url}` : null,
    ].filter(Boolean).join('\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}@opera-kalender`,
      'DTSTAMP:20260101T000000Z',
      `DTSTART;TZID=Europe/Berlin:${stamp(ev.start)}`,
      `DTEND;TZID=Europe/Berlin:${stamp(end)}`,
      `SUMMARY:${esc(summaryOf(ev))}`,
      `LOCATION:${esc(locationText(ev.company, ev.venue))}`,
      `DESCRIPTION:${esc(desc)}`,
      ev.url ? `URL:${ev.url}` : null,
      `CATEGORIES:${esc(ev.kind === 'ballett' ? 'Ballett' : 'Oper')}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).map(fold).join('\r\n') + '\r\n';
}
