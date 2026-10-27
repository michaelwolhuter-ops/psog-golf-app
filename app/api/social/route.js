import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncEventStatus } from "@/lib/eventStatus";
import { betterBallHolePoints, matchPlayHoleResult, matchStatus } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const FORMATS = ["individual_stableford", "better_ball_stableford", "better_ball_match_play"];

// Social Golf = casual rounds outside the tour (2026-10-27). Each round is
// stored as a hidden once-off event holding exactly one scorecard, so it
// reuses the scorecard screen, live leaderboard and every existing
// "skip once_off" filter that keeps it out of the Order of Merit and tour
// stats (see the Once-Off Events DECISION in memory.md). Players never see
// the word "event" — they just start a round from /social.

// First names only, same as the match-play pairings elsewhere in the app.
function firstName(name) {
  return (name || "").trim().split(/\s+/)[0];
}

function names(players) {
  return players.map((p) => firstName(p.name)).join(" & ");
}

// Works out the result of one casual round straight from its hole scores.
// Nothing is written to event_results/match_results for once-off rounds, so
// this is the only place their outcome is decided.
function summariseRound(scorecard, holeScores) {
  const players = (scorecard.scorecard_players || []).map((sp) => ({
    id: sp.player_id,
    name: (sp.players?.name || "").trim(),
    team_number: sp.team_number,
  }));
  const pointsByPlayer = {};
  const holesByPlayer = {};
  for (const r of holeScores) {
    pointsByPlayer[r.player_id] = (pointsByPlayer[r.player_id] || 0) + r.stableford_points;
    holesByPlayer[r.player_id] = (holesByPlayer[r.player_id] || 0) + 1;
  }
  const holesPlayed = Math.max(0, ...Object.values(holesByPlayer));
  const individual = players
    .map((p) => ({ ...p, points: pointsByPlayer[p.id] || 0 }))
    .sort((a, b) => b.points - a.points);

  if (scorecard.format === "individual_stableford") {
    const top = individual[0]?.points;
    const winners = holeScores.length ? individual.filter((p) => p.points === top) : [];
    return {
      holes_played: holesPlayed,
      individual,
      winner_ids: winners.map((p) => p.id),
      headline: individual.map((p) => `${firstName(p.name)} ${p.points}`).join(" · "),
    };
  }

  const teamA = players.filter((p) => p.team_number === 1);
  const teamB = players.filter((p) => p.team_number === 2);
  const holeNumbers = [...new Set(holeScores.map((r) => r.hole_number))].sort((a, b) => a - b);
  const bestOn = (team, holeNum) =>
    holeScores
      .filter((r) => r.hole_number === holeNum && team.some((p) => p.id === r.player_id))
      .reduce((best, r) => betterBallHolePoints(best, r.stableford_points), 0);

  if (scorecard.format === "better_ball_stableford") {
    const aTotal = holeNumbers.reduce((s, h) => s + bestOn(teamA, h), 0);
    const bTotal = holeNumbers.reduce((s, h) => s + bestOn(teamB, h), 0);
    const winners = !holeScores.length || aTotal === bTotal ? [] : aTotal > bTotal ? teamA : teamB;
    return {
      holes_played: holesPlayed,
      individual,
      winner_ids: winners.map((p) => p.id),
      headline: `${names(teamA)} ${aTotal} v ${bTotal} ${names(teamB)}`,
    };
  }

  // Better ball match play
  const status = holeNumbers.length
    ? matchStatus(holeNumbers.map((h) => matchPlayHoleResult(bestOn(teamA, h), bestOn(teamB, h))))
    : null;
  let headline = `${names(teamA)} v ${names(teamB)}`;
  let winners = [];
  if (status) {
    if (!status.winningTeam) {
      headline = `${names(teamA)} v ${names(teamB)} · ${status.decided ? "All Square" : status.label}`;
    } else {
      const leader = status.winningTeam === "A" ? teamA : teamB;
      const scoreline = status.label.includes("&")
        ? `${status.margin} & ${status.holesRemaining}`
        : `${status.margin} Up`;
      headline = status.decided
        ? `${names(leader)} won ${scoreline}`
        : `${names(leader)} ${status.label}`;
      if (status.decided) winners = leader;
    }
  }
  return {
    holes_played: holesPlayed,
    individual,
    winner_ids: winners.map((p) => p.id),
    headline,
  };
}

// Every casual round (newest first) with its result, plus per-player stats
// across the finished ones.
export async function GET() {
  const supabase = createServerClient();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, event_date, status, created_at, scramble_drive")
    .eq("event_type", "once_off")
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!events || events.length === 0) {
    return NextResponse.json({ rounds: [], stats: [] });
  }

  const { data: scorecards } = await supabase
    .from("scorecards")
    .select(
      "id, event_id, format, status, course_id, courses(name), scorecard_players(player_id, team_number, players(name))"
    )
    .in("event_id", events.map((e) => e.id));

  const scorecardIds = (scorecards || []).map((s) => s.id);
  const courseIds = [...new Set((scorecards || []).map((s) => s.course_id).filter(Boolean))];
  const [{ data: holeScores }, { data: holes }] = await Promise.all([
    scorecardIds.length
      ? supabase
          .from("hole_scores")
          .select("scorecard_id, player_id, hole_number, gross_score, rung, stableford_points")
          .in("scorecard_id", scorecardIds)
      : { data: [] },
    courseIds.length
      ? supabase.from("holes").select("course_id, hole_number, par").in("course_id", courseIds)
      : { data: [] },
  ]);
  const parByHole = {};
  (holes || []).forEach((h) => {
    parByHole[`${h.course_id}|${h.hole_number}`] = h.par;
  });

  const scorecardByEvent = {};
  (scorecards || []).forEach((s) => {
    scorecardByEvent[s.event_id] = s;
  });

  const statsByPlayer = {};
  const rounds = events
    .map((e) => {
      const sc = scorecardByEvent[e.id];
      // An event with no scorecard is a round that was abandoned before it
      // started — nothing worth listing.
      if (!sc) return null;
      const rows = (holeScores || []).filter((r) => r.scorecard_id === sc.id);
      const summary = summariseRound(sc, rows);

      if (sc.status === "completed") {
        for (const p of summary.individual) {
          const s = (statsByPlayer[p.id] ||= {
            player_id: p.id,
            name: p.name,
            rounds: 0,
            wins: 0,
            points_total: 0,
            best_points: null,
            birdies: 0,
          });
          s.rounds += 1;
          if (summary.winner_ids.includes(p.id)) s.wins += 1;
          s.points_total += p.points;
          if (s.best_points === null || p.points > s.best_points) s.best_points = p.points;
        }
        // Birdie or better on gross — rung holes never count (same rule as
        // the tour stats in lib/statHelpers.js).
        for (const r of rows) {
          const par = parByHole[`${sc.course_id}|${r.hole_number}`];
          if (!r.rung && par && r.gross_score < par && statsByPlayer[r.player_id]) {
            statsByPlayer[r.player_id].birdies += 1;
          }
        }
      }

      return {
        event_id: e.id,
        scorecard_id: sc.id,
        date: e.event_date,
        course: sc.courses?.name || null,
        format: sc.format,
        scramble_drive: !!e.scramble_drive,
        status: sc.status,
        players: summary.individual.map((p) => p.name),
        winner_ids: summary.winner_ids,
        holes_played: summary.holes_played,
        headline: summary.headline,
      };
    })
    .filter(Boolean);

  const stats = Object.values(statsByPlayer)
    .map((s) => ({
      ...s,
      avg_points: s.rounds ? Math.round((s.points_total / s.rounds) * 10) / 10 : null,
    }))
    .sort((a, b) => b.wins - a.wins || b.rounds - a.rounds || a.name.localeCompare(b.name));

  return NextResponse.json({ rounds, stats });
}

// Starts a casual round in one go: creates the hidden once-off event, then
// its single scorecard with each player's Tour Handicap locked in (same
// snapshot rule as a tour scorecard — see app/api/events/[id]/scorecards).
export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const format = body.format;
  const courseId = body.course_id;
  const playerIds = Array.isArray(body.player_ids) ? body.player_ids : [];
  const teamNumbers = body.team_numbers || {};

  if (!FORMATS.includes(format)) {
    return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  }
  if (!courseId) {
    return NextResponse.json({ error: "Pick a course" }, { status: 400 });
  }
  if (playerIds.length < 2) {
    return NextResponse.json({ error: "Pick at least 2 players" }, { status: 400 });
  }
  if (format !== "individual_stableford") {
    const missing = playerIds.filter((pid) => teamNumbers[pid] !== 1 && teamNumbers[pid] !== 2);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Every player needs a team (1 or 2) for this format" },
        { status: 400 }
      );
    }
  }

  const [{ data: course }, { data: playerRows }, { data: handicaps }] = await Promise.all([
    supabase.from("courses").select("id, name").eq("id", courseId).single(),
    supabase.from("players").select("id, name").in("id", playerIds),
    supabase.from("player_handicaps").select("id, tour_handicap").in("id", playerIds),
  ]);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Auto-name, e.g. "Mike v Craig" or "Mike & Ross v Craig & BT".
  const nameById = Object.fromEntries((playerRows || []).map((p) => [p.id, firstName(p.name)]));
  const roundName =
    format === "individual_stableford"
      ? playerIds.map((pid) => nameById[pid]).join(" v ")
      : [1, 2]
          .map((n) => playerIds.filter((pid) => teamNumbers[pid] === n).map((pid) => nameById[pid]).join(" & "))
          .join(" v ");

  // Today in South African time, not the server's UTC — a round started
  // just after midnight should still get the right date.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      name: roundName,
      event_type: "once_off",
      sort_order: 0,
      event_date: today,
      golf_course: course.name,
      course_id: course.id,
      scramble_drive: !!body.scramble_drive,
      status: "upcoming",
    })
    .select()
    .single();
  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  const { data: scorecard, error: scError } = await supabase
    .from("scorecards")
    .insert({ event_id: event.id, course_id: course.id, format, group_label: roundName })
    .select()
    .single();
  if (scError) {
    await supabase.from("events").delete().eq("id", event.id);
    return NextResponse.json({ error: scError.message }, { status: 500 });
  }

  const handicapById = Object.fromEntries((handicaps || []).map((h) => [h.id, h.tour_handicap]));
  const { error: playersError } = await supabase.from("scorecard_players").insert(
    playerIds.map((pid) => ({
      scorecard_id: scorecard.id,
      player_id: pid,
      team_number: format === "individual_stableford" ? null : teamNumbers[pid],
      tour_handicap: handicapById[pid] ?? 0,
    }))
  );
  if (playersError) {
    // Deleting the event cascades to the scorecard too — nothing orphaned.
    await supabase.from("events").delete().eq("id", event.id);
    return NextResponse.json({ error: playersError.message }, { status: 500 });
  }

  await syncEventStatus(supabase, event.id);

  return NextResponse.json({ data: { event_id: event.id, scorecard_id: scorecard.id } }, { status: 201 });
}
