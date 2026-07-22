import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const supabase = createServerClient();
  const { id: player_id } = params;
  const body = await request.json();

  if (body.score === undefined || body.score === null || body.score === "") {
    return NextResponse.json({ error: "Score is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("player_rounds")
    .insert({
      player_id,
      score: Number(body.score),
      round_date: body.round_date || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
