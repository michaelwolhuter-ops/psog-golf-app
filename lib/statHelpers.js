// Shared aggregation logic for anything built on hole-by-hole scorecard data
// or event-results ranking. Used by both a single player's profile
// (app/api/players/[id]/route.js) and the whole-field Statistics page
// (app/api/statistics/route.js) so the two can never quietly disagree on
// what counts as an eagle, a full round, or a win — Mike's explicit ask was
// for Statistics to be "based on these same stats" as the player profile.
// See projects/golf-app/memory.md for the rules this encodes (rung holes
// count toward gross but aren't an achievement, full-round gating, etc).

// Fetches every completed-scorecard hole_scores row, optionally scoped to
// one player, plus the par-per-hole lookup needed to categorize each score.
// Two DB round trips rather than one — Supabase's nested embed can't express
// "par for this specific hole of this specific course" directly against a
// hole_scores row, so the par join happens in JS, same pattern already used
// elsewhere in this project (getEventPositions, getPlayerWinCounts).
export async function fetchHoleRowsWithPar(supabase, playerId = null) {
  let query = supabase
    .from("hole_scores")
    .select(
      "player_id, gross_score, rung, three_putt, stableford_points, hole_number, scorecard_id, scorecards!inner(id, status, course_id, events(name))"
    )
    .eq("scorecards.status", "completed");
  if (playerId) query = query.eq("player_id", playerId);

  const { data: holeRows } = await query;
  if (!holeRows || holeRows.length === 0) return { holeRows: [], parByHole: {} };

  const courseIds = [...new Set(holeRows.map((r) => r.scorecards.course_id).filter(Boolean))];
  const { data: holes } = await supabase
    .from("holes")
    .select("course_id, hole_number, par")
    .in("course_id", courseIds);
  const parByHole = {};
  (holes || []).forEach((h) => {
    parByHole[`${h.course_id}|${h.hole_number}`] = h.par;
  });

  return { holeRows, parByHole };
}

// Groups hole rows by player, then by scorecard. Computes per-hole
// achievement counts (eagle/birdie/par — rung holes excluded, since a pickup
// was never actually holed out) and each scorecard's gross/points totals
// (rung holes INCLUDED in the gross total — deliberate, per Mike: the ring
// cap exists so picking up can't flatter a gross score, so a rung hole
// belongs in a "how bad was it" number, not an achievement).
//
// Rings (2026-07-27, replacing what was "Triple Bogeys"; redefined again the
// same day): a straight count of holes where stableford_points === 0 — NOT
// the `rung` flag. Mike's explicit call: for STATS purposes only, any
// zero-point hole counts as a ring, full stop, regardless of whether the
// scorecard actually marked it `rung`. This deliberately folds in genuine
// (non-rung) net-double-bogey-or-worse holes too — e.g. a 0-stroke player
// who really did make a double bogey without ever picking up — rather than
// trying to separate "capped" from "genuinely bad" for this one stat. Mike
// was explicit that the scorecard entry/capping logic itself (resolveHoleScore,
// ringCap) must NOT change for this — this is a stats-layer-only
// redefinition, `rung` and `gross_score` stay exactly what the scorecard
// already records.
//
// 3 Putts is a separate, manually-ticked flag entered by the marker at the
// moment of scoring — it isn't derived from gross-vs-par like eagle/birdie/
// par, so it's counted regardless of whether the hole was later rung (a
// player can 3-putt and then still pick up on the next stroke).
//
// Returns a Map keyed by player_id: { eagles, birdies, pars, rings,
// three_putts, rounds: [{ scorecard_id, holes_count, gross_total,
// points_total, event_name }] }. `rounds` includes partial rounds too —
// callers that only want comparable full rounds (Lowest/Highest Gross,
// Most/Lowest Points, 100+ Gross Rounds) filter on holes_count === 18
// themselves (see deriveRoundExtremes below).
export function aggregateHoleStats(holeRows, parByHole) {
  const byPlayer = new Map();

  holeRows.forEach((r) => {
    if (!byPlayer.has(r.player_id)) {
      byPlayer.set(r.player_id, {
        eagles: 0,
        birdies: 0,
        pars: 0,
        rings: 0,
        three_putts: 0,
        roundsByScorecard: new Map(),
      });
    }
    const entry = byPlayer.get(r.player_id);

    if (r.three_putt) entry.three_putts += 1;
    if (Number(r.stableford_points) === 0) entry.rings += 1;

    if (!r.rung) {
      const par = parByHole[`${r.scorecards.course_id}|${r.hole_number}`];
      if (par !== undefined) {
        const diff = r.gross_score - par;
        if (diff <= -2) entry.eagles += 1;
        else if (diff === -1) entry.birdies += 1;
        else if (diff === 0) entry.pars += 1;
      }
    }

    if (!entry.roundsByScorecard.has(r.scorecard_id)) {
      entry.roundsByScorecard.set(r.scorecard_id, {
        scorecard_id: r.scorecard_id,
        holes_count: 0,
        gross_total: 0,
        points_total: 0,
        event_name: r.scorecards?.events?.name || "Unknown event",
      });
    }
    const round = entry.roundsByScorecard.get(r.scorecard_id);
    round.holes_count += 1;
    round.gross_total += Number(r.gross_score);
    round.points_total += Number(r.stableford_points);
  });

  const result = new Map();
  byPlayer.forEach((entry, playerId) => {
    result.set(playerId, {
      eagles: entry.eagles,
      birdies: entry.birdies,
      pars: entry.pars,
      rings: entry.rings,
      three_putts: entry.three_putts,
      rounds: [...entry.roundsByScorecard.values()],
    });
  });
  return result;
}

// Derives the four full-round-only comparison stats for one player's
// aggregate (from aggregateHoleStats). Shared so the single-player profile
// and the whole-field Statistics page apply the exact same "full round" gate
// — a match-play round that finished early (e.g. "3&2") isn't comparable to
// a full 18 holes, so it's excluded here rather than counted as a fluke.
export function deriveRoundExtremes(playerAggregate) {
  const fullRounds = (playerAggregate?.rounds || []).filter((r) => r.holes_count === 18);
  if (fullRounds.length === 0) {
    return {
      lowest_gross: null,
      highest_gross: null,
      most_points: null,
      lowest_points: null,
      rounds_100_plus: 0,
      full_rounds_counted: 0,
    };
  }
  let lowestGross = fullRounds[0];
  let highestGross = fullRounds[0];
  let mostPoints = fullRounds[0];
  let lowestPoints = fullRounds[0];
  let rounds100Plus = 0;
  fullRounds.forEach((r) => {
    if (r.gross_total < lowestGross.gross_total) lowestGross = r;
    if (r.gross_total > highestGross.gross_total) highestGross = r;
    if (r.points_total > mostPoints.points_total) mostPoints = r;
    if (r.points_total < lowestPoints.points_total) lowestPoints = r;
    if (r.gross_total >= 100) rounds100Plus += 1;
  });
  return {
    lowest_gross: { value: lowestGross.gross_total, event_name: lowestGross.event_name },
    highest_gross: { value: highestGross.gross_total, event_name: highestGross.event_name },
    most_points: { value: mostPoints.points_total, event_name: mostPoints.event_name },
    lowest_points: { value: lowestPoints.points_total, event_name: lowestPoints.event_name },
    rounds_100_plus: rounds100Plus,
    full_rounds_counted: fullRounds.length,
  };
}

// Position this player finished in each event — points + LD/CTP bonuses,
// tiebroken by countback_win, sequential (not competition-ranking) position.
// Same rule as the Events page's own Event Leaderboard. Returns a lookup map
// keyed "eventId|playerId" -> position (1-based). Used by both a single
// player's Results History and the whole-field Top 3/5/10 Finishes leaderboard.
export async function getEventPositions(supabase) {
  const { data: allResults } = await supabase
    .from("event_results")
    .select("event_id, player_id, points, longest_drive, closest_to_pin, countback_win");

  const byEvent = {};
  (allResults || []).forEach((r) => {
    (byEvent[r.event_id] ||= []).push(r);
  });

  const positionByKey = {};
  Object.entries(byEvent).forEach(([eventId, group]) => {
    const ranked = group
      .filter((r) => r.points !== null && r.points !== undefined)
      .map((r) => ({
        player_id: r.player_id,
        overall: Number(r.points) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0),
        countback_win: r.countback_win,
      }))
      .sort((a, b) => {
        if (b.overall !== a.overall) return b.overall - a.overall;
        return (b.countback_win ? 1 : 0) - (a.countback_win ? 1 : 0);
      });
    ranked.forEach((r, i) => {
      positionByKey[`${eventId}|${r.player_id}`] = i + 1;
    });
  });

  return positionByKey;
}

// Per-event individual winner (top-ranked result) and team winner (top-points
// team's member ids), across every completed event. Individual win = best in
// the whole field for that event; team win = member of the top-points team.
// Shared so a single player's Wins card and the whole-field Individual/Team
// Wins leaderboards can never disagree on who actually won what.
export async function getEventWinners(supabase) {
  const [{ data: allResults }, { data: allTeams }] = await Promise.all([
    supabase
      .from("event_results")
      .select(
        "event_id, player_id, points, longest_drive, closest_to_pin, countback_win, events!inner(status)"
      )
      .eq("events.status", "completed"),
    supabase
      .from("event_teams")
      .select("id, event_id, points, event_team_members(player_id), events!inner(status)")
      .eq("events.status", "completed"),
  ]);

  const resultsByEvent = {};
  (allResults || []).forEach((r) => {
    (resultsByEvent[r.event_id] ||= []).push(r);
  });
  const individualWinnerByEvent = {};
  Object.entries(resultsByEvent).forEach(([eventId, group]) => {
    const ranked = group
      .filter((r) => r.points !== null && r.points !== undefined)
      .map((r) => ({
        player_id: r.player_id,
        overall: Number(r.points) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0),
        countback_win: r.countback_win,
      }))
      .sort((a, b) => {
        if (b.overall !== a.overall) return b.overall - a.overall;
        return (b.countback_win ? 1 : 0) - (a.countback_win ? 1 : 0);
      });
    if (ranked.length > 0) individualWinnerByEvent[eventId] = ranked[0].player_id;
  });

  const teamsByEvent = {};
  (allTeams || []).forEach((t) => {
    (teamsByEvent[t.event_id] ||= []).push(t);
  });
  const teamWinnerMembersByEvent = {};
  Object.entries(teamsByEvent).forEach(([eventId, group]) => {
    const ranked = group
      .filter((t) => t.points !== null && t.points !== undefined)
      .sort((a, b) => Number(b.points) - Number(a.points));
    if (ranked.length > 0) {
      teamWinnerMembersByEvent[eventId] = (ranked[0].event_team_members || []).map(
        (m) => m.player_id
      );
    }
  });

  return { individualWinnerByEvent, teamWinnerMembersByEvent };
}

// Tally how many times each player_id appears as an individual/team winner,
// from getEventWinners()'s output. Used by the whole-field leaderboards.
export function tallyWins({ individualWinnerByEvent, teamWinnerMembersByEvent }) {
  const individual = {};
  Object.values(individualWinnerByEvent).forEach((playerId) => {
    individual[playerId] = (individual[playerId] || 0) + 1;
  });
  const team = {};
  Object.values(teamWinnerMembersByEvent).forEach((memberIds) => {
    memberIds.forEach((playerId) => {
      team[playerId] = (team[playerId] || 0) + 1;
    });
  });
  return { individual, team };
}

// Longest Drive / Closest to the Pin career tallies, across every event a
// player has a result in — deliberately NOT gated to completed events, same
// as how a player's own profile page already counts these two (straight from
// results_history, which includes every event with a result). Kept as a
// shared helper so the Statistics page's leaderboard can't drift from that.
export async function getBonusTallies(supabase) {
  const { data: allResults } = await supabase
    .from("event_results")
    .select("player_id, longest_drive, closest_to_pin");

  const longestDrive = {};
  const closestToPin = {};
  (allResults || []).forEach((r) => {
    if (r.longest_drive) longestDrive[r.player_id] = (longestDrive[r.player_id] || 0) + 1;
    if (r.closest_to_pin) closestToPin[r.player_id] = (closestToPin[r.player_id] || 0) + 1;
  });
  return { longestDrive, closestToPin };
}

// One player's individual/team win counts — just this player's presence in
// the same winner maps every other consumer uses, instead of re-deriving.
export function getPlayerWinCounts(winners, playerId) {
  const individual = Object.values(winners.individualWinnerByEvent).filter(
    (id) => id === playerId
  ).length;
  const team = Object.values(winners.teamWinnerMembersByEvent).filter((members) =>
    members.includes(playerId)
  ).length;
  return { individual, team };
}
