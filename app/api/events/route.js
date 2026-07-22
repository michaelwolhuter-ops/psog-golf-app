import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Works out, for one completed event, who won individually and which team
// (by player names, not a team name — ad-hoc teams get reshuffled every
// event so a fixed name doesn't mean anything) won the team result.
async function getEventWinners(supabase, eventId) {
  const [{ data: results }, { data: teams }] = await Promise.all([
    supabase
      .from("event_results")
      .select("points, longest_drive, closest_to_pin, countback_win, players(name)")
      .eq("event_id", eventId),
    supabase
      .from("event_teams")
      .select("points, event_team_members(players(name))")
      .eq("event_id", eventId),
  ]);

  let individual_winner = null;
  if (results && results.length > 0) {
    const ranked = results
      .filter((r) => r.points !== null && r.points !== undefined)
      .map((r) => ({
        name: r.players?.name,
        overall: Number(r.points) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0),
        countback_win: r.countback_win,
      }))
      .sort((a, b) => {
        if (b.overall !== a.overall) return b.overall - a.overall;
        return (b.countback_win ? 1 : 0) - (a.countback_win ? 1 : 0);
      });
    if (ranked.length > 0) individual_winner = ranked[0].name;
  }

  let team_winner_names = [];
  if (teams && teams.length > 0) {
    const ranked = teams
      .filter((t) => t.points !== null && t.points !== undefined)
      .sort((a, b) => Number(b.points) - Number(a.points));
    if (ranked.length > 0) {
      team_winner_names = (ranked[0].event_team_members || [])
        .map((m) => m.players?.name)
        .filter(Boolean);
    }
  }

  return { individual_winner, team_winner_names };
}

export async function GET() {
  const supabase = createServerClient();

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Winners only make sense once an event is done.
  const withWinners = await Promise.all(
    (events || []).map(async (e) => {
      if (e.status !== "completed") {
        return { ...e, individual_winner: null, team_winner_names: [] };
      }
      const winners = await getEventWinners(supabase, e.id);
      return { ...e, ...winners };
    })
  );

  const { data: qualification } = await supabase
    .from("qualification_status")
    .select("*");

  return NextResponse.json({ data: withWinners, qualification: qualification || [] });
}

export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!["qualifier", "tour_day"].includes(body.event_type)) {
    return NextResponse.json({ error: "event_type must be qualifier or tour_day" }, { status: 400 });
  }

  // New events sort to the end by default.
  const { data: maxRow } = await supabase
    .from("events")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const nextSortOrder = (maxRow?.sort_order || 0) + 1;

  const { data, error } = await supabase
    .from("events")
    .insert({
      name,
      event_type: body.event_type,
      sort_order: nextSortOrder,
      event_date: body.event_date || null,
      golf_course: body.golf_course || null,
      format: body.format || null,
      status: "upcoming",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
