'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';

// Read-only view of a course's 18 holes, styled like the physical scorecard
// Mike photographed — par + stroke index rows are the load-bearing data for
// any future scoring; yardage is display-only. No score entry here, no
// scoring logic — this is purely "what does this course look like."
export default function CourseScorecardPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/courses/${id}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setCourse(body.data);
      });
  }, [id]);

  if (error) {
    return (
      <div>
        <p className="text-red-400">{error}</p>
        <Link href="/events" className="text-fairway text-sm">
          ← Back to events
        </Link>
      </div>
    );
  }

  if (!course) return <p className="text-posgmuted">Loading…</p>;

  const front = course.holes.filter((h) => h.hole_number <= 9);
  const back = course.holes.filter((h) => h.hole_number > 9);
  const sum = (holes, field) => holes.reduce((t, h) => t + (h[field] || 0), 0);

  const hasRedYardage = course.holes.some((h) => h.yardage_red);

  function Nine({ label, holes }) {
    return (
      <div className="bg-posgcard rounded-xl border border-posgborder overflow-x-auto mb-6">
        <table className="w-full text-sm text-center">
          <thead>
            <tr className="border-b border-posgborder">
              <th className="px-3 py-2 text-left text-posgmuted uppercase text-xs tracking-wide">
                {label}
              </th>
              {holes.map((h) => (
                <th key={h.hole_number} className="px-3 py-2 text-posgtext font-semibold">
                  {h.hole_number}
                </th>
              ))}
              <th className="px-3 py-2 text-gold font-bold">Out/In</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-posgborder">
              <td className="px-3 py-2 text-left text-posgmuted">Par</td>
              {holes.map((h) => (
                <td key={h.hole_number} className="px-3 py-2 text-posgtext">
                  {h.par}
                </td>
              ))}
              <td className="px-3 py-2 text-gold font-semibold">{sum(holes, 'par')}</td>
            </tr>
            <tr className="border-b border-posgborder">
              <td className="px-3 py-2 text-left text-posgmuted">Stroke Index</td>
              {holes.map((h) => (
                <td key={h.hole_number} className="px-3 py-2 text-posgmuted">
                  {h.stroke_index}
                </td>
              ))}
              <td className="px-3 py-2 text-posgmuted">—</td>
            </tr>
            <tr className={hasRedYardage ? 'border-b border-posgborder' : ''}>
              <td className="px-3 py-2 text-left text-posgmuted">White Yardage</td>
              {holes.map((h) => (
                <td key={h.hole_number} className="px-3 py-2 text-posgtext font-mono text-xs">
                  {h.yardage_white ?? '—'}
                </td>
              ))}
              <td className="px-3 py-2 text-posgtext font-mono text-xs">
                {sum(holes, 'yardage_white') || '—'}
              </td>
            </tr>
            {hasRedYardage && (
              <tr>
                <td className="px-3 py-2 text-left text-posgmuted">Red Yardage</td>
                {holes.map((h) => (
                  <td key={h.hole_number} className="px-3 py-2 text-posgtext font-mono text-xs">
                    {h.yardage_red ?? '—'}
                  </td>
                ))}
                <td className="px-3 py-2 text-posgtext font-mono text-xs">
                  {sum(holes, 'yardage_red') || '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/events"
        className="inline-flex items-center gap-1 text-sm text-posgmuted hover:text-posgtext mb-4"
      >
        <ArrowLeft size={14} /> All events
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <MapPin size={22} className="text-fairway" />
        <h1 className="text-2xl font-bold text-posgtext">{course.name}</h1>
      </div>
      <p className="text-posgmuted mb-6">
        Par {sum(course.holes, 'par')} · {course.holes.length} holes
        {course.notes ? ` · ${course.notes}` : ''}
      </p>

      {front.length > 0 && <Nine label="Front 9" holes={front} />}
      {back.length > 0 && <Nine label="Back 9" holes={back} />}

      <p className="text-xs text-posgmuted">
        White tees only — POSG plays full Tour Handicap, no percentage adjustment. Yardage is
        for reference only; par and stroke index are what any future scoring will use.
      </p>
    </div>
  );
}
