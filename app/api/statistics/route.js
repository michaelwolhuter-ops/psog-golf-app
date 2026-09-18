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
    // Birdies/Pars/Rings/3-Putts leaderboards rank per-round averages, not
    // totals — dividing by full_rounds_counted, the same "full 18-hole
    // rounds only" gate used everywhere else (matches Average Gross/Points
    // above and the identical Average Rings/3-Putts-per-round stats already
    // shipped on a player's own profile page).
    const rounds = extremes.full_rounds_counted;
    const perRound = (total) => (rounds > 0 ? Math.round((total / rounds) * 10) / 10 : null);
    perPlayer.push({
      player_id: playerId,
      name: nameById[playerId] || "Unknown player",
      ...extremes,
      eagles: agg.eagles,
      birdies: agg.birdies,
      pars: agg.pars,
      rings: agg.rings,
      three_putts: agg.three_putts,
      avg_birdies: perRound(agg.birdies),
      avg_pars: perRound(agg.pars),
      avg_rings: perRound(agg.rings),
      avg_three_putts: perRound(agg.three_putts),
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
      .map(({ row, value }) => ({
        player_id: row.player_id,
        name: row.name,
        value,
        event_name: row.event_name,
        event_date: row.event_date,
      }));
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
    tutu: bonusTallies.tutu[playerId] || 0,
  }));

  return NextResponse.json({
    lowest_gross: topN(
      roundExtremeRows.map((p) => ({
        ...p,
        event_name: p.lowest_gross?.event_name,
        event_date: p.lowest_gross?.event_date,
      })),
      (p) => p.lowest_gross?.value,
      "asc"
    ),
    highest_gross: topN(
      roundExtremeRows.map((p) => ({
        ...p,
        event_name: p.highest_gross?.event_name,
        event_date: p.highest_gross?.event_date,
      })),
      (p) => p.highest_gross?.value,
      "desc"
    ),
    most_points: topN(
      roundExtremeRows.map((p) => ({
        ...p,
        event_name: p.most_points?.event_name,
        event_date: p.most_points?.event_date,
      })),
      (p) => p.most_points?.value,
      "desc"
    ),
    lowest_points: topN(
      roundExtremeRows.map((p) => ({
        ...p,
        event_name: p.lowest_points?.event_name,
        event_date: p.lowest_points?.event_date,
      })),
      (p) => p.lowest_points?.value,
      "asc",
      false // 0 points in a round is a real (if brutal) value, not "no data" — don't drop it
    ),
    average_gross: topN(roundExtremeRows, (p) => p.average_gross, "asc"),
    average_gross_worst: topN(roundExtremeRows, (p) => p.average_gross, "desc"),
    rounds_100_plus: topN(perPlayer, (p) => p.rounds_100_plus, "desc"),
    eagles: topN(perPlayer, (p) => p.eagles, "desc"),
    birdies: topN(roundExtremeRows, (p) => p.avg_birdies, "desc"),
    // "Worst" end of each per-round average — same players (at least 1 full
    // round played, via roundExtremeRows), just sorted the other way. Zero
    // is NOT dropped here (dropZero=false) — a genuine 0 average is exactly
    // what belongs at the bottom of the list, unlike the "best" side above
    // where a 0 would just mean "no achievement", not a real ranking.
    birdies_worst: topN(roundExtremeRows, (p) => p.avg_birdies, "asc", false),
    pars: topN(roundExtremeRows, (p) => p.avg_pars, "desc"),
    pars_worst: topN(roundExtremeRows, (p) => p.avg_pars, "asc", false),
    // Rings and 3-putts are bad outcomes, so their existing "desc" cards are
    // already the worst end (most rings/3-putts per round) — the added
    // counterpart here is the genuinely GOOD end (fewest per round), where
    // 0 is the best possible value and must not be dropped.
    rings: topN(roundExtremeRows, (p) => p.avg_rings, "desc"),
    rings_best: topN(roundExtremeRows, (p) => p.avg_rings, "asc", false),
    three_putts: topN(roundExtremeRows, (p) => p.avg_three_putts, "desc"),
    three_putts_best: topN(roundExtremeRows, (p) => p.avg_three_putts, "asc", false),
    individual_wins: topN(winRows, (p) => p.individual, "desc"),
    team_wins: topN(winRows, (p) => p.team, "desc"),
    top3_finishes: topN(finishRows, (p) => p.top3, "desc"),
    top5_finishes: topN(finishRows, (p) => p.top5, "desc"),
    top10_finishes: topN(finishRows, (p) => p.top10, "desc"),
    longest_drives: topN(bonusRows, (p) => p.longest_drive, "desc"),
    closest_to_pins: topN(bonusRows, (p) => p.closest_to_pin, "desc"),
    tutu: topN(bonusRows, (p) => p.tutu, "desc"),
  });
}
