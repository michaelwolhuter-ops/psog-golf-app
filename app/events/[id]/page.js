'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ScorecardsSection from './ScorecardsSection';
import { DominationBoard } from '@/app/DominationBoard';
import { MatchCard } from '@/app/MatchCard';
import { useConfirm } from '@/lib/useConfirm';
import { useAdmin } from '@/lib/AdminContext';
import { useTopBarLabel } from '@/lib/TopBarContext';
import {
  ArrowLeft,
  Flag,
  Trash2,
  Trophy,
  ArrowUpRight,
  Crosshair,
  Award,
  ClipboardEdit,
  ClipboardList,
  Swords,
  Users2,
  Repeat2,
  Frown,
  AlertTriangle,
  Shirt,
} from 'lucide-react';

const typeLabel = { qualifier: 'Qualifier', tour_day: 'Tour Day' };

const FORMAT_OPTIONS = [
  'Individual Stableford',
  'Better Ball Stableford',
  'Better Ball Match Play',
  'Scramble',
  'American Scramble',
];

// Status is auto-derived server-side from this event's scorecards (see
// lib/eventStatus.js) — this is display-only, never an input.
// "Final Results" instead of a plain "Completed" badge, per Mike's ask
// (2026-09-17) — the event name + this badge is meant to read as its own
// clean little header ("Bogey Invitational — Final Results"), not just a
// generic status word, once every scorecard is in.
const STATUS_LABEL = { upcoming: 'Upcoming', in_progress: 'In Progress', completed: 'Final Results' };
const STATUS_STYLE = {
  upcoming: 'bg-posgborder text-posgmuted',
  in_progress: 'bg-gold/15 text-gold',
  completed: 'bg-fairway/15 text-fairway',
};

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
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({}); // player_id -> { points, longest_drive, closest_to_pin }
  const [meta, setMeta] = useState({});
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [metaError, setMetaError] = useState('');

  // Closed by default. Holds ONLY the event details form now (name, date,
  // course, format, notes) — manual points/team entry was retired
  // entirely once digital scorecards + the live leaderboard took over
  // actual scoring (Mike's call, 2026-07-25). Once real auth exists, this
  // becomes an actual admin-only gate instead of something anyone can just
  // click open.
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Separate toggle for the two things a digital scorecard can never
  // capture on its own (LD/CTP/Countback), so ticking one doesn't require
  // opening the full event-details form.
  const [bonusOpen, setBonusOpen] = useState(false);

  const { confirm, ConfirmDialog } = useConfirm();
  const { isAdmin } = useAdmin();
  const { setLabel: setTopBarLabel } = useTopBarLabel();

  // While an event is actually live, a non-admin viewer's header is
  // stripped down to just the New Scorecard button (Mike's ask,
  // 2026-09-17) — the event name moves up into AppShell's top bar instead
  // of disappearing, same pattern as the scorecard entry screen. Once the
  // event isn't live (upcoming, or Final Results), the full header comes
  // back for reference — "the headings can come back for info later on" —
  // so this only overrides the top bar during that one live window.
  useEffect(() => {
    if (event && !isAdmin && event.status === 'in_progress') {
      setTopBarLabel(event.name);
    } else {
      setTopBarLabel(null);
    }
    return () => setTopBarLabel(null);
  }, [event, isAdmin, setTopBarLabel]);

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
        const f = {};
        body.players.forEach((p) => {
          const r = body.results.find((res) => res.player_id === p.id);
          f[p.id] = {
            points: r ? r.points : '',
            longest_drive: r ? r.longest_drive : false,
            closest_to_pin: r ? r.closest_to_pin : false,
            tutu: r ? r.tutu : false,
          };
        });
        setForm(f);
      });
  }

  useEffect(load, [id]);

  const [liveBoard, setLiveBoard] = useState(null);

  // Same live leaderboard the scorecard entry screen uses — reads straight
  // from hole_scores across every scorecard for this event (in-progress and
  // completed alike), so this shows real standings the moment scoring
  // starts, not "no results yet" until every group finishes. Polled so it
  // keeps moving while just sitting on this page watching.
  function loadLiveBoard() {
    fetch(`/api/events/${id}/live-leaderboard`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (!body.error) setLiveBoard(body);
      });
  }

  useEffect(() => {
    loadLiveBoard();
    const interval = setInterval(loadLiveBoard, 12000);
    return () => clearInterval(interval);
  }, [id]);

  // Course list for the picker — separate from the event itself, loaded
  // once. Courses are a shared library (Noodsburg etc.), not per-event data.
  useEffect(() => {
    fetch('/api/courses', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => setCourses(body.data || []));
  }, []);

  function setField(playerId, field, value) {
    setForm((f) => ({ ...f, [playerId]: { ...f[playerId], [field]: value } }));
  }

  // Picking a saved course sets course_id (which will eventually link this
  // event to real hole-by-hole data for the scorecard) and auto-fills the
  // existing free-text golf_course field with the course name, so every
  // other page that just displays event.golf_course keeps working untouched.
  // "— Type manually —" clears course_id but leaves the text field alone.
  function selectCourse(courseId) {
    if (!courseId) {
      setMeta((m) => ({ ...m, course_id: null }));
      return;
    }
    const course = courses.find((c) => c.id === courseId);
    setMeta((m) => ({ ...m, course_id: courseId, golf_course: course ? course.name : m.golf_course }));
  }

  // Longest Drive and Closest to the Pin save themselves immediately on
  // click, rather than waiting for the batch "Save results" button — these
  // are quick tick-and-move-on calls made while walking the table, and it's
  // easy to tick one then get pulled away before hitting Save, silently
  // losing it. Points stays batch-only, since that's typed entry across the
  // whole table that naturally ends with one deliberate "Save results"
  // click. (Countback used to live here too, as a manual tick — replaced
  // 2026-09-18 by automatic countback off the real scorecard, see
  // lib/countback.js, so there's nothing left to save by hand.)
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

  // The Tutu ("last player to not get passed by the ladies") is a single
  // manual pick per event, Mike's call — not derived from scores at all, so
  // unlike Longest Drive/CTP/Countback (independent per-player flags), this
  // one enforces "at most one player at a time" itself: picking a new
  // player also clears whoever held it before, in the same request. Ticking
  // the current holder again clears it back to nobody, since "if any" means
  // zero is a valid state too.
  async function saveTutu(playerId) {
    const v = form[playerId] || {};
    if (v.points === '' || v.points === null || v.points === undefined) {
      // No result yet for this player — nothing to attach the award to.
      return;
    }
    const newValue = !v.tutu;
    const previousHolderId = Object.keys(form).find(
      (pid) => pid !== playerId && form[pid]?.tutu
    );

    const results = [
      {
        player_id: playerId,
        points: v.points,
        longest_drive: v.longest_drive,
        closest_to_pin: v.closest_to_pin,
        tutu: newValue,
      },
    ];
    if (previousHolderId) {
      const prevV = form[previousHolderId] || {};
      results.push({
        player_id: previousHolderId,
        points: prevV.points,
        longest_drive: prevV.longest_drive,
        closest_to_pin: prevV.closest_to_pin,
        tutu: false,
      });
    }

    setField(playerId, 'tutu', newValue);
    if (previousHolderId) setField(previousHolderId, 'tutu', false);

    setResultsError('');
    const res = await fetch(`/api/events/${id}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setResultsError(body.error || `Save failed (${res.status}) — reverted.`);
      load(); // pull back the real saved state rather than leave a lie on screen
      return;
    }
    setSavedAt(new Date());
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

  async function deleteEvent() {
    if (
      !(await confirm(
        `Delete "${event.name}"? This also removes all its results. This can't be undone.`,
        { confirmLabel: 'Delete event' }
      ))
    ) {
      return;
    }
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    router.push('/events');
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

  // Day-of Awards — deliberately restricted to players whose round is fully
  // finished (thru === 'F'), not just whatever's entered so far. A
  // mid-round player can't fairly be "Last Place" (fewer holes played means
  // fewer points, not necessarily worse golf) or excluded from the Hundreds
  // Club just because they haven't gone over 100 yet at hole 12. Mike's
  // call, 2026-08-07.
  const finishedPlayers = liveBoard ? liveBoard.individual.filter((r) => r.thru === 'F') : [];

  const maxThreePutts = finishedPlayers.length
    ? Math.max(...finishedPlayers.map((r) => r.three_putts || 0))
    : 0;
  const threePuttLeaders = maxThreePutts > 0
    ? finishedPlayers.filter((r) => (r.three_putts || 0) === maxThreePutts)
    : [];

  const lastPlacePoints = finishedPlayers.length > 1
    ? Math.min(...finishedPlayers.map((r) => r.overall))
    : null;
  const lastPlacePlayers = lastPlacePoints !== null
    ? finishedPlayers.filter((r) => r.overall === lastPlacePoints)
    : [];

  const hundredsClub = finishedPlayers
    .filter((r) => (r.gross_total || 0) >= 100)
    .sort((a, b) => b.gross_total - a.gross_total);

  // Gross Leaderboard — stroke play ranking (lowest total gross wins),
  // deliberately NOT part of the live-updating board above: only ever
  // rendered once event.status === 'completed' (every scorecard for this
  // event is done — see lib/eventStatus.js), so by the time it's visible
  // at all, the numbers behind it are already final. Mike's ask
  // (2026-08-07): not a running "gross so far" table, a final result only.
  // gross_total > 0 filters out players whose result was entered manually
  // with no scorecard at all — they have no real hole-by-hole gross to
  // rank (see live-leaderboard route's grossTotalByPlayer, which only ever
  // sums actual hole_scores rows).
  const grossBoard = liveBoard
    ? liveBoard.individual
        .filter((r) => (r.gross_total || 0) > 0)
        .sort((a, b) => a.gross_total - b.gross_total)
    : [];

  // The Tutu is a manual pick, not a computed stat, so it deliberately
  // isn't filtered to finishedPlayers like the three above — Mike can name
  // it as soon as it happens, mid-round, same as Longest Drive/CTP.
  const tutuPlayer = liveBoard ? liveBoard.individual.find((r) => r.tutu) || null : null;

  const hasAwards =
    threePuttLeaders.length > 0 || lastPlacePlayers.length > 0 || hundredsClub.length > 0 || !!tutuPlayer;

  // While the event is actually live, a non-admin viewer gets none of the
  // header below — name, type/status badges, all of it — just the New
  // Scorecard button, per Mike's ask (2026-09-17): "in viewer mode there
  // doesn't need to be any heading... just new scorecard button." The
  // event name still shows up top, just moved into AppShell's top bar (see
  // the useTopBarLabel effect above). Once the event isn't live anymore
  // (upcoming, or Final Results), the full header is back — "the headings
  // can come back for info later on."
  const liveViewerMode = !isAdmin && event.status === 'in_progress';

  // True the moment any hole has been saved for any scorecard in this event
  // — liveBoard.individual only ever gains an entry once a player has at
  // least one hole_scores row (or, for a manual-only entry, a points value
  // on record). Once this flips true, non-admins have nothing left to start
  // — every group that's going to play has already tapped New Scorecard —
  // so the button disappears for them; they're viewers from here on.
  // Admins keep it always, for a late correction.
  const holeScoringStarted = !!(liveBoard && liveBoard.individual.length > 0);

  return (
    <div>
      {ConfirmDialog}
      {liveViewerMode ? (
        !holeScoringStarted && (
        <Link
          href={`/events/${id}/scorecard/new`}
          className="inline-flex items-center gap-1.5 text-sm bg-fairway/15 text-fairway border border-fairway/30 px-3 py-2 rounded-md hover:bg-fairway/25 transition mb-4"
          title="Digital hole-by-hole scorecard — feeds results in automatically once completed"
        >
          <ClipboardList size={14} /> New Scorecard
        </Link>
        )
      ) : (
        <>
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-posgborder text-posgmuted">
                {typeLabel[event.event_type] || event.event_type}
              </span>
              <span
                className={'text-xs px-2 py-0.5 rounded-full ' + (STATUS_STYLE[event.status] || STATUS_STYLE.upcoming)}
                title="Set automatically from this event's scorecards — not editable by hand"
              >
                {STATUS_LABEL[event.status] || event.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Once an event is Final Results, or once any hole has been
                  scored anywhere in it, starting another scorecard is an
                  admin correction, not something a player does — hidden for
                  non-admins here, same "clean, no clutter once it's done"
                  principle as the rest of this page. */}
              {(isAdmin || (event.status !== 'completed' && !holeScoringStarted)) && (
              <Link
                href={`/events/${id}/scorecard/new`}
                className="inline-flex items-center gap-1.5 text-sm bg-fairway/15 text-fairway border border-fairway/30 px-3 py-1.5 rounded-md hover:bg-fairway/25 transition"
                title="Digital hole-by-hole scorecard — feeds results in automatically once completed"
              >
                <ClipboardList size={14} /> New Scorecard
              </Link>
              )}
              {isAdmin && (
              <button
                onClick={() => setDetailsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm bg-posgborder text-posgtext px-3 py-1.5 rounded-md hover:bg-posgcardhover transition"
              >
                <ClipboardEdit size={14} /> {detailsOpen ? 'Hide Details' : 'Edit Event Details'}
              </button>
              )}
              {isAdmin && (
              <button
                onClick={deleteEvent}
                className="inline-flex items-center gap-1.5 text-sm text-posgmuted hover:text-red-400 transition"
              >
                <Trash2 size={14} /> Delete event
              </button>
              )}
            </div>
          </div>
        </>
      )}
      {isAdmin && detailsOpen && (
      <form
        onSubmit={saveMeta}
        className="bg-posgcard rounded-xl border border-posgborder p-5 mb-8 grid sm:grid-cols-2 gap-4"
      >
        <div className="sm:col-span-2">
          <label className="block text-xs text-posgmuted mb-1">Name</label>
          <input
            value={meta.name || ''}
            onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            placeholder="e.g. Qualifier 3"
            className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
          />
        </div>
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
          <label className="block text-xs text-posgmuted mb-1">Course</label>
          <select
            value={meta.course_id || ''}
            onChange={(e) => selectCourse(e.target.value)}
            className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext mb-1.5"
          >
            <option value="">— Type course name manually —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {meta.course_id ? (
            <>
              {/* Locked to whichever course is picked — always derived live
                  from the courses list + meta.course_id, never a
                  separately-typed copy that could go stale or show blank
                  while a course is set. */}
              <input
                value={courses.find((c) => c.id === meta.course_id)?.name || ''}
                readOnly
                className="w-full bg-posgbg/50 border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgmuted cursor-not-allowed mb-1.5"
              />
              <Link
                href={`/courses/${meta.course_id}`}
                className="text-xs text-fairway hover:underline"
              >
                View scorecard →
              </Link>
            </>
          ) : (
          <input
            value={meta.golf_course || ''}
            onChange={(e) => setMeta({ ...meta, golf_course: e.target.value })}
            placeholder="Golf course name"
            className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
          />
          )}
        </div>
        <div>
          <label className="block text-xs text-posgmuted mb-1">Format</label>
          <select
            value={meta.format || ''}
            onChange={(e) => setMeta({ ...meta, format: e.target.value })}
            className="w-full bg-posgbg border border-posgborder rounded-md px-3 py-1.5 text-sm text-posgtext"
          >
            <option value="">— Select format —</option>
            {FORMAT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-posgmuted mb-1">Status</label>
          <p className="text-sm text-posgtext px-3 py-1.5">
            {STATUS_LABEL[event.status] || event.status}{' '}
            <span className="text-xs text-posgmuted">— set automatically from scorecards</span>
          </p>
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
      )}

      {/* No more generic "Event Leaderboard" umbrella heading (Mike's ask,
          2026-09-17 — "clean is what I'm looking for", no filler wrapper
          text). Just "Final Results" once the event is done, or "Live
          Standings" with the pulsing LIVE pill while it's still on, then
          straight into whichever leaderboards actually apply to this
          event's format(s) — Domination only for Better Ball Match Play,
          Team only for Better Ball Stableford, Individual and Gross for
          everything. Same structure every format, nothing hidden behind a
          link — this page IS the results screen now. */}
      <div className="flex items-center justify-between mt-2 mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-gold" />
          <h2 className="text-lg font-semibold text-posgtext">
            {event.status === 'completed' ? 'Final Results' : 'Live Standings'}
          </h2>
        </div>
        {event.status === 'in_progress' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-400 tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {/* Live Match Status — every match as the same card shown inside a
          scorecard's "Other Matches" section, so a viewer who never opens
          a scorecard can still see exactly how every match stands. Kept
          visible after the event finishes too (Mike's ask, 2026-09-17) —
          each card just naturally reads its final "Won 4 & 3" result
          instead of a running score once finished. */}
      {liveBoard && liveBoard.matches.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-posgmuted uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Swords size={13} className="text-gold" /> Matches
          </h3>
          {/* grid-cols-1 explicit, not just the bare `grid` class — see
              MatchCard.js / scorecards page for why this matters
              (2026-09-17 mobile overflow fix). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {liveBoard.matches.map((m) => (
              <MatchCard key={m.scorecard_id} match={m} />
            ))}
          </div>
        </div>
      )}

      {liveBoard && liveBoard.matches.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-posgmuted uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Swords size={13} className="text-gold" /> Matchplay Leaderboard
          </h3>
          <DominationBoard domination={liveBoard.domination || []} />
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xs font-semibold text-posgmuted uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Trophy size={13} className="text-gold" /> Individual
        </h3>
        <div className="bg-posgcard rounded-xl border border-posgborder p-4">
        {!liveBoard ? (
          <p className="text-posgmuted text-sm">Loading…</p>
        ) : liveBoard.individual.length === 0 ? (
          <p className="text-posgmuted text-sm">No scores entered yet.</p>
        ) : (
          <div>
            <div className="grid grid-cols-[2rem_1fr_3rem_4rem] gap-2 text-[10px] text-posgmuted uppercase tracking-wide px-1 pb-1.5 border-b border-posgborder">
              <span>Pos</span>
              <span>Player</span>
              <span className="text-center">Thru</span>
              <span className="text-right">Total</span>
            </div>
            {liveBoard.individual.map((row, i) => {
              const isLast = i === liveBoard.individual.length - 1 && liveBoard.individual.length > 1;
              return (
              <div
                key={row.player_id}
                className="grid grid-cols-[2rem_1fr_3rem_4rem] gap-2 items-center py-1.5 border-b border-posgborder/40 last:border-0"
              >
                <span
                  className={
                    'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ' +
                    (i === 0 ? 'bg-gold/20 text-gold' : 'text-posgmuted')
                  }
                  title={isLast ? 'Last place' : undefined}
                >
                  {i === 0 ? <Trophy size={12} /> : isLast ? '💩' : i + 1}
                </span>
                <span className="text-posgtext text-sm font-semibold truncate">
                  {row.name}
                  {row.longest_drive && (
                    <ArrowUpRight size={12} className="inline text-fairway ml-1" title="Longest Drive" />
                  )}
                  {row.closest_to_pin && (
                    <Crosshair size={12} className="inline text-gold ml-1" title="Closest to the Pin" />
                  )}
                  {row.countback_win && (
                    <Award size={12} className="inline text-posgmuted ml-1" title={row.countback_label} />
                  )}
                </span>
                <span className="text-posgmuted text-xs font-mono text-center">{row.thru ?? '–'}</span>
                <span className="text-gold font-mono font-bold text-right">{row.overall}</span>
              </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {liveBoard && liveBoard.team.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-posgmuted uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Users2 size={13} /> Team
          </h3>
          <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div className="grid grid-cols-[2rem_1fr_3rem_4rem] gap-2 text-[10px] text-posgmuted uppercase tracking-wide px-1 pb-1.5 border-b border-posgborder">
            <span>Pos</span>
            <span>Team</span>
            <span className="text-center">Thru</span>
            <span className="text-right">Total</span>
          </div>
          {liveBoard.team.map((t, i) => (
            <div
              key={`${t.scorecard_id}-${t.team_number}`}
              className="grid grid-cols-[2rem_1fr_3rem_4rem] gap-2 items-center py-1.5 border-b border-posgborder/40 last:border-0"
            >
              <span
                className={
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ' +
                  (t.position === 1 ? 'bg-gold/20 text-gold' : 'text-posgmuted')
                }
              >
                {t.position === 1 ? <Trophy size={12} /> : t.position}
              </span>
              <span className="text-posgtext text-sm font-semibold truncate">
                {t.names}
                {t.countback_win && (
                  <Award size={12} className="inline text-posgmuted ml-1" title={t.countback_label} />
                )}
                {t.group_label ? <span className="text-posgmuted font-normal"> — {t.group_label}</span> : ''}
              </span>
              <span className="text-posgmuted text-xs font-mono text-center">{t.thru ?? '–'}</span>
              <span className="text-right">
                <span className="text-gold font-mono font-bold">{t.points}</span>
                {t.bonus_label && (
                  <span className="block text-fairway text-[10px] font-mono leading-tight">
                    {t.bonus_label}
                  </span>
                )}
              </span>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Gross Leaderboard — see grossBoard above. Not live: gated on the
          whole event being completed, not shown or updated while any round
          is still in progress. */}
      {event.status === 'completed' && grossBoard.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-posgmuted uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Flag size={13} className="text-gold" /> Gross Leaderboard
          </h3>
          <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div>
            <div className="grid grid-cols-[2rem_1fr_4rem] gap-2 text-[10px] text-posgmuted uppercase tracking-wide px-1 pb-1.5 border-b border-posgborder">
              <span>Pos</span>
              <span>Player</span>
              <span className="text-right">Gross</span>
            </div>
            {grossBoard.map((r, i) => (
              <div
                key={r.player_id}
                className="grid grid-cols-[2rem_1fr_4rem] gap-2 items-center py-1.5 border-b border-posgborder/40 last:border-0"
              >
                <span
                  className={
                    'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ' +
                    (i === 0 ? 'bg-gold/20 text-gold' : 'text-posgmuted')
                  }
                >
                  {i === 0 ? <Trophy size={12} /> : i + 1}
                </span>
                <span className="text-posgtext text-sm font-semibold truncate">{r.name}</span>
                <span className="text-gold font-mono font-bold text-right">{r.gross_total}</span>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {/* Awards — Most 3-Putts, Last Place, Hundreds Club. Finished-rounds-only
          (see finishedPlayers above), so this section stays empty until at
          least one scorecard is actually done, rather than showing
          misleading mid-round "leaders". Placed after Team, before Matches,
          per Mike's ask (2026-08-07). */}
      {hasAwards && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-posgmuted uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Award size={13} className="text-gold" /> Awards
          </h3>
          <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {threePuttLeaders.length > 0 && (
              <div className="bg-posgbg rounded-lg p-3">
                <p className="text-[10px] text-posgmuted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Repeat2 size={11} /> Most 3-Putts
                </p>
                {threePuttLeaders.map((r) => (
                  <p key={r.player_id} className="text-sm text-posgtext font-semibold">
                    {r.name}{' '}
                    <span className="text-posgmuted font-mono font-normal">
                      ({r.three_putts})
                    </span>
                  </p>
                ))}
              </div>
            )}
            {lastPlacePlayers.length > 0 && (
              <div className="bg-posgbg rounded-lg p-3">
                <p className="text-[10px] text-posgmuted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Frown size={11} /> Last Place
                </p>
                {lastPlacePlayers.map((r) => (
                  <p key={r.player_id} className="text-sm text-posgtext font-semibold">
                    {r.name}{' '}
                    <span className="text-posgmuted font-mono font-normal">
                      ({r.overall} pts)
                    </span>
                  </p>
                ))}
              </div>
            )}
            {hundredsClub.length > 0 && (
              <div className="bg-posgbg rounded-lg p-3">
                <p className="text-[10px] text-posgmuted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} /> Hundreds Club
                </p>
                {hundredsClub.map((r) => (
                  <p key={r.player_id} className="text-sm text-posgtext font-semibold">
                    {r.name}{' '}
                    <span className="text-posgmuted font-mono font-normal">
                      ({r.gross_total})
                    </span>
                  </p>
                ))}
              </div>
            )}
            {tutuPlayer && (
              <div className="bg-posgbg rounded-lg p-3">
                <p className="text-[10px] text-posgmuted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Shirt size={11} /> The Tutu
                </p>
                <p className="text-sm text-posgtext font-semibold">{tutuPlayer.name}</p>
              </div>
            )}
          </div>
          </div>
        </div>
      )}


      {/* The actual played scorecards for this event, hole by hole — shown
          below the standings now (was above until 2026-07-29). */}
      <ScorecardsSection eventId={id} />

      {/* Longest Drive / Closest to the Pin / The Tutu — a scorecard never
          captures these on its own, so this stays a manual step regardless
          of whether a player's points came from a scorecard or were typed
          in directly. Admin-only — these are committee calls, not something
          players record about themselves. (Countback used to live here too
          as a manual tick — replaced 2026-09-18 by automatic countback off
          the real scorecard, see lib/countback.js.) */}
      {isAdmin && (
      <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold text-posgtext flex items-center gap-2">
          <Award size={17} className="text-gold" /> Longest Drive / Closest to the Pin / The Tutu
        </h2>
        <button
          onClick={() => setBonusOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm bg-posgborder text-posgtext px-3 py-1.5 rounded-md hover:bg-posgcardhover transition"
        >
          {bonusOpen ? 'Hide' : 'Enter'}
        </button>
      </div>

      {bonusOpen && (
        <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto mb-8">
          {savedAt && (
            <p className="text-xs text-posgmuted px-4 pt-3">Saved {savedAt.toLocaleTimeString()}</p>
          )}
          {resultsError && <p className="text-red-400 text-sm px-4 pt-3">{resultsError}</p>}
          <table className="w-full text-sm">
            <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-center w-32">Longest Drive</th>
                <th className="px-4 py-3 text-center w-32">Closest to the Pin</th>
                <th className="px-4 py-3 text-center w-24">The Tutu</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const hasResult = form[p.id]?.points !== '' && form[p.id]?.points !== null && form[p.id]?.points !== undefined;
                return (
                  <tr key={p.id} className="border-b border-posgborder last:border-0">
                    <td className="px-4 py-2 text-posgtext">
                      {p.name}
                      {!hasResult && (
                        <span className="block text-[10px] text-posgmuted">No result yet — enter a score first</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        disabled={!hasResult}
                        checked={!!form[p.id]?.longest_drive}
                        onChange={(e) => saveResultField(p.id, 'longest_drive', e.target.checked)}
                        className="accent-fairway w-4 h-4 disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        disabled={!hasResult}
                        checked={!!form[p.id]?.closest_to_pin}
                        onChange={(e) => saveResultField(p.id, 'closest_to_pin', e.target.checked)}
                        className="accent-fairway w-4 h-4 disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        disabled={!hasResult}
                        checked={!!form[p.id]?.tutu}
                        onChange={() => saveTutu(p.id)}
                        className="accent-fairway w-4 h-4 disabled:opacity-30"
                        title="Last player to not get passed by the ladies — only one player can hold this at a time, ticking a new one clears the last"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

    </div>
  );
}
