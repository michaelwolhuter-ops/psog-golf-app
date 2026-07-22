'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, UserCircle2, ChevronRight } from 'lucide-react';

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(1);
}

export default function PlayersPage() {
  const router = useRouter();
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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
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
        <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Index</th>
                <th className="px-4 py-3 text-right">Prediction</th>
                <th className="px-4 py-3 text-right">Committee Adj</th>
                <th className="px-4 py-3 text-right">Tour Handicap</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-2 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/players/${p.id}`)}
                  className="group border-b border-posgborder last:border-0 cursor-pointer transition hover:bg-fairway/10 active:bg-fairway/20"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/players/${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 bg-posgbg border border-posgborder rounded-full pl-1.5 pr-3 py-1 hover:border-fairway/60 hover:bg-fairway/10 active:bg-fairway/20 transition"
                    >
                      <UserCircle2 size={20} className="text-posgmuted shrink-0" />
                      <div className="text-left">
                        <div className="text-posgtext font-medium leading-tight">{p.name}</div>
                        {p.nickname && (
                          <div className="text-[11px] text-posgmuted leading-tight">
                            &quot;{p.nickname}&quot;
                          </div>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-posgmuted shrink-0" />
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
                  <td className="px-2 py-3 text-posgmuted group-hover:text-fairway group-hover:translate-x-0.5 transition-transform">
                    <ChevronRight size={16} />
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
