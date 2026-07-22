'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Flag,
  CheckCircle2,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Trophy,
  Users,
  ListOrdered,
} from 'lucide-react';

const typeLabel = {
  qualifier: 'Qualifier',
  tour_day: 'Tour Day',
};

// Same generic "first letter + trailing number" abbreviation the Order of
// Merit breakdown columns use (app/api/order-of-merit/route.js) — kept in
// sync deliberately so "Qualifier 1" reads as Q1 everywhere in the app, not
// just here. Not imported from there since that file is server-only.
function badgeLabel(name) {
  const num = (name.match(/(\d+)\s*$/) || [])[1] || '';
  const firstLetter = (name.trim().charAt(0) || '?').toUpperCase();
  return firstLetter + num;
}

function badgeStyle(eventType) {
  return eventType === 'tour_day'
    ? 'border-gold/50 bg-gold/10 text-gold'
    : 'border-fairway/50 bg-fairway/10 text-fairway';
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState(null);
  const [qualification, setQualification] = useState([]);
  const [error, setError] = useState('');

  // Reorder chevrons are clutter on every card by default — this gates them
  // behind an explicit "Edit Order" toggle instead, same idea as the event
  // detail page's "Enter Results" toggle (collapsed by default, opened on
  // demand, not yet a real permission since there's no auth).
  const [reorderOpen, setReorderOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('qualifier');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function load() {
    fetch('/api/events', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) setError(body.error);
        else {
          setEvents(body.data);
          setQualification(body.qualification || []);
        }
      });
  }

  useEffect(load, []);

  async function addEvent(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError('');
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, event_type: eventType }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFormError(body.error || 'Something went wrong');
      return;
    }
    setName('');
    setEventType('qualifier');
    setFormOpen(false);
    load();
  }

  // Swaps sort_order with the neighbouring event so the list can be
  // reordered by hand — new events always get added to the end, this is how
  // to move one back to where it actually belongs (e.g. "Qualifier 2" slotting
  // in between Qualifier 1 and Qualifier 3).
  async function moveEvent(index, direction) {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= events.length) return;
    const current = events[index];
    const other = events[otherIndex];
    await Promise.all([
      fetch(`/api/events/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: other.sort_order }),
      }),
      fetch(`/api/events/${other.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: current.sort_order }),
      }),
    ]);
    load();
  }

  const qualified = qualification.filter((q) => q.qualified_for_tour);
  const notYet = qualification
    .filter((q) => !q.qualified_for_tour)
    .filter((q) => q.qualifiers_attended > 0);

  // The first "upcoming" event in sort order is the next thing on the
  // calendar — same rule the Dashboard's Next Event card uses. Highlighted
  // here so the list itself points you at what matters right now.
  const nextEventId = events ? events.find((e) => e.status === 'upcoming')?.id : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Flag size={22} className="text-fairway" />
          <h1 className="text-2xl font-bold text-posgtext">Events &amp; Results</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReorderOpen((v) => !v)}
            className={
              'inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition ' +
              (reorderOpen
                ? 'bg-fairway/15 text-fairway'
                : 'bg-posgborder text-posgtext hover:bg-posgcardhover')
            }
          >
            <ListOrdered size={14} /> {reorderOpen ? 'Done' : 'Edit Order'}
          </button>
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="text-sm bg-fairway text-black font-medium px-3 py-1.5 rounded-md hover:bg-fairwaydark hover:text-white transition"
          >
            {formOpen ? 'Cancel' : '+ Add event'}
          </button>
        </div>
      </div>
      <p className="text-posgmuted mb-4">
        Four qualifiers, then Tour Day 1 and 2. Attend 2 of the 4 qualifiers to make tour.
      </p>

      {/* Season roadmap — a quick-glance strip of every event in order.
          Filled green = done, outlined = still to come, gold ring = tour
          days. Purely visual, click a card below to actually open one. */}
      {events && events.length > 0 && (
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1">
          {events.map((e, i) => (
            <div key={e.id} className="flex items-center gap-1.5 shrink-0">
              <div
                title={e.name}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                  e.status === 'completed'
                    ? 'border-fairway bg-fairway text-black'
                    : badgeStyle(e.event_type) + ' bg-transparent'
                }`}
              >
                {badgeLabel(e.name)}
              </div>
              {i < events.length - 1 && (
                <div
                  className={`w-4 sm:w-6 h-px shrink-0 ${
                    e.status === 'completed' ? 'bg-fairway/50' : 'bg-posgborder'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={addEvent}
          className="bg-posgcard rounded-xl border border-posgborder p-4 mb-6 flex items-end gap-3 flex-wrap"
        >
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-posgmuted mb-1">Event name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
              placeholder="e.g. Qualifier 5"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-posgmuted mb-1">Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
            >
              <option value="qualifier">Qualifier</option>
              <option value="tour_day">Tour Day</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-fairway text-black font-medium px-4 py-1.5 rounded-md text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {formError && <p className="text-red-400 text-sm w-full">{formError}</p>}
          <p className="text-xs text-posgmuted w-full">
            Date, course, format and notes can be filled in from the event page after it's created.
          </p>
        </form>
      )}

      {error && <p className="text-red-400">{error}</p>}
      {!events && !error && <p className="text-posgmuted">Loading…</p>}

      {events && (
        <div className="space-y-3 mb-8">
          {events.map((e, i) => {
            const isNext = e.id === nextEventId;
            return (
              <div
                key={e.id}
                onClick={() => router.push(`/events/${e.id}`)}
                className={`group relative flex items-center gap-3 sm:gap-4 rounded-2xl border p-4 sm:p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 ${
                  isNext
                    ? 'border-gold/40 bg-gradient-to-r from-gold/10 via-posgcard to-posgcard hover:border-gold/70'
                    : 'bg-posgcard border-posgborder hover:border-fairway/50 hover:bg-fairway/5'
                }`}
              >
                {isNext && (
                  <span
                    className={`absolute -top-2 text-[10px] font-extrabold tracking-wide bg-gold text-black px-2 py-0.5 rounded-full ${
                      reorderOpen ? 'left-4 sm:left-16' : 'left-4 sm:left-5'
                    }`}
                  >
                    NEXT UP
                  </span>
                )}

                {reorderOpen && (
                  <div
                    className="flex flex-col -my-1 shrink-0"
                    onClick={(evt) => evt.stopPropagation()}
                  >
                    <button
                      onClick={() => moveEvent(i, -1)}
                      disabled={i === 0}
                      className="text-posgmuted hover:text-posgtext disabled:opacity-20"
                      title="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveEvent(i, 1)}
                      disabled={i === events.length - 1}
                      className="text-posgmuted hover:text-posgtext disabled:opacity-20"
                      title="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                )}

                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-full border-2 flex items-center justify-center font-extrabold text-sm ${badgeStyle(
                    e.event_type
                  )}`}
                >
                  {badgeLabel(e.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-posgtext font-bold text-lg group-hover:text-fairway transition">
                      {e.name}
                    </span>
                    {e.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-fairway">
                        <CheckCircle2 size={13} /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-posgmuted">
                        <Clock size={13} /> Upcoming
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-posgmuted mt-0.5">
                    {typeLabel[e.event_type] || e.event_type} · {e.golf_course || 'Course TBC'} ·{' '}
                    {e.event_date || 'Date TBC'}
                  </div>
                  {e.status === 'completed' &&
                    (e.individual_winner ||
                      (e.team_winner_names && e.team_winner_names.length > 0)) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-2 text-xs">
                        {e.individual_winner && (
                          <span className="inline-flex items-center gap-1 text-gold font-semibold">
                            <Trophy size={13} /> {e.individual_winner}
                          </span>
                        )}
                        {e.team_winner_names && e.team_winner_names.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-posgmuted">
                            <Users size={13} /> {e.team_winner_names.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                </div>

                <ChevronRight
                  size={20}
                  className="text-posgmuted group-hover:text-fairway group-hover:translate-x-1 transition-transform shrink-0"
                />
              </div>
            );
          })}
        </div>
      )}

      {qualification.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-posgtext mb-2">
            Qualified for tour ({qualified.length})
          </h2>
          <div className="bg-posgcard rounded-xl border border-posgborder p-4 mb-6">
            {qualified.length === 0 ? (
              <p className="text-posgmuted text-sm">Nobody yet — need 2 qualifiers attended.</p>
            ) : (
              <ul className="text-sm grid sm:grid-cols-2 gap-1 text-posgtext">
                {qualified.map((q) => (
                  <li key={q.player_id}>
                    {q.name} — {q.qualifiers_attended} attended
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notYet.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-posgtext mb-2">On the way</h2>
              <div className="bg-posgcard rounded-xl border border-posgborder p-4">
                <ul className="text-sm grid sm:grid-cols-2 gap-1 text-posgmuted">
                  {notYet.map((q) => (
                    <li key={q.player_id}>
                      {q.name} — {q.qualifiers_attended} of 2 needed
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
