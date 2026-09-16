'use client';

import Link from 'next/link';
import { matchHeadline } from '@/lib/scoring';

// Broadcast-style match card — reused on the Matches Live dashboard and
// (as a smaller variant) anywhere else a match needs to show up in a list.
// Team A always reads in fairway green, Team B in gold — the same colors
// already used for "Team 1"/"Team 2" badges on the scorecard entry screen,
// so a player sees one consistent color language for "their side" across
// the whole app rather than a different scheme per screen.
const LEADER_BADGE = {
  a: 'bg-fairway text-black',
  b: 'bg-gold text-black',
  neutral: 'bg-posgborder text-posgtext',
};

export function MatchCard({ match }) {
  const headline = matchHeadline(match, match.names_a, match.names_b);
  const holeText = match.finished
    ? `Final — ${match.holesPlayed} holes`
    : match.holesPlayed > 0
    ? `Hole ${Math.min(match.holesPlayed + 1, 18)} · ${match.holesRemaining} to play`
    : 'Not started';

  return (
    <Link
      href={`/scorecards/${match.scorecard_id}`}
      className="block min-w-0 w-full bg-posgcard rounded-xl border border-posgborder p-4 hover:border-gold/40 transition"
    >
      {match.group_label && (
        <p className="text-xs text-posgmuted uppercase tracking-wide mb-2 truncate">{match.group_label}</p>
      )}
      {/* min-w-0 on both name spans is load-bearing, not decorative — a
          flex child's default min-width is auto (= its content width), so
          without this, `truncate` never actually engages on a long pairing
          name like "James Prentice & Darren Odendaal". The row (and the
          whole card, and the grid it sits in) just got forced wider than
          the screen instead — that's what was squeezing every other box on
          the page sideways. */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className={
            'min-w-0 text-base font-semibold truncate ' +
            (headline.color === 'a' ? 'text-fairway' : 'text-posgtext')
          }
        >
          {match.names_a}
        </span>
        <span className="text-xs text-posgmuted shrink-0 px-1">vs</span>
        <span
          className={
            'min-w-0 text-base font-semibold truncate text-right ' +
            (headline.color === 'b' ? 'text-gold' : 'text-posgtext')
          }
        >
          {match.names_b}
        </span>
      </div>

      {/* rounded-xl + break-words, not rounded-full — a decided match's
          headline ("Mark & BT won 4 & 3") is much longer than "3 UP", and
          forcing that into a pill shape on a narrow phone either overflowed
          the card or broke the pill's rounded corners when it wrapped.
          This shape holds up either way. Bumped to the biggest text on the
          card, mobile included — this number/result is the whole point of
          the card, so it should read the largest, not the names around it. */}
      <div className="flex items-center justify-center px-1">
        <span
          className={
            'max-w-full px-3 py-1.5 rounded-xl text-lg font-extrabold tracking-wide text-center break-words leading-snug transition-all ' +
            LEADER_BADGE[headline.color]
          }
        >
          {headline.text}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 mt-2.5">
        <span className="text-xs text-posgmuted font-mono">{holeText}</span>
        {!match.finished && match.dormie && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-semibold tracking-wide">
            DORMIE
          </span>
        )}
        {match.finished && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-fairway/15 text-fairway font-semibold tracking-wide">
            FINISHED
          </span>
        )}
      </div>
    </Link>
  );
}
