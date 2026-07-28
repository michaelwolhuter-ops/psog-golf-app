/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Dark, premium sports-broadcast palette (F1 / PGA Tour / ESPN inspired),
        // re-tinted 2026-07-28 to match the crest logo's navy + green branding.
        // Neutrals (bg/card/border) shifted from flat grey toward a navy tint so
        // the UI reads as "branded" even where no accent colour is present.
        // fairway/gold were deliberately left alone: the logo's own navy/green
        // only pop because they sit on a bright shield fill, not on near-black —
        // copying those exact muted tones onto this dark UI would make text and
        // accents HARDER to see, not easier. Bright fairway + gold stay as the
        // high-contrast accents; navy is added as a surface tone only, never as
        // text-on-dark.
        posgbg: "#070b10",       // page background — near-black, navy tint
        posgcard: "#111a26",     // card background — dark navy-grey
        posgcardhover: "#182233",
        posgborder: "#2a3a4d",   // brighter/more visible border than before
        fairway: "#22a35a",      // primary accent — golf green (unchanged, already matches)
        fairwaydark: "#17753f",
        gold: "#d4af37",         // highlight colour (unchanged — strongest contrast on dark bg)
        goldlight: "#e8c96a",
        posgtext: "#f5f6f5",     // primary text — white
        posgmuted: "#a9b6b0",    // secondary text — brightened slightly for legibility
        navy: "#12233a",         // new: crest navy, for surface/badge tints only
        navylight: "#1c3a5e",    // new: lighter navy, for badges/pills under white or gold text
      },
    },
  },
  plugins: [],
};
