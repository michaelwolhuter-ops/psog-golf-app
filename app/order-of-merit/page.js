'use client';

import { useEffect, useState } from 'react';
import { Trophy, Award, ArrowUp, ArrowDown, Minus } from 'lucide-react';

// Position is a round badge, not a table cell — 1st gets a trophy, 2nd/3rd an
// award ribbon, everyone else just a clean numbered circle. This is deliberately
// the second-biggest thing in the row (after the points total) since a
// leaderboard lives and dies on "who's where".
const podium = {
  1: { icon: Trophy, ring: 'border-gold/50 bg-gold/10 text-gold' },
  2: { icon: Award, ring: 'border-posgmuted/50 bg-posgmuted/10 text-posgmuted' },
  3: { icon: Award, ring: 'border-amber-700/50 bg-amber-700/10 text-amber-700' },
};

function PositionBadge({ position }) {
  const pos = Number(position);
  const style = podium[pos];
  const Icon = style?.icon;
  return (
    <div
      className={`w-12 h-12 shrink-0 rounded-full border flex flex-col items-center justify-center font-extrabold ${
        style ? style.ring : 'border-posgborder bg-posgbg text-posgtext'
      }`}
    >
      {Icon && <Icon size={15} className="mb-0.5" />}
      <span className={Icon ? 'text-xs leading-none' : 'text-lg leading-none'}>
        {position ?? '—'}
      </span>
    </div>
  );
}

// Small arrow-and-number badge next to the points total — a first event (or
// nothing to compare against yet) is just a dash, not a claim of "no movement".
function Movement({ value }) {
  if (value === null || value === undefined) {
    return <Minus size={13} className="text-posgmuted/60" />;
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-fairway text-xs font-semibold">
        <ArrowUp size={13} />
        {value}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-400 text-xs font-semibold">
        <ArrowDown size={13} />
        {Math.abs(value)}
      </span>
    );
  }
  return <Minus size={13} className="text-posgmuted/60" />;
}

function rowStyle(position) {
  const pos = Number(position);
  if (pos === 1) return 'bg-gradient-to-r from-gold/10 to-transparent';
  if (pos === 2) return 'bg-gradient-to-r from-posgmuted/10 to-transparent';
  if (pos === 3) return 'bg-gradient-to-r from-amber-700/10 to-transparent';
  return '';
}

export default function OrderOfMeritPage() {
  const [rows, setRows] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/order-of-merit', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) setError(body.error);
        else {
          setRows(body.data);
          setEvents(body.events || []);
        }
      });
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Trophy size={22} className="text-gold" />
        <h1 className="text-2xl font-bold text-posgtext">Order of Merit</h1>
      </div>
      <p className="text-posgmuted mb-6 max-w-2xl">
        Season standings — highest points at the top. Each round&apos;s score sits in
        small print under a player&apos;s name once it&apos;s entered and completed; the big
        number on the right is what actually decides the ranking.
      </p>

      {error && <p className="text-red-400">{error}</p>}
      {!rows && !error && <p className="text-posgmuted">Loading…</p>}

      {rows && (
        <div className="bg-posgcard rounded-2xl border border-posgborder overflow-hidden divide-y divide-posgborder">
          {rows.map((r) => (
            <div
              key={r.player_id}
              className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 hover:bg-posgcardhover transition ${rowStyle(
                r.position
              )}`}
            >
              <PositionBadge position={r.position} />

              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-posgtext truncate">{r.name}</div>
                {events.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-1.5">
                    {events.map((e) => (
                      <div key={e.id} className="flex flex-col items-center leading-tight" title={e.name}>
                        <span className="text-[9px] uppercase tracking-wide text-posgmuted/50">
                          {e.label}
                        </span>
                        <span className="text-xs font-mono text-posgmuted">
                          {r.by_event?.[e.id] ?? '–'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Movement value={r.movement} />
                  <span className="text-2xl font-extrabold text-gold font-mono tabular-nums">
                    {r.total_points}
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-posgmuted mt-0.5">
                  Points
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-posgmuted mt-4">
        No shared positions — a tie on points is broken automatically by whoever scored
        higher in their most recent round, then by a committee countback decision if
        that's still tied.
      </p>
    </div>
  );
}
