// Pure scoring-engine functions for the digital scorecard — no Supabase, no
// React, nothing UI-specific. Every rule here was worked out and confirmed
// with Mike in the design session before any of this was built (see
// projects/golf-app/memory.md, "Score entry / live scoring — design
// discussion"). Kept in one file so the entry screens can stay dumb (call a
// function, show the result) and every format shares the exact same
// underlying stroke/points math — only the team layer on top differs.

// Rounds a decimal Tour Handicap to a whole number for stroke allocation.
// POSG's own rounding rule (confirmed by Mike, 2026-07-24) — NOT standard
// "round half up": a fractional part of exactly .5 rounds DOWN, anything
// above .5 rounds UP. E.g. 12.5 -> 12, 12.6 -> 13. This was a real bug
// before this fix — JS's own Math.round(12.5) gives 13, which is the
// opposite of what this tour wants, and it matters at the exact boundary:
// it decides whether a player does or doesn't get a stroke on the hole
// whose stroke index equals their rounded handicap (Mike calls this their
// "birthday hole").
// Exported (not just internal to strokesReceived) so every place Tour
// Handicap is displayed to a person — player profile, players list,
// handicaps page, dashboard, scorecard screens — can show the same whole
// number that's actually driving stroke allocation on the course, instead
// of the raw decimal, which is what caused the "birthday hole" confusion
// this rule was written to fix in the first place.
export function roundHandicapForStrokes(tourHandicap) {
  if (tourHandicap == null) return null;
  const floor = Math.floor(tourHandicap);
  // Round the fractional part to 2dp first so float noise (e.g. 12.5
  // arriving as 12.499999999999998 from averaging) can't flip which side
  // of the .5 cutoff it lands on.
  const frac = Math.round((tourHandicap - floor) * 100) / 100;
  return frac > 0.5 ? floor + 1 : floor;
}

// How many strokes a player receives on one hole, given their Tour Handicap
// and that hole's stroke index (1 = hardest hole, 18 = easiest). Mike's own
// terms: "no stroke" (0), "single stroke" (1), "double stroke" (2).
export function strokesReceived(tourHandicap, strokeIndex) {
  const h = roundHandicapForStrokes(tourHandicap);
  const base = Math.floor(h / 18);
  const remainder = h % 18;
  // strokeIndex === remainder is the player's "birthday hole" — the one
  // hole where their exact rounded handicap matches the stroke index.
  // Included naturally by <=, not a separate rule.
  return base + (strokeIndex <= remainder ? 1 : 0);
}

// Stableford points for one hole. net = gross score minus strokes received.
// Confirmed table: net eagle=4, net birdie=3, net par=2, net bogey=1, net
// double bogey=0 (and anything worse than double bogey also floors at 0 —
// stableford points never go negative).
export function stablefordPoints(grossScore, par, strokesReceivedOnHole) {
  const net = grossScore - strokesReceivedOnHole;
  const diff = net - par; // 0 = par, -1 = birdie, +1 = bogey, etc.
  return Math.max(0, 2 - diff);
}

// Flat maximum recordable gross for any hole, regardless of strokes
// received — Mike's simplified rule (2026-07-27), replacing the earlier
// per-stroke-count formula that gave double-stroke players one extra shot.
// Nobody is ever recorded worse than triple bogey, full stop, no exceptions.
export function ringCap(par) {
  return par + 3;
}

// The single source of truth for what actually gets saved for one player's
// hole: the marker always types in whatever the player genuinely made (even
// a bad number like a 10), never a number they pick to flatter themselves —
// this function decides whether that number is used as-is or capped.
//
// - At or under the cap (par+3): a genuine score. Normal stableford math
//   applies, which can still earn a point even at exactly triple bogey if
//   the player has strokes cushioning it (e.g. a double-stroke player's
//   real net score there is only a bogey, not a double bogey).
// - Over the cap, OR the marker explicitly tapped "Ring" (gave up without
//   finishing, so there's no genuine number to type): the recorded gross is
//   capped at par+3 and points are FORCED to 0, regardless of strokes
//   received. Running the capped number through the normal net-score
//   formula would wrongly hand a point to a double-stroke player — forcing
//   0 here is what keeps ringing/capping meaningless for points, which is
//   the whole point of having a cap at all.
export function resolveHoleScore(trueGrossScore, par, strokesReceivedOnHole, explicitRing) {
  const cap = ringCap(par);
  const overCap = trueGrossScore > cap;
  const rung = !!explicitRing || overCap;
  if (rung) {
    return { gross_score: cap, rung: true, stableford_points: 0 };
  }
  return {
    gross_score: trueGrossScore,
    rung: false,
    stableford_points: stablefordPoints(trueGrossScore, par, strokesReceivedOnHole),
  };
}

// Better ball (stroke play): the team's points for one hole are whichever
// partner scored higher individually — never summed. Works identically for
// the match-play variant; match play just compares this per-hole number
// between the two pairs instead of summing it across 18 holes.
export function betterBallHolePoints(playerAPoints, playerBPoints) {
  return Math.max(playerAPoints, playerBPoints);
}

// Who won one hole of a better-ball match: whichever pair's better-ball
// points are higher wins the hole, equal points halves it.
export function matchPlayHoleResult(teamABetterBallPoints, teamBBetterBallPoints) {
  if (teamABetterBallPoints > teamBBetterBallPoints) return 'A';
  if (teamBBetterBallPoints > teamABetterBallPoints) return 'B';
  return 'halve';
}

// Running (or final) match status from an ordered array of per-hole results
// ('A' | 'B' | 'halve'), standard match-play scoring including closing a
// match out early once the leading team's lead can't be caught (e.g. "3&2"
// = 3 up with 2 holes left to play — no need to play them out).
//
// Returns { decided, winningTeam, margin, holesPlayed, holesRemaining,
// dormie, label }. `label` is what you'd write on a scoreboard: "3&2" if
// closed out early, "2UP" if the leader is ahead after all 18 are played,
// "AS" ("all square") if halved after 18. While still in progress (decided:
// false), label/winningTeam describe the current state, e.g. "2UP thru 11".
// `dormie` is true when the leader's margin exactly equals the holes left —
// the trailing team can still force a halved MATCH (square it up) but can no
// longer win it outright.
export function matchStatus(holeResults, totalHoles = 18) {
  let diff = 0; // positive = team A ahead, negative = team B ahead
  let holesPlayed = 0;

  for (const result of holeResults) {
    holesPlayed++;
    if (result === 'A') diff++;
    else if (result === 'B') diff--;

    const holesRemaining = totalHoles - holesPlayed;
    // Only an early close-out ("3&2" style) if holes are actually left
    // unplayed. A match decided on the very last hole isn't "1&0" — that's
    // not a real golf scoreline — it's just "1UP", handled below.
    if (holesRemaining > 0 && Math.abs(diff) > holesRemaining) {
      return {
        decided: true,
        winningTeam: diff > 0 ? 'A' : 'B',
        margin: Math.abs(diff),
        holesPlayed,
        holesRemaining,
        dormie: false,
        label: `${Math.abs(diff)}&${holesRemaining}`,
      };
    }
  }

  if (holesPlayed === totalHoles) {
    if (diff === 0) {
      return {
        decided: true,
        winningTeam: null,
        margin: 0,
        holesPlayed,
        holesRemaining: 0,
        dormie: false,
        label: 'AS',
      };
    }
    return {
      decided: true,
      winningTeam: diff > 0 ? 'A' : 'B',
      margin: Math.abs(diff),
      holesPlayed,
      holesRemaining: 0,
      dormie: false,
      label: `${Math.abs(diff)}UP`,
    };
  }

  // Still in progress — describe where things stand right now.
  const holesRemaining = totalHoles - holesPlayed;
  const winningTeam = diff > 0 ? 'A' : diff < 0 ? 'B' : null;
  const dormie = diff !== 0 && Math.abs(diff) === holesRemaining;
  const label = diff === 0 ? `AS thru ${holesPlayed}` : `${Math.abs(diff)}UP thru ${holesPlayed}`;
  return { decided: false, winningTeam, margin: Math.abs(diff), holesPlayed, holesRemaining, dormie, label };
}

// Reframes a raw matchStatus (always written from team A's point of view)
// into how ONE specific team should read it on their own leaderboard row —
// "4 Up" vs "4 Down" instead of a fixed A/B, "Won"/"Lost" instead of a
// winningTeam letter, plus a single signed `dominance` number so a whole
// field of teams (some ahead, some behind, some finished) can be ranked
// together on one leaderboard: positive = winning by that much, negative =
// losing by that much, 0 = level. teamNumber is 1 for team A, 2 for team B
// (matches the scorecard_players.team_number convention used everywhere
// else in the app).
export function matchPerspective(status, teamNumber) {
  const isSelf = (letter) => (teamNumber === 1 ? letter === 'A' : letter === 'B');
  const currentHole = status.decided ? null : Math.min(status.holesPlayed + 1, 18);

  let label, state, dominance;
  if (status.decided) {
    if (status.winningTeam === null) {
      label = 'All Square';
      state = 'halved';
      dominance = 0;
    } else {
      const won = isSelf(status.winningTeam);
      const scoreline = status.label.includes('&')
        ? `${status.margin} & ${status.holesRemaining}`
        : `${status.margin} Up`;
      label = `${won ? 'Won' : 'Lost'} ${scoreline}`;
      state = won ? 'won' : 'lost';
      dominance = won ? status.margin : -status.margin;
    }
  } else if (status.winningTeam === null) {
    label = `All Square thru ${status.holesPlayed}`;
    state = 'square';
    dominance = 0;
  } else {
    // Dormie only reframes the LEADER's own label ("Dormie 2" instead of
    // "2 Up") — the trailing side still reads it as a normal deficit
    // ("2 Down"), just with the separate `dormie` flag the caller can use
    // to add its own "can only draw level" marker to that row too.
    const ahead = isSelf(status.winningTeam);
    label =
      status.dormie && ahead
        ? `Dormie ${status.margin}`
        : `${status.margin} ${ahead ? 'Up' : 'Down'} thru ${status.holesPlayed}`;
    state = ahead ? 'up' : 'down';
    dominance = ahead ? status.margin : -status.margin;
  }

  return { label, state, dominance, current_hole: currentHole };
}

// The single big scoreboard line for a match card/header that shows BOTH
// teams at once (unlike matchPerspective, which is written from one team's
// point of view for the Domination Leaderboard). Names the leader rather
// than picking a side, e.g. "MARK & BT WON 4 & 3", "3 UP", "DORMIE 2",
// "ALL SQUARE" — plus which color (team A = fairway, team B = gold, tied =
// neutral) the leader should be shown in, matching the fairway/gold split
// already used everywhere else in the app for Team 1 vs Team 2.
export function matchHeadline(status, namesA, namesB) {
  if (!status) return { text: '—', color: 'neutral' };
  if (status.decided) {
    if (!status.winningTeam) return { text: 'ALL SQUARE', color: 'neutral' };
    const winnerName = status.winningTeam === 'A' ? namesA : namesB;
    const scoreline = status.label.includes('&')
      ? `${status.margin} & ${status.holesRemaining}`
      : `${status.margin} UP`;
    return { text: `${winnerName} won ${scoreline}`, color: status.winningTeam === 'A' ? 'a' : 'b' };
  }
  if (!status.winningTeam) return { text: 'ALL SQUARE', color: 'neutral' };
  const color = status.winningTeam === 'A' ? 'a' : 'b';
  if (status.dormie) return { text: `DORMIE ${status.margin}`, color };
  return { text: `${status.margin} UP`, color };
}

// Hole-by-hole progression of a match, for a "relive the round" timeline —
// one entry per hole played, each carrying the running match status right
// after that hole. Stops as soon as the match is mathematically decided
// (matches matchStatus's own early close-out), since holes after that were
// never meaningful to the result even if entered.
export function matchProgression(holeResults, totalHoles = 18) {
  const timeline = [];
  for (let i = 0; i < holeResults.length; i++) {
    const statusAfter = matchStatus(holeResults.slice(0, i + 1), totalHoles);
    timeline.push({
      hole_number: i + 1,
      result: holeResults[i],
      label: statusAfter.label,
      decided: statusAfter.decided,
    });
    if (statusAfter.decided) break;
  }
  return timeline;
}
