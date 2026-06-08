// The schedule is shown in one fixed timezone so day headings and kickoff
// times always agree (grouping by UTC while showing local time made a
// Friday 9pm ET match sit under a "Saturday" heading). Eastern is the
// canonical "tournament time" for this pool. Change the constant + label
// below to move everyone to a different zone (display only; sync is UTC).

export const DISPLAY_TZ = 'America/New_York';
export const DISPLAY_TZ_LABEL = 'ET';

// Stable YYYY-MM-DD key in the display timezone (sorts lexicographically).
export function matchDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function matchDayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', {
    timeZone: DISPLAY_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function matchTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    timeZone: DISPLAY_TZ,
    hour: 'numeric',
    minute: '2-digit',
  });
}
