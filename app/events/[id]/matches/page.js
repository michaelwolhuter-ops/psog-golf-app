'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Swords, Trophy } from 'lucide-react';
import { MatchCard } from '@/app/MatchCard';
import { DominationBoard } from '@/app/DominationBoard';

// Individual Stableford Leaderboard — same shape/sort every other screen in
// the app shows (see liveBoard.individual).
function IndividualBoard({ individual }) {
  return (
    <div className="bg-posgcard rounded-xl border border-posgborder p-4">
      <div className="grid grid-cols-[2rem_1fr_3rem_4rem] gap-2 text-[10px] text-posgmuted uppercase tracking-wide px-1 pb-1.5 border-b border-posgborder">
        <span>Pos</span>
        <span>Player</span>
        <span className="text-center">Thru</span>
        <span className="text-right">Total</span>
      </div>
      {individual.map((row, i) => (
        <div
          key={row.player_id}
          className="grid grid-cols-[2rem_1fr_3rem_4rem] gap-2 items-center py-1.5 border-b border-posgborder/40 last:border-0"
        >
          <span
            className={
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ' +
              (i === 0 ? 'bg-gold/20 text-gold' : 'text-posgmuted')
            }
          >
            {i === 0 ? <Trophy size={12} /> : i + 1}
          </span>
          <span className="text-posgtext text-sm font-semibold truncate">{row.name}</span>
          <span className="text-posgmuted text-xs font-mono text-center">{row.thru ?? '–'}</span>
          <span className="text-gold font-mono font-bold text-right">{row.overall}</span>
        </div>
      ))}
    </div>
  );
}

// Gross Leaderboard — lowest total strokes wins, no stableford points or
// handicap involved. Built off the same `individual` rows (they already
// carry gross_total — see live-leaderboard route), not a separate fetch.
function GrossBoard({ individual }) {
  const ranked = [...individual]
    .filter((r) => r.gross_total > 0)
    .sort((a, b) => a.gross_total - b.gross_total);
  return (
    <div className="bg-posgcard rounded-xl border border-posgborder p-4">
      <div className="grid grid-cols-[2rem_1fr_4rem] gap-2 text-[10px] text-posgmuted uppercase tracking-wide px-1 pb-1.5 border-b border-posgborder">
        <span>Pos</span>
        <span>Player</span>
        <span className="text-right">Gross</span>
      </div>
      {ranked.map((row, i) => (
        <div
          key={row.player_id}
          className="grid grid-cols-[2rem_1fr_4rem] gap-2 items-center py-1.5 border-b border-posgborder/40 last:border-0"
        >
          <span
            className={
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ' +
              (i === 0 ? 'bg-gold/20 text-gold' : 'text-posgmuted')
            }
          >
            {i === 0 ? <Trophy size={12} /> : i + 1}
          </span>
          <span className="text-posgtext text-sm font-semibold truncate">{row.name}</span>
          <span className="text-gold font-mono font-bold text-right">{row.gross_total}</span>
        </div>
      ))}
    </div>
  );
}

// The "Ryder Cup live scoreboard" screen for a Better Ball Match Play event.
// No tabs, no toggle — everything that matters is just stacked in one
// fixed order (Mike's ask, 2026-09-16, after an earlier tabbed version hid
// the leaderboard behind a button nobody clicked): the match cards, then
// the Domination Leaderboard (the official team result, live or final),
// then the Individual Stableford Leaderboard, then Gross. Same order and
// same components whether the round is still live or every match has
// finished — a finished match's row just reads "Won 4 & 3" instead of
// "3 Up thru 15", no separate state to get out of sync.
export default function EventMatchesPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [liveBoard, setLiveBoard] = useState(null);

  useEffect(() => {
    fetch(`/api/events/${id}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (!body.error) setEvent(body.event);
      });
  }, [id]);

  function load() {
    fetch(`/api/events/${id}/live-leaderboard`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (!body.error) setLiveBoard(body);
      });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [id]);

  if (!liveBoard) return <p className="text-posgmuted">Loading…</p>;

  const matches = liveBoard.matches || [];
  const domination = liveBoard.domination || [];
  const individual = liveBoard.individual || [];
  const allFinished = matches.length > 0 && matches.every((m) => m.finished);

  return (
    <div>
      <Link
        href={`/events/${id}`}
        className="inline-flex items-center gap-1 text-sm text-posgmuted hover:text-posgtext mb-4"
      >
        <ArrowLeft size={14} /> Back to event
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <Swords size={20} className="text-gold" />
        <h1 className="text-xl font-bold text-posgtext">
          {allFinished ? 'Final Results' : 'Matches Live'}
        </h1>
      </div>
      <p className="text-posgmuted text-sm mb-5">
        {event?.name ? `${event.name} · ` : ''}
        Better Ball Match Play
        {!allFinished && matches.length > 0
          ? ` · ${matches.filter((m) => !m.finished).length} of ${matches.length} in progress`
          : ''}
      </p>

      {matches.length === 0 ? (
        <p className="text-posgmuted text-sm">No match play scorecards for this event yet.</p>
      ) : (
        <div className="space-y-6">
          {/* Order per Mike, 2026-09-17: Domination Leaderboard first, no
              button, then Individual, then Gross. Match cards are extra
              detail, not part of that ordering, so they sit below all
              three rather than pushing the leaderboards down the page. */}
          <div>
            <h2 className="text-sm font-semibold text-posgtext flex items-center gap-1.5 mb-2">
              <Trophy size={14} className="text-gold" /> Matchplay Leaderboard
            </h2>
            <DominationBoard domination={domination} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-posgtext mb-2">Individual Stableford Leaderboard</h2>
            <IndividualBoard individual={individual} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-posgtext mb-2">Gross Leaderboard</h2>
            <GrossBoard individual={individual} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-posgtext mb-2">Match Cards</h2>
            {/* grid-cols-1 explicit — see MatchCard.js's 2026-09-17 mobile
                overflow fix note for why the bare `grid` class alone isn't
                safe here. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {matches.map((m) => (
                <MatchCard key={m.scorecard_id} match={m} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
