import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { strokesReceived, stablefordPoints } from "@/lib/scoring";

export const dynamic = "force-dynamic";

// Saves every player's score for one hole at once (the marker enters the
// whole group's hole together, not one player at a time). Strokes received
// and stableford points are computed here, server-side, off the hole's real
// par/stroke index and each player's actual Tour Handicap — never trusted
// from the client — so the numbers can't drift if a handicap changes or the
// client sends something stale.
export async function POST(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;
  const body = await request.json();

  const holeNumber = Number(body.hole_number);
  const scores = Array.isArray(body.scores) ? body.scores : []; // [{player_id, gross_score, rung}]

  if (!holeNumber || holeNumber < 1 || holeNumber > 18) {
    return NextResponse.json({ error: "Invalid hole number" }, { status: 400 });
  }
  if (scores.length === 0) {
    return NextResponse.json({ error: "No scores submitted" }, { status: 400 });
  }

  const { data: scorecard, error: scError } = await supabase
    .from("scorecards")
    .select("id, course_id, status")
    .eq("id", id)
    .single();

  if (scError || !scorecard) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }
  if (scorecard.status === "completed") {
    return NextResponse.json({ error: "This round is already completed" }, { status: 400 });
  }

  const { data: hole, error: holeError } = await supabase
    .from("holes")
    .select("par, stroke_index")
    .eq("course_id", scorecard.course_id)
    .eq("hole_number", holeNumber)
    .single();

  if (holeError || !hole) {
    return NextResponse.json({ error: "Hole not found for this course" }, { status: 404 });
  }

  const playerIds = scores.map((s) => s.player_id);
  const { data: handicaps } = await supabase
    .from("player_handicaps")
    .select("id, tour_handicap")
    .in("id", playerIds);
  const handicapById = Object.fromEntries((handicaps || []).map((h) => [h.id, h.tour_handicap]));

  const rows = scores.map((s) => {
    const strokes = strokesReceived(handicapById[s.player_id] ?? 0, hole.stroke_index);
    const points = stablefordPoints(Number(s.gross_score), hole.par, strokes);
    return {
      scorecard_id: id,
      player_id: s.player_id,
      hole_number: holeNumber,
      gross_score: Number(s.gross_score),
      rung: !!s.rung,
      stableford_points: points,
    };
  });

  const { data, error } = await supabase
    .from("hole_scores")
    .upsert(rows, { onConflict: "scorecard_id,player_id,hole_number" })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
