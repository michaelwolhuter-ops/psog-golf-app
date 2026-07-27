'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Zap,
  Frown,
  Star,
  Bird,
  Circle,
  CircleSlash,
  Award,
  Users2,
  ListOrdered,
  ThumbsDown,
  Repeat2,
  ArrowUpRight,
  Crosshair,
} from 'lucide-react';

// Same categories as a player's own Round Stats section on their profile
// page — this is the whole-field version of the exact same numbers, built
// from the same shared lib/statHelpers.js logic, per Mike's ask that this
// page be "based on these same stats." See app/players/[id]/page.js for the
// per-player version and projects/golf-app/memory.md for the underlying
// rules (rung holes, full-round gating, etc).
const CATEGORIES = [
  { key: 'lowest_gross', label: 'Lowest Gross', icon: TrendingDown, valueClass: 'text-fairway', showEvent: true },
  { key: 'highest_gross', label: 'Highest Gross', icon: TrendingUp, valueClass: 'text-posgtext', showEvent: true },
  { key: 'most_points', label: 'Most Points', icon: Zap, valueClass: 'text-gold', showEvent: true },
  { key: 'lowest_points', label: 'Lowest Points', icon: Frown, valueClass: 'text-posgtext', showEvent: true },
  { key: 'rounds_100_plus', label: 'Most 100+ Gross Rounds', icon: ThumbsDown, valueClass: 'text-posgtext' },
  { key: 'eagles', label: 'Most Eagles', icon: Star, valueClass: 'text-gold' },
  { key: 'birdies', label: 'Most Birdies', icon: Bird, valueClass: 'text-posgtext' },
  { key: 'pars', label: 'Most Pars', icon: Circle, valueClass: 'text-posgtext' },
  { key: 'rings', label: 'Most Rings', icon: CircleSlash, valueClass: 'text-posgtext' },
  { key: 'three_putts', label: 'Most 3 Putts', icon: Repeat2, valueClass: 'text-posgtext' },
  { key: 'individual_wins', label: 'Most Individual Wins', icon: Award, valueClass: 'text-gold' },
  { key: 'team_wins', label: 'Most Team Wins', icon: Users2, valueClass: 'text-gold' },
  { key: 'longest_drives', label: 'Most Longest Drives', icon: ArrowUpRight, valueClass: 'text-posgtext' },
  { key: 'closest_to_pins', label: 'Most Closest to the Pins', icon: Crosshair, valueClass: 'text-posgtext' },
  { key: 'top3_finishes', label: 'Most Top 3 Finishes', icon: ListOrdered, valueClass: 'text-posgtext' },
  { key: 'top5_finishes', label: 'Most Top 5 Finishes', icon: ListOrdered, valueClass: 'text-posgtext' },
  { key: 'top10_finishes', label: 'Most Top 10 Finishes', icon: ListOrdered, valueClass: 'text-posgtext' },
];

function LeaderboardCard({ label, Icon, valueClass, rows, showEvent }) {
  return (
    <div className="bg-posgcard rounded-xl border border-posgborder p-4">
      <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide mb-3">
        <Icon size={13} /> {label}
      </div>
      {(!rows || rows.length === 0) ? (
        <p className="text-posgmuted text-sm">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <Link
              key={r.player_id}
              href={`/players/${r.player_id}`}
              className="flex items-center justify-between hover:bg-posgcardhover rounded-md px-1.5 py-1 -mx-1.5 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-posgmuted w-4 shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-sm text-posgtext truncate">{r.name}</div>
                  {showEvent && r.event_name && (
                    <div className="text-[11px] text-posgmuted truncate">{r.event_name}</div>
                  )}
                </div>
              </div>
              <div className={`font-mono font-semibold text-sm ${valueClass} shrink-0 ml-2`}>{r.value}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatisticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/statistics', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setData(body);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={22} className="text-fairway" />
        <h1 className="text-2xl font-bold text-posgtext">Statistics</h1>
      </div>
      <p className="text-posgmuted mb-6 text-sm">
        Whole-field leaderboards built from real scorecard data. Lowest/Highest Gross and
        Most/Lowest Points only count full 18-hole rounds. Eagles/Birdies/Pars exclude
        picked-up (rung) holes — they were never actually holed out at that score. Rings
        counts the pickups themselves. Click a name to open that player&apos;s profile.
      </p>

      {error && <p className="text-red-400 mb-4">{error}</p>}
      {!data && !error && <p className="text-posgmuted">Loading…</p>}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => (
            <LeaderboardCard
              key={cat.key}
              label={cat.label}
              Icon={cat.icon}
              valueClass={cat.valueClass}
              rows={data[cat.key]}
              showEvent={cat.showEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
