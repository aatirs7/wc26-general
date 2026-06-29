import { SCORING } from '@/lib/constants';
import { PREDICT_EXACT_POINTS, PREDICT_PENS_POINTS } from '@/lib/predict';

export const dynamic = 'force-static';

const ROWS: { label: string; pts: number; note: string }[] = [
  { label: 'Team advances from its group', pts: SCORING.groupTop2, note: 'per team you picked to go through (anywhere in your top 3 of a group) that finishes in the top 2, whatever lane you put it in' },
  { label: 'Best third-place qualifier', pts: SCORING.thirdPlace, note: 'per team you picked to go through that sneaks in as one of the 8 best third-placed teams' },
  { label: 'Exact finishing position', pts: SCORING.groupExactRank, note: 'bonus for every spot you nail exactly: 1st, 2nd, 3rd or 4th in a group' },
  { label: 'Reaches Round of 16', pts: SCORING.reachR16, note: 'per team that wins its Round of 32 tie' },
  { label: 'Reaches Quarter-finals', pts: SCORING.reachQF, note: 'per team that makes the last 8' },
  { label: 'Reaches Semi-finals', pts: SCORING.reachSF, note: 'per team that makes the last 4' },
  { label: 'Reaches the Final', pts: SCORING.reachFinal, note: 'per team that makes the final' },
  { label: 'Champion', pts: SCORING.champion, note: 'your pick lifts the trophy' },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-display text-base text-[var(--accent-ink)]">
        {n}
      </span>
      <div>
        <h3 className="font-display text-lg leading-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

export default function ScoringPage() {
  return (
    <div className="space-y-7 py-4 lg:mx-auto lg:max-w-2xl">
      <header className="pt-2 text-center">
        <h1 className="font-display text-4xl leading-none">How it&apos;s scored</h1>
        <p className="mt-1 text-sm text-muted">Read this before you argue about it.</p>
      </header>

      <section className="space-y-2">
        <p className="text-sm leading-relaxed text-muted">
          You score points for every team you correctly send to a stage,{' '}
          <span className="text-foreground">no matter who they beat to get there</span>. Picking a
          winner in the bracket just means &quot;this team gets to the next round&quot;, and you get
          the points if they really do, even if their real opponent is different from yours.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          For the group stage, what matters is{' '}
          <span className="text-foreground">whether you called a team to go through</span>. If a team
          you ranked in your top 3 of a group actually qualifies, you bank the advance points even if
          you had it 2nd and it finished 3rd, or the other way around. Then you earn an{' '}
          <span className="text-foreground">extra point for every exact spot</span> you nail (1st,
          2nd, 3rd or 4th).
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-center font-display text-2xl">The points</h2>
        <div className="space-y-2">
          {ROWS.map((r) => (
            <div key={r.label} className="card flex items-center gap-3 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-display text-xl text-accent">
                {r.pts}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight">{r.label}</div>
                <div className="text-xs text-muted">{r.note}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          Example: you rank a team 2nd and it actually finishes 3rd but grabs a best-third spot. You
          still called it to go through, so you bank {SCORING.thirdPlace}. Nail a team in its exact
          spot and that is {SCORING.groupExactRank} more, so a team you put 1st that wins its group is
          worth {SCORING.groupTop2 + SCORING.groupExactRank} (advance {SCORING.groupTop2} + exact{' '}
          {SCORING.groupExactRank}).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="mb-3 text-center font-display text-2xl">Live group points</h2>
        <div className="card border-gold/30 bg-gold/[0.06] p-3">
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-bold text-gold">
              Group points go live the moment a group kicks off.
            </span>{' '}
            While a group is in progress, any team you picked to go through that is{' '}
            <span className="text-foreground">currently in the top two</span> of the live table earns
            its {SCORING.groupTop2} advance points right away (plus the{' '}
            <span className="text-foreground">+{SCORING.groupExactRank} bonus</span> if it is sitting
            in the exact spot you called), and those totals move as goals go in and the table
            reshuffles. A team that <span className="text-foreground">has not kicked off yet</span>{' '}
            does not count until it plays. When the group finishes, your picks lock in. Best-third
            points only count once <span className="text-foreground">all 12 groups are done</span>.
            The leaderboard tags this still-moving portion as <span className="text-gold">live</span>.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="mb-3 text-center font-display text-2xl">Bonus: score predictions</h2>
        <div className="card flex items-center gap-3 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 font-display text-xl text-gold">
            {PREDICT_EXACT_POINTS}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight">Exact scoreline</div>
            <div className="text-xs text-muted">nail a match&apos;s exact final score, e.g. 2-1</div>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Call the exact score of any match in the{' '}
          <span className="text-foreground">Predict</span> tab. Spot on earns{' '}
          <span className="text-foreground">{PREDICT_EXACT_POINTS} bonus points</span>; anything else
          scores nothing. Predictions open 24h before kickoff and lock at kickoff. The point scores{' '}
          <span className="text-foreground">live</span> the moment the running score matches your call
          and locks at full time, so it can come and go as the scoreline moves. Bonus points are
          separate from your bracket and add into your{' '}
          <span className="text-foreground">combined</span> standings total.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          <span className="text-foreground">Knockout shootouts:</span> when you call a knockout match
          level, you also pick who wins on penalties. If the tie really is decided on penalties and
          you called the right team, that is{' '}
          <span className="text-foreground">{PREDICT_PENS_POINTS} more bonus point</span> on top of
          the exact score.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-center font-display text-2xl">The big idea</h2>
        <Step n={1} title="Points stack as a team goes deeper">
          A team you ride from the Round of 16 to the title banks{' '}
          {SCORING.reachR16}+{SCORING.reachQF}+{SCORING.reachSF}+{SCORING.reachFinal} ={' '}
          {SCORING.reachR16 + SCORING.reachQF + SCORING.reachSF + SCORING.reachFinal} on the way,
          plus {SCORING.champion} more if they win it. That is{' '}
          {SCORING.reachR16 + SCORING.reachQF + SCORING.reachSF + SCORING.reachFinal + SCORING.champion}{' '}
          points from one team.
        </Step>
        <Step n={2} title="The deep rounds decide it">
          Everyone gets a lot of group picks right, so brackets mostly separate on the knockout
          calls, especially the finalists ({SCORING.reachFinal} each) and the champion (
          {SCORING.champion}). Read the late rounds well and you pull away.
        </Step>
        <Step n={3} title="No penalties, no partial credit">
          A team that busts early just stops earning. There is nothing for &quot;right team, wrong
          round.&quot;
        </Step>
        <Step n={4} title="Points land as results come in">
          Both teams in a group&apos;s current top two score live as soon as the group kicks off; the
          top-2 picks (and any exact-spot bonus) lock in when that group finishes, third-place points
          once all 12 groups are done, and each knockout round as it completes.
        </Step>
      </section>

      <section className="space-y-2">
        <h2 className="text-center font-display text-2xl">Accuracy &amp; ties</h2>
        <p className="text-sm leading-relaxed text-muted">
          <span className="text-foreground">Accuracy</span> is your points divided by the most a
          perfect bracket could have banked so far, as a percentage, a fair way to compare before
          the tournament is over.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          <span className="text-foreground">Ties</span> break by most champion + final points, then
          whoever locked in first.
        </p>
      </section>
    </div>
  );
}
