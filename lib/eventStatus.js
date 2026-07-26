// Event status ("upcoming" / "in_progress" / "completed") is auto-derived
// from that event's scorecards, never set by hand — see the migration
// allow_in_progress_event_status and app/api/events/[id]/route.js (PATCH no
// longer accepts "status"). Call this after anything that creates,
// completes, reopens, or deletes a scorecard, so the event's status is
// always an honest reflection of what's actually happened, not something
// that can drift out of sync or get left on the wrong value by hand.
//
// Rule:
// - No scorecards at all, and no event_results either -> "upcoming"
//   (nothing has happened yet).
// - No scorecards, but event_results already exist -> "completed". This
//   grandfathers events scored before digital scorecards existed (manual
//   entry is being retired going forward, but old recorded results are
//   still real, finished results, not a "nothing happening" state).
// - At least one scorecard, and every one of them is "completed" -> "completed".
// - At least one scorecard, but not all of them completed yet -> "in_progress"
//   (covers "still being played" AND "some groups home, some still out").
export async function syncEventStatus(supabase, eventId) {
  const [{ data: scorecards }, { data: results }] = await Promise.all([
    supabase.from("scorecards").select("status").eq("event_id", eventId),
    supabase.from("event_results").select("id").eq("event_id", eventId).limit(1),
  ]);

  let status;
  if (!scorecards || scorecards.length === 0) {
    status = results && results.length > 0 ? "completed" : "upcoming";
  } else if (scorecards.every((s) => s.status === "completed")) {
    status = "completed";
  } else {
    status = "in_progress";
  }

  await supabase.from("events").update({ status }).eq("id", eventId);
  return status;
}
