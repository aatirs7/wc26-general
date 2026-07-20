# Finale copy review

Every written line in the end-of-tournament finale, in one place, so it can be
reviewed and edited without hunting through components. Grouped by where it
appears. `{braces}` are real values filled in at render time.

Tone brief this was written to: funny and weighty, human, short sentences,
allowed to be a little mean, warm at the end. No em dashes anywhere.

Anything partisan lives in **section 8** and only ever changes copy, never a
number, a rank or a point.

---

## 1. Your Wrapped (`src/components/finale/WrappedDeck.tsx`)

### Cold open
> Twenty six days.
> 104 matches.
> One bracket.
>
> **{name}**
>
> Here is how your World Cup actually went.

### The number
- Kicker: `Your final total`
- `{points} points in {pool}.`
- If you beat anyone: `You finished above {n} people.`
- If you finished last: `Someone has to be at the bottom. It was you.`

### Rank journey
- Kicker: `The long way round`
- Heading: `Where you stood` / `all tournament`
- Legend: `Peak: {rank}` and `Low: {rank}`
- If you peaked higher than you finished:
  `You were {rank} {after the quarter-finals}. You are not {rank} now.`
- If you finished at your peak:
  `You started {rank} and climbed to {rank}. You finished at your peak.`
- If you were flat all tournament:
  `You held around {rank} for most of it. Consistency is a personality.`

### Best or worst week
- Kicker: `Your best week` or `Your worst week`
- `{n} places gained {after the quarter-finals}. {3rd} to {1st}. That was the run.`
- `{n} places lost {after the semi-finals}. {1st} to {4th}. That was the damage.`

### Your champion
- Kicker: `You crowned`
- Correct: `And they went and did it. You called the World Cup winner months in advance and you have the points to prove it.`
- Wrong: `They went out at {the quarter-finals}. The trophy went to {flag} {team}.`

### Ride or die
- Kicker: `Your ride or die`
- `They put {n} points on your total across {n} separate calls. Nobody else came close to carrying you like that.`

### The betrayal
- Kicker: `The betrayal`
- `You backed them {to win the whole thing}. They went out at {the group stage} and took {n} points with them.`

### Best call
- Kicker: `Your best call`
- `+{points}`
- `{Team} {reached the semi-finals}`
- `Your single most valuable moment of foresight.`

### Points left on the table
- Kicker: `Points left on the table`
- `{n} points that were available and did not end up yours.`
- `A perfect bracket was worth {n}. You took {n}.`
- `Nobody got all of them. That is not really the point.`

### Score predictions (if you made any)
- Kicker: `The score predictions`
- `{n} scorelines called. {n} landed exactly, for {n} bonus points.`
- `Your boldest call` / `{Home} 4 - 3 {Away}` / `{n} goals. Ambitious.`
- Over-predicted: `You wanted more football than football wanted to give.`
- Under-predicted: `You were braced for a lot less than you got.`
- Dead on: `Somehow, exactly right in aggregate.`
- `You also called {n} penalty shootouts correctly.`

### Score predictions (if you made none)
> **0**
>
> You did not call a single scoreline all tournament. The button was right there, for a month, every day. We are not angry.

### Trash talk
- Kicker: `Trash talk`
- Ring: `{n}%` / `of the chat`
- `You sent {n} of the {n} messages in {pool}, the {4th} loudest person in the group.`
- `Loudest day: {Saturday 27 June}, {n} messages.`
- Quote card: `your longest message`

### Your nemesis
- Kicker: `Your nemesis`
- `You two swapped places {n} times over the tournament. It ended with {you ahead / them ahead} by {n} points.`
- If ahead: `Do not let them forget it.`
- If behind: `There is always 2030.`

### Bracket twin
- Kicker: `Your bracket twin`
- `{n}% identical to {name}`
- High overlap: `You and {name} filled in almost the same bracket. One of you had an original thought and we are not sure which.`
- Low overlap: `{name} came closest to thinking like you, and even then only {n}% of the way. You were on your own out there.`

### Trophy case
- Kicker: `Your trophy case` / `{n} badges`
- Badge titles and descriptions come from the existing `src/lib/achievements.ts`, unchanged.

### Persona
- Kicker: `Your tournament persona` (see section 3 for the personas)

### Final placement
- Kicker: `Full time` / `{3rd}` / `of {n} in {pool}`
- Won it: `You won the whole thing. Enjoy it, it is four years until the next one.`
- Podium: `A podium finish. Close enough to taste it, far enough to still be annoyed.`
- Last: `Dead last. Somebody had to anchor the table and you volunteered.`
- Anywhere else: `Mid-table respectability. The most human outcome available.`

### Outro
> **That was your World Cup**
>
> Thanks for playing. See you in 2030, when you will absolutely do this again and absolutely not learn from any of it.

Buttons: `Share your Wrapped`, `Watch the pool Wrapped`, `See the podium`.

---

## 2. Pool Wrapped (`src/components/finale/PoolWrappedDeck.tsx`)

### Cold open
> One tournament.
> {n} of you.
> One table.
>
> **{pool}**
>
> This is what the group did to itself over a month.

### The field
- Kicker: `The damage, in total`
- `{n} points scored between you`, `{n} messages sent`, `{n} scorelines called`

### Who you all crowned
- Kicker: `Who you all crowned` / `The champion vote`
- Someone got it: `{n} of you had {flag} {team}. Everyone else was simply wrong.`
- Nobody got it: `Not one of you picked {flag} {team}. A perfect, collective miss.`

### The team you all believed in
- `{n} of {n} brackets had them going deep. They {won the whole thing / went out at the quarter-finals}.`

### Nobody saw it coming
- Zero backers: `Reached {the semi-finals} with zero brackets backing them. Not one person in {pool} believed.`
- Few backers: `Reached {the final} with only {n} brackets backing them.`

### Agreed on, and wrong
- `{n} of you sent them to the final. They got as far as {the Round of 16}. When this group agrees on something, be worried.`

### The big shakeup
- Kicker: `The big shakeup` / `{After the quarter-finals}`
- `{n} places changed hands in a single round. Nothing else came close.`
- Then the top three risers, `up {n}`.

### Life at the top
- Kicker: `Life at the top`
- No changes: `0 lead changes. Somebody took first place and simply never gave it back.`
- Otherwise: `{n} times first place changed hands.`
- `{name} led at {n} of the {n} checkpoints, more than anyone.`

### Loudest voices
- Kicker: `Loudest voices` / `{n} messages`
- `Peak noise: {Saturday 27 June}, {n} messages in one day.`
- Quote card: `{name}, longest message of the tournament`

### The prediction wall
- `{n} exact scorelines called out of {n} attempts across the whole group.`
- `Everyone saw this one` / `{n} of {n} predictions nailed it`
- `Nobody saw this one` / `{n} tried, none correct`

### The data awards
- Kicker: `The data awards` / `Earned, not voted`
- Award titles and blurbs come from the existing `src/lib/results.ts`, unchanged
  (The Oracle, Deep-Run King, Prediction King, Group Stage Guru, Lone Wolf,
  Biggest Riser, Wooden Spoon).

### The people's awards
- Kicker: `The people's awards` / `Voted by the group`
- Tie: `Too close to call`
- Nothing voted yet: `Nobody has voted yet. There are {n} categories sitting there, completely empty, waiting for someone to start an argument.`

### Outro
> **{pool}, that is a wrap**
>
> {winner} won it. The rest of you have four years to think about what happened here.

---

## 3. Personas (`pickArchetype` in `src/lib/wrapped.ts`)

Ordered rules, first match wins.

| Persona | Trigger | Line |
|---|---|---|
| 👑 The Champion | Finished 1st | You won. Everything else on this page is a footnote. |
| 🌄 The Late Bloomer | Climbed a lot | You started {10th} and finished {2nd}. Nobody who saw matchday one saw this coming. |
| 🕳️ The Slow Puncture | Fell a lot | You were {1st} once. You finished {9th}. It happened quietly, over weeks. |
| 🔮 The Oracle | Called the champion, finished top quarter | You called the champion and finished near the top. There is nothing to explain. |
| 👻 The Ghost | Zero messages | Not a single message all tournament. Whatever you were thinking, you kept it. |
| 🎙️ The Pundit | 25%+ of the chat, outside the top quarter | You produced {n}% of the group chat and finished {8th}. Analysis is easy. |
| 🎰 The Degenerate | 20+ predictions, 2 or fewer hits | {n} scorelines called. {n} landed. You kept pulling the lever. |
| 🛡️ The Loyalist | One team carried a third of your points | {flag} {team} carried {n} of your points. That was the plan and it worked. |
| 📋 The Consensus | 70%+ bracket overlap with someone | Your bracket was {n}% identical to {name}. Safe is a strategy. |
| 🌤️ The Optimist | Bottom 15% | It did not work. You will be back in 2030 with the exact same energy. |
| ⚖️ The Realist | Everything else | {5th} of {12}. No disasters, no miracles. A respectable tournament. |

---

## 4. Voted superlatives (`src/lib/superlatives.ts`)

14 categories. Self-votes are blocked everywhere except the two marked.

| Award | Question | Small print |
|---|---|---|
| 🔮 Most Delusional | Who backed a team with their whole chest and got absolutely nothing back? | Belief is free. Points are not. |
| 🥷 Quiet Assassin | Who said almost nothing all tournament and quietly finished near the top? | No noise. Just points. |
| 📣 Loudest For The Least | Who talked the most and had the least to show for it? | Volume is not a tiebreaker. |
| 🎤 Best Trash Talk | Who sent the one line that genuinely ended somebody? | Somewhere, a group chat still has not recovered. |
| 🟥 Most Likely To Blame The Referee | Whose bracket was never wrong, it was just badly officiated? | It was offside. It was always offside. |
| 🚫 Banned From Brackets In 2030 | Who should not be allowed near a bracket four years from now? | For their own good, really. |
| 🧊 Clutch Merchant | Who peaked at exactly the right moment? | Timing is a skill. |
| 🚌 The Bandwagon | Who switched allegiance the second it got difficult? | Loyalty, but make it flexible. |
| 💸 Would Trust With Your Money | Whose picks would you actually put money behind next time? | The highest honour available here. |
| 👻 Biggest Ghost | Who joined, disappeared for a month, and reappeared for the final? | Present in spirit. Mostly spirit. |
| 🌱 Most Improved Human Being | Purely vibes. Who grew the most as a person this tournament? | No data was harmed in the making of this award. |
| 🐐 The GOAT Truther *(self-vote allowed)* | Who argued hardest, and most correctly, that Ronaldo is the greatest of all time? | Some hills are worth it. |
| 🙃 The Messi Apologist | Who spent the tournament defending Messi and Argentina to anyone who would listen? | Every group has one. This is them. |
| 😤 Most Confident *(self-vote allowed)* | Who was the most sure of themselves? You are allowed to pick yourself here. | The only category where nominating yourself is the point. |

### Voting screen
- `The people's awards` / `Cast your votes`
- `Every tally is live and every vote shows your name next to it. Choose accordingly. You can change your mind, and tapping your own pick again withdraws it.`
- `{n} of {n} categories voted`
- Empty category: `No votes yet. Somebody has to go first.`
- Receipts header: `Who voted for whom`

---

## 5. The finale hub (`src/components/finale/FinaleHub.tsx`)

- `Full time` / `The finale`
- `It is over. Everything that happened in {pool} over the last month, three ways.`
- **Your Wrapped**: `Your tournament, slide by slide. Not all of it is flattering.`
- **{pool} Wrapped**: `What the {n} of you did to each other, in numbers.`
- **The podium**: `Gold, silver and bronze. {winner} took it.` (winner's name is rendered blurred until you open it)
- **The people's awards**: `{n} categories still need your vote. Everyone sees who you picked.`
  or `You have voted in every category. Go and check the damage.`

Locked state (before the final ends):
> The podium, your Wrapped, the pool Wrapped and the people's awards all unlock the moment the World Cup final ends. Come back once the trophy is lifted.

---

## 6. The takeover splash (`src/components/results/FinaleTakeover.tsx`)

> 🏆
> **Full time**
> **It is over**
>
> Every match has been played. Your Wrapped, the pool Wrapped, the podium and the people's awards are all waiting.

Buttons: `Watch your Wrapped`, `See the podium`, `Everything else`, `Maybe later`.

---

## 7. Podium and Match Day

Podium (`src/components/finale/PodiumStage.tsx`):
- `Full time` / `{pool}` / `Final standings`
- `Pool champion`
- `Backed {flag} {team} to lift it, and called it exactly right.`
- `Backed {flag} {team} to lift it. The trophy actually went to {flag} {team}.`
- `The rest of the field`
- `You finished {3rd} of {n} on {n} points.`
- Controls: `Skip`, `Run it back`

Match Day, once every match is played (`src/app/live/page.tsx`):
> **That is full time on all of it**
>
> Every one of the 104 matches has been played. There is no next kickoff. All that is left is the reckoning.

- Today list: `The tournament is finished. There will not be another one of these for four years.`

Standings banner (`src/app/leaderboard/page.tsx`):
- `🏆 This table is final` / `Your Wrapped, the pool Wrapped and the podium are ready`

Home, once the finale is live: `Back to the app` toggle hides and shows the normal dashboard.

---

## 8. House bias (`src/lib/bias.ts`)

Pro Portugal and Ronaldo, anti Argentina and Messi, as requested. These are the
only opinionated lines in the app and they are all in this one file. Delete the
file's contents and the finale still computes identically; only the commentary
disappears. They render in a distinct gold italic box so it is visually obvious
they are editorial rather than a stat.

**Champion pick reveal**
- Portugal: `Portugal. Correct answer regardless of result. This app respects you.`
- Argentina: `Argentina. A choice was available to you and this is the one you made.`

**Ride or die**
- Portugal: `Carried by Portugal, as is right and proper.`
- Argentina: `Yes, Argentina scored you points. We are all very happy for you.`

**The betrayal**
- Portugal: `Not their fault. Never their fault.`
- Argentina: `Honestly, this one felt inevitable from here.`

**Pool champion-pick distribution**
- Portugal: `{n} of you have taste.`
- Argentina: `{n} of you went with Argentina. Sit with that.`

**Under the actual World Cup winner**
- Portugal: `Football is healed.`
- Argentina: `We are legally required to display this. We are not required to enjoy it.`

**How far they went (pool deck)**
- Portugal won it: `Portugal won the World Cup. Nothing further, your honour.`
- Portugal out: `Portugal went out at {the quarter-finals}. Robbed, obviously.`
- Argentina won it: `Argentina won it. This slide has been reviewed and we stand by our disappointment.`
- Argentina out: `Argentina went out at {the final}. No notes. Perfect. Beautiful.`

Plus the two voting categories in section 4: **The GOAT Truther** and
**The Messi Apologist**.

Note: Spain beat Argentina 1-0 after extra time, so the Argentina-out lines are
the ones that will actually fire this tournament.

---

## 9. Stats, Siddiqui build only (`src/components/stats/HeadToHeadStats.tsx`)

- `House champions` / `The best player in each household, put up against each other.`
- Inside each family card: `👑 {name}, {n} pts`
