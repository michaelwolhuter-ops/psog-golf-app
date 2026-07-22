import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const [{ data: players, error }, { data: handicaps }] = await Promise.all([
    supabase.from("players").select("*").order("name", { ascending: true }),
    supabase.from("player_handicaps").select("id, tour_handicap"),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const handicapById = Object.fromEntries((handicaps || []).map((h) => [h.id, h.tour_handicap]));
  const data = (players || []).map((p) => ({
    ...p,
    tour_handicap: handicapById[p.id] ?? null,
  }));

  return NextResponse.json({ data });
}

export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("players")
    .insert({
      name,
      nickname: body.nickname || null,
      index: body.index ?? null,
      handicap_prediction: body.handicap_prediction ?? null,
      committee_adjustment: body.committee_adjustment ?? 0,
      active: body.active ?? true,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
