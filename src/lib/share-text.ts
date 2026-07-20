// The message that rides along with a shared image, so a text lands with
// context rather than as a bare screenshot. Pure and structurally typed, so
// both the podium (ResultPlayer) and the pool deck (Standing) can pass their
// own row shape without a conversion.

export function congratsText(
  poolName: string,
  podium: { name: string; combined: number }[],
  champion: string | null,
): string {
  const places = ['first', 'second', 'third'];
  const named = podium.slice(0, 3).map((p, i) => `${p.name} (${places[i]}, ${p.combined} pts)`);
  if (named.length === 0) return `${poolName} is finished.`;

  const list =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;

  return `That is full time on ${poolName}. Congratulations to ${list}.${
    champion ? ` ${champion} won the World Cup.` : ''
  }`;
}
