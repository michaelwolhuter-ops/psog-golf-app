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
      className="block bg-posgcard rounded-xl border border-posgborder p-4 hover:border-gold/40 transition"
    >
      {match.group_label && (
        <p className="text-[10px] text-posgmuted uppercase tracking-wide mb-2 truncate">{match.group_label}</p>
      )}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className={'text-sm font-semibold truncate ' + (headline.color === 'a' ? 'text-fairway' : 'text-posgtext')}>
          {match.names_a}
        </span>
        <span className="text-[10px] text-posgmuted shrink-0 px-1">vs</span>
        <span className={'text-sm font-semibold truncate text-right ' + (headline.color === 'b' ? 'text-gold' : 'text-posgtext')}>
          {match.names_b}
        </span>
      </div>

      <div className="flex items-center justify-center">
        <span
          className={
            'px-4 py-1.5 rounded-full text-base font-extrabold tracking-wide transition-all ' +
            LEADER_BADGE[headline.color]
          }
        >
          {headline.text}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 mt-2.5">
        <span className="text-[11px] text-posgmuted font-mono">{holeText}</span>
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
