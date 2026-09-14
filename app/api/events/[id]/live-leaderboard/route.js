import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { betterBallHolePoints, matchPlayHoleResult, matchStatus } from "@/lib/scoring";

export const dynamic = "force-dynamic";

// One combined leaderboard for the whole event, live — meant to be polled
// from the scorecard entry screen while several groups are out on the
// course at once. Deliberately does NOT read event_results/event_teams for
// anyone who has a scorecard: it sums hole_scores directly instead, for
// BOTH in-progress and completed scorecards, using the exact same formula
// either way. This is safe (not a second source of truth) because
// hole_scores rows are never deleted or altered by completing a scorecard
// — /complete just copies their sum into event_results/event_teams once.
// Reading hole_scores live means a group's progress shows up the instant a
// hole is saved, not only once they hit "Finish Round", and a completed
// scorecard's number here is guaranteed to match what it already wrote,
// since it's the same rows run through the same math.
//
// event_results is still read for two things a scorecard can never supply:
// the Longest Drive / Closest to the Pin / Countback flags (set separately,
// by hand), and any player whose points were entered manually with no
// scorecard at all.
export async function GET(request, { params }) {
  const supabase = createServerClient();
  const { id: eventId } = params;

  const { data: scorecards, error: scError } = await supabase
    .from("scorecards")
    .select("id, format, status, group_label")
    .eq("event_id", eventId);

  if (scError) {
    return NextResponse.json({ error: scError.message }, { status: 500 });
  }

  const scorecardIds = (scorecards || []).map((sc) => sc.id);

  const [{ data: scorecardPlayers }, { data: holeScores }, { data: eventResults }] = await Promise.all([
    scorecardIds.length
      ? supabase
          .from("scorecard_players")
          .select("scorecard_id, player_id, team_number, players(id, name)")
          .in("scorecard_id", scorecardIds)
      : Promise.resolve({ data: [] }),
    scorecardIds.length
      ? supabase
          .from("hole_scores")
          .select("scorecard_id, player_id, hole_number, stableford_points, gross_score, three_putt")
          .in("scorecard_id", scorecardIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("event_results")
      .select("player_id, points, longest_drive, closest_to_pin, countback_win, tutu, scorecard_id, players(id, name)")
      .eq("event_id", eventId),
  ]);

  const scorecardById = Object.fromEntries((scorecards || []).map((sc) => [sc.id, sc]));

  // --- Individual leaderboard ---
  // Sum every hole_scores row per player, regardless of which scorecard (or
  // its status) it came from — a player only ever plays one scorecard per
  // event, so there's no double-counting risk here.
  const pointsByPlayer = {};
  const nameByPlayer = {};
  const scorecardIdByPlayer = {};
  (scorecardPlayers || []).forEach((sp) => {
    if (sp.players?.name) nameByPlayer[sp.player_id] = sp.players.name;
    scorecardIdByPlayer[sp.player_id] = sp.scorecard_id;
  });
  // Day-of award stats (Most 3-Putts, Hundreds Club) — summed the same way
  // as points, straight off hole_scores, so they update live alongside
  // everything else. The event page itself decides which players are
  // "finished" enough to actually appear in an award (see thruFor below),
  // this just gives it the raw per-player totals to filter.
  const threePuttsByPlayer = {};
  const grossTotalByPlayer = {};
  (holeScores || []).forEach((hs) => {
    pointsByPlayer[hs.player_id] = (pointsByPlayer[hs.player_id] || 0) + hs.stableford_points;
    grossTotalByPlayer[hs.player_id] = (grossTotalByPlayer[hs.player_id] || 0) + (hs.gross_score || 0);
    if (hs.three_putt) {
      threePuttsByPlayer[hs.player_id] = (threePuttsByPlayer[hs.player_id] || 0) + 1;
    }
  });

  // "Thru" (holes played so far) — one scorecard's holes are always entered
  // for its whole group at once (see the holes route), so every player on
  // the same scorecard shares the same count. "F" (finished) once that
  // scorecard is completed, same convention a real tour leaderboard uses,
  // rather than a number that would otherwise just always read "18".
  const holesPlayedByScorecard = {};
  (holeScores || []).forEach((hs) => {
    holesPlayedByScorecard[hs.scorecard_id] = holesPlayedByScorecard[hs.scorecard_id] || new Set();
    holesPlayedByScorecard[hs.scorecard_id].add(hs.hole_number);
  });
  function thruFor(scorecardId) {
    if (!scorecardId) return null;
    const sc = scorecardById[scorecardId];
    if (sc?.status === "completed") return "F";
    const count = holesPlayedByScorecard[scorecardId]?.size || 0;
    return count > 0 ? count : null;
  }

  const playersWithScorecard = new Set((scorecardPlayers || []).map((sp) => sp.player_id));

  // Bonus flags (and manual-only entries for players with no scorecard at all).
  const bonusByPlayer = {};
  (eventResults || []).forEach((r) => {
    bonusByPlayer[r.player_id] = {
      longest_drive: !!r.longest_drive,
      closest_to_pin: !!r.closest_to_pin,
      countback_win: !!r.countback_win,
      tutu: !!r.tutu,
    };
    if (r.players?.name) nameByPlayer[r.player_id] = r.players.name;
    // No scorecard at all for this player — their only number is whatever
    // was entered manually, since there's no hole_scores to sum.
    if (!playersWithScorecard.has(r.player_id) && r.points != null) {
      pointsByPlayer[r.player_id] = Number(r.points);
    }
  });

  const individual = Object.keys(pointsByPlayer)
    .map((playerId) => {
      const bonus = bonusByPlayer[playerId] || {};
      const raw = pointsByPlayer[playerId] || 0;
      const overall = raw + (bonus.longest_drive ? 2 : 0) + (bonus.closest_to_pin ? 2 : 0);
      // No scorecard at all (pure manual entry) reads as "F" — it's a
      // finished, entered result, same as a completed scorecard.
      const thru = scorecardIdByPlayer[playerId] ? thruFor(scorecardIdByPlayer[playerId]) : "F";
      return {
        player_id: playerId,
        name: nameByPlayer[playerId] || "Unknown",
        points: raw,
        overall,
        thru,
        longest_drive: !!bonus.longest_drive,
        closest_to_pin: !!bonus.closest_to_pin,
        countback_win: !!bonus.countback_win,
        tutu: !!bonus.tutu,
        three_putts: threePuttsByPlayer[playerId] || 0,
        gross_total: grossTotalByPlayer[playerId] || 0,
      };
    })
    .sort((a, b) => {
      if (b.overall !== a.overall) return b.overall - a.overall;
      return (b.countback_win ? 1 : 0) - (a.countback_win ? 1 : 0);
    });

  // --- Team leaderboard (better ball stableford only — one row per
  // scorecard's team, recomputed live the same way /complete would write
  // it, so an in-progress team's row and a completed one are directly
  // comparable). ---
  const team = [];
  for (const sc of scorecards || []) {
    if (sc.format !== "better_ball_stableford") continue;
    const members = (scorecardPlayers || []).filter((sp) => sp.scorecard_id === sc.id);
    const teamNumbers = [...new Set(members.map((m) => m.team_number))].filter(Boolean);
    for (const teamNumber of teamNumbers) {
      const teamPlayerIds = members
        .filter((m) => m.team_number === teamNumber)
        .map((m) => m.player_id);
      const names = members
        .filter((m) => m.team_number === teamNumber)
        .map((m) => m.players?.name)
        .filter(Boolean)
        .join(" & ");
      const holesByNumber = {};
      (holeScores || [])
        .filter((hs) => hs.scorecard_id === sc.id && teamPlayerIds.includes(hs.player_id))
        .forEach((hs) => {
          holesByNumber[hs.hole_number] = holesByNumber[hs.hole_number] || [];
          holesByNumber[hs.hole_number].push(hs.stableford_points);
        });
      const rawPoints = Object.values(holesByNumber).reduce(
        (sum, pts) => sum + pts.reduce((a, b) => betterBallHolePoints(a, b), 0),
        0
      );
      // Countback tiers, kept purely for the tiebreak below — never shown
      // as their own score, never get the LD/CTP bonus (that's a
      // whole-round bonus, not a hole result). Each narrows the previous:
      // back nine, then last 3, then last 2, then the 18th alone.
      const pointsForHoles = (minHole) =>
        Object.entries(holesByNumber)
          .filter(([holeNum]) => Number(holeNum) >= minHole)
          .reduce((sum, [, pts]) => sum + pts.reduce((a, b) => betterBallHolePoints(a, b), 0), 0);
      const back9Points = pointsForHoles(10);
      const last3Points = pointsForHoles(16);
      const last2Points = pointsForHoles(17);
      const last1Points = pointsForHoles(18);
      // Final tiebreak: combined gross strokes for both players on the
      // team across every hole played so far — lower wins (fewer strokes).
      const teamGrossTotal = (holeScores || [])
        .filter((hs) => hs.scorecard_id === sc.id && teamPlayerIds.includes(hs.player_id))
        .reduce((sum, hs) => sum + (hs.gross_score || 0), 0);
      // A teammate's LD/CTP bonus is a bonus for the whole team, not just
      // the individual who hit it — same +2 each, added on top of the raw
      // stableford total. Both players on the team read this off the same
      // liveBoard.team row, so there's no way for their two scorecards to
      // show different team totals.
      const teamLd = teamPlayerIds.some((pid) => bonusByPlayer[pid]?.longest_drive);
      const teamCtp = teamPlayerIds.some((pid) => bonusByPlayer[pid]?.closest_to_pin);
      const points = rawPoints + (teamLd ? 2 : 0) + (teamCtp ? 2 : 0);
      const bonusParts = [];
      if (teamLd) bonusParts.push('+2 LD');
      if (teamCtp) bonusParts.push('+2 CTP');
      team.push({
        scorecard_id: sc.id,
        team_number: teamNumber,
        names,
        points,
        raw_points: rawPoints,
        back9_points: back9Points,
        last3_points: last3Points,
        last2_points: last2Points,
        last1_points: last1Points,
        gross_total: teamGrossTotal,
        longest_drive: teamLd,
        closest_to_pin: teamCtp,
        bonus_label: bonusParts.join(' '),
        thru: thruFor(sc.id),
        status: sc.status,
        group_label: sc.group_label,
      });
    }
  }
  // Countback tiebreak chain, in order: total points, back nine, last 3
  // holes, last 2 holes, the 18th hole alone, then lowest combined gross
  // (fewer strokes) as the final word. Each tier only matters once every
  // tier before it is exactly equal — worked out automatically since it's
  // all plain score comparison, not a judgment call like an individual's
  // manual countback flag.
  const TIEBREAK_TIERS = [
    { key: 'points', label: null, dir: 'desc' },
    { key: 'back9_points', label: 'the back nine', dir: 'desc' },
    { key: 'last3_points', label: 'the last 3 holes', dir: 'desc' },
    { key: 'last2_points', label: 'the last 2 holes', dir: 'desc' },
    { key: 'last1_points', label: 'the 18th hole', dir: 'desc' },
    { key: 'gross_total', label: 'gross score', dir: 'asc' },
  ];
  team.sort((a, b) => {
    for (const tier of TIEBREAK_TIERS) {
      const diff = tier.dir === 'desc' ? b[tier.key] - a[tier.key] : a[tier.key] - b[tier.key];
      if (diff !== 0) return diff;
    }
    return 0;
  });
  // Finds which tier actually separated two teams that are tied on total
  // points — returns its label, or null if every tier is exactly equal.
  function decidingTier(a, b) {
    if (a.points !== b.points) return null;
    for (const tier of TIEBREAK_TIERS) {
      if (tier.label && a[tier.key] !== b[tier.key]) return tier.label;
    }
    return null;
  }
  let teamPosition = 0;
  team.forEach((t, i) => {
    const prev = team[i - 1];
    const stillTied = prev && !decidingTier(prev, t) && prev.points === t.points;
    if (!stillTied) teamPosition = i + 1;
    t.position = teamPosition;
    // Flags the team that comes out ahead of another team it was level
    // with on points, so the leaderboard can show where that ranking
    // actually came from instead of just a number.
    const next = team[i + 1];
    const crit = next ? decidingTier(t, next) : null;
    t.countback_win = !!crit;
    t.countback_label = crit ? `Won on countback — ${crit}` : null;
  });

  // --- Live matches (better ball match play — never fed a points table,
  // shown as running/final match status instead). ---
  const matches = [];
  for (const sc of scorecards || []) {
    if (sc.format !== "better_ball_match_play") continue;
    const members = (scorecardPlayers || []).filter((sp) => sp.scorecard_id === sc.id);
    const teamA = members.filter((m) => m.team_number === 1).map((m) => m.player_id);
    const teamB = members.filter((m) => m.team_number === 2).map((m) => m.player_id);
    const namesA = members
      .filter((m) => m.team_number === 1)
      .map((m) => m.players?.name)
      .filter(Boolean)
      .join(" & ");
    const namesB = members
      .filter((m) => m.team_number === 2)
      .map((m) => m.players?.name)
      .filter(Boolean)
      .join(" & ");

    const holeNumbers = [
      ...new Set(
        (holeScores || []).filter((hs) => hs.scorecard_id === sc.id).map((hs) => hs.hole_number)
      ),
    ].sort((a, b) => a - b);

    if (holeNumbers.length === 0) continue;

    const holeResults = holeNumbers.map((holeNum) => {
      const rowsForHole = (holeScores || []).filter(
        (hs) => hs.scorecard_id === sc.id && hs.hole_number === holeNum
      );
      const aPoints = rowsForHole
        .filter((r) => teamA.includes(r.player_id))
        .reduce((best, r) => betterBallHolePoints(best, r.stableford_points), 0);
      const bPoints = rowsForHole
        .filter((r) => teamB.includes(r.player_id))
        .reduce((best, r) => betterBallHolePoints(best, r.stableford_points), 0);
      return matchPlayHoleResult(aPoints, bPoints);
    });

    const status = matchStatus(holeResults);
    matches.push({
      scorecard_id: sc.id,
      group_label: sc.group_label,
      names_a: namesA,
      names_b: namesB,
      status: sc.status,
      ...status,
    });
  }

  return NextResponse.json({ individual, team, matches });
}
