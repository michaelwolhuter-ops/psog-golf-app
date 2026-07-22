import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Individual win = this player was the top-ranked result in a completed
// event — same ranking rule as the Events list's Event Winners column
// (points + LD/CTP bonuses, ties broken by countback_win). Team win = this
// player was a member of the top-points team in a completed event's Team
// Results. Matched by player_id throughout, never by name, per the app's
// canonical-player rule (name spellings aren't reliable, ids are).
async function getPlayerWinCounts(supabase, playerId) {
  const [{ data: allResults }, { data: allTeams }] = await Promise.all([
    supabase
      .from("event_results")
      .select(
        "event_id, player_id, points, longest_drive, closest_to_pin, countback_win, events!inner(status)"
      )
      .eq("events.status", "completed"),
    supabase
      .from("event_teams")
      .select("id, event_id, points, event_team_members(player_id), events!inner(status)")
      .eq("events.status", "completed"),
  ]);

  const resultsByEvent = {};
  (allResults || []).forEach((r) => {
    (resultsByEvent[r.event_id] ||= []).push(r);
  });
  let individual = 0;
  Object.values(resultsByEvent).forEach((group) => {
    const ranked = group
      .filter((r) => r.points !== null && r.points !== undefined)
      .map((r) => ({
        player_id: r.player_id,
        overall: Number(r.points) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0),
        countback_win: r.countback_win,
      }))
      .sort((a, b) => {
        if (b.overall !== a.overall) return b.overall - a.overall;
        return (b.countback_win ? 1 : 0) - (a.countback_win ? 1 : 0);
      });
    if (ranked.length > 0 && ranked[0].player_id === playerId) individual += 1;
  });

  const teamsByEvent = {};
  (allTeams || []).forEach((t) => {
    (teamsByEvent[t.event_id] ||= []).push(t);
  });
  let team = 0;
  Object.values(teamsByEvent).forEach((group) => {
    const ranked = group
      .filter((t) => t.points !== null && t.points !== undefined)
      .sort((a, b) => Number(b.points) - Number(a.points));
    if (ranked.length > 0) {
      const memberIds = (ranked[0].event_team_members || []).map((m) => m.player_id);
      if (memberIds.includes(playerId)) team += 1;
    }
  });

  return { individual, team };
}

// Position this player finished in each event, matching the exact same
// ranking rule as the Events page's own Event Leaderboard (individual
// leaderboard in app/events/[id]/page.js): sort by points + LD/CTP bonuses,
// tiebreak by countback_win, then position = sorted index + 1. This is
// sequential, not competition-style shared ranks (Order of Merit uses a
// different, always-unique ranking with more tiebreak criteria available —
// see the player_handicaps/order_of_merit views). A genuine unresolved tie
// on points with no countback entered gets an arbitrary but stable order —
// same known limitation already flagged for Wins/Event Winners in memory.md.
async function getEventPositions(supabase) {
  const { data: allResults } = await supabase
    .from("event_results")
    .select("event_id, player_id, points, longest_drive, closest_to_pin, countback_win");

  const byEvent = {};
  (allResults || []).forEach((r) => {
    (byEvent[r.event_id] ||= []).push(r);
  });

  const positionByKey = {};
  Object.entries(byEvent).forEach(([eventId, group]) => {
    const ranked = group
      .filter((r) => r.points !== null && r.points !== undefined)
      .map((r) => ({
        player_id: r.player_id,
        overall: Number(r.points) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0),
        countback_win: r.countback_win,
      }))
      .sort((a, b) => {
        if (b.overall !== a.overall) return b.overall - a.overall;
        return (b.countback_win ? 1 : 0) - (a.countback_win ? 1 : 0);
      });
    ranked.forEach((r, i) => {
      positionByKey[`${eventId}|${r.player_id}`] = i + 1;
    });
  });

  return positionByKey;
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

  const [{ data: handicap }, { data: oom }, { data: qualification }, { data: results }, { data: rounds }, wins, eventPositions] =
    await Promise.all([
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
      getPlayerWinCounts(supabase, id),
      getEventPositions(supabase),
    ]);

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
