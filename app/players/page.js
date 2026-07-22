'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, UserCircle2 } from 'lucide-react';

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(1);
}

export default function PlayersPage() {
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function load() {
    fetch('/api/players', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) setError(body.error);
        else setPlayers(body.data);
      });
  }

  useEffect(load, []);

  async function addPlayer(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError('');
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, nickname: nickname || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFormError(body.error || 'Something went wrong');
      return;
    }
    setName('');
    setNickname('');
    setFormOpen(false);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Users size={22} className="text-fairway" />
          <h1 className="text-2xl font-bold text-posgtext">Players</h1>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="text-sm bg-fairway text-black font-medium px-3 py-1.5 rounded-md hover:bg-fairwaydark hover:text-white transition"
        >
          {formOpen ? 'Cancel' : '+ Add player'}
        </button>
      </div>
      <p className="text-posgmuted mb-6">
        One row per person — this is the canonical list everything else links to.
      </p>

      {formOpen && (
        <form
          onSubmit={addPlayer}
          className="bg-posgcard rounded-xl border border-posgborder p-4 mb-6 flex items-end gap-3 flex-wrap"
        >
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-posgmuted mb-1">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
              placeholder="e.g. Mike W"
              autoFocus
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-posgmuted mb-1">Nickname (optional)</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
              placeholder="e.g. Wolfy"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-fairway text-black font-medium px-4 py-1.5 rounded-md text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {formError && <p className="text-red-400 text-sm w-full">{formError}</p>}
        </form>
      )}

      {error && <p className="text-red-400">{error}</p>}
      {!players && !error && <p className="text-posgmuted">Loading…</p>}

      {players && (
        <div className="bg-posgcard rounded-xl border border-posgborder overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Index</th>
                <th className="px-4 py-3 text-right">Prediction</th>
                <th className="px-4 py-3 text-right">Committee Adj</th>
                <th className="px-4 py-3 text-right">Tour Handicap</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-posgborder last:border-0 hover:bg-posgcardhover"
                >
                  <td className="px-4 py-3">
                    <Link href={`/players/${p.id}`} className="flex items-center gap-2">
                      <UserCircle2 size={20} className="text-posgmuted" />
                      <div>
                        <div className="text-posgtext hover:text-fairway">{p.name}</div>
                        {p.nickname && (
                          <div className="text-xs text-posgmuted">&quot;{p.nickname}&quot;</div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-posgmuted">
                    {p.index ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-posgmuted">
                    {p.handicap_prediction ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-posgmuted">
                    {p.committee_adjustment}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gold">
                    {fmt(p.tour_handicap)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        'text-xs px-2 py-0.5 rounded-full ' +
                        (p.active
                          ? 'bg-fairway/15 text-fairway'
                          : 'bg-posgborder text-posgmuted')
                      }
                    >
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-posgmuted mt-4">
        Click a player to open their profile — handicap, order of merit position, and full
        results history. Photo upload and activate/deactivate editing come next.
      </p>
    </div>
  );
}
