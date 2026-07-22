import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Body: { results: [{ player_id, points: number|null, longest_drive: bool, closest_to_pin: bool }, ...] }
// Entering points = attended (upserts event_results + event_attendance).
// Clearing points = did not attend (deletes both rows for that player/event).
export async function POST(request, { params }) {
  const supabase = createServerClient();
  const { id: event_id } = params;
  const body = await request.json();
  const rows = body.results || [];

  const toSave = rows.filter((r) => r.points !== null && r.points !== "" && r.points !== undefined);
  const toClear = rows.filter((r) => r.points === null || r.points === "" || r.points === undefined);

  if (toSave.length > 0) {
    const { error: upsertError } = await supabase.from("event_results").upsert(
      toSave.map((r) => ({
        event_id,
        player_id: r.player_id,
        points: Number(r.points),
        longest_drive: !!r.longest_drive,
        closest_to_pin: !!r.closest_to_pin,
        countback_win: !!r.countback_win,
      })),
      { onConflict: "event_id,player_id" }
    );
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const { error: attendError } = await supabase.from("event_attendance").upsert(
      toSave.map((r) => ({ event_id, player_id: r.player_id, attended: true })),
      { onConflict: "event_id,player_id" }
    );
    if (attendError) {
      return NextResponse.json({ error: attendError.message }, { status: 500 });
    }
  }

  if (toClear.length > 0) {
    const clearIds = toClear.map((r) => r.player_id);
    await supabase.from("event_results").delete().eq("event_id", event_id).in("player_id", clearIds);
    await supabase.from("event_attendance").delete().eq("event_id", event_id).in("player_id", clearIds);
  }

  return NextResponse.json({ success: true });
}
