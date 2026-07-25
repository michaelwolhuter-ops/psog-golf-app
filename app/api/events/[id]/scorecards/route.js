import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FORMATS = ["individual_stableford", "better_ball_stableford", "better_ball_match_play"];

// List every scorecard (in progress or completed) for this event, with
// player names attached — used by the "New Scorecard" setup screen to show
// what's already been started, so a marker can resume rather than
// accidentally create a duplicate for the same group.
export async function GET(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  const { data, error } = await supabase
    .from("scorecards")
    .select("*, scorecard_players(player_id, team_number, players(id, name))")
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data || [] });
}

// Creates a new scorecard (one group of players playing together) for this
// event. Requires the event to already have a course selected — holes come
// from there, and there's no scoring without par/stroke index.
export async function POST(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;
  const body = await request.json();

  const format = body.format;
  const playerIds = Array.isArray(body.player_ids) ? body.player_ids : [];
  const teamNumbers = body.team_numbers || {}; // { player_id: 1 | 2 }
  const groupLabel = body.group_label || null;

  if (!FORMATS.includes(format)) {
    return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  }
  if (playerIds.length < 2) {
    return NextResponse.json({ error: "Pick at least 2 players" }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, course_id")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.course_id) {
    return NextResponse.json(
      { error: "This event has no course selected yet — pick one on the event details form first." },
      { status: 400 }
    );
  }

  // Better ball formats need every player assigned to team 1 or 2.
  if (format !== "individual_stableford") {
    const missing = playerIds.filter((pid) => teamNumbers[pid] !== 1 && teamNumbers[pid] !== 2);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Every player needs a team (1 or 2) for this format" },
        { status: 400 }
      );
    }
  }

  const { data: scorecard, error: scError } = await supabase
    .from("scorecards")
    .insert({ event_id: id, course_id: event.course_id, format, group_label: groupLabel })
    .select()
    .single();

  if (scError) {
    return NextResponse.json({ error: scError.message }, { status: 500 });
  }

  // Snapshot each player's Tour Handicap right now, at the moment this
  // round starts, and store it on the scorecard. This is what locks the
  // round: strokes/points/Net are computed from this frozen number for the
  // rest of this scorecard's life, never the live (possibly later
  // recalculated) handicap — see /lib/scoring and the holes route.
  const { data: handicaps } = await supabase
    .from("player_handicaps")
    .select("id, tour_handicap")
    .in("id", playerIds);
  const handicapById = Object.fromEntries((handicaps || []).map((h) => [h.id, h.tour_handicap]));

  const playerRows = playerIds.map((pid) => ({
    scorecard_id: scorecard.id,
    player_id: pid,
    team_number: format === "individual_stableford" ? null : teamNumbers[pid],
    tour_handicap: handicapById[pid] ?? 0,
  }));

  const { error: playersError } = await supabase.from("scorecard_players").insert(playerRows);

  if (playersError) {
    // Don't leave an empty orphaned scorecard behind if the players failed to attach.
    await supabase.from("scorecards").delete().eq("id", scorecard.id);
    return NextResponse.json({ error: playersError.message }, { status: 500 });
  }

  return NextResponse.json({ data: scorecard }, { status: 201 });
}
