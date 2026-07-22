'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, UserCircle2, ChevronRight } from 'lucide-react';

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

      {players && players.length > 0 && (
        <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 pb-2 text-[11px] uppercase tracking-wide text-posgmuted">
          <div className="w-[38px] shrink-0" />
          <div className="flex-1">Player</div>
          <div className="shrink-0">Status</div>
          <div className="shrink-0 w-16 text-right">Tour Hcp</div>
          <div className="w-[18px] shrink-0" />
        </div>
      )}

      {players && (
        <div className="bg-posgcard rounded-2xl border border-posgborder overflow-hidden divide-y divide-posgborder">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className={`group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 hover:bg-posgcardhover transition ${
                p.active ? '' : 'opacity-50'
              }`}
            >
              <UserCircle2 size={38} className="text-posgmuted shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-posgtext truncate">{p.name}</div>
                {p.nickname && (
                  <div className="text-xs text-posgmuted truncate">&quot;{p.nickname}&quot;</div>
                )}
              </div>

              <span
                className={
                  'shrink-0 text-xs px-2 py-0.5 rounded-full ' +
                  (p.active ? 'bg-fairway/15 text-fairway' : 'bg-posgborder text-posgmuted')
                }
              >
                {p.active ? 'Active' : 'Inactive'}
              </span>

              <div className="shrink-0 text-right w-16">
                <div className="text-2xl font-extrabold text-gold font-mono tabular-nums">
                  {fmt(p.tour_handicap)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-posgmuted mt-0.5">
                  Hcp
                </div>
              </div>

              <ChevronRight
                size={18}
                className="text-posgmuted shrink-0 group-hover:text-fairway group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-posgmuted mt-4">
        Click a player to open their profile — handicap breakdown, order of merit position,
        and full results history.
      </p>
    </div>
  );
}
