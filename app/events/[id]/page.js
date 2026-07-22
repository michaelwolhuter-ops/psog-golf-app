'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Flag, Save, Trash2, Plus, Users, Trophy, ArrowUpRight, Crosshair, Award } from 'lucide-react';

const typeLabel = { qualifier: 'Qualifier', tour_day: 'Tour Day' };

// Visual planning marker only — nothing is actually hidden yet. Mike flagged
// these as sections that will become admin-only once a public/player view exists.
function HiddenLaterTag() {
  return (
    <span className="text-xs font-normal text-posgmuted/70 italic">(hidden later — admin only)</span>
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({}); // player_id -> { points, longest_drive, closest_to_pin }
  const [meta, setMeta] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [metaError, setMetaError] = useState('');

  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [teamPoints, setTeamPoints] = useState('');
  const [teamMemberIds, setTeamMemberIds] = useState([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');

  function load() {
    fetch(`/api/events/${id}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setEvent(body.event);
        setMeta(body.event);
        setPlayers(body.players);
        setTeams(body.teams || []);
        const f = {};
        body.players.forEach((p) => {
          const r = body.results.find((res) => res.player_id === p.id);
          f[p.id] = {
            points: r ? r.points : '',
            longest_drive: r ? r.longest_drive : false,
            closest_to_pin: r ? r.closest_to_pin : false,
            countback_win: r ? r.countback_win : false,
          };
        });
        setForm(f);
      });
  }

  useEffect(load, [id]);

  function setField(playerId, field, value) {
    setForm((f) => ({ ...f, [playerId]: { ...f[playerId], [field]: value } }));
  }

  // Countback, Longest Drive and Closest to the Pin all save themselves
  // immediately on click, rather than waiting for the batch "Save results"
  // button — these are quick tick-and-move-on calls made while walking the
  // table, and it's easy to tick one then get pulled away before hitting
  // Save, silently losing it (this is exactly what happened with countback).
  // Points stays batch-only, since that's typed entry across the whole
  // table that naturally ends with one deliberate "Save results" click.
  async function saveResultField(playerId, field, value) {
    setField(playerId, field, value);
    const v = form[playerId] || {};
    if (v.points === '' || v.points === null || v.points === undefined) {
      // No points entered yet for this player — nothing meaningful to save
      // until they have a score on record.
      return;
    }
    setResultsError('');
    const res = await fetch(`/api/events/${id}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [
          {
            player_id: playerId,
            points: v.points,
            longest_drive: field === 'longest_drive' ? value : v.longest_drive,
            closest_to_pin: field === 'closest_to_pin' ? value : v.closest_to_pin,
            countback_win: field === 'countback_win' ? value : v.countback_win,
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setResultsError(body.error || `Save failed (${res.status}) — reverted.`);
      load(); // pull back the real saved state rather than leave a lie on screen
      return;
    }
    setSavedAt(new Date());
  }

  async function saveResults() {
    setSaving(true);
    setResultsError('');
    const results = Object.entries(form).map(([player_id, v]) => ({
      player_id,
      points: v.points === '' ? null : v.points,
      longest_drive: v.longest_drive,
      closest_to_pin: v.closest_to_pin,
      countback_win: v.countback_win,
    }));
    const res = await fetch(`/api/events/${id}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setResultsError(body.error || `Save failed (${res.status}) — nothing was recorded.`);
      return;
    }
    setSavedAt(new Date());
    load();
  }

  async function saveMeta(e) {
    e.preventDefault();
    setSavingMeta(true);
    setMetaError('');
    const res = await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    });
    setSavingMeta(false);
    if (res.ok) {
      load(); // full reload so the header/summary above is never stale
    } else {
      const body = await res.json().catch(() => ({}));
      setMetaError(body.error || `Save failed (${res.status}) — nothing was recorded.`);
    }
  }

  // Removes a single player's result immediately, rather than making them
  // clear the points field and remember to hit "Save results".
  async function deleteResult(playerId) {
    if (!confirm("Remove this player's result for this event?")) return;
    setResultsError('');
    const results = Object.entries(form).map(([player_id, v]) => ({
      player_id,
      points: player_id === playerId ? null : v.points === '' ? null : v.points,
      longest_drive: player_id === playerId ? false : v.longest_drive,
      closest_to_pin: player_id === playerId ? false : v.closest_to_pin,
      countback_win: player_id === playerId ? false : v.countback_win,
    }));
    const res = await fetch(`/api/events/${id}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setResultsError(body.error || `Delete failed (${res.status}).`);
      return;
    }
    load();
  }

  async function deleteEvent() {
    if (!confirm(`Delete "${event.name}"? This also removes all its results. This can't be undone.`)) {
      return;
    }
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    router.push('/events');
  }

  function toggleTeamMember(playerId) {
    setTeamMemberIds((ids) =>
      ids.includes(playerId) ? ids.filter((i) => i !== playerId) : [...ids, playerId]
    );
  }

  async function addTeam(e) {
    e.preventDefault();
    if (teamMemberIds.length === 0) {
      setTeamError('Pick at least one player');
      return;
    }
    setSavingTeam(true);
    setTeamError('');
    const res = await fetch(`/api/events/${id}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: teamPoints === '' ? null : teamPoints,
        player_ids: teamMemberIds,
      }),
    });
    const body = await res.json();
    setSavingTeam(false);
    if (!res.ok) {
      setTeamError(body.error || 'Something went wrong');
      return;
    }
    setTeamPoints('');
    setTeamMemberIds([]);
    setTeamFormOpen(false);
    load();
  }

  async function updateTeamPoints(teamId, points) {
    await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: points === '' ? null : points }),
    });
    load();
  }

  async function deleteTeam(teamId, memberNames) {
    if (!confirm(`Delete team "${memberNames || 'this team'}"?`)) return;
    await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
    load();
  }

  if (error) {
    return (
      <div>
        <p className="text-red-400">{error}</p>
        <Link href="/events" className="text-fairway text-sm">
          ← Back to events
        </Link>
      </div>
    );
  }

  if (!event) return <p className="text-posgmuted">Loading…</p>;

  const enteredCount = Object.values(form).filter((v) => v.points !== '' && v.points !== null).length;

  const individualLeaderboard = players
    .map((p) => ({ ...p, ...form[p.id] }))
    .filter((p) => p.points !== '' && p.points !== null && p.points !== undefined)
    .map((p) => ({
      ...p,
      overall: Number(p.points) + (p.longest_drive ? 2 : 0) + (p.closest_to_pin ? 2 : 0),
    }))
    // Countback win is a manual committee call, not assumed — only breaks a
    // tie on overall points, never overrides an actual points difference.
    .sort((a, b) => {
      if (b.overall !== a.overall) return b.overall - a.overall;
      return (b.countback_win ? 1 : 0) - (a.countback_win ? 1 : 0);
    });

  const teamLeaderboard = teams
    .filter((t) => t.points !== null && t.points !== undefined)
    .slice()
    .sort((a, b) => Number(b.points) - Number(a.points));

  return (
    <div>
      <Link
        href="/events"
        className="inline-flex items-center gap-1 text-sm text-posgmuted hover:text-posgtext mb-4"
      >
        <ArrowLeft size={14} /> All events
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Flag size={22} className="text-fairway" />
          <h1 className="text-2xl font-bold text-posgtext">{event.name}</h1>
          <span
            className={
              'text-xs px-2 py-0.5 rounded-full ' +
              (event.status === 'completed'
                ? 'bg-fairway/15 text-fairway'
                : 'bg-posgborder text-posgmuted')
            }
          >
            {typeLabel[event.event_type] || event.event_type}
          </span>
        </div>
        <button
          onClick={deleteEvent}
          className="inline-flex items-center gap-1.5 text-sm text-posgmuted hover:text-red-400 transition"
        >
          <Trash2 size={14} /> Delete event
        </button>
      </div>
      <p className="text-posgmuted mb-6">
        {enteredCount} of {players.length} players have a result recorded.
      </p>

      <form
        onSubmit={saveMeta}
        className="bg-posgcard rounded-xl border border-posgborder p-5 mb-8 grid sm:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-xs text-posgmuted mb-1">Date</label>
          <input
            type="date"
            value={meta.event_date || ''}
            onChange={(e) => setMeta({ ...meta, event_date: e.target.value })}
            className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
          />
        </div>
        <div>
          <label className="block text-xs text-posgmuted mb-1">Golf course</label>
          <input
            value={meta.golf_course || ''}
            onChange={(e) => setMeta({ ...meta, golf_course: e.target.value })}
            className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
          />
        </div>
        <div>
          <label className="block text-xs text-posgmuted mb-1">Format</label>
          <input
            value={meta.format || ''}
            onChange={(e) => setMeta({ ...meta, format: e.target.value })}
            placeholder="e.g. Individual Stableford"
            className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
          />
        </div>
        <div>
          <label className="block text-xs text-posgmuted mb-1">Status</label>
          <select
            value={meta.status || 'upcoming'}
            onChange={(e) => setMeta({ ...meta, status: e.target.value })}
            className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
          >
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-posgmuted mb-1">Notes</label>
          <textarea
            value={meta.notes || ''}
            onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
            rows={2}
            className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={savingMeta}
            className="text-sm bg-posgborder text-posgtext px-3 py-1.5 rounded-md hover:bg-posgcardhover transition disabled:opacity-50"
          >
            {savingMeta ? 'Saving…' : 'Save event details'}
          </button>
          {metaError && <p className="text-red-400 text-sm mt-2">{metaError}</p>}
        </div>
      </form>

      {/* Individual results — this is what feeds Order of Merit */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold text-posgtext flex items-center gap-2">
          Results (individual — counts for Order of Merit) <HiddenLaterTag />
        </h2>
        <button
          onClick={saveResults}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-sm bg-fairway text-black font-medium px-3 py-1.5 rounded-md hover:bg-fairwaydark hover:text-white transition disabled:opacity-50"
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save results'}
        </button>
      </div>
      {savedAt && (
        <p className="text-xs text-posgmuted mb-2">Saved {savedAt.toLocaleTimeString()}</p>
      )}
      {resultsError && (
        <p className="text-red-400 text-sm mb-2">{resultsError}</p>
      )}

      <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3 w-28">Points</th>
              <th className="px-4 py-3 text-center w-32">Longest Drive</th>
              <th className="px-4 py-3 text-center w-32">Closest to the Pin</th>
              <th className="px-4 py-3 text-center w-24">Countback</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-posgborder last:border-0">
                <td className="px-4 py-2 text-posgtext">{p.name}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={form[p.id]?.points ?? ''}
                    onChange={(e) => setField(p.id, 'points', e.target.value)}
                    className="w-20 bg-posgbg border border-posgborder rounded-md px-2 py-1 text-sm text-posgtext"
                    placeholder="—"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!form[p.id]?.longest_drive}
                    onChange={(e) => saveResultField(p.id, 'longest_drive', e.target.checked)}
                    className="accent-fairway w-4 h-4"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!form[p.id]?.closest_to_pin}
                    onChange={(e) => saveResultField(p.id, 'closest_to_pin', e.target.checked)}
                    className="accent-fairway w-4 h-4"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!form[p.id]?.countback_win}
                    onChange={(e) => saveResultField(p.id, 'countback_win', e.target.checked)}
                    className="accent-gold w-4 h-4"
                    title="Tick if the committee decided this player wins a tie on points"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  {form[p.id]?.points !== '' && form[p.id]?.points !== null && (
                    <button
                      onClick={() => deleteResult(p.id)}
                      className="text-posgmuted hover:text-red-400"
                      title="Remove this player's result"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Team results — separate from the above, never touches Order of Merit */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold text-posgtext flex items-center gap-2">
          <Users size={17} className="text-gold" /> Team Results <HiddenLaterTag />
        </h2>
        <button
          onClick={() => setTeamFormOpen((v) => !v)}
          className="text-sm bg-posgborder text-posgtext px-3 py-1.5 rounded-md hover:bg-posgcardhover transition"
        >
          {teamFormOpen ? 'Cancel' : '+ Add team'}
        </button>
      </div>
      <p className="text-xs text-posgmuted mb-3">
        Group players into a team and give them a result — for team-format rounds (better
        ball, scramble, American scramble). This doesn&apos;t affect Order of Merit or
        handicaps, it's tracked for team/player stats later.
      </p>

      {teamFormOpen && (
        <form
          onSubmit={addTeam}
          className="bg-posgcard rounded-xl border border-posgborder p-4 mb-4"
        >
          <div className="mb-3 max-w-[200px]">
            <label className="block text-xs text-posgmuted mb-1">Points</label>
            <input
              type="number"
              value={teamPoints}
              onChange={(e) => setTeamPoints(e.target.value)}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
              placeholder="e.g. 119"
            />
          </div>
          <label className="block text-xs text-posgmuted mb-2">Players on this team</label>
          <div className="grid sm:grid-cols-3 gap-1.5 mb-3">
            {players.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-posgtext">
                <input
                  type="checkbox"
                  checked={teamMemberIds.includes(p.id)}
                  onChange={() => toggleTeamMember(p.id)}
                  className="accent-fairway w-4 h-4"
                />
                {p.name}
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={savingTeam}
            className="inline-flex items-center gap-1.5 bg-fairway text-black font-medium px-3 py-1.5 rounded-md text-sm disabled:opacity-50"
          >
            <Plus size={14} /> {savingTeam ? 'Saving…' : 'Add team'}
          </button>
          {teamError && <p className="text-red-400 text-sm mt-2">{teamError}</p>}
        </form>
      )}

      {teams.length === 0 ? (
        <p className="text-posgmuted text-sm">No teams recorded for this event yet.</p>
      ) : (
        <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
              <tr>
                <th className="px-4 py-3">Players</th>
                <th className="px-4 py-3 w-28 text-right">Points</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-b border-posgborder last:border-0">
                  <td className="px-4 py-2 text-posgtext">
                    {t.members.map((m) => m.name).join(', ')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      defaultValue={t.points ?? ''}
                      onBlur={(e) => updateTeamPoints(t.id, e.target.value)}
                      className="w-20 bg-posgbg border border-posgborder rounded-md px-2 py-1 text-sm text-gold font-mono text-right"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => deleteTeam(t.id, t.members.map((m) => m.name).join(', '))}
                      className="text-posgmuted hover:text-red-400"
                      title="Delete team"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Read-only leaderboard for this event — individual + team side by side.
          This is what regular (non-admin) users will see later, once the entry
          forms above are hidden from anyone but the admin. */}
      <div className="flex items-center gap-2 mt-10 mb-1">
        <Trophy size={20} className="text-gold" />
        <h2 className="text-lg font-semibold text-posgtext">Event Leaderboard</h2>
      </div>
      <p className="text-xs text-posgmuted mb-4">
        Read-only view of this event's results. This is what everyone will see once
        score entry is admin-only — the tables above will be hidden from regular users.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-posgmuted uppercase tracking-wide mb-2">
            Individual
          </h3>
          {individualLeaderboard.length === 0 ? (
            <p className="text-posgmuted text-sm">No individual results yet.</p>
          ) : (
            <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
                  <tr>
                    <th className="px-4 py-2 w-10">Pos</th>
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {individualLeaderboard.map((p, i) => (
                    <tr key={p.id} className="border-b border-posgborder last:border-0">
                      <td className="px-4 py-2 font-bold text-posgtext">{i + 1}</td>
                      <td className="px-4 py-2 text-posgtext">
                        <span className="inline-flex items-center gap-1.5">
                          {p.name}
                          {p.longest_drive && (
                            <ArrowUpRight
                              size={14}
                              className="text-fairway"
                              title="Longest Drive"
                            />
                          )}
                          {p.closest_to_pin && (
                            <Crosshair
                              size={14}
                              className="text-gold"
                              title="Closest to the Pin"
                            />
                          )}
                          {p.countback_win && (
                            <Award
                              size={14}
                              className="text-posgmuted"
                              title="Won on countback"
                            />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gold font-semibold">
                        {p.overall}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-posgmuted uppercase tracking-wide mb-2">
            Team
          </h3>
          {teamLeaderboard.length === 0 ? (
            <p className="text-posgmuted text-sm">No team results yet.</p>
          ) : (
            <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
                  <tr>
                    <th className="px-4 py-2 w-10">Pos</th>
                    <th className="px-4 py-2">Players</th>
                    <th className="px-4 py-2 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {teamLeaderboard.map((t, i) => (
                    <tr key={t.id} className="border-b border-posgborder last:border-0">
                      <td className="px-4 py-2 font-bold text-posgtext">{i + 1}</td>
                      <td className="px-4 py-2 text-posgtext">
                        {t.members.map((m) => m.name).join(', ')}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gold font-semibold">
                        {t.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
