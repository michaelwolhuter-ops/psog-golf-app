import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { betterBallHolePoints, matchPlayHoleResult, matchStatus } from "@/lib/scoring";

export const dynamic = "force-dynamic";

// Finishing a round writes its numbers into the exact same tables manual
// entry uses (event_results, event_teams/event_team_members) — the
// scorecard is a second way to fill those in, never a separate source of
// truth. Order of Merit and the Event Leaderboard don't need to know or
// care whether a result came from here or from the manual "Enter Results"
// form.
export async function POST(request, { params }) {
  const supabase = createServerClient();
  const { id } = params;

  const { data: scorecard, error: scError } = await supabase
    .from("scorecards")
    .select("id, event_id, format, status")
    .eq("id", id)
    .single();

  if (scError || !scorecard) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }
  if (scorecard.status === "completed") {
    return NextResponse.json({ error: "This round is already completed" }, { status: 400 });
  }

  const [{ data: scorecardPlayers }, { data: holeScores }] = await Promise.all([
    supabase.from("scorecard_players").select("player_id, team_number").eq("scorecard_id", id),
    supabase.from("hole_scores").select("*").eq("scorecard_id", id).order("hole_number"),
  ]);

  if (!holeScores || holeScores.length === 0) {
    return NextResponse.json({ error: "No holes have been scored yet" }, { status: 400 });
  }

  const eventId = scorecard.event_id;

  // --- Individual results: every format feeds this the same way ---
  // Sum each player's stableford points across whatever holes were played.
  const pointsByPlayer = {};
  for (const row of holeScores) {
    pointsByPlayer[row.player_id] = (pointsByPlayer[row.player_id] || 0) + row.stableford_points;
  }

  const playerIds = (scorecardPlayers || []).map((sp) => sp.player_id);
  const { data: existingResults } = await supabase
    .from("event_results")
    .select("player_id, longest_drive, closest_to_pin, countback_win")
    .eq("event_id", eventId)
    .in("player_id", playerIds.length ? playerIds : ["00000000-0000-0000-0000-000000000000"]);
  const existingByPlayer = Object.fromEntries((existingResults || []).map((r) => [r.player_id, r]));

  const resultRows = playerIds.map((pid) => {
    const existing = existingByPlayer[pid];
    return {
      event_id: eventId,
      player_id: pid,
      points: pointsByPlayer[pid] || 0,
      // Preserve any LD/CTP/countback already recorded for this player on
      // this event (e.g. set manually) — completing a scorecard only
      // supplies points, it never silently clears these.
      longest_drive: existing?.longest_drive || false,
      closest_to_pin: existing?.closest_to_pin || false,
      countback_win: existing?.countback_win || false,
      // Tags this result as scorecard-sourced so reopening/deleting this
      // scorecard later can cleanly undo exactly what it wrote, and so the
      // event page knows which players' results came from a real scorecard.
      scorecard_id: id,
    };
  });

  if (resultRows.length > 0) {
    const { error: resultsError } = await supabase
      .from("event_results")
      .upsert(resultRows, { onConflict: "event_id,player_id" });
    if (resultsError) {
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }
    await supabase
      .from("event_attendance")
      .upsert(
        playerIds.map((pid) => ({ event_id: eventId, player_id: pid, attended: true })),
        { onConflict: "event_id,player_id" }
      );
  }

  // --- Better ball stroke play: also write a team result ---
  if (scorecard.format === "better_ball_stableford") {
    const teamNumbers = [...new Set((scorecardPlayers || []).map((sp) => sp.team_number))].filter(
      Boolean
    );

    for (const teamNumber of teamNumbers) {
      const teamPlayerIds = (scorecardPlayers || [])
        .filter((sp) => sp.team_number === teamNumber)
        .map((sp) => sp.player_id);

      // Per-hole team points = the best individual points among the team's
      // players on that hole (generalizes the standard 2-player better ball
      // to however many players ended up on this team).
      const holesByNumber = {};
      for (const row of holeScores) {
        if (!teamPlayerIds.includes(row.player_id)) continue;
        holesByNumber[row.hole_number] = holesByNumber[row.hole_number] || [];
        holesByNumber[row.hole_number].push(row.stableford_points);
      }
      const teamTotal = Object.values(holesByNumber).reduce(
        (sum, pts) => sum + pts.reduce((a, b) => betterBallHolePoints(a, b), 0),
        0
      );

      const { data: team, error: teamError } = await supabase
        .from("event_teams")
        .insert({ event_id: eventId, points: teamTotal, scorecard_id: id })
        .select()
        .single();
      if (teamError) {
        return NextResponse.json({ error: teamError.message }, { status: 500 });
      }
      await supabase
        .from("event_team_members")
        .insert(teamPlayerIds.map((pid) => ({ event_team_id: team.id, player_id: pid })));
    }
  }

  // --- Better ball match play: decide the match, write match_results ---
  // Never writes to event_teams/points — the match result isn't a points
  // total, it feeds the separate Match Record stat instead.
  if (scorecard.format === "better_ball_match_play") {
    const teamA = (scorecardPlayers || [])
      .filter((sp) => sp.team_number === 1)
      .map((sp) => sp.player_id);
    const teamB = (scorecardPlayers || [])
      .filter((sp) => sp.team_number === 2)
      .map((sp) => sp.player_id);

    const holeNumbers = [...new Set(holeScores.map((r) => r.hole_number))].sort((a, b) => a - b);
    const holeResults = holeNumbers.map((holeNum) => {
      const rowsForHole = holeScores.filter((r) => r.hole_number === holeNum);
      const aPoints = rowsForHole
        .filter((r) => teamA.includes(r.player_id))
        .reduce((best, r) => betterBallHolePoints(best, r.stableford_points), 0);
      const bPoints = rowsForHole
        .filter((r) => teamB.includes(r.player_id))
        .reduce((best, r) => betterBallHolePoints(best, r.stableford_points), 0);
      return matchPlayHoleResult(aPoints, bPoints);
    });

    const status = matchStatus(holeResults);
    const winningTeamNumber = status.winningTeam === 'A' ? 1 : status.winningTeam === 'B' ? 2 : null;

    const { error: matchError } = await supabase.from("match_results").upsert(
      {
        scorecard_id: id,
        winning_team_number: winningTeamNumber,
        margin: status.label,
        holes_played: status.holesPlayed,
      },
      { onConflict: "scorecard_id" }
    );
    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }
  }

  const { error: statusError } = await supabase
    .from("scorecards")
    .update({ status: "completed" })
    .eq("id", id);
  if (statusError) {
    return NextResponse.json({ error: statusError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
