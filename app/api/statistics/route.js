import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  fetchHoleRowsWithPar,
  aggregateHoleStats,
  deriveRoundExtremes,
  getEventPositions,
  getEventWinners,
  tallyWins,
  getBonusTallies,
} from "@/lib/statHelpers";

export const dynamic = "force-dynamic";

const TOP_N = 5;

// Whole-field leaderboards, built from the exact same shared logic as a
// single player's Round Stats section (app/api/players/[id]/route.js) —
// Mike's explicit ask was "based on these same stats", so this route
// deliberately does not re-derive anything, it only ranks the per-player
// output of the same lib/statHelpers.js functions across every player.
export async function GET() {
  const supabase = createServerClient();

  const [{ data: players }, { holeRows, parByHole }, winners, eventPositions, bonusTallies] =
    await Promise.all([
      supabase.from("players").select("id, name, nickname, active"),
      fetchHoleRowsWithPar(supabase),
      getEventWinners(supabase),
      getEventPositions(supabase),
      getBonusTallies(supabase),
    ]);

  const nameById = {};
  (players || []).forEach((p) => {
    nameById[p.id] = p.nickname || p.name;
  });

  const holeAggByPlayer = aggregateHoleStats(holeRows, parByHole);

  // Per-player derived values, one row per player who has at least some
  // completed-scorecard data — players with nothing recorded yet simply
  // don't appear in any of these leaderboards rather than showing as 0s.
  const perPlayer = [];
  holeAggByPlayer.forEach((agg, playerId) => {
    const extremes = deriveRoundExtremes(agg);
    perPlayer.push({
      player_id: playerId,
      name: nameById[playerId] || "Unknown player",
      ...extremes,
      eagles: agg.eagles,
      birdies: agg.birdies,
      pars: agg.pars,
      rings: agg.rings,
      three_putts: agg.three_putts,
    });
  });

  // Wins tallies and Top 3/5/10 finish counts — these don't depend on
  // hole_scores at all (they're event_results-based), so every active
  // player is a candidate even with zero digital scorecards, unlike the
  // gross/points/achievement leaderboards above.
  const winTallies = tallyWins(winners);
  const finishCounts = {}; // player_id -> { top3, top5, top10 }
  Object.entries(eventPositions).forEach(([key, position]) => {
    const playerId = key.split("|")[1];
    finishCounts[playerId] ||= { top3: 0, top5: 0, top10: 0 };
    if (position <= 3) finishCounts[playerId].top3 += 1;
    if (position <= 5) finishCounts[playerId].top5 += 1;
    if (position <= 10) finishCounts[playerId].top10 += 1;
  });

  // Helper: top N by a numeric field, ascending or descending, dropping
  // zero/null entries (no point padding a leaderboard with players who have
  // no achievements or no full rounds recorded).
  function topN(list, getValue, direction, dropZero = true) {
    return list
      .map((row) => ({ row, value: getValue(row) }))
      .filter(({ value }) => value !== null && value !== undefined && (!dropZero || value > 0))
      .sort((a, b) => (direction === "asc" ? a.value - b.value : b.value - a.value))
      .slice(0, TOP_N)
      .map(({ row, value }) => ({ player_id: row.player_id, name: row.name, value, event_name: row.event_name }));
  }

  const roundExtremeRows = perPlayer.filter((p) => p.full_rounds_counted > 0);

  const winRows = Object.keys(nameById).map((playerId) => ({
    player_id: playerId,
    name: nameById[playerId],
    individual: winTallies.individual[playerId] || 0,
    team: winTallies.team[playerId] || 0,
  }));

  const finishRows = Object.keys(nameById).map((playerId) => ({
    player_id: playerId,
    name: nameById[playerId],
    ...(finishCounts[playerId] || { top3: 0, top5: 0, top10: 0 }),
  }));

  const bonusRows = Object.keys(nameById).map((playerId) => ({
    player_id: playerId,
    name: nameById[playerId],
    longest_drive: bonusTallies.longestDrive[playerId] || 0,
    closest_to_pin: bonusTallies.closestToPin[playerId] || 0,
  }));

  return NextResponse.json({
    lowest_gross: topN(
      roundExtremeRows.map((p) => ({ ...p, event_name: p.lowest_gross?.event_name })),
      (p) => p.lowest_gross?.value,
      "asc"
    ),
    highest_gross: topN(
      roundExtremeRows.map((p) => ({ ...p, event_name: p.highest_gross?.event_name })),
      (p) => p.highest_gross?.value,
      "desc"
    ),
    most_points: topN(
      roundExtremeRows.map((p) => ({ ...p, event_name: p.most_points?.event_name })),
      (p) => p.most_points?.value,
      "desc"
    ),
    lowest_points: topN(
      roundExtremeRows.map((p) => ({ ...p, event_name: p.lowest_points?.event_name })),
      (p) => p.lowest_points?.value,
      "asc",
      false // 0 points in a round is a real (if brutal) value, not "no data" — don't drop it
    ),
    rounds_100_plus: topN(perPlayer, (p) => p.rounds_100_plus, "desc"),
    eagles: topN(perPlayer, (p) => p.eagles, "desc"),
    birdies: topN(perPlayer, (p) => p.birdies, "desc"),
    pars: topN(perPlayer, (p) => p.pars, "desc"),
    rings: topN(perPlayer, (p) => p.rings, "desc"),
    three_putts: topN(perPlayer, (p) => p.three_putts, "desc"),
    individual_wins: topN(winRows, (p) => p.individual, "desc"),
    team_wins: topN(winRows, (p) => p.team, "desc"),
    top3_finishes: topN(finishRows, (p) => p.top3, "desc"),
    top5_finishes: topN(finishRows, (p) => p.top5, "desc"),
    top10_finishes: topN(finishRows, (p) => p.top10, "desc"),
    longest_drives: topN(bonusRows, (p) => p.longest_drive, "desc"),
    closest_to_pins: topN(bonusRows, (p) => p.closest_to_pin, "desc"),
  });
}
