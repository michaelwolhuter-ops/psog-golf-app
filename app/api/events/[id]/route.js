import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const [{ data: players }, { data: results }, { data: teams }] = await Promise.all([
    supabase.from("players").select("id, name, nickname, active").order("name"),
    supabase.from("event_results").select("*").eq("event_id", id),
    supabase
      .from("event_teams")
      .select("*, event_team_members(player_id, players(id, name))")
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const teamsShaped = (teams || []).map((t) => ({
    id: t.id,
    team_name: t.team_name,
    points: t.points,
    members: (t.event_team_members || []).map((m) => m.players).filter(Boolean),
  }));

  return NextResponse.json({
    event,
    players: players || [],
    results: results || [],
    teams: teamsShaped,
  });
}

export async function PATCH(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;
  const body = await request.json();

  const updates = {};
  const allowed = ["name", "event_date", "golf_course", "format", "status", "notes", "sort_order"];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("events")
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

  // event_results and event_attendance both reference events with ON DELETE
  // CASCADE, so removing the event cleans up its results/attendance too.
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
