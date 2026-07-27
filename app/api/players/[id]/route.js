import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  fetchHoleRowsWithPar,
  aggregateHoleStats,
  deriveRoundExtremes,
  getEventPositions,
  getEventWinners,
  getPlayerWinCounts,
} from "@/lib/statHelpers";

export const dynamic = "force-dynamic";

// Wins, Event Positions, and hole-by-hole stats (Lowest/Highest Gross,
// Most/Lowest Points, Eagles/Birdies/Pars/Rings) all now live in
// lib/statHelpers.js — shared with app/api/statistics/route.js so a
// player's own numbers here can never quietly disagree with the whole-field
// leaderboards built from the exact same underlying logic.

// Match Record (wins-losses-halves) for the Better Ball Match Play format —
// a deliberately separate stat from Wins above. Wins means "best in the
// whole field for an event"; a match result only means "won your own
// fourball's head-to-head", so multiple players can each have a match win
// on the same day. Only counts completed scorecards of that one format.
async function getMatchRecord(supabase, playerId) {
  const { data: memberships } = await supabase
    .from("scorecard_players")
    .select("scorecard_id, team_number, scorecards!inner(id, format, status)")
    .eq("player_id", playerId)
    .eq("scorecards.format", "better_ball_match_play")
    .eq("scorecards.status", "completed");

  const scorecardIds = (memberships || []).map((m) => m.scorecard_id);
  if (scorecardIds.length === 0) return { wins: 0, losses: 0, halves: 0 };

  const { data: matchResults } = await supabase
    .from("match_results")
    .select("scorecard_id, winning_team_number")
    .in("scorecard_id", scorecardIds);

  const resultByScorecard = Object.fromEntries(
    (matchResults || []).map((m) => [m.scorecard_id, m.winning_team_number])
  );

  const record = { wins: 0, losses: 0, halves: 0 };
  memberships.forEach((m) => {
    const winningTeam = resultByScorecard[m.scorecard_id];
    if (winningTeam === undefined) return; // scorecard completed but match_results row missing — skip rather than guess
    if (winningTeam === null) record.halves += 1;
    else if (winningTeam === m.team_number) record.wins += 1;
    else record.losses += 1;
  });

  return record;
}

export async function GET(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const [
    { data: handicap },
    { data: oom },
    { data: qualification },
    { data: results },
    { data: rounds },
    winners,
    eventPositions,
    matchRecord,
    { holeRows, parByHole },
  ] = await Promise.all([
    supabase.from("player_handicaps").select("*").eq("id", id).single(),
    supabase.from("order_of_merit").select("*").eq("player_id", id).single(),
    supabase.from("qualification_status").select("*").eq("player_id", id).single(),
    supabase
      .from("event_results")
      .select("points, longest_drive, closest_to_pin, events(id, name, event_type, event_date, sort_order)")
      .eq("player_id", id),
    supabase
      .from("player_rounds")
      .select("*")
      .eq("player_id", id)
      .order("round_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    getEventWinners(supabase),
    getEventPositions(supabase),
    getMatchRecord(supabase, id),
    fetchHoleRowsWithPar(supabase, id),
  ]);

  const wins = getPlayerWinCounts(winners, id);
  const playerHoleAgg = aggregateHoleStats(holeRows, parByHole).get(id) || {
    eagles: 0,
    birdies: 0,
    pars: 0,
    rings: 0,
    three_putts: 0,
    rounds: [],
  };
  const holeStats = {
    ...deriveRoundExtremes(playerHoleAgg),
    eagles: playerHoleAgg.eagles,
    birdies: playerHoleAgg.birdies,
    pars: playerHoleAgg.pars,
    rings: playerHoleAgg.rings,
    three_putts: playerHoleAgg.three_putts,
  };

  // Mark the rounds that actually feed the handicap average — same "last 5,
  // most recent first" rule the player_handicaps view uses.
  const roundsWithFlag = (rounds || []).map((r, i) => ({ ...r, counts_toward_handicap: i < 5 }));

  // Uses the order_of_merit view's own position/movement (competition ranking,
  // ties share a position) rather than recomputing from array order.
  const oomPosition = oom?.position ?? null;
  const oomTotal = oom?.total_points ?? 0;
  const oomMovement = oom?.movement ?? null;

  const resultsHistory = (results || [])
    .map((r) => ({
      event_id: r.events?.id,
      event_name: r.events?.name,
      event_type: r.events?.event_type,
      event_date: r.events?.event_date,
      sort_order: r.events?.sort_order,
      points: r.points,
      longest_drive: r.longest_drive,
      closest_to_pin: r.closest_to_pin,
      position: eventPositions?.[`${r.events?.id}|${id}`] ?? null,
      overall:
        (r.points || 0) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0),
    }))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // Top 3/5/10 individual finish counts — reuses the same per-event position
  // already computed above for Results History, just thresholded. Note: an
  // event with fewer than 10 players in the field will trivially count as a
  // "top 10" finish for everyone who played it — same as any real leaderboard
  // with a small field, not a bug.
  const topFinishes = resultsHistory.reduce(
    (acc, r) => {
      if (r.position && r.position <= 3) acc.top3 += 1;
      if (r.position && r.position <= 5) acc.top5 += 1;
      if (r.position && r.position <= 10) acc.top10 += 1;
      return acc;
    },
    { top3: 0, top5: 0, top10: 0 }
  );

  return NextResponse.json({
    player,
    handicap: handicap || null,
    oom_position: oomPosition,
    oom_total_points: oomTotal,
    oom_movement: oomMovement,
    qualification: qualification || null,
    results_history: resultsHistory,
    rounds: roundsWithFlag,
    wins: wins || { individual: 0, team: 0 },
    match_record: matchRecord || { wins: 0, losses: 0, halves: 0 },
    hole_stats: holeStats,
    top_finishes: topFinishes,
  });
}

export async function PATCH(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;
  const body = await request.json();

  const updates = {};
  const allowed = [
    "name",
    "nickname",
    "photo_url",
    "index",
    "handicap_prediction",
    "committee_adjustment",
    "active",
    "notes",
  ];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("players")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  // player_rounds, event_attendance and event_results all reference players
  // with ON DELETE CASCADE, so this also removes their rounds/results/history.
  const { error } = await supabase.from("players").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
