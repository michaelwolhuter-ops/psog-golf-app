# POSG Golf Tour — Phase 1

Order of merit, handicaps, players, and events dashboards for the POSG golf group. No login — open site, per Mike's choice for now.

## Run locally

```
npm install
npm run dev
```

Then open http://localhost:3000

`.env.local` already has the Supabase project URL and anon key filled in (project: POSG Golf Tour, id `seamcmjxvwzjvkhcoswi`).

## What's in Phase 1

- **Order of Merit** — season standings, read-only
- **Handicaps** — tour handicap per player, read-only, computed live from the database
- **Players** — full player list, with a simple add-player form
- **Events** — the 4 qualifiers + 2 tour days, and who's qualified for tour (attended 2+ qualifiers)

No score entry yet, no live match view, no format-specific logic (better ball / scramble / American scramble). That's a later phase.

## Notes

- All player, event, and result data was seeded from `POSG Tour.xlsx` (the live current-season workbook), not `POSG Handicaps.xlsx` (an earlier blank template).
- One name was corrected during import: "Darrn O" → "Darren O" (a typo in one tab — the other two tabs already had it spelled correctly). Trailing spaces on a couple of names were also trimmed.
- Tour Handicap formula: average of (Index or committee Prediction, Differential) + Committee Adjustment, where Differential = average of your last 5 logged rounds − 72. This matches the actual Excel formula, not the slightly different verbal description ("add them together") — the sheet's formula is an average, not a sum.
