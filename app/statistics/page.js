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
  Sigma,
  Turtle,
} from 'lucide-react';

// Same categories as a player's own Round Stats section on their profile
// page — this is the whole-field version of the exact same numbers, built
// from the same shared lib/statHelpers.js logic, per Mike's ask that this
// page be "based on these same stats." See app/players/[id]/page.js for the
// per-player version and projects/golf-app/memory.md for the underlying
// rules (rung holes, full-round gating, etc).
//
// Grouped into sections (Mike's ask, 2026-09-17: "order these or group them
// ... maybe start with most team wins and all the top 3 5 10") rather than
// one flat grid — each group renders as its own row with a thin divider
// above it, so related leaderboards read together instead of in whatever
// order the API happens to return them.
const GROUPS = [
  {
    title: 'Wins & Finishes',
    categories: [
      { key: 'team_wins', label: 'Team Wins', icon: Users2, valueClass: 'text-gold' },
      { key: 'individual_wins', label: 'Individual Wins', icon: Award, valueClass: 'text-gold' },
      { key: 'top3_finishes', label: 'Top 3 Finishes', icon: ListOrdered, valueClass: 'text-posgtext' },
      { key: 'top5_finishes', label: 'Top 5 Finishes', icon: ListOrdered, valueClass: 'text-posgtext' },
      { key: 'top10_finishes', label: 'Top 10 Finishes', icon: ListOrdered, valueClass: 'text-posgtext' },
    ],
  },
  {
    title: 'All-Time Records',
    categories: [
      { key: 'lowest_gross', label: 'Lowest Gross Ever', icon: TrendingDown, valueClass: 'text-fairway', showEvent: true, showDate: true },
      { key: 'highest_gross', label: 'Highest Gross Ever', icon: TrendingUp, valueClass: 'text-posgtext', showEvent: true, showDate: true },
      { key: 'most_points', label: 'Highest Points Ever', icon: Zap, valueClass: 'text-gold', showEvent: true, showDate: true },
      { key: 'lowest_points', label: 'Lowest Points Ever', icon: Frown, valueClass: 'text-posgtext', showEvent: true, showDate: true },
    ],
  },
  {
    title: 'Round Averages',
    categories: [
      { key: 'average_gross', label: 'Best Average Gross', icon: Sigma, valueClass: 'text-fairway', decimals: 1 },
      { key: 'average_gross_worst', label: 'Worst Average Gross', icon: Sigma, valueClass: 'text-posgtext', decimals: 1 },
      { key: 'birdies', label: 'Most Birdies Per Round', icon: Bird, valueClass: 'text-fairway', decimals: 1 },
      { key: 'birdies_worst', label: 'Fewest Birdies Per Round', icon: Bird, valueClass: 'text-posgtext', decimals: 1 },
      { key: 'pars', label: 'Most Pars Per Round', icon: Circle, valueClass: 'text-fairway', decimals: 1 },
      { key: 'pars_worst', label: 'Fewest Pars Per Round', icon: Circle, valueClass: 'text-posgtext', decimals: 1 },
      { key: 'rings_best', label: 'Fewest Rings Per Round', icon: CircleSlash, valueClass: 'text-fairway', decimals: 1 },
      { key: 'rings', label: 'Most Rings Per Round', icon: CircleSlash, valueClass: 'text-posgtext', decimals: 1 },
      { key: 'three_putts_best', label: 'Fewest 3-Putts Per Round', icon: Repeat2, valueClass: 'text-fairway', decimals: 1 },
      { key: 'three_putts', label: 'Most 3-Putts Per Round', icon: Repeat2, valueClass: 'text-posgtext', decimals: 1 },
    ],
  },
  {
    title: 'Bonus Awards',
    categories: [
      { key: 'longest_drives', label: 'Longest Drives', icon: ArrowUpRight, valueClass: 'text-posgtext' },
      { key: 'closest_to_pins', label: 'Closest to the Pin Awards', icon: Crosshair, valueClass: 'text-posgtext' },
      { key: 'tutu', label: 'The Tutu', icon: Turtle, valueClass: 'text-posgtext' },
    ],
  },
  {
    title: 'Round Totals',
    categories: [
      { key: 'rounds_100_plus', label: '100+ Rounds', icon: ThumbsDown, valueClass: 'text-posgtext' },
      { key: 'eagles', label: 'Eagles', icon: Star, valueClass: 'text-gold' },
    ],
  },
];

function fmtDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function LeaderboardCard({ label, Icon, valueClass, rows, showEvent, showDate, decimals }) {
  return (
    <div className="bg-posgcard rounded-xl border border-posgborder p-4">
      <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide mb-3">
        <Icon size={13} /> {label}
      </div>
      {(!rows || rows.length === 0) ? (
        <p className="text-posgmuted text-sm">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const date = showDate ? fmtDate(r.event_date) : null;
            const subtitle = [showEvent ? r.event_name : null, date].filter(Boolean).join(' · ');
            return (
              <Link
                key={r.player_id}
                href={`/players/${r.player_id}`}
                className="flex items-center justify-between hover:bg-posgcardhover rounded-md px-1.5 py-1 -mx-1.5 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-posgmuted w-4 shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-sm text-posgtext truncate">{r.name}</div>
                    {subtitle && <div className="text-[11px] text-posgmuted truncate">{subtitle}</div>}
                  </div>
                </div>
                <div className={`font-mono font-semibold text-sm ${valueClass} shrink-0 ml-2`}>
                  {decimals ? Number(r.value).toFixed(decimals) : r.value}
                </div>
              </Link>
            );
          })}
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
        Lowest/Highest Gross and Points only count full 18-hole rounds. Eagles/Birdies/Pars
        exclude picked-up (rung) holes; Rings counts the pickups themselves.
      </p>

      {error && <p className="text-red-400 mb-4">{error}</p>}
      {!data && !error && <p className="text-posgmuted">Loading…</p>}

      {data && (
        <div className="space-y-8">
          {GROUPS.map((group, i) => (
            <div key={group.title} className={i > 0 ? 'border-t border-posgborder pt-8' : ''}>
              <h2 className="text-xs font-semibold text-posgmuted uppercase tracking-widest mb-3">
                {group.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.categories.map((cat) => (
                  <LeaderboardCard
                    key={cat.key}
                    label={cat.label}
                    Icon={cat.icon}
                    valueClass={cat.valueClass}
                    rows={data[cat.key]}
                    showEvent={cat.showEvent}
                    showDate={cat.showDate}
                    decimals={cat.decimals}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
