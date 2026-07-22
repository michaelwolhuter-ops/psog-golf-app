import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// PATCH only touches name/points. Changing who's on the team means delete +
// recreate for now — membership editing wasn't asked for, keeping this simple.
export async function PATCH(request, { params }) {
  const supabase = createServerClient();
  const { teamId } = params;
  const body = await request.json();

  const updates = {};
  if ("team_name" in body) updates.team_name = body.team_name || null;
  if ("points" in body) updates.points = body.points === "" ? null : Number(body.points);

  const { data, error } = await supabase
    .from("event_teams")
    .update(updates)
    .eq("id", teamId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(request, { params }) {
  const supabase = createServerClient();
  const { teamId } = params;

  // event_team_members references event_teams with ON DELETE CASCADE.
  const { error } = await supabase.from("event_teams").delete().eq("id", teamId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
