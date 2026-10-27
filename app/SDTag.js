// Small "SD" badge for a round played as scramble drive (events.scramble_drive,
// added 2026-10-27). Display only — Mike's call: scramble drive changes
// nothing in scoring, results, Order of Merit or handicaps, it just flags
// rounds on the stats so a low gross isn't read as an own-ball score.
export default function SDTag({ show = true }) {
  if (!show) return null;
  return (
    <span
      title="Scramble drive"
      className="inline-block align-middle text-[9px] font-extrabold tracking-wide leading-none bg-gold/15 text-gold border border-gold/40 px-1 py-0.5 rounded ml-1"
    >
      SD
    </span>
  );
}
