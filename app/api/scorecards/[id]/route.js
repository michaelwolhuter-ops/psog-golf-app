import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Full detail needed to run the entry screen: the scorecard itself, its
// event and course (with holes, sorted), every player in the group with
// their Tour Handicap (needed for stroke allocation), and every hole score
// entered so far.
export async function GET(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  const { data: scorecard, error: scError } = await supabase
    .from("scorecards")
    .select("*, events(id, name, event_date)")
    .eq("id", id)
    .single();

  if (scError || !scorecard) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }

  const [{ data: course }, { data: scorecardPlayers }, { data: holeScores }, { data: matchResult }] =
    await Promise.all([
      supabase.from("courses").select("*, holes(*)").eq("id", scorecard.course_id).single(),
      supabase
        .from("scorecard_players")
        .select("player_id, team_number, tour_handicap, players(id, name)")
        .eq("scorecard_id", id),
      supabase.from("hole_scores").select("*").eq("scorecard_id", id),
      supabase.from("match_results").select("*").eq("scorecard_id", id).maybeSingle(),
    ]);

  if (course) {
    course.holes = (course.holes || []).sort((a, b) => a.hole_number - b.hole_number);
  }

  // Tour Handicap per player — the value locked onto scorecard_players when
  // this round was created, NOT a live lookup. This is what keeps a played
  // round's strokes/Net/HCP display frozen even if handicaps get
  // recalculated afterward. (Rounds created before this locking existed
  // were backfilled with the handicap at backfill time — see migration
  // add_locked_tour_handicap_to_scorecard_players.)
  const players = (scorecardPlayers || []).map((sp) => ({
    id: sp.player_id,
    name: sp.players?.name,
    team_number: sp.team_number,
    tour_handicap: sp.tour_handicap ?? 0,
  }));

  return NextResponse.json({
    scorecard,
    course: course || null,
    players,
    hole_scores: holeScores || [],
    match_result: matchResult || null,
  });
}

// Deletes a scorecard outright. If it was completed, first rolls back
// exactly what it wrote (event_teams/match_results/event_results tagged
// with its scorecard_id — see the reopen route for the same logic), so no
// stale points or teams are left behind. scorecard_players and hole_scores
// cascade automatically via their existing FK to scorecards.
export async function DELETE(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  const { data: scorecard } = await supabase
    .from("scorecards")
    .select("status")
    .eq("id", id)
    .single();

  if (scorecard?.status === "completed") {
    const { error: teamsError } = await supabase.from("event_teams").delete().eq("scorecard_id", id);
    if (teamsError) {
      return NextResponse.json({ error: teamsError.message }, { status: 500 });
    }
    const { error: matchError } = await supabase.from("match_results").delete().eq("scorecard_id", id);
    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }
    const { error: resultsError } = await supabase.from("event_results").delete().eq("scorecard_id", id);
    if (resultsError) {
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }
  }

  const { error } = await supabase.from("scorecards").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
