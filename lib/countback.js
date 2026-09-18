// Automatic countback for an event's individual leaderboard — replaces the
// old manually-ticked "Countback" flag entirely (2026-09-18, Mike's call).
//
// A tie is decided on TOTAL (scorecard points + Longest Drive/Closest to the
// Pin bonus) — the bonus genuinely affects who's tied, it isn't ignored.
// But breaking a tie only looks at raw scorecard hole points, since the
// bonus isn't tied to any specific hole. That means a player who only
// reached a tied total because of their bonus will have a genuinely lower
// raw round than the player they're tied with, and will lose the tiebreak
// automatically — no special-case code needed for it.
//
// Tiers run in order, each one only matters once every tier before it is
// exactly equal: back nine, front nine, then the last 5/3/2 holes actually
// PLAYED so far (highest hole number first, not a fixed hole range) and
// finally the last hole played alone. Defining "last N" as "the N most
// recently played holes" rather than a fixed range (e.g. always holes
// 14-18) is what lets this run live, mid-round — after 5 holes, "last 5
// played" just means holes 1-5; by the time a round finishes at 18, it
// naturally becomes holes 14-18, the exact same rule either way.
export function computeCountbackTiers(holeScoreRows) {
  const rows = holeScoreRows || [];
  const byRecency = [...rows].sort((a, b) => b.hole_number - a.hole_number);
  const sum = (list) => list.reduce((s, r) => s + Number(r.stableford_points || 0), 0);
  return {
    back9_points: sum(rows.filter((r) => r.hole_number >= 10)),
    front9_points: sum(rows.filter((r) => r.hole_number <= 9)),
    last5_points: sum(byRecency.slice(0, 5)),
    last3_points: sum(byRecency.slice(0, 3)),
    last2_points: sum(byRecency.slice(0, 2)),
    last1_points: sum(byRecency.slice(0, 1)),
  };
}

export const COUNTBACK_TIERS = [
  { key: "back9_points", label: "the back nine" },
  { key: "front9_points", label: "the front nine" },
  { key: "last5_points", label: "the last 5 holes" },
  { key: "last3_points", label: "the last 3 holes" },
  { key: "last2_points", label: "the last 2 holes" },
  { key: "last1_points", label: "the last hole" },
];

// Sorts entries — each needs `.overall` plus the flat tier fields above —
// by total first, then down the countback chain, then player name as a
// final stable fallback for a tie with no hole data to break it at all
// (e.g. a manually-entered result with no scorecard behind it).
export function rankByOverallAndCountback(entries) {
  return [...entries].sort((a, b) => {
    if (b.overall !== a.overall) return b.overall - a.overall;
    for (const tier of COUNTBACK_TIERS) {
      const diff = (b[tier.key] || 0) - (a[tier.key] || 0);
      if (diff !== 0) return diff;
    }
    return (a.name || "").localeCompare(b.name || "");
  });
}

// Which tier (if any) actually separated two entries level on total — for a
// "Won on countback — the front nine" style label. Null if they're not
// level on total, or if every tier is exactly equal too (a genuine dead
// tie with no hole data to separate them).
export function decidingCountbackTier(a, b) {
  if (a.overall !== b.overall) return null;
  for (const tier of COUNTBACK_TIERS) {
    if ((a[tier.key] || 0) !== (b[tier.key] || 0)) return tier.label;
  }
  return null;
}

// Maps every player who has a scorecard to "eventId|playerId" -> scorecardId,
// via scorecards/scorecard_players — deliberately NOT via
// event_results.scorecard_id. That column gets cleared to null the moment a
// human edits that result by hand (ticking Longest Drive, Closest to the
// Pin, the old manual countback flag, anything), by design — so a later
// scorecard delete/reopen can't touch a row a human has taken ownership of.
// But the real scorecard and its hole-by-hole data are still there; only
// the pointer to it on event_results was cleared. Relying on that pointer
// silently made a manually-touched player look like they had NO hole data
// at all — caught 2026-09-18 when it flipped a real countback result
// (Brett Peckham had won Qualifier 2's tie on the live leaderboard, which
// finds scorecards this same safe way, but the Order of Merit's own lookup
// via event_results.scorecard_id came up empty for him and handed the win
// to BT Schroder instead). A player only ever has one scorecard per event,
// so this is a safe 1:1 map regardless.
export async function getPlayerScorecardMap(supabase, eventIds = null) {
  let query = supabase.from("scorecards").select("id, event_id, scorecard_players(player_id)");
  if (eventIds) query = query.in("event_id", eventIds);
  const { data: scorecards } = await query;
  const map = {};
  (scorecards || []).forEach((sc) => {
    (sc.scorecard_players || []).forEach((sp) => {
      map[`${sc.event_id}|${sp.player_id}`] = sc.id;
    });
  });
  return map;
}

// Given event_results rows (event_id, player_id, points, longest_drive,
// closest_to_pin, optional name), every hole_scores row for the relevant
// scorecards, and a playerScorecardMap from getPlayerScorecardMap() above,
// ranks each event's field and returns a lookup: eventId -> ranked [{
// player_id, name, overall, ...tiers }] array, best first. Shared by
// everything that needs to know "who finished where in this event" — a
// player's Results History, the whole field's Top Finishes, the Events
// list's Individual Winner column — so none of them can drift from each
// other or from the live leaderboard.
export function rankEventResults(resultsRows, holeScoreRows, playerScorecardMap = {}) {
  const holesByScorecardPlayer = {};
  (holeScoreRows || []).forEach((hs) => {
    const key = `${hs.scorecard_id}|${hs.player_id}`;
    (holesByScorecardPlayer[key] ||= []).push(hs);
  });

  const byEvent = {};
  (resultsRows || []).forEach((r) => {
    if (r.points === null || r.points === undefined) return;
    (byEvent[r.event_id] ||= []).push(r);
  });

  const rankedByEvent = {};
  Object.entries(byEvent).forEach(([eventId, group]) => {
    const entries = group.map((r) => {
      const scorecardId = playerScorecardMap[`${eventId}|${r.player_id}`];
      return {
        player_id: r.player_id,
        name: r.name,
        overall: Number(r.points) + (r.longest_drive ? 2 : 0) + (r.closest_to_pin ? 2 : 0),
        ...computeCountbackTiers(scorecardId ? holesByScorecardPlayer[`${scorecardId}|${r.player_id}`] : []),
      };
    });
    rankedByEvent[eventId] = rankByOverallAndCountback(entries);
  });
  return rankedByEvent;
}
