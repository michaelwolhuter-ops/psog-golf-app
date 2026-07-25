'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, Users2, Play, Trash2 } from 'lucide-react';

const FORMATS = [
  {
    value: 'individual_stableford',
    label: 'Individual Stableford',
    description: 'Each player scores on their own — no teams. Feeds Order of Merit directly.',
  },
  {
    value: 'better_ball_stableford',
    label: 'Better Ball Stableford',
    description: '2v2 — each hole’s team score is the better of the two partners’ points. Individual scores still feed Order of Merit; team total is tracked separately.',
  },
  {
    value: 'better_ball_match_play',
    label: 'Better Ball Match Play',
    description: '2v2 — pairs compare their better-ball points hole by hole (win/lose/halve). Individual scores still feed Order of Merit; the match result feeds Match Record, not points.',
  },
];

// Setup screen: pick who's playing together, what format, and (for the two
// better-ball formats) which team each player is on — before any hole gets
// entered. One scorecard = one group of players playing together, not one
// per event, since each marker only enters their own fourball.
export default function NewScorecardPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [players, setPlayers] = useState([]);
  const [existing, setExisting] = useState([]);
  const [error, setError] = useState('');

  const [format, setFormat] = useState('individual_stableford');
  const [selectedIds, setSelectedIds] = useState([]);
  const [teamNumbers, setTeamNumbers] = useState({}); // player_id -> 1 | 2
  const [groupLabel, setGroupLabel] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    fetch(`/api/events/${id}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setEvent(body.event);
        setPlayers((body.players || []).filter((p) => p.active));
      });
    fetch(`/api/events/${id}/scorecards`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => setExisting(body.data || []));
  }

  useEffect(load, [id]);

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

  function setTeam(playerId, teamNumber) {
    setTeamNumbers((t) => ({ ...t, [playerId]: teamNumber }));
  }

  async function createScorecard(e) {
    e.preventDefault();
    setError('');

    if (selectedIds.length < 2) {
      setError('Pick at least 2 players');
      return;
    }
    if (isTeamFormat) {
      const missing = selectedIds.filter((pid) => !teamNumbers[pid]);
      if (missing.length > 0) {
        setError('Assign every player to Team 1 or Team 2');
        return;
      }
    }

    setCreating(true);
    const res = await fetch(`/api/events/${id}/scorecards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format,
        group_label: groupLabel || null,
        player_ids: selectedIds,
        team_numbers: isTeamFormat ? teamNumbers : {},
      }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error || `Couldn't create the round (${res.status})`);
      return;
    }
    router.push(`/scorecards/${body.data.id}`);
  }

  async function abandon(scorecardId) {
    if (!confirm('Abandon this in-progress round? Any holes entered so far will be lost.')) return;
    const res = await fetch(`/api/scorecards/${scorecardId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Could not delete');
      return;
    }
    load();
  }

  if (error && !event) {
    return (
      <div>
        <p className="text-red-400">{error}</p>
        <Link href={`/events/${id}`} className="text-fairway text-sm">
          ← Back to event
        </Link>
      </div>
    );
  }

  if (!event) return <p className="text-posgmuted">Loading…</p>;

  const inProgress = existing.filter((s) => s.status === 'in_progress');
  const formatLabelFor = (v) => FORMATS.find((f) => f.value === v)?.label || v;

  return (
    <div>
      <Link
        href={`/events/${id}`}
        className="inline-flex items-center gap-1 text-sm text-posgmuted hover:text-posgtext mb-4"
      >
        <ArrowLeft size={14} /> Back to {event.name}
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <ClipboardList size={22} className="text-fairway" />
        <h1 className="text-2xl font-bold text-posgtext">New Scorecard</h1>
      </div>
      <p className="text-posgmuted mb-6">
        Set up a round for one group playing together — you'll enter scores hole by hole next.
      </p>

      {inProgress.length > 0 && (
        <div className="bg-posgcard rounded-xl border border-posgborder p-4 mb-8">
          <h2 className="text-sm font-semibold text-posgmuted uppercase tracking-wide mb-3">
            Resume an in-progress round
          </h2>
          <div className="space-y-2">
            {inProgress.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 bg-posgbg rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm text-posgtext font-medium">
                    {s.group_label || formatLabelFor(s.format)}
                  </p>
                  <p className="text-xs text-posgmuted">
                    {(s.scorecard_players || []).map((sp) => sp.players?.name).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/scorecards/${s.id}`}
                    className="inline-flex items-center gap-1 text-xs bg-fairway text-black font-medium px-2.5 py-1.5 rounded-md hover:bg-fairwaydark hover:text-white transition"
                  >
                    <Play size={12} /> Resume
                  </Link>
                  <button
                    onClick={() => abandon(s.id)}
                    className="text-posgmuted hover:text-red-400"
                    title="Abandon this round"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={createScorecard} className="bg-posgcard rounded-xl border border-posgborder p-5">
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

        <label className="block text-xs text-posgmuted mb-1">Group name (optional)</label>
        <input
          value={groupLabel}
          onChange={(e) => setGroupLabel(e.target.value)}
          placeholder="e.g. Group 1"
          className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext mb-5"
        />

        <label className="flex items-center gap-2 text-xs text-posgmuted mb-2">
          <Users2 size={14} /> Players in this group
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
                        onClick={() => setTeam(p.id, n)}
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
