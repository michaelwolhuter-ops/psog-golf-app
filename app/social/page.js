'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coffee, Play, ChevronRight, Trash2, BarChart3 } from 'lucide-react';
import { useAdmin } from '@/lib/AdminContext';
import { useConfirm } from '@/lib/useConfirm';

const FORMAT_LABEL = {
  individual_stableford: 'Stableford',
  better_ball_stableford: 'Better Ball',
  better_ball_match_play: 'Match Play',
};

// Social Golf (2026-10-27): the home for casual rounds outside the tour.
// Anyone can start a round; only an admin can delete one (to clear out
// test or junk rounds). Stats here are casual rounds only — the tour pages
// never see these, and these never see tour rounds.
export default function SocialGolfPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const { isAdmin } = useAdmin();
  const { confirm, ConfirmDialog } = useConfirm();

  function load() {
    fetch('/api/social', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) setError(body.error);
        else setData(body);
      });
  }

  useEffect(load, []);

  async function deleteRound(round) {
    if (
      !(await confirm(`Delete "${round.headline}"? All its scores are lost. This can't be undone.`, {
        confirmLabel: 'Delete',
      }))
    ) {
      return;
    }
    const res = await fetch(`/api/social/${round.event_id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Could not delete');
      return;
    }
    load();
  }

  const inProgress = (data?.rounds || []).filter((r) => r.status !== 'completed');
  const finished = (data?.rounds || []).filter((r) => r.status === 'completed');

  return (
    <div>
      {ConfirmDialog}
      <div className="flex items-center gap-2 mb-1">
        <Coffee size={24} className="text-fairway" />
        <h1 className="text-2xl font-bold text-posgtext">Social Golf</h1>
      </div>
      <p className="text-posgmuted mb-6">
        Casual rounds outside the tour. Scored and kept on record, but they never count toward the
        Order of Merit, handicaps or tour stats.
      </p>

      <Link
        href="/social/new"
        className="flex items-center justify-center gap-2 w-full sm:w-auto sm:inline-flex bg-fairway text-black font-semibold px-6 py-3 rounded-xl hover:bg-fairwaydark hover:text-white transition mb-8"
      >
        <Play size={18} /> Start a round
      </Link>

      {error && <p className="text-red-400 mb-4">{error}</p>}
      {!data && !error && <p className="text-posgmuted">Loading…</p>}

      {inProgress.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-posgtext mb-2">Playing now</h2>
          <div className="space-y-2">
            {inProgress.map((r) => (
              <RoundRow key={r.event_id} round={r} isAdmin={isAdmin} onDelete={deleteRound} live />
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-posgtext mb-2">Past rounds</h2>
          {finished.length === 0 ? (
            <p className="text-posgmuted text-sm">No finished social rounds yet.</p>
          ) : (
            <div className="space-y-2">
              {finished.map((r) => (
                <RoundRow key={r.event_id} round={r} isAdmin={isAdmin} onDelete={deleteRound} />
              ))}
            </div>
          )}
        </div>
      )}

      {data && data.stats.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-posgtext mb-2 flex items-center gap-1.5">
            <BarChart3 size={18} className="text-fairway" /> Social stats
          </h2>
          <div className="bg-posgcard rounded-xl border border-posgborder p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-posgmuted uppercase text-xs">
                <tr>
                  <th className="py-1.5">Player</th>
                  <th className="py-1.5 text-right">Rounds</th>
                  <th className="py-1.5 text-right">Wins</th>
                  <th className="py-1.5 text-right">Avg Pts</th>
                  <th className="py-1.5 text-right">Best</th>
                  <th className="py-1.5 text-right">Birdies</th>
                </tr>
              </thead>
              <tbody>
                {data.stats.map((s) => (
                  <tr key={s.player_id} className="border-t border-posgborder">
                    <td className="py-1.5 text-posgtext">{s.name}</td>
                    <td className="py-1.5 text-right text-posgmuted">{s.rounds}</td>
                    <td className="py-1.5 text-right font-semibold text-gold">{s.wins}</td>
                    <td className="py-1.5 text-right font-mono text-posgtext">{s.avg_points}</td>
                    <td className="py-1.5 text-right font-mono text-posgtext">{s.best_points}</td>
                    <td className="py-1.5 text-right text-posgtext">{s.birdies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-posgmuted mt-3">
              Finished rounds only. Points are stableford. A halved match or tied total counts as no win.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function RoundRow({ round, isAdmin, onDelete, live = false }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-posgborder bg-posgcard hover:border-fairway/50 transition">
      <Link href={`/scorecards/${round.scorecard_id}`} className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-posgtext truncate">{round.headline}</div>
          <div className="text-xs text-posgmuted truncate">
            {round.date || ''}
            {round.course ? ` · ${round.course}` : ''} · {FORMAT_LABEL[round.format] || round.format}
            {live ? ` · thru ${round.holes_played}` : round.holes_played < 18 ? ` · ${round.holes_played} holes` : ''}
          </div>
        </div>
        {live && (
          <span className="text-[10px] font-extrabold tracking-wide bg-fairway/15 text-fairway border border-fairway/40 px-2 py-0.5 rounded-full">
            LIVE
          </span>
        )}
        <ChevronRight size={18} className="text-posgmuted shrink-0" />
      </Link>
      {isAdmin && (
        <button
          onClick={() => onDelete(round)}
          className="text-posgmuted hover:text-red-400 pr-4"
          title="Delete this round"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
