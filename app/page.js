'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Calendar,
  Users,
  Target,
  Flag,
  ArrowUp,
  ArrowDown,
  Minus,
  UserPlus,
  ClipboardEdit,
  Settings as SettingsIcon,
} from 'lucide-react';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(1);
}

function Movement({ value }) {
  if (value === null || value === undefined) return <Minus size={13} className="text-posgmuted" />;
  if (value > 0) return <span className="text-fairway text-xs inline-flex items-center gap-0.5"><ArrowUp size={12} />{value}</span>;
  if (value < 0) return <span className="text-red-400 text-xs inline-flex items-center gap-0.5"><ArrowDown size={12} />{Math.abs(value)}</span>;
  return <Minus size={13} className="text-posgmuted" />;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) setError(body.error);
        else setData(body);
      });
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-posgmuted">Loading…</p>;

  const days = daysUntil(data.settings?.tour_start_date);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-posgtext">
          POSG <span className="text-gold">Tour</span>
        </h1>
        <p className="text-posgmuted mt-1">{data.settings?.season_name || 'Season dashboard'}</p>
      </div>

      {/* Top summary cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-posgcard rounded-xl border border-posgborder p-5">
          <div className="text-xs text-posgmuted uppercase tracking-wide">Tour Countdown</div>
          {days === null ? (
            <div className="text-sm text-posgmuted mt-2">
              Set tour dates in <Link href="/settings" className="text-fairway">Settings</Link>
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold text-fairway mt-1">
                {days >= 0 ? days : 0}
              </div>
              <div className="text-xs text-posgmuted">
                {days >= 0 ? 'days to tour' : 'tour underway'}
              </div>
            </>
          )}
        </div>

        <div className="bg-posgcard rounded-xl border border-posgborder p-5">
          <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
            <Trophy size={13} /> Order of Merit Leader
          </div>
          {data.oom_leader ? (
            <>
              <div className="text-xl font-bold text-gold mt-1">{data.oom_leader.name}</div>
              <div className="text-xs text-posgmuted">{data.oom_leader.total_points} pts</div>
            </>
          ) : (
            <div className="text-sm text-posgmuted mt-2">No results yet</div>
          )}
        </div>

        <div className="bg-posgcard rounded-xl border border-posgborder p-5">
          <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
            <Calendar size={13} /> Next Event
          </div>
          {data.next_event ? (
            <>
              <div className="text-xl font-bold text-posgtext mt-1">{data.next_event.name}</div>
              <div className="text-xs text-posgmuted">
                {data.next_event.golf_course || 'Course TBC'}
                {data.next_event.event_date ? ` · ${data.next_event.event_date}` : ''}
              </div>
            </>
          ) : (
            <div className="text-sm text-posgmuted mt-2">Nothing scheduled</div>
          )}
        </div>

        <div className="bg-posgcard rounded-xl border border-posgborder p-5">
          <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
            <Users size={13} /> Players Qualified
          </div>
          <div className="text-3xl font-bold text-posgtext mt-1">
            {data.qualified_count}
            <span className="text-lg text-posgmuted"> / {data.total_players}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Order of Merit preview */}
        <div className="bg-posgcard rounded-xl border border-posgborder p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-posgtext flex items-center gap-1.5">
              <Trophy size={16} className="text-gold" /> Order of Merit — Top 10
            </h2>
            <Link href="/order-of-merit" className="text-xs text-fairway hover:underline">
              View full standings
            </Link>
          </div>
          {data.oom_top10.length === 0 ? (
            <p className="text-posgmuted text-sm">No results recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-posgmuted uppercase text-xs">
                <tr>
                  <th className="py-1.5 w-8">Pos</th>
                  <th className="py-1.5">Player</th>
                  <th className="py-1.5 text-right">Events</th>
                  <th className="py-1.5 text-right">Pts</th>
                  <th className="py-1.5 text-right w-16">Mvmt</th>
                </tr>
              </thead>
              <tbody>
                {data.oom_top10.map((r) => (
                  <tr key={r.player_id} className="border-t border-posgborder">
                    <td className="py-1.5 font-bold text-posgtext">{r.position}</td>
                    <td className="py-1.5 text-posgtext">{r.name}</td>
                    <td className="py-1.5 text-right text-posgmuted">{r.events_played}</td>
                    <td className="py-1.5 text-right font-mono text-posgtext">{r.total_points}</td>
                    <td className="py-1.5 text-right"><Movement value={r.movement} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Upcoming events */}
        <div className="bg-posgcard rounded-xl border border-posgborder p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-posgtext flex items-center gap-1.5">
              <Calendar size={16} className="text-fairway" /> Upcoming Events
            </h2>
            <Link href="/events" className="text-xs text-fairway hover:underline">
              View all
            </Link>
          </div>
          {data.upcoming_events.length === 0 ? (
            <p className="text-posgmuted text-sm">Nothing upcoming.</p>
          ) : (
            <ul className="space-y-2">
              {data.upcoming_events.map((e) => (
                <li key={e.id} className="text-sm border-t border-posgborder pt-2 first:border-0 first:pt-0">
                  <div className="text-posgtext font-medium">{e.name}</div>
                  <div className="text-xs text-posgmuted">
                    {e.event_date || 'Date TBC'} · {e.golf_course || 'Course TBC'}
                    {e.format ? ` · ${e.format}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Latest results */}
        <div className="bg-posgcard rounded-xl border border-posgborder p-5">
          <h2 className="font-semibold text-posgtext flex items-center gap-1.5 mb-3">
            <Flag size={16} className="text-fairway" /> Latest Results
          </h2>
          {!data.latest_results ? (
            <p className="text-posgmuted text-sm">No completed events yet.</p>
          ) : (
            <div>
              <div className="text-xs text-posgmuted mb-2">{data.latest_results.event.name}</div>
              {data.latest_results.top3.length === 0 ? (
                <p className="text-posgmuted text-sm">No results entered for this event.</p>
              ) : (
                <ol className="space-y-1.5 text-sm">
                  {data.latest_results.top3.map((p, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="text-posgtext">
                        <span className="text-gold font-semibold mr-1.5">{i + 1}.</span>
                        {p.name}
                      </span>
                      <span className="font-mono text-posgmuted">{p.overall} pts</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Handicap summary */}
        <div className="bg-posgcard rounded-xl border border-posgborder p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-posgtext flex items-center gap-1.5">
              <Target size={16} className="text-fairway" /> Handicap Summary
            </h2>
            <Link href="/handicaps" className="text-xs text-fairway hover:underline">
              View handicaps
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-posgmuted">Lowest Handicap</span>
              <span className="text-posgtext">
                {data.handicap_summary.lowest
                  ? `${data.handicap_summary.lowest.name} (${fmt(data.handicap_summary.lowest.tour_handicap)})`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-posgmuted">Largest Committee Adj</span>
              <span className="text-posgtext">
                {data.handicap_summary.largest_adjustment
                  ? `${data.handicap_summary.largest_adjustment.name} (${
                      data.handicap_summary.largest_adjustment.committee_adjustment > 0 ? '+' : ''
                    }${data.handicap_summary.largest_adjustment.committee_adjustment})`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-posgmuted">Most Improved</span>
              <span className="text-posgmuted">— (needs history)</span>
            </div>
          </div>
        </div>

        {/* Statistics snapshot */}
        <div className="bg-posgcard rounded-xl border border-posgborder p-5">
          <h2 className="font-semibold text-posgtext mb-3">Statistics Snapshot</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-posgmuted">Most Birdies</div>
              <div className="text-gold font-semibold">—</div>
            </div>
            <div>
              <div className="text-xs text-posgmuted">Most Wins</div>
              <div className="text-gold font-semibold">—</div>
            </div>
            <div>
              <div className="text-xs text-posgmuted">Lowest Gross</div>
              <div className="text-gold font-semibold">—</div>
            </div>
            <div>
              <div className="text-xs text-posgmuted">Best Average</div>
              <div className="text-gold font-semibold">—</div>
            </div>
          </div>
          <p className="text-xs text-posgmuted mt-3">Live once scorecards exist.</p>
        </div>
      </div>

      {/* Quick admin actions */}
      <div>
        <h2 className="font-semibold text-posgtext mb-3">Quick Admin Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href="/players"
            className="bg-posgcard rounded-xl border border-posgborder p-4 flex flex-col items-center gap-2 text-center hover:border-fairway/50 transition"
          >
            <UserPlus size={20} className="text-fairway" />
            <span className="text-sm text-posgtext">Add Player</span>
          </Link>
          <Link
            href="/events"
            className="bg-posgcard rounded-xl border border-posgborder p-4 flex flex-col items-center gap-2 text-center hover:border-fairway/50 transition"
          >
            <Calendar size={20} className="text-fairway" />
            <span className="text-sm text-posgtext">Enter Results</span>
          </Link>
          <Link
            href="/players"
            className="bg-posgcard rounded-xl border border-posgborder p-4 flex flex-col items-center gap-2 text-center hover:border-fairway/50 transition"
          >
            <ClipboardEdit size={20} className="text-fairway" />
            <span className="text-sm text-posgtext">Update Handicap</span>
          </Link>
          <Link
            href="/settings"
            className="bg-posgcard rounded-xl border border-posgborder p-4 flex flex-col items-center gap-2 text-center hover:border-fairway/50 transition"
          >
            <SettingsIcon size={20} className="text-fairway" />
            <span className="text-sm text-posgtext">Tour Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
