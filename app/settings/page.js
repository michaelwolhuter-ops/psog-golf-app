'use client';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useAdmin } from '@/lib/AdminContext';

export default function SettingsPage() {
  const { isAdmin } = useAdmin();
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) setError(body.error);
        else setSettings(body.data);
      });
  }, []);

  function set(field, value) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const body = await res.json();
    setSaving(false);
    if (res.ok) {
      setSettings(body.data);
      setSavedAt(new Date());
    } else {
      setError(body.error);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <SettingsIcon size={22} className="text-fairway" />
        <h1 className="text-2xl font-bold text-posgtext">Settings</h1>
      </div>
      <p className="text-posgmuted mb-6">Season name, tour dates, and general tour rules.</p>

      {error && <p className="text-red-400">{error}</p>}
      {!settings && !error && <p className="text-posgmuted">Loading…</p>}

      {settings && (
        <form
          onSubmit={save}
          className="bg-posgcard rounded-xl border border-posgborder p-5 max-w-lg"
        >
          {/* Viewing stays open to everyone — only editing is admin-only.
              A native <fieldset disabled> locks every input (and the submit
              button, since it's inside too) at once, no per-field isAdmin
              checks needed. border-0/p-0/m-0 strip the browser's default
              fieldset chrome so it's invisible layout-wise. */}
          <fieldset disabled={!isAdmin} className="space-y-4 border-0 p-0 m-0">
            <div>
              <label className="block text-xs text-posgmuted mb-1">Season name</label>
              <input
                value={settings.season_name || ''}
                onChange={(e) => set('season_name', e.target.value)}
                className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext disabled:opacity-60"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-posgmuted mb-1">Tour start date</label>
                <input
                  type="date"
                  value={settings.tour_start_date || ''}
                  onChange={(e) => set('tour_start_date', e.target.value)}
                  className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs text-posgmuted mb-1">Tour end date</label>
                <input
                  type="date"
                  value={settings.tour_end_date || ''}
                  onChange={(e) => set('tour_end_date', e.target.value)}
                  className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext disabled:opacity-60"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-posgmuted mb-1">
                Qualifiers required to make tour
              </label>
              <input
                type="number"
                min={0}
                value={settings.num_qualifiers_required ?? ''}
                onChange={(e) => set('num_qualifiers_required', Number(e.target.value))}
                className="w-32 bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs text-posgmuted mb-1">
                Points allocation notes
              </label>
              <textarea
                value={settings.points_allocation || ''}
                onChange={(e) => set('points_allocation', e.target.value)}
                rows={3}
                className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext disabled:opacity-60"
                placeholder="Free text for now — e.g. how stableford points map per format."
              />
            </div>
            {isAdmin && (
              <div>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-fairway text-black font-medium px-4 py-1.5 rounded-md text-sm disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save settings'}
                </button>
                {savedAt && (
                  <span className="text-xs text-posgmuted ml-3">Saved {savedAt.toLocaleTimeString()}</span>
                )}
              </div>
            )}
          </fieldset>
        </form>
      )}
    </div>
  );
}
