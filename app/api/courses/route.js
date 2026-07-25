import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Courses + their 18 holes (par, stroke index, yardage) — the foundation
// for the eventual digital scorecard. Only par and stroke index are ever
// used for scoring; yardage is display-only. Right now this only feeds the
// course picker on the event details form.
export async function GET() {
  const supabase = createServerClient();

  const { data: courses, error } = await supabase
    .from("courses")
    .select("*, holes(*)")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const shaped = (courses || []).map((c) => ({
    ...c,
    holes: (c.holes || []).sort((a, b) => a.hole_number - b.hole_number),
  }));

  return NextResponse.json({ data: shaped });
}

export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Course name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("courses")
    .insert({ name, notes: body.notes || null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
