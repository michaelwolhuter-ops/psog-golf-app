/** @type {import('next').NextConfig} */
const nextConfig = {
  // This is an admin tool where data changes constantly (enter results, flip
  // back to the list, expect to see it). Next.js's default client-side page
  // cache was showing stale data after navigating back — this turns that
  // cache off so every page always re-fetches fresh from Supabase.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

module.exports = nextConfig;
