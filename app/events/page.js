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
import { useAdmin } from '@/lib/AdminContext';

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
  const { isAdmin } = useAdmin();
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
        {isAdmin && (
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
        )}
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

      {isAdmin && formOpen && (
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
            // A round is actually being played right now — this is the
            // state Mike wants jumping off the page, since it's the one
            // thing on this list that needs a tap *today*, not "someday
            // soon" (that's what NEXT UP already covers) or "already done."
            const isLive = e.status === 'in_progress';
            const isCompleted = e.status === 'completed';
            // Bolder pass, 2026-07-31 — Mike wants the whole card themed by
            // status, not just the small pill: red for live, gold for next
            // up, green for completed, grey for everything else still
            // upcoming. Same pattern as isLive/isNext already used (tinted
            // gradient background, matching border colour, matching badge
            // ring, matching accent bar) — just extended to the two states
            // that were previously left plain. Event type (Qualifier/Tour
            // Day) still shows via the badge letter and the text line below
            // the name, it just no longer drives card colour.
            const accentBar = isCompleted ? 'bg-fairway' : 'bg-slate-400';
            return (
              <div key={e.id} className="group relative">
                {isLive && (
                  <span
                    className={`absolute -top-2.5 z-10 inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wide bg-red-500 text-white px-2 py-0.5 rounded-full ${
                      reorderOpen ? 'left-4 sm:left-16' : 'left-4 sm:left-5'
                    }`}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                    </span>
                    LIVE NOW
                  </span>
                )}
                {isNext && !isLive && (
                  <span
                    className={`absolute -top-2 z-10 text-[10px] font-extrabold tracking-wide bg-gold text-black px-2 py-0.5 rounded-full ${
                      reorderOpen ? 'left-4 sm:left-16' : 'left-4 sm:left-5'
                    }`}
                  >
                    NEXT UP
                  </span>
                )}

                <div
                  onClick={() => router.push(`/events/${e.id}`)}
                  className={`relative overflow-hidden flex items-center gap-3 sm:gap-4 rounded-2xl border-2 p-4 sm:p-5 pl-5 sm:pl-6 cursor-pointer transition-all shadow-md hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 ${
                    isLive
                      ? 'border-red-500/60 bg-gradient-to-r from-red-500/15 via-posgcard to-posgcard shadow-red-500/10 hover:border-red-500/80'
                      : isNext
                      ? 'border-gold/50 bg-gradient-to-r from-gold/10 via-posgcard to-posgcard hover:border-gold/70'
                      : isCompleted
                      ? 'border-fairway/45 bg-gradient-to-r from-fairway/10 via-posgcard to-posgcard hover:border-fairway/65'
                      : 'border-slate-400/35 bg-gradient-to-r from-slate-500/10 via-posgcard to-posgcard hover:border-slate-400/55'
                  }`}
                >
                  {!isLive && !isNext && (
                    <span className={`absolute inset-y-0 left-0 w-1.5 ${accentBar}`} />
                  )}

                  {isAdmin && reorderOpen && (
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
                    className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full border-2 flex items-center justify-center font-extrabold text-base ${
                      isLive
                        ? 'border-red-500 bg-red-500/15 text-red-400'
                        : isCompleted
                        ? 'border-fairway bg-fairway/15 text-fairway'
                        : 'border-slate-400 bg-slate-500/15 text-slate-300'
                    }`}
                  >
                    {badgeLabel(e.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-extrabold transition ${
                          isLive
                            ? 'text-posgtext text-xl sm:text-2xl group-hover:text-red-400'
                            : 'text-posgtext text-xl group-hover:text-fairway'
                        }`}
                      >
                        {e.name}
                      </span>
                      {e.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-extrabold tracking-wide text-black bg-fairway px-3 py-1 rounded-full">
                          <CheckCircle2 size={15} /> COMPLETED
                        </span>
                      ) : isLive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-red-400 bg-red-500/15 tracking-wide px-2 py-0.5 rounded-full">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                          </span>
                          IN PROGRESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-extrabold tracking-wide text-slate-200 bg-slate-500/40 border border-slate-400/40 px-3 py-1 rounded-full">
                          <Clock size={15} /> UPCOMING
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-posgmuted mt-1 font-medium">
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
                    size={22}
                    className="text-posgmuted group-hover:text-fairway group-hover:translate-x-1 transition-transform shrink-0"
                  />
                </div>
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
