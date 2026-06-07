const STYLES: Record<string, { label: string; cls: string; dot?: boolean }> = {
  live: { label: 'LIVE', cls: 'bg-live/15 text-live', dot: true },
  ht: { label: 'HT', cls: 'bg-gold/15 text-gold' },
  ft: { label: 'FT', cls: 'bg-white/[0.06] text-muted' },
  et: { label: 'AET', cls: 'bg-white/[0.06] text-muted' },
  pens: { label: 'PENS', cls: 'bg-white/[0.06] text-muted' },
};

export default function StatusPill({ status }: { status: string }) {
  const s = STYLES[status];
  if (!s) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-bold tracking-wider ${s.cls}`}
    >
      {s.dot ? <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" /> : null}
      {s.label}
    </span>
  );
}
