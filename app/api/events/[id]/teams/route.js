import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Body: { team_name?: string, points?: number, player_ids: string[] }
// Team results are separate from event_results on purpose — they never feed
// Order of Merit, they exist for team-win / player team-stats later.
export async function POST(request, { params }) {
  const supabase = createServerClient();
  const { id: event_id } = params;
  const body = await request.json();

  const playerIds = body.player_ids || [];
  if (playerIds.length === 0) {
    return NextResponse.json({ error: "Pick at least one player for the team" }, { status: 400 });
  }

  const { data: team, error: teamError } = await supabase
    .from("event_teams")
    .insert({
      event_id,
      team_name: body.team_name || null,
      points: body.points === "" || body.points === undefined ? null : Number(body.points),
    })
    .select()
    .single();

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  const { error: membersError } = await supabase.from("event_team_members").insert(
    playerIds.map((player_id) => ({ event_team_id: team.id, player_id }))
  );

  if (membersError) {
    // Roll back the orphaned team row rather than leave a team with no players.
    await supabase.from("event_teams").delete().eq("id", team.id);
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  return NextResponse.json({ data: team }, { status: 201 });
}
