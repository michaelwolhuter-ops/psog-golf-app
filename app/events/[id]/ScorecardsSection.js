'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Swords, ChevronRight } from 'lucide-react';
import { useAdmin } from '@/lib/AdminContext';
import { ScorecardTable } from '@/app/ScorecardTable';

const FORMAT_LABEL = {
  individual_stableford: 'Individual Stableford',
  better_ball_stableford: 'Better Ball Stableford',
  better_ball_match_play: 'Better Ball Match Play',
};

function ScorecardCard({ summary }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    fetch(`/api/scorecards/${summary.id}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => setDetail(body.error ? null : body));
  }, [summary.id]);

  const memberNames = (summary.scorecard_players || [])
    .map((sp) => sp.players?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="bg-posgcard rounded-xl border border-posgborder overflow-hidden mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-posgborder">
        <div>
          <p className="text-sm font-semibold text-posgtext flex items-center gap-2">
            <ClipboardList size={15} className="text-fairway" />
            {summary.group_label || FORMAT_LABEL[summary.format]}
            <span
              className={
                'text-[10px] px-2 py-0.5 rounded-full ' +
                (summary.status === 'completed'
                  ? 'bg-fairway/15 text-fairway'
                  : 'bg-gold/15 text-gold')
              }
            >
              {summary.status === 'completed' ? 'Completed' : 'In progress'}
            </span>
          </p>
          <p className="text-xs text-posgmuted mt-0.5">{memberNames}</p>
        </div>
        {/* A real, bigger tap target — this is the button markers hit
            constantly mid-round, standing on a golf course, often one-
            handed. A small text link was too easy to miss/mis-tap. */}
        <Link
          href={`/scorecards/${summary.id}`}
          className={
            'inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-md transition ' +
            (summary.status === 'completed'
              ? 'bg-posgborder text-posgtext hover:bg-posgcardhover'
              : 'bg-fairway text-black hover:bg-fairwaydark hover:text-white')
          }
        >
          {summary.status === 'completed' ? 'Reopen / Delete' : 'Resume Entry'} <ChevronRight size={14} />
        </Link>
      </div>

      {!detail ? (
        <p className="text-posgmuted text-sm px-4 py-3">Loading…</p>
      ) : detail.hole_scores.length === 0 ? (
        <p className="text-posgmuted text-sm px-4 py-3">No holes entered yet.</p>
      ) : (
        <>
          {detail.match_result && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-posgborder bg-posgbg/50 text-sm text-posgtext">
              <Swords size={14} className="text-gold" />
              <span>
                <span className="font-semibold">
                  Team {detail.match_result.winning_team_number || '—'}
                </span>{' '}
                won {detail.match_result.margin}
              </span>
            </div>
          )}
          <ScorecardTable detail={detail} />
        </>
      )}
    </div>
  );
}

// Every scorecard created for this event, each rendered as a full card
// (hole-by-hole gross/points per player, plus the team's combined
// better-ball points per hole, plus round Net/Pts totals) — this is the
// actual played round, distinct from the read-only course layout view and
// from the event's manual points-entry Results table below it.
export default function ScorecardsSection({ eventId }) {
  const { isAdmin } = useAdmin();
  const [scorecards, setScorecards] = useState(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}/scorecards`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => setScorecards(body.data || []));
  }, [eventId]);

  if (!scorecards || scorecards.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-posgtext flex items-center gap-2 mb-2">
        <ClipboardList size={17} className="text-fairway" /> Scorecards
      </h2>
      {isAdmin && (
      <p className="text-xs text-posgmuted mb-3">
        Every digital scorecard entered for this event, hole by hole. Individual results below feed
        Order of Merit once a round is finished.
      </p>
      )}
      {scorecards.map((sc) => (
        <ScorecardCard key={sc.id} summary={sc} />
      ))}
    </div>
  );
}
