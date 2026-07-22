import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();

  const [
    { data: settings },
    { data: oomTop10 },
    { data: upcomingEvents },
    { data: qualification },
    { data: totalActivePlayers },
    { data: latestCompleted },
    { data: handicaps },
  ] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("order_of_merit").select("*").order("position", { ascending: true }).limit(10),
    supabase
      .from("events")
      .select("*")
      .eq("status", "upcoming")
      .order("sort_order", { ascending: true })
      .limit(4),
    supabase.from("qualification_status").select("*"),
    supabase.from("players").select("id").eq("active", true),
    supabase
      .from("events")
      .select("*")
      .eq("status", "completed")
      .order("sort_order", { ascending: false })
      .limit(1),
    supabase.from("player_handicaps").select("*"),
  ]);

  const qualifiedCount = (qualification || []).filter((q) => q.qualified_for_tour).length;
  const totalPlayers = (totalActivePlayers || []).length;

  let latestResults = null;
  if (latestCompleted && latestCompleted.length > 0) {
    const event = latestCompleted[0];
    const { data: results } = await supabase
      .from("event_results")
      .select("points, longest_drive, closest_to_pin, players(id, name)")
      .eq("event_id", event.id);

    const ranked = (results || [])
      .filter((r) => r.points !== null)
      .map((r) => ({
        name: r.players?.name,
        overall: (r.points || 0) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0),
      }))
      .sort((a, b) => b.overall - a.overall);

    latestResults = { event, top3: ranked.slice(0, 3) };
  }

  const withHandicap = (handicaps || []).filter((h) => h.tour_handicap !== null);
  const lowestHandicap =
    withHandicap.length > 0
      ? withHandicap.reduce((min, h) => (h.tour_handicap < min.tour_handicap ? h : min))
      : null;

  const withAdjustment = (handicaps || []).filter((h) => Number(h.committee_adjustment) !== 0);
  const largestAdjustment =
    withAdjustment.length > 0
      ? withAdjustment.reduce((max, h) =>
          Math.abs(h.committee_adjustment) > Math.abs(max.committee_adjustment) ? h : max
        )
      : null;

  return NextResponse.json({
    settings,
    oom_top10: oomTop10 || [],
    oom_leader: oomTop10 && oomTop10.length > 0 ? oomTop10[0] : null,
    upcoming_events: upcomingEvents || [],
    next_event: upcomingEvents && upcomingEvents.length > 0 ? upcomingEvents[0] : null,
    qualified_count: qualifiedCount,
    total_players: totalPlayers,
    latest_results: latestResults,
    handicap_summary: {
      lowest: lowestHandicap,
      largest_adjustment: largestAdjustment,
    },
  });
}
