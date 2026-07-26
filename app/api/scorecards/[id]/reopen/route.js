import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncEventStatus } from "@/lib/eventStatus";

export const dynamic = "force-dynamic";

// Reopens a completed round for editing. Cleanly undoes exactly what this
// scorecard wrote — nothing else — using the scorecard_id tag added to
// event_teams/event_results, then flips status back to in_progress so the
// entry screen (app/scorecards/[id]/page.js) works on it again. Re-finishing
// afterward via /complete recomputes everything fresh.
export async function POST(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  const { data: scorecard, error: scError } = await supabase
    .from("scorecards")
    .select("id, status, event_id")
    .eq("id", id)
    .single();

  if (scError || !scorecard) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }
  if (scorecard.status !== "completed") {
    return NextResponse.json({ error: "This round isn't completed — nothing to reopen" }, { status: 400 });
  }

  // event_teams rows this scorecard created — event_team_members cascades
  // automatically (existing FK).
  const { error: teamsError } = await supabase.from("event_teams").delete().eq("scorecard_id", id);
  if (teamsError) {
    return NextResponse.json({ error: teamsError.message }, { status: 500 });
  }

  // Match play result, if any.
  const { error: matchError } = await supabase.from("match_results").delete().eq("scorecard_id", id);
  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  // Only remove event_results rows still owned by this scorecard — if Mike
  // has since hand-edited a player's result, its scorecard_id was already
  // cleared to null by the manual entry route, so it's untouched here.
  const { error: resultsError } = await supabase.from("event_results").delete().eq("scorecard_id", id);
  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 });
  }

  const { error: statusError } = await supabase
    .from("scorecards")
    .update({ status: "in_progress" })
    .eq("id", id);
  if (statusError) {
    return NextResponse.json({ error: statusError.message }, { status: 500 });
  }

  // Reopening a round means the event is no longer fully finished — flips
  // it back from "completed" to "in_progress" if that's what it was.
  await syncEventStatus(supabase, scorecard.event_id);

  return NextResponse.json({ success: true });
}
