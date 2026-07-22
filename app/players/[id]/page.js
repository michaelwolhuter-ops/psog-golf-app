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
  CheckCircle2,
  Pencil,
  Trash2,
  Plus,
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

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
        index: form.index === '' ? null : form.index,
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

  const { player, handicap, oom_position, oom_total_points, qualification, results_history, rounds } = data;

  return (
    <div>
      <Link
        href="/players"
        className="inline-flex items-center gap-1 text-sm text-posgmuted hover:text-posgtext mb-4"
      >
        <ArrowLeft size={14} /> All players
      </Link>

      <div className="flex items-center justify-between mb-6">
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
              Official handicap index (leave blank if none)
            </label>
            <input
              type="number"
              step="0.1"
              value={form.index ?? ''}
              onChange={(e) => setForm({ ...form, index: e.target.value })}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
            />
          </div>
          <div>
            <label className="block text-xs text-posgmuted mb-1">
              Committee prediction (only used when no index)
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
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
      </div>

      <h2 className="text-lg font-semibold text-posgtext mb-2">Rounds (for handicap)</h2>
      <p className="text-xs text-posgmuted mb-3">
        The 5 most recent rounds shown here are averaged into the Differential used for the
        Tour Handicap above. Older rounds stay on record but stop counting once newer ones
        are added.
      </p>
      <div className="bg-posgcard rounded-xl border border-posgborder overflow-hidden mb-3">
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

      <form onSubmit={addRound} className="flex items-end gap-3 mb-8">
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

      <h2 className="text-lg font-semibold text-posgtext mb-2">Results History</h2>
      {results_history.length === 0 ? (
        <p className="text-posgmuted text-sm">No results recorded yet.</p>
      ) : (
        <div className="bg-posgcard rounded-xl border border-posgborder overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
              <tr>
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

      <p className="text-xs text-posgmuted mt-4">
        Future statistics (birdies, bogeys, head-to-head) will appear here once scorecards exist.
      </p>
    </div>
  );
}
