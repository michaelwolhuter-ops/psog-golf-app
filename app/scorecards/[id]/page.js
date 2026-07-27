'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Flag,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Trophy,
  Swords,
  RotateCcw,
  Trash2,
  Users2,
  ArrowUpRight,
  Crosshair,
  Repeat2,
} from 'lucide-react';
import {
  strokesReceived,
  resolveHoleScore,
  ringCap,
  betterBallHolePoints,
  matchPlayHoleResult,
  matchStatus,
} from '@/lib/scoring';

const QUICK_TAPS = [
  { label: 'Birdie', offset: -1 },
  { label: 'Par', offset: 0 },
  { label: 'Bogey', offset: 1 },
  { label: 'Double Bogey', offset: 2 },
  { label: 'Triple Bogey', offset: 3 },
];

const FORMAT_LABEL = {
  individual_stableford: 'Individual Stableford',
  better_ball_stableford: 'Better Ball Stableford',
  better_ball_match_play: 'Better Ball Match Play',
};

export default function ScorecardEntryPage() {
  const { id } = useParams();
  const router = useRouter();

  const [scorecard, setScorecard] = useState(null);
  const [course, setCourse] = useState(null);
  const [players, setPlayers] = useState([]);
  const [holeScores, setHoleScores] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const [reopening, setReopening] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [currentHole, setCurrentHole] = useState(1);
  // Draft entry for whichever hole is on screen right now — cleared/reloaded
  // whenever the hole changes. Nothing here is saved until "Confirm & Save"
  // is pressed, on purpose — no silent auto-advance on a stray tap.
  const [draft, setDraft] = useState({}); // player_id -> { gross_score, rung, three_putt }
  const [expandedPlayer, setExpandedPlayer] = useState(null); // player_id with the number pad open

  function load() {
    fetch(`/api/scorecards/${id}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setScorecard(body.scorecard);
        setCourse(body.course);
        setPlayers(body.players);
        setHoleScores(body.hole_scores);

        // Land on the first hole that isn't fully scored yet, so resuming a
        // round picks up where the marker left off rather than hole 1 every time.
        const holesWithAll = new Set();
        const countByHole = {};
        (body.hole_scores || []).forEach((hs) => {
          countByHole[hs.hole_number] = (countByHole[hs.hole_number] || 0) + 1;
        });
        for (let h = 1; h <= 18; h++) {
          if (countByHole[h] === body.players.length) holesWithAll.add(h);
        }
        let firstIncomplete = 1;
        for (let h = 1; h <= 18; h++) {
          if (!holesWithAll.has(h)) {
            firstIncomplete = h;
            break;
          }
          firstIncomplete = h; // all complete — lands on 18
        }
        setCurrentHole(firstIncomplete);
      });
  }

  useEffect(load, [id]);

  const [liveBoard, setLiveBoard] = useState(null);

  // Combined leaderboard across every scorecard in this event (in-progress
  // and completed alike), not just this foursome's own players — lets a
  // marker see how other groups are doing without leaving the entry screen.
  // Collapses to exactly this scorecard's own numbers when it's the only
  // one running for the event. Polled on a timer rather than real-time push
  // — a few seconds' lag is invisible in practice for golf, and it avoids
  // adding a websocket subscription for a ~20-player app.
  function loadLiveBoard(eventId) {
    if (!eventId) return;
    fetch(`/api/events/${eventId}/live-leaderboard`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (!body.error) setLiveBoard(body);
      });
  }

  useEffect(() => {
    if (!scorecard?.event_id) return;
    loadLiveBoard(scorecard.event_id);
    const interval = setInterval(() => loadLiveBoard(scorecard.event_id), 12000);
    return () => clearInterval(interval);
  }, [scorecard?.event_id]);

  const hole = useMemo(
    () => course?.holes?.find((h) => h.hole_number === currentHole),
    [course, currentHole]
  );

  // Whenever the current hole changes, load any already-saved scores for it
  // into the draft so re-visiting a hole shows what's there, editable.
  useEffect(() => {
    if (!hole) return;
    const existing = {};
    holeScores
      .filter((hs) => hs.hole_number === currentHole)
      .forEach((hs) => {
        existing[hs.player_id] = { gross_score: hs.gross_score, rung: hs.rung, three_putt: hs.three_putt };
      });
    setDraft(existing);
    setExpandedPlayer(null);
  }, [currentHole, hole, holeScores]);

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

  if (!scorecard || !course) return <p className="text-posgmuted">Loading…</p>;

  const isTeamFormat = scorecard.format !== 'individual_stableford';
  const isMatchPlay = scorecard.format === 'better_ball_match_play';

  const holesCompleted = new Set();
  const countByHole = {};
  holeScores.forEach((hs) => {
    countByHole[hs.hole_number] = (countByHole[hs.hole_number] || 0) + 1;
  });
  for (let h = 1; h <= 18; h++) {
    if (countByHole[h] === players.length) holesCompleted.add(h);
  }

  function tap(playerId, grossScore) {
    setDraft((d) => ({
      ...d,
      [playerId]: { gross_score: grossScore, rung: false, three_putt: !!d[playerId]?.three_putt },
    }));
    setExpandedPlayer(null);
  }

  function tapRing(playerId) {
    const cap = ringCap(hole.par);
    setDraft((d) => ({
      ...d,
      [playerId]: { gross_score: cap, rung: true, three_putt: !!d[playerId]?.three_putt },
    }));
    setExpandedPlayer(null);
  }

  // Ticking 3 Putt doesn't require a score to already be chosen — a marker
  // might tick it first, then pick the score — so this merges into whatever
  // draft entry exists (or starts a bare one) rather than requiring
  // gross_score to be set already. Kept separate from tap()/tapRing() so
  // toggling it never clobbers a score already chosen for this hole.
  function toggleThreePutt(playerId) {
    setDraft((d) => ({
      ...d,
      [playerId]: { ...(d[playerId] || {}), three_putt: !d[playerId]?.three_putt },
    }));
  }

  // Gated on gross_score specifically (not just "draft entry exists") — a
  // 3 Putt tick alone shouldn't be treated as a complete entry, or Confirm &
  // Save could fire with no real score chosen for that player.
  const allEntered = players.length > 0 && players.every((p) => draft[p.id]?.gross_score != null);

  // Live preview of what will actually be saved — runs the exact same
  // resolveHoleScore() the server uses (2026-07-27 cap rule: max triple
  // bogey, 0 points, whether the marker tapped Ring or just typed in a
  // genuinely bad number like a 10) so the preview never shows a different
  // gross/points than what Confirm & Save is about to write.
  // `rawGross`/`rawRung` are exactly what the marker tapped/typed — used to
  // decide which quick-tap/number-pad button looks "selected", so choosing
  // e.g. a 10 on a par 4 still highlights the "10" button even though the
  // resolved (saved) values below will show the capped 7/0 pts. Quick-taps
  // never exceed the cap (Triple Bogey = par+3 = the cap exactly), so this
  // only matters for the "More…" number pad.
  const preview = players.map((p) => {
    const d = draft[p.id];
    const strokes = strokesReceived(p.tour_handicap, hole.stroke_index);
    if (!d || d.gross_score == null) {
      return {
        player: p,
        gross: null,
        points: null,
        rawGross: null,
        rawRung: false,
        three_putt: !!d?.three_putt,
        strokes,
      };
    }
    const resolved = resolveHoleScore(d.gross_score, hole.par, strokes, !!d.rung);
    return {
      player: p,
      gross: resolved.gross_score,
      points: resolved.stableford_points,
      rung: resolved.rung,
      rawGross: d.gross_score,
      rawRung: !!d.rung,
      strokes,
      three_putt: !!d.three_putt,
    };
  });

  async function confirmAndSave() {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/scorecards/${id}/holes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hole_number: currentHole,
        scores: players.map((p) => ({
          player_id: p.id,
          gross_score: draft[p.id].gross_score,
          rung: !!draft[p.id].rung,
          three_putt: !!draft[p.id].three_putt,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `Save failed (${res.status})`);
      return;
    }
    // Refetch so running totals / hole-picker completion state reflect the save.
    const detail = await fetch(`/api/scorecards/${id}`, { cache: 'no-store' }).then((r) => r.json());
    setHoleScores(detail.hole_scores);
    loadLiveBoard(scorecard.event_id);
    if (currentHole < 18) setCurrentHole(currentHole + 1);
  }

  // Completed rounds are locked server-side (the holes/complete routes both
  // reject writes once status is 'completed') — reopening rolls back exactly
  // what this scorecard wrote (see the reopen route) and flips it back to
  // in_progress so entry works again, without touching any other data.
  async function reopenRound() {
    if (
      !confirm(
        "Reopen this round for editing? This removes the points/team result it fed into this event so you can correct and re-finish it."
      )
    ) {
      return;
    }
    setReopening(true);
    setError('');
    const res = await fetch(`/api/scorecards/${id}/reopen`, { method: 'POST' });
    setReopening(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `Couldn't reopen the round (${res.status})`);
      return;
    }
    load();
  }

  async function deleteScorecard() {
    const verb = scorecard.status === 'completed' ? 'Delete' : 'Abandon';
    if (
      !confirm(
        `${verb} this scorecard? ${
          scorecard.status === 'completed'
            ? "This also removes the points/team result it fed into this event."
            : ''
        } This can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError('');
    const res = await fetch(`/api/scorecards/${id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `Couldn't delete the scorecard (${res.status})`);
      return;
    }
    router.push(`/events/${scorecard.event_id}`);
  }

  async function finishRound() {
    if (!confirm('Finish this round? This writes the results into the event and can\'t be entered here again.')) {
      return;
    }
    setFinishing(true);
    setError('');
    const res = await fetch(`/api/scorecards/${id}/complete`, { method: 'POST' });
    setFinishing(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `Couldn't finish the round (${res.status})`);
      return;
    }
    router.push(`/events/${scorecard.event_id}`);
  }

  let liveMatch = null;
  if (isMatchPlay) {
    const teamA = players.filter((p) => p.team_number === 1).map((p) => p.id);
    const teamB = players.filter((p) => p.team_number === 2).map((p) => p.id);
    const playedHoles = [...holesCompleted].sort((a, b) => a - b);
    const results = playedHoles.map((h) => {
      const rows = holeScores.filter((hs) => hs.hole_number === h);
      const aPts = rows
        .filter((r) => teamA.includes(r.player_id))
        .reduce((best, r) => betterBallHolePoints(best, r.stableford_points), 0);
      const bPts = rows
        .filter((r) => teamB.includes(r.player_id))
        .reduce((best, r) => betterBallHolePoints(best, r.stableford_points), 0);
      return matchPlayHoleResult(aPts, bPts);
    });
    if (results.length > 0) liveMatch = matchStatus(results);
  }

  return (
    <div>
      <Link
        href={`/events/${scorecard.event_id}`}
        className="inline-flex items-center gap-1 text-sm text-posgmuted hover:text-posgtext mb-4"
      >
        <ArrowLeft size={14} /> Back to event
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Flag size={20} className="text-fairway" />
          <h1 className="text-xl font-bold text-posgtext">
            {scorecard.group_label || FORMAT_LABEL[scorecard.format]}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {scorecard.status === 'completed' ? (
            <button
              onClick={reopenRound}
              disabled={reopening}
              className="inline-flex items-center gap-1.5 text-sm bg-posgborder text-posgtext px-3 py-1.5 rounded-md hover:bg-posgcardhover transition disabled:opacity-50"
            >
              <RotateCcw size={14} /> {reopening ? 'Reopening…' : 'Reopen round'}
            </button>
          ) : (
            <button
              onClick={finishRound}
              disabled={finishing || holesCompleted.size === 0}
              className="inline-flex items-center gap-1.5 text-sm bg-gold text-black font-medium px-3 py-1.5 rounded-md hover:brightness-95 transition disabled:opacity-40"
            >
              <Trophy size={14} /> {finishing ? 'Finishing…' : 'Finish Round'}
            </button>
          )}
          <button
            onClick={deleteScorecard}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 text-sm text-posgmuted hover:text-red-400 transition disabled:opacity-50"
            title={scorecard.status === 'completed' ? 'Delete this scorecard' : 'Abandon this round'}
          >
            <Trash2 size={14} /> {deleting ? 'Deleting…' : scorecard.status === 'completed' ? 'Delete' : 'Abandon'}
          </button>
        </div>
      </div>
      <p className="text-posgmuted text-sm mb-4">
        {FORMAT_LABEL[scorecard.format]} · {course.name} · {holesCompleted.size} of 18 holes entered
      </p>

      {scorecard.status === 'completed' && (
        <div className="bg-fairway/10 border border-fairway/30 rounded-xl p-3 mb-6 text-sm text-fairway">
          This round is finished and has already fed its results into the event. Use
          &quot;Reopen round&quot; above to correct a mistake, or view the full card on the
          event page.
        </div>
      )}

      {error && scorecard.status === 'completed' && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      {/* Hole picker — jump to any hole directly, filled once fully entered */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {course.holes.map((h) => {
          const complete = holesCompleted.has(h.hole_number);
          const active = h.hole_number === currentHole;
          return (
            <button
              key={h.hole_number}
              onClick={() => setCurrentHole(h.hole_number)}
              className={
                'w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center transition border ' +
                (active
                  ? 'border-gold text-gold bg-gold/10'
                  : complete
                  ? 'border-fairway/50 bg-fairway/15 text-fairway'
                  : 'border-posgborder text-posgmuted hover:text-posgtext')
              }
            >
              {h.hole_number}
            </button>
          );
        })}
      </div>

      {liveMatch && (
        <div className="bg-posgcard rounded-xl border border-posgborder p-3 mb-6 flex items-center gap-2">
          <Swords size={16} className="text-gold" />
          <span className="text-sm text-posgtext">
            <span className="font-semibold">Team {liveMatch.winningTeam || ''}</span>{' '}
            {liveMatch.label}
            {liveMatch.decided && ' — match decided'}
          </span>
        </div>
      )}

      {/* Current hole — hidden once completed; the server blocks writes
          anyway, and the reopen banner above already explains why. */}
      {scorecard.status !== 'completed' && hole ? (
        <div className="bg-posgcard rounded-xl border border-posgborder p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => currentHole > 1 && setCurrentHole(currentHole - 1)}
              disabled={currentHole === 1}
              className="text-posgmuted hover:text-posgtext disabled:opacity-30"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="text-center">
              <p className="text-xs text-posgmuted uppercase tracking-wide">Hole</p>
              <p className="text-4xl font-bold text-posgtext">{hole.hole_number}</p>
              <p className="text-sm text-posgmuted mt-1">
                Par {hole.par} · Stroke Index {hole.stroke_index}
                {hole.yardage_white ? ` · ${hole.yardage_white}y` : ''}
              </p>
            </div>
            <button
              onClick={() => currentHole < 18 && setCurrentHole(currentHole + 1)}
              disabled={currentHole === 18}
              className="text-posgmuted hover:text-posgtext disabled:opacity-30"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          <div className="space-y-3">
            {preview.map(({ player, gross, points, rung, rawGross, rawRung, strokes, three_putt }) => {
              const s = strokesReceived(player.tour_handicap, hole.stroke_index);
              return (
                <div key={player.id} className="bg-posgbg rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-posgtext">{player.name}</span>
                      {isTeamFormat && (
                        <span
                          className={
                            'text-[10px] px-1.5 py-0.5 rounded font-semibold ' +
                            (player.team_number === 1
                              ? 'bg-fairway/20 text-fairway'
                              : 'bg-gold/20 text-gold')
                          }
                        >
                          Team {player.team_number}
                        </span>
                      )}
                      {s > 0 && (
                        <span className="flex gap-0.5" title={`${s} stroke${s > 1 ? 's' : ''} received`}>
                          {Array.from({ length: s }).map((_, i) => (
                            <CircleDot key={i} size={9} className="text-posgmuted" />
                          ))}
                        </span>
                      )}
                    </div>
                    {gross != null && (
                      <span className="text-xs text-posgmuted">
                        Gross <span className="text-posgtext font-mono">{gross}</span>
                        {rung && (
                          <span className="text-gold ml-1">
                            ({rawGross > gross ? `capped, entered ${rawGross}` : 'rung'})
                          </span>
                        )}
                        {three_putt && <span className="text-posgmuted ml-1">(3 putt)</span>} · Pts{' '}
                        <span className="text-gold font-mono font-semibold">{points}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TAPS.map((qt) => {
                      const value = Math.max(1, hole.par + qt.offset);
                      const selected = rawGross === value && !rawRung;
                      return (
                        <button
                          key={qt.label}
                          onClick={() => tap(player.id, value)}
                          className={
                            'text-xs px-2.5 py-1.5 rounded-md font-medium transition ' +
                            (selected
                              ? 'bg-fairway text-black'
                              : 'bg-posgborder text-posgtext hover:bg-posgcardhover')
                          }
                        >
                          {qt.label} ({value})
                        </button>
                      );
                    })}
                    <button
                      onClick={() =>
                        setExpandedPlayer(expandedPlayer === player.id ? null : player.id)
                      }
                      className="text-xs px-2.5 py-1.5 rounded-md font-medium bg-posgborder text-posgmuted hover:bg-posgcardhover transition"
                    >
                      More…
                    </button>
                    <button
                      onClick={() => tapRing(player.id)}
                      className={
                        'text-xs px-2.5 py-1.5 rounded-md font-medium transition ' +
                        (rung ? 'bg-gold text-black' : 'bg-posgborder text-posgmuted hover:bg-posgcardhover')
                      }
                      title="Picked up without finishing — records triple bogey, 0 pts, automatically"
                    >
                      Ring
                    </button>
                    <button
                      onClick={() => toggleThreePutt(player.id)}
                      className={
                        'inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition ' +
                        (three_putt
                          ? 'bg-posgtext text-posgbg'
                          : 'bg-posgborder text-posgmuted hover:bg-posgcardhover')
                      }
                      title="Tick if this player 3-putted this hole"
                    >
                      <Repeat2 size={12} /> 3 Putt
                    </button>
                  </div>

                  {expandedPlayer === player.id && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-posgborder">
                      {Array.from({ length: hole.par + 5 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => tap(player.id, n)}
                          title={n > ringCap(hole.par) ? `Recorded as ${ringCap(hole.par)}, 0 pts` : undefined}
                          className={
                            'w-8 h-8 rounded-md text-xs font-mono transition ' +
                            (rawGross === n && !rawRung
                              ? 'bg-fairway text-black'
                              : 'bg-posgborder text-posgtext hover:bg-posgcardhover')
                          }
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <button
            onClick={confirmAndSave}
            disabled={!allEntered || saving}
            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 bg-fairway text-black font-semibold px-4 py-2.5 rounded-md text-sm hover:bg-fairwaydark hover:text-white transition disabled:opacity-40"
          >
            <Check size={16} /> {saving ? 'Saving…' : `Confirm & Save Hole ${currentHole}`}
          </button>
        </div>
      ) : scorecard.status !== 'completed' ? (
        <p className="text-posgmuted">This course has no data for hole {currentHole}.</p>
      ) : null}

      {/* Live leaderboard across the WHOLE event — every scorecard, in
          progress or completed, combined. Identical to "just this group"
          when this is the only scorecard running for the event right now.
          Polled on a timer (see loadLiveBoard above) so it keeps moving
          even while this marker isn't the one tapping anything. Styled as
          a real tour leaderboard — POS / PLAYER / THRU / TOTAL — per
          Mike's ask, not a plain list. */}
      <div className="bg-posgcard rounded-xl border border-posgborder p-4 mb-4">
        <h2 className="text-xs font-semibold text-posgmuted uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Trophy size={13} className="text-gold" /> Live Leaderboard — Individual
        </h2>
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
            {liveBoard.individual.map((row, i) => (
              <div
                key={row.player_id}
                className="grid grid-cols-[2rem_1fr_3rem_4rem] gap-2 items-center py-1.5 border-b border-posgborder/40 last:border-0"
              >
                <span
                  className={
                    'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ' +
                    (i === 0 ? 'bg-gold/20 text-gold' : 'text-posgmuted')
                  }
                >
                  {i === 0 ? <Trophy size={12} /> : i + 1}
                </span>
                <span className="text-posgtext text-sm font-semibold truncate">
                  {row.name}
                  {row.longest_drive && (
                    <ArrowUpRight size={12} className="inline text-fairway ml-1" title="Longest Drive" />
                  )}
                  {row.closest_to_pin && (
                    <Crosshair size={12} className="inline text-gold ml-1" title="Closest to the Pin" />
                  )}
                </span>
                <span className="text-posgmuted text-xs font-mono text-center">{row.thru ?? '–'}</span>
                <span className="text-gold font-mono font-bold text-right">{row.overall}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {liveBoard && liveBoard.team.length > 0 && (
        <div className="bg-posgcard rounded-xl border border-posgborder p-4 mb-4">
          <h2 className="text-xs font-semibold text-posgmuted uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Users2 size={13} /> Live Leaderboard — Team
          </h2>
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
                  (i === 0 ? 'bg-gold/20 text-gold' : 'text-posgmuted')
                }
              >
                {i === 0 ? <Trophy size={12} /> : i + 1}
              </span>
              <span className="text-posgtext text-sm font-semibold truncate">
                {t.names}
                {t.group_label ? <span className="text-posgmuted font-normal"> — {t.group_label}</span> : ''}
              </span>
              <span className="text-posgmuted text-xs font-mono text-center">{t.thru ?? '–'}</span>
              <span className="text-gold font-mono font-bold text-right">{t.points}</span>
            </div>
          ))}
        </div>
      )}

      {liveBoard && liveBoard.matches.length > 0 && (
        <div className="bg-posgcard rounded-xl border border-posgborder p-4">
          <h2 className="text-xs font-semibold text-posgmuted uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Swords size={13} className="text-gold" /> Live Matches
          </h2>
          <div className="space-y-1">
            {liveBoard.matches.map((m) => (
              <div key={m.scorecard_id} className="flex items-center justify-between text-sm">
                <span className="text-posgtext">
                  {m.names_a} <span className="text-posgmuted">vs</span> {m.names_b}
                  {m.group_label ? <span className="text-posgmuted"> — {m.group_label}</span> : ''}
                </span>
                <span className="text-gold font-mono font-semibold">
                  {m.winningTeam ? (m.winningTeam === 'A' ? m.names_a : m.names_b) + ' ' : ''}
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
