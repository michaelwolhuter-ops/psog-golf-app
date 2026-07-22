import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Next.js caches server-side fetch calls by default, including the ones
// Supabase makes internally — without this, edits wouldn't show up until
// some arbitrary cache expiry. Every route in this app reads live data,
// so every route opts out of that cache the same way.
export const dynamic = "force-dynamic";

// Short column header for a per-event breakdown, e.g. "Round 1" -> "R1",
// "Tour Day 2" -> "T2" (first letter of the name + its trailing number).
function abbreviateEventName(name) {
  const num = (name.match(/(\d+)\s*$/) || [])[1] || "";
  const firstLetter = (name.trim().charAt(0) || "?").toUpperCase();
  return firstLetter + num;
}

export async function GET() {
  const supabase = createServerClient();

  const [{ data, error }, { data: allEvents }] = await Promise.all([
    supabase.from("order_of_merit").select("*").order("total_points", { ascending: false }),
    // All events, not just completed ones — the columns for R2/R3/R4/T1/T2
    // should always be visible on the schedule, they just won't have a
    // number in them until that event is entered *and* marked Completed.
    supabase.from("events").select("id, name, sort_order, status").order("sort_order", { ascending: true }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (allEvents || []).map((e) => ({
    id: e.id,
    name: e.name,
    label: abbreviateEventName(e.name),
  }));
  const completedEventIds = (allEvents || []).filter((e) => e.status === "completed").map((e) => e.id);

  // Build player_id -> { event_id -> overall points } so the table can show
  // a small breakdown column per event, alongside the season total. Only
  // pulls from completed events, same rule the season total itself uses —
  // so a column and the Points total never disagree with each other.
  let byEventByPlayer = {};
  if (completedEventIds.length > 0) {
    const { data: results } = await supabase
      .from("event_results")
      .select("event_id, player_id, points, longest_drive, closest_to_pin")
      .in("event_id", completedEventIds);

    (results || []).forEach((r) => {
      if (r.points === null || r.points === undefined) return;
      const overall = Number(r.points) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0);
      byEventByPlayer[r.player_id] = byEventByPlayer[r.player_id] || {};
      byEventByPlayer[r.player_id][r.event_id] = overall;
    });
  }

  const withBreakdown = (data || []).map((row) => ({
    ...row,
    by_event: byEventByPlayer[row.player_id] || {},
  }));

  return NextResponse.json({ data: withBreakdown, events });
}
