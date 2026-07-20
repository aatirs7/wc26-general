// Who can read everybody's suggestions and reviews.
//
// Auth in this app is a name cookie by design, so this is a convenience gate
// for the owner rather than a security boundary. Keep the list short.

const ADMIN_NAMES = ['aatir'];

export function isFeedbackAdmin(displayName: string | null | undefined): boolean {
  if (!displayName) return false;
  return ADMIN_NAMES.includes(displayName.trim().toLowerCase());
}
