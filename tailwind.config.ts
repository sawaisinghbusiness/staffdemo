import type { Config } from "tailwindcss";

/**
 * School navy blue on white, the same as the parent app (2026-10-14). Colour carries meaning only:
 * jade = present / paid, red = absent / unpaid, marigold = waiting / leave, blue = the app and holidays.
 */
// Grey with a slight blue bias, so it sits with the brand instead of reading as a default.
const ink = {
  50: "#F5F7FB",
  100: "#EAEEF5",
  200: "#DCE2EC",
  300: "#C5CDDA",
  400: "#8A93A6",
  500: "#5F687B",
  600: "#4B5468",
  700: "#384155",
  800: "#262E42",
  900: "#16213A",
  950: "#0F172A",
};

// Present / paid.
const jade = {
  50: "#EAF7EE",
  100: "#D3F0DC",
  200: "#A9E0BA",
  500: "#1DAF55",
  600: "#16A34A",
  700: "#128A3E",
  800: "#0F6E33",
};

// Waiting / leave / half day.
const marigold = {
  50: "#FEF6E7",
  100: "#FCEBC8",
  300: "#F2C46D",
  400: "#E9A23B",
  500: "#D97706",
  600: "#B86405",
  700: "#924F04",
};

// The app's own navy blue.
const brand = {
  50: "#EEF3FD",
  100: "#E1EAFB",
  200: "#C3D4F6",
  300: "#9AB6EE",
  400: "#5E88DD",
  500: "#2F63C8",
  600: "#1446A0",
  700: "#103A86",
  800: "#0F2F6E",
  900: "#0B2252",
};

const night = {
  300: "#A9A4BA",
  400: "#858099",
  500: "#625D77",
  600: "#45405A",
  700: "#2E2A3D",
  800: "#221F2E",
  850: "#1B1824",
  900: "#16131F",
  950: "#0E0C14",
};

// Absent / unpaid.
const rose = {
  50: "#FDECEC",
  100: "#FAD7D7",
  500: "#E23B3B",
  600: "#DC2626",
  700: "#B91C1C",
};

// The driver's own look (green, yellow, black), used only on driver screens under `.drv`.
const drv = {
  green: "#12896C",
  mint: "#4DCB7F",
  yellow: "#FFCB00",
  gold: "#A07800",
  black: "#0A0A0A",
  ink: "#111111",
  mute: "#6B6B6B",
  faint: "#9A9A9A",
  soft: "#F4F4F2",
  line: "#EBEBE8",
  note: "#FFF9DB",
};

// Ajrakh (Barmer block print): the parent-messages screens' own look. Maroon, mustard, sand.
const ajk = {
  m: "#6E1E2B",
  m2: "#521520",
  pink: "#EBC9CE",
  y: "#E3A72F",
  sand: "#F5EAD7",
  sand2: "#EADBC1",
  ink: "#2B1A12",
  mute: "#7A6455",
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { slate: ink, ink, jade, emerald: jade, marigold, brand, night, rose, red: rose, canvas: "#FFFFFF", drv, ajk },
      fontFamily: {
        // One face like the parent app: Inter for Latin and numbers, Noto Sans Devanagari for Hindi.
        sans: ["'Inter Variable'", "'Noto Sans Devanagari Variable'", "system-ui", "sans-serif"],
        // Names on cards (Teacher's Note): Figtree, rounder than Inter.
        title: ["Figtree", "'Noto Sans Devanagari Variable'", "system-ui", "sans-serif"],
        // The driver's screens: Inter like ride apps, Noto Sans Devanagari for Hindi.
        drv: ["'Inter Variable'", "'Noto Sans Devanagari Variable'", "system-ui", "sans-serif"],
        // Parent messages: Baloo 2 (made for Indian scripts, Latin and Devanagari together).
        ajk: ["'Baloo 2'", "Hind", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Parents read on small phones, often outdoors: the floor is 13px, body is 16px.
        xs: ["0.8125rem", { lineHeight: "1.2rem" }],
        sm: ["0.875rem", { lineHeight: "1.3rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
      },
      // Kit corners: fields and buttons 12px, row cards 14px, banners 16px.
      borderRadius: { xl: "0.75rem", "2xl": "0.875rem", "3xl": "1rem" },
      boxShadow: {
        card: "0 1px 2px rgb(31 27 46 / 0.05), 0 10px 26px -16px rgb(31 27 46 / 0.18)",
        bar: "0 -1px 0 rgb(31 27 46 / 0.06)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        slideUp: { from: { transform: "translateY(100%)" }, to: { transform: "none" } },
        shake: { "0%,100%": { transform: "translateX(0)" }, "25%,75%": { transform: "translateX(-5px)" }, "50%": { transform: "translateX(5px)" } },
      },
      animation: {
        fadeIn: "fadeIn 0.15s ease-out both",
        rise: "rise 0.28s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.5s infinite",
        "slide-up": "slideUp 0.26s cubic-bezier(0.16, 1, 0.3, 1) both",
        shake: "shake 0.32s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
