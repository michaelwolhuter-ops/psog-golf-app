import { BarChart3 } from 'lucide-react';

const placeholders = [
  { label: 'Most Birdies', value: '—' },
  { label: 'Most Wins', value: '—' },
  { label: 'Lowest Gross', value: '—' },
  { label: 'Best Average', value: '—' },
];

export default function StatisticsPage() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={22} className="text-fairway" />
        <h1 className="text-2xl font-bold text-posgtext">Statistics</h1>
      </div>
      <p className="text-posgmuted mb-6">
        Reserved for future development. Once hole-by-hole scorecards exist, this page will
        show career stats, records, and head-to-head history.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {placeholders.map((p) => (
          <div
            key={p.label}
            className="bg-posgcard rounded-xl border border-posgborder p-5"
          >
            <div className="text-xs text-posgmuted uppercase tracking-wide">{p.label}</div>
            <div className="text-2xl font-bold text-gold mt-1">{p.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
