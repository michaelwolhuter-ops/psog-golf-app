import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { strokesReceived, resolveHoleScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

// Saves every player's score for one hole at once (the marker enters the
// whole group's hole together, not one player at a time). Strokes received
// and stableford points are computed here, server-side, off the hole's real
// par/stroke index and each player's Tour Handicap as it was LOCKED onto
// this scorecard when the round started (scorecard_players.tour_handicap)
// — never the live handicap, and never trusted from the client — so the
// numbers can't drift if a handicap changes mid-round, later, or the client
// sends something stale.
//
// The client sends the TRUE gross score the marker typed in (even a bad one
// like a 10) — `resolveHoleScore` (lib/scoring.js) is what actually decides
// whether that's used as-is or capped at par+3 with 0 points, regardless of
// what the client thought `rung` should be. This is the authoritative check
// (2026-07-27, replacing the old rule where only an explicit "Ring" tap got
// capped) — a manually-typed score worse than triple bogey gets capped down
// automatically, the same as if Ring had been tapped.
export async function POST(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;
  const body = await request.json();

  const holeNumber = Number(body.hole_number);
  const scores = Array.isArray(body.scores) ? body.scores : []; // [{player_id, gross_score, rung, three_putt}]

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
  const { data: scorecardPlayers } = await supabase
    .from("scorecard_players")
    .select("player_id, tour_handicap")
    .eq("scorecard_id", id)
    .in("player_id", playerIds);
  const handicapById = Object.fromEntries(
    (scorecardPlayers || []).map((sp) => [sp.player_id, sp.tour_handicap])
  );

  const rows = scores.map((s) => {
    const strokes = strokesReceived(handicapById[s.player_id] ?? 0, hole.stroke_index);
    const resolved = resolveHoleScore(Number(s.gross_score), hole.par, strokes, !!s.rung);
    return {
      scorecard_id: id,
      player_id: s.player_id,
      hole_number: holeNumber,
      gross_score: resolved.gross_score,
      rung: resolved.rung,
      three_putt: !!s.three_putt,
      stableford_points: resolved.stableford_points,
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
