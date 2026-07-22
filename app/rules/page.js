'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Trash2, Plus } from 'lucide-react';

export default function RulesPage() {
  const [sections, setSections] = useState(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const [addingOpen, setAddingOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  function load() {
    fetch('/api/rules', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setSections(body.data);
        const d = {};
        body.data.forEach((s) => (d[s.id] = s.body));
        setDrafts(d);
      });
  }

  useEffect(load, []);

  async function save(id) {
    setSavingId(id);
    await fetch('/api/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, body: drafts[id] }),
    });
    setSavingId(null);
    load();
  }

  async function addSection(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: newTitle }),
    });
    setAdding(false);
    setNewTitle('');
    setAddingOpen(false);
    load();
  }

  async function deleteSection(id, title) {
    if (!confirm(`Delete the "${title}" section?`)) return;
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <BookOpen size={22} className="text-fairway" />
          <h1 className="text-2xl font-bold text-posgtext">Rules &amp; Information</h1>
        </div>
        <button
          onClick={() => setAddingOpen((v) => !v)}
          className="text-sm bg-fairway text-black font-medium px-3 py-1.5 rounded-md hover:bg-fairwaydark hover:text-white transition"
        >
          {addingOpen ? 'Cancel' : '+ Add section'}
        </button>
      </div>
      <p className="text-posgmuted mb-6">
        Editable straight here — no code changes needed to update the tour&apos;s rules.
      </p>

      {addingOpen && (
        <form
          onSubmit={addSection}
          className="bg-posgcard rounded-xl border border-posgborder p-4 mb-6 flex items-end gap-3"
        >
          <div className="flex-1">
            <label className="block text-xs text-posgmuted mb-1">Section title</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
              placeholder="e.g. Dress Code"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-1.5 bg-fairway text-black font-medium px-3 py-1.5 rounded-md text-sm disabled:opacity-50"
          >
            <Plus size={14} /> {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}

      {error && <p className="text-red-400">{error}</p>}
      {!sections && !error && <p className="text-posgmuted">Loading…</p>}

      {sections && (
        <div className="space-y-4">
          {sections.map((s) => (
            <div key={s.id} className="bg-posgcard rounded-xl border border-posgborder p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gold">{s.section}</h2>
                <button
                  onClick={() => deleteSection(s.id, s.section)}
                  className="text-posgmuted hover:text-red-400"
                  title="Delete section"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                value={drafts[s.id] ?? ''}
                onChange={(e) => setDrafts({ ...drafts, [s.id]: e.target.value })}
                rows={4}
                placeholder={`Write ${s.section.toLowerCase()} here…`}
                className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-2 text-sm text-posgtext"
              />
              <button
                onClick={() => save(s.id)}
                disabled={savingId === s.id}
                className="mt-2 text-sm bg-fairway text-black font-medium px-3 py-1.5 rounded-md hover:bg-fairwaydark hover:text-white transition disabled:opacity-50"
              >
                {savingId === s.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
