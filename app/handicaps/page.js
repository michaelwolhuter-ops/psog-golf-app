'use client';

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(1);
}

export default function HandicapsPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/handicaps', { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) setError(body.error);
        else setRows(body.data);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Target size={22} className="text-fairway" />
        <h1 className="text-2xl font-bold text-posgtext">Handicaps</h1>
      </div>
      <p className="text-posgmuted mb-6">
        Tour handicap = average of (Index or committee Prediction, Differential) + Committee
        Adjustment. Differential = average of your last 5 rounds − 72. Updates automatically
        as rounds are logged; Committee Adjustment is set manually at any time.
      </p>

      {error && <p className="text-red-400">{error}</p>}
      {!rows && !error && <p className="text-posgmuted">Loading…</p>}

      {rows && (
        <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-posgmuted uppercase text-xs tracking-wide border-b border-posgborder">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Index</th>
                <th className="px-4 py-3 text-right">Prediction</th>
                <th className="px-4 py-3 text-right">Avg (last 5)</th>
                <th className="px-4 py-3 text-right">Differential</th>
                <th className="px-4 py-3 text-right">Committee Adj</th>
                <th className="px-4 py-3 text-right">Tour Handicap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-posgborder last:border-0 hover:bg-posgcardhover"
                >
                  <td className="px-4 py-3 text-posgtext">{r.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-posgmuted">{fmt(r.index)}</td>
                  <td className="px-4 py-3 text-right font-mono text-posgmuted">
                    {fmt(r.handicap_prediction)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-posgmuted">{fmt(r.avg_score)}</td>
                  <td className="px-4 py-3 text-right font-mono text-posgmuted">{fmt(r.differential)}</td>
                  <td className="px-4 py-3 text-right font-mono text-posgmuted">
                    {r.committee_adjustment > 0 ? '+' : ''}
                    {r.committee_adjustment}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gold">
                    {fmt(r.tour_handicap)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
