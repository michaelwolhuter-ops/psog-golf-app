import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const [{ data: handicap }, { data: oom }, { data: qualification }, { data: results }, { data: rounds }] =
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
