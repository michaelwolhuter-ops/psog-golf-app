'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coffee, Users2, Play } from 'lucide-react';

const FORMATS = [
  {
    value: 'individual_stableford',
    label: 'Individual Stableford',
    description: 'Everyone plays for themselves. Most points wins.',
  },
  {
    value: 'better_ball_stableford',
    label: 'Better Ball Stableford',
    description: '2v2 — each hole counts the better of the two partners’ points. Highest team total wins.',
  },
  {
    value: 'better_ball_match_play',
    label: 'Better Ball Match Play',
    description: '2v2 — pairs win, lose or halve each hole on better-ball points.',
  },
];

// Setup for a casual (Social Golf) round — course, format, players. Same
// shape as the tour's New Scorecard screen (app/events/[id]/scorecard/new),
// minus the event: the API creates the hidden once-off event behind the
// scenes, so anyone can start one without an admin setting anything up.
export default function NewSocialRoundPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState('');

  const [courseId, setCourseId] = useState('');
  const [format, setFormat] = useState('individual_stableford');
  const [selectedIds, setSelectedIds] = useState([]);
  const [teamNumbers, setTeamNumbers] = useState({}); // player_id -> 1 | 2
  const [scrambleDrive, setScrambleDrive] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/courses', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        const list = body.data || [];
        setCourses(list);
        if (list.length > 0) setCourseId(list[0].id);
      });
    fetch('/api/players', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => setPlayers((body.data || []).filter((p) => p.active)));
  }, []);

  const isTeamFormat = format !== 'individual_stableford';

  function togglePlayer(playerId) {
    setSelectedIds((ids) => {
      if (ids.includes(playerId)) {
        setTeamNumbers((t) => {
          const next = { ...t };
          delete next[playerId];
          return next;
        });
        return ids.filter((i) => i !== playerId);
      }
      return [...ids, playerId];
    });
  }

  async function startRound(e) {
    e.preventDefault();
    setError('');

    if (!courseId) {
      setError('Pick a course');
      return;
    }
    if (selectedIds.length < 2) {
      setError('Pick at least 2 players');
      return;
    }
    if (isTeamFormat && selectedIds.some((pid) => !teamNumbers[pid])) {
      setError('Put every player on Team 1 or Team 2');
      return;
    }

    setCreating(true);
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        format,
        player_ids: selectedIds,
        team_numbers: isTeamFormat ? teamNumbers : {},
        scramble_drive: scrambleDrive,
      }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error || `Couldn't start the round (${res.status})`);
      return;
    }
    router.push(`/scorecards/${body.data.scorecard_id}`);
  }

  return (
    <div>
      <Link
        href="/social"
        className="inline-flex items-center gap-1 text-sm text-posgmuted hover:text-posgtext mb-4"
      >
        <ArrowLeft size={14} /> Back to Social Golf
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <Coffee size={22} className="text-fairway" />
        <h1 className="text-2xl font-bold text-posgtext">Start a Social Round</h1>
      </div>
      <p className="text-posgmuted mb-6">
        A casual round. It's scored and saved, but never counts toward the tour.
      </p>

      <form onSubmit={startRound} className="bg-posgcard rounded-xl border border-posgborder p-5">
        <label className="block text-xs text-posgmuted mb-1">Course</label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-2 text-sm text-posgtext mb-5"
        >
          {courses.length === 0 && <option value="">Loading…</option>}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="block text-xs text-posgmuted mb-2">Format</label>
        <div className="grid gap-2 mb-5">
          {FORMATS.map((f) => (
            <label
              key={f.value}
              className={
                'flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition ' +
                (format === f.value
                  ? 'border-fairway bg-fairway/10'
                  : 'border-posgborder hover:bg-posgcardhover')
              }
            >
              <input
                type="radio"
                name="format"
                checked={format === f.value}
                onChange={() => {
                  setFormat(f.value);
                  setTeamNumbers({});
                }}
                className="accent-fairway mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-posgtext">{f.label}</span>
                <span className="block text-xs text-posgmuted mt-0.5">{f.description}</span>
              </span>
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-posgtext mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={scrambleDrive}
            onChange={(e) => setScrambleDrive(e.target.checked)}
            className="accent-fairway w-4 h-4"
          />
          Scramble drive
          <span className="text-xs text-posgmuted">(tags the round "SD" on stats only)</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-posgmuted mb-2">
          <Users2 size={14} /> Who's playing
        </label>
        <div className="grid sm:grid-cols-2 gap-1.5 mb-2">
          {players.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <div
                key={p.id}
                className={
                  'flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 ' +
                  (checked ? 'bg-posgbg' : '')
                }
              >
                <label className="flex items-center gap-2 text-sm text-posgtext flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePlayer(p.id)}
                    className="accent-fairway w-4 h-4"
                  />
                  {p.name}
                </label>
                {checked && isTeamFormat && (
                  <div className="flex gap-1">
                    {[1, 2].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setTeamNumbers((t) => ({ ...t, [p.id]: n }))}
                        className={
                          'text-xs px-2 py-1 rounded ' +
                          (teamNumbers[p.id] === n
                            ? 'bg-gold text-black font-semibold'
                            : 'bg-posgborder text-posgmuted hover:text-posgtext')
                        }
                      >
                        Team {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="mt-4 inline-flex items-center gap-1.5 bg-fairway text-black font-medium px-4 py-2 rounded-md text-sm hover:bg-fairwaydark hover:text-white transition disabled:opacity-50"
        >
          <Play size={14} /> {creating ? 'Starting…' : 'Start round'}
        </button>
      </form>
    </div>
  );
}
