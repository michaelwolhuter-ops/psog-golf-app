import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Next.js caches server-side fetch calls by default, including the ones
// Supabase makes internally — without this, edits wouldn't show up until
// some arbitrary cache expiry. Every route in this app reads live data,
// so every route opts out of that cache the same way.
export const dynamic = "force-dynamic";

// Short column header for a per-event breakdown, e.g. "Qualifier 1" -> "Q1",
// "Tour Day 2" -> "T2" (first letter of the name + its trailing number) —
// generic, not hardcoded to any particular event name, so this kept working
// automatically when the qualifiers were renamed from "Round N" to
// "Qualifier N" on 2026-07-22 (labels went from R1-R4 to Q1-Q4).
function abbreviateEventName(name) {
  const num = (name.match(/(\d+)\s*$/) || [])[1] || "";
  const firstLetter = (name.trim().charAt(0) || "?").toUpperCase();
  return firstLetter + num;
}

export async function GET() {
  const supabase = createServerClient();

  const [{ data, error }, { data: allEvents }, { data: eventPositions }] = await Promise.all([
    supabase.from("order_of_merit").select("*").order("total_points", { ascending: false }),
    // All events, not just completed ones — the columns for R2/R3/R4/T1/T2
    // should always be visible on the schedule, they just won't have a
    // number in them until that event is entered *and* marked Completed.
    supabase.from("events").select("id, name, sort_order, status").order("sort_order", { ascending: true }),
    // Field-size-adjusted points per player per completed event (see the
    // event_positions DB view) — this is what the season total is actually
    // built from now, not raw scorecard points.
    supabase.from("event_positions").select("event_id, player_id, event_points"),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (allEvents || []).map((e) => ({
    id: e.id,
    name: e.name,
    label: abbreviateEventName(e.name),
  }));

  // Build player_id -> [{event_id, event_points}], sorted best first, so
  // the page can mark which 2 scores are actually counting toward the total
  // and which (if any) got dropped — "best 2 of however many played".
  const scoresByPlayer = {};
  (eventPositions || []).forEach((r) => {
    (scoresByPlayer[r.player_id] ||= []).push(r);
  });
  Object.values(scoresByPlayer).forEach((list) =>
    list.sort((a, b) => b.event_points - a.event_points)
  );

  const withBreakdown = (data || []).map((row) => {
    const scores = scoresByPlayer[row.player_id] || [];
    const by_event = {};
    scores.forEach((s, i) => {
      by_event[s.event_id] = { points: s.event_points, counts: i < 2 };
    });
    return { ...row, by_event };
  });

  return NextResponse.json({ data: withBreakdown, events });
}
