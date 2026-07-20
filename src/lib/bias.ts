// House bias. This pool has an owner, the owner has opinions, and the finale
// is allowed to have a personality. Everything partisan lives in this one file
// so it can be tuned or deleted in a single place without touching the stats.
//
// The rules: the bias only ever changes COPY, never a number, never a rank,
// never a point. If you delete this module the standings are identical.

export const GOAT = 'POR'; // Portugal
export const RIVAL = 'ARG'; // Argentina

export function isGoat(code: string | null | undefined): boolean {
  return code === GOAT;
}
export function isRival(code: string | null | undefined): boolean {
  return code === RIVAL;
}

// Line shown when a player's champion pick is revealed.
export function championBias(code: string | null | undefined): string | null {
  if (isGoat(code)) return 'Portugal. Correct answer regardless of result. This app respects you.';
  if (isRival(code)) return 'Argentina. A choice was available to you and this is the one you made.';
  return null;
}

// Line shown on the ride-or-die slide.
export function rideBias(code: string | null | undefined, name: string): string | null {
  if (isGoat(code)) return `Carried by ${name}, as is right and proper.`;
  if (isRival(code)) return `Yes, ${name} scored you points. We are all very happy for you.`;
  return null;
}

// Line shown when a heavily backed team busts.
export function betrayalBias(code: string | null | undefined): string | null {
  if (isGoat(code)) return 'Not Ronaldos fault. We looking at you Bruno Fernandes..';
  if (isRival(code)) return 'Honestly, this one felt inevitable from here.';
  return null;
}

// Pool-level jab on the champion-pick distribution slide.
export function poolChampionBias(code: string, count: number): string | null {
  if (isGoat(code)) return `${count} of you have taste.`;
  if (isRival(code)) return `${count} of you went with Argentina. Sit with that.`;
  return null;
}

// Extra flourish under the actual World Cup winner.
export function actualChampionBias(code: string | null | undefined): string | null {
  if (isGoat(code)) return 'Football is healed.';
  if (isRival(code)) return 'We are legally required to display this. We are not required to enjoy it.';
  return null;
}

// A one-line verdict on how far the two teams went, used on the pool deck.
export function exitBias(code: string, exitLabel: string, champion: boolean): string | null {
  if (isGoat(code)) {
    return champion
      ? 'Portugal won the World Cup. Nothing further, your honour.'
      : `Portugal went out at ${exitLabel}. Robbed, obviously.`;
  }
  if (isRival(code)) {
    return champion
      ? `Argentina won it. This slide has been reviewed and we stand by our disappointment.`
      : `Argentina went out at ${exitLabel}. No notes. Perfect. Beautiful.`;
  }
  return null;
}
