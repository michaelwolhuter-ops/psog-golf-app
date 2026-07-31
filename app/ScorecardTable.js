'use client';

import { Fragment } from 'react';
import { strokesReceived, betterBallHolePoints, roundHandicapForStrokes } from '@/lib/scoring';
import { useAdmin } from '@/lib/AdminContext';

// Shared hole-by-hole full-card renderer — originally lived only in
// app/events/[id]/ScorecardsSection.js, extracted 2026-07-3x so the locked
// scorecard entry screen can show the exact same read-only card (own round +
// other groups) via a "View Card" button, without duplicating this table.
// Nothing about the rendering logic changed in the move.

// Tour Handicap shown under each player's name is the rounded whole number
// — same rule strokesReceived() uses for actual stroke allocation — not the
// raw decimal, so it can't imply a different birthday hole than what the
// card above actually applied.
function fmtHcp(n) {
  const r = roundHandicapForStrokes(n);
  return r === null ? '—' : String(r);
}

// Standard scorecard notation, based on gross score vs. par (the traditional
// convention — marks what actually happened on the hole, independent of
// handicap): eagle-or-better = double circle, birdie = single circle,
// par = no mark, bogey = single square, double-bogey-or-worse = double
// square. The "double" versions are faked with a Tailwind `ring` sitting
// just outside a `border`, so no extra nested markup is needed per cell.
// ring-offset-posgcard matters — Tailwind's default ring-offset colour is
// white, which would leave a bright gap on this dark theme otherwise.
function scoreMarkClass(gross, par) {
  if (gross == null || par == null) return '';
  const diff = gross - par;
  if (diff <= -2) return 'rounded-full border border-current ring-1 ring-current ring-offset-1 ring-offset-posgcard';
  if (diff === -1) return 'rounded-full border border-current';
  if (diff === 1) return 'border border-current';
  if (diff >= 2) return 'border border-current ring-1 ring-current ring-offset-1 ring-offset-posgcard';
  return ''; // par — no mark
}

function GrossCell({ value, par, rung }) {
  if (value == null) return <span className="text-posgmuted">–</span>;
  return (
    <span className="inline-flex items-center justify-center gap-0.5">
      <span className={'inline-flex items-center justify-center w-5 h-5 ' + scoreMarkClass(value, par)}>
        {value}
      </span>
      {rung && <span className="text-gold">*</span>}
    </span>
  );
}

// Horizontal, physical-scorecard-style layout — holes run left to right as
// columns (Hole 1-9, OUT, 10-18, IN, then TOTAL/NET/PTS at the very end).
// Each player gets two rows (Gross, Points) rather than a third mostly-blank
// Net row — Net is instead its own trailing column, populated once on the
// Gross row only (round net total), sitting right before the round Points
// total column. Team formats get one combined-points row, positioned
// directly under that team's two players rather than grouped separately at
// the bottom, so their per-hole combined score reads naturally alongside
// the two rows it came from. PTS here is deliberately the raw hole-by-hole
// stableford sum only — the Longest Drive / Closest to the Pin +2 bonus is
// NOT folded in here (Mike's call: bonus display lives on the Event
// Leaderboard only, this table shows what was actually scored on the
// course). See the Order of Merit / event_results note in project memory —
// the bonus is still applied correctly for standings either way, since
// Order of Merit reads event_results directly and computes it independently
// of what any particular page displays.
export function ScorecardTable({ detail }) {
  const { isAdmin } = useAdmin();
  const holes = detail.course.holes;
  const front = holes.filter((h) => h.hole_number <= 9);
  const back = holes.filter((h) => h.hole_number > 9);
  const players = detail.players;
  const isTeamFormat = detail.scorecard.format !== 'individual_stableford';
  const teamNumbers = isTeamFormat
    ? [...new Set(players.map((p) => p.team_number))].filter(Boolean).sort()
    : [];

  const hsByHole = {};
  detail.hole_scores.forEach((hs) => {
    hsByHole[hs.hole_number] = hsByHole[hs.hole_number] || {};
    hsByHole[hs.hole_number][hs.player_id] = hs;
  });

  const columns = [
    ...front.map((h) => ({ type: 'hole', hole: h })),
    { type: 'out' },
    ...back.map((h) => ({ type: 'hole', hole: h })),
    { type: 'in' },
    { type: 'total' }, // round gross total — Gross row only
    { type: 'net' }, // round net total — Gross row only, blank everywhere else
    { type: 'pts' }, // round points/team total — Points and Team rows only
  ];

  function holesFor(col) {
    if (col.type === 'out') return front;
    if (col.type === 'in') return back;
    return holes; // 'total' / 'net' / 'pts' all sum the full round
  }

  function playerHoleScore(playerId, holeNumber) {
    return (hsByHole[holeNumber] || {})[playerId] || null;
  }

  function playerStrokes(player, hole) {
    return strokesReceived(player.tour_handicap, hole.stroke_index);
  }

  function parCell(col) {
    if (col.type === 'hole') return col.hole.par;
    if (col.type === 'net' || col.type === 'pts') return '';
    return holesFor(col).reduce((s, h) => s + h.par, 0);
  }

  function grossRowCell(player, col) {
    if (col.type === 'pts') return '';
    if (col.type === 'hole') {
      const hs = playerHoleScore(player.id, col.hole.hole_number);
      return { value: hs ? hs.gross_score : null, par: col.hole.par, rung: hs?.rung };
    }
    let sum = 0, any = false;
    holesFor(col).forEach((h) => {
      const hs = playerHoleScore(player.id, h.hole_number);
      if (!hs) return;
      any = true;
      sum += col.type === 'net' ? hs.gross_score - playerStrokes(player, h) : hs.gross_score;
    });
    return { value: any ? sum : null };
  }

  function pointsRowCell(player, col) {
    if (col.type === 'total' || col.type === 'net') return null;
    if (col.type === 'hole') {
      const hs = playerHoleScore(player.id, col.hole.hole_number);
      return hs ? hs.stableford_points : null;
    }
    let sum = 0, any = false;
    holesFor(col).forEach((h) => {
      const hs = playerHoleScore(player.id, h.hole_number);
      if (hs) { sum += hs.stableford_points; any = true; }
    });
    return any ? sum : null;
  }

  function teamRowCell(teamNumber, col) {
    if (col.type === 'total' || col.type === 'net') return null;
    const teamPlayerIds = players.filter((p) => p.team_number === teamNumber).map((p) => p.id);
    if (col.type === 'hole') {
      const pts = teamPlayerIds
        .map((pid) => playerHoleScore(pid, col.hole.hole_number)?.stableford_points)
        .filter((v) => v != null);
      if (pts.length === 0) return null;
      return pts.reduce((best, p) => betterBallHolePoints(best, p), 0);
    }
    let sum = 0, any = false;
    holesFor(col).forEach((h) => {
      const pts = teamPlayerIds
        .map((pid) => playerHoleScore(pid, h.hole_number)?.stableford_points)
        .filter((v) => v != null);
      if (pts.length > 0) { sum += pts.reduce((best, p) => betterBallHolePoints(best, p), 0); any = true; }
    });
    return any ? sum : null;
  }

  function colKey(col, i) {
    return col.type === 'hole' ? `h${col.hole.hole_number}` : `${col.type}-${i}`;
  }
  function colLabel(col) {
    if (col.type === 'hole') return col.hole.hole_number;
    return { out: 'OUT', in: 'IN', total: 'TOTAL', net: 'NET', pts: 'PTS' }[col.type];
  }
  const summaryTypes = ['out', 'in', 'total', 'net', 'pts'];
  function colHeaderClass(col) {
    return (
      'px-2 py-1.5 text-center ' +
      (summaryTypes.includes(col.type)
        ? 'font-semibold text-posgtext bg-posgbg/40 border-x border-posgborder/50'
        : 'font-normal')
    );
  }
  function colCellClass(col) {
    return (
      'px-2 py-1 text-center ' +
      (summaryTypes.includes(col.type) ? 'bg-posgbg/40 border-x border-posgborder/50 font-semibold' : '')
    );
  }

  // Team format: walk teams in order, each team's two (or more) players
  // immediately followed by that team's combined row. Individual format:
  // just the players, no team rows at all.
  const teamGroups = isTeamFormat
    ? teamNumbers.map((tn) => ({ tn, members: players.filter((p) => p.team_number === tn) }))
    : [{ tn: null, members: players }];

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-max min-w-full">
        <thead className="text-posgmuted uppercase tracking-wide border-b border-posgborder">
          <tr>
            <th className="px-3 py-1.5 text-left sticky left-0 bg-posgcard whitespace-nowrap">Hole</th>
            {columns.map((col, i) => (
              <th key={colKey(col, i)} className={colHeaderClass(col)}>
                {colLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Par */}
          <tr className="border-b border-posgborder bg-posgbg/20 text-posgmuted">
            <td className="px-3 py-1 sticky left-0 bg-posgcard whitespace-nowrap">Par</td>
            {columns.map((col, i) => (
              <td key={colKey(col, i)} className={colCellClass(col)}>
                {parCell(col)}
              </td>
            ))}
          </tr>

          {teamGroups.map((group) => (
            <Fragment key={group.tn ?? 'individual'}>
              {group.members.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-t border-posgborder/60">
                    <td className="px-3 py-1 text-posgtext font-semibold sticky left-0 bg-posgcard whitespace-nowrap">
                      {p.name}
                      {isTeamFormat && (
                        <span
                          className={
                            'ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-semibold ' +
                            (p.team_number === 1 ? 'bg-fairway/20 text-fairway' : 'bg-gold/20 text-gold')
                          }
                        >
                          T{p.team_number}
                        </span>
                      )}
                      <span className="block text-[10px] font-normal text-posgmuted">
                        Gross · HCP {fmtHcp(p.tour_handicap)}
                      </span>
                    </td>
                    {columns.map((col, i) => {
                      const c = grossRowCell(p, col);
                      return (
                        <td key={colKey(col, i)} className={colCellClass(col)}>
                          {c === '' ? (
                            ''
                          ) : (
                            <GrossCell
                              value={c.value}
                              par={col.type === 'hole' ? col.hole.par : null}
                              rung={c.rung}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-posgborder">
                    <td className="px-3 py-1 text-posgmuted sticky left-0 bg-posgcard whitespace-nowrap">Points</td>
                    {columns.map((col, i) => (
                      <td key={colKey(col, i)} className={colCellClass(col) + ' font-mono text-gold'}>
                        {pointsRowCell(p, col) ?? (col.type === 'total' || col.type === 'net' ? '' : '–')}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}

              {group.tn != null && (
                <tr className="border-b-2 border-posgborder bg-posgbg/20">
                  <td className="px-3 py-1 text-posgtext font-semibold sticky left-0 bg-posgcard whitespace-nowrap">
                    Team {group.tn}
                  </td>
                  {columns.map((col, i) => (
                    <td key={colKey(col, i)} className={colCellClass(col) + ' font-mono text-gold font-semibold'}>
                      {teamRowCell(group.tn, col) ?? (col.type === 'total' || col.type === 'net' ? '' : '–')}
                    </td>
                  ))}
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {isAdmin && (
      <p className="text-[10px] text-posgmuted px-3 py-2">
        ○ birdie · ◎ eagle or better · □ bogey · ◫ double bogey or worse · plain = par (based on gross vs.
        par) · * = picked up (rung) · TOTAL/NET are gross-round figures, PTS is the round&apos;s raw
        stableford total (Longest Drive / Closest to the Pin bonus shown on the Event Leaderboard, not here)
      </p>
      )}
    </div>
  );
}
