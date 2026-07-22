import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function PUT(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("settings")
    .update({
      season_name: body.season_name,
      tour_start_date: body.tour_start_date || null,
      tour_end_date: body.tour_end_date || null,
      num_qualifiers_required: body.num_qualifiers_required,
      points_allocation: body.points_allocation || null,
    })
    .eq("id", 1)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
