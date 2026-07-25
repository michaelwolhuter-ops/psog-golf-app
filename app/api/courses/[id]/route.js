import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  const { data: course, error } = await supabase
    .from("courses")
    .select("*, holes(*)")
    .eq("id", id)
    .single();

  if (error || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  course.holes = (course.holes || []).sort((a, b) => a.hole_number - b.hole_number);

  return NextResponse.json({ data: course });
}
