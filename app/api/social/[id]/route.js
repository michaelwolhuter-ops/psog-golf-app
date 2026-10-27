import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Deletes one casual round (id = its hidden once-off event). The scorecard,
// players and hole scores all cascade from the event. Refuses anything that
// isn't once_off, so this can never be used to delete a tour event.
export async function DELETE(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  const { data: event } = await supabase
    .from("events")
    .select("id, event_type")
    .eq("id", id)
    .single();
  if (!event) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (event.event_type !== "once_off") {
    return NextResponse.json({ error: "Only casual rounds can be deleted here" }, { status: 400 });
  }

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
