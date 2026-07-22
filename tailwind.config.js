/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Dark, premium sports-broadcast palette (F1 / PGA Tour / ESPN inspired)
        posgbg: "#0a0b0a",       // page background — near black
        posgcard: "#16181a",     // card background — dark grey
        posgcardhover: "#1d2022",
        posgborder: "#26292c",
        fairway: "#22a35a",      // primary accent — golf green
        fairwaydark: "#17753f",
        gold: "#d4af37",         // highlight colour
        goldlight: "#e8c96a",
        posgtext: "#f5f6f5",     // primary text — white
        posgmuted: "#9aa09c",    // secondary text — light grey
      },
    },
  },
  plugins: [],
};
