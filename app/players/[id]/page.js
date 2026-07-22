'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  UserCircle2,
  ArrowLeft,
  Trophy,
  Target,
  Flag,
  Gauge,
  Activity,
  Award,
  ArrowUpRight,
  Crosshair,
  CheckCircle2,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
} from 'lucide-react';

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(1);
}

const typeLabel = { qualifier: 'Qualifier', tour_day: 'Tour Day' };

export default function PlayerProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Admin-only profile fields (name, nickname, handicap prediction, committee
  // adjustment, active status). In V1 there's no auth so this "Edit" panel is
  // open to anyone with the link — but once the Player Version ships with
  // auth, this whole button + form should be hidden from non-admins. Players
  // never edit their own name or Committee Adjustment; they only ever touch
  // their Index and their Rounds (both handled separately below).
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Index is a player-facing field, not an admin one — it lives outside the
  // Edit panel above and is always editable in place. Unlike Average Round
  // Index and Tour Handicap (both calculated, never typed in), Index comes
  // from the player's own handicap subscription app, so this app has no way
  // to know when it changes — the player has to keep it updated by hand.
  const [indexEditing, setIndexEditing] = useState(false);
  const [indexValue, setIndexValue] = useState('');
  const [savingIndex, setSavingIndex] = useState(false);
  const [indexError, setIndexError] = useState('');

  const [roundScore, setRoundScore] = useState('');
  const [roundDate, setRoundDate] = useState('');
  const [addingRound, setAddingRound] = useState(false);

  function load() {
    fetch(`/api/players/${id}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setData(body);
        setForm(body.player);
      });
  }

  useEffect(load, [id]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    const res = await fetch(`/api/players/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        nickname: form.nickname || null,
        handicap_prediction: form.handicap_prediction === '' ? null : form.handicap_prediction,
        committee_adjustment: form.committee_adjustment === '' ? 0 : form.committee_adjustment,
        active: form.active,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setSaveError(body.error || 'Something went wrong');
      return;
    }
    setEditing(false);
    load();
  }

  async function saveIndex(e) {
    e.preventDefault();
    setSavingIndex(true);
    setIndexError('');
    const res = await fetch(`/api/players/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: indexValue === '' ? null : indexValue }),
    });
    const body = await res.json();
    setSavingIndex(false);
    if (!res.ok) {
      setIndexError(body.error || 'Something went wrong');
      return;
    }
    setIndexEditing(false);
    load();
  }

  async function addRound(e) {
    e.preventDefault();
    if (!roundScore) return;
    setAddingRound(true);
    await fetch(`/api/players/${id}/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: roundScore, round_date: roundDate || null }),
    });
    setAddingRound(false);
    setRoundScore('');
    setRoundDate('');
    load();
  }

  async function deleteRound(roundId) {
    await fetch(`/api/rounds/${roundId}`, { method: 'DELETE' });
    load();
  }

  // TODO(auth): once the Player Version ships, this delete action (and the
  // Edit button above) should be admin-only — players can never delete or
  // rename their own profile.
  async function deletePlayer() {
    if (
      !confirm(
        `Delete ${player.name}? This also removes their rounds, results and history. This can't be undone.`
      )
    ) {
      return;
    }
    await fetch(`/api/players/${id}`, { method: 'DELETE' });
    router.push('/players');
  }

  if (error) {
    return (
      <div>
        <p className="text-red-400">{error}</p>
        <Link href="/players" className="text-fairway text-sm">
          ← Back to players
        </Link>
      </div>
    );
  }

  if (!data) return <p className="text-posgmuted">Loading…</p>;

  const { player, handicap, oom_position, oom_total_points, qualification, results_history, rounds, wins } = data;

  // Players either have an official Index (subscription app) or, until they
  // get one, a Committee Handicap the committee sets manually — never both
  // shown at once. Tour Handicap swaps in whichever one the player has.
  const hasIndex = player.index !== null && player.index !== undefined;

  // Counted straight from results_history (already carries longest_drive /
  // closest_to_pin per event) — no separate query needed.
  const longestDriveCount = results_history.filter((r) => r.longest_drive).length;
  const closestToPinCount = results_history.filter((r) => r.closest_to_pin).length;

  return (
    <div>
      <Link
        href="/players"
        className="inline-flex items-center gap-1 text-sm text-posgmuted hover:text-posgtext mb-4"
      >
        <ArrowLeft size={14} /> All players
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <UserCircle2 size={56} className="text-posgmuted" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-posgtext">{player.name}</h1>
              <span
                className={
                  'text-xs px-2 py-0.5 rounded-full ' +
                  (player.active ? 'bg-fairway/15 text-fairway' : 'bg-posgborder text-posgmuted')
                }
              >
                {player.active ? 'Active' : 'Inactive'}
              </span>
              {qualification?.qualified_for_tour && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gold/15 text-gold">
                  Qualified for Tour
                </span>
              )}
            </div>
            {player.nickname && (
              <p className="text-posgmuted text-sm">&quot;{player.nickname}&quot;</p>
            )}
          </div>
        </div>
        {/* Admin-only controls — hide both buttons from players once auth ships */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setForm(player);
              setEditing((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 text-sm bg-posgborder text-posgtext px-3 py-1.5 rounded-md hover:bg-posgcardhover transition"
          >
            <Pencil size={14} /> {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={deletePlayer}
            className="inline-flex items-center gap-1.5 text-sm text-posgmuted hover:text-red-400 transition"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={saveProfile}
          className="bg-posgcard rounded-xl border border-posgborder p-5 mb-8 grid sm:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-xs text-posgmuted mb-1">Full name</label>
            <input
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
            />
          </div>
          <div>
            <label className="block text-xs text-posgmuted mb-1">Nickname</label>
            <input
              value={form.nickname || ''}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
            />
          </div>
          <div>
            <label className="block text-xs text-posgmuted mb-1">
              Committee Handicap (only used when player has no Index yet)
            </label>
            <input
              type="number"
              step="0.1"
              value={form.handicap_prediction ?? ''}
              onChange={(e) => setForm({ ...form, handicap_prediction: e.target.value })}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
            />
          </div>
          <div>
            <label className="block text-xs text-posgmuted mb-1">Committee adjustment</label>
            <input
              type="number"
              step="0.1"
              value={form.committee_adjustment ?? 0}
              onChange={(e) => setForm({ ...form, committee_adjustment: e.target.value })}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
            />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-fairway w-4 h-4"
            />
            <label className="text-sm text-posgtext">Active</label>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-fairway text-black font-medium px-4 py-1.5 rounded-md text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
          </div>
        </form>
      )}

      {/* ================= Section 1: player info & stats ================= */}

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
        <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
            <Target size={13} /> Tour Handicap
          </div>
          <div className="text-2xl font-bold text-gold mt-1">
            {fmt(handicap?.tour_handicap)}
          </div>
        </div>
        <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div className="text-xs text-posgmuted uppercase tracking-wide">Committee Adj</div>
          <div className="text-2xl font-bold text-posgtext mt-1">
            {player.committee_adjustment > 0 ? '+' : ''}
            {player.committee_adjustment}
          </div>
        </div>
        <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
            <Trophy size={13} /> Order of Merit
          </div>
          <div className="text-2xl font-bold text-posgtext mt-1">
            {oom_position ? `#${oom_position}` : '—'}
          </div>
          <div className="text-xs text-posgmuted">{oom_total_points} pts</div>
        </div>
        <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
            <Flag size={13} /> Events Played
          </div>
          <div className="text-2xl font-bold text-posgtext mt-1">
            {results_history.length}
          </div>
          {qualification && (
            <div className="text-xs text-posgmuted">
              {qualification.qualifiers_attended} qualifiers attended
            </div>
          )}
        </div>
        <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
            <Award size={13} /> Wins
          </div>
          <div className="text-2xl font-bold text-gold mt-1">
            {(wins?.individual || 0) + (wins?.team || 0)}
          </div>
          <div className="text-xs text-posgmuted">
            {wins?.individual || 0} individual · {wins?.team || 0} team
          </div>
        </div>
        <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
            <ArrowUpRight size={13} /> Longest Drive
          </div>
          <div className="text-2xl font-bold text-posgtext mt-1">{longestDriveCount}</div>
        </div>
        <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
            <Crosshair size={13} /> Closest to the Pin
          </div>
          <div className="text-2xl font-bold text-posgtext mt-1">{closestToPinCount}</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-posgtext mb-2">Results History</h2>
      {results_history.length === 0 ? (
        <p className="text-posgmuted text-sm mb-3">No results recorded yet.</p>
      ) : (
        <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto mb-3">
          <table className="w-full text-sm">
            <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
              <tr>
                <th className="px-4 py-3 w-12">Pos</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-center">LD</th>
                <th className="px-4 py-3 text-center">CTP</th>
                <th className="px-4 py-3 text-right">Overall</th>
              </tr>
            </thead>
            <tbody>
              {results_history.map((r) => (
                <tr
                  key={r.event_id}
                  className="border-b border-posgborder last:border-0 hover:bg-posgcardhover"
                >
                  <td className="px-4 py-3 font-bold text-posgtext">{r.position ?? '—'}</td>
                  <td className="px-4 py-3 text-posgtext">{r.event_name}</td>
                  <td className="px-4 py-3 text-posgmuted">{typeLabel[r.event_type] || r.event_type}</td>
                  <td className="px-4 py-3 text-right font-mono text-posgmuted">{r.points ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {r.longest_drive && <CheckCircle2 size={14} className="inline text-gold" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.closest_to_pin && <CheckCircle2 size={14} className="inline text-gold" />}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-posgtext">
                    {r.overall}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-posgmuted mb-10">
        Future statistics (birdies, bogeys, head-to-head) will appear in this section once
        scorecards exist.
      </p>

      {/* ================= Section 2: handicap ================= */}

      <div className="border-t-2 border-fairway/40 pt-10">
        <h2 className="text-2xl font-extrabold text-posgtext mb-1 tracking-tight">Handicap</h2>
        <p className="text-xs text-posgmuted mb-4">
          Index comes from your handicap subscription app — update it here whenever it
          changes. Players without an official Index yet use a Committee Handicap set by
          the committee instead. Average Round Index and Tour Handicap are always
          calculated from your rounds below, never typed in directly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-posgcard rounded-xl border border-posgborder p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
                <Gauge size={13} /> {hasIndex ? 'Index' : 'Committee Handicap'}
              </div>
              {hasIndex && !indexEditing && (
                <button
                  onClick={() => {
                    setIndexValue(player.index ?? '');
                    setIndexError('');
                    setIndexEditing(true);
                  }}
                  className="text-posgmuted hover:text-posgtext"
                  title="Edit index"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
            {hasIndex && indexEditing ? (
              <form onSubmit={saveIndex} className="mt-1.5 flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  autoFocus
                  value={indexValue}
                  onChange={(e) => setIndexValue(e.target.value)}
                  placeholder="none"
                  className="w-20 bg-posgbg border border-posgborder rounded-md px-2 py-1 text-sm text-posgtext"
                />
                <button
                  type="submit"
                  disabled={savingIndex}
                  className="text-fairway hover:opacity-80 disabled:opacity-50"
                  title="Save"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIndexEditing(false)}
                  className="text-posgmuted hover:text-red-400"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              </form>
            ) : (
              <div className="text-2xl font-bold text-posgtext mt-1">
                {hasIndex ? fmt(player.index) : fmt(player.handicap_prediction)}
              </div>
            )}
            {indexError && <p className="text-red-400 text-xs mt-1">{indexError}</p>}
            {!hasIndex && (
              <p className="text-[11px] text-posgmuted mt-1">
                No official Index yet — set by the committee via Edit profile.
              </p>
            )}
          </div>

          <div className="bg-posgcard rounded-xl border border-posgborder p-4">
            <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
              <Activity size={13} /> Average Round Index
            </div>
            <div className="text-2xl font-bold text-posgtext mt-1">{fmt(handicap?.differential)}</div>
            <p className="text-[11px] text-posgmuted mt-1">From your rounds below — add or delete a round to update it.</p>
          </div>

          <div className="bg-posgcard rounded-xl border border-posgborder p-4">
            <div className="flex items-center gap-1.5 text-xs text-posgmuted uppercase tracking-wide">
              <Target size={13} /> Tour Handicap
            </div>
            <div className="text-2xl font-bold text-gold mt-1">{fmt(handicap?.tour_handicap)}</div>
            <p className="text-[11px] text-posgmuted mt-1">(Index or Committee Handicap + Average Round Index) ÷ 2, plus Committee Adjustment.</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-posgtext mb-2">Rounds (for handicap)</h3>
        <p className="text-xs text-posgmuted mb-3">
          The 5 most recent rounds shown here are averaged into the Average Round Index above.
          Older rounds stay on record but stop counting once newer ones are added.
        </p>
        <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto mb-3">
          <table className="w-full text-sm">
            <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Score</th>
                <th className="px-4 py-2 text-center">Counts</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {(!rounds || rounds.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-posgmuted text-sm">
                    No rounds logged yet.
                  </td>
                </tr>
              )}
              {rounds &&
                rounds.map((r) => (
                  <tr key={r.id} className="border-b border-posgborder last:border-0">
                    <td className="px-4 py-2 text-posgmuted">{r.round_date || 'no date'}</td>
                    <td className="px-4 py-2 text-right font-mono text-posgtext">{r.score}</td>
                    <td className="px-4 py-2 text-center">
                      {r.counts_toward_handicap ? (
                        <CheckCircle2 size={14} className="inline text-fairway" />
                      ) : (
                        <span className="text-posgmuted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => deleteRound(r.id)}
                        className="text-posgmuted hover:text-red-400"
                        title="Delete round"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={addRound} className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs text-posgmuted mb-1">Score</label>
            <input
              type="number"
              value={roundScore}
              onChange={(e) => setRoundScore(e.target.value)}
              className="w-24 bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
              placeholder="e.g. 88"
            />
          </div>
          <div>
            <label className="block text-xs text-posgmuted mb-1">Date (optional)</label>
            <input
              type="date"
              value={roundDate}
              onChange={(e) => setRoundDate(e.target.value)}
              className="bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
            />
          </div>
          <button
            type="submit"
            disabled={addingRound || !roundScore}
            className="inline-flex items-center gap-1.5 bg-fairway text-black font-medium px-3 py-1.5 rounded-md text-sm disabled:opacity-50"
          >
            <Plus size={14} /> {addingRound ? 'Adding…' : 'Add round'}
          </button>
        </form>
      </div>
    </div>
  );
}
