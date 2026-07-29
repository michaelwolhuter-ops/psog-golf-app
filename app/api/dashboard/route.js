import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  fetchHoleRowsWithPar,
  aggregateHoleStats,
  deriveRoundExtremes,
  getEventPositions,
} from "@/lib/statHelpers";

export const dynamic = "force-dynamic";

// Statistics Snapshot (Most Pars, Most Rings, Highest Gross) reuses the
// exact same shared aggregation the full Statistics page ranks against —
// just picks the single #1 leader per category instead of a top-5 list, so
// the dashboard preview can never quietly disagree with the real page.
// Players with a value of 0 (no pars/rings yet) or no full 18-hole round
// (for Highest Gross) are excluded, same "don't pad with zeros" rule the
// Statistics leaderboards already use.
async function getStatsSnapshot(supabase) {
  const [{ data: players }, { holeRows, parByHole }] = await Promise.all([
    supabase.from("players").select("id, name, nickname"),
    fetchHoleRowsWithPar(supabase),
  ]);

  const nameById = {};
  (players || []).forEach((p) => {
    nameById[p.id] = p.nickname || p.name;
  });

  const holeAggByPlayer = aggregateHoleStats(holeRows, parByHole);

  let mostPars = null;
  let mostRings = null;
  let highestGross = null;

  holeAggByPlayer.forEach((agg, playerId) => {
    const name = nameById[playerId] || "Unknown player";
    if (agg.pars > 0 && (!mostPars || agg.pars > mostPars.value)) {
      mostPars = { name, value: agg.pars };
    }
    if (agg.rings > 0 && (!mostRings || agg.rings > mostRings.value)) {
      mostRings = { name, value: agg.rings };
    }
    const extremes = deriveRoundExtremes(agg);
    if (
      extremes.highest_gross &&
      (!highestGross || extremes.highest_gross.value > highestGross.value)
    ) {
      highestGross = { name, value: extremes.highest_gross.value };
    }
  });

  return { most_pars: mostPars, most_rings: mostRings, highest_gross: highestGross };
}

export async function GET() {
  const supabase = createServerClient();

  const [
    { data: settings },
    { data: oomTop10 },
    { data: upcomingEvents },
    { data: qualification },
    { data: totalActivePlayers },
    { data: latestCompleted },
    { data: handicaps },
    statsSnapshot,
    eventPositions,
  ] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("order_of_merit").select("*").order("position", { ascending: true }).limit(10),
    supabase
      .from("events")
      .select("*")
      .eq("status", "upcoming")
      .order("sort_order", { ascending: true })
      .limit(4),
    supabase.from("qualification_status").select("*"),
    supabase.from("players").select("id").eq("active", true),
    supabase
      .from("events")
      .select("*")
      .eq("status", "completed")
      .order("sort_order", { ascending: false })
      .limit(1),
    supabase.from("player_handicaps").select("*"),
    getStatsSnapshot(supabase),
    getEventPositions(supabase),
  ]);

  const qualifiedCount = (qualification || []).filter((q) => q.qualified_for_tour).length;
  const totalPlayers = (totalActivePlayers || []).length;

  // Ranked by the same shared getEventPositions() the Events leaderboard and
  // every player's Results History already use — NOT a local re-sort here.
  // A local "points + bonus" sort with no countback tiebreak used to live in
  // this file, and it silently disagreed with the real event position
  // whenever two players tied on points: whoever Supabase happened to return
  // first won the tie, instead of whoever actually won the countback. Caught
  // 2026-07-28 (Ross Drogemoller shown 1st here despite finishing 2nd on
  // countback everywhere else in the app).
  let latestResults = null;
  if (latestCompleted && latestCompleted.length > 0) {
    const event = latestCompleted[0];
    const { data: results } = await supabase
      .from("event_results")
      .select("points, longest_drive, closest_to_pin, players(id, name)")
      .eq("event_id", event.id);

    // `overall` (points + LD/CTP bonus) is recomputed here purely for
    // display — it's the same formula getEventPositions() uses internally,
    // just not something that helper returns. `position` (the actual sort
    // key) still comes only from the shared getEventPositions(), so the
    // countback-aware ranking can't drift from every other ranking surface.
    // Bug fixed 2026-07-29: this card's points column went blank after the
    // 2026-07-28 countback-order fix — that fix stopped selecting
    // longest_drive/closest_to_pin and never carried `overall` into the
    // mapped object at all, so `position` was right but there was no points
    // value left to show.
    const ranked = (results || [])
      .filter((r) => r.points !== null && r.players?.id)
      .map((r) => ({
        name: r.players.name,
        overall: Number(r.points) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0),
        position: eventPositions[`${event.id}|${r.players.id}`] ?? Infinity,
      }))
      .sort((a, b) => a.position - b.position);

    latestResults = { event, top3: ranked.slice(0, 3) };
  }

  const withHandicap = (handicaps || []).filter((h) => h.tour_handicap !== null);
  const lowestHandicap =
    withHandicap.length > 0
      ? withHandicap.reduce((min, h) => (h.tour_handicap < min.tour_handicap ? h : min))
      : null;
  const highestHandicap =
    withHandicap.length > 0
      ? withHandicap.reduce((max, h) => (h.tour_handicap > max.tour_handicap ? h : max))
      : null;

  const withAdjustment = (handicaps || []).filter((h) => Number(h.committee_adjustment) !== 0);
  const largestAdjustment =
    withAdjustment.length > 0
      ? withAdjustment.reduce((max, h) =>
          Math.abs(h.committee_adjustment) > Math.abs(max.committee_adjustment) ? h : max
        )
      : null;

  return NextResponse.json({
    settings,
    oom_top10: oomTop10 || [],
    oom_leader: oomTop10 && oomTop10.length > 0 ? oomTop10[0] : null,
    upcoming_events: upcomingEvents || [],
    next_event: upcomingEvents && upcomingEvents.length > 0 ? upcomingEvents[0] : null,
    qualified_count: qualifiedCount,
    total_players: totalPlayers,
    latest_results: latestResults,
    handicap_summary: {
      lowest: lowestHandicap,
      highest: highestHandicap,
      largest_adjustment: largestAdjustment,
    },
    stats_snapshot: statsSnapshot,
  });
}
