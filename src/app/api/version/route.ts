import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// The running deployment's identifier. The installed PWA fetches this and
// compares it to the id it loaded with; when it changes (a new deploy), the
// client does a full reload so updated code/assets actually take effect
// instead of waiting for a manual quit + relaunch. Falls back to 'dev'
// locally, where it never changes (so no reload loop).
export function GET() {
  const id =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? 'dev';
  return NextResponse.json(
    { id },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
