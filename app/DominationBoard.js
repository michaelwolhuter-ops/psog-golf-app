'use client';

import { Trophy } from 'lucide-react';

// Domination Leaderboard — one row per pairing, ranked by how well ITS OWN
// match is going (see the `domination` array built in
// app/api/events/[id]/live-leaderboard/route.js). Same numbers whether the
// event is still live or finished — a decided match's row just naturally
// reads "Won 4 & 3" instead of "3 Up thru 15".
//
// Shared between the event page (shown inline, no click required — see
// 2026-09-17: Mike reported the deployed site still gated this behind a
// link-out button even after the in-page tabs were removed) and the
// dedicated Matches Live / Final Results dashboard, so both can never
// drift apart.
export function DominationBoard({ domination }) {
  return (
    <div className="bg-posgcard rounded-xl border border-posgborder p-4">
      <div className="grid grid-cols-[2rem_1fr_5rem] gap-2 text-[10px] text-posgmuted uppercase tracking-wide px-1 pb-1.5 border-b border-posgborder">
        <span>Pos</span>
        <span>Team</span>
        <span className="text-right">Status</span>
      </div>
      {domination.map((d) => (
        <div
          key={`${d.scorecard_id}-${d.team_number}`}
          className="grid grid-cols-[2rem_1fr_5rem] gap-2 items-center py-2 border-b border-posgborder/40 last:border-0"
        >
          <span
            className={
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ' +
              (d.position === 1 ? 'bg-gold/20 text-gold' : 'text-posgmuted')
            }
          >
            {d.position === 1 ? <Trophy size={12} /> : d.position}
          </span>
          <span className="min-w-0">
            <span
              className={
                'block text-sm font-semibold truncate ' +
                (d.team_number === 1 ? 'text-fairway' : 'text-gold')
              }
            >
              {d.names}
            </span>
            <span className="block text-[11px] text-posgmuted truncate">
              vs {d.opponent_names}
              {d.group_label ? ` — ${d.group_label}` : ''}
            </span>
          </span>
          <span className="text-right">
            <span
              className={
                'block text-xs font-mono font-bold ' +
                (d.state === 'won' || d.state === 'up'
                  ? 'text-fairway'
                  : d.state === 'lost' || d.state === 'down'
                  ? 'text-red-400'
                  : 'text-posgmuted')
              }
            >
              {d.label}
            </span>
            {d.dormie && !d.finished && (
              <span className="block text-[9px] text-red-400 font-semibold tracking-wide">DORMIE</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
