'use client';

import { useState } from 'react';
import { GameShell, type GameProps } from './GameShell';
import { cn } from '@/lib/utils';

/** All 28 states + 8 union territories with their capitals (public factual data). */
export const STATES_AND_CAPITALS: Array<[string, string]> = [
  ['Andhra Pradesh', 'Amaravati'],
  ['Arunachal Pradesh', 'Itanagar'],
  ['Assam', 'Dispur'],
  ['Bihar', 'Patna'],
  ['Chhattisgarh', 'Raipur'],
  ['Goa', 'Panaji'],
  ['Gujarat', 'Gandhinagar'],
  ['Haryana', 'Chandigarh'],
  ['Himachal Pradesh', 'Shimla'],
  ['Jharkhand', 'Ranchi'],
  ['Karnataka', 'Bengaluru'],
  ['Kerala', 'Thiruvananthapuram'],
  ['Madhya Pradesh', 'Bhopal'],
  ['Maharashtra', 'Mumbai'],
  ['Manipur', 'Imphal'],
  ['Meghalaya', 'Shillong'],
  ['Mizoram', 'Aizawl'],
  ['Nagaland', 'Kohima'],
  ['Odisha', 'Bhubaneswar'],
  ['Punjab', 'Chandigarh'],
  ['Rajasthan', 'Jaipur'],
  ['Sikkim', 'Gangtok'],
  ['Tamil Nadu', 'Chennai'],
  ['Telangana', 'Hyderabad'],
  ['Tripura', 'Agartala'],
  ['Uttar Pradesh', 'Lucknow'],
  ['Uttarakhand', 'Dehradun'],
  ['West Bengal', 'Kolkata'],
  ['Andaman & Nicobar Islands', 'Port Blair'],
  ['Chandigarh (UT)', 'Chandigarh'],
  ['Dadra & Nagar Haveli and Daman & Diu', 'Daman'],
  ['Delhi (NCT)', 'New Delhi'],
  ['Jammu & Kashmir', 'Srinagar / Jammu'],
  ['Ladakh', 'Leh'],
  ['Lakshadweep', 'Kavaratti'],
  ['Puducherry', 'Puducherry'],
];

function makeQ(seed: number): { state: string; options: string[]; answer: string } {
  const entry = STATES_AND_CAPITALS[seed % STATES_AND_CAPITALS.length];
  const answer = entry[1];
  const pool = STATES_AND_CAPITALS.map((s) => s[1]).filter((c) => c !== answer);
  const wrongs = [...new Set(pool)].sort(() => Math.random() - 0.5).slice(0, 3);
  return { state: entry[0], options: [answer, ...wrongs].sort(() => Math.random() - 0.5), answer };
}

/** Capital Challenge (xp 20): match Indian states and UTs to their capitals. */
export function CapitalChallengeGame({ won, onWin, onBack }: GameProps) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 97));
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const best = 5;

  const q = makeQ(seed);

  const choose = (opt: string) => {
    if (opt === q.answer) {
      const next = streak + 1;
      setStreak(next);
      setFeedback(null);
      if (next >= best) onWin();
    } else {
      setStreak(0);
      setFeedback(`The capital of ${q.state} is ${q.answer}.`);
    }
    setSeed((s) => s + 7);
  };

  return (
    <GameShell
      title="Capital Challenge"
      blurb="Match Indian states and union territories to their capitals; 5 right in a row."
      modelNote="Covers all 28 states and 8 union territories. Jammu & Kashmir has two capitals: Srinagar in summer, Jammu in winter."
      xp={20}
      won={won}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-1.5" aria-label={`Streak ${streak} of ${best}`}>
          {Array.from({ length: best }, (_, i) => (
            <span
              key={i}
              className={cn('size-3 rounded-full', i < streak ? 'bg-emerald-500' : 'bg-border')}
              aria-hidden="true"
            />
          ))}
          <span className="ml-2 text-xs text-muted-foreground">{streak} in a row</span>
        </div>

        <p className="text-center text-xl font-semibold" aria-live="polite">
          What is the capital of <span className="text-primary">{q.state}</span>?
        </p>

        <div className="mx-auto grid w-full max-w-sm grid-cols-1 gap-3 sm:grid-cols-2">
          {q.options.map((opt) => (
            <button
              key={opt}
              className="press min-h-[52px] rounded-xl border border-border bg-background font-medium hover:border-primary/50"
              onClick={() => choose(opt)}
            >
              {opt}
            </button>
          ))}
        </div>

        {feedback && (
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {feedback}
          </p>
        )}
      </div>
    </GameShell>
  );
}
