import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  const supabase = createServerClient();
  const { roundId } = params;

  const { error } = await supabase.from("player_rounds").delete().eq("id", roundId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
